import type { Edge, Node } from "@xyflow/react";
import { NODE_SIZE, type FlowNodeData, type Shot } from "@/types";

/* ------------------------------------------------------------------ */
/* 成片流水线 P3/P4：从已确认分镜创建分镜图节点 / 图生视频节点             */
/* 纯函数：输入当前画布 + 来源剧本节点，输出 { nodes, edges, shots }      */
/* ------------------------------------------------------------------ */

let seq = 0;
function localId(prefix: string): string {
  seq += 1;
  return `${prefix}_pipe_${Date.now().toString(36)}_${seq}`;
}

export interface PipelineResult {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  shots: Shot[];
}

/** 找到来源节点位置，让新节点排在其右侧 */
function basePosition(source: Node<FlowNodeData>, col: number) {
  return {
    x: source.position.x + NODE_SIZE[source.data.kind].w + 120 + col * 520,
    y: source.position.y,
  };
}

function makeNode(
  kind: FlowNodeData["kind"],
  title: string,
  position: { x: number; y: number },
  prompt: string,
  extra?: Partial<FlowNodeData>,
): Node<FlowNodeData> {
  return {
    id: localId(kind),
    type: kind,
    position,
    measured: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    style: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    data: {
      kind,
      title,
      prompt,
      params:
        kind === "video"
          ? { mode: "图生视频", duration: 5 }
          : {},
      status: "idle",
      progress: 0,
      ...extra,
    },
  };
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e_${source}_${target}`,
    source,
    target,
  };
}

/**
 * P3：为来源剧本节点里所有「已确认但还没有分镜图节点」的镜头
 * 创建 image 节点（连线到剧本，隐式拿到分镜内容），并回写 imageNodeId。
 */
export function buildImageNodes(
  nodes: Node<FlowNodeData>[],
  sourceId: string,
): PipelineResult {
  const source = nodes.find((n) => n.id === sourceId);
  if (!source) return { nodes: [], edges: [], shots: [] };
  const shots = source.data.output?.shots ?? [];

  const newNodes: Node<FlowNodeData>[] = [];
  const newEdges: Edge[] = [];
  const updated = shots.map((shot, i) => {
    if (!shot.confirmed || shot.imageNodeId) return shot;
    const node = makeNode(
      "image",
      `分镜图 ${shot.index}`,
      { ...basePosition(source, 0), y: source.position.y + i * 420 },
      `镜头${shot.index}：${shot.scene}｜${shot.framing}｜${shot.camera}`,
    );
    newNodes.push(node);
    newEdges.push(makeEdge(source.id, node.id));
    return { ...shot, imageNodeId: node.id };
  });
  return { nodes: newNodes, edges: newEdges, shots: updated };
}

/**
 * P4：为所有「已有分镜图节点但还没有视频节点」的镜头
 * 创建 video 节点（连线到分镜图，图生视频），回写 videoNodeId。
 */
export function buildVideoNodes(
  nodes: Node<FlowNodeData>[],
  sourceId: string,
): PipelineResult {
  const source = nodes.find((n) => n.id === sourceId);
  if (!source) return { nodes: [], edges: [], shots: [] };
  const shots = source.data.output?.shots ?? [];

  const newNodes: Node<FlowNodeData>[] = [];
  const newEdges: Edge[] = [];
  const updated = shots.map((shot, i) => {
    if (!shot.imageNodeId || shot.videoNodeId) return shot;
    const imgNode = nodes.find((n) => n.id === shot.imageNodeId);
    const imgY = imgNode?.position.y ?? source.position.y + i * 420;
    const node = makeNode(
      "video",
      `镜头视频 ${shot.index}`,
      {
        x: source.position.x + NODE_SIZE[source.data.kind].w + 120 + 520,
        y: imgY,
      },
      `${shot.camera}，${shot.duration}秒；${shot.scene}`,
      { params: { mode: "图生视频", duration: shot.duration } },
    );
    newNodes.push(node);
    newEdges.push(makeEdge(shot.imageNodeId!, node.id));
    return { ...shot, videoNodeId: node.id };
  });
  return { nodes: newNodes, edges: newEdges, shots: updated };
}
