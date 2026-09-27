/**
 * GenProvider（T2.1）自测：纯函数/异步直跑，不需要浏览器。
 * 运行：pnpm tsx scripts/check-providers.ts
 */
import { getProvider, providers } from "../src/server/providers/registry";
import type { GenInput } from "../src/server/providers/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

function baseInput(over: Partial<GenInput> = {}): GenInput {
  return {
    nodeId: "node_test01",
    nodeKind: "text",
    prompt: "一段关于光合作用的讲解",
    title: "文本节点",
    params: { aspectRatio: "16:9" },
    upstreams: [],
    ...over,
  };
}

async function main() {
  // —— 注册表 ——
  check("4 个产物种类都注册了 provider", Object.keys(providers).length === 4);
  check("text 节点 → text provider", getProvider("text").kind === "text");
  check("script 节点 → 复用 text provider", getProvider("script").kind === "text");
  check("image 节点 → image provider", getProvider("image").kind === "image");
  check("video 节点 → video provider", getProvider("video").kind === "video");
  check("audio 节点 → audio provider", getProvider("audio").kind === "audio");
  check("provider.handles 含其负责的种类", getProvider("text").handles.includes("script"));

  // —— 积分估算 ——
  check("文本积分=2", getProvider("text").costEstimate(baseInput()) === 2);
  check("图片积分=12", getProvider("image").costEstimate(baseInput()) === 12);
  check("视频积分=135", getProvider("video").costEstimate(baseInput()) === 135);

  // —— 文本生成 ——
  const prog: number[] = [];
  const tRes = await getProvider("text").generate(
    baseInput(),
    { runId: "run1", onProgress: (p) => prog.push(p) },
  );
  check("文本产物有 text", typeof tRes.text === "string" && tRes.text.length > 0);
  check("文本是合法 JSON 头部", tRes.text!.includes('"action": "text_to_image"'));
  check("进度回调非空且递增", prog.length >= 3 && prog[prog.length - 1] <= 99);
  check("进度单调不回退", prog.every((v, i) => i === 0 || v >= prog[i - 1]));

  // —— 脚本节点走 action=generate_storyboard ——
  const sRes = await getProvider("script").generate(
    baseInput({ nodeKind: "script" }),
    { runId: "run2" },
  );
  check("脚本产物 action=generate_storyboard", sRes.text!.includes("generate_storyboard"));

  // —— 图片生成（data URL）——
  const iRes = await getProvider("image").generate(
    baseInput({ nodeKind: "image" }),
    { runId: "run3" },
  );
  check("图片产物有 urls", Array.isArray(iRes.urls) && iRes.urls.length === 1);
  check("图片是 svg data URL", iRes.urls![0].startsWith("data:image/svg+xml"));
  check("图片产物含提示词", decodeURIComponent(iRes.urls![0]).includes("光合作用"));

  // —— 视频生成 ——
  const vRes = await getProvider("video").generate(
    baseInput({ nodeKind: "video" }),
    { runId: "run4" },
  );
  check("视频产物是 svg data URL", vRes.urls![0].startsWith("data:image/svg+xml"));
  check("视频产物标注 VIDEO", decodeURIComponent(vRes.urls![0]).includes("VIDEO"));

  // —— 音频生成 ——
  const aRes = await getProvider("audio").generate(
    baseInput({ nodeKind: "audio" }),
    { runId: "run5" },
  );
  check("音频产物是 svg data URL", aRes.urls![0].startsWith("data:image/svg+xml"));

  // —— 上游上下文隐式注入 ——
  const withUp = await getProvider("text").generate(
    baseInput({
      upstreams: [
        { nodeId: "up1", title: "文本节点 1", kind: "text", summary: "光合作用定义文本" },
      ],
    }),
    { runId: "run6" },
  );
  check("文本产物含上游上下文", withUp.text!.includes("上游上下文") && withUp.text!.includes("光合作用定义文本"));
  check("文本 JSON 含 upstream_context", withUp.text!.includes("upstream_context"));

  const imgUp = await getProvider("image").generate(
    baseInput({
      nodeKind: "image",
      upstreams: [
        { nodeId: "up1", title: "文本节点 1", kind: "text", summary: "上游摘要" },
      ],
    }),
    { runId: "run7" },
  );
  check("图片产物含“基于上游”", decodeURIComponent(imgUp.urls![0]).includes("基于上游：文本节点 1"));

  // —— AbortSignal 中止 ——
  let aborted = false;
  const ac = new AbortController();
  const p = getProvider("video")
    .generate(baseInput({ nodeKind: "video" }), { runId: "run8", signal: ac.signal })
    .catch((e) => {
      if (e?.name === "AbortError") aborted = true;
    });
  ac.abort();
  await p;
  check("中止信号能打断生成", aborted);

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
