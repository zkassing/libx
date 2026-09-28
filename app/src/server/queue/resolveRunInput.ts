import { prisma } from "@/lib/prisma";
import type { CanvasNode } from "@/generated/prisma/client";
import type {
  GenInput,
  GenUpstream,
} from "@/server/providers/types";
import type { FlowNodeData } from "@/types";
import type { VariableValues } from "@/lib/variableTypes";
import {
  extractVariableKeys,
  renderTemplate,
  resolveVariableValues,
  rowToVariable,
} from "@/server/teaching/variables";

/* ------------------------------------------------------------------ */
/* 节点运行的输入解析（route 入队 / worker 执行 共用）                    */
/* ------------------------------------------------------------------ */

export interface ResolveError {
  status: 404 | 403 | 500;
  message: string;
}

export interface ResolvedRunInput {
  workflowId: string;
  nodeId: string;
  data: FlowNodeData;
  genInput: GenInput;
  /** 输入快照（落 NodeRun.input） */
  inputSnapshot: unknown;
  cost: number;
}

/** 取节点行 + 归属校验；失败返回 { error }，成功返回 { row, workflowId } */
export async function loadOwnedNode(
  nodeId: string,
  userId: string,
): Promise<
  { error: ResolveError }
  | { row: CanvasNode; workflowId: string }
> {
  const row = await prisma.canvasNode.findUnique({ where: { id: nodeId } });
  if (!row) return { error: { status: 404, message: "节点不存在" } };
  const workflow = await prisma.workflow.findUnique({
    where: { id: row.workflowId },
    select: { userId: true },
  });
  if (!workflow || workflow.userId !== userId) {
    return { error: { status: 403, message: "无权操作该节点" } };
  }
  return { row, workflowId: row.workflowId };
}

/** 解析某节点当前的直接上游（已就绪 → upstreams；未就绪 → pending 名称） */
export async function resolveUpstreams(workflowId: string, nodeId: string) {
  const incomingEdges = await prisma.canvasEdge.findMany({
    where: { workflowId, target: nodeId },
  });
  const upstreamIds = incomingEdges.map((e) => e.source);
  const upstreamRows = upstreamIds.length
    ? await prisma.canvasNode.findMany({ where: { id: { in: upstreamIds } } })
    : [];

  const upstreams: GenUpstream[] = [];
  const pending: string[] = [];

  for (const ur of upstreamRows) {
    let ud: FlowNodeData;
    try {
      ud = JSON.parse(ur.data) as FlowNodeData;
    } catch {
      continue;
    }
    const display = `${ud.title}${ud.index ? ` ${ud.index}` : ""}`;
    if (ud.status !== "succeeded" || !ud.output) {
      pending.push(display || ur.id);
      continue;
    }
    upstreams.push({
      nodeId: ur.id,
      title: display,
      kind: ud.kind,
      summary: ud.output.text?.slice(0, 200) ?? ud.output.urls?.[0] ?? "",
      ...(ud.output.urls?.length ? { urls: ud.output.urls } : {}),
    });
  }

  return { upstreams, pending };
}

/* ------------------------------------------------------------------ */
/* 变量解析（T3.5）：把节点提示词里的 {{key}} 渲染成实际值                 */
/* ------------------------------------------------------------------ */

export interface NodeVariableResult {
  /** 渲染后的提示词 */
  prompt: string;
  /** 生效变量值（提交值优先，回退老师默认） */
  values: VariableValues;
  /** 本节点提示词引用了、但最终无值的变量 key */
  missing: string[];
}

/**
 * 解析某节点运行时的变量：
 * - 拉取工作流全部变量定义；
 * - 学生/调用方提交值优先，否则回退老师预设 default；
 * - 用有效值渲染节点 prompt；
 * - 返回仍缺失的 key（是否拦截由调用方决定：worker 拦截，入队仅快照）。
 */
export async function resolveNodeVariables(
  workflowId: string,
  nodeData: FlowNodeData,
  submitted: VariableValues,
): Promise<NodeVariableResult> {
  const rows = await prisma.variable.findMany({ where: { workflowId } });
  const defs = rows.map(rowToVariable);
  const values = resolveVariableValues(defs, submitted);

  const rawPrompt = nodeData.prompt ?? "";
  const prompt = renderTemplate(rawPrompt, values);
  const missing = extractVariableKeys(rawPrompt).filter(
    (k) => values[k] === undefined || values[k] === "",
  );

  return { prompt, values, missing };
}
