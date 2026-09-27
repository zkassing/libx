import type { Shot } from "@/types";
import type { Node } from "@xyflow/react";
import type { FlowNodeData } from "@/types";

/* ------------------------------------------------------------------ */
/* 故事板：聚合当前画布所有剧本节点产出的分镜                              */
/* ------------------------------------------------------------------ */

export interface StoryboardEntry {
  /** 分镜来源节点 id */
  nodeId: string;
  /** 来源节点标题 */
  nodeTitle: string;
  shots: Shot[];
}

/** 找出所有产出分镜的节点（text/script 且 output.shots 非空） */
export function collectStoryboard(
  nodes: Node<FlowNodeData>[],
): StoryboardEntry[] {
  const entries: StoryboardEntry[] = [];
  for (const n of nodes) {
    if (n.type === "group") continue;
    const shots = n.data?.output?.shots;
    if (Array.isArray(shots) && shots.length > 0) {
      entries.push({
        nodeId: n.id,
        nodeTitle: n.data.title || "剧本节点",
        shots,
      });
    }
  }
  return entries;
}

/** 全局镜头总数 */
export function totalShots(entries: StoryboardEntry[]): number {
  return entries.reduce((acc, e) => acc + e.shots.length, 0);
}

/** 已确认镜头数 */
export function confirmedShots(entries: StoryboardEntry[]): number {
  return entries.reduce(
    (acc, e) => acc + e.shots.filter((s) => s.confirmed).length,
    0,
  );
}
