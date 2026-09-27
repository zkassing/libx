import type {
  VariableInput,
  VariableSource,
  VariableType,
} from "@/lib/variableTypes";

/* ------------------------------------------------------------------ */
/* 变量输入校验（T3.5 API 共用，纯函数便于单测）                          */
/* ------------------------------------------------------------------ */

/** key 仅允许字母数字下划线，且不能为空（作为 {{key}} 占位标识） */
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

const TYPES: VariableType[] = ["text", "number", "select", "asset"];
const SOURCES: VariableSource[] = ["teacher", "student"];

export interface FieldErrors {
  [field: string]: string;
}

/** 校验原始请求体，返回字段错误（空对象表示通过）与归一化后的输入 */
export function validateVariableInput(raw: unknown): {
  errors: FieldErrors;
  input?: VariableInput;
} {
  const errors: FieldErrors = {};
  if (typeof raw !== "object" || raw === null) {
    return { errors: { _: "请求体必须是对象" } };
  }
  const b = raw as Record<string, unknown>;

  const key = typeof b.key === "string" ? b.key.trim() : "";
  if (!key) errors.key = "key 不能为空";
  else if (!KEY_RE.test(key)) {
    errors.key = "key 只能含字母数字下划线，且不以数字开头";
  }

  const label = typeof b.label === "string" ? b.label.trim() : "";
  if (!label) errors.label = "显示名称不能为空";

  const type = typeof b.type === "string" ? b.type : "text";
  if (!TYPES.includes(type as VariableType)) {
    errors.type = "type 必须是 text/number/select/asset";
  }

  const source = typeof b.source === "string" ? b.source : "student";
  if (!SOURCES.includes(source as VariableSource)) {
    errors.source = "source 必须是 teacher/student";
  }

  let options: string[] = [];
  if (Array.isArray(b.options)) {
    options = b.options.map((o) => String(o).trim()).filter(Boolean);
  }
  if ((type as VariableType) === "select" && options.length === 0) {
    errors.options = "select 类型至少需要一个选项";
  }

  const def = b.default === undefined || b.default === null
    ? null
    : String(b.default);

  if (Object.keys(errors).length > 0) return { errors };

  return {
    errors: {},
    input: {
      key,
      label,
      type: type as VariableType,
      default: def,
      options,
      required: b.required === true,
      source: source as VariableSource,
    },
  };
}
