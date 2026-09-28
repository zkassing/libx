/**
 * RunQueue（T2.3）自测：进程内队列 + 状态机。
 * 自建临时 user/workflow/node，跑完即清理，不依赖现有画布。
 * 关键点：每个任务都用「轮询等待终态」，不用拍脑袋的固定延时。
 * 运行：pnpm tsx scripts/check-queue.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { PrismaClient } from "../src/generated/prisma/client";
import { runQueue } from "../src/server/queue/runQueue";
import { runEventBus } from "../src/server/queue/eventBus";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const TERMINAL = new Set(["succeeded", "failed"]);

/** 轮询等待某 NodeRun 进入终态，返回最终行 */
async function waitTerminal(runId: string, timeoutMs = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const row = await prisma.nodeRun.findUnique({ where: { id: runId } });
    if (row && TERMINAL.has(row.status)) return row;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`等待 ${runId} 终态超时`);
}

const nodeData = (kind: string) => JSON.stringify({
  kind,
  title: kind === "text" ? "文本节点" : "视频节点",
  prompt: "",
  params: { aspectRatio: "16:9" },
  status: "idle",
  progress: 0,
});

async function main() {
  // —— 准备临时数据 ——
  const email = `queue_test_${Date.now()}@t.edu`;
  const user = await prisma.user.create({ data: { email, name: "队列测试", passwordHash: "x" } });
  const wf = await prisma.workflow.create({ data: { title: "队列测试流", userId: user.id } });

  const makeNode = async (id: string, kind: string) => {
    await prisma.canvasNode.create({
      data: { id, workflowId: wf.id, type: kind, x: 0, y: 0, data: nodeData(kind), index: 0 },
    });
  };
  // CanvasNode.id / CanvasEdge.id 是全局主键（非复合），所以必须每次运行都用
  // 唯一 id —— 否则上一次没跑完的残留会让后续每次运行都撞 P2002 而永远失败。
  const S = Date.now().toString(36);
  const N_TEXT = `q_text_${S}`;
  const N_VIDEO = `q_video_${S}`;

  await makeNode(N_TEXT, "text");
  await makeNode(N_VIDEO, "video");

  // 按 runId 收集事件
  const byRun = new Map<string, string[]>();
  const progressByRun = new Map<string, number[]>();
  const unsub = runEventBus.subscribe((e) => {
    if (e.workflowId !== wf.id) return;
    if (!byRun.has(e.runId)) byRun.set(e.runId, []);
    byRun.get(e.runId)!.push(e.type);
    if (e.type === "progress") {
      if (!progressByRun.has(e.runId)) progressByRun.set(e.runId, []);
      progressByRun.get(e.runId)!.push(e.progress ?? 0);
    }
  });

  /** 创建 NodeRun（带 cost，模拟 run route）并入队 */
  const enqueue = async (nodeId: string, cost: number) => {
    const r = await prisma.nodeRun.create({
      data: { nodeId, workflowId: wf.id, userId: user.id, status: "queued", cost },
    });
    runEventBus.emit({ type: "queued", runId: r.id, nodeId, workflowId: wf.id, at: Date.now() });
    runQueue.enqueue(r.id);
    return r.id;
  };

  // —— 1) 先建连线，但上游文本还没产物 → 视频执行时应 failed ——
  await prisma.canvasEdge.create({
    data: { id: `q_edge_${S}`, workflowId: wf.id, source: N_TEXT, target: N_VIDEO, index: 0 },
  });
  const vRun1 = await enqueue(N_VIDEO, 135);
  const vRow1 = await waitTerminal(vRun1);
  check("上游未就绪 → 执行时 failed", vRow1.status === "failed");
  check("failed 带错误原因", (vRow1.error ?? "").includes("上游节点还没生成产物"));
  check("failed 时 progress 归 0", vRow1.progress === 0);

  // —— 2) 文本入队，应 succeeded ——
  const tRun = await enqueue(N_TEXT, 2);
  const tRow = await waitTerminal(tRun);
  check("文本 succeeded", tRow.status === "succeeded");
  check("文本终态 progress=100", tRow.progress === 100);
  check("文本 NodeRun 有 output", !!tRow.output);
  const tNodeData = JSON.parse((await prisma.canvasNode.findUnique({ where: { id: N_TEXT } }))!.data);
  check("产物写回画布节点", tNodeData.status === "succeeded" && !!tNodeData.output);

  // —— 3) 上游现已就绪，视频再入队应 succeeded（边已在步骤 1 建好）——
  const vRun2 = await enqueue(N_VIDEO, 135);
  const vRow2 = await waitTerminal(vRun2);
  check("上游就绪后视频 succeeded", vRow2.status === "succeeded");
  check("视频终态 progress=100", vRow2.progress === 100);
  check("视频 cost=135", vRow2.cost === 135);
  const vOut = JSON.parse(vRow2.output!);
  check("视频产物是可播放 MP4", /^\/mock-clips\/[a-f0-9]+\.mp4$/.test(vOut.urls[0]), vOut.urls[0]);

  // —— 4) 事件序列 ——
  const tSeq = byRun.get(tRun) ?? [];
  check("文本事件 queued→started→progress*→succeeded",
    tSeq[0] === "queued" && tSeq[1] === "started" && tSeq[tSeq.length - 1] === "succeeded" && tSeq.includes("progress"),
    tSeq.join(">"));
  const v1Seq = byRun.get(vRun1) ?? [];
  check("失败任务 queued→failed（未启动）", v1Seq[0] === "queued" && v1Seq[v1Seq.length - 1] === "failed" && !v1Seq.includes("started"), v1Seq.join(">"));

  const tProg = progressByRun.get(tRun) ?? [];
  check("文本收到中间进度且≤99", tProg.length > 0 && Math.max(...tProg) <= 99);
  check("进度单调递增", tProg.every((v, i) => i === 0 || v >= tProg[i - 1]));

  // —— 5) 队列空闲 ——
  // worker 在 emit succeeded 之后才从 active 删除；轮询等待真正空闲（最多 3s）
  let sz = runQueue.size();
  const idleStart = Date.now();
  while (
    (sz.waiting > 0 || sz.active > 0) &&
    Date.now() - idleStart < 3000
  ) {
    await new Promise((r) => setTimeout(r, 50));
    sz = runQueue.size();
  }
  check("队列执行完后空闲", sz.waiting === 0 && sz.active === 0, JSON.stringify(sz));

  unsub();

  // —— 清理（保证所有 worker 已结束才删，上面都已 waitTerminal）——
  await prisma.nodeRun.deleteMany({ where: { workflowId: wf.id } });
  await prisma.canvasEdge.deleteMany({ where: { workflowId: wf.id } });
  await prisma.canvasNode.deleteMany({ where: { workflowId: wf.id } });
  await prisma.workflow.delete({ where: { id: wf.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("临时数据已清理");

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
