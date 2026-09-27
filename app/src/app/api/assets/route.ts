import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* GET/POST /api/assets                                                */
/* 三层资产统一入口：source=generated(生成历史) | library(个人库) | project(项目资产) */
/* ------------------------------------------------------------------ */

const createSchema = z.object({
  kind: z.enum(["image", "video", "audio", "text"]),
  title: z.string().min(1).max(120),
  source: z.enum(["generated", "library", "project"]).default("library"),
  url: z.string().optional(),
  text: z.string().optional(),
  mimeType: z.string().optional(),
  size: z.number().int().nonnegative().optional(),
  workflowId: z.string().optional(),
  nodeId: z.string().optional(),
  runId: z.string().optional(),
  folderId: z.string().optional(),
  rating: z.number().int().min(0).max(5).optional(),
});

/**
 * GET：资产查询。
 * 查询参数：
 *  - source：generated | library | project（默认 library）
 *  - workflowId：项目资产时限定画布；生成历史可按画布过滤
 *  - kind：image | video | audio | text
 */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source") || "library";
  const workflowId = searchParams.get("workflowId");
  const kind = searchParams.get("kind");
  const folderParam = searchParams.get("folder"); // 项目资产：文件夹 id 或 "root"（待分类）

  const where: {
    userId: string;
    source: string;
    workflowId?: string;
    kind?: string;
    folderId?: string | null;
  } = { userId: session.user.id, source };
  if (workflowId) where.workflowId = workflowId;
  if (kind) where.kind = kind;
  if (folderParam === "root") where.folderId = null;
  else if (folderParam) where.folderId = folderParam;

  const assets = await prisma.asset.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ assets });
}

/** POST：登记一条资产（收藏 / 项目资产 / 生成历史，均可用） */
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "资产信息不完整", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const d = parsed.data;
  if (!d.url && !d.text) {
    return NextResponse.json(
      { error: "资产必须包含地址或文本内容" },
      { status: 400 },
    );
  }
  // project 资产必须带 workflowId
  if (d.source === "project" && !d.workflowId) {
    return NextResponse.json(
      { error: "项目资产必须指定 workflowId" },
      { status: 400 },
    );
  }

  // 校验归属：若带 workflowId，须属于当前用户
  if (d.workflowId) {
    const wf = await prisma.workflow.findFirst({
      where: { id: d.workflowId, userId: session.user.id },
    });
    if (!wf) {
      return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 403 });
    }
  }

  const asset = await prisma.asset.create({
    data: {
      userId: session.user.id,
      source: d.source,
      kind: d.kind,
      title: d.title.trim(),
      url: d.url,
      text: d.text,
      mimeType: d.mimeType,
      size: d.size,
      workflowId: d.workflowId,
      nodeId: d.nodeId,
      runId: d.runId,
      folderId: d.folderId,
      rating: d.rating,
    },
  });
  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
