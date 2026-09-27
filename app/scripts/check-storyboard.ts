/**
 * 故事板（分镜）自测（成片流水线 P1+P2）。
 * 覆盖：
 *   buildMockShots / extractTopic / shotsToText（P1 纯函数）
 *   collectStoryboard / totalShots / confirmedShots（P2 聚合）
 *   mock provider：text/script 产出 output.shots（端到端）
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
import type { FlowNodeData, Shot } from "../src/types";

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

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main2().catch((e) => {
  console.error(e);
  process.exit(1);
});
