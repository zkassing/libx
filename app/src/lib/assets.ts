import { NODE_SIZE, type FlowNodeData, type NodeKind } from "@/types";
import type { Node } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvasStore";

/** 侧栏「资产」与资产弹框共用的产物条目 */
export interface Asset {
  nodeId: string;
  kind: NodeKind;
  title: string;
  prompt: string;
  urls: string[];
  text?: string;
}

/** 汇总当前画布上已有产物的节点 */
export function collectAssets(
  nodes: { id: string; data: FlowNodeData }[],
): Asset[] {
  return nodes
    .filter((n) => n.data.output)
    .map((n) => ({
      nodeId: n.id,
      kind: n.data.kind,
      title: n.data.title,
      prompt: n.data.prompt,
      urls: n.data.output?.urls ?? [],
      text: n.data.output?.text,
    }));
}

/** 让节点/包围盒以某个落点为中心 */
export function centerAt(
  kind: NodeKind,
  at: { x: number; y: number },
): { x: number; y: number } {
  const size = NODE_SIZE[kind] ?? { w: 360, h: 240 };
  return { x: Math.round(at.x - size.w / 2), y: Math.round(at.y - size.h / 2) };
}

/**
 * 复用产物：据此新建一个节点（复制提示词/参数/产物）。
 * - `at` 有值 → 以该点为中心落位（拖拽放置用）
 * - 否则 → 落在源节点右下 60px，保证一定在视野内
 *
 * addNode + updateNodeData 会被合并成一步可撤销操作。
 */
export function reuseAsset(
  nodeId: string,
  at?: { x: number; y: number },
): string | null {
  const src = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
  if (!src) return null;

  const st = useCanvasStore.getState();
  // 先快照“操作前”的状态，再挂起历史，这样 addNode + updateNodeData 合成一步
  st.pushHistory("reuse", 0);
  st.beginHistoryPause();
  try {
    const position = at
      ? centerAt(src.data.kind, at)
      : { x: src.position.x + 60, y: src.position.y + 60 };
    const id = st.addNode(src.data.kind, position);
    st.updateNodeData(id, {
      prompt: src.data.prompt,
      params: { ...src.data.params },
      refs: src.data.refs ? [...src.data.refs] : undefined,
      output: src.data.output ? { ...src.data.output } : undefined,
      status: src.data.output ? "succeeded" : "idle",
      progress: src.data.output ? 100 : 0,
    });
    return id;
  } finally {
    st.endHistoryPause();
  }
}

/** 从源节点复制一份拖到某处的数据（资产区拖拽预览用） */
export function assetPreviewNode(nodes: Node<FlowNodeData>[], nodeId: string) {
  return nodes.find((n) => n.id === nodeId) ?? null;
}
