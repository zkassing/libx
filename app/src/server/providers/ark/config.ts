import type { NodeKind } from "@/types";

/* ------------------------------------------------------------------ */
/* 火山方舟（ARK）配置与模型映射                                          */
/* ------------------------------------------------------------------ */

/** ARK 的 OpenAI 兼容入口（文本 / 图片 / 视频任务都在这个 v3 下） */
export const ARK_BASE_URL =
  process.env.ARK_BASE_URL ?? "https://ark.cn-beijing.volces.com/api/v3";

/** 是否已配置真实 Key（没配就走 mock，见 registry.ts） */
export function arkEnabled(): boolean {
  return !!process.env.ARK_API_KEY?.trim();
}

export function arkApiKey(): string {
  const key = process.env.ARK_API_KEY?.trim();
  if (!key) throw new Error("未配置 ARK_API_KEY");
  return key;
}

/**
 * UI 上的模型名 → ARK 真实模型 id。
 *
 * 为什么要有这一层：画布上暴露给用户的是可读的产品名（也是节点 params.model 里
 * 实际存的值），而 ARK 侧要的是 `doubao-seed-2-1-pro-260628` 这种带版本日期的 id。
 * 两者解耦后，换模型版本只需要改这张表（或用 env 覆盖），不用动画布数据。
 *
 * 左侧的旧虚构名（GVLM 3.1 / Seedance 2.5 …）是 M1 对齐 LibTV 时留下的，
 * 这里保留为别名，避免历史节点因为名字对不上而报错。
 */
const MODEL_IDS: Record<string, string> = {
  /* 文本 / 脚本 */
  "Doubao Seed 2.1 Pro": "doubao-seed-2-1-pro-260628",
  "DeepSeek V4 Pro": "deepseek-v4-pro-ga-260813",
  "GLM 5.2": "glm-5-2-260617",
  // 旧名别名（历史节点里存的就是这些）
  "GVLM 3.1": "doubao-seed-2-1-pro-260628",
  "Doubao Seed Evolving": "doubao-seed-2-1-pro-260628",
  "DeepSeek V3": "deepseek-v4-pro-ga-260813",

  /* 图片 */
  "Seedream 5.0 Pro": "doubao-seedream-5-0-pro-260628",
  "Seedream 4.0": "doubao-seedream-4-0-250828",
  // 旧名别名
  "Lib Image 2.5 Pro": "doubao-seedream-5-0-pro-260628",
  "General image Pro": "doubao-seedream-5-0-pro-260628",
  "Style Image V8.2": "doubao-seedream-5-0-pro-260628",

  /* 视频 */
  "Seedance 1.0 Pro Fast": "doubao-seedance-1-0-pro-fast-251015",
  // 旧名别名：账号只开通了 seedance-1-0-pro-fast，其余都指向它
  "Wan 2.0": "doubao-seedance-1-0-pro-fast-251015",
  "Wan 3.0 Prime": "doubao-seedance-1-0-pro-fast-251015",
  "Seedance 2.5": "doubao-seedance-1-0-pro-fast-251015",
  "Kling O3": "doubao-seedance-1-0-pro-fast-251015",
  "Minimax H3": "doubao-seedance-1-0-pro-fast-251015",
};

/** 各产物种类在「模型名缺失 / 无法识别」时的兜底模型 */
const FALLBACK_BY_KIND: Record<"text" | "image" | "video", string> = {
  text: "doubao-seed-2-1-pro-260628",
  image: "doubao-seedream-5-0-pro-260628",
  video: "doubao-seedance-1-0-pro-fast-251015",
};

/** env 覆盖，形如 ARK_MODEL_IMAGE=doubao-seedream-4-0-250828 */
function envOverride(kind: "text" | "image" | "video"): string | undefined {
  const raw =
    kind === "text"
      ? process.env.ARK_MODEL_TEXT
      : kind === "image"
        ? process.env.ARK_MODEL_IMAGE
        : process.env.ARK_MODEL_VIDEO;
  return raw?.trim() || undefined;
}

/**
 * 把画布上的模型名解析成 ARK 模型 id。
 * script 归到 text；audio 不走 ARK（本账号没开语音），调用方不应传。
 */
export function resolveArkModel(
  nodeKind: NodeKind,
  modelName?: string,
): string {
  const kind: "text" | "image" | "video" =
    nodeKind === "image" ? "image" : nodeKind === "video" ? "video" : "text";

  const override = envOverride(kind);
  if (override) return override;

  const name = modelName?.trim();
  if (name && MODEL_IDS[name]) return MODEL_IDS[name];
  // 用户直接填了真实 id（形如 doubao-xxx / deepseek-xxx）就原样用
  if (name && /^[a-z0-9][a-z0-9-]*-\d{6}$/.test(name)) return name;

  return FALLBACK_BY_KIND[kind];
}

/** 供前端 / 文档展示的可用模型清单 */
export const AVAILABLE_MODELS = {
  text: ["Doubao Seed 2.1 Pro", "DeepSeek V4 Pro", "GLM 5.2"],
  image: ["Seedream 5.0 Pro", "Seedream 4.0"],
  video: ["Seedance 1.0 Pro Fast"],
} as const;
