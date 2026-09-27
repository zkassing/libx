import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/types";
import type {
  CanvasEdge,
  CanvasNode,
} from "@/generated/prisma/client";

/**
 * 画布图 ⇄ 数据库行 转换。
 * 保存时前端传 React Flow 原始结构，这里压平成行；读取时还原。
 */

/** RF 节点 → CanvasNode 行 */
export function nodeToRow(
  n: Node<FlowNodeData>,
  index: number,
): Omit<CanvasNode, "workflow" | "workflowId"> {
  return {
    id: n.id,
    type: n.type ?? n.data.kind,
    x: n.position?.x ?? 0,
    y: n.position?.y ?? 0,
    parentId: n.parentId ?? null,
    data: JSON.stringify(n.data),
    style: n.style ? JSON.stringify(n.style) : null,
    measured: n.measured ? JSON.stringify(n.measured) : null,
    index,
  };
}

/** RF 边 → CanvasEdge 行 */
export function edgeToRow(
  e: Edge,
  index: number,
): Omit<CanvasEdge, "workflow" | "workflowId"> {
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    data: null,
    index,
  };
}

function parseJSON<T>(s: string | null): T | undefined {
  if (!s) return undefined;
  try {
    return JSON.parse(s) as T;
  } catch {
    return undefined;
  }
}

/** CanvasNode 行 → RF 节点 */
export function rowToNode(row: CanvasNode): Node<FlowNodeData> {
  return {
    id: row.id,
    type: row.type,
    position: { x: row.x, y: row.y },
    parentId: row.parentId ?? undefined,
    data: parseJSON<FlowNodeData>(row.data) ?? ({} as FlowNodeData),
    style: parseJSON<Record<string, unknown>>(row.style),
    measured: parseJSON<{ width?: number; height?: number }>(row.measured),
  } as Node<FlowNodeData>;
}

/** CanvasEdge 行 → RF 边 */
export function rowToEdge(row: CanvasEdge): Edge {
  return {
    id: row.id,
    source: row.source,
    target: row.target,
    sourceHandle: row.sourceHandle ?? undefined,
    targetHandle: row.targetHandle ?? undefined,
    type: "flow",
  } as Edge;
}
