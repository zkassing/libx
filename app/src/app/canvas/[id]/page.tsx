"use client";

import { use, useEffect, useSyncExternalStore } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { WorkflowCanvas } from "@/components/canvas/WorkflowCanvas";
import { AccountBar } from "@/components/canvas/AccountBar";
import { BottomDock } from "@/components/canvas/BottomDock";
import { StoryboardView } from "@/components/canvas/StoryboardView";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { AgentPanel } from "@/components/panel/AgentPanel";
import { NodeInspector } from "@/components/canvas/NodeInspector";
import { Sidebar, CollapsedHeader } from "@/components/canvas/Sidebar";
import { ToolboxHost } from "@/components/canvas/Toolbox";
import { PublishSkillHost } from "@/components/skill/PublishSkillDialog";
import { useCanvasStore } from "@/stores/canvasStore";

/** 永不变更的外部源：判断“是否已在客户端完成 hydration” */
const emptySubscribe = () => () => {};

/** 画布依赖 localStorage / window，SSR 与首帧让位；用 useSyncExternalStore 做 mounted 守卫 */
function useHydrated() {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

export default function CanvasDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const hydrated = useHydrated();
  const { id } = use(params);
  const viewMode = useCanvasPrefs((s) => s.viewMode);

  const workflowId = useCanvasStore((s) => s.workflowId);
  useEffect(() => {
    if (workflowId !== id) void useCanvasStore.getState().bindWorkflow(id);
  }, [id, workflowId]);

  return (
    <ReactFlowProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-canvas">
        {hydrated ? (
          <>
            <Sidebar />
            {/* 画布区占剩余空间 */}
            <div className="relative min-w-0 flex-1">
              <WorkflowCanvas />
              <AccountBar />
              <CollapsedHeader />
              <ToolboxHost />
              <PublishSkillHost />
              <NodeInspector />
              <BottomDock />
              <AgentPanel />
              {viewMode === "storyboard" && <StoryboardView />}
            </div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[12px] text-white/30">
            加载画布…
          </div>
        )}
      </div>
    </ReactFlowProvider>
  );
}
