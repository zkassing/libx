import { NextResponse } from "next/server";
import type { Edge, Node } from "@xyflow/react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  edgeToRow,
  nodeToRow,
  rowToEdge,
  rowToNode,
} from "@/lib/workflowGraph";
import type { FlowNodeData } from "@/types";

type Ctx = { params: Promise<{ id: string }> };

/** 取工作流并校验归属，返回 workflow 或 null（不存在/非本人） */
async function ownedWorkflow(id: string, userId: string) {
  const wf = await prisma.workflow.findUnique({ where: { id } });
  if (!wf || wf.userId !== userId) return null;
  return wf;
}

/** Prisma 唯一约束冲突（P2002） */
function isUniqueError(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: unknown }).code === "P2002"
  );
}

/** GET /api/workflows/:id —— 读取工作流（含节点/边） */
export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const wf = await ownedWorkflow(id, session.user.id);
  if (!wf) {
    return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  }

  const [nodeRows, edgeRows] = await Promise.all([
    prisma.canvasNode.findMany({
      where: { workflowId: id },
      orderBy: { index: "asc" },
    }),
    prisma.canvasEdge.findMany({
      where: { workflowId: id },
      orderBy: { index: "asc" },
    }),
  ]);

  return NextResponse.json({
    workflow: {
      id: wf.id,
      title: wf.title,
      shareToken: wf.shareToken,
      updatedAt: wf.updatedAt,
    },
    nodes: nodeRows.map(rowToNode),
    edges: edgeRows.map(rowToEdge),
  });
}

/**
 * PUT /api/workflows/:id —— 全量保存图。
 * body: { title?, nodes: RFNode[], edges: RFEdge[] }
 * 一个事务内删旧 → 写新（自动防抖后调用，无需逐节点 diff）。
 */
export async function PUT(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const wf = await ownedWorkflow(id, session.user.id);
  if (!wf) {
    return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  }

  let body: {
    title?: string;
    nodes?: Node<FlowNodeData>[];
    edges?: Edge[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }
  const nodes = Array.isArray(body.nodes) ? body.nodes : [];
  const edges = Array.isArray(body.edges) ? body.edges : [];

  try {
    await prisma.$transaction([
      prisma.canvasEdge.deleteMany({ where: { workflowId: id } }),
      prisma.canvasNode.deleteMany({ where: { workflowId: id } }),
      prisma.workflow.update({
        where: { id },
        data: {
          ...(body.title?.trim() ? { title: body.title.trim() } : {}),
          nodes: {
            create: nodes.map((n, i) => nodeToRow(n, i)),
          },
          edges: {
            create: edges.map((e, i) => edgeToRow(e, i)),
          },
        },
      }),
    ]);
  } catch (e) {
    // 节点/边 id 是全局主键：若某个 id 已被**别的**工作流占用，这里会撞唯一约束。
    // 正常客户端生成的 id（kind_时间戳+随机）不会撞，但手工构造/导入的数据可能撞。
    // 不把它暴露成 500，回 409 让前端能识别并提示。
    if (isUniqueError(e)) {
      return NextResponse.json(
        { error: "节点 id 与已有数据冲突，请刷新页面后重试" },
        { status: 409 },
      );
    }
    throw e;
  }

  const updated = await prisma.workflow.findUnique({
    where: { id },
    select: { updatedAt: true },
  });
  return NextResponse.json({ ok: true, savedAt: updated?.updatedAt });
}

/** DELETE /api/workflows/:id */
export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const wf = await ownedWorkflow(id, session.user.id);
  if (!wf) {
    return NextResponse.json({ error: "工作流不存在" }, { status: 404 });
  }
  await prisma.workflow.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
