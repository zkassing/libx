/**
 * 故事板（分镜）自测（成片流水线 P1–P5）。
 * 覆盖：
 *   buildMockShots / extractTopic / shotsToText（P1 纯函数）
 *   collectStoryboard / totalShots / confirmedShots（P2 聚合）
 *   buildImageNodes（P3）/ buildVideoNodes（P4）/ FinalFilm 片段组装（P5）
 *   mock provider：text/script 产出 shots；video 产出可播放 MP4（端到端）
 * 运行：pnpm tsx scripts/check-storyboard.ts
 */
import type { Node } from "@xyflow/react";
import {
  buildMockShots,
  extractTopic,
  shotsToText,
} from "../src/server/skills/shotBuilder";
import {
  collectStoryboard,
  totalShots,
  confirmedShots,
} from "../src/lib/storyboard";
import { getProvider } from "../src/server/providers/registry";
import {
  buildImageNodes,
  buildVideoNodes,
} from "../src/server/skills/shotPipeline";
import { mockClipDuration } from "../src/server/providers/mockClips";
import type { FlowNodeData, Shot } from "../src/types";
import { NODE_SIZE } from "../src/types";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

/* ---- P1 buildMockShots ---- */
const shots = buildMockShots("云端未来城市", 5);
check("默认 5 镜头", shots.length === 5, String(shots.length));
check("镜头号 1..5", shots.map((s) => s.index).join(",") === "1,2,3,4,5");
check("镜头 id 唯一", new Set(shots.map((s) => s.id)).size === 5);
check("id 形如 shot-n", shots[0].id === "shot-1");
check("景别循环", shots.map((s) => s.framing).join(",") === "远景,全景,中景,近景,特写");
check("运镜非空", shots.every((s) => s.camera.length > 0));
check("默认未确认", shots.every((s) => s.confirmed === false));
check("画面描述非空", shots.every((s) => s.scene.length > 0));
check("时长为正", shots.every((s) => s.duration > 0));

// 数量边界
check("数量下限 2", buildMockShots("x", 1).length === 2);
check("数量上限 8", buildMockShots("x", 20).length === 8);

/* ---- extractTopic ---- */
check("主题提取首行", extractTopic("云端城市") === "云端城市");
check("去创作灵感前缀", extractTopic("创作灵感：黄昏") === "黄昏");
check("超长截断", extractTopic("x".repeat(40)).endsWith("…"));

/* ---- shotsToText ---- */
const text = shotsToText(shots);
check("文本含镜头号", text.includes("镜头 1"));
check("文本含画面", text.includes("画面："));
check("有台词镜头含台词", text.includes("台词："));

/* ---- P2 collectStoryboard ---- */
function mkNode(id: string, kind: FlowNodeData["kind"], outShots?: Shot[]): Node<FlowNodeData> {
  return {
    id, type: kind, position: { x: 0, y: 0 },
    data: {
      kind, title: `${kind}节点`, prompt: "p", params: {},
      status: "idle", progress: 0,
      output: outShots ? { kind, shots: outShots } : undefined,
    },
  };
}

const canvas: Node<FlowNodeData>[] = [
  mkNode("a", "script", shots),
  mkNode("b", "text", shots.slice(0, 2)),
  mkNode("c", "image"), // 无分镜
  // group 忽略
  { id: "g", type: "group", position: { x: 0, y: 0 }, data: { kind: "text", title: "g", prompt: "", params: {}, status: "idle", progress: 0 } } as Node<FlowNodeData>,
];
const entries = collectStoryboard(canvas);
check("聚合 2 个来源（忽略无分镜/group）", entries.length === 2, String(entries.length));
check("来源带节点 id/标题", entries[0].nodeId === "a" && entries[0].nodeTitle === "script节点");
check("总镜头数=7", totalShots(entries) === 7, String(totalShots(entries)));
check("未确认数=0", confirmedShots(entries) === 0);

const confirmed = shots.map((s) => ({ ...s, confirmed: true }));
const entries2 = collectStoryboard([mkNode("a", "script", confirmed)]);
check("确认计数", confirmedShots(entries2) === 5, String(confirmedShots(entries2)));

/* ---- P3 buildImageNodes ---- */
function mkPipelineNode(id: string, kind: FlowNodeData["kind"], outShots?: Shot[], pos = { x: 0, y: 0 }): Node<FlowNodeData> {
  return {
    id, type: kind, position: pos,
    measured: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    style: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    data: {
      kind, title: `${kind}节点`, prompt: "p", params: {},
      status: "idle", progress: 0,
      output: outShots ? { kind, shots: outShots } : undefined,
    },
  };
}

