import type { GenResult } from "@/server/providers/types";
import { prisma } from "@/lib/prisma";

/** 节点产物 → 资产种类（text/script 不进图/视频/音频网格） */
export function assetKindOf(nodeKind: string): "image" | "video" | "audio" | null {
  if (nodeKind === "image") return "image";
  if (nodeKind === "video") return "video";
  if (nodeKind === "audio") return "audio";
  return null;
}

/** 从产物里取第一个媒体地址 */
export function firstMediaUrl(result: GenResult): string | undefined {
  return Array.isArray(result.urls) && result.urls.length > 0 ? result.urls[0] : undefined;
}

/**
 * 节点真实生成成功后：
 *  1) 媒体类产物 → 自动落一条 source="generated" 的资产（生成历史）
 *  2) 该工作流还没有封面时，用本次媒体补封面（首页项目卡片用）
 *
 * 命中缓存（cost=0）时不重复产生生成历史。
 */
export async function recordGeneratedAsset(args: {
  userId: string;
  workflowId: string;
  nodeId: string;
  runId: string;
  nodeKind: string;
  result: GenResult;
}): Promise<void> {
  const kind = assetKindOf(args.nodeKind);
  if (!kind) return;
  const url = firstMediaUrl(args.result);
  if (!url) return;

  await prisma.asset.create({
    data: {
      userId: args.userId,
      source: "generated",
      kind,
      title: `${kind === "image" ? "图片" : kind === "video" ? "视频" : "音频"}产物`,
      url,
      workflowId: args.workflowId,
      nodeId: args.nodeId,
      runId: args.runId,
    },
  });

  const wf = await prisma.workflow.findUnique({
    where: { id: args.workflowId },
    select: { coverUrl: true },
  });
  if (wf && !wf.coverUrl) {
    await prisma.workflow.update({
      where: { id: args.workflowId },
      data: { coverUrl: url },
    });
  }
}
