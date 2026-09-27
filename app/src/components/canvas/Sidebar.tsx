"use client";

import * as React from "react";
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  FolderOpen,
  PanelLeftClose,
  Redo2,
  Save,
  Send,
  Undo2,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { useCanvasStore } from "@/stores/canvasStore";
import { NodeList } from "@/components/canvas/NodeList";
import { ProjectFiles } from "@/components/canvas/ProjectFiles";
import { cn } from "@/lib/utils";

const EXPANDED_W = 312;

/**
 * 画布主侧栏（对齐 LibTV）。
 *  - 展开（宽 312）：工作区·画布切换 + 视图切换 + 画布/资产 tab + 节点列表/文件管理器
 *  - 收起：宽度 0、完全消失，画布全屏（重新打开走 CollapsedHeader / 左下角资产管理）
 * 默认收起。
 */
export function Sidebar() {
  const expanded = useCanvasPrefs((s) => s.sidebarExpanded);
  const tab = useCanvasPrefs((s) => s.sidebarTab);
  const setExpanded = useCanvasPrefs((s) => s.setSidebarExpanded);
  const setTab = useCanvasPrefs((s) => s.setSidebarTab);
  const workflowId = useCanvasStore((s) => s.workflowId);

  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const canUndo = useCanvasStore((s) => s.past.length > 0);
  const canRedo = useCanvasStore((s) => s.future.length > 0);
  const nodeCount = useCanvasStore((s) => s.nodes.filter((n) => n.type !== "group").length);

  /* 收起态：完全消失，不占任何宽度；重新打开入口在左下角「资产管理」 */
  if (!expanded) return null;

  const width = EXPANDED_W;

  /* ---------------- 展开态：宽面板 ---------------- */
  return (
    <div
      style={{ width }}
      className="z-30 flex h-full shrink-0 flex-col border-r border-white/8 bg-[#17171a]/95 backdrop-blur-xl"
    >
      {/* 顶部第一行：Logo + 视图切换 + 收起 */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <WorkspaceMenu />
        <div className="ml-auto flex items-center gap-1">
          <ViewSwitch />
          <IconRail title="收起侧栏" onClick={() => setExpanded(false)}>
            <PanelLeftClose className="h-[18px] w-[18px]" />
          </IconRail>
        </div>
      </div>

      {/* 第二行：工作区名 | 画布切换 */}
      <div className="flex items-center px-3 pt-1.5">
        <CanvasMenu />
      </div>

      {/* 撤销 / 重做 */}
      <div className="flex items-center gap-0.5 px-3 pt-2">
        <button
          onClick={undo}
          disabled={!canUndo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:text-white/20"
          title="撤销"
        >
          <Undo2 className="h-4 w-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white disabled:pointer-events-none disabled:text-white/20"
          title="重做"
        >
          <Redo2 className="h-4 w-4" />
        </button>
      </div>

      {/* 画布 / 资产 tab */}
      <div className="mt-2 flex gap-1 border-b border-white/8 px-3 pb-2.5">
        <TabBtn active={tab === "canvas"} onClick={() => setTab("canvas")}>
          画布
        </TabBtn>
        <TabBtn active={tab === "assets"} onClick={() => setTab("assets")}>
          资产
        </TabBtn>
      </div>

      {/* 内容 */}
      <div className="flex min-h-0 flex-1 flex-col">
        {tab === "canvas" ? <NodeList /> : <ProjectFiles workflowId={workflowId} />}
      </div>

      {/* 底部：工具箱（存为/打开） + 收起侧栏 + 节点数 */}
      <div className="flex items-center gap-0.5 border-t border-white/8 px-3 py-2.5">
        <button
          onClick={() => window.dispatchEvent(new Event("aiteach:save-toolbox"))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white"
          title="保存到工具箱"
        >
          <Save className="h-4 w-4" />
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("aiteach:open-toolbox"))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white"
          title="打开工具箱"
        >
          <FolderOpen className="h-4 w-4" />
        </button>
        <button
          onClick={() => window.dispatchEvent(new Event("aiteach:publish-skill"))}
          className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white"
          title="发布为 Skill"
        >
          <Send className="h-4 w-4" />
        </button>
        <button
          onClick={() => setExpanded(false)}
          className="ml-1 flex h-7 w-7 items-center justify-center rounded-md text-white/55 hover:bg-white/8 hover:text-white"
          title="收起侧栏"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="ml-auto text-[12px] text-white/45">共 {nodeCount} 节点</span>
      </div>
    </div>
  );
}

/* ---------------- 左上角悬浮紧凑头（仅收起态显示） ---------------- */

/**
 * 侧栏收起后，左上角保留的紧凑上下文条（对齐 LibTV）。
 * 仅展示工作区 / 画布切换 / 视图切换；**展开入口不在这里**，而在左下角「资产管理」。
 */
export function CollapsedHeader() {
  const expanded = useCanvasPrefs((s) => s.sidebarExpanded);
  if (expanded) return null;

  return (
    <div className="absolute top-3 left-4 z-30 flex items-center gap-1.5 rounded-lg bg-[#17171a]/85 p-1 backdrop-blur-xl">
      <span className="flex h-7 w-7 items-center justify-center text-white/90">
        <LogoMark />
      </span>
      <CanvasMenu />
      <ViewSwitch />
    </div>
  );
}

/* ---------------- 顶部子控件 ---------------- */

/** 工作区标识（Logo；展开态仅展示） */
function WorkspaceMenu() {
  return (
    <span className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-white/90">
      <span className="flex h-6 w-7 items-center justify-center">
        <LogoMark />
      </span>
      <ChevronDown className="h-3.5 w-3.5 text-white/40" />
    </span>
  );
}

/** 画布（工作流）切换；点击列出全部工作流（展开态 / 收起态共用） */
export function CanvasMenu() {
  const router = useRouter();
  const currentId = useCanvasStore((s) => s.workflowId);
  const [items, setItems] = React.useState<
    Array<{ id: string; title: string }>
  >([]);

  async function load() {
    const res = await fetch("/api/workflows");
    if (res.ok) {
      const j = (await res.json()) as { workflows: Array<{ id: string; title: string }> };
      setItems(j.workflows);
    }
  }

  const current = items.find((w) => w.id === currentId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={() => void load()}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-1 py-1 text-[13px] text-white/85 transition hover:bg-white/8"
        >
          {current?.title ?? "未命名工作区"}
          <span className="text-white/25">|</span>
          <span className="flex items-center gap-0.5 text-white/85">
            画布 1<ChevronDown className="h-3.5 w-3.5 text-white/40" />
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-52">
        {items.map((w) => (
          <DropdownMenuItem
            key={w.id}
            onSelect={() => w.id !== currentId && router.push(`/canvas/${w.id}`)}
            className="text-[12.5px]"
          >
            {w.title}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 视图切换：工作流 / 故事板 */
function ViewSwitch() {
  const viewMode = useCanvasPrefs((s) => s.viewMode);
  const setViewMode = useCanvasPrefs((s) => s.setViewMode);
  return (
    <div className="flex items-center rounded-lg border border-white/10 bg-white/4 p-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setViewMode("workflow")}
            className={[
              "flex h-7 w-8 items-center justify-center rounded-md transition",
              viewMode === "workflow"
                ? "bg-white/10 text-white/85"
                : "text-white/45 hover:text-white/75",
            ].join(" ")}
          >
            <WorkflowIcon className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>工作流视图</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setViewMode("storyboard")}
            className={[
              "flex h-7 w-8 items-center justify-center rounded-md transition",
              viewMode === "storyboard"
                ? "bg-white/10 text-white/85"
                : "text-white/45 hover:text-white/75",
            ].join(" ")}
          >
            <Columns2 className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>故事板视图</TooltipContent>
      </Tooltip>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg px-3 py-1.5 text-[13px] transition",
        active ? "bg-white/10 font-medium text-white" : "text-white/50 hover:bg-white/6 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

function IconRail({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}

function LogoMark() {
  return (
    <svg width="22" height="16" viewBox="0 0 22 16" fill="none" aria-hidden>
      <path d="M2 13V3l8 6 4-3 6 4" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


