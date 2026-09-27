import type { Edge, Node } from "@xyflow/react";
import type {
  NodeKind,
  NodeParams,
  FlowNodeData,
} from "@/types";
import type { SkillTemplate } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* Skill 模板 → 画布节点/边（纯函数，服务端启动 API 与前端复用）            */
/* ------------------------------------------------------------------ */

const KINDS: NodeKind[] = ["text", "image", "video", "audio", "script"];

function asKind(k: string): NodeKind {
  return (KINDS as string[]).includes(k) ? (k as NodeKind) : "text";
}

let seq = 0;
/** 生成运行期节点 id（同口径于 toolboxGraph） */
export function skillNodeId(kind: string): string {
  return `${kind}_${Date.now().toString(36)}${(seq++).toString(36)}${Math
    .random()
    .toString(36)
    .slice(2, 6)}`;
}

export interface InstantiatedSkill {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

/**
 * 把 Skill 模板实例化成画布节点：
 * - 每个模板节点生成新 id（_seedId → 真实 id）
 * - 边按 seedId 重映射
 * - 运行态清空（idle），保留老师预设 prompt/params
 * - 可选灵感：前置注入到首个节点（让一句话驱动内容）
 */
export function instantiateSkillTemplate(
  template: SkillTemplate,
  inspiration?: string,
): InstantiatedSkill {
  const idBySeed = new Map<number, string>();

  const nodes: Node<FlowNodeData>[] = template.nodes.map((tn) => {
    const kind = asKind(tn.kind);
    const id = skillNodeId(kind);
    idBySeed.set(tn._seedId, id);

    const params: NodeParams = {
      ...(tn.params as NodeParams | undefined),
    };

    // 首个节点注入灵感（若该节点是文本/剧本类，作为创作起点）
    let prompt = tn.prompt;
    if (inspiration && tn._seedId === 0) {
      const lead = kind === "text" || kind === "script";
      prompt = lead
        ? `创作灵感：${inspiration.trim()}\n\n${tn.prompt}`
        : tn.prompt;
    }

    const data: FlowNodeData = {
      kind,
      title: tn.title,
      prompt,
      params,
      status: "idle",
      progress: 0,
    };

    return {
      id,
      type: kind,
      position: { x: tn.x, y: tn.y },
      data,
    } as Node<FlowNodeData>;
  });

  const edges: Edge[] = template.edges
    .filter((e) => idBySeed.has(e.from) && idBySeed.has(e.to))
    .map((e) => {
      const source = idBySeed.get(e.from)!;
      const target = idBySeed.get(e.to)!;
      return {
        id: `xy-edge__${source}${target}`,
        source,
        target,
        type: "flow",
      } as Edge;
    });

  return { nodes, edges };
}
