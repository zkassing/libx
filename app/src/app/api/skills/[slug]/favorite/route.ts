import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/* ------------------------------------------------------------------ */
/* /api/skills/:slug/favorite                                          */
/*   POST   收藏 Skill（幂等：已收藏不报错）                             */
/*   DELETE 取消收藏                                                    */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { slug } = await ctx.params;

  const skill = await prisma.skill.findUnique({ where: { slug } });
  if (!skill) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  // 幂等：已存在直接返回
  await prisma.skillFavorite.upsert({
    where: {
      userId_skillId: { userId: session.user.id, skillId: skill.id },
    },
    create: { userId: session.user.id, skillId: skill.id },
    update: {},
  });

  return NextResponse.json({ ok: true, favorited: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const { slug } = await ctx.params;

  const skill = await prisma.skill.findUnique({ where: { slug } });
  if (!skill) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  await prisma.skillFavorite.deleteMany({
    where: { userId: session.user.id, skillId: skill.id },
  });

  return NextResponse.json({ ok: true, favorited: false });
}
