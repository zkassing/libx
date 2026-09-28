/**
 * 步骤 9 自测：上游产物隐式传递。
 * 运行：npx tsx scripts/check-upstream.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import {
  describeOutput,
  directUpstreams,
  pendingUpstreams,
  upstreamContexts,
} from "../src/lib/upstream";
import type { FlowNodeData } from "../src/types";
import type { Edge, Node } from "@xyflow/react";

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

function makeNode(
  id: string,
  overrides: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type: "text",
    position: { x: 0, y: 0 },
    data: {
      kind: "text",
      title: id,
      prompt: "",
      params: {},
      status: "idle",
      progress: 0,
      ...overrides,
    },
  };
}
const edge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

console.log("1) 直接上游查询（不含隔代）");
{
  const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
  const edges = [edge("a", "b"), edge("b", "c")];
  assert(
    directUpstreams(edges, nodes, "c").map((n) => n.id).join() === "b",
    "c 的直接上游只有 b（隔代的 a 不列出）",
  );
  assert(
    directUpstreams(edges, nodes, "a").length === 0,
    "a 没有上游",
  );
  assert(
    directUpstreams(edges, nodes, "b").map((n) => n.id).join() === "a",
    "b 的直接上游是 a",
  );
}

console.log("2) 多个直接上游（汇入）");
{
  const nodes = [makeNode("a"), makeNode("b"), makeNode("c")];
  const edges = [edge("a", "c"), edge("b", "c")];
  const up = directUpstreams(edges, nodes, "c").map((n) => n.id).sort();
  assert(up.join() === "a,b", "c 有两个直接上游 a 和 b");
}

console.log("3) 只有 succeeded + output 才算就绪");
{
  const nodes = [
    makeNode("a", {
      status: "succeeded",
      output: { kind: "text", text: "hello" },
    }),
    makeNode("b", { status: "running", progress: 40 }),
    makeNode("c", { status: "succeeded" }), // 没 output
    makeNode("d"),
  ];
  const edges = [edge("a", "x"), edge("b", "x"), edge("c", "x"), edge("d", "x")];
  nodes.push(makeNode("x"));
  const ctx = upstreamContexts(edges, nodes, "x");
  assert(ctx.length === 1 && ctx[0].nodeId === "a", "只有 a 的产物进入上下文");
  const pending = pendingUpstreams(edges, nodes, "x");
  assert(
    pending.join() === "b,c,d",
    "b(运行中)/c(无产物)/d(未运行) 都是 pending",
  );
}

console.log("4) 无上游的孤立节点：不拦截");
{
  const nodes = [makeNode("solo")];
  assert(
    pendingUpstreams([], nodes, "solo").length === 0,
    "孤立节点没有 pending 上游",
  );
  assert(
    upstreamContexts([], nodes, "solo").length === 0,
    "孤立节点没有上游上下文",
  );
}

console.log("5) describeOutput 摘要");
{
  assert(
    describeOutput({ kind: "text", text: "一段  生成\n 内容" }).includes(
      "一段 生成 内容",
    ),
    "文本产物压成单行",
  );
  assert(
    describeOutput({ kind: "image", urls: ["u1", "u2"] }) ===
      "[image 媒体产物 ×2]",
    "媒体产物给出数量",
  );
}

console.log("6) 媒体类上游的上下文（image→video）");
{
  const nodes = [
    makeNode("img", {
      kind: "image",
      status: "succeeded",
      output: { kind: "image", urls: ["data:img"] },
    }),
    makeNode("vid", { kind: "video" }),
  ];
  const edges = [edge("img", "vid")];
  const ctx = upstreamContexts(edges, nodes, "vid");
  assert(ctx.length === 1 && ctx[0].kind === "image", "视频拿到图片上游");
  assert(
    describeOutput(ctx[0].output) === "[image 媒体产物 ×1]",
    "图片上游被描述为媒体产物",
  );
}

console.log("7) 链式传递：A→B→C，B 先包含 A，再传给 C");
{
  const a = makeNode("a", {
    status: "succeeded",
    output: { kind: "text", text: "A 的原稿" },
  });
  const b = makeNode("b", {
    status: "succeeded",
    output: { kind: "text", text: "B 的扩写（已含 A 的原稿）" },
  });
  const c = makeNode("c");
  const edges = [edge("a", "b"), edge("b", "c")];
  const nodes = [a, b, c];
  const cCtx = upstreamContexts(edges, nodes, "c");
  assert(
    cCtx.length === 1 && cCtx[0].nodeId === "b",
    "C 只直接引用 B",
  );
  assert(
    describeOutput(cCtx[0].output).includes("A 的原稿"),
    "B 的产物已包含 A，信息沿链传递",
  );
}

console.log(
  `\n${failed === 0 ? "全部通过" : "有失败"}：${passed} 通过 / ${failed} 失败`,
);
process.exit(failed === 0 ? 0 : 1);
