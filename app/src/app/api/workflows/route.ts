import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

function isForeignKeyError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2003"
  );
}

/**
 * GET /api/workflows —— 当前用户的工作流列表（卡片下拉用）
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const workflows = await prisma.workflow.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      coverUrl: true,
      updatedAt: true,
      _count: { select: { nodes: true } },
    },
  });
  return NextResponse.json({ workflows });
}

/**
 * POST /api/workflows —— 新建空工作流
 * body?: { title?, nodes?, edges? }（可选：创建时直接带上初始图）
 */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: { title?: string; nodes?: unknown[]; edges?: unknown[] } = {};
  try {
    body = await req.json();
  } catch {
    // 空 body 也行
  }

  try {
    const workflow = await prisma.workflow.create({
      data: {
        title: body.title?.trim() || "未命名工作流",
        userId: session.user.id,
      },
      select: { id: true, title: true },
    });
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (e) {
    // 外键失败：JWT 会话有效但对应的用户已不存在（账号被删）
    // → 当作未登录返回 401，前端会清掉会话并跳登录，避免暴露 500
    if (isForeignKeyError(e)) {
      return NextResponse.json(
        { error: "登录状态已失效，请重新登录" },
        { status: 401 },
      );
    }
    throw e;
  }
}
