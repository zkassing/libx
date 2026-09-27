import type {
  SkillCard,
  SkillCategory,
  SkillDetail,
  SkillOutputKind,
  SkillTemplate,
} from "@/lib/skillTypes";
import { SKILL_CATEGORIES } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* Skill 序列化：Prisma 行 → 对外类型                                    */
/* ------------------------------------------------------------------ */

function normalizeCategory(c: string): SkillCategory {
  return (SKILL_CATEGORIES as readonly string[]).includes(c)
    ? (c as SkillCategory)
    : "general";
}

function normalizeOutputKind(c: string): SkillOutputKind {
  return c === "image" ? "image" : "video";
}

function parseTemplate(raw: string | null): SkillTemplate | null {
  if (!raw) return null;
  try {
    const t = JSON.parse(raw) as SkillTemplate;
    if (!Array.isArray(t.nodes) || !Array.isArray(t.edges)) return null;
    return t;
  } catch {
    return null;
  }
}

/** 列表/收藏查询行（含 author name / favorited 标记） */
export interface SkillRowShape {
  id: string;
  slug: string;
  name: string;
  category: string;
  outputKind: string;
  coverUrl: string | null;
  summary: string | null;
  official: boolean;
  usageCount: number;
  author?: { name: string | null } | null;
}

export function toSkillCard(
  row: SkillRowShape,
  favorited = false,
): SkillCard {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    category: normalizeCategory(row.category),
    outputKind: normalizeOutputKind(row.outputKind),
    coverUrl: row.coverUrl,
    summary: row.summary,
    authorName: row.author?.name ?? (row.official ? "官方" : null),
    official: row.official,
    usageCount: row.usageCount,
    favorited,
  };
}

export interface SkillDetailRowShape extends SkillRowShape {
  description: string | null;
  scenes: string | null;
  howTo: string | null;
  outputs: string | null;
  template: string | null;
  authorId: string | null;
}

export function toSkillDetail(
  row: SkillDetailRowShape,
  favorited = false,
): SkillDetail {
  return {
    ...toSkillCard(row, favorited),
    description: row.description,
    scenes: row.scenes,
    howTo: row.howTo,
    outputs: row.outputs,
    template: parseTemplate(row.template),
    authorId: row.authorId,
  };
}
