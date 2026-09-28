/**
 * 长任务取消 / 超时自测。
 * 覆盖：执行中取消、排队中取消、已终态取消被拒、超时中止、按画布批量取消。
 * 自建临时数据，跑完即清理。
 * 运行：pnpm tsx scripts/check-cancel.ts
 *
 * 注意：RUN_TIMEOUT_MS 必须在 import runQueue **之前**设置（模块加载时读它），
 * 所以这里把 timeout 调小到 3s，用 6.5s 的 video mock 来制造超时，无需真等 5 分钟。
 */
process.env.RUN_TIMEOUT_MS = "3000";

import { PrismaClient } from "../src/generated/prisma/client";
import { runEventBus } from "../src/server/queue/eventBus";
import type { RunEvent } from "../src/server/queue/eventBus";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitStatus(
  runId: string,
  want: string[],
  timeoutMs = 20000,
): Promise<string> {
  const start = Date.now();
  let last = "?";
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.nodeRun.findUnique({ where: { id: runId } });
    last = row?.status ?? "missing";
    if (want.includes(last)) return last;
    await sleep(120);
  }
  return `timeout(${last})`;
}

const nodeData = (kind: string) =>
  JSON.stringify({
    kind,
    title: `${kind} 节点`,
    prompt: `生成 ${kind}`,
    params: { aspectRatio: "16:9" },
    status: "idle",
    progress: 0,
  });

