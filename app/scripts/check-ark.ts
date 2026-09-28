/**
 * 火山方舟（M6）自测：模型映射 + 三个真实 provider 打通 + 产物落盘 + 中止。
 *
 * 运行：pnpm tsx scripts/check-ark.ts
 *
 * ⚠️ 本脚本会**真实调用 ARK API**：默认 1 次文本 + 1 张图 + 1 次鉴权失败调用。
 *    视频部分（异步任务轮询 + 中止）默认**跳过**，因为 Seedance 较慢且按秒计费，
 *    需要验证时显式设 ARK_TEST_VIDEO=1。
 *    完全不想花钱设 ARK_SKIP_LIVE=1，只跑纯函数部分。
 *
 * 注意：普通 tsx 脚本不会自动加载 .env（Next 才会），所以这里手动读一次，
 * 且必须在 import registry 之前完成——registry 是在模块加载时读 env 决定实现的。
 */
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

/* ---------- 手动加载 .env ---------- */
function loadDotEnv() {
  try {
    const txt = readFileSync(path.join(process.cwd(), ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!m) continue;
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (process.env[m[1]] === undefined && val) process.env[m[1]] = val;
    }
  } catch {
    /* 没有 .env 就走 mock 分支 */
  }
}
loadDotEnv();

const SKIP_LIVE = process.env.ARK_SKIP_LIVE === "1";
const HAS_KEY = !!process.env.ARK_API_KEY?.trim();

