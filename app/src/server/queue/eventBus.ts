/* ------------------------------------------------------------------ */
/* RunEventBus：节点运行的进程内事件总线                                 */
/* ------------------------------------------------------------------ */
/* 队列 worker 每次状态/进度变化都在这里广播；T2.4 的 SSE 接口订阅它把     */
/* 事件实时推给浏览器，T2.5 前端据此更新进度环。                          */
/* 用 globalThis 挂单例，避免 Next dev 热重载时重复创建、丢失订阅。        */
/* ------------------------------------------------------------------ */

export type RunEventType =
  | "queued"
  | "started"
  | "progress"
  | "cached"
  | "succeeded"
  | "failed"
  | "canceled";

export interface RunEvent {
  /** 事件类型 */
  type: RunEventType;
  /** NodeRun id */
  runId: string;
  /** 画布节点 id */
  nodeId: string;
  /** 工作流 id（前端可用来过滤当前画布） */
  workflowId: string;
  /** 进度 0–100（progress / 终态事件携带） */
  progress?: number;
  /** 成功产物（succeeded 时携带，前端可直接渲染，不必再请求一次；cached 时同样携带） */
  output?: unknown;
  /** 是否命中缓存（cached=true 时本次不扣费） */
  cached?: boolean;
  /** 失败/取消原因（failed、canceled 时携带） */
  error?: string;
  /** 事件时间戳（ms） */
  at: number;
}

type Listener = (event: RunEvent) => void;

export interface RunEventBus {
  /** 订阅全部运行事件，返回取消订阅函数 */
  subscribe(listener: Listener): () => void;
  /** 订阅特定 runId（或 nodeId）的事件 */
  subscribeRun(key: { runId?: string; nodeId?: string }, listener: Listener): () => void;
  /** 发布一个事件 */
  emit(event: RunEvent): void;
}

function createBus(): RunEventBus {
  const listeners = new Set<Listener>();

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    subscribeRun({ runId, nodeId }, listener) {
      return this.subscribe((event) => {
        if (runId && event.runId !== runId) return;
        if (nodeId && event.nodeId !== nodeId) return;
        listener(event);
      });
    },

    emit(event) {
      for (const l of listeners) {
        try {
          l(event);
        } catch {
          // 一个监听者出错不影响其他人和队列本身
        }
      }
    },
  };
}

const KEY = "__aiteachRunEventBus__";

const globalForBus = globalThis as unknown as Record<string, RunEventBus | undefined>;

export const runEventBus: RunEventBus =
  globalForBus[KEY] ?? (globalForBus[KEY] = createBus());
