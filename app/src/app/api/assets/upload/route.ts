import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* POST /api/assets/upload —— 上传本地文件到资产库（T2.8）               */
/* ------------------------------------------------------------------ */

const MIME_TO_KIND: Record<string, string> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/svg+xml": "image",
  "image/avif": "image",
  "image/heic": "image",
  "image/heif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/aac": "audio",
  "audio/flac": "audio",
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
  }

  const kind = MIME_TO_KIND[file.type];
  if (!kind) {
    return NextResponse.json(
      { error: `不支持的文件类型：${file.type || "未知"}` },
      { status: 400 },
    );
  }

  const ext = (file.name.split(".").pop() || "bin").replace(/[^a-z0-9]/gi, "").slice(0, 6);
  const safeName = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(dir, safeName), bytes);

  const url = `/uploads/${safeName}`;
  const title = (form.get("title") as string)?.trim() || file.name || "未命名资产";

  // 上传目标：library(个人资产库，默认) | project(项目资产，需 workflowId)
  const target = (form.get("target") as string) === "project" ? "project" : "library";
  const workflowId = form.get("workflowId") as string | null;
  const folderIdRaw = form.get("folderId") as string | null;
  const folderId = folderIdRaw && folderIdRaw !== "root" ? folderIdRaw : null;
  if (target === "project") {
    if (!workflowId) {
      return NextResponse.json(
        { error: "上传为项目资产时必须提供 workflowId" },
        { status: 400 },
      );
    }
    const wf = await prisma.workflow.findFirst({
      where: { id: workflowId, userId: session.user.id },
    });
    if (!wf) {
      return NextResponse.json({ error: "工作流不存在或无权访问" }, { status: 403 });
    }
  }

  const asset = await prisma.asset.create({
    data: {
      userId: session.user.id,
      source: target,
      kind,
      title,
      url,
      mimeType: file.type,
      size: bytes.length,
      ...(target === "project" && workflowId ? { workflowId, folderId } : {}),
    },
  });

  return NextResponse.json({ ok: true, asset }, { status: 201 });
}
