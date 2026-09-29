import type { NodeAction, NodeKind } from "@/types";
import type { GenUpstream } from "./types";

/* ------------------------------------------------------------------ */
/* AutoLink（对齐 LibTV 实测语义）：上游动作契约驱动下游生成             */
/* ------------------------------------------------------------------ */
/* LibTV 的文本节点产出 { action, action_input, supplementary }，下游     */
/* 图片/视频节点无需复制粘贴即可消费。我们的规则：                        */
/*                                                                       */
/* - 下游【没写提示词】→ 直接接管：用上游 action_input 作为提示词，        */
/*   并把 supplementary.aspect_ratio 带进比例参数（用户没动过手，跟随上游）*/
/* - 下游【已写提示词】→ 用户优先：保留用户提示词，action_input 追加为     */
/*   "参考"上下文；参数不动（不覆盖用户的显式选择）                        */
/* - 【多个上游契约】→ 融合：两份 action_input 都要进提示词（过去只取      */
/*   第一份，第二个文本节点的内容被丢掉，画面不融合）                       */
/* ------------------------------------------------------------------ */

export interface AutoLinkResult {
  /** 注入后的有效提示词 */
  prompt: string;
  /** 注入后的有效参数（可能带 aspectRatio 建议） */
  params?: Record<string, unknown>;
  /** 本次是否真的发生了契约注入 */
  linked: boolean;
  /** 命中的上游动作（调试用） */
  action?: string;
}

export function applyAutoLink(
  kind: NodeKind,
  prompt: string,
  params: Record<string, unknown> | undefined,
  upstreams: GenUpstream[] | undefined,
): AutoLinkResult {
  // 只有图片 / 视频节点消费动作契约（文本/音频按原链路走摘要上下文）
  if (kind !== "image" && kind !== "video") {
    return { prompt, params, linked: false };
  }

  const hits = (upstreams ?? [])
    .map((u) => u.action)
    .filter((a): a is NodeAction => !!a?.action_input?.trim());
  if (!hits.length) return { prompt, params, linked: false };

  const inputs = hits.map((h) => h.action_input.trim());
  const userPrompt = prompt.trim();

  // 多个上游契约：两份画面提示词都要体现，显式要求模型融合；
  // 单个契约：保持原样接管（不包一层，提示词更干净）
  const merged =
    inputs.length === 1
      ? inputs[0]
      : `融合创作一个画面，同时体现以下要素：\n${inputs
          .map((t, i) => `${i + 1}）${t}`)
          .join("\n")}`;

  // 用户已写提示词：契约追加为参考上下文，参数不动
  if (userPrompt) {
    const ref =
      inputs.length === 1
        ? `参考上游：${inputs[0]}`
        : `参考上游（需融合）：\n${inputs.map((t, i) => `${i + 1}）${t}`).join("\n")}`;
    return {
      prompt: `${userPrompt}\n\n${ref}`,
      params,
      linked: true,
      action: hits[0].action,
    };
  }

  // 用户没写提示词：契约接管提示词；比例建议仅在用户未显式选择时跟随（ratioLocked）
  const ratio = hits
    .map((h) => h.supplementary?.aspect_ratio)
    .find((r): r is string => typeof r === "string" && !!r.trim());
  const locked = (params as { ratioLocked?: boolean } | undefined)?.ratioLocked;
  return {
    prompt: merged,
    params: {
      ...params,
      ...(ratio && !locked ? { aspectRatio: ratio.trim() } : {}),
    },
    linked: true,
    action: hits[0].action,
  };
}
