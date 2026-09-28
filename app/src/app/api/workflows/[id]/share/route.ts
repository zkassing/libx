import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uniqueShareToken } from "@/server/workflow/share";

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/workflows/:id/share —— 开启分享（幂等，已开过就返回原 token）
 * DELETE /api/workflows/:id/share —— 关闭分享（清 token，链接立即失效）
 */

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { id: true, userId: true, shareToken: true, sharedAt: true },
  });
  if (!wf || wf.userId !== session.user.id) {
    return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  }

  const token = wf.shareToken ?? (await uniqueShareToken());
  await prisma.workflow.update({
    where: { id },
    data: {
      shareToken: token,
      visibility: "link",
      sharedAt: wf.sharedAt ?? new Date(),
    },
  });

  return NextResponse.json({ token });
}

export async function DELETE(_req: Request, ctx: Ctx) {
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

  await prisma.workflow.update({
    where: { id },
    data: { shareToken: null, visibility: "private", sharedAt: null },
  });

  return NextResponse.json({ ok: true });
}
