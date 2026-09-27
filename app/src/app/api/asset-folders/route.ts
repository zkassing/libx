import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

/* GET/POST /api/asset-folders —— 项目资产文件夹（画布内「资产」tab） */

const createSchema = z.object({
  workflowId: z.string().min(1),
  name: z.string().min(1).max(60),
  parentId: z.string().nullable().optional(),
});

/** GET：某工作流的全部文件夹（前端自行组树） */
export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const workflowId = searchParams.get("workflowId");
  if (!workflowId) {
    return NextResponse.json({ error: "缺少 workflowId" }, { status: 400 });
  }
  const wf = await prisma.workflow.findFirst({
    where: { id: workflowId, userId: session.user.id },
  });
  if (!wf) {
    return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 403 });
  }
  const folders = await prisma.assetFolder.findMany({
    where: { workflowId },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ folders });
}

/** POST：新建文件夹 */
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
    return NextResponse.json({ error: "文件夹信息不完整" }, { status: 400 });
  }
  const { workflowId, name, parentId } = parsed.data;

  const wf = await prisma.workflow.findFirst({
    where: { id: workflowId, userId: session.user.id },
  });
  if (!wf) {
    return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 403 });
  }
  if (parentId) {
    const parent = await prisma.assetFolder.findFirst({
      where: { id: parentId, workflowId },
    });
    if (!parent) {
      return NextResponse.json({ error: "父文件夹不存在" }, { status:400 });
    }
  }

  const folder = await prisma.assetFolder.create({
    data: { workflowId, name: name.trim(), parentId: parentId ?? null },
  });
  return NextResponse.json({ ok: true, folder }, { status: 201 });
}
