import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData, NodeOutput } from "@/types";

/**
 * 上游产物上下文（对齐 LibTV：连线即契约，生成时自动解析直接上游，
 * 卡片上不渲染输入 chips）。
 */
export interface UpstreamContext {
  nodeId: string;
  title: string;
  kind: FlowNodeData["kind"];
  output: NodeOutput;
}

/** 节点的展示名：标题 + 序号（如“文本节点 1”），与卡片头部一致 */
export function nodeDisplayName(n: Node<FlowNodeData>): string {
  return n.data.index ? `${n.data.title} ${n.data.index}` : n.data.title;
}

/** 直接上游节点：所有以 targetId 为终点的连线的 source（不含隔代） */
export function directUpstreams(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  targetId: string,
): Node<FlowNodeData>[] {
  const ids = new Set(
    edges.filter((e) => e.target === targetId).map((e) => e.source),
  );
  return nodes.filter((n) => ids.has(n.id));
}

/**
 * 已就绪的上游产物（status=succeeded 且带 output）。
 * 这就是下游生成时能拿到的全部上下文。
 */
export function upstreamContexts(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  targetId: string,
): UpstreamContext[] {
  return directUpstreams(edges, nodes, targetId).flatMap((n) =>
    n.data.status === "succeeded" && n.data.output
      ? [
          {
            nodeId: n.id,
            title: nodeDisplayName(n),
            kind: n.data.kind,
            output: n.data.output,
          },
        ]
      : [],
  );
}

/** 还没有产物的上游标题（运行拦截提示用） */
export function pendingUpstreams(
  edges: Edge[],
  nodes: Node<FlowNodeData>[],
  targetId: string,
): string[] {
  return directUpstreams(edges, nodes, targetId)
    .filter((n) => !(n.data.status === "succeeded" && n.data.output))
    .map((n) => nodeDisplayName(n));
}

/** 把上游产物压成一段简短文本，注入下游的 mock 产物 */
export function describeOutput(output: NodeOutput): string {
  if (output.text) {
    // 文本/脚本产物可能是 JSON，取前 240 字即可，只是演示“内容真的传下来了”
    return output.text.replace(/\s+/g, " ").slice(0, 240);
  }
  if (output.urls?.length) {
    return `[${output.kind} 媒体产物 ×${output.urls.length}]`;
  }
  return "[空产物]";
}
