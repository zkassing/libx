"use client";

import * as React from "react";
import {
  Background,
  BackgroundVariant,
  MiniMap,
  ReactFlow,
  SelectionMode,
  useReactFlow,
  useStoreApi,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
} from "@xyflow/react";
import { Ban, Copy, CopyPlus, FolderDown, Group as GroupIcon, ImageDown, Star, Trash2, Ungroup } from "lucide-react";
import { nodeTypes, NODE_ICONS } from "@/components/canvas/nodes";
import { edgeTypes } from "@/components/canvas/FlowEdge";
import { NodeActionsBar } from "@/components/canvas/NodeActionsBar";
import { NODE_META, NODE_KINDS } from "@/lib/nodeTypes";
import { checkConnection } from "@/lib/connections";
import { nextNodePosition } from "@/lib/placement";
import { centerAt, reuseAsset } from "@/lib/assets";
import {
  hasDragPayload,
  readDragPayload,
} from "@/lib/dragPayload";
import { loadToolboxToCanvas } from "@/lib/toolboxGraph";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { useToolboxStore } from "@/stores/toolboxStore";
import type { FlowNodeData, NodeKind } from "@/types";
import { cn, isTextEntry } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* 空画布引导（对齐 LibTV：双击画布 自由生成节点 + 快捷生成）           */
/* ------------------------------------------------------------------ */

