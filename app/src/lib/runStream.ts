import { useRunStore, type RunEventPayload } from "@/stores/runStore";

/* ------------------------------------------------------------------ */
/* runStream：前端运行事件订阅（封装 EventSource，T2.5）                 */
/* ------------------------------------------------------------------ */
/* runNode：POST /api/nodes/:id/run 拿到 runId 后调用 subscribeRun()，   */
/* SSE 事件直接写进 runStore。终态后自动关闭。                            */
/* 用模块级 Map 复用同一 runId 的连接，避免重复订阅；dev 热重载可清理。    */
/* ------------------------------------------------------------------ */

const connections = new Map<string, EventSource>();

/** 订阅某个 NodeRun 的事件；返回该 EventSource */
export function subscribeRun(runId: string): EventSource {
  const existing = connections.get(runId);
  if (existing) return existing;

  const es = new EventSource(`/api/runs/${runId}/events`);

  const close = () => {
    es.close();
    connections.delete(runId);
  };

  es.onmessage = (ev) => {
    let data: RunEventPayload;
    try {
      data = JSON.parse(ev.data) as RunEventPayload;
    } catch {
      return;
    }
    useRunStore.getState().apply(data);
    // 终态：服务端会关流，这里也主动关闭并清理
    if (data.type === "succeeded" || data.type === "failed") close();
  };

  es.onerror = () => {
    // EventSource 默认会自动重连；若任务已结束，浏览器重连只会再收一帧快照。
    // 这里不强制关闭，交给浏览器重连 + 终态关闭。提供一个可见的兜底状态：
    // （连续错误无法在此区分，保持简单，M3 接真实后端再细化）
  };

  connections.set(runId, es);
  return es;
}

/** 关闭并清理所有 SSE 连接（切工作流 / 卸载时调用） */
export function closeAllRunStreams() {
  for (const es of connections.values()) es.close();
  connections.clear();
}

/** 当前打开的连接数（调试用） */
export function activeStreamCount() {
  return connections.size;
}
