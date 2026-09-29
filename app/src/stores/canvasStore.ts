"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { NODE_META } from "@/lib/nodeTypes";
import { checkConnection } from "@/lib/connections";
import { createDebouncedLocalStorage } from "@/lib/debouncedStorage";
import { autoLayoutNodes } from "@/lib/layout";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { useRunStore } from "@/stores/runStore";
import { subscribeRun, closeAllRunStreams } from "@/lib/runStream";
import {
  NODE_SIZE,
  flowNodeSize,
  type FlowNodeData,
  type NodeKind,
} from "@/types";

/** 画布持久化：合并高频写入，拖拽时不再每帧写盘 */
const canvasPersistence = createDebouncedLocalStorage(400);

/** 历史栈上限（快照式，节点对象是 immutable 更新所以结构共享，内存开销可控） */
const HISTORY_MAX = 60;

interface GraphSnapshot {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
}

/** 历史栈里的一条：快照 + 操作名 + 时间（历史面板要展示） */
interface HistoryEntry extends GraphSnapshot {
  label: string;
  at: number;
}

/** 操作名的中文文案 */
export const HISTORY_LABEL_TEXT: Record<string, string> = {
  "add-node": "添加节点",
  duplicate: "复制节点",
  "delete-node": "删除节点",
  "delete-edge": "删除连线",
  connect: "连接节点",
  move: "移动节点",
  resize: "调整大小",
  "edit-node": "编辑内容",
  params: "修改参数",
  group: "打组",
  ungroup: "解组",
  layout: "一键整理",
  "append-graph": "从工具箱载入",
  reuse: "复用产物",
  clear: "清空画布",
};

/** 清掉选中态，避免恢复后残留高亮 */
function restoreGraph(snap: GraphSnapshot): GraphSnapshot {
  return {
    nodes: snap.nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
    edges: snap.edges,
  };
}

