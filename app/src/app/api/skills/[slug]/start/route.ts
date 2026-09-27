import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { toSkillDetail } from "@/server/skills/skillMapper";
import { instantiateSkillTemplate } from "@/server/skills/instantiateSkill";

/* ------------------------------------------------------------------ */
/* POST /api/skills/:slug/start                                        */
/*   body: { inspiration?: string }                                    */
/* 创建一个新工作流，把 Skill 模板实例化为节点写入，返回 workflowId。     */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ slug: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }
  const userId = session.user.id;
  const { slug } = await ctx.params;

  let inspiration = "";
  try {
    const b = (await req.json().catch(() => null)) as
      | { inspiration?: unknown }
      | null;
    if (b && typeof b.inspiration === "string") {
      inspiration = b.inspiration.trim();
    }
  } catch {
    // 空体视为无灵感
  }

  const row = await prisma.skill.findUnique({
    where: { slug },
    include: { author: { select: { name: true } } },
  });
  if (!row) {
    return NextResponse.json({ error: "Skill 不存在" }, { status: 404 });
  }
  const detail = toSkillDetail(row);
  if (!detail.template) {
    return NextResponse.json({ error: "该 Skill 缺少模板" }, { status: 422 });
  }

  const { nodes, edges } = instantiateSkillTemplate(
    detail.template,
    inspiration,
  );

  // 标题：有灵感取前 14 字，否则「Skill 名」
  const title = inspiration
    ? inspiration.length > 14
      ? `${inspiration.slice(0, 14)}…`
      : inspiration
    : detail.name;

  // 事务：建工作流 + 节点 + 边
  const workflow = await prisma.$transaction(async (tx) => {
    const wf = await tx.workflow.create({
      data: { userId, title },
    });

    for (const n of nodes) {
      await tx.canvasNode.create({
        data: {
          id: n.id,
          workflowId: wf.id,
          type: n.type ?? n.data.kind,
          x: n.position.x,
          y: n.position.y,
          data: JSON.stringify(n.data),
        },
      });
    }

    for (const e of edges) {
      await tx.canvasEdge.create({
        data: {
          id: e.id,
          workflowId: wf.id,
          source: e.source,
          target: e.target,
          sourceHandle: e.sourceHandle ?? null,
          targetHandle: e.targetHandle ?? null,
        },
      });
    }

    return wf;
  });

  // 使用数 +1（不计入事务，失败不影响启动）
  await prisma.skill
    .update({ where: { id: row.id }, data: { usageCount: { increment: 1 } } })
    .catch(() => {});

  return NextResponse.json({
    ok: true,
    workflowId: workflow.id,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });
}
