/**
 * SSE 运行事件流（T2.4）自测。
 * 直接消费 createRunEventStream（与 route 同一核心），自建临时数据，跑完即清理。
 * 运行：pnpm tsx scripts/check-sse.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { createRunEventStream } from "../src/server/queue/runEventStream";
import { runQueue } from "../src/server/queue/runQueue";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const TERMINAL = new Set(["succeeded", "failed"]);

/** 打开流并收集 data 帧，直到收到终态或超时 */
async function collectFrames(runId: string, timeoutMs = 12000) {
  const stream = createRunEventStream(runId);
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const frames: Array<Record<string, unknown>> = [];
  let gotHeartbeat = false;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const chunk = await reader.read();
    if (chunk.done) break;
    const text = decoder.decode(chunk.value, { stream: true });
    for (const line of text.split("\n")) {
      const t = line.trim();
      if (t.startsWith(":") && t.includes("ping")) gotHeartbeat = true;
      if (t.startsWith("data:")) {
        try {
          frames.push(JSON.parse(t.slice(5).trim()));
        } catch {
          // 忽略解析失败
        }
      }
    }
    const last = frames[frames.length - 1];
    if (last && TERMINAL.has(String(last.type))) break;
  }
  try {
    await reader.cancel();
  } catch {
    // ignore
  }
  return { frames, gotHeartbeat };
}

const textNodeData = JSON.stringify({
  kind: "text", title: "文本节点", prompt: "", params: {}, status: "idle", progress: 0,
});

async function setup(tag: string) {
  const user = await prisma.user.create({
    data: { email: `sse_${tag}_${Date.now()}@t.edu`, passwordHash: "x" },
  });
  const wf = await prisma.workflow.create({ data: { userId: user.id } });
  await prisma.canvasNode.create({
    data: { id: `sse_node_${tag}`, workflowId: wf.id, type: "text", x: 0, y: 0, data: textNodeData },
  });
  return { user, wf };
}

async function main() {
  // —— 场景 A：连接已终态（succeeded）的任务，立即收终态并关闭 ——
  const a = await setup("a");
  const aRun = await prisma.nodeRun.create({
    data: {
      nodeId: `sse_node_a`, workflowId: a.wf.id, userId: a.user.id,
      status: "succeeded", progress: 100,
      output: JSON.stringify({ kind: "text", text: "done" }),
      startedAt: new Date(), finishedAt: new Date(),
    },
  });
  const A = await collectFrames(aRun.id, 3000);
  check("A 至少一帧", A.frames.length >= 1);
  check("A 首帧=快照", A.frames[0]?.snapshot === true);
  check("A 收到 succeeded", A.frames.some((f) => f.type === "succeeded"));
  check("A 快照带产物", (A.frames[0]?.output as { text?: string })?.text === "done");
  check("A 终态后流关闭（无多余帧）", A.frames.length === 1, `${A.frames.length} 帧`);

  // —— 场景 B：连接运行中的任务，收快照 → 实时 progress → succeeded ——
  const b = await setup("b");
  const bRun = await prisma.nodeRun.create({
    data: { nodeId: `sse_node_b`, workflowId: b.wf.id, userId: b.user.id, status: "queued", cost: 2 },
  });

  // 先打开流（此时 queued），再入队让队列执行
  const collectP = collectFrames(bRun.id, 8000);
  // 给流一点时间完成订阅+快照
  await new Promise((r) => setTimeout(r, 150));
  runQueue.enqueue(bRun.id);

  const B = await collectP;
  const types = B.frames.map((f) => String(f.type));
  check("B 收到快照帧", B.frames[0]?.snapshot === true);
  check("B 首帧为 queued/running 快照", ["queued", "running"].includes(String(B.frames[0]?.type)), String(B.frames[0]?.type));
  check("B 实时收到 started", types.includes("started"));
  check("B 实时收到 progress", types.filter((t) => t === "progress").length >= 2,
    `${types.filter((t) => t === "progress").length} 个 progress`);
  check("B 末帧 succeeded", types[types.length - 1] === "succeeded");
  check("B succeeded 帧带产物", !!B.frames[B.frames.length - 1]?.output);
  // 进度单调
  const progs = B.frames.filter((f) => f.type === "progress").map((f) => Number(f.progress));
  check("B 进度单调递增到≤99", progs.every((v, i) => i === 0 || v >= progs[i - 1]) && Math.max(...progs) <= 99,
    progs.join(","));

  // —— 场景 C：连接不存在的 runId，收 failed 快照并关闭 ——
  const C = await collectFrames("nonexistent_run_id", 3000);
  check("C 收 failed", C.frames.some((f) => f.type === "failed"));
  check("C 带错误原因", typeof C.frames[0]?.error === "string");

  // —— 清理 ——
  for (const s of [a, b]) {
    await prisma.nodeRun.deleteMany({ where: { workflowId: s.wf.id } });
    await prisma.canvasNode.deleteMany({ where: { workflowId: s.wf.id } });
    await prisma.workflow.delete({ where: { id: s.wf.id } });
    await prisma.user.delete({ where: { id: s.user.id } });
  }
  console.log("临时数据已清理");

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
