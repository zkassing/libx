import type { Edge, Node } from "@xyflow/react";
import { NODE_SIZE, type FlowNodeData } from "@/types";

/**
 * 一键整理：把画布摆成从左到右的拓扑分层。
 *
 * 规则
 * - 一个「单元」= 一个普通节点，或一个打组节点（连同它的子节点一起搬运）
 * - 层号 = 最长路径（源点为 0），保证上游永远在左边
 * - 同层按原有 y 排序后纵向堆叠，整列垂直居中，列宽取该层最宽单元
 * - 布局后整体平移，让包围盒左上角回到原位，避免视图跳走
 */
export interface LayoutOptions {
  /** 列间距 */
  gapX?: number;
  /** 同层节点垂直间距 */
  gapY?: number;
}

interface Unit {
  id: string;
  w: number;
  h: number;
  /** 该单元包含的节点 id（打组时含子节点） */
  nodeIds: string[];
  /** 排序用：原始 y */
  y: number;
}

function sizeOf(node: Node<FlowNodeData>) {
  const kind = node.data.kind;
  const fallback = NODE_SIZE[kind] ?? { w: 360, h: 240 };
  const w = (node.style?.width as number) ?? node.measured?.width ?? fallback.w;
  const h =
    (node.style?.height as number) ?? node.measured?.height ?? fallback.h;
  return { w, h };
}

export function autoLayoutNodes(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
  opts: LayoutOptions = {},
): Node<FlowNodeData>[] {
  const { gapX = 140, gapY = 56 } = opts;
  if (nodes.length === 0) return nodes;

  /* ① 拆单元 --------------------------------------------------------- */
  const groupNodes = nodes.filter((n) => n.type === "group");
  const groupIds = new Set(groupNodes.map((g) => g.id));
  const childrenOf = new Map<string, Node<FlowNodeData>[]>();
  groupNodes.forEach((g) => childrenOf.set(g.id, []));

  const units: Unit[] = [];
  for (const n of nodes) {
    if (n.type === "group") continue;
    if (n.parentId && groupIds.has(n.parentId)) {
      childrenOf.get(n.parentId)!.push(n);
      continue;
    }
    const { w, h } = sizeOf(n);
    units.push({ id: n.id, w, h, nodeIds: [n.id], y: n.position.y });
  }
  for (const g of groupNodes) {
    const kids = childrenOf.get(g.id) ?? [];
    const { w, h } = sizeOf(g);
    units.push({
      id: g.id,
      w,
      h,
      nodeIds: [g.id, ...kids.map((k) => k.id)],
      y: g.position.y,
    });
  }
  if (units.length === 0) return nodes;

  /* ② 单元级 DAG ----------------------------------------------------- */
  const unitOf = new Map<string, string>();
  for (const u of units) for (const id of u.nodeIds) unitOf.set(id, u.id);

  const preds = new Map<string, Set<string>>();
  const succs = new Map<string, Set<string>>();
  units.forEach((u) => {
    preds.set(u.id, new Set());
    succs.set(u.id, new Set());
  });
  for (const e of edges) {
    const a = unitOf.get(e.source);
    const b = unitOf.get(e.target);
    if (!a || !b || a === b) continue;
    preds.get(b)!.add(a);
    succs.get(a)!.add(b);
  }

  /* ③ 最长路径分层（Kahn）。有环时剩下的按 0 层处理，不至于卡死 ---- */
  const layer = new Map<string, number>(units.map((u) => [u.id, 0]));
  const indeg = new Map<string, number>();
  units.forEach((u) => indeg.set(u.id, preds.get(u.id)!.size));

  const queue = units.filter((u) => indeg.get(u.id) === 0).map((u) => u.id);
  const processed = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    processed.add(id);
    for (const next of succs.get(id)!) {
      layer.set(next, Math.max(layer.get(next)!, layer.get(id)! + 1));
      indeg.set(next, indeg.get(next)! - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }

  /* ④ 孤立单元（无上游也无下游）单独排到最后一列 ------------------- */
  const isIsolated = (id: string) =>
    preds.get(id)!.size === 0 && succs.get(id)!.size === 0;
  const connected = units.filter((u) => !isIsolated(u.id));
  if (connected.length > 0) {
    const maxLayer = Math.max(...connected.map((u) => layer.get(u.id) ?? 0));
    for (const u of units) {
      if (isIsolated(u.id)) layer.set(u.id, maxLayer + 1);
    }
  }

  /* ⑤ 分层排布 ------------------------------------------------------- */
  const byLayer = new Map<number, Unit[]>();
  for (const u of units) {
    const l = layer.get(u.id) ?? 0;
    const list = byLayer.get(l);
    if (list) list.push(u);
    else byLayer.set(l, [u]);
  }

  const columns = [...byLayer.keys()].sort((a, b) => a - b);
  const positions = new Map<string, { x: number; y: number; w: number; h: number }>();

  let cursorX = 0;
  let maxColumnH = 0;
  for (const l of columns) {
    // 同层保持原有上下顺序，读起来更符合直觉
    const column = byLayer.get(l)!.sort((a, b) => a.y - b.y);
    const colW = Math.max(...column.map((u) => u.w));
    const totalH =
      column.reduce((sum, u) => sum + u.h, 0) + gapY * (column.length - 1);
    maxColumnH = Math.max(maxColumnH, totalH);

    let cursorY = -totalH / 2;
    for (const u of column) {
      positions.set(u.id, { x: cursorX, y: cursorY, w: u.w, h: u.h });
      cursorY += u.h + gapY;
    }
    cursorX += colW + gapX;
  }

  /* ⑥ 平移回原包围盒左上角，避免视图跳走 ---------------------------- */
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const oldMinX = Math.min(...units.map((u) => nodeById.get(u.id)!.position.x));
  const oldMinY = Math.min(...units.map((u) => nodeById.get(u.id)!.position.y));
  const newMinX = Math.min(...[...positions.values()].map((p) => p.x));
  const newMinY = Math.min(...[...positions.values()].map((p) => p.y));
  const dx = oldMinX - newMinX;
  const dy = oldMinY - newMinY;

  /* ⑦ 写回：子节点保持相对坐标不动 -------------------------------- */
  return nodes.map((n) => {
    if (n.parentId && groupIds.has(n.parentId)) return n; // 跟着组走
    const target = positions.get(unitOf.get(n.id) ?? n.id);
    if (!target) return n;
    return { ...n, position: { x: target.x + dx, y: target.y + dy } };
  });
}
