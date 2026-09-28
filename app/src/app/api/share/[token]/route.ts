import { NextResponse } from "next/server";
import { buildSharePreview, findSharedWorkflow } from "@/server/workflow/share";

type Ctx = { params: Promise<{ token: string }> };

/**
 * GET /api/share/:token —— 公开预览（**不需要登录**）。
 * 只返回展示用元信息（标题/封面/节点统计/变量），不吐提示词正文，
 * 想看内容就得复制到自己项目里。
 */
export async function GET(_req: Request, ctx: Ctx) {
  const { token } = await ctx.params;
  const wf = await findSharedWorkflow(token);
  if (!wf) {
    return NextResponse.json({ error: "分享链接不存在或已失效" }, { status: 404 });
  }
  return NextResponse.json({ share: buildSharePreview(wf) });
}
