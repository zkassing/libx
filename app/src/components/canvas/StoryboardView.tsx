"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Film,
  ImageIcon,
  Loader2,
  Play,
  Video,
} from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import {
  collectStoryboard,
} from "@/lib/storyboard";
import {
  buildImageNodes,
  buildVideoNodes,
} from "@/server/skills/shotPipeline";
import type { FlowNodeData, Shot } from "@/types";
import { FinalFilmDialog } from "@/components/canvas/FinalFilmDialog";

type BusyKind = "image" | "video";

export function StoryboardView() {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const appendGraph = useCanvasStore((s) => s.appendGraph);
  const runNode = useCanvasStore((s) => s.runNode);
  const flushCloudSave = useCanvasStore((s) => s.flushCloudSave);
  const setViewMode = useCanvasPrefs((s) => s.setViewMode);

  const [busy, setBusy] = React.useState<Record<string, BusyKind>>({});
  const [filmOpen, setFilmOpen] = React.useState(false);

  const entries = React.useMemo(() => collectStoryboard(nodes), [nodes]);

  /** 回写某来源节点的 shots（实时读 store，不能用闭包旧 nodes） */
  const writeShots = (nodeId: string, shots: Shot[]) => {
    const current = useCanvasStore.getState().nodes.find((n) => n.id === nodeId);
    if (!current?.data.output) return;
    updateNodeData(nodeId, { output: { ...current.data.output, shots } });
  };

  const toggleConfirm = (nodeId: string, shot: Shot) => {
    const shots =
      useCanvasStore.getState().nodes.find((n) => n.id === nodeId)?.data.output?.shots ?? [];
    writeShots(
      nodeId,
      shots.map((s) =>
        s.id === shot.id ? { ...s, confirmed: !s.confirmed } : s,
      ),
    );
  };

  /** P3：一键创建选中镜头的分镜图节点并运行 */
  const genImages = async (nodeId: string) => {
    // 实时读 store（闭包 nodes 可能还是确认前快照）
    const built = buildImageNodes(useCanvasStore.getState().nodes, nodeId);
    if (built.nodes.length === 0) return;
    appendGraph(built.nodes, built.edges);
    writeShots(nodeId, built.shots);
    setBusy((b) => {
      const nb = { ...b };
      built.nodes.forEach((n) => (nb[n.id] = "image"));
      return nb;
    });
    // 必须等新节点 PUT 到云端后再 run，否则后端 404
    await flushCloudSave();
    for (const n of built.nodes) {
      void runNode(n.id);
    }
  };

  /** P4：创建图生视频节点并运行 */
  const genVideos = async (nodeId: string) => {
    // 需要拿到已 append 的最新节点（含刚建的 image 节点）
    const latest = useCanvasStore.getState().nodes;
    const built = buildVideoNodes(latest, nodeId);
    if (built.nodes.length === 0) return;
    appendGraph(built.nodes, built.edges);
    writeShots(nodeId, built.shots);
    setBusy((b) => {
      const nb = { ...b };
      built.nodes.forEach((n) => (nb[n.id] = "video"));
      return nb;
    });
    // 同上：先落库再 run
    await flushCloudSave();
    for (const n of built.nodes) {
      void runNode(n.id);
    }
  };

  const hasConfirmed = entries.some((e) =>
    e.shots.some((s) => s.confirmed),
  );
  const hasImages = entries.some((e) =>
    e.shots.some((s) => s.imageNodeId),
  );

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#1a1a1a]">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b border-white/8 px-5 py-2.5">
        <button
          onClick={() => setViewMode("workflow")}
          className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[13px] text-white/60 transition hover:bg-white/8 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          工作流
        </button>
        <div className="flex items-center gap-2 text-[14px] font-medium text-white">
          <Clapperboard className="size-4 text-white/60" />
          故事板
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => entries.forEach((e) => genImages(e.nodeId))}
            disabled={!hasConfirmed}
            className={btnCls(hasConfirmed)}
            title="为已确认镜头创建并生成分镜图"
          >
            <ImageIcon className="size-3.5" />
            生成分镜图
          </button>
          <button
            onClick={() => entries.forEach((e) => genVideos(e.nodeId))}
            disabled={!hasImages}
            className={btnCls(hasImages)}
            title="把分镜图生成镜头视频"
          >
            <Video className="size-3.5" />
            生成视频
          </button>
          <button
            onClick={() => setFilmOpen(true)}
            disabled={!hasImages}
            className="flex h-8 items-center gap-1.5 rounded-lg bg-[#1677ff] px-3 text-[12.5px] font-medium text-white transition hover:bg-[#3b8cff] disabled:cursor-not-allowed disabled:bg-white/8 disabled:text-white/30"
          >
            <Film className="size-3.5" />
            串联成片
          </button>
        </div>
      </div>

      {/* 看板列头 */}
      <div className="grid shrink-0 grid-cols-3 gap-4 border-b border-white/8 px-5 py-2 text-[12px] text-white/45">
        <ColHead icon={<Clapperboard className="size-3.5" />} label="分镜" />
        <ColHead icon={<ImageIcon className="size-3.5" />} label="分镜图" />
        <ColHead icon={<Video className="size-3.5" />} label="镜头视频" />
      </div>

      {/* 看板内容：横向滚动的卡片轨道 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
        {entries.length === 0 ? (
          <EmptyStoryboard onBack={() => setViewMode("workflow")} />
        ) : (
          <div className="space-y-8">
            {entries.map((entry) => (
              <section key={entry.nodeId}>
                <div className="mb-2.5 text-[13px] font-medium text-white/70">
                  {entry.nodeTitle}
                  <span className="ml-2 text-[11px] font-normal text-white/35">
                    {entry.shots.filter((s) => s.confirmed).length}/
                    {entry.shots.length} 已确认
                  </span>
                </div>
                <div className="space-y-2">
                  {entry.shots.map((shot) => (
                    <ShotTrack
                      key={shot.id}
                      shot={shot}
                      nodes={nodes}
                      busy={busy}
                      onToggleConfirm={() => toggleConfirm(entry.nodeId, shot)}
                      onGenImage={() => genImages(entry.nodeId)}
                      onGenVideo={() => genVideos(entry.nodeId)}
                      onRetryNode={(nodeId) => void runNode(nodeId)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {filmOpen && <FinalFilmDialog entries={entries} nodes={nodes} onClose={() => setFilmOpen(false)} />}
    </div>
  );
}

/* 单个镜头：三列轨道 */
function ShotTrack({
  shot,
  nodes,
  busy,
  onToggleConfirm,
  onGenImage,
  onGenVideo,
  onRetryNode,
}: {
  shot: Shot;
  nodes: ReturnType<typeof useCanvasStore.getState>["nodes"];
  busy: Record<string, BusyKind>;
  onToggleConfirm: () => void;
  onGenImage: () => void;
  onGenVideo: () => void;
  onRetryNode: (nodeId: string) => void;
}) {
  const imgNode = shot.imageNodeId
    ? nodes.find((n) => n.id === shot.imageNodeId)
    : undefined;
  const vidNode = shot.videoNodeId
    ? nodes.find((n) => n.id === shot.videoNodeId)
    : undefined;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* 分镜列 */}
      <div
        className={[
          "flex items-center gap-3 rounded-xl border p-3",
          shot.confirmed ? "border-[#1677ff]/40 bg-[#1677ff]/5" : "border-white/8 bg-[#232323]",
        ].join(" ")}
      >
        <button
          onClick={onToggleConfirm}
          className={[
            "flex size-5 shrink-0 items-center justify-center rounded border transition",
            shot.confirmed
              ? "border-[#1677ff] bg-[#1677ff] text-white"
              : "border-white/25 text-transparent hover:border-white/50",
          ].join(" ")}
          title={shot.confirmed ? "取消确认" : "确认该镜头"}
        >
          <Check className="size-3" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-white/85">
            <span className="text-white/40">#{shot.index}</span>
            <span className="rounded bg-white/8 px-1.5 text-[10.5px] text-white/55">
              {shot.framing}
            </span>
            <span className="truncate text-[11px] font-normal text-white/45">
              {shot.camera} · {shot.duration}s
            </span>
          </div>
          <div className="mt-1 truncate text-[12px] text-white/65">
            {shot.scene}
          </div>
          {shot.dialogue && (
            <div className="mt-0.5 truncate text-[11px] text-white/40">
              {shot.dialogue}
            </div>
          )}
        </div>
      </div>

      {/* 分镜图列 */}
      <StageCell
        ready={shot.confirmed}
        node={imgNode}
        busy={!!(imgNode && busy[imgNode.id])}
        emptyHint="确认镜头后生成分镜图"
        onRun={onGenImage}
        onRetry={onRetryNode}
      />

      {/* 视频列 */}
      <StageCell
        ready={!!imgNode}
        node={vidNode}
        busy={!!(vidNode && busy[vidNode.id])}
        emptyHint="分镜图完成后生成视频"
        onRun={onGenVideo}
        onRetry={onRetryNode}
        isVideo
      />
    </div>
  );
}