const uid = (p = "n") =>
  `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* ---- 云端保存防抖（模块级单定时器，合并连续编辑） ---- */
const CLOUD_SAVE_DELAY = 1200;
let cloudSaveTimer: ReturnType<typeof setTimeout> | null = null;
/** 页面隐藏 / 卸载前可 await 的在途保存 */
let inFlightSave: Promise<void> | null = null;
/** 有本地编辑尚未成功写到云端（运行前据此决定是否先落库，失败保持 true 以便重试） */
let cloudSaveDirty = false;

/** 本次会话已提交入队的节点 id：runNode 自动带上游时防同轮重复提交，
 *  SSE 终态（succeeded/failed/canceled）到达时由桥接清除，之后允许再次运行。 */
const submittedNodeRuns = new Set<string>();

function scheduleCloudSave(delay = CLOUD_SAVE_DELAY) {
  if (cloudSaveTimer) clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(() => {
    cloudSaveTimer = null;
    // 动态读取最新 store（避免循环依赖：store 已在此文件内创建）
    inFlightSave = useCanvasStore.getState().saveToCloud();
    void inFlightSave.finally(() => {
      inFlightSave = null;
    });
  }, delay);
}

/** 立刻取消待写并把在途保存跑完（pagehide / beforeunload / 节点运行前用） */
async function flushPendingCloudSave() {
  if (cloudSaveTimer) {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = null;
  }
  if (cloudSaveDirty) {
    await useCanvasStore.getState().saveToCloud();
  }
  if (inFlightSave) await inFlightSave;
}

export interface CanvasState {
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  /** 正在从哪个节点拉连线（用于目标卡片的 3D 反馈） */
  connectingFrom: string | null;
  /** 最近一次连线被拒的原因（画布上浮层提示，不持久化） */
  connectionError: string | null;
  hydrated: boolean;
  /**
   * 是否正在进行高频交互（拖拽节点 / 平移画布）。
   * true 时暂停一切非必要工作：CSS 动画、云签名计算、MiniMap 重绘等，
   * 把主线程让给拖拽，保证跟手。
   */
  interacting: boolean;
  setInteracting: (v: boolean) => void;

  /* ---- 撤销 / 重做 ---- */
  /** 快照栈（“某次编辑之前”的状态） */
  past: HistoryEntry[];
  /** 重做栈 */
  future: HistoryEntry[];
  /** > 0 时暂停记录历史（生成、SSE 等运行态更新不进历史栈） */
  historyPause: number;
  /** 上一次记录（用于合并连续操作：拖拽、连续输入） */
  lastHistory: { label: string; at: number } | null;

  /**
   * 记录一个还原点。
   * @param label    操作标签，相同标签在 coalesceMs 内只记一条
   * @param coalesceMs 合并窗口（拖拽 700、连续输入 800 之类）
   */
  pushHistory: (label: string, coalesceMs?: number) => void;
  undo: () => void;
  redo: () => void;
  /** 暂停/恢复历史记录（引用计数，支持嵌套） */
  beginHistoryPause: () => void;
  endHistoryPause: () => void;
  /** 跳到历史栈中的第 index 条（0 = 最早）之前的某个状态 */
  jumpHistory: (index: number) => void;

  onNodesChange: (changes: NodeChange<Node<FlowNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;

  addNode: (kind: NodeKind, position: { x: number; y: number }) => string;
  updateNodeData: (id: string, patch: Partial<FlowNodeData>) => void;
  removeEdges: (edgeIds: string[]) => void;
  updateNodeParams: (id: string, patch: Record<string, unknown>) => void;
  /** 拖拽右下角调整卡片尺寸（目前仅文本节点暴露手柄） */
  resizeNode: (id: string, size: { w: number; h: number }) => void;
  removeNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  setSelected: (id: string | null) => void;
  setConnectingFrom: (id: string | null) => void;
  setConnectionError: (msg: string | null) => void;

  groupSelected: () => string | null;
  ungroupSelected: () => void;
  runNode: (id: string) => Promise<void>;
  /** 单跑（不带上游）：供 runNode/runAll 内部调度；已在跑/已提交则跳过 */
  runSingle: (id: string) => Promise<void>;
  /** 取消某节点最近一次排队/执行中的运行（发送按钮的停止态） */
  cancelNode: (id: string) => Promise<void>;
  runAll: () => Promise<void>;
  /** 一键整理：按拓扑分层重排节点位置 */
  autoLayout: () => void;
  /** 追加一段图（如“从工具箱发送到画布”），可撤销 */
  appendGraph: (nodes: Node<FlowNodeData>[], edges: Edge[]) => void;
  clearCanvas: () => void;

  /* ---- M2：云端同步 ---- */
  /** 当前工作流 id */
  workflowId: string | null;
  /** 云端加载 / 保存状态机 */
  cloudStatus: "idle" | "loading" | "ready" | "saving" | "saved" | "error";
  cloudError: string | null;
  /** 最近一次云端保存时间 */
  savedAt: string | null;
  /** 绑定工作流并从云端加载（之后以云端为主） */
  bindWorkflow: (workflowId: string) => Promise<void>;
  /** 立即把当前图 PUT 到云端（正常由防抖自动调用） */
  saveToCloud: () => Promise<void>;
  /**
   * 取消待写防抖并立即 PUT（新增节点后需立刻 run 时先 await，
   * 否则后端还没有新节点会 404）。
   */
  flushCloudSave: () => Promise<void>;
  /** 请求一次防抖保存（编辑后调用，合并连续改动） */
  requestCloudSave: () => void;
}

export const useCanvasStore = create<CanvasState>()(
  persist(
    (set, get) => ({
      nodes: [],
      edges: [],
      selectedNodeId: null,
      connectingFrom: null,
      connectionError: null,
      hydrated: false,
      interacting: false,
      setInteracting: (v) => {
        if (get().interacting !== v) set({ interacting: v });
      },
      past: [],
      future: [],
      historyPause: 0,
      lastHistory: null,

      // M2 云端同步
      workflowId: null,
      cloudStatus: "idle",
      cloudError: null,
      savedAt: null,

      onNodesChange: (changes) => {
        const types = new Set(changes.map((c) => c.type));
        // 删除立即记一条；拖动坐标合并成一条（一次拖拽 = 一个还原点）
        if (types.has("remove")) get().pushHistory("delete-node", 300);
        else if (types.has("position")) get().pushHistory("move", 700);

        set((s) => {
          const nodes = applyNodeChanges(changes, s.nodes);
          const selected = nodes.find((n) => n.selected);
          if (selected && selected.id !== s.selectedNodeId) {
            return { nodes, selectedNodeId: selected.id };
          }
          if (!selected && changes.some((c) => c.type === "select")) {
            return { nodes, selectedNodeId: null };
          }
          return { nodes };
        });
      },

      onEdgesChange: (changes) => {
        if (changes.some((c) => c.type === "remove")) {
          get().pushHistory("delete-edge", 300);
        }
        set((s) => ({ edges: applyEdgeChanges(changes, s.edges) }));
      },

      /** 主动删除指定边（供上游引用块的 × 使用，走历史记录） */
      removeEdges: (edgeIds) => {
        if (edgeIds.length === 0) return;
        get().pushHistory("delete-edge", 300);
        set((s) => ({
          edges: s.edges.filter((e) => !edgeIds.includes(e.id)),
        }));
      },

      /** 连线：只防自连/重复，不限制类型、不拦环（对齐 LibTV） */
      onConnect: (c) => {
        if (!c.source || !c.target) return;
        const s = get();
        const source = s.nodes.find((n) => n.id === c.source);
        const target = s.nodes.find((n) => n.id === c.target);
        if (!source || !target) return;
        if (source.type === "group" || target.type === "group") return;

        const verdict = checkConnection(
          { id: source.id, kind: source.data.kind },
          { id: target.id, kind: target.data.kind },
          s.edges,
        );
        if (!verdict.ok) {
          set({ connectionError: verdict.reason ?? "这条连线不合法" });
          return;
        }

        get().pushHistory("connect");
        set({
          connectionError: null,
          edges: addEdge({ ...c, type: "flow", animated: false }, s.edges),
        });
      },

      addNode: (kind, position) => {
        const meta = NODE_META[kind];
        const id = uid(kind);
        get().pushHistory("add-node");
        const index =
          get().nodes.filter((n) => n.data?.kind === kind).length + 1;
        // 尺寸按真实渲染尺寸给（图片/视频随画幅比例），
        // 直接给 measured，避免 React Flow 因未测量而不渲染连接线
        const dims = flowNodeSize(kind, meta.defaults.aspectRatio);
        const node: Node<FlowNodeData> = {
          id,
          type: kind,
          position,
          selected: true,
          measured: { width: dims.w, height: dims.h },
          data: {
            kind,
            title: `${meta.label}节点`,
            index,
            prompt: "",
            params: { ...meta.defaults },
            status: "idle",
            progress: 0,
          },
          style: {
            width: dims.w,
            height: dims.h,
          },
        };
        set((s) => ({
          nodes: [...s.nodes.map((n) => ({ ...n, selected: false })), node],
          selectedNodeId: id,
        }));
        return id;
      },

      updateNodeData: (id, patch) => {
        // 连续输入（提示词）合并成一个还原点
        get().pushHistory("edit-node", 800);
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, ...patch } } : n,
          ),
        }));
        // 数据级改动不改变节点数量 / id，底部的签名订阅探测不到，这里显式请求保存。
        // （漏掉它的后果：提示词只存在本地，运行时服务端从 DB 读到旧/空 prompt）
        get().requestCloudSave();
      },

      updateNodeParams: (id, patch) => {
        get().pushHistory("params", 800);
        set((s) => ({
          nodes: s.nodes.map((n) => {
            if (n.id !== id) return n;
            const params = { ...n.data.params, ...patch };
            // 图片/视频切画幅比例 → 卡片尺寸跟着变，style/measured 必须同步，
            // 否则连线锚点与包围盒还按旧尺寸算
            const resized =
              (n.data.kind === "image" || n.data.kind === "video") &&
              patch.aspectRatio
                ? flowNodeSize(n.data.kind, params.aspectRatio)
                : null;
            return {
              ...n,
              ...(resized
                ? {
                    style: { ...n.style, width: resized.w, height: resized.h },
                    measured: { width: resized.w, height: resized.h },
                  }
                : {}),
              data: { ...n.data, params },
            };
          }),
        }));
        // 同 updateNodeData：参数是数据级改动，签名订阅探测不到，显式请求保存
        get().requestCloudSave();
      },

      resizeNode: (id, size) => {
        // 一次拖拽合并成一个还原点
        get().pushHistory("resize", 700);
        const dims = flowNodeSize("text", undefined, size);
        const totalW = dims.w;
        const totalH = dims.h;
        set((s) => ({
          nodes: s.nodes.map((n) =>
            n.id === id
              ? {
                  ...n,
                  // 同步 style / measured：React Flow 以此算连线锚点与打组包围盒
                  style: { ...n.style, width: totalW, height: totalH },
                  measured: { width: totalW, height: totalH },
                  data: { ...n.data, size },
                }
              : n,
          ),
        }));
        // 数据级改动不改变节点数量 / id，底部的签名订阅探测不到，这里显式请求保存
        get().requestCloudSave();
      },

      removeNode: (id) => {
        get().pushHistory("delete-node", 300);
        set((s) => ({
          nodes: s.nodes
            .filter((n) => n.id !== id)
            .map((n) => (n.parentId === id ? { ...n, parentId: undefined } : n)),
          edges: s.edges.filter((e) => e.source !== id && e.target !== id),
          selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
        }));
      },

      duplicateNode: (id) => {
        const src = get().nodes.find((n) => n.id === id);
        if (!src) return;
        const nid = uid(src.data.kind);
        get().pushHistory("duplicate");
        // 按源节点的画幅比例 / 自定义尺寸重算（图片/视频的 NODE_SIZE 与渲染尺寸不同）
        const dims = flowNodeSize(
          src.data.kind,
          src.data.params?.aspectRatio,
          src.data.kind === "text" ? src.data.size : undefined,
        );
        set((s) => ({
          nodes: [
            ...s.nodes.map((n) => ({ ...n, selected: false })),
            {
              ...src,
              id: nid,
              selected: true,
              parentId: undefined,
              zIndex: undefined,
              measured: { width: dims.w, height: dims.h },
              style: { ...src.style, width: dims.w, height: dims.h },
              position: { x: src.position.x + 48, y: src.position.y + 48 },
              data: {
                ...src.data,
                status: "idle",
                progress: 0,
                output: undefined,
              },
            },
          ],
          selectedNodeId: nid,
        }));
      },

      setSelected: (id) => set({ selectedNodeId: id }),
      setConnectingFrom: (id) => set({ connectingFrom: id }),
      setConnectionError: (msg) => set({ connectionError: msg }),

      /** 打组：创建 group 节点，把选中节点挂为子节点 */
      groupSelected: () => {
        const s = get();
        const children = s.nodes.filter((n) => n.selected && n.type !== "group");
        if (children.length < 2) return null;
        get().pushHistory("group");

        const pad = 32;
        const minX = Math.min(...children.map((n) => n.position.x));
        const minY = Math.min(...children.map((n) => n.position.y));
        // 包围盒用实测尺寸（图片/视频、调过大小的文本节点与 NODE_SIZE 不一致）
        const maxX = Math.max(
          ...children.map(
            (n) =>
              n.position.x +
              (n.measured?.width ?? NODE_SIZE[n.data.kind]?.w ?? 360),
          ),
        );
        const maxY = Math.max(
          ...children.map(
            (n) =>
              n.position.y +
              (n.measured?.height ?? NODE_SIZE[n.data.kind]?.h ?? 240),
          ),
        );

        const gid = uid("group");
        const groupNode: Node<FlowNodeData> = {
          id: gid,
          type: "group",
          position: { x: minX - pad, y: minY - pad - 30 },
          data: {
            kind: "text",
            title: "分组",
            prompt: "",
            params: {},
            status: "idle",
            progress: 0,
          },
          style: {
            width: maxX - minX + pad * 2,
            height: maxY - minY + pad * 2 + 30,
          },
          zIndex: 0,
        };

        const childIds = new Set(children.map((c) => c.id));
        const nextNodes: Node<FlowNodeData>[] = [
          groupNode,
          ...s.nodes.map((n) => {
            if (!childIds.has(n.id)) return n;
            const sameParent = n.parentId === gid;
            return {
              ...n,
              parentId: gid,
              extent: "parent" as const,
              selected: false,
              zIndex: 10,
              position: sameParent
                ? n.position
                : {
                    x: n.position.x - groupNode.position.x,
                    y: n.position.y - groupNode.position.y,
                  },
            };
          }),
        ];

        set({ nodes: nextNodes, selectedNodeId: gid });
        return gid;
      },

      /** 解组：删除 group，把子节点还原为绝对坐标 */
      ungroupSelected: () => {
        const s = get();
        const group = s.nodes.find((n) => n.type === "group" && n.selected);
        if (!group) return;
        get().pushHistory("ungroup");
        const next = s.nodes
          .filter((n) => n.id !== group.id)
          .map((n) =>
            n.parentId === group.id
              ? {
                  ...n,
                  parentId: undefined,
                  extent: undefined,
                  zIndex: undefined,
                  position: {
                    x: n.position.x + group.position.x,
                    y: n.position.y + group.position.y,
                  },
                }
              : n,
          );
        set({ nodes: next, selectedNodeId: null });
      },

      /** M1：客户端模拟运行（M2 换成 API + SSE 流式） */
      runNode: async (id) => {
        const s = get();
        if (!s.nodes.some((n) => n.id === id)) return;

        /* 对齐 LibTV：点下游运行 = 「运行到此处」。
           把未就绪的上游（含间接上游）按拓扑序先提交入队，再跑自己；
           服务端队列会等上游出产物后才执行下游（见 runQueue 等待循环）。 */
        const upstreamIds = new Set<string>();
        const bfs = [id];
        while (bfs.length) {
          const cur = bfs.shift()!;
          for (const e of s.edges) {
            if (e.target !== cur || upstreamIds.has(e.source)) continue;
            upstreamIds.add(e.source);
            bfs.push(e.source);
          }
        }
        // 子图 Kahn 拓扑：入度 0（最深处）先跑
        const indeg = new Map<string, number>();
        const out = new Map<string, string[]>();
        upstreamIds.forEach((n) => indeg.set(n, 0));
        for (const e of s.edges) {
          if (!upstreamIds.has(e.source) || !upstreamIds.has(e.target)) continue;
          indeg.set(e.target, (indeg.get(e.target) ?? 0) + 1);
          out.set(e.source, [...(out.get(e.source) ?? []), e.target]);
        }
        const ready = [...upstreamIds].filter((n) => (indeg.get(n) ?? 0) === 0);
        const ordered: string[] = [];
        while (ready.length) {
          const cur = ready.shift()!;
          ordered.push(cur);
          for (const nxt of out.get(cur) ?? []) {
            const d = (indeg.get(nxt) ?? 0) - 1;
            indeg.set(nxt, d);
            if (d === 0) ready.push(nxt);
          }
        }
        // 未就绪（非 succeeded）的上游先跑；succeeded 的交给服务端 hash 幂等
        for (const upId of ordered) {
          const up = s.nodes.find((n) => n.id === upId);
          if (up && (up.data as FlowNodeData).status !== "succeeded") {
            await get().runSingle(upId);
          }
        }
        await get().runSingle(id);
      },

      runSingle: async (id) => {
        const exists = get().nodes.some((n) => n.id === id);
        if (!exists) return;
        // 防重：本次调度已提交过 / 节点正在跑（内存态）→ 跳过
        if (submittedNodeRuns.has(id)) return;
        const inMemory = get().nodes.find((n) => n.id === id)
          ?.data as FlowNodeData | undefined;
        if (inMemory?.status === "running" || inMemory?.status === "queued") return;

        // 关键：先把在途的编辑（提示词/参数）落库再入队。
        // 服务端是从 DB 读节点数据的，不 flush 就会拿旧 prompt 去生成。
        await flushPendingCloudSave();

        // 生成过程中的 status/progress/output 不进历史栈（撤销不应回退产物）
        get().beginHistoryPause();
        try {
          const res = await fetch(`/api/nodes/${id}/run`, { method: "POST" });
          let j: { runId?: string; error?: string };
          try {
            j = await res.json();
          } catch {
            set({ connectionError: "运行请求失败，请稍后重试" });
            return;
          }

          // 上游未就绪 / 无权限等业务错误（409/403/404）：展示并中止
          if (!res.ok || !j.runId) {
            set({ connectionError: j.error ?? "运行失败" });
            return;
          }

          // 成功入队 → 订阅 SSE，节点状态由 runStore → 本 store 驱动
          submittedNodeRuns.add(id);
          subscribeRun(j.runId);
        } finally {
          // 历史暂停稍后由“终态到达”解除；这里不能立即 end，否则进度会进历史。
          // 终态同步 effect 中统一 endHistoryPause。
        }
      },

      cancelNode: async (id) => {
        // runId 由 SSE 订阅时记入 runStore；没有说明这个节点最近没在跑
        const runId = useRunStore.getState().nodeStatus[id]?.runId;
        if (!runId) return;
        try {
          const res = await fetch(`/api/runs/${runId}/cancel`, { method: "POST" });
          if (!res.ok && res.status !== 409) {
            set({ connectionError: "取消失败，请重试" });
          }
          // 成功/409（已结束）都不动本地状态：终态由 SSE canceled/快照统一回填
        } catch {
          set({ connectionError: "取消失败，请重试" });
        }
      },

      /** 整组/全部执行：按入度简单拓扑排序后依次运行 */
      runAll: async () => {
        const s = get();
        const selectedGroup = s.nodes.find(
          (n) => n.type === "group" && n.selected,
        );
        const targets = s.nodes
          .filter((n) => n.type !== "group")
          .filter((n) => (selectedGroup ? n.parentId === selectedGroup.id : true));

        /**
         * Kahn 拓扑排序：只算目标集合内部的边。
         * （必须真拓扑，不能只按入度排序，否则有环或同入度时会在“上游还没产物”时误拦下游）
         */
        const targetIds = new Set(targets.map((n) => n.id));
        const indegree = new Map<string, number>();
        const outgoing = new Map<string, string[]>();
        targets.forEach((n) => indegree.set(n.id, 0));
        s.edges.forEach((e) => {
          if (!targetIds.has(e.target) || !targetIds.has(e.source)) return;
          indegree.set(e.target, (indegree.get(e.target) ?? 0) + 1);
          outgoing.set(e.source, [...(outgoing.get(e.source) ?? []), e.target]);
        });

        const ordered: typeof targets = [];
        const queue = targets.filter((n) => (indegree.get(n.id) ?? 0) === 0);
        while (queue.length) {
          const n = queue.shift()!;
          ordered.push(n);
          for (const next of outgoing.get(n.id) ?? []) {
            const d = (indegree.get(next) ?? 0) - 1;
            indegree.set(next, d);
            if (d === 0) {
              const node = targets.find((t) => t.id === next);
              if (node) queue.push(node);
            }
          }
        }

        // 有环：Kahn 排不完 → 提示而不是静默漏跑
        if (ordered.length !== targets.length) {
          set({
            connectionError:
              "工作流中存在循环依赖，无法整体执行（先断开成环的连线）",
          });
          return;
        }

        // 全部批量入队：服务端队列在“执行时”检查上游，上游先跑完下游自然就绪。
        // 不用逐个 await（队列限并发=2，且真实耗时由后端推进）。
        // runAll 自身已做全量拓扑，用 runSingle 避免每个节点重复带上游。
        get().beginHistoryPause();
        for (const n of ordered) {
          await get().runSingle(n.id);
        }
        // 历史暂停由“最后一个节点进入终态”的桥接解除（不在这里 end）。
      },

      /* ---- 撤销 / 重做 ---------------------------------------------- */

      pushHistory: (label, coalesceMs = 0) => {
        const s = get();
        if (s.historyPause > 0) return;

        const now = Date.now();
        // 同一操作在合并窗口内连续发生（拖拽、连续输入）→ 只记第一条
        if (
          coalesceMs > 0 &&
          s.lastHistory &&
          s.lastHistory.label === label &&
          now - s.lastHistory.at < coalesceMs
        ) {
          set({ lastHistory: { label, at: now } });
          return;
        }

        set({
          past: [
            ...s.past,
            { label, at: now, nodes: s.nodes, edges: s.edges },
          ].slice(-HISTORY_MAX),
          future: [],
          lastHistory: { label, at: now },
        });
      },

      undo: () => {
        const s = get();
        if (s.past.length === 0) return;
        const prev = s.past[s.past.length - 1];
        set({
          past: s.past.slice(0, -1),
          future: [
            {
              label: prev.label,
              at: Date.now(),
              nodes: s.nodes,
              edges: s.edges,
            },
            ...s.future,
          ].slice(0, HISTORY_MAX),
          ...restoreGraph(prev),
          selectedNodeId: null,
          connectingFrom: null,
          connectionError: null,
          lastHistory: null,
        });
      },

      redo: () => {
        const s = get();
        if (s.future.length === 0) return;
        const next = s.future[0];
        set({
          past: [
            ...s.past,
            {
              label: next.label,
              at: Date.now(),
              nodes: s.nodes,
              edges: s.edges,
            },
          ].slice(-HISTORY_MAX),
          future: s.future.slice(1),
          ...restoreGraph(next),
          selectedNodeId: null,
          connectingFrom: null,
          connectionError: null,
          lastHistory: null,
        });
      },

      beginHistoryPause: () =>
        set((s) => ({ historyPause: s.historyPause + 1 })),
      endHistoryPause: () =>
        set((s) => ({ historyPause: Math.max(0, s.historyPause - 1) })),

      /**
       * 跳回历史栈里第 index 条快照（历史面板用）。
       * 语义：恢复到 past[index] 那一刻，并把 [index+1, end) 与“当前状态”整体交给 redo 栈。
       * future 里每条带的 label 是“重做它时在执行的那个操作”。
       */
      jumpHistory: (index) => {
        const s = get();
        if (index < 0 || index >= s.past.length) return;
        const target = s.past[index];
        const now = Date.now();
        // future[0] 要能直接 redo，所以按“从早到晚”排列
        const future: HistoryEntry[] = [];
        for (let i = index + 1; i < s.past.length; i++) {
          future.push({ ...s.past[i], label: s.past[i - 1].label, at: now });
        }
        // 当前状态本身也回到 future 末尾（其 label = 最后一个操作）
        future.push({
          label: s.past[s.past.length - 1].label,
          at: now,
          nodes: s.nodes,
          edges: s.edges,
        });
        set({
          past: s.past.slice(0, index),
          future: future.concat(s.future).slice(0, HISTORY_MAX),
          ...restoreGraph(target),
          selectedNodeId: null,
          connectingFrom: null,
          connectionError: null,
          lastHistory: null,
        });
      },

      /** 一键整理：拓扑分层排布（打组作为整体搬运） */
      autoLayout: () => {
        get().pushHistory("layout");
        set((s) => ({ nodes: autoLayoutNodes(s.nodes, s.edges) }));
      },

      /** 追加一段图（工具箱“发送到画布”），记一条可撤销的历史 */
      appendGraph: (nodes, edges) => {
        if (nodes.length === 0 && edges.length === 0) return;
        get().pushHistory("append-graph");
        set((s) => ({
          nodes: [...s.nodes, ...nodes],
          edges: [...s.edges, ...edges],
          selectedNodeId: null,
        }));
      },

      clearCanvas: () => {
        const s = get();
        if (s.nodes.length === 0 && s.edges.length === 0) return;
        get().pushHistory("clear");
        set({ nodes: [], edges: [], selectedNodeId: null });
      },

      /* ---- M2：云端同步 ---- */
      bindWorkflow: async (workflowId) => {
        // 切换工作流：关掉上一张图的 SSE，避免旧事件写进新画布
        closeAllRunStreams();
        set({ workflowId, cloudStatus: "loading", cloudError: null });
        try {
          const res = await fetch(`/api/workflows/${workflowId}`);
          if (!res.ok) throw new Error(`加载失败 (${res.status})`);
          const data = (await res.json()) as {
            nodes: Node<FlowNodeData>[];
            edges: Edge[];
          };
          // 云端为主：直接用云端图替换。重置运行态与历史栈。
          // style/measured 统一按真实渲染尺寸重写（老数据里图片/视频是
          // NODE_SIZE 写死值，连线锚点会偏），group 保持原样。
          set({
            nodes: data.nodes.map((n) => {
              const kind = n.data?.kind as NodeKind;
              const dims =
                n.type !== "group" && NODE_SIZE[kind]
                  ? flowNodeSize(
                      kind,
                      n.data?.params?.aspectRatio,
                      kind === "text" ? n.data?.size : undefined,
                    )
                  : null;
              return {
                ...n,
                selected: false,
                ...(dims
                  ? {
                      measured: { width: dims.w, height: dims.h },
                      style: { ...n.style, width: dims.w, height: dims.h },
                    }
                  : {}),
                data: {
                  ...n.data,
                  status: n.data.status === "succeeded" ? "succeeded" : "idle",
                  progress: n.data.status === "succeeded" ? 100 : 0,
                },
              };
            }),
            edges: data.edges,
            past: [],
            future: [],
            selectedNodeId: null,
            cloudStatus: "ready",
          });
        } catch (e) {
          // 加载失败：留在本地兑底缓存（localStorage 已由 persist 提供）
          set({
            cloudStatus: "error",
            cloudError: e instanceof Error ? e.message : "加载失败",
          });
        }
      },

  saveToCloud: async () => {
        const s = get();
        if (!s.workflowId) return;
        set({ cloudStatus: "saving", cloudError: null });
        try {
          const res = await fetch(`/api/workflows/${s.workflowId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nodes: s.nodes,
              edges: s.edges,
            }),
          });
          if (!res.ok) throw new Error(`保存失败 (${res.status})`);
          const data = (await res.json()) as { savedAt: string };
          cloudSaveDirty = false;
          set({ cloudStatus: "saved", savedAt: data.savedAt });
        } catch (e) {
          set({
            cloudStatus: "error",
            cloudError: e instanceof Error ? e.message : "保存失败",
          });
        }
      },

      requestCloudSave: () => {
        cloudSaveDirty = true;
        scheduleCloudSave();
      },

      flushCloudSave: () => flushPendingCloudSave(),
    }),
    {
      name: "aiteach-canvas",
      storage: createJSONStorage(() => canvasPersistence.storage),
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        state.nodes = state.nodes.map((n) => {
          const kind = n.data?.kind as NodeKind;
          if (n.type === "group" || !NODE_SIZE[kind]) {
            return {
              ...n,
              selected: false,
              data: { ...n.data, status: "idle", progress: 0 },
            };
          }
          // style/measured 统一按真实渲染尺寸重写：图片/视频随画幅比例，
          // 文本节点可能有用户自定义尺寸（连线锚点据此计算）
          const dims = flowNodeSize(
            kind,
            n.data?.params?.aspectRatio,
            kind === "text" ? n.data?.size : undefined,
          );
          return {
            ...n,
            selected: false,
            measured: { width: dims.w, height: dims.h },
            style: { ...n.style, width: dims.w, height: dims.h },
            data: { ...n.data, status: "idle", progress: 0 },
          };
        });
        // 统一成新的实线 + 流光边
        state.edges = state.edges.map((e) => ({
          ...e,
          type: "flow",
          animated: false,
          style: undefined,
        }));
        state.hydrated = true;
      },
    },
  ),
);

