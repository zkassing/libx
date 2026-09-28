import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { forkWorkflow } from "@/server/workflow/fork";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/workflows/:id/duplicate —— 把自己的工作流复制一份。
 * 分享链接的「复制到我的项目」走的是 /api/share/:token/fork（别人的 → 我），
 * 这里是自己复制自己的，二者共用 forkWorkflow。
 */
export async function POST(req: Request, ctx: Ctx) {
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

  let title: string | undefined;
  try {
    const body = (await req.json()) as { title?: string };
    title = body?.title;
  } catch {
    // 允许空 body
  }

  const newId = await forkWorkflow({
    sourceId: id,
    targetUserId: session.user.id,
    title,
  });
  if (!newId) {
    return NextResponse.json({ error: "复制失败" }, { status: 500 });
  }

  return NextResponse.json({ workflow: { id: newId } }, { status: 201 });
}
