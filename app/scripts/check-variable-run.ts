/**
 * 运行时变量渲染集成自测（T3.5 第三步）。
 * 直接驱动队列（与 check-queue 同口径），验证：
 *   ① 老师默认值渲染进 prompt（NodeRun.input / output）
 *   ② 提交值覆盖默认值
 *   ③ 引用变量但无值 → worker failed
 *   ④ 变量值变化 → inputHash 变化，不串用旧缓存
 *   ⑤ 画布节点保留原始 {{key}} 模板，不被渲染值污染
 * 运行：pnpm tsx scripts/check-variable-run.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { runQueue } from "../src/server/queue/runQueue";
import { runEventBus } from "../src/server/queue/eventBus";
import { resolveNodeVariables } from "../src/server/queue/resolveRunInput";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

async function waitRun(runId: string, timeoutMs = 20000) {
  const start = Date.now();
  for (;;) {
    const r = await prisma.nodeRun.findUnique({ where: { id: runId } });
    if (r && (r.status === "succeeded" || r.status === "failed")) return r;
    if (Date.now() - start > timeoutMs) throw new Error("等待终态超时: " + runId);
    await new Promise((r) => setTimeout(r, 100));
  }
}

function enqueue(nodeId: string, workflowId: string, userId: string) {
  return new Promise<string>((resolve) => {
    (async () => {
      // 模拟 run route：入队时先解析变量（生效值含老师默认）写入快照
      const nodeRow = await prisma.canvasNode.findUnique({ where: { id: nodeId } });
      const nodeData = JSON.parse(nodeRow!.data as string);
      const vres = await resolveNodeVariables(workflowId, nodeData, submittedNow);
      const r = await prisma.nodeRun.create({
        data: {
          nodeId, workflowId, userId, status: "queued", progress: 0,
          input: JSON.stringify({
            prompt: nodeData.prompt,
            renderedPrompt: vres.prompt,
            variables: vres.values,
          }),
        },
      });
      runEventBus.emit({ type: "queued", runId: r.id, nodeId, workflowId, at: Date.now() });
      runQueue.enqueue(r.id);
      resolve(r.id);
    })();
  });
}

// 由每个用例设置（模拟本次运行提交的变量，写入 NodeRun.input）
let submittedNow: Record<string, string> = {};

async function main() {
  const email = `varrun_${Date.now()}@t.edu`;
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } });
  const wf = await prisma.workflow.create({ data: { userId: user.id, title: "变量渲染" } });

  const NID = `vr_text_${Date.now().toString(36)}`;
  const TEMPLATE = "请以{{style}}风格画{{subject}}";
  await prisma.canvasNode.create({
    data: {
      id: NID, workflowId: wf.id, type: "text", x: 0, y: 0,
      data: JSON.stringify({
        kind: "text", title: "文本节点", prompt: TEMPLATE,
        params: { model: "GVLM 3.1" }, status: "idle", progress: 0,
      }),
    },
  });

  // style 老师默认值；subject 学生必填、无默认
  await prisma.variable.createMany({
    data: [
      { workflowId: wf.id, key: "style", label: "风格", type: "text", default: "电影感", source: "teacher" },
      { workflowId: wf.id, key: "subject", label: "主体", type: "text", default: null, source: "student", required: true },
    ],
  });

  try {
    /* ① 缺 subject → failed */
    submittedNow = {}; // 不提交任何变量
    const r1id = await enqueue(NID, wf.id, user.id);
    const r1 = await waitRun(r1id);
    check("缺必填变量 → failed", r1.status === "failed", r1.status);
    check("错误信息点名缺失变量", (r1.error ?? "").includes("subject"), r1.error ?? "");

    /* ② 提交 subject（style 走默认）→ 成功，prompt 渲染 */
    submittedNow = { subject: "一只猫" };
    const r2id = await enqueue(NID, wf.id, user.id);
    const r2 = await waitRun(r2id);
    check("补全后 → succeeded", r2.status === "succeeded", r2.status);
    const snap2 = JSON.parse(r2.input ?? "{}") as {
      renderedPrompt?: string; variables?: Record<string, string>;
    };
    check("渲染后 prompt 正确", snap2.renderedPrompt === "请以电影感风格画一只猫", snap2.renderedPrompt ?? "");
    check("快照含生效变量 style", snap2.variables?.style === "电影感");
    check("快照含提交变量 subject", snap2.variables?.subject === "一只猫");

    /* ③ 提交值覆盖老师默认 */
    submittedNow = { subject: "一只狗", style: "水彩" };
    const r3id = await enqueue(NID, wf.id, user.id);
    const r3 = await waitRun(r3id);
    const snap3 = JSON.parse(r3.input ?? "{}") as { renderedPrompt?: string };
    check("提交 style 覆盖默认", snap3.renderedPrompt === "请以水彩风格画一只狗", snap3.renderedPrompt ?? "");

    /* ④ 变量值不同 → hash 不同，未命中缓存、真实生成（cost>0） */
    check("不同变量值 hash 不同", r2.inputHash !== r3.inputHash, `${r2.inputHash} vs ${r3.inputHash}`);
    check("新变量值真实计费（非缓存）", r3.cost > 0, String(r3.cost));

    /* 同值再跑 → 命中缓存 cost=0 */
    const r4id = await enqueue(NID, wf.id, user.id);
    const r4 = await waitRun(r4id);
    check("相同变量值再跑 → succeeded", r4.status === "succeeded");
    check("相同值命中缓存 cost=0", r4.cost === 0, String(r4.cost));

    /* ⑤ 画布节点保留原始模板 */
    const nodeRow = await prisma.canvasNode.findUnique({ where: { id: NID } });
    const nodeData = JSON.parse(nodeRow!.data as string) as { prompt: string };
    check("画布节点保留 {{key}} 模板", nodeData.prompt === TEMPLATE, nodeData.prompt);
  } finally {
    await prisma.nodeRun.deleteMany({ where: { workflowId: wf.id } });
    await prisma.variable.deleteMany({ where: { workflowId: wf.id } });
    await prisma.canvasNode.deleteMany({ where: { workflowId: wf.id } });
    await prisma.workflow.deleteMany({ where: { id: wf.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