/*
 * runStore → canvasStore 桥接：
 * SSE 写入 runStore 后，这里把对应节点的 status/progress/output/error 同步到图。
 * 用“上一帧状态”去重，只在真的变化时更新节点，避免无谓渲染。
 * 终态（succeeded/failed）到达时解除 runNode 的历史暂停。
 */
/*
 * 注册环境不做浏览器限制：桥接只依赖两个 store，Node 自测也要走同一条链路。
 */
{
  useRunStore.subscribe(() => {
    const rs = useRunStore.getState();
    const map = rs.nodeStatus;
    const changedId = rs.lastChangedId;
    const canvas = useCanvasStore.getState();

    // 只同步本次事件实际改动的节点。
    // （否则 map 里其他节点的旧 output 快照会把画布上已更新的节点覆盖回去）
    if (changedId) {
      const r = map[changedId];
      // 终态到达 → 放行该节点的下一次提交（配合 runSingle 的防重）
      if (
        r &&
        (r.status === "succeeded" ||
          r.status === "failed" ||
          r.status === "canceled")
      ) {
        submittedNodeRuns.delete(changedId);
      }
      const node = canvas.nodes.find((n) => n.id === changedId);
      if (r && node) {
        const d = node.data;
        const out = r.output as FlowNodeData["output"];
        const same =
          d.status === r.status &&
          d.progress === r.progress &&
          (d.output ?? undefined) === (out ?? undefined);
        if (!same) {
          useCanvasStore.setState({
            nodes: canvas.nodes.map((n) =>
              n.id === changedId
                ? {
                    ...n,
                    data: {
                      ...d,
                      status: r.status,
                      progress: r.progress,
                      output: out ?? d.output,
                    },
                  }
                : n,
            ),
          });
        }
      }
    }

    // 任一节点进入终态 → 解除历史暂停（与 beginHistoryPause 配对）
    if (canvas.historyPause > 0) {
      const anyTerminal = Object.values(map).some(
        (r) => r.status === "succeeded" || r.status === "failed",
      );
      if (anyTerminal) canvas.endHistoryPause();
    }
  });
}

