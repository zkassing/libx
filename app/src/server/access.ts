import { prisma } from "@/lib/prisma";
import type { Workflow } from "@/generated/prisma/client";

/* ------------------------------------------------------------------ */
/* 工作流归属校验（API 共享）                                             */
/* ------------------------------------------------------------------ */

export type AccessError = 404 | 403;

/**
 * 加载属于某用户的工作流。
 * - 不存在 → 404
 * - 存在但非本人 → 403
 */
export async function loadOwnedWorkflow(
  workflowId: string,
  userId: string,
): Promise<{ error: AccessError } | { workflow: Workflow }> {
  const workflow = await prisma.workflow.findUnique({
    where: { id: workflowId },
  });
  if (!workflow) return { error: 404 };
  if (workflow.userId !== userId) return { error: 403 };
  return { workflow };
}
