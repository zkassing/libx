import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* PATCH/DELETE /api/assets/:id */

type Ctx = { params: Promise<{ id: string }> };

/** 归属校验并取出资产 */
async function loadOwned(id: string, userId: string) {
  const asset = await prisma.asset.findUnique({ where: { id } });
  if (!asset || asset.userId !== userId) return null;
  return asset;
}

/**
 * GET：按 id 取单条资产（跨 source，供拖入画布等场景）。
 */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const asset = await loadOwned(id, session.user.id);
  if (!asset) {
    return NextResponse.json({ error: "资产不存在" }, { status: 404 });
  }
  return NextResponse.json({ asset });
}

/**
 * PATCH：修改资产属性 / 收藏。
 *  - { rating }            评分
 *  - { folderId }          项目资产移动到文件夹
 *  - { saveToLibrary }     把“生成历史/项目资产”复制一份到个人资产库
 *  - { title }             重命名
 */
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const asset = await loadOwned(id, session.user.id);
  if (!asset) {
    return NextResponse.json({ error: "资产不存在" }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  // 收藏到个人资产库：复制一条 source=library（幂等：同 url 已在库则复用）
  if (body.saveToLibrary) {
    if (asset.url) {
      const existing = await prisma.asset.findFirst({
        where: { userId: session.user.id, source: "library", url: asset.url },
      });
      if (existing) return NextResponse.json({ ok: true, asset: existing });
    }
    const copy = await prisma.asset.create({
      data: {
        userId: session.user.id,
        source: "library",
        kind: asset.kind,
        title: asset.title,
        url: asset.url,
        text: asset.text,
        mimeType: asset.mimeType,
        size: asset.size,
      },
    });
    return NextResponse.json({ ok: true, asset: copy });
  }

  const data: {
    rating?: number;
    folderId?: string | null;
    title?: string;
  } = {};
  if (typeof body.rating === "number") data.rating = body.rating;
  if (typeof body.folderId === "string" || body.folderId === null) data.folderId = body.folderId;
  if (typeof body.title === "string" && body.title.trim()) data.title = body.title.trim();

  const updated = await prisma.asset.update({ where: { id }, data });
  return NextResponse.json({ ok: true, asset: updated });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const asset = await loadOwned(id, session.user.id);
  if (!asset) {
    return NextResponse.json({ error: "资产不存在" }, { status: 404 });
  }
  await prisma.asset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
