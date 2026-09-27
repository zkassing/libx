import type {
  VariableValues,
  VariableType,
  WorkflowVariable,
} from "@/lib/variableTypes";

/* ------------------------------------------------------------------ */
/* 变量模板渲染（T3.5 / 9.3）                                            */
/* 把提示词里的 {{key}} 替换成实际变量值。纯函数，便于离线单测。            */
/* ------------------------------------------------------------------ */

const PLACEHOLDER = /\{\{\s*([\w.]+)\s*\}\}/g;

/** 提取模板中引用到的全部变量 key（去重、保持出现顺序） */
export function extractVariableKeys(template: string): string[] {
  const keys: string[] = [];
  for (const m of template.matchAll(PLACEHOLDER)) {
    const k = m[1];
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

export interface RenderOptions {
  /** 未提供值时如何处理：保留占位符（默认）或替换为空串 */
  missing?: "keep" | "empty";
}

/**
 * 渲染模板：
 *   renderTemplate("画面：{{subject}}", { subject: "猫" }) // → "画面：猫"
 * - 值按字符串原样替换（不做 HTML 转义，提示词纯文本）
 * - 未命中且 missing=keep 时保留 {{key}}，方便老师发现漏填
 */
export function renderTemplate(
  template: string,
  values: VariableValues,
  opts: RenderOptions = {},
): string {
  const { missing = "keep" } = opts;
  return template.replace(PLACEHOLDER, (whole, rawKey: string) => {
    const key = rawKey.trim();
    if (Object.prototype.hasOwnProperty.call(values, key) && values[key] !== "") {
      return values[key];
    }
    return missing === "empty" ? "" : whole;
  });
}

/** 找出模板引用了、但当前取值表里缺失（或为空）的 key */
export function missingVariables(
  template: string,
  values: VariableValues,
): string[] {
  return extractVariableKeys(template).filter(
    (k) => !Object.prototype.hasOwnProperty.call(values, k) || values[k] === "",
  );
}

/* ------------------------------------------------------------------ */
/* 默认值解析                                                            */
/* ------------------------------------------------------------------ */

/**
 * 计算一次运行的有效变量值：
 * - 学生已填值优先；
 * - 否则回退老师预设 default；
 * - 只返回有值的项。
 */
export function resolveVariableValues(
  defs: WorkflowVariable[],
  studentValues: VariableValues,
): VariableValues {
  const out: VariableValues = {};
  for (const v of defs) {
    const filled = studentValues[v.key];
    if (filled !== undefined && filled !== "") {
      out[v.key] = filled;
    } else if (v.default !== null && v.default !== "") {
      out[v.key] = v.default;
    }
  }
  return out;
}

/** 必填且最终无值的变量定义（运行前拦截用） */
export function findUnfilledRequired(
  defs: WorkflowVariable[],
  values: VariableValues,
): WorkflowVariable[] {
  return defs.filter((v) => {
    if (!v.required) return false;
    const filled = values[v.key];
    const effective = filled !== undefined && filled !== ""
      ? filled
      : (v.default ?? "");
    return effective === "";
  });
}

/* ------------------------------------------------------------------ */
/* 序列化辅助：Prisma Variable 行 → 领域类型                              */
/* ------------------------------------------------------------------ */

export function parseVariableType(t: string): VariableType {
  return t === "number" || t === "select" || t === "asset" ? t : "text";
}

export function parseOptions(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.map(String) : [];
  } catch {
    return [];
  }
}

/* Prisma Variable 行 → 领域类型 */

interface VariableRow {
  id: string;
  workflowId: string;
  key: string;
  label: string;
  type: string;
  default: string | null;
  options: string | null;
  required: boolean;
  source: string;
}

export function rowToVariable(row: VariableRow): WorkflowVariable {
  return {
    id: row.id,
    workflowId: row.workflowId,
    key: row.key,
    label: row.label,
    type: parseVariableType(row.type),
    default: row.default,
    options: parseOptions(row.options),
    required: row.required,
    source: row.source === "teacher" ? "teacher" : "student",
  };
}
