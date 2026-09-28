import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { z } from "zod";
import { arkChat, toArkImageRef } from "@/server/providers/ark/client";
import { resolveArkModel } from "@/server/providers/ark/config";

/* ------------------------------------------------------------------ */
/* POST /api/marks/identify —— 区域标记的 AI 识别（LibTV「标记」）        */
/* 用户在图片上框选一块区域，VLM 识别该区域内容并给出简短命名，            */
/* 作为可插入提示词的标记名（如「角色的机械手臂」）。                      */
/* ------------------------------------------------------------------ */

const bodySchema = z.object({
  imageUrl: z.string().min(1),
  rect: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().gt(0).max(1),
    h: z.number().gt(0).max(1),
  }),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数不正确" }, { status: 400 });
  }
  const { imageUrl, rect } = parsed.data;

  let imageRef: string;
  try {
    imageRef = await toArkImageRef(imageUrl);
  } catch {
    return NextResponse.json({ error: "读取图片失败" }, { status: 400 });
  }

  const pct = (v: number) => Math.round(v * 100);
  const instruction = [
    `用户在图片上框选了一个矩形区域（归一化坐标：左缘 ${pct(rect.x)}%、上缘 ${pct(rect.y)}%、宽 ${pct(rect.w)}%、高 ${pct(rect.h)}%）。`,
    "请识别该框选区域内的主体内容，用 2～8 个字的简短名词短语回答（例如「红色轿车」「角色的机械手臂」「靴子」）。",
    "只输出名称本身，不要任何解释、标点或修饰；若内容不清晰，给出最可能的猜测。",
  ].join("");

  // 视觉识别走文本类模型（Doubao Seed 多模态）；可用 ARK_MODEL_VISION 覆盖
  const model = process.env.ARK_MODEL_VISION?.trim() || resolveArkModel("text", "");

  try {
    const raw = await arkChat(
      model,
      [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: imageRef } },
          ],
        },
      ],
      { maxTokens: 60, temperature: 0.2 },
    );
    // 只要短语本体：去首尾空白与可能尾随的标点
    const label = raw
      .trim()
      .replace(/[。！？.!?,，;；：:""'「」『』（）()\s]+$/g, "")
      .slice(0, 24);
    if (!label) throw new Error("empty label");
    return NextResponse.json({ label });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "识别失败";
    return NextResponse.json({ error: `标记识别失败：${msg}` }, { status: 502 });
  }
}
