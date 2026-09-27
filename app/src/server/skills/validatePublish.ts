import type {
  SkillCategory,
  SkillOutputKind,
  SkillTemplate,
} from "@/lib/skillTypes";
import { SKILL_CATEGORIES } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* 发布 Skill 输入校验（纯函数）                                          */
/* ------------------------------------------------------------------ */

export interface PublishSkillInput {
  name: string;
  category: SkillCategory;
  outputKind: SkillOutputKind;
  summary?: string;
  scenes?: string;
  howTo?: string;
  outputs?: string;
  template: SkillTemplate;
}

export interface FieldErrors {
  [field: string]: string;
}

/** 校验模板结构：≥1 节点、节点字段合法、边引用有效 */
export function validateSkillTemplate(t: unknown): t is SkillTemplate {
  if (typeof t !== "object" || t === null) return false;
  const tt = t as { nodes?: unknown; edges?: unknown };
  if (!Array.isArray(tt.nodes) || tt.nodes.length === 0) return false;
  if (!Array.isArray(tt.edges)) return false;

  const seedIds = new Set<number>();
  for (const n of tt.nodes) {
    const nn = n as {
      _seedId?: unknown; kind?: unknown; title?: unknown;
      prompt?: unknown; x?: unknown; y?: unknown;
    };
    if (typeof nn._seedId !== "number") return false;
    if (seedIds.has(nn._seedId)) return false;
    seedIds.add(nn._seedId);
    if (typeof nn.kind !== "string") return false;
    if (typeof nn.title !== "string") return false;
    if (typeof nn.prompt !== "string") return false;
    if (typeof nn.x !== "number" || typeof nn.y !== "number") return false;
  }
  for (const e of tt.edges) {
    const ee = e as { from?: unknown; to?: unknown };
    if (typeof ee.from !== "number" || typeof ee.to !== "number") return false;
    if (!seedIds.has(ee.from) || !seedIds.has(ee.to)) return false;
  }
  return true;
}

/** 校验发布请求体，返回字段错误（空对象=通过）与归一化输入 */
export function validatePublishSkill(raw: unknown): {
  errors: FieldErrors;
  input?: PublishSkillInput;
} {
  const errors: FieldErrors = {};
  if (typeof raw !== "object" || raw === null) {
    return { errors: { _: "请求体必须是对象" } };
  }
  const b = raw as Record<string, unknown>;

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) errors.name = "Skill 名称不能为空";
  else if (name.length > 30) errors.name = "名称最多 30 字";

  const category = b.category;
  if (
    typeof category !== "string" ||
    !(SKILL_CATEGORIES as readonly string[]).includes(category)
  ) {
    errors.category = "分类不合法";
  }

  const outputKind = b.outputKind === "image" ? "image" : "video";

  const str = (v: unknown) =>
    typeof v === "string" ? v.trim() : undefined;

  if (!validateSkillTemplate(b.template)) {
    errors.template = "模板无效：至少需要一个节点，且连线引用有效";
  }

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors: {},
    input: {
      name,
      category: category as SkillCategory,
      outputKind,
      summary: str(b.summary),
      scenes: str(b.scenes),
      howTo: str(b.howTo),
      outputs: str(b.outputs),
      template: b.template as SkillTemplate,
    },
  };
}