/*
 * 统一云同步订阅：
 * 只要绑定了工作流且已进入 ready/saved/error（即图加载完成），
 * nodes/edges 引用一变 → 防抖保存。这样任何改图操作都能覆盖，不用逐个入口埋点。
 * （生成中的 running/progress 频繁更新也只合并成一次 PUT）
 */
if (typeof window !== "undefined") {
  let lastSig = "";
  useCanvasStore.subscribe((s) => {
    if (!s.workflowId) return;
    // 只在图加载完成后才开始同步（loading 阶段的替换不应触发回写）
    if (!["ready", "saved", "error", "saving"].includes(s.cloudStatus)) return;
    // 拖拽 / 平移期间不做任何签名计算（高频交互，把 CPU 全留给拖拽）
    if (s.interacting) return;
    const sig = `${s.nodes.length}:${s.edges.length}:${s.nodes.map((n) => n.id).join(",")}`;
    if (sig === lastSig) return;
    lastSig = sig;
    s.requestCloudSave();
  });

  // 关闭 / 隐藏页面时把在途保存跑完
  const flush = () => void flushPendingCloudSave();
  window.addEventListener("beforeunload", flush);
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flushPendingCloudSave();
  });
}

// 开发期把 store 挂到 window，便于调试 / 自动化验证
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  const w = window as unknown as Record<string, unknown>;
  w.__canvasStore = useCanvasStore;
  w.__canvasPersistence = canvasPersistence;
  w.__canvasPrefs = useCanvasPrefs;

  /**
   * 触发一个节点的真实云端运行（POST 入队 + SSE 驱动）。
   * 等价于点击节点“运行”，供自动化统一入口；状态随后由 SSE → runStore 回填。
   */
  w.__completeNode = (id: string) => {
    void useCanvasStore.getState().runNode(id);
    return { triggered: true, id };
  };
}