/* 阶段单元格：产物缩略图 / 状态 / 生成按钮 */
function StageCell({
  ready,
  node,
  busy,
  emptyHint,
  onRun,
  onRetry,
  isVideo = false,
}: {
  ready: boolean;
  node?: ReturnType<typeof useCanvasStore.getState>["nodes"][number];
  busy: boolean;
  emptyHint: string;
  onRun: () => void;
  onRetry: (nodeId: string) => void;
  isVideo?: boolean;
}) {
  const url = node?.data.output?.urls?.[0];
  const status = node?.data.status ?? "idle";

  // 还没创建节点
  if (!node) {
    return (
      <div className="flex min-h-[86px] items-center justify-center rounded-xl border border-dashed border-white/10 px-3 text-center text-[11.5px] text-white/30">
        {ready ? (
          <button
            onClick={onRun}
            className="flex items-center gap-1 text-white/55 transition hover:text-white"
          >
            <Play className="size-3" />
            {isVideo ? "生成视频" : "生成分镜图"}
          </button>
        ) : (
          emptyHint
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-[86px] items-center gap-3 rounded-xl border border-white/8 bg-[#232323] p-2.5">
      <div className="relative size-[72px] shrink-0 overflow-hidden rounded-lg bg-black/40">
        {url ? (
          isVideo ? (
            <video src={url} className="size-full object-cover" muted preload="metadata" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className="size-full object-cover" />
          )
        ) : (
          <div className="flex size-full items-center justify-center text-white/25">
            {busy || status === "running" || status === "queued" ? (
              <Loader2 className="size-5 animate-spin" />
            ) : isVideo ? (
              <Video className="size-5" />
            ) : (
              <ImageIcon className="size-5" />
            )}
          </div>
        )}
        {isVideo && url && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <Play className="size-4 text-white/90" fill="currentColor" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12px] text-white/80">{node.data.title}</div>
        <div className="mt-0.5 text-[10.5px]" style={{ color: statusColor(status) }}>
          {statusLabel(status)}
        </div>
        {status === "failed" && (
          <button onClick={() => onRetry(node.id)} className="mt-1 text-[10.5px] text-[#1677ff] hover:underline">
            重试
          </button>
        )}
      </div>
    </div>
  );
}

function ColHead({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 font-medium">
      {icon}
      {label}
    </div>
  );
}

function EmptyStoryboard({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Clapperboard className="size-10 text-white/20" />
      <div className="text-[14px] text-white/55">还没有分镜</div>
      <div className="max-w-sm text-[12px] leading-relaxed text-white/35">
        回到工作流，运行一个文本或剧本节点，它会自动产出结构化分镜；
        之后在这里确认镜头并一路推进到成片。
      </div>
      <button
        onClick={onBack}
        className="mt-2 rounded-lg bg-white/10 px-4 py-2 text-[13px] text-white/80 transition hover:bg-white/15"
      >
        返回工作流
      </button>
    </div>
  );
}

/* 样式工具 */
function btnCls(enabled: boolean): string {
  return [
    "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12.5px] transition",
    enabled
      ? "bg-white/10 text-white/85 hover:bg-white/15"
      : "cursor-not-allowed bg-white/4 text-white/25",
  ].join(" ");
}
function statusColor(s: FlowNodeData["status"]): string {
  switch (s) {
    case "succeeded": return "#3fb950";
    case "running": return "#d29922";
    case "queued": return "#d29922";
    case "failed": return "#f85149";
    default: return "#8b8b8b";
  }
}
function statusLabel(s: FlowNodeData["status"]): string {
  switch (s) {
    case "succeeded": return "已完成";
    case "running": return "生成中…";
    case "queued": return "排队中…";
    case "failed": return "失败";
    default: return "待生成";
  }
}
