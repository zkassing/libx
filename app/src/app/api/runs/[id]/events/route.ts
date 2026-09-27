import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createRunEventStream } from "@/server/queue/runEventStream";

/* ------------------------------------------------------------------ */
/* GET /api/runs/:id/events —— 单任务 SSE 实时事件流（T2.4）             */
/* ------------------------------------------------------------------ */
/* 返回 text/event-stream；连接即推当前快照，随后实时推送进度，终态后关闭。 */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response(JSON.stringify({ error: "未登录" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }
  const { id } = await ctx.params;

  const run = await prisma.nodeRun.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!run || run.userId !== session.user.id) {
    return new Response(JSON.stringify({ error: "运行记录不存在" }), {
      status: 404,
      headers: { "content-type": "application/json" },
    });
  }

  const stream = createRunEventStream(id, req.signal);

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
