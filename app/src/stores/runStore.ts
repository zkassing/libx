import { create } from "zustand";
import type { RunStatus } from "@/types";

/* ------------------------------------------------------------------ */
/* runStore：节点运行状态（合并服务端 SSE 事件，T2.5）                   */
/* ------------------------------------------------------------------ */
/* 不直接持有图，只按 nodeId 记录“这一节点最近一次运行”的状态，            */
/* canvasStore 订阅它把 status/progress/output 映射到节点 data。          */
/* 事件来源：/api/runs/:id/events（T2.4）。                              */
/* ------------------------------------------------------------------ */

/** 与服务端 RunEvent 对齐的前端形状（只挑要用的字段） */
export interface RunEventPayload {
  type: "queued" | "started" | "progress" | "cached" | "succeeded" | "failed";
  runId: string;
  nodeId: string;
  workflowId: string;
  progress?: number;
  output?: unknown;
  error?: string;
  cached?: boolean;
  snapshot?: boolean;
}

export interface NodeRunState {
  status: RunStatus;
  progress: number;
  runId?: string;
  workflowId?: string;
  output?: unknown;
  error?: string;
  cached?: boolean;
}

interface RunStore {
  /** nodeId → 最近一次运行状态 */
  nodeStatus: Record<string, NodeRunState>;

  /** 应用一条 SSE 事件 */
  apply: (e: RunEventPayload) => void;
  /** 清空指定节点（不传则全部）的运行态 */
  reset: (nodeIds?: string[]) => void;
}

/** SSE type → 节点 RunStatus */
function toStatus(type: RunEventPayload["type"]): RunStatus {
  switch (type) {
    case "queued":
      return "queued";
    case "started":
      return "running";
    case "progress":
      return "running";
    case "cached":
    case "succeeded":
      return "succeeded";
    case "failed":
      return "failed";
  }
}

export const useRunStore = create<RunStore>((set) => ({
  nodeStatus: {},

  apply: (e) => {
    const prev = useRunStore.getState().nodeStatus[e.nodeId];
    const status = toStatus(e.type);
    const next: NodeRunState = {
      status,
      // 进度：progress/终态事件携带；没有则沿用旧值，起点 0
      progress:
        e.progress ?? (status === "succeeded" ? 100 : prev?.progress ?? 0),
      runId: e.runId,
      workflowId: e.workflowId,
      cached: e.cached ?? (status === "succeeded" ? prev?.cached : undefined),
      // 成功才覆盖产物；其他阶段保留既有产物（不清空已完成的结果）
      output:
        status === "succeeded"
          ? e.output ?? prev?.output
          : status === "running" && !prev?.output
            ? undefined
            : prev?.output,
      error: status === "failed" ? e.error : undefined,
    };

    set((s) => ({
      nodeStatus: { ...s.nodeStatus, [e.nodeId]: next },
    }));
  },

  reset: (nodeIds) =>
    set((s) => {
      if (!nodeIds) return { nodeStatus: {} };
      const drop = new Set(nodeIds);
      const next = Object.fromEntries(
        Object.entries(s.nodeStatus).filter(([id]) => !drop.has(id)),
      );
      return { nodeStatus: next };
    }),
}));
