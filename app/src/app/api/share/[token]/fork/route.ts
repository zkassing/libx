import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { forkWorkflow } from "@/server/workflow/fork";
import { findSharedWorkflow } from "@/server/workflow/share";

type Ctx = { params: Promise<{ token: string }> };

/**
 * POST /api/share/:token/fork —— 把分享的工作流复制到当前登录用户的项目下。
 * 返回新 workflow id，前端跳 /canvas/:id。
 */
export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录再复制" }, { status: 401 });
  }
  const { token } = await ctx.params;

  const wf = await findSharedWorkflow(token);
  if (!wf) {
    return NextResponse.json({ error: "分享链接不存在或已失效" }, { status: 404 });
  }

  const newId = await forkWorkflow({
    sourceId: wf.id,
    targetUserId: session.user.id,
  });
  if (!newId) {
    return NextResponse.json({ error: "复制失败" }, { status: 500 });
  }

  return NextResponse.json({ workflow: { id: newId } }, { status: 201 });
}
