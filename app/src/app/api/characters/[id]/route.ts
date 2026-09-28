import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* PATCH/DELETE /api/characters/:id —— 角色编辑 / 删除                  */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(2000).nullable().optional(),
  imageUrl: z.string().max(2048).nullable().optional(),
});

async function loadOwned(id: string, userId: string) {
  const row = await prisma.character.findUnique({ where: { id } });
  if (!row || row.userId !== userId) return null;
  return row;
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!(await loadOwned(id, session.user.id))) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const character = await prisma.character.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
      ...(parsed.data.imageUrl !== undefined
        ? { imageUrl: parsed.data.imageUrl }
        : {}),
    },
  });
  return NextResponse.json({ character });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  if (!(await loadOwned(id, session.user.id))) {
    return NextResponse.json({ error: "角色不存在" }, { status: 404 });
  }
  await prisma.character.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
