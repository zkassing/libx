"use client";

import * as React from "react";
import {
  Bot,
  CircleHelp,
  Clapperboard,
  Clock3,
  FolderOpen,
  LayoutGrid,
  Loader2,
  Minus,
  MousePointer2,
  NotebookPen,
  PanelLeftOpen,
  Plus,
  Settings2,
  Sparkles,
  Square,
  Users,
} from "lucide-react";
import { useReactFlow, useViewport } from "@xyflow/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NODE_META, NODE_KINDS } from "@/lib/nodeTypes";
import { nextNodePosition } from "@/lib/placement";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { StoryboardDialog } from "@/components/canvas/Storyboard";
import { HistoryPanel } from "@/components/canvas/HistoryPanel";
import { ShortcutsDialog } from "@/components/canvas/ShortcutsDialog";
import { cn } from "@/lib/utils";

const ZOOMS = [0.25, 0.5, 0.75, 1, 1.5, 2];

export function BottomDock() {
  const { zoom, x, y } = useViewport();
  const { setViewport, fitView, screenToFlowPosition } = useReactFlow();
  const addNode = useCanvasStore((s) => s.addNode);
  const runAll = useCanvasStore((s) => s.runAll);
  const autoLayout = useCanvasStore((s) => s.autoLayout);
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const workflowId = useCanvasStore((s) => s.workflowId);
  /** 排队中 + 执行中的节点数（返回原始值，避免每帧新建数组触发重渲染） */
  const runningCount = useCanvasStore((s) =>
    s.nodes.reduce(
      (n, x) =>
        n + (x.data.status === "running" || x.data.status === "queued" ? 1 : 0),
      0,
    ),
  );
  const [stopping, setStopping] = React.useState(false);

  /** 停止：取消本画布所有排队/执行中的任务（终态通过 SSE 回写到节点） */
  async function stopAll() {
    if (!workflowId || stopping) return;
    setStopping(true);
    try {
      await fetch(`/api/workflows/${workflowId}/runs/cancel`, { method: "POST" });
    } catch {
      // 失败就保持原状，用户可再点（不弹错误打断操作）
    } finally {
      setStopping(false);
    }
  }
  const { snapToGrid, showMiniMap, setSnapToGrid, setShowMiniMap, agentOpen, setAgentOpen } =
    useCanvasPrefs();
  const { selectMode, toggleSelectMode } = useCanvasPrefs();
  const sidebarExpanded = useCanvasPrefs((s) => s.sidebarExpanded);
  const [boardOpen, setBoardOpen] = React.useState(false);
  const [historyOpen, setHistoryOpen] = React.useState(false);
  const [helpOpen, setHelpOpen] = React.useState(false);

  // 故事板里点「定位节点」→ 关闭弹层后把该节点聚焦到中央
  React.useEffect(() => {
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ id: string }>).detail.id;
      fitView({ duration: 320, nodes: [{ id }], padding: 0.6, maxZoom: 1.4 });
    };
    window.addEventListener("aiteach:focus-node", onFocus);
    return () => window.removeEventListener("aiteach:focus-node", onFocus);
  }, [fitView]);

  const add = (kind: (typeof NODE_KINDS)[number]) => {
    addNode(kind, nextNodePosition(screenToFlowPosition, nodeCount));
  };

  const zoomTo = (z: number) =>
    setViewport({ x, y, zoom: z }, { duration: 160 });

  /** 一键整理后把整张图收进视野 */
  const organize = () => {
    autoLayout();
    setTimeout(() => fitView({ duration: 380, padding: 0.2 }), 40);
  };

  const iconBtn =
    "flex size-8 items-center justify-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white";

  /** 右侧被面板 / 小地图占掉的宽度，主工具坞居中时要让开 */
  const rightReserve = (agentOpen ? 396 : 0) + (showMiniMap ? 180 : 0);

  return (
    <>
      {/* 底部：左侧工具组贴左 + 主工具坞在剩余区域居中（对齐 LibTV） */}
      <div
        className="absolute bottom-4 left-4 z-30 flex items-center"
        style={{ right: rightReserve }}
      >
        {/* 左侧：资产管理（仅收起态；点击展开侧边栏并切到资产 tab）/ 整理 / 设置 / 缩放 */}
        <div className="flex items-center gap-1">
        {!sidebarExpanded && (
          <>
          <button
            onClick={() => {
              useCanvasPrefs.getState().setSidebarTab("assets");
              useCanvasPrefs.getState().setSidebarExpanded(true);
            }}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-white/55 transition hover:bg-white/8 hover:text-white"
          >
            <PanelLeftOpen className="size-3.5" />
            资产管理
          </button>
          <button
            onClick={() => window.dispatchEvent(new Event("aiteach:open-toolbox"))}
            className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[12.5px] text-white/55 transition hover:bg-white/8 hover:text-white"
          >
            <FolderOpen className="size-3.5" />
            工具箱
          </button>
          </>
        )}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(iconBtn, "cursor-not-allowed text-white/25 hover:bg-transparent hover:text-white/25")}
              aria-disabled="true"
              aria-label="协作成员"
            >
              <Users className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>协作成员 · 不在 v1 范围</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={iconBtn}
              onClick={organize}
              aria-label="智能编排"
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>智能编排（按依赖分层排布）</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={iconBtn} aria-label="画布设置">
              <Settings2 className="size-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-44">
            <DropdownMenuLabel className="text-[11.5px] text-white/45">
              画布设置
            </DropdownMenuLabel>
            <DropdownMenuCheckboxItem
              className="text-[12.5px]"
              checked={snapToGrid}
              onCheckedChange={(v) => setSnapToGrid(!!v)}
              onSelect={(e) => e.preventDefault()}
            >
              网格吸附（20px）
            </DropdownMenuCheckboxItem>
            <DropdownMenuCheckboxItem
              className="text-[12.5px]"
              checked={showMiniMap}
              onCheckedChange={(v) => setShowMiniMap(!!v)}
              onSelect={(e) => e.preventDefault()}
            >
              小地图
            </DropdownMenuCheckboxItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-[12.5px]"
              onSelect={organize}
            >
              一键整理
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12.5px]"
              onSelect={() => fitView({ duration: 320, padding: 0.2 })}
            >
              适应画布
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-[12.5px]"
              onSelect={() =>
                fitView({ duration: 320, padding: 0.35, maxZoom: 1 })
              }
            >
              居中当前内容
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="ml-1 flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] text-white/60 transition hover:bg-white/8 hover:text-white">
              {Math.round(zoom * 100)}%
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="min-w-28">
            {ZOOMS.map((z) => (
              <DropdownMenuItem
                key={z}
                className="text-[12.5px]"
                onSelect={() => zoomTo(z)}
              >
                {Math.round(z * 100)}%
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem
              className="text-[12.5px]"
              onSelect={() => fitView({ duration: 300, padding: 0.25 })}
            >
              适应画布
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>

        {/* 主工具坞：在「左侧组右边缘 ~ 右侧面板/小地图左边缘」之间居中 */}
        <div className="flex flex-1 items-center justify-center">
        <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-[#17171a]/90 p-1 shadow-2xl backdrop-blur-xl">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex size-8 items-center justify-center rounded-full bg-white/90 text-black transition hover:bg-white"
                aria-label="添加节点"
              >
                <Plus className="size-4" strokeWidth={2.4} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="min-w-40">
              {NODE_KINDS.map((kind) => {
                const meta = NODE_META[kind];
                return (
                  <DropdownMenuItem
                    key={kind}
                    onSelect={() => add(kind)}
                    className="gap-2 text-[12.5px]"
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ background: meta.accent }}
                    />
                    {meta.label}节点
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(
                  iconBtn,
                  selectMode && "bg-white/14 text-white",
                )}
                onClick={toggleSelectMode}
                aria-label="选择模式"
                aria-pressed={selectMode}
              >
                <MousePointer2 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {selectMode ? "选择模式（V）· 拖空白处框选" : "平移模式 · 拖空白处平移"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button className={iconBtn} onClick={organize} aria-label="一键整理">
                <LayoutGrid className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>一键整理</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(iconBtn, "relative")}
                onClick={() => setAgentOpen(!agentOpen)}
                aria-label="AI 助手"
              >
                <Sparkles className="size-4" />
                {!agentOpen && (
                  <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {agentOpen ? "收起 AI 助手" : "打开 AI 助手"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={iconBtn}
                onClick={() => setHistoryOpen(true)}
                aria-label="历史记录"
              >
                <Clock3 className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>历史记录（可跳回任意一步）</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={cn(iconBtn, "cursor-not-allowed text-white/25 hover:bg-transparent hover:text-white/25")}
                aria-disabled="true"
                aria-label="教学备注"
              >
                <NotebookPen className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>教学备注 · M4 接入</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={iconBtn}
                onClick={() => setBoardOpen(true)}
                title="故事板（汇总产物）"
              >
                <Clapperboard className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>故事板（汇总产物）</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className={iconBtn}
                onClick={() => setHelpOpen(true)}
                aria-label="快捷键帮助"
              >
                <CircleHelp className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>快捷键与操作说明</TooltipContent>
          </Tooltip>

          <div className="mx-0.5 h-5 w-px bg-white/10" />

          <Tooltip>
            <TooltipTrigger asChild>
              {runningCount > 0 ? (
                <button
                  onClick={stopAll}
                  disabled={stopping}
                  className="flex h-8 items-center gap-1.5 rounded-full bg-[#f85149] px-3 text-[12.5px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
                  aria-label="停止生成"
                >
                  {stopping ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Square className="size-3.5 fill-current" />
                  )}
                  停止（{runningCount}）
                </button>
              ) : (
                <button
                  onClick={() => runAll()}
                  className="flex size-8 items-center justify-center rounded-full bg-primary text-white transition hover:brightness-110"
                  aria-label="整体执行"
                >
                  <Bot className="size-4" />
                </button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {runningCount > 0
                ? `停止正在生成的 ${runningCount} 个节点`
                : "整体执行工作流"}
            </TooltipContent>
          </Tooltip>
        </div>
        </div>
      </div>

      <StoryboardDialog open={boardOpen} onOpenChange={setBoardOpen} />
      <HistoryPanel open={historyOpen} onOpenChange={setHistoryOpen} />
      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}

export { Minus };
