import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* PATCH/DELETE /api/asset-folders/[id] */

type Ctx = { params: Promise<{ id: string }> };

async function loadOwned(id: string, userId: string) {
  const folder = await prisma.assetFolder.findUnique({ where: { id } });
  if (!folder) return null;
  const wf = await prisma.workflow.findFirst({
    where: { id: folder.workflowId, userId },
  });
  if (!wf) return null;
  return folder;
}

/** PATCH：重命名 {name} / 移动 {parentId} */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const folder = await loadOwned(id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    name?: string;
    parentId?: string | null;
  };
  const data: { name?: string; parentId?: string | null } = {};
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim();
  if (typeof body.parentId === "string" || body.parentId === null) data.parentId = body.parentId;

  const updated = await prisma.assetFolder.update({ where: { id }, data });
  return NextResponse.json({ ok: true, folder: updated });
}

/** DELETE：删除文件夹（子文件夹与资产的外键按 schema 处理；资产 onDelete SetNull） */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const folder = await loadOwned(id, session.user.id);
  if (!folder) {
    return NextResponse.json({ error: "文件夹不存在" }, { status: 404 });
  }
  await prisma.assetFolder.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