async function main() {
  const { runQueue } = await import("../src/server/queue/runQueue");

  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { email: `cancel_test_${stamp}@t.edu`, name: "取消测试", passwordHash: "x" },
  });
  const wf = await prisma.workflow.create({
    data: { title: "取消测试流", userId: user.id },
  });
  const wf2 = await prisma.workflow.create({
    data: { title: "批量取消流", userId: user.id },
  });

  const mkNode = async (id: string, kind: string, workflowId: string) => {
    await prisma.canvasNode.create({
      data: { id, workflowId, type: kind, x: 0, y: 0, data: nodeData(kind), index: 0 },
    });
  };
  await mkNode("c_video", "video", wf.id);
  await mkNode("c_video2", "video", wf.id);
  await mkNode("c_video3", "video", wf.id);
  await mkNode("c_video4", "video", wf.id);
  await mkNode("c_text", "text", wf.id);
  await mkNode("c_text2", "text", wf.id);
  await mkNode("b_video1", "video", wf2.id);
  await mkNode("b_video2", "video", wf2.id);

  /** 建 NodeRun(queued) 并入队 */
  const enqueue = async (nodeId: string, workflowId: string) => {
    const run = await prisma.nodeRun.create({
      data: { nodeId, workflowId, userId: user.id, status: "queued", progress: 0 },
    });
    runQueue.enqueue(run.id);
    return run.id;
  };

  /* 收集事件 */
  const events: RunEvent[] = [];
  const unsub = runEventBus.subscribe((e) => events.push(e));
  const eventsOf = (runId: string) => events.filter((e) => e.runId === runId).map((e) => e.type);

  /* ---------------- 1. 执行中取消 ---------------- */
  const r1 = await enqueue("c_video", wf.id);
  const r1State = await waitStatus(r1, ["running", "canceled"]);
  check("任务进入 running", r1State === "running", r1State);

  const c1 = await runQueue.cancel(r1);
  check("取消执行中的任务返回 true", c1 === true);
  check("执行中被取消 → 终态 canceled", (await waitStatus(r1, ["canceled"], 8000)) === "canceled");
  check("发出了 canceled 事件", eventsOf(r1).includes("canceled"), eventsOf(r1).join(","));

  const r1row = await prisma.nodeRun.findUnique({ where: { id: r1 } });
  check("取消后 error 写明原因", r1row?.error === "已取消", String(r1row?.error));
  check("取消后 progress 归零", r1row?.progress === 0, String(r1row?.progress));
  check("取消后 finishedAt 有值", !!r1row?.finishedAt);
  check("取消不会写入产物", r1row?.output === null, String(r1row?.output));

  const canvasRow = await prisma.canvasNode.findUnique({ where: { id: "c_video" } });
  const canvasData = JSON.parse(canvasRow!.data) as { status: string; output?: unknown };
  check("画布节点没被写成成功态", canvasData.status === "idle" && !canvasData.output, canvasData.status);

  /* ---------------- 2. 排队中取消 ---------------- */
  // 并发上限 2：测试 1 的任务已取消、槽位空出，所以要塞满 2 个在跑的，
  // 第 3 个才会真的停在等待队列里（只塞 2 个的话两个都会立刻开跑）。
  const q1 = await enqueue("c_video2", wf.id);
  const q2 = await enqueue("c_video3", wf.id);
  const q3 = await enqueue("c_video4", wf.id);
  await sleep(400);
  const q3row = await prisma.nodeRun.findUnique({ where: { id: q3 } });
  check("并发已满时第 3 个任务仍在排队", q3row?.status === "queued", String(q3row?.status));

  const c2 = await runQueue.cancel(q3);
  check("取消排队中的任务返回 true", c2 === true);
  check("排队中被取消 → 终态 canceled", (await waitStatus(q3, ["canceled"], 5000)) === "canceled");
  check("排队取消的事件带上了 nodeId", eventsOf(q3).includes("canceled"));

  await runQueue.cancel(q1);
  await runQueue.cancel(q2);
  await waitStatus(q1, ["canceled", "succeeded", "failed"], 10000);
  await waitStatus(q2, ["canceled", "succeeded", "failed"], 10000);

  /* ---------------- 3. 已终态不能再取消 ---------------- */
  const r3 = await enqueue("c_text", wf.id);
  check("text 任务正常跑完", (await waitStatus(r3, ["succeeded"], 15000)) === "succeeded");
  const c3 = await runQueue.cancel(r3);
  check("取消已完成的任务返回 false", c3 === false);
  const r3row = await prisma.nodeRun.findUnique({ where: { id: r3 } });
  check("已完成状态没被改成 canceled", r3row?.status === "succeeded", String(r3row?.status));
  check("已完成任务的产物仍在", !!r3row?.output);

  /* ---------------- 4. 超时中止 ---------------- */
  // RUN_TIMEOUT_MS=3000，video mock 需要 6.5s → 必然超时
  const r4 = await enqueue("c_video2", wf.id);
  const r4State = await waitStatus(r4, ["failed", "canceled"], 20000);
  check("超时的任务终态是 failed（不是 canceled）", r4State === "failed", r4State);
  const r4row = await prisma.nodeRun.findUnique({ where: { id: r4 } });
  check("超时 error 写明超时", /超时/.test(r4row?.error ?? ""), String(r4row?.error));
  check("超时发出的是 failed 事件", eventsOf(r4).includes("failed"), eventsOf(r4).join(","));

  /* ---------------- 5. 按画布批量取消 ---------------- */
  events.length = 0;
  const b1 = await enqueue("b_video1", wf2.id);
  const b2 = await enqueue("b_video2", wf2.id);
  await sleep(300);
  const canceledCount = await runQueue.cancelByWorkflow(wf2.id);
  check("cancelByWorkflow 返回取消条数（2）", canceledCount === 2, String(canceledCount));
  check("批量取消后两个任务都是 canceled",
    (await waitStatus(b1, ["canceled"], 5000)) === "canceled" &&
      (await waitStatus(b2, ["canceled"], 5000)) === "canceled",
  );
  check("另一张画布的取消不影响本画布已完成的任务",
    (await prisma.nodeRun.findUnique({ where: { id: r3 } }))?.status === "succeeded",
  );

  /* 队列没卡住：还能正常再跑一个（用 text：1.5s，短于 3s 超时） */
  const r5 = await enqueue("c_text2", wf.id);
  const r5State = await waitStatus(r5, ["succeeded", "failed"], 20000);
  check("取消后队列仍可正常工作", r5State === "succeeded", r5State);

  unsub();

  /* ---------------- 清理 ---------------- */
  await prisma.workflow.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("临时数据已清理");

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main();
