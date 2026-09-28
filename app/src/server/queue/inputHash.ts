import { createHash } from "node:crypto";

/* ------------------------------------------------------------------ */
/* 输入哈希缓存（T2.9）                                                 */
/* ------------------------------------------------------------------ */
/* 同一节点、同样的提示词/参数/上游 → 生成同样的哈希。命中缓存则直接复用     */
/* 上次产物，cost=0、不重复耗时（教学场景里学生重复点运行尤其常见）。        */
/* ------------------------------------------------------------------ */

export interface CacheableInput {
  nodeKind: string;
  prompt: string;
  params?: Record<string, unknown>;
  /** 上游摘要（只取稳定字段，避免随机 id 影响命中） */
  upstreams?: Array<{ kind: string; summary: string }>;
  /** `@引用`（type+id 即可定位内容） */
  refs?: Array<{ type: string; id: string }>;
  /** 参考图地址列表 */
  referenceImages?: string[];
}

/** 稳定序列化：key 排序，去掉序列化里字段顺序的影响 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

/** 计算输入的 sha256 哈希（hex） */
export function hashInput(input: CacheableInput): string {
  const canonical = stableStringify({
    nodeKind: input.nodeKind,
    prompt: input.prompt,
    params: input.params ?? {},
    upstreams: (input.upstreams ?? []).map((u) => ({ kind: u.kind, summary: u.summary })),
    refs: (input.refs ?? []).map((r) => ({ type: r.type, id: r.id })),
    referenceImages: input.referenceImages ?? [],
  });
  return createHash("sha256").update(canonical).digest("hex");
}
