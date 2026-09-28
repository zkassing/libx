import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* GET/POST /api/characters —— 角色库（LibTV「角色库」）                  */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(2000).optional(),
  imageUrl: z.string().max(2048).optional(),
});

/** GET：当前用户的角色列表（按最近更新排序） */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const characters = await prisma.character.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({ characters });
}

/** POST：新建角色 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const character = await prisma.character.create({
    data: { userId: session.user.id, ...parsed.data },
  });
  return NextResponse.json({ character }, { status: 201 });
}
