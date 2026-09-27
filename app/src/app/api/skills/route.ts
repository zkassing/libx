import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSkillCard } from "@/server/skills/skillMapper";
import { validatePublishSkill } from "@/server/skills/validatePublish";

/* ------------------------------------------------------------------ */
/* GET /api/skills —— Skill 市场列表                                     */
/*   query:                                                            */
/*     category=film|ad|...   按分类过滤                                 */
/*     q=关键词               名称/简介模糊搜索                          */
/*     source=all|favorite|mine                                          */
/*       favorite 仅我收藏（需登录）；mine 仅我发布（需登录）              */
/* ------------------------------------------------------------------ */

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { errors, input } = validatePublishSkill(body);
  if (!input) {
    return NextResponse.json(
      { error: "字段校验失败", fields: errors },
      { status: 400 },
    );
  }

  // 生成唯一 slug：u + 时间戳 base36 + 随机；冲突重试几次
  const makeSlug = () =>
    `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

  let slug = makeSlug();
  for (let i = 0; i < 5; i++) {
    const clash = await prisma.skill.findUnique({ where: { slug } });
    if (!clash) break;
    slug = makeSlug();
  }

  const row = await prisma.skill.create({
    data: {
      slug,
      name: input.name,
      category: input.category,
      outputKind: input.outputKind,
      summary: input.summary || null,
      scenes: input.scenes || null,
      howTo: input.howTo || null,
      outputs: input.outputs || null,
      template: JSON.stringify(input.template),
      authorId: session.user.id,
      official: false,
      usageCount: 0,
    },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(
    { skill: toSkillCard(row, false) },
    { status: 201 },
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get("category");
  const q = url.searchParams.get("q")?.trim();
  const source = url.searchParams.get("source") ?? "all";

  // favorite / mine 需要登录
  const session = await auth();
  if ((source === "favorite" || source === "mine") && !session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const where: Prisma.SkillWhereInput = {};

  if (category && category !== "all") where.category = category;

  if (q) {
    where.OR = [
      { name: { contains: q } },
      { summary: { contains: q } },
    ];
  }

  if (source === "mine") {
    where.authorId = session!.user!.id;
    where.official = false;
  }

  if (source === "favorite") {
    where.favoritedBy = { some: { userId: session!.user!.id } };
  }

  const rows = await prisma.skill.findMany({
    where,
    orderBy: [{ official: "desc" }, { usageCount: "desc" }, { createdAt: "desc" }],
    include: { author: { select: { name: true } } },
  });

  // 登录用户：附带每条是否已收藏
  let favoriteIds = new Set<string>();
  if (session?.user?.id && rows.length > 0) {
    const favs = await prisma.skillFavorite.findMany({
      where: {
        userId: session.user.id,
        skillId: { in: rows.map((r) => r.id) },
      },
      select: { skillId: true },
    });
    favoriteIds = new Set(favs.map((f) => f.skillId));
  }

  const cards = rows.map((r) =>
    toSkillCard(r, favoriteIds.has(r.id)),
  );

  return NextResponse.json({ skills: cards });
}
