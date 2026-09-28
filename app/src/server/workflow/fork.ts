import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * 复制一份工作流（含节点 / 连线 / 变量）到目标用户名下，返回新 workflow id。
 *
 * 为什么必须重映射 id：
 *   `CanvasNode.id` 与 `CanvasEdge.id` 在 Prisma 里都是**全局主键**（不是
 *   `@@id([workflowId, id])`），直接照搬源 id 会和源工作流的主键撞车。
 *   所以节点要发新 id，边的 `source/target`、节点的 `parentId`（分组）都要跟着改。
 *
 * 运行态一律清空：副本是一张干净的画布，不该带着源工作流的产物/进度/状态。
 */
export async function forkWorkflow(opts: {
  sourceId: string;
  targetUserId: string;
  title?: string;
}): Promise<string | null> {
  const { sourceId, targetUserId, title } = opts;

  const src = await prisma.workflow.findUnique({
    where: { id: sourceId },
    include: {
      nodes: { orderBy: { index: "asc" } },
      edges: { orderBy: { index: "asc" } },
      variables: true,
    },
  });
  if (!src) return null;

  /* 节点 id 重映射表（分组节点的 parentId 也走这张表） */
  const idMap = new Map<string, string>();
  for (const n of src.nodes) {
    idMap.set(n.id, `${n.type}_${randomUUID()}`);
  }

  const created = await prisma.workflow.create({
    data: {
      title: title?.trim() || `${src.title} 的副本`,
      userId: targetUserId,
      description: src.description,
      forkedFrom: src.id,
      // 副本没有产物，不继承源封面
      nodes: {
        create: src.nodes.map((n, i) => ({
          id: idMap.get(n.id)!,
          type: n.type,
          x: n.x,
          y: n.y,
          parentId: n.parentId ? (idMap.get(n.parentId) ?? null) : null,
          data: stripRuntime(n.data),
          style: n.style,
          measured: n.measured,
          index: i,
        })),
      },
      edges: {
        create: src.edges
          .filter((e) => idMap.has(e.source) && idMap.has(e.target))
          .map((e, i) => ({
            id: `edge_${randomUUID()}`,
            source: idMap.get(e.source)!,
            target: idMap.get(e.target)!,
            sourceHandle: e.sourceHandle,
            targetHandle: e.targetHandle,
            data: e.data,
            index: i,
          })),
      },
      variables: {
        create: src.variables.map((v) => ({
          key: v.key,
          label: v.label,
          type: v.type,
          default: v.default,
          options: v.options,
          required: v.required,
          source: v.source,
        })),
      },
    },
    select: { id: true },
  });

  return created.id;
}

/** 抹掉节点 data 里的运行态字段，让副本回到初始态 */
function stripRuntime(dataJson: string): string {
  try {
    const d = JSON.parse(dataJson) as Record<string, unknown>;
    delete d.output;
    d.status = "idle";
    d.progress = 0;
    return JSON.stringify(d);
  } catch {
    // data 不是合法 JSON 时原样保留，别把节点搞坏
    return dataJson;
  }
}
