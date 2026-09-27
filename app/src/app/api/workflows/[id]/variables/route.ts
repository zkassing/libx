import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { loadOwnedWorkflow } from "@/server/access";
import {
  rowToVariable,
} from "@/server/teaching/variables";
import { validateVariableInput } from "@/server/teaching/validateVariable";

/* ------------------------------------------------------------------ */
/* /api/workflows/:id/variables                                        */
/*   GET  列出工作流全部变量                                            */
/*   POST 新建变量（同 workflowId+key 唯一，重复 → 409）                 */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const access = await loadOwnedWorkflow(id, session.user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error === 404 ? "工作流不存在" : "无权访问" },
      { status: access.error },
    );
  }

  const rows = await prisma.variable.findMany({
    where: { workflowId: id },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({ variables: rows.map(rowToVariable) });
}

export async function POST(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const access = await loadOwnedWorkflow(id, session.user.id);
  if ("error" in access) {
    return NextResponse.json(
      { error: access.error === 404 ? "工作流不存在" : "无权访问" },
      { status: access.error },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const { errors, input } = validateVariableInput(body);
  if (!input) {
    return NextResponse.json({ error: "字段校验失败", fields: errors }, { status: 400 });
  }

  const exists = await prisma.variable.findUnique({
    where: { workflowId_key: { workflowId: id, key: input.key } },
  });
  if (exists) {
    return NextResponse.json(
      { error: `变量 {{${input.key}}} 已存在` },
      { status: 409 },
    );
  }

  const row = await prisma.variable.create({
    data: {
      workflowId: id,
      key: input.key,
      label: input.label,
      type: input.type,
      default: input.default,
      options: input.options && input.options.length
        ? JSON.stringify(input.options)
        : null,
      required: input.required,
      source: input.source,
    },
  });

  return NextResponse.json({ variable: rowToVariable(row) }, { status: 201 });
}
