import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runQueue } from "@/server/queue/runQueue";

/* ------------------------------------------------------------------ */
/* GET /api/runs/:id —— 查询单条 NodeRun 的当前状态/产物                  */
/* T2.3：作为 SSE 之外的“拉取兜底”（刷新页面、错过事件时可直接读这一份）。 */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string }> };

function parseOrUndefined(s: string | null) {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const run = await prisma.nodeRun.findUnique({ where: { id } });
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }

  return NextResponse.json({
    run: {
      id: run.id,
      nodeId: run.nodeId,
      workflowId: run.workflowId,
      status: run.status,
      progress: run.progress,
      cost: run.cost,
      error: run.error,
      output: parseOrUndefined(run.output),
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      createdAt: run.createdAt,
    },
  });
}

/* ------------------------------------------------------------------ */
/* POST /api/runs/:id/cancel —— 取消一个排队中/执行中的任务                */
/* 已终态的任务返回 409（前端拿它区分“取消成功”和“早就跑完了”）。          */
/* ------------------------------------------------------------------ */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const run = await prisma.nodeRun.findUnique({
    where: { id },
    select: { id: true, userId: true, status: true },
  });
  if (!run || run.userId !== session.user.id) {
    return NextResponse.json({ error: "运行记录不存在" }, { status: 404 });
  }

  if (run.status !== "queued" && run.status !== "running") {
    return NextResponse.json(
      { ok: false, status: run.status, error: "任务已经结束，无法取消" },
      { status: 409 },
    );
  }

  const canceled = await runQueue.cancel(id);
  return NextResponse.json({ ok: canceled, status: canceled ? "canceled" : run.status });
}
