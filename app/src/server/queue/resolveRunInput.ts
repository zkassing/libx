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
    // 按连线创建顺序取上游：多上游契约融合时的 1）2）顺序稳定，缓存哈希才可复现
    orderBy: { index: "asc" },
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
      // 动作契约（text/script 上游产出）→ AutoLink 消费
      ...(ud.output.action ? { action: ud.output.action } : {}),
    });
  }

  return { upstreams, pending };
}

/* ------------------------------------------------------------------ */
/* `@引用` 解析（参考 / 标记 / 角色库）：把节点 refs 变成生成输入          */
/* ------------------------------------------------------------------ */

export interface ResolvedRefs {
  /** 文本类参考（节点产物摘要 / 角色设定），并入 upstreams 进上下文 */
  upstreams: GenUpstream[];
  /** 图片类参考（被引用节点的图片产物 / 标记所在图 / 角色参考图） */
  referenceImages: string[];
  /** `model:` 引用覆盖节点模型选择 */
  modelOverride?: string;
}

/**
 * 把节点上的 refs 解析成生成可用的输入：
 * - node / asset 引用 → 该节点已就绪产物（文本进上下文，图片进参考图）
 * - mark 引用 → 标记所在图进参考图（标记名已在提示词文本里）
 * - character 引用 → 角色设定进上下文 + 参考图
 * - model 引用 → 覆盖模型
 * 安全：节点/角色都校验归属当前用户，越权引用静默丢弃。
 */
export async function resolveRefs(
  nodeData: FlowNodeData,
  userId: string,
): Promise<ResolvedRefs> {
  const refs = nodeData.refs ?? [];
  const out: ResolvedRefs = { upstreams: [], referenceImages: [] };

  const pushImage = (url?: string | null) => {
    if (url && !out.referenceImages.includes(url)) out.referenceImages.push(url);
  };

  // 图生图自引用（对齐 LibTV：上传图片进节点 + 输入指令 = 编辑当前图）：
  // 图片节点在「图生图」模式下，把节点当前产物图作为编辑底图。
  if (
    nodeData.kind === "image" &&
    nodeData.params?.mode === "图生图" &&
    nodeData.status === "succeeded"
  ) {
    for (const u of nodeData.output?.urls ?? []) pushImage(u);
  }

  if (!refs.length) return out;

  // 节点 / 素材类引用：批量取节点行（asset: 前缀是「上游节点的产物」写法）
  const nodeRefIds = refs
    .filter((r) => r.type === "node" || r.type === "asset")
    .map((r) => r.id.replace(/^asset:/, ""));
  if (nodeRefIds.length) {
    const rows = await prisma.canvasNode.findMany({
      where: { id: { in: nodeRefIds } },
      select: { id: true, workflowId: true, data: true },
    });
    // 只能引用本人工作流里的节点
    const wfIds = [...new Set(rows.map((r) => r.workflowId))];
    const ownedWfs = wfIds.length
      ? await prisma.workflow.findMany({
          where: { id: { in: wfIds }, userId },
          select: { id: true },
        })
      : [];
    const ownedSet = new Set(ownedWfs.map((w) => w.id));

    for (const row of rows) {
      if (!ownedSet.has(row.workflowId)) continue;
      let ud: FlowNodeData;
      try {
        ud = JSON.parse(row.data) as FlowNodeData;
      } catch {
        continue;
      }
      if (ud.status !== "succeeded" || !ud.output) continue;
      const title = `@${ud.title}${ud.index ? ` ${ud.index}` : ""}`;
      const images = (ud.output.urls ?? []).filter(Boolean);
      images.forEach(pushImage);
      out.upstreams.push({
        nodeId: row.id,
        title,
        kind: ud.kind,
        summary: ud.output.text?.slice(0, 200) ?? images[0] ?? "",
        ...(images.length ? { urls: images } : {}),
        ...(ud.output.action ? { action: ud.output.action } : {}),
      });
    }
  }

  // 区域标记：标记图进参考图
  for (const r of refs) {
    if (r.type === "mark") pushImage(r.mark?.imageUrl);
  }

  // 角色库：设定进上下文，参考图进图生图
  const charIds = refs.filter((r) => r.type === "character").map((r) => r.id);
  if (charIds.length) {
    const chars = await prisma.character.findMany({
      where: { id: { in: charIds }, userId },
    });
    for (const c of chars) {
      out.upstreams.push({
        nodeId: `character:${c.id}`,
        title: `@角色·${c.name}`,
        kind: "text",
        summary: `角色设定：${c.name}${c.description ? `——${c.description}` : ""}。提示词中出现「@${c.name}」时即指该角色，需保持形象一致。`,
      });
      pushImage(c.imageUrl);
    }
  }

  // 模型引用：最后一个生效
  const modelRef = refs.filter((r) => r.type === "model").pop();
  if (modelRef) {
    const name = modelRef.id.replace(/^model:/, "").trim();
    if (name) out.modelOverride = name;
  }

  return out;
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
