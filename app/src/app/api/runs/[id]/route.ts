import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

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

