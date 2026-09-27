import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProvider } from "@/server/providers/registry";
import { runQueue } from "@/server/queue/runQueue";
import { runEventBus } from "@/server/queue/eventBus";
import {
  loadOwnedNode,
  resolveUpstreams,
  resolveNodeVariables,
} from "@/server/queue/resolveRunInput";
import type { VariableValues } from "@/lib/variableTypes";

/* ------------------------------------------------------------------ */
/* POST /api/nodes/:id/run —— 运行单个画布节点                           */
/* T2.3 口径：                                                          */
/*   - 鉴权 + 归属校验；                                                  */
/*   - 上游检查“不提前拦截”——执行时再判，保证整组批量入队后能按序就绪；     */
/*   - 创建 NodeRun(queued) + 入队，立即返回 runId，不占住请求；           */
/*   - 后台 worker 限并发执行，进度/结果走事件总线（T2.4 SSE 推前端）。    */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const userId = session.user.id;
  const { id: nodeId } = await ctx.params;

  // 1) 节点归属校验（入队前必须挡掉不存在 / 非本人）
  const loaded = await loadOwnedNode(nodeId, userId);
  if ("error" in loaded) {
    return NextResponse.json({ error: loaded.error.message }, { status: loaded.error.status });
  }
  const workflowId = loaded.workflowId;

  let nodeData;
  try {
    nodeData = JSON.parse(loaded.row.data);
  } catch {
    return NextResponse.json({ error: "节点数据损坏" }, { status: 500 });
  }

  // 可选：本次运行提交的变量取值（学生填空 / 老师调试）
  let submitted: VariableValues = {};
  try {
    const b = await _req.json().catch(() => null);
    if (b && typeof b === "object" && b.variables && typeof b.variables === "object") {
      submitted = Object.fromEntries(
        Object.entries(b.variables as Record<string, unknown>).map(
          ([k, v]) => [k, String(v ?? "")],
        ),
      );
    }
  } catch {
    // 空体/非 JSON 均视为未提交变量
  }

  // 2) 估算积分 + 输入快照
  const provider = getProvider(nodeData.kind);
  // 入队时做一次上游解析仅用于快照（不用于拦截）
  const { upstreams } = await resolveUpstreams(workflowId, nodeId);
  // 入队时也解析一次变量（渲染 prompt 供 cost；拦截放到 worker 执行时）
  const vars = await resolveNodeVariables(workflowId, nodeData, submitted);
  const genInput = {
    nodeId,
    nodeKind: nodeData.kind,
    prompt: vars.prompt,
    title: nodeData.title,
    params: nodeData.params,
    upstreams,
  };
  const cost = provider.costEstimate(genInput);

  // 3) 创建 NodeRun(queued)
  const run = await prisma.nodeRun.create({
    data: {
      nodeId,
      workflowId,
      userId,
      status: "queued",
      progress: 0,
      cost,
      input: JSON.stringify({
        prompt: nodeData.prompt,
        renderedPrompt: vars.prompt,
        params: nodeData.params,
        variables: vars.values,
        upstreams: upstreams.map((u) => ({ title: u.title, kind: u.kind, summary: u.summary })),
      }),
    },
  });

  // 4) 发布 queued 事件 + 入队
  runEventBus.emit({
    type: "queued",
    runId: run.id,
    nodeId,
    workflowId,
    progress: 0,
    at: Date.now(),
  });
  runQueue.enqueue(run.id);

  return NextResponse.json({
    ok: true,
    runId: run.id,
    status: "queued",
    cost,
  });
}
