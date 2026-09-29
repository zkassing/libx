"use client";

import * as React from "react";
import {
  ArrowLeft,
  ChevronDown,
  Columns2,
  FolderOpen,
  House,
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
import { PromptDialog } from "@/components/ui/confirm-dialog";
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
      {/* 顶部第一行：返回首页 + Logo + 视图切换 + 收起 */}
      <div className="flex items-center gap-2 px-3 pt-3">
        <HomeButton />
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
      <HomeButton />
      <span className="h-4 w-px bg-white/15" />
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

/** 画布（工作流）切换；点击名字重命名，点击「画布 1 ▾」列出全部工作流 */
export function CanvasMenu() {
  const router = useRouter();
  const currentId = useCanvasStore((s) => s.workflowId);
  const [items, setItems] = React.useState<
    Array<{ id: string; title: string }>
  >([]);
  const [renameOpen, setRenameOpen] = React.useState(false);
  const [renaming, setRenaming] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/workflows");
    if (res.ok) {
      const j = (await res.json()) as { workflows: Array<{ id: string; title: string }> };
      setItems(j.workflows);
    }
  }, []);

  // 挂载即拉取（之前只在点开下拉时拉）：标题展示与重命名默认值都依赖它
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load, currentId]);

  const current = items.find((w) => w.id === currentId);

  /** 重命名提交：PATCH 只改标题（PUT 是整图保存，拿它改名会清空节点） */
  async function rename(title: string) {
    if (!currentId || renaming) return;
    setRenaming(true);
    try {
      const res = await fetch(`/api/workflows/${currentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) return;
      setItems((list) =>
        list.map((w) => (w.id === currentId ? { ...w, title } : w)),
      );
      setRenameOpen(false);
    } finally {
      setRenaming(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-1.5 whitespace-nowrap text-[13px]">
        {/* 名字本身：点击重命名（对齐 LibTV 画布名改名） */}
        <button
          onClick={() => setRenameOpen(true)}
          title="点击重命名"
          className="max-w-40 truncate rounded-md px-1 py-1 text-white/85 transition hover:bg-white/8"
        >
          {current?.title ?? "未命名工作区"}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-1.5 rounded-lg px-1 py-1 text-white/85 transition hover:bg-white/8">
              <span className="text-white/25">|</span>
              <span className="flex items-center gap-0.5">
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
      </div>

      <PromptDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        title="重命名工作流"
        defaultValue={current?.title ?? ""}
        placeholder="工作流名称"
        confirmText="重命名"
        maxLength={40}
        busy={renaming}
        onSubmit={rename}
      />
    </>
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

/** 返回首页（/project）。画布内回项目的统一出口。 */
function HomeButton() {
  const router = useRouter();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => router.push("/project")}
          aria-label="返回首页"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-white/55 transition hover:bg-white/8 hover:text-white"
        >
          <House className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent>返回首页</TooltipContent>
    </Tooltip>
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
  // 墨点：一滴墨 + 溅开的卫星点
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="8" cy="10.5" r="5" fill="#fff" />
      <circle cx="14.6" cy="4.4" r="1.7" fill="#fff" />
    </svg>
  );
}


