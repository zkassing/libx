import type { NodeKind } from "@/types";

/* ------------------------------------------------------------------ */
/* GenProvider：统一的“生成能力”抽象                                    */
/* ------------------------------------------------------------------ */
/* 无论底层是 Mock 还是真实厂商（豆包 / 即梦 / 可灵 …），都实现同一个     */
/* 接口。调用方（运行 API、队列）只面向接口编程，M6 接真实模型时只新增     */
/* provider 实现并在 registry 切换，业务层不用改。                        */
/* ------------------------------------------------------------------ */

/** provider 能产出的种类（与节点种类对应，script 归到 text 类产物） */
export type ProviderKind = "text" | "image" | "video" | "audio";

/** 生成任务的运行状态 */
export type GenStatus = "running" | "succeeded" | "failed";

/** 上游产物：生成时作为参考 / 上下文隐式注入 */
export interface GenUpstream {
  /** 上游节点 id */
  nodeId: string;
  /** 上游节点展示名，如“文本节点 1” */
  title: string;
  kind: NodeKind;
  /** 上游产物的可读摘要 */
  summary: string;
  /**
   * 上游产物的媒体地址（仅 image/video/audio 类上游有值）。
   * 真实厂商做「图生视频」时需要拿到真实图片地址当首帧，光有文字摘要不够。
   */
  urls?: string[];
}

/** 一次生成调用的输入 */
export interface GenInput {
  /** 触发运行的节点 id */
  nodeId: string;
  /** 节点种类 */
  nodeKind: NodeKind;
  /** 用户提示词（无提示词时用节点标题兜底） */
  prompt: string;
  title: string;
  /** 节点参数（比例 / 分辨率 / 时长 / 数量等） */
  params?: Record<string, unknown>;
  /** 直接上游的产物（已就绪） */
  upstreams?: GenUpstream[];
}

/** 生成结果（成功时） */
export interface GenResult {
  kind: NodeKind;
  /** 文本 / 脚本类产物 */
  text?: string;
  /** 图片 / 视频 / 音频类产物地址 */
  urls?: string[];
  /** 结构化分镜（text/script 产出） */
  shots?: import("@/types").Shot[];
}

/** 运行上下文 */
export interface GenContext {
  /** 本次运行记录 id */
  runId: string;
  /** 进度回调：0–100 */
  onProgress?: (progress: number) => void;
  /** 用于中止生成的信号（M2 队列暂不使用，预留） */
  signal?: AbortSignal;
}

/**
 * 生成能力接口。
 *
 * 设计上采用「一次性异步生成 + 进度回调」而不是文档最初设想的 submit/poll：
 *  - Mock 实现内部用定时器模拟耗时与进度；
 *  - 接真实厂商时，在 generate 内部包 submit + 轮询即可，对外仍是一个 Promise，
 *    调用方（API / 队列 / SSE）逻辑更简单，也更易在自测脚本里直接 await。
 */
export interface GenProvider {
  /** provider 名，如 "mock-text"，用于日志与排查 */
  readonly name: string;
  /** 能处理的产物种类 */
  readonly kind: ProviderKind;
  /** 该 provider 能处理的节点种类（script 与 text 共用文本 provider） */
  readonly handles: readonly NodeKind[];
  /** 估算本次生成消耗的积分（M2 Mock 返回固定估值，M6 接真实计费） */
  costEstimate(input: GenInput): number;
  /** 执行生成，成功 resolve 结果，失败 reject */
  generate(input: GenInput, ctx: GenContext): Promise<GenResult>;
}
