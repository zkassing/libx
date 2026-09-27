import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rowToVariable } from "@/server/teaching/variables";

/* ------------------------------------------------------------------ */
/* /api/workflows/:id/variables/:varId                                 */
/*   PATCH  更新变量（key 改动时仍受唯一约束）                            */
/*   DELETE 删除变量                                                    */
/* ------------------------------------------------------------------ */

type Ctx = { params: Promise<{ id: string; varId: string }> };

/** 校验：登录 + 工作流归属 + 变量确实属于该工作流 */
async function loadOwnedVariable(
  id: string,
  varId: string,
  userId: string,
): Promise<
  | { error: { status: 404 | 403; message: string } }
  | {
      row: {
        id: string;
        workflowId: string;
        key: string;
        label: string;
        type: string;
        default: string | null;
        options: string | null;
        required: boolean;
        source: string;
      };
    }
> {
  const workflow = await prisma.workflow.findUnique({ where: { id } });
  if (!workflow) return { error: { status: 404, message: "工作流不存在" } };
  if (workflow.userId !== userId) {
    return { error: { status: 403, message: "无权访问" } };
  }
  const row = await prisma.variable.findUnique({ where: { id: varId } });
  if (!row || row.workflowId !== id) {
    return { error: { status: 404, message: "变量不存在" } };
  }
  return { row };
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, varId } = await ctx.params;
  const loaded = await loadOwnedVariable(id, varId, session.user.id);
  if ("error" in loaded) {
    return NextResponse.json(
      { error: loaded.error.message },
      { status: loaded.error.status },
    );
  }
  return NextResponse.json({ variable: rowToVariable(loaded.row) });
}

export async function PATCH(req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, varId } = await ctx.params;
  const loaded = await loadOwnedVariable(id, varId, session.user.id);
  if ("error" in loaded) {
    return NextResponse.json(
      { error: loaded.error.message },
      { status: loaded.error.status },
    );
  }
  const { row } = loaded;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  // 用"合并现有值后整体校验"，保证 PATCH 只传部分字段时 select 选项等不被误判
  const merged = {
    key: body.key ?? row.key,
    label: body.label ?? row.label,
    type: body.type ?? row.type,
    default: body.default !== undefined ? body.default : row.default,
    options:
      body.options !== undefined
        ? body.options
        : (() => {
            try {
              return row.options ? JSON.parse(row.options) : [];
            } catch {
              return [];
            }
          })(),
    required: body.required !== undefined ? body.required : row.required,
    source: body.source ?? row.source,
  };

  // key 格式单独校验（复用正则口径）
  const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
  if (typeof merged.key === "string" && !KEY_RE.test(merged.key.trim())) {
    return NextResponse.json(
      { error: "key 只能含字母数字下划线，且不以数字开头" },
      { status: 400 },
    );
  }

  // key 若改动，检查同流程内唯一
  if (merged.key !== row.key) {
    const clash = await prisma.variable.findUnique({
      where: {
        workflowId_key: { workflowId: id, key: String(merged.key).trim() },
      },
    });
    if (clash) {
      return NextResponse.json(
        { error: `变量 {{${String(merged.key).trim()}}} 已存在` },
        { status: 409 },
      );
    }
  }

  const optionsArr = Array.isArray(merged.options)
    ? merged.options.map((o) => String(o).trim()).filter(Boolean)
    : [];
  if (merged.type === "select" && optionsArr.length === 0) {
    return NextResponse.json(
      { error: "select 类型至少需要一个选项" },
      { status: 400 },
    );
  }

  const updated = await prisma.variable.update({
    where: { id: varId },
    data: {
      key: String(merged.key).trim(),
      label: String(merged.label).trim(),
      type: String(merged.type),
      default:
        merged.default === null || merged.default === undefined
          ? null
          : String(merged.default),
      options: optionsArr.length ? JSON.stringify(optionsArr) : null,
      required: merged.required === true,
      source: String(merged.source),
    },
  });

  return NextResponse.json({ variable: rowToVariable(updated) });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const { id, varId } = await ctx.params;
  const loaded = await loadOwnedVariable(id, varId, session.user.id);
  if ("error" in loaded) {
    return NextResponse.json(
      { error: loaded.error.message },
      { status: loaded.error.status },
    );
  }

  await prisma.variable.delete({ where: { id: varId } });
  return NextResponse.json({ ok: true });
}
