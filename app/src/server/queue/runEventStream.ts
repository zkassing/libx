import { prisma } from "@/lib/prisma";
import { runEventBus, type RunEvent } from "./eventBus";

/* ------------------------------------------------------------------ */
/* createRunEventStream：单个 NodeRun 的 SSE 流（T2.4）                  */
/* ------------------------------------------------------------------ */
/* 语义：                                                               */
/*   - 先订阅事件总线（不丢事件），再读 DB 快照；                          */
/*   - 连接时若任务已在跑 → 立即推一份当前进度快照；                      */
/*   - 若已是终态 → 推终态后关闭；                                       */
/*   - 之后实时推送 progress，收到终态事件后关闭；                        */
/*   - 15s 心跳防止代理超时；客户端断开则清理。                            */
/* 用「订阅 → 重读 + finished 守卫」消除订阅与快照之间的竞态，终态只发一次。*/
/* ------------------------------------------------------------------ */

const HEARTBEAT_MS = 15000;
const TERMINAL_TYPES = new Set(["succeeded", "failed"]);

function parseJSON(s: string | null) {
  if (!s) return undefined;
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
}

export function createRunEventStream(
  runId: string,
  externalSignal?: AbortSignal,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const frame = (payload: unknown) =>
    encoder.encode(`data: ${JSON.stringify(payload)}\n\n`);

  return new ReadableStream<Uint8Array>({
    start(controller) {
      let finished = false;
      let cleanupDone = false;
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // 流可能已关
        }
      }, HEARTBEAT_MS);

      const cleanup = () => {
        if (cleanupDone) return;
        cleanupDone = true;
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          // 已关闭
        }
      };

      /** 推一帧；若为终态则收尾 */
      const push = (event: RunEvent | SnapshotEvent) => {
        if (finished) return;
        try {
          controller.enqueue(frame(event));
        } catch {
          return;
        }
        if (TERMINAL_TYPES.has(event.type)) {
          finished = true;
          cleanup();
        }
      };

      // 1) 先订阅，保证不丢任何事件
      const unsub = runEventBus.subscribeRun({ runId }, (e) => push(e));

      // 2) 订阅后重读 DB，发快照（用 finished 守卫与事件路径互斥）
      void (async () => {
        const run = await prisma.nodeRun
          .findUnique({ where: { id: runId } })
          .catch(() => null);

        if (!run) {
          push({
            type: "failed",
            runId,
            nodeId: "",
            workflowId: "",
            progress: 0,
            error: "运行记录不存在",
            at: Date.now(),
            snapshot: true,
          });
          return;
        }

        if (finished) return; // 终态事件已抢先送达
        push({
          type: run.status as RunEvent["type"],
          runId,
          nodeId: run.nodeId,
          workflowId: run.workflowId,
          progress: run.progress,
          output: parseJSON(run.output),
          error: run.error ?? undefined,
          at: Date.now(),
          snapshot: true,
        });
      })();

      // 3) 客户端断开
      externalSignal?.addEventListener(
        "abort",
        () => {
          finished = true;
          cleanup();
        },
        { once: true },
      );
    },
  });
}

/** 快照帧：在实时事件之外，连接建立瞬间补一份当前状态 */
export interface SnapshotEvent extends RunEvent {
  snapshot: true;
}
