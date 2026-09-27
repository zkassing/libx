import type { Edge, Node } from "@xyflow/react";
import type {
  NodeKind,
  FlowNodeData,
} from "@/types";
import type { SkillTemplate } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* 画布 → Skill 模板（导出纯函数，发布为 Skill 用）                        */
/* 是 instantiateSkillTemplate 的逆过程。                                */
/* ------------------------------------------------------------------ */

const KINDS: NodeKind[] = ["text", "image", "video", "audio", "script"];

/**
 * 把当前画布导出成 Skill 模板：
 * - 过滤 group 与非 5 类节点；
 * - 节点按数组序号得到 _seedId（从 0）；
 * - 只保留可编辑配置（kind/title/prompt/params/位置），运行态/产物不带；
 * - 边重映射为 from/to（_seedId），丢弃连到被过滤节点的边。
 */
export function exportSkillTemplate(
  nodes: Node<FlowNodeData>[],
  edges: Edge[],
): SkillTemplate {
  const real = nodes.filter(
    (n) =>
      n.type !== "group" &&
      (KINDS as string[]).includes(n.data?.kind),
  );

  const seedByNodeId = new Map<string, number>();
  real.forEach((n, i) => seedByNodeId.set(n.id, i));

  const tplNodes = real.map((n) => {
    const d = n.data;
    return {
      _seedId: seedByNodeId.get(n.id)!,
      kind: d.kind,
      title: d.title,
      prompt: d.prompt,
      x: Math.round(n.position.x),
      y: Math.round(n.position.y),
      // 只挑白名单参数，去掉运行态杂项
      params: {
        ...(d.params as object | undefined),
      },
    };
  });

  const tplEdges = edges
    .map((e) => ({
      from: seedByNodeId.get(e.source),
      to: seedByNodeId.get(e.target),
    }))
    .filter(
      (e): e is { from: number; to: number } =>
        e.from !== undefined && e.to !== undefined,
    );

  return { nodes: tplNodes, edges: tplEdges };
}
