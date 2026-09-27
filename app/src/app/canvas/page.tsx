import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/**
 * /canvas（无 id）入口：
 * - 未登录 → middleware 已拦到 /login
 * - 有工作流 → 跳最近编辑的一张
 * - 一张都没有 → 自动创建空工作流再跳
 */
export default async function CanvasEntry() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const recent = await prisma.workflow.findFirst({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  if (recent) redirect(`/canvas/${recent.id}`);

  const created = await prisma.workflow.create({
    data: { userId: session.user.id, title: "未命名工作流" },
    select: { id: true },
  });
  redirect(`/canvas/${created.id}`);
}
