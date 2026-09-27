import type { NodeKind } from "@/types";
import {
  mockAudioProvider,
  mockImageProvider,
  mockTextProvider,
  mockVideoProvider,
} from "./mock";
import type { GenProvider, ProviderKind } from "./types";

/* ------------------------------------------------------------------ */
/* Provider 注册表                                                     */
/* ------------------------------------------------------------------ */
/* 按“产物种类”登记 provider。M6 接真实模型时，只需把这里的 mock 替换成   */
/* arkTextProvider / seedreamImageProvider / klingVideoProvider 等，       */
/* 业务层（run API、队列、SSE）完全无感。                                */
/* ------------------------------------------------------------------ */

/** 按产物种类索引 */
export const providers: Record<ProviderKind, GenProvider> = {
  text: mockTextProvider,
  image: mockImageProvider,
  video: mockVideoProvider,
  audio: mockAudioProvider,
};

/** 节点种类 → 产物种类（script 复用文本 provider） */
const KIND_TO_PROVIDER: Record<NodeKind, ProviderKind> = {
  text: "text",
  script: "text",
  image: "image",
  video: "video",
  audio: "audio",
};

/** 按节点种类取对应 provider */
export function getProvider(nodeKind: NodeKind): GenProvider {
  return providers[KIND_TO_PROVIDER[nodeKind]];
}

/** 当前是否为 mock 环境（M6 据 env 切换真实 provider 时会变 false） */
export const usingMockProviders = true;
