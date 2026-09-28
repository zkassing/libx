/**
 * AutoLink 自测：上游动作契约（LibTV 结构）→ 下游图片/视频消费。
 * 运行：npx tsx scripts/check-autolink.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { applyAutoLink } from "../src/server/providers/autoLink";
import { mockTextProvider } from "../src/server/providers/mock";
import type { GenUpstream } from "../src/server/providers/types";
import type { NodeAction } from "../src/types";

let passed = 0;
let failed = 0;
function assert(cond: unknown, name: string) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.error(`  ✗ ${name}`);
  }
}

const ACTION: NodeAction = {
  action: "text_to_image",
  action_input: "赛博朋克风格的雨夜街道，霓虹灯倒映在积水里，一个撑伞的背影",
  supplementary: { style: "赛博朋克", aspect_ratio: "9:16" },
};

const upstreamWithAction: GenUpstream = {
  nodeId: "text_1",
  title: "文本节点 1",
  kind: "text",
  summary: '{"action":"text_to_image",...}',
  action: ACTION,
};

const upstreamNoAction: GenUpstream = {
  nodeId: "img_1",
  title: "图片节点 1",
  kind: "image",
  summary: "https://example.com/a.png",
  urls: ["https://example.com/a.png"],
};

console.log("== applyAutoLink 规则 ==");

// 1) 图片节点 + 空提示词 + 上游契约 → 接管提示词与比例
{
  const r = applyAutoLink("image", "", { aspectRatio: "16:9", count: 1 }, [upstreamWithAction]);
  assert(r.linked, "空提示词：linked=true");
  assert(r.prompt === ACTION.action_input, "空提示词：prompt 被 action_input 接管");
  assert(r.params?.aspectRatio === "9:16", "空提示词：supplementary.aspect_ratio 注入比例");
  assert(r.params?.count === 1, "空提示词：其他参数保留");
}

// 2) 图片节点 + 用户已写提示词 → 用户优先，契约只作参考，参数不动
{
  const r = applyAutoLink("image", "加一只黑猫在前景", { aspectRatio: "1:1" }, [upstreamWithAction]);
  assert(r.linked, "有提示词：linked=true");
  assert(r.prompt.startsWith("加一只黑猫在前景"), "有提示词：用户提示词在前");
  assert(r.prompt.includes(ACTION.action_input), "有提示词：action_input 追加为参考");
  assert(r.params?.aspectRatio === "1:1", "有提示词：比例不被覆盖");
}

// 3) 视频节点同样消费
{
  const r = applyAutoLink("video", " ", { aspectRatio: "16:9" }, [upstreamWithAction]);
  assert(r.linked && r.prompt === ACTION.action_input, "视频节点：纯空格视为空提示词并被接管");
}

// 4) 文本节点不消费契约（原链路走摘要上下文）
{
  const r = applyAutoLink("text", "", {}, [upstreamWithAction]);
  assert(!r.linked && r.prompt === "", "文本节点：不注入");
}

// 5) 上游没有契约 → 原样返回
{
  const r = applyAutoLink("image", "", { aspectRatio: "16:9" }, [upstreamNoAction]);
  assert(!r.linked && r.prompt === "" && r.params?.aspectRatio === "16:9", "无契约：原样返回");
}

// 6) supplementary 缺 aspect_ratio → 只接管提示词
{
  const up: GenUpstream = { ...upstreamWithAction, action: { action: "text_to_image", action_input: "一只柴犬" } };
  const r = applyAutoLink("image", "", { aspectRatio: "4:3" }, [up]);
  assert(r.linked && r.prompt === "一只柴犬" && r.params?.aspectRatio === "4:3", "无比例建议：保留原比例");
}

// 6.5) 两个文本上游 → 两份 action_input 融合，不是只取第一个
{
  const ACTION2: NodeAction = {
    action: "text_to_image",
    action_input: "穿红色机甲的少女，站在高楼天台边缘",
    supplementary: { style: "科幻", aspect_ratio: "16:9" },
  };
  const up2: GenUpstream = { ...upstreamWithAction, nodeId: "text_2", title: "文本节点 2", action: ACTION2 };

  // 空提示词：融合两份契约
  const r1 = applyAutoLink("image", "", {}, [upstreamWithAction, up2]);
  assert(r1.linked, "双上游空提示词：linked=true");
  assert(r1.prompt.includes(ACTION.action_input), "双上游空提示词：含第一份契约");
  assert(r1.prompt.includes(ACTION2.action_input), "双上游空提示词：含第二份契约（融合）");
  assert(r1.prompt.includes("融合"), "双上游空提示词：带融合指令");
  assert(r1.params?.aspectRatio === "9:16", "双上游空提示词：取第一个比例建议");

  // 有提示词：两份契约都作参考
  const r2 = applyAutoLink("image", "俯视角", {}, [upstreamWithAction, up2]);
  assert(r2.prompt.startsWith("俯视角"), "双上游有提示词：用户提示词在前");
  assert(r2.prompt.includes(ACTION.action_input) && r2.prompt.includes(ACTION2.action_input), "双上游有提示词：两份契约都参考");

  // 单上游：不包融合层，保持干净接管（回归）
  const r3 = applyAutoLink("image", "", {}, [upstreamWithAction]);
  assert(r3.prompt === ACTION.action_input, "单上游：不包融合层");
}

async function main() {
  console.log("\n== mock 文本 provider 产出契约 ==");

  // 7) mock 文本节点产出 LibTV 结构 {action, action_input, supplementary}
  {
    const result = await mockTextProvider.generate(
      { nodeId: "text_x", nodeKind: "text", prompt: "雨夜街道", title: "文本节点", params: { model: "m" } },
      { runId: "run_x" },
    );
    assert(result.action?.action === "text_to_image", "mock text：action=text_to_image");
    assert(result.action?.action_input === "雨夜街道", "mock text：action_input 是干净提示词");
    assert(typeof result.action?.supplementary?.aspect_ratio === "string", "mock text：supplementary 带比例");
    assert(Array.isArray(result.shots) && result.shots.length > 0, "mock text：仍产出分镜 shots");
  }

  // 8) mock 脚本节点 action 不同
  {
    const result = await mockTextProvider.generate(
      { nodeId: "script_x", nodeKind: "script", prompt: "武侠短片", title: "脚本节点", params: {} },
      { runId: "run_y" },
    );
    assert(result.action?.action === "generate_storyboard", "mock script：action=generate_storyboard");
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

void main();
