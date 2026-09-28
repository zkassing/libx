import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runQueue } from "@/server/queue/runQueue";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/workflows/:id/runs/cancel —— 停止这张画布上所有排队/执行中的任务。
 * 画布上的「停止」按钮用它（比逐个取消省事，也正是用户按下停止时期望的语义）。
 */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { id: true, userId: true },
  });
  if (!wf || wf.userId !== session.user.id) {
    return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  }

  const canceled = await runQueue.cancelByWorkflow(id);
  return NextResponse.json({ ok: true, canceled });
}
