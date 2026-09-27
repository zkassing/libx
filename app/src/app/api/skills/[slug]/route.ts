import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSkillDetail } from "@/server/skills/skillMapper";

/* ------------------------------------------------------------------ */
/* GET /api/skills/:slug —— Skill 详情（含模板画布）                     */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { slug } = await ctx.params;

  const row = await prisma.skill.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }

  // 登录用户：标记是否已收藏
  let favorited = false;
  const session = await auth();
  if (session?.user?.id) {
    const fav = await prisma.skillFavorite.findUnique({
      where: { userId_skillId: { userId: session.user.id, skillId: row.id } },
    });
    favorited = !!fav;
  }

  return NextResponse.json({ skill: toSkillDetail(row, favorited) });
}
