import type { NodeKind } from "@/types";
import {
  mockAudioProvider,
  mockImageProvider,
  mockTextProvider,
  mockVideoProvider,
} from "./mock";
import { arkImageProvider, arkTextProvider, arkVideoProvider } from "./ark";
import { arkEnabled } from "./ark/config";
import type { GenProvider, ProviderKind } from "./types";

/* ------------------------------------------------------------------ */
/* Provider 注册表                                                     */
/* ------------------------------------------------------------------ */
/* 按“产物种类”登记 provider，业务层（run API、队列、SSE）完全无感。      */
/*                                                                     */
/* 真实/模拟按 env 选择：                                                */
/*   配了 ARK_API_KEY → 文本/图片/视频走火山方舟真实模型                    */
/*   没配             → 回落 mock（本地开发 / CI 不需要花额度）             */
/*   FORCE_MOCK_PROVIDERS=1 → 强制 mock，不看 Key                       */
/*                                                                     */
/* ⚠️ 这里是**惰性求值**（每次调用现算），不能在模块顶层算好常量。          */
/*    原因：Prisma Client 在首次 import 时会自动读 .env，而脚本/服务的     */
/*    import 顺序不固定。若在模块加载时就把选择结果固定下来，会出现        */
/*    "先被 import 到就先定死 mock" 这类跟 import 顺序耦合的诡异行为。      */
/*                                                                     */
/* **音频仍为 mock**：豆包语音合成（TTS）不在方舟 v3 接口里，走的是         */
/* openspeech.bytedance.com，需要另外的 appid + access token，属独立授权。  */
/* ------------------------------------------------------------------ */

/** 是否使用真实厂商（惰性：每次调用现算） */
function realProvidersEnabled(): boolean {
  if (process.env.FORCE_MOCK_PROVIDERS === "1") return false;
  return arkEnabled();
}

/** 节点种类 → 产物种类（script 复用文本 provider） */
const KIND_TO_PROVIDER: Record<NodeKind, ProviderKind> = {
  text: "text",
  script: "text",
  image: "image",
  video: "video",
  audio: "audio",
};

/** 当前的 provider 表（惰性构造） */
export function getProviders(): Record<ProviderKind, GenProvider> {
  const real = realProvidersEnabled();
  return {
    text: real ? arkTextProvider : mockTextProvider,
    image: real ? arkImageProvider : mockImageProvider,
    video: real ? arkVideoProvider : mockVideoProvider,
    // 音频没有真实实现（见文件头说明），与是否配了 ARK Key 无关
    audio: mockAudioProvider,
  };
}

/** 按节点种类取对应 provider */
export function getProvider(nodeKind: NodeKind): GenProvider {
  return getProviders()[KIND_TO_PROVIDER[nodeKind]];
}

/** 各产物种类当前走的是真实厂商还是 mock */
export function providerStatus(): Record<ProviderKind, "ark" | "mock"> {
  const real = realProvidersEnabled() ? "ark" : "mock";
  return { text: real, image: real, video: real, audio: "mock" };
}

/** 任意一种产物走了真实厂商就为 false（用于 UI 上的"演示模式"提示） */
export function usingMockProviders(): boolean {
  return !realProvidersEnabled();
}
