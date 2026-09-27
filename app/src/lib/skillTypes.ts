/* ------------------------------------------------------------------ */
/* Skill 领域类型（对齐 LibTV）                                          */
/* ------------------------------------------------------------------ */

/** 卡片分类（与左栏 skill 分类 tab 对应） */
export const SKILL_CATEGORIES = [
  "film",
  "ad",
  "drama",
  "anime",
  "music",
  "social",
  "general",
] as const;

export type SkillCategory = (typeof SKILL_CATEGORIES)[number];

export type SkillOutputKind = "video" | "image";

/** 列表卡片用的精简结构（不带 template 大字段） */
export interface SkillCard {
  id: string;
  slug: string;
  name: string;
  category: SkillCategory;
  outputKind: SkillOutputKind;
  coverUrl: string | null;
  summary: string | null;
  authorName: string | null;
  official: boolean;
  usageCount: number;
  favorited?: boolean;
}

/** 详情：含全部说明字段 + 模板画布 */
export interface SkillDetail extends SkillCard {
  description: string | null;
  scenes: string | null;
  howTo: string | null;
  outputs: string | null;
  template: SkillTemplate | null;
  authorId: string | null;
}

/** 模板画布（加载到画布时重映射节点 id） */
export interface SkillTemplate {
  nodes: Array<{
    _seedId: number;
    kind: string;
    title: string;
    prompt: string;
    x: number;
    y: number;
    params: Record<string, unknown>;
  }>;
  edges: Array<{ from: number; to: number }>;
}