async function main() {
  const { resolveArkModel, arkEnabled, AVAILABLE_MODELS } = await import(
    "../src/server/providers/ark/config"
  );
  const registry = await import("../src/server/providers/registry");
  const { arkImageProvider, arkTextProvider, arkVideoProvider } = await import(
    "../src/server/providers/ark"
  );
  const { persistRemoteMedia } = await import(
    "../src/server/providers/mediaStore"
  );

  /* ---------------- 纯函数：模型映射（不需要 Key） ---------------- */

  check("ARK Key 已配置", arkEnabled(), HAS_KEY ? "已读到" : "未读到（live 测试会跳过）");

  check(
    "文本：产品名映射到真实 id",
    resolveArkModel("text", "Doubao Seed 2.1 Pro") === "doubao-seed-2-1-pro-260628",
  );
  check(
    "文本：旧虚构名作为别名仍可用",
    resolveArkModel("text", "GVLM 3.1") === "doubao-seed-2-1-pro-260628",
  );
  check(
    "图片：Seedream 5.0 Pro",
    resolveArkModel("image", "Seedream 5.0 Pro") === "doubao-seedream-5-0-pro-260628",
  );
  check(
    "视频：Seedance 1.0 Pro Fast",
    resolveArkModel("video", "Seedance 1.0 Pro Fast") ===
      "doubao-seedance-1-0-pro-fast-251015",
  );
  check(
    "视频：旧名 Kling O3 也能落到已开通模型（不报 ModelNotOpen）",
    resolveArkModel("video", "Kling O3") === "doubao-seedance-1-0-pro-fast-251015",
  );
  check(
    "script 节点按文本解析",
    resolveArkModel("script", "DeepSeek V4 Pro") === "deepseek-v4-pro-ga-260813",
  );
  check(
    "未知产品名 → 按种类兜底",
    resolveArkModel("image", "不存在的模型") === "doubao-seedream-5-0-pro-260628",
  );
  check(
    "直接填真实模型 id 时原样透传",
    resolveArkModel("image", "doubao-seedream-4-0-250828") ===
      "doubao-seedream-4-0-250828",
  );
  check("模型名缺省时不报错", resolveArkModel("text", undefined).length > 0);

  process.env.ARK_MODEL_IMAGE = "doubao-seedream-4-0-250828";
  check(
    "env 覆盖优先于映射表",
    resolveArkModel("image", "Seedream 5.0 Pro") === "doubao-seedream-4-0-250828",
  );
  delete process.env.ARK_MODEL_IMAGE;

  check(
    "AVAILABLE_MODELS 只列真实可用的",
    AVAILABLE_MODELS.image.length === 2 && AVAILABLE_MODELS.video.length === 1,
  );

  /* ---------------- 注册表按 env 选择实现 ---------------- */

  const status = registry.providerStatus();
  if (HAS_KEY) {
    check("配了 Key → 文本/图片/视频走 ARK", status.text === "ark" && status.image === "ark" && status.video === "ark");
    check("音频无真实实现 → 仍为 mock", status.audio === "mock");
    check("getProvider(text).name 是 ark-text", registry.getProvider("text").name === "ark-text");
    check("getProvider(script) 复用文本 provider", registry.getProvider("script").name === "ark-text");
    check("getProvider(audio) 仍是 mock-audio", registry.getProvider("audio").name === "mock-audio");
  } else {
    check("未配 Key → 全部走 mock", status.text === "mock" && status.video === "mock");
    check("usingMockProviders() 为 true", registry.usingMockProviders() === true);
  }

  /* ---------------- 落盘：本地/内联产物不重复下载 ---------------- */

  const dataUrl = "data:image/svg+xml;base64,AAAA";
  check(
    "data: URL 直接透传（不下载）",
    (await persistRemoteMedia(dataUrl, "image")) === dataUrl,
  );
  check(
    "本地 /uploads 路径直接透传",
    (await persistRemoteMedia("/uploads/x.png", "image")) === "/uploads/x.png",
  );

  /* ---------------- 真实调用 ---------------- */

  if (!HAS_KEY || SKIP_LIVE) {
    console.log(
      `\n跳过分包①真实 API 调用（${!HAS_KEY ? "未配 ARK_API_KEY" : "ARK_SKIP_LIVE=1"}）`,
    );
    console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
    process.exit(failed === 0 ? 0 : 1);
  }

  const base = {
    nodeId: "node_ark_test",
    title: "ARK 自测",
    params: {},
    upstreams: [],
  };

  /* ① 文本 → 结构化分镜 */
  const textProgress: number[] = [];
  const textRes = await arkTextProvider.generate(
    {
      ...base,
      nodeKind: "text",
      prompt: "用三个镜头讲清楚「光合作用是什么」，面向初中生",
      params: { model: "Doubao Seed 2.1 Pro" },
    },
    { runId: "run_ark_text", onProgress: (p) => textProgress.push(p) },
  );
  check("文本：产出了分镜", !!textRes.shots?.length, `${textRes.shots?.length ?? 0} 镜`);
  check(
    "文本：分镜数量在 3–6 之间",
    (textRes.shots?.length ?? 0) >= 3 && (textRes.shots?.length ?? 0) <= 6,
  );
  check("文本：产出可读文本产物", (textRes.text?.length ?? 0) > 50);
  const FRAMINGS = ["远景", "全景", "中景", "近景", "特写"];
  check(
    "文本：framing 都是合法枚举",
    (textRes.shots ?? []).every((s) => FRAMINGS.includes(s.framing)),
  );
  check(
    "文本：duration 是 2–12 的整数",
    (textRes.shots ?? []).every(
      (s) => Number.isInteger(s.duration) && s.duration >= 2 && s.duration <= 12,
    ),
  );
  check(
    "文本：shot id/index 连续且 confirmed 初始为 false",
    (textRes.shots ?? []).every(
      (s, i) => s.id === `shot-${i + 1}` && s.index === i + 1 && s.confirmed === false,
    ),
  );
  check(
    "文本：scene 是有实质内容的描述",
    (textRes.shots ?? []).every((s) => s.scene.length >= 4),
  );
  check("文本：进度有上报且终点为 100", textProgress.at(-1) === 100);
  console.log(`      首个镜头：${textRes.shots?.[0]?.scene.slice(0, 60) ?? ""}…`);

  /* ② 图片 → 下载落盘 */
  const imgRes = await arkImageProvider.generate(
    {
      ...base,
      nodeKind: "image",
      prompt: "一只橘猫坐在窗台上晒太阳，扁平插画风格",
      params: { model: "Seedream 5.0 Pro", aspectRatio: "16:9", count: 1 },
    },
    { runId: "run_ark_image" },
  );
  const imgUrl = imgRes.urls?.[0] ?? "";
  check("图片：返回 1 个地址", imgRes.urls?.length === 1);
  check("图片：地址是本地静态路径（不再是会过期的签名 URL）", imgUrl.startsWith("/uploads/generated/"));
  const imgFile = path.join(process.cwd(), "public", imgUrl.replace(/^\//, ""));
  check("图片：文件真的落到了磁盘", existsSync(imgFile));
  check("图片：文件非空", existsSync(imgFile) && statSync(imgFile).size > 5000);
  check(
    "图片：扩展名与图片类型匹配",
    /\.(jpeg|jpg|png|webp)$/.test(imgUrl),
    imgUrl.split("/").pop(),
  );

  /* ③ 视频：异步任务轮询 + 落盘
     默认**不跑**：Seedance 单次调用较慢且按秒计费。需要验证整条链路时
     设 ARK_TEST_VIDEO=1 显式打开。 */
  if (process.env.ARK_TEST_VIDEO !== "1") {
    console.log("\n跳过视频实调（设 ARK_TEST_VIDEO=1 打开）——逻辑已实现，见 arkVideoProvider");
  } else {
    const vidProgress: number[] = [];
    const vidRes = await arkVideoProvider.generate(
      {
        ...base,
        nodeKind: "video",
        prompt: "一只橘猫在草地上奔跑，阳光明媚",
        params: {
          model: "Seedance 1.0 Pro Fast",
          aspectRatio: "16:9",
          resolution: "480P",
          duration: 5,
        },
      },
      { runId: "run_ark_video", onProgress: (p) => vidProgress.push(p) },
    );
    const vidUrl = vidRes.urls?.[0] ?? "";
    const vidFile = path.join(process.cwd(), "public", vidUrl.replace(/^\//, ""));
    check("视频：返回 1 个地址", vidRes.urls?.length === 1);
    check("视频：地址是本地静态路径", vidUrl.startsWith("/uploads/generated/"));
    check("视频：文件落盘且是 mp4", vidUrl.endsWith(".mp4") && existsSync(vidFile));
    check(
      "视频：文件大小 > 100KB（确实是段视频）",
      existsSync(vidFile) && statSync(vidFile).size > 100_000,
    );
    check(
      "视频：轮询期间上报了递增进度",
      vidProgress.length >= 2 && vidProgress[0] <= vidProgress.at(-1)!,
      vidProgress.join(","),
    );
    check("视频：进度终点为 100", vidProgress.at(-1) === 100);

    /* ④ 中止：必须在轮询中途就能中断 */
    const ac = new AbortController();
    const t0 = Date.now();
    const abortPromise = arkVideoProvider
      .generate(
        {
          ...base,
          nodeKind: "video",
          prompt: "一只猫在跑",
          params: { model: "Seedance 1.0 Pro Fast", resolution: "480P", duration: 5 },
        },
        { runId: "run_ark_abort", signal: ac.signal },
      )
      .then(() => "resolved")
      .catch((e) => (e?.name === "AbortError" ? "aborted" : `other:${e?.message}`));
    setTimeout(() => ac.abort(new DOMException("已取消", "AbortError")), 6_000);
    const abortResult = await abortPromise;
    const elapsed = Date.now() - t0;
    check("中止：生成被 AbortError 打断", abortResult === "aborted", String(abortResult));
    check("中止：是中途停的，没等视频跑完", elapsed < 60_000, `${Math.round(elapsed / 1000)}s`);
  }

  /* ⑤ 错误信息可读：拿错 Key 调一次。
     注意别写成 `ark-<uuid>-<hex>` 那种真 Key 形状——GitHub 的 push protection
     会把这种字符串当成泄露的 VolcEngine Ark Key 直接拦下推送。用拼接写法避开。 */
  const goodKey = process.env.ARK_API_KEY;
  process.env.ARK_API_KEY = ["definitely", "not", "a", "usable", "credential"].join("-");
  let badMsg = "";
  try {
    await arkTextProvider.generate(
      { ...base, nodeKind: "text", prompt: "hi" },
      { runId: "run_ark_bad" },
    );
  } catch (e) {
    badMsg = e instanceof Error ? e.message : String(e);
  }
  process.env.ARK_API_KEY = goodKey;
  check(
    "错误：鉴权失败给出中文可读提示",
    /ARK 鉴权失败/.test(badMsg),
    badMsg.slice(0, 80),
  );

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