function EmptyState({ onPick }: { onPick: (k: NodeKind) => void }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-6">
      <div className="flex items-center gap-2 text-[13px] text-white/45">
        <svg viewBox="0 0 24 24" className="size-4 fill-white/45">
          <path d="M4 2l14 7.5-6 1.6-2.2 5.9L4 2z" />
        </svg>
        双击画布 自由生成节点
      </div>

      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
        {NODE_KINDS.map((kind) => {
          const meta = NODE_META[kind];
          const Icon = NODE_ICONS[kind];
          return (
            <button
              key={kind}
              onClick={() => onPick(kind)}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#1b1b1e]/80 px-4 text-[13px] text-white/75 backdrop-blur transition hover:border-white/25 hover:bg-[#232327] hover:text-white"
            >
              <Icon className="size-4" strokeWidth={1.8} />
              {meta.label}生成
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 右键 / 落点菜单                                                      */
/* ------------------------------------------------------------------ */

interface MenuState {
  x: number;
  y: number;
  nodeId?: string;
  /** 从某个端口拖出来后落在空白处，选中节点后自动连线 */
  pendingFrom?: { nodeId: string; handleId: string | null };
  flow: { x: number; y: number };
}

function ContextMenu({
  menu,
  onClose,
}: {
  menu: MenuState;
  onClose: () => void;
}) {
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const node = useCanvasStore((s) =>
    menu.nodeId ? s.nodes.find((n) => n.id === menu.nodeId) : undefined,
  );
  const nodeData = node?.data as FlowNodeData | undefined;
  const outputUrl =
    nodeData?.status === "succeeded" ? nodeData.output?.urls?.[0] : undefined;

  /** 产物写入系统剪贴板（对齐 LibTV「复制图片」） */
  const copyImage = async () => {
    if (!outputUrl) return;
    try {
      const blob = await (await fetch(outputUrl)).blob();
      await navigator.clipboard.write([
        new ClipboardItem({ [blob.type || "image/png"]: blob }),
      ]);
    } catch {
      /* 剪贴板权限被拒绝时静默 */
    }
  };

  /** 保存到我的资产（LibTV 右键第一项） */
  const saveToAssets = async () => {
    if (!outputUrl || !nodeData) return;
    await fetch("/api/assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: nodeData.kind === "script" ? "text" : nodeData.kind,
        title: `${nodeData.title}${nodeData.index ? ` ${nodeData.index}` : ""} 的产物`,
        url: outputUrl,
        ...(nodeData.rating ? { rating: nodeData.rating } : {}),
      }),
    }).catch(() => {});
  };

  const outputItems =
    menu.nodeId && outputUrl && nodeData
      ? [
          { label: "保存到我的资产", icon: FolderDown, run: () => void saveToAssets() },
          ...(nodeData.kind === "image"
            ? [{ label: "复制图片", icon: ImageDown, run: () => void copyImage() }]
            : []),
        ]
      : [];

  const items: { label: string; icon: React.ElementType; run?: () => void }[] =
    menu.nodeId
      ? [
          ...outputItems,
          { label: "复制节点", icon: Copy, run: () => duplicateNode(menu.nodeId!) },
          { label: "创建副本", icon: CopyPlus, run: () => duplicateNode(menu.nodeId!) },
          { label: "打组 (⌘G)", icon: GroupIcon, run: () => groupSelected() },
          { label: "解组", icon: Ungroup, run: () => ungroupSelected() },
          { label: "删除节点", icon: Trash2, run: () => removeNode(menu.nodeId!) },
        ]
      : NODE_KINDS.map((kind) => ({
          label: `添加${NODE_META[kind].label}节点`,
          icon: NODE_ICONS[kind],
          run: () => {
            const store = useCanvasStore.getState();
            const id = store.addNode(kind, menu.flow);
            if (menu.pendingFrom) {
              store.onConnect({
                source: menu.pendingFrom.nodeId,
                target: id,
                sourceHandle: menu.pendingFrom.handleId,
                targetHandle: null,
              });
            }
          },
        }));

  const rating = nodeData?.rating ?? 0;

  return (
    <>
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
        onContextMenu={(e) => e.preventDefault()}
      />
      <div
        className="fixed z-50 max-h-[70vh] min-w-44 overflow-auto rounded-xl border border-white/10 bg-[#1b1b1e] p-1 shadow-2xl"
        style={{ left: menu.x, top: menu.y }}
      >
        {/* 评级（对齐 LibTV：产物节点右键第一行五角星） */}
        {menu.nodeId && outputUrl && (
          <div className="flex items-center gap-1 px-2.5 py-1.5">
            <span className="mr-1 text-[12.5px] text-white/55">评级</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => {
                  updateNodeData(menu.nodeId!, { rating: n === rating ? 0 : n });
                  onClose();
                }}
                className="p-0.5"
              >
                <Star
                  className={cn(
                    "size-3.5 transition",
                    n <= rating
                      ? "fill-amber-400 text-amber-400"
                      : "text-white/30 hover:text-amber-300",
                  )}
                />
              </button>
            ))}
          </div>
        )}
        {items.map((it) => (
          <button
            key={it.label}
            onClick={() => {
              it.run?.();
              onClose();
            }}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] transition",
              it.label.startsWith("删除")
                ? "text-destructive hover:bg-destructive/12"
                : "text-white/75 hover:bg-white/8 hover:text-white",
            )}
          >
            <it.icon className="size-3.5" />
            {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* 画布                                                                */
/* ------------------------------------------------------------------ */

export function WorkflowCanvas() {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const onNodesChange = useCanvasStore((s) => s.onNodesChange);
  const onEdgesChange = useCanvasStore((s) => s.onEdgesChange);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const setInteracting = useCanvasStore((s) => s.setInteracting);
  const interacting = useCanvasStore((s) => s.interacting);
  const addNode = useCanvasStore((s) => s.addNode);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const setConnectingFrom = useCanvasStore((s) => s.setConnectingFrom);
  const groupSelected = useCanvasStore((s) => s.groupSelected);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const connectionError = useCanvasStore((s) => s.connectionError);
  const setConnectionError = useCanvasStore((s) => s.setConnectionError);
  const snapToGrid = useCanvasPrefs((s) => s.snapToGrid);
  const showMiniMap = useCanvasPrefs((s) => s.showMiniMap);
  const selectMode = useCanvasPrefs((s) => s.selectMode);
  const agentOpen = useCanvasPrefs((s) => s.agentOpen);

  const { screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = React.useState<MenuState | null>(null);

  /** 连线被拒的提示 3 秒后自动消失 */
  React.useEffect(() => {
    if (!connectionError) return;
    const t = setTimeout(() => setConnectionError(null), 3200);
    return () => clearTimeout(t);
  }, [connectionError, setConnectionError]);

  /** 拖线时实时判定：不合法的目标端口变红并阻止落线 */
  const isValidConnection = React.useCallback(
    (c: Connection | Edge) => {
      if (!c.source || !c.target || c.source === c.target) return false;
      const { nodes, edges } = useCanvasStore.getState();
      const source = nodes.find((n) => n.id === c.source);
      const target = nodes.find((n) => n.id === c.target);
      if (!source || !target) return false;
      if (source.type === "group" || target.type === "group") return false;
      return checkConnection(
        { id: source.id, kind: source.data.kind },
        { id: target.id, kind: target.data.kind },
        edges,
      ).ok;
    },
    [],
  );

  // dev: 暴露 React Flow 内部 store / 实例，便于排查边、节点、视口问题
  const rfStore = useStoreApi();
  const rfInstance = useReactFlow();
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      const w = window as unknown as Record<string, unknown>;
      w.__rf = rfStore;
      w.__rfInstance = rfInstance;
    }
  }, [rfStore, rfInstance]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      const k = e.key.toLowerCase();

      // ⌘Enter：运行选中节点（对齐 LibTV「生成」）。
      // 放在 isTextEntry 之前：输入框里 ⌘Enter 也是发送，LibTV 用户习惯如此。
      if (e.key === "Enter") {
        const id = useCanvasStore.getState().selectedNodeId;
        if (id) {
          e.preventDefault();
          void useCanvasStore.getState().runNode(id);
        }
        return;
      }

      // 输入框/文本框里交给浏览器原生撤销，不要抢
      if (isTextEntry(e.target)) return;

      if (k === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (k === "y") {
        e.preventDefault();
        redo();
        return;
      }
      if (k === "g") {
        e.preventDefault();
        if (e.shiftKey) ungroupSelected();
        else groupSelected();
        return;
      }
      // ⌘D：创建副本（对齐 LibTV；覆盖浏览器收藏）
      if (k === "d") {
        const id = useCanvasStore.getState().selectedNodeId;
        if (id) {
          e.preventDefault();
          useCanvasStore.getState().duplicateNode(id);
        }
        return;
      }
      // ⌘0：适应画布（对齐 LibTV）
      if (k === "0") {
        e.preventDefault();
        void rfInstance.fitView({ padding: 0.2, duration: 300 });
      }
    };
    // 捕获阶段监听：RF 会在节点 wrapper 上把 Enter 等键 stopPropagation
    //（a11y：Enter=选中），冒泡阶段的 window 监听根本收不到。
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [groupSelected, ungroupSelected, undo, redo, rfInstance]);

  /** V / P：在「选择模式（框选）」与「平移模式」之间切换；Tab：新建节点菜单；⌥⇧F：整理画布 */
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      if (isTextEntry(e.target)) return;
      // ⌥⇧F：一键整理（对齐 LibTV）
      if (e.altKey && e.shiftKey && e.code === "KeyF") {
        e.preventDefault();
        useCanvasStore.getState().autoLayout();
        return;
      }
      if (e.altKey) return;
      // Tab：在画布中央唤出新建节点菜单（对齐 LibTV）
      if (e.key === "Tab") {
        e.preventDefault();
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        setMenu({
          x: cx,
          y: cy,
          flow: screenToFlowPosition({ x: cx, y: cy }),
        });
        return;
      }
      const k = e.key.toLowerCase();
      if (k === "v") useCanvasPrefs.getState().setSelectMode(true);
      else if (k === "p") useCanvasPrefs.getState().setSelectMode(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [screenToFlowPosition]);

  const addAtCenter = React.useCallback(
    (kind: NodeKind) => {
      addNode(kind, nextNodePosition(screenToFlowPosition, nodes.length));
    },
    [addNode, nodes.length, screenToFlowPosition],
  );

  /** 从端口开始拉线：标记来源，目标卡片播放 3D 反馈 */
  const handleConnectStart = React.useCallback(
    (_e: unknown, params: { nodeId?: string | null }) => {
      setConnectingFrom(params.nodeId ?? null);
    },
    [setConnectingFrom],
  );

  /**
   * 松手即连接：
   * - 落在别的卡片上 → 直接连到该卡片（不要求精准落在 + 号上）
   * - 落在空白处 → 弹出节点选择器，选完自动连上
   */
  const handleConnectEnd = React.useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      setConnectingFrom(null);
      if (state?.isValid) return;

      const fromId: string | undefined = state?.fromNode?.id;
      if (!fromId) return;

      const point =
        "changedTouches" in event
          ? event.changedTouches[0]
          : (event as MouseEvent);
      if (!point) return;

      const el = document.elementFromPoint(point.clientX, point.clientY);
      const nodeEl = (el as HTMLElement | null)?.closest?.(
        ".react-flow__node",
      ) as HTMLElement | null;
      const targetId = nodeEl?.getAttribute("data-id");

      const store = useCanvasStore.getState();

      if (targetId && targetId !== fromId) {
        const target = store.nodes.find((n) => n.id === targetId);
        if (!target || target.type === "group") return;

        const source = store.nodes.find((n) => n.id === fromId);
        if (!source) return;

        // 落点合法才连线；不合法时由 onConnect 统一给出拒绝原因
        onConnect({
          source: fromId,
          target: targetId,
          sourceHandle: state?.fromHandle?.id ?? null,
          targetHandle: null,
        });
        return;
      }

      // 落在空白：弹出节点选择，选完自动连线
      setMenu({
        x: point.clientX,
        y: point.clientY,
        flow: screenToFlowPosition({
          x: point.clientX,
          y: point.clientY,
        }),
        pendingFrom: { nodeId: fromId, handleId: state?.fromHandle?.id ?? null },
      });
    },
    [onConnect, screenToFlowPosition, setConnectingFrom],
  );

  /* ---- 拖拽放置：侧栏 → 画布 ---- */
  const [dropping, setDropping] = React.useState(false);
  const dropAt = React.useCallback(
    (e: React.DragEvent) =>
      screenToFlowPosition({ x: e.clientX, y: e.clientY }),
    [screenToFlowPosition],
  );

  const handleDragOver = React.useCallback((e: React.DragEvent) => {
    if (!hasDragPayload(e.dataTransfer)) return;
    // preventDefault 才会接受放置；dropEffect 决定光标样式
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDropping(true);
  }, []);

  const handleDragLeave = React.useCallback(() => setDropping(false), []);

  /**
   * 拖拽被中断时（按 Esc 取消、拖到窗口外、拖回侧栏再松手）也把提示收起来，
   * 否则 dragleave 可能不触发，提示会一直挂在画布上。
   */
  React.useEffect(() => {
    const reset = () => setDropping(false);
    window.addEventListener("dragend", reset);
    window.addEventListener("drop", reset);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("dragend", reset);
      window.removeEventListener("drop", reset);
      window.removeEventListener("blur", reset);
    };
  }, []);

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      setDropping(false);
      const payload = readDragPayload(e.dataTransfer);
      if (!payload) return;
      e.preventDefault();
      const at = dropAt(e);
      if (payload.type === "node") {
        // 以鼠标位置为中心，拖到哪就落在哪
        addNode(payload.kind, centerAt(payload.kind, at));
      } else if (payload.type === "toolbox") {
        const item = useToolboxStore
          .getState()
          .items.find((i) => i.id === payload.id);
        if (item) loadToolboxToCanvas(item, at);
      } else if (payload.type === "cloud-asset") {
        // 按 id 取该资产（可能来自项目资产 / 个人库），新建同类节点并预置产物
        fetch(`/api/assets/${payload.assetId}`)
          .then((r) => r.json())
          .then((j: { asset?: { kind: string; url?: string; text?: string; title: string } }) => {
            const a = j.asset;
            if (!a) return;
            const kind = (a.kind === "text" ? "text" : a.kind) as NodeKind;
            const nid = addNode(kind, centerAt(kind, at));
            const output =
              a.text !== undefined && a.text !== null
                ? { kind, text: a.text }
                : a.url
                  ? { kind, urls: [a.url] }
                  : undefined;
            if (output) {
              useCanvasStore.getState().updateNodeData(nid, {
                output: output as never,
                status: "succeeded",
                progress: 100,
                prompt: a.title,
              });
            }
          })
          .catch(() => {});
      } else {
        reuseAsset(payload.nodeId, at);
      }
    },
    [addNode, dropAt],
  );

  return (
    <div
      className={cn("absolute inset-0", connectingFrom && "connect-dragging")}
    >
      {/* 拖拽悬停提示：明确“松手就落在这里” */}
      {dropping && (
        <div className="pointer-events-none absolute inset-0 z-20 ring-2 ring-primary/50 ring-inset">
          <div className="absolute top-20 left-1/2 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-[12px] text-white/85 backdrop-blur-sm">
            松开鼠标即可放置
          </div>
        </div>
      )}

      <ReactFlow<Node<FlowNodeData>>
        className={cn("bg-canvas", interacting && "aiteach-interacting")}
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        // 隐藏右下角内置的 "React Flow" 水印
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{ type: "flow", animated: false }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        isValidConnection={isValidConnection}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        onSelectionChange={({ nodes: sel }) =>
          setSelected(sel.length === 1 ? sel[0].id : null)
        }
        onPaneClick={() => setMenu(null)}
        // 高频交互（节点拖拽 / 画布平移）开始→暂停一切非必要工作，结束→恢复
        onNodeDrag={() => setInteracting(true)}
        onNodeDragStop={() => setInteracting(false)}
        onMoveStart={(event) => {
          // event 为 null 表示程序化触发（如 fitView），不暂停；只响应用户手势
          if (event) setInteracting(true);
        }}
        onMoveEnd={() => setInteracting(false)}
        onNodeContextMenu={(e, node) => {
          e.preventDefault();
          setMenu({
            x: e.clientX,
            y: e.clientY,
            nodeId: node.id,
            flow: node.position,
          });
        }}
        onPaneContextMenu={(e) => {
          e.preventDefault();
          const ev = e as React.MouseEvent;
          setMenu({
            x: ev.clientX,
            y: ev.clientY,
            flow: screenToFlowPosition({ x: ev.clientX, y: ev.clientY }),
          });
        }}
        onDoubleClick={(e) => {
          const ev = e as React.MouseEvent;
          setMenu({
            x: ev.clientX,
            y: ev.clientY,
            flow: screenToFlowPosition({ x: ev.clientX, y: ev.clientY }),
          });
        }}
        selectionMode={SelectionMode.Partial}
        colorMode="dark"
        // 选择模式：拖空白处框选；否则拖空白处平移（两者都可用空格键临时切换）
        selectionOnDrag={selectMode}
        panOnDrag={!selectMode}
        panOnScroll
        snapToGrid={snapToGrid}
        snapGrid={[20, 20]}
        zoomOnDoubleClick={false}
        deleteKeyCode={["Backspace", "Delete"]}
        minZoom={0.15}
        maxZoom={2.5}
        connectOnClick={false}
      >
        <Background
          id="grid-fine"
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#424242"
        />
        {showMiniMap && (
          <MiniMap
            pannable
            zoomable
            ariaLabel="画布小地图"
            style={{
              // 面板展开时向左让出 372px + 间距
              right: agentOpen ? 396 : 16,
              bottom: 16,
              width: 172,
              height: 118,
              // 拖拽 / 平移期间隐藏缩略图，避免它跟随逐帧重绘
              visibility: interacting ? "hidden" : "visible",
            }}
            // 注意：className 落在 React Flow 的 .react-flow__panel 上，
            // 该 panel 自带 margin:15px，会叠加到 right/bottom 上 → 显式清零
            className="!m-0 !rounded-xl !border !border-white/10 overflow-hidden !bg-[#0f0f11] backdrop-blur-xl"
            maskColor="rgba(8,8,10,0.62)"
            maskStrokeColor="rgba(255,255,255,0.16)"
            nodeColor={(n) =>
              n.type === "group"
                ? "rgba(255,255,255,0.06)"
                : (NODE_META[(n.data as FlowNodeData)?.kind]?.accent ?? "#3f3f46")
            }
            nodeStrokeWidth={0}
            nodeBorderRadius={3}
          />
        )}
      </ReactFlow>

      {nodes.length === 0 && <EmptyState onPick={addAtCenter} />}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {/* 选中带产物的图片节点时：顶部工具条（高清派生 / 下载 / 全屏） */}
      <NodeActionsBar />

      {/* 连线被拒的提示 */}
      {connectionError && (
        <div className="pointer-events-none absolute inset-x-0 top-18 z-40 flex justify-center">
          <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-[#2a1618]/95 px-3.5 py-1.5 text-[12.5px] text-red-200 shadow-2xl backdrop-blur">
            <Ban className="size-3.5 shrink-0 text-red-400" />
            {connectionError}
          </div>
        </div>
      )}
    </div>
  );
}