const p3Shots = buildMockShots("测试主题", 4).map((s) => ({ ...s, confirmed: true }));
let src = mkPipelineNode("src", "script", p3Shots);
const p3 = buildImageNodes([src], "src");
check("P3 为 4 个已确认镜头各建 1 图节点", p3.nodes.length === 4, String(p3.nodes.length));
check("P3 建 4 条 source→image 边", p3.edges.length === 4);
check("P3 图节点类型正确", p3.nodes.every((n) => n.data.kind === "image"));
check("P3 回写 imageNodeId", p3.shots.every((s) => !!s.imageNodeId));
check("P3 imageNodeId 指向新节点", p3.shots.every((s, i) => s.imageNodeId === p3.nodes[i].id));
check("P3 边引用一致", p3.edges.every((e, i) => e.source === "src" && e.target === p3.nodes[i].id));
check("P3 节点在来源右侧", p3.nodes.every((n) => n.position.x > src.position.x + NODE_SIZE.script.w));
check("P3 纵向错开不重叠", p3.nodes[1].position.y - p3.nodes[0].position.y >= NODE_SIZE.image.h);
check("P3 提示词带镜头号", p3.nodes[0].data.prompt.includes("镜头1"));

// 未确认镜头不建节点
const mixed = buildMockShots("x", 3);
const srcMixed = mkPipelineNode("m", "script", mixed);
check("P3 未确认不建图", buildImageNodes([srcMixed], "m").nodes.length === 0);

// 已有 imageNodeId 的镜头跳过（幂等）
src = mkPipelineNode("src", "script", p3.shots);
check("P3 幂等：重跑不重复建", buildImageNodes([src], "src").nodes.length === 0);

// 不存在的来源
check("P3 来源缺失返回空", buildImageNodes([src], "nope").nodes.length === 0);

/* ---- P4 buildVideoNodes ---- */
// 把 P3 的图节点放进画布，更新 source 的 shots
let afterP3: Node<FlowNodeData>[] = [
  mkPipelineNode("src", "script", p3.shots),
  ...p3.nodes,
];
const p4 = buildVideoNodes(afterP3, "src");
check("P4 为 4 个图节点各建 1 视频", p4.nodes.length === 4, String(p4.nodes.length));
check("P4 建 4 条 image→video 边", p4.edges.length === 4);
check("P4 视频节点 mode=图生视频", p4.nodes.every((n) => n.data.params.mode === "图生视频"));
check("P4 视频时长=镜头时长", p4.nodes.every((n, i) => n.data.params.duration === p3.shots[i].duration));
check("P4 回写 videoNodeId", p4.shots.every((s) => !!s.videoNodeId));
check("P4 边从分镜图出发", p4.edges.every((e, i) => e.source === p3.nodes[i].id && e.target === p4.nodes[i].id));
check("P4 视频在图节点右侧", p4.nodes.every((n) => n.position.x > p3.nodes[0].position.x + NODE_SIZE.image.w));
check("P4 纵向对齐图节点", p4.nodes.every((n, i) => n.position.y === p3.nodes[i].position.y));
afterP3 = [
  mkPipelineNode("src", "script", p4.shots),
  ...p3.nodes,
  ...p4.nodes,
];
check("P4 幂等：重跑不重复建", buildVideoNodes(afterP3, "src").nodes.length === 0);

// 没有图节点的镜头不建视频
const noImg = buildMockShots("x", 2).map((s) => ({ ...s, confirmed: true }));
const srcNoImg = mkPipelineNode("n2", "script", noImg);
check("P4 无图不建视频", buildVideoNodes([srcNoImg], "n2").nodes.length === 0);

// mock 时长钳制
check("mockClipDuration 钳制 1..6", mockClipDuration(0) === 1 && mockClipDuration(99) === 6 && mockClipDuration(3) === 3);

/* ---- 端到端：provider 产出 shots ---- */
async function main2() {
  async function providerShots(kind: "text" | "script") {
    const provider = getProvider(kind);
    const result = await provider.generate(
      { nodeId: "n1", nodeKind: kind, prompt: "测试主题", title: "t", params: {}, upstreams: [] },
      { runId: "r1", onProgress: () => {} },
    );
    return result;
  }
  const rt = await providerShots("text");
  check("text 产物含 shots", Array.isArray(rt.shots) && rt.shots!.length === 5, String(rt.shots?.length));
  check("text 文本含分镜块", rt.text?.includes("分镜") ?? false);
  const rs = await providerShots("script");
  check("script 产物含 shots", Array.isArray(rs.shots) && rs.shots!.length === 5);

  /* ---- P5：video provider 产出真实可播放 MP4 ---- */
  const vp = getProvider("video");
  const vr = await vp.generate(
    { nodeId: "v1", nodeKind: "video", prompt: "镜头1", title: "t", params: { mode: "图生视频", duration: 2 }, upstreams: [] },
    { runId: "r2", onProgress: () => {} },
  );
  const vurl = vr.urls?.[0] ?? "";
  check("P5 video 产物是 /mock-clips/*.mp4", /^\/mock-clips\/[a-f0-9]+\.mp4$/.test(vurl), vurl);

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main2().catch((e) => {
  console.error(e);
  process.exit(1);
});
