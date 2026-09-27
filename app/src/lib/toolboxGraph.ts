import type { Edge, Node } from "@xyflow/react";
import { NODE_SIZE, type FlowNodeData } from "@/types";
import { useCanvasStore } from "@/stores/canvasStore";
import type { ToolboxItem } from "@/stores/toolboxStore";

let seq = 0;
const newId = (kind: string) =>
  `${kind}_${Date.now().toString(36)}${(seq++).toString(36)}${Math.random()
    .toString(36)
    .slice(2, 6)}`;

/**
 * 把工具箱里的工作流实例化成一组新节点（id 全部重映射、运行态清空）。
 * - `at` 有值 → 以该点为中心落位（拖拽放置用）
 * - 否则 → 放在现有画布包围盒右侧 +120，避免和已有内容重叠
 */
export function instantiateToolbox(
  item: ToolboxItem,
  at?: { x: number; y: number },
): { nodes: Node<FlowNodeData>[]; edges: Edge[] } {
  const store = useCanvasStore.getState();

  let offX = 0;
  let offY = 0;
  if (at) {
    // 以模板包围盒中心对齐落点
    const w = item.nodes.map((n) => NODE_SIZE[n.data.kind]?.w ?? 360);
    const h = item.nodes.map((n) => NODE_SIZE[n.data.kind]?.h ?? 240);
    const minX = Math.min(...item.nodes.map((n) => n.position.x));
    const minY = Math.min(...item.nodes.map((n) => n.position.y));
    const maxX = Math.max(
      ...item.nodes.map((n, i) => n.position.x + w[i]),
    );
    const maxY = Math.max(
      ...item.nodes.map((n, i) => n.position.y + h[i]),
    );
    offX = Math.round(at.x - (minX + maxX) / 2);
    offY = Math.round(at.y - (minY + maxY) / 2);
  } else if (store.nodes.length) {
    const maxX = Math.max(
      ...store.nodes.map(
        (n) => n.position.x + (NODE_SIZE[n.data.kind]?.w ?? 360),
      ),
    );
    const maxY = Math.max(...store.nodes.map((n) => n.position.y));
    offX = maxX + 120;
    offY = maxY;
  }

  const idMap = new Map<string, string>();
  item.nodes.forEach((n) => idMap.set(n.id, newId(n.data.kind)));

  const nodes: Node<FlowNodeData>[] = item.nodes.map((n) => ({
    ...n,
    id: idMap.get(n.id)!,
    position: { x: n.position.x + offX, y: n.position.y + offY },
    selected: false,
    parentId: undefined,
    extent: undefined,
    measured: {
      width: NODE_SIZE[n.data.kind]?.w ?? 360,
      height: NODE_SIZE[n.data.kind]?.h ?? 240,
    },
    style: {
      width: NODE_SIZE[n.data.kind]?.w ?? 360,
      height: NODE_SIZE[n.data.kind]?.h ?? 240,
    },
    data: {
      ...n.data,
      status: "idle",
      progress: 0,
      output: undefined,
    } as FlowNodeData,
  }));

  const edges: Edge[] = item.edges
    .filter((e) => idMap.has(e.source) && idMap.has(e.target))
    .map((e) => ({
      ...e,
      id: `xy-edge__${idMap.get(e.source)}${idMap.get(e.target)}`,
      source: idMap.get(e.source)!,
      target: idMap.get(e.target)!,
      type: "flow",
      animated: false,
      selected: false,
      style: undefined,
    }));

  return { nodes, edges };
}

/** 实例化并追加到当前画布（走 appendGraph，可 Ctrl+Z 撤销） */
export function loadToolboxToCanvas(
  item: ToolboxItem,
  at?: { x: number; y: number },
) {
  const { nodes, edges } = instantiateToolbox(item, at);
  if (nodes.length === 0) return;
  useCanvasStore.getState().appendGraph(nodes, edges);
}
