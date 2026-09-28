import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/** 分享预览的公开数据结构（脱敏：只给展示用的元信息，不给提示词正文） */
export type SharePreview = {
  title: string;
  description: string | null;
  coverUrl: string | null;
  updatedAt: Date;
  authorName: string;
  /** 节点种类统计，如 { text: 3, image: 2 } */
  nodeKinds: Record<string, number>;
  nodeCount: number;
  edgeCount: number;
  /** 变量定义：让学生知道这份工作流要填什么 */
  variables: Array<{
    key: string;
    label: string;
    type: string;
    default: string | null;
    options: string[] | null;
    required: boolean;
    source: string;
  }>;
};

/** 生成一个没被占用的分享 token（16 位 hex ≈ 64bit） */
export async function uniqueShareToken(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(8).toString("hex");
    const taken = await prisma.workflow.findUnique({
      where: { shareToken: token },
      select: { id: true },
    });
    if (!taken) return token;
  }
  throw new Error("分享链接生成失败，请重试");
}

/** 按 token 取已开启分享的工作流；未开启/不存在都返回 null */
export async function findSharedWorkflow(token: string) {
  if (!token) return null;
  const wf = await prisma.workflow.findUnique({
    where: { shareToken: token },
    include: {
      variables: { orderBy: { createdAt: "asc" } },
      nodes: { select: { type: true } },
      edges: { select: { id: true } },
      user: { select: { name: true, email: true } },
    },
  });
  if (!wf || wf.visibility !== "link") return null;
  return wf;
}

/** 把工作流行整理成公开展示用结构 */
export function buildSharePreview(
  wf: NonNullable<Awaited<ReturnType<typeof findSharedWorkflow>>>,
): SharePreview {
  const nodeKinds: Record<string, number> = {};
  for (const n of wf.nodes) {
    if (n.type === "group") continue; // 分组框不算步骤
    nodeKinds[n.type] = (nodeKinds[n.type] ?? 0) + 1;
  }

  return {
    title: wf.title,
    description: wf.description,
    coverUrl: wf.coverUrl,
    updatedAt: wf.updatedAt,
    // 只暴露展示名，不回传邮箱
    authorName: wf.user.name?.trim() || "匿名老师",
    nodeKinds,
    nodeCount: Object.values(nodeKinds).reduce((a, b) => a + b, 0),
    edgeCount: wf.edges.length,
    variables: wf.variables.map((v) => ({
      key: v.key,
      label: v.label,
      type: v.type,
      default: v.default,
      options: parseOptions(v.options),
      required: v.required,
      source: v.source,
    })),
  };
}

function parseOptions(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : null;
  } catch {
    return null;
  }
}
