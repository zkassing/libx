import type { NodeKind } from "@/types";
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

  const hit = (upstreams ?? [])
    .map((u) => u.action)
    .find((a) => a?.action_input?.trim());
  if (!hit) return { prompt, params, linked: false };

  const actionInput = hit.action_input.trim();
  const userPrompt = prompt.trim();

  // 用户已写提示词：action_input 追加为参考上下文，参数不动
  if (userPrompt) {
    return {
      prompt: `${userPrompt}\n\n参考上游：${actionInput}`,
      params,
      linked: true,
      action: hit.action,
    };
  }

  // 用户没写提示词：契约接管提示词与比例建议
  const ratio = hit.supplementary?.aspect_ratio;
  return {
    prompt: actionInput,
    params: {
      ...params,
      ...(typeof ratio === "string" && ratio.trim()
        ? { aspectRatio: ratio.trim() }
        : {}),
    },
    linked: true,
    action: hit.action,
  };
}
