"use client";

import * as React from "react";
import {
  Handle,
  Position,
  useStore,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import {
  ArrowUp,
  Boxes,
  Check,
  ChevronDown,
  Crosshair,
  Download,
  Expand,
  Image as ImageIcon,
  Infinity as InfinityIcon,
  Layers,
  Loader2,
  Maximize2,
  Music,
  PackagePlus,
  Play,
  Plus,
  SlidersHorizontal,
  Sparkles,
  Square,
  CircleSlash,
  TriangleAlert,
  Type as TypeIcon,
  UserRound,
  Video as VideoIcon,
  ScrollText,
  Wand2,
  X,
} from "lucide-react";
import { ASPECT_RATIOS, DURATIONS, NODE_META, RESOLUTIONS } from "@/lib/nodeTypes";
import {
  NODE_LABEL_H,
  TEXT_CARD_MAX,
  TEXT_CARD_MIN,
  aspectCardSize,
  type FlowNodeData,
  type NodeKind,
  type NodeRef,
} from "@/types";
import { useRunStore } from "@/stores/runStore";
import { useCanvasStore } from "@/stores/canvasStore";
import { cn } from "@/lib/utils";
import { nodeDisplayName } from "@/lib/upstream";
import {
  MentionMenu,
  useMention,
} from "@/components/canvas/MentionMenu";
import {
  CharacterPicker,
  MarkPopover,
  MarkingDialog,
  PresetPopover,
  useMarkSources,
  type CharacterDto,
  type MarkSource,
} from "@/components/canvas/ToolPopovers";
import { CAMERA_PRESETS, EFFECT_PRESETS } from "@/lib/toolPresets";
import { OutputPreview } from "@/components/canvas/OutputPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export const NODE_ICONS: Record<NodeKind, React.ElementType> = {
  text: TypeIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: Music,
  script: ScrollText,
};

type FlowNode = Node<FlowNodeData>;

/** 端口跟随鼠标的最大偏移（卡片外 30px 半圆弧） */
const HANDLE_RANGE = 30;
/** 拖连线时目标卡片的 3D 最大倾角 */
const TILT_MAX = 9;
/** 卡片尺寸过渡（切换画幅比例时播放；拖拽调大小期间禁用，否则卡片跟不上鼠标） */
const SIZE_TRANSITION =
  "width 260ms cubic-bezier(0.22, 1, 0.36, 1), height 260ms cubic-bezier(0.22, 1, 0.36, 1)";

/* ------------------------------------------------------------------ */
/* 状态指示                                                            */
/* ------------------------------------------------------------------ */

function StatusPill({ id, data }: { id: string; data: FlowNodeData }) {
  const cached = useRunStore((s) => s.nodeStatus[id]?.cached);
  if (data.status === "idle") return null;
  const map = {
    queued: { text: "排队中", cls: "text-white/55" },
    running: { text: `${data.progress}%`, cls: "text-primary" },
    succeeded: { text: cached ? "已完成 · 命中缓存" : "已完成", cls: "text-emerald-400/85" },
    failed: { text: "失败", cls: "text-destructive" },
    canceled: { text: "已取消", cls: "text-white/40" },
  } as const;
  const s = map[data.status as keyof typeof map];
  if (!s) return null;
  return (
    <span className={cn("ml-auto flex items-center gap-1 text-[11px]", s.cls)}>
      {data.status === "running" && <Loader2 className="size-3 animate-spin" />}
      {data.status === "failed" && <TriangleAlert className="size-3" />}
      {data.status === "canceled" && <CircleSlash className="size-3" />}
      {s.text}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* 节点内容区                                                          */
/* ------------------------------------------------------------------ */

/** 空节点时的 "尝试" 建议（LibTV 里靠左但留出内边距） */
function SuggestionList({ kind }: { kind: NodeKind }) {
  const meta = NODE_META[kind];
  const icons = [InfinityIcon, Layers, Sparkles];
  if (!meta.suggestions?.length) return null;
  return (
    <div className="w-full px-6 text-left">
      <div className="mb-2.5 text-[12px] text-white/35">尝试:</div>
      <div className="flex flex-col gap-2">
        {meta.suggestions.map((s, i) => {
          const Icon = icons[i % icons.length];
          return (
            <div
              key={s}
              className="flex items-center gap-2.5 text-[12.5px] text-white/60"
            >
              <Icon className="size-3.5 shrink-0 text-white/45" />
              {s}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* `@` 引用胶囊行 */
function RefChips({ id, data }: { id: string; data: FlowNodeData }) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const refs = data.refs ?? [];
  if (refs.length === 0) return null;

  const remove = (ref: NodeRef) => {
    const next = refs.filter((r) => r.id !== ref.id);
    const prompt = data.prompt.split(`@${ref.label}`).join("");
    updateNodeData(id, { refs: next, prompt });
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2">
      {refs.map((ref) => (
        <span
          key={`${ref.type}:${ref.id}`}
          className={cn(
            "flex items-center gap-1 rounded-md border py-0.5 pr-1 pl-1.5 text-[11px]",
            ref.type === "model"
              ? "border-primary/30 bg-primary/10 text-primary-200"
              : ref.type === "asset" || ref.type === "mark"
                ? "border-emerald-400/25 bg-emerald-400/8 text-emerald-200/85"
                : ref.type === "character"
                  ? "border-violet-400/30 bg-violet-400/10 text-violet-200/90"
                  : "border-white/12 bg-white/6 text-white/70",
          )}
        >
          {ref.type === "node" ? (
            <Boxes className="size-3" />
          ) : ref.type === "asset" ? (
            <ImageIcon className="size-3" />
          ) : ref.type === "mark" ? (
            <Crosshair className="size-3" />
          ) : ref.type === "character" ? (
            <UserRound className="size-3" />
          ) : (
            <Sparkles className="size-3" />
          )}
          {ref.label}
          <button
            onClick={() => remove(ref)}
            className="flex size-3.5 items-center justify-center rounded-full text-white/40 transition hover:bg-white/15 hover:text-white"
          >
            <X className="size-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

/**
 * 上游自动引用（对齐参考截图）：
 * 一旦上游节点连线到本节点，这里就出现一个引用块（上游即便还没生成产物也在），
 * 生成时其产物会隐式作为本节点的参考/上下文。
 * 点击 × 断开这条连线（不弹确认，与“删除连线”语义一致）。
 */
function UpstreamChips({ id }: { id: string }) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const removeEdges = useCanvasStore((s) => s.removeEdges);

  const upstreams = edges
    .filter((e) => e.target === id)
    .map((e) => {
      const edgeId = e.id;
      const node = nodes.find((n) => n.id === e.source);
      return node ? { edgeId, node } : null;
    })
    .filter((x): x is { edgeId: string; node: (typeof nodes)[number] } => !!x);

  if (upstreams.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
      {upstreams.map(({ edgeId, node }, i) => {
        const UpIcon = NODE_ICONS[node.data.kind] ?? Boxes;
        const ready = node.data.status === "succeeded";
        return (
          <Tooltip key={edgeId}>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  "flex items-center gap-1 rounded-lg border px-1.5 py-1 text-[11.5px] transition",
                  ready
                    ? "border-white/18 bg-white/10 text-white/85"
                    : "border-white/10 bg-white/5 text-white/50",
                )}
              >
                <span className="flex size-5 items-center justify-center rounded-md bg-white/8 text-[10px] text-white/70">
                  {i + 1}
                </span>
                <UpIcon className="size-3.5" strokeWidth={1.8} />
                <button
                  onClick={() => removeEdges([edgeId])}
                  className="flex size-3.5 items-center justify-center rounded-full text-white/40 transition hover:bg-white/15 hover:text-white"
                  aria-label="移除该参考"
                >
                  <X className="size-2.5" />
                </button>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              {nodeDisplayName(node) || "上游节点"}
              {ready ? " · 已生成，将作为参考" : " · 未生成，连线已建立"}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AudioBars() {
  const bars = React.useMemo(
    () =>
      Array.from(
        { length: 48 },
        (_, i) => 18 + Math.abs(Math.sin(i * 1.7) * 60) + (i % 5) * 3,
      ),
    [],
  );
  return (
    <div className="flex h-16 items-center gap-[3px] px-2">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] shrink-0 rounded-full bg-[#525252]/55"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/**
 * 节点运行的环形进度（T2.5）。
 * running：外环随 progress 填充，中央显示百分比；queued：静态转圈表示排队。
 */
function ProgressRing({ progress, queued }: { progress: number; queued: boolean }) {
  const R = 26;
  const C = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, progress));
  const offset = C - (pct / 100) * C;

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-3">
      <div className="relative grid size-[72px] place-items-center">
        <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
          <circle cx="36" cy="36" r={R} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
          <circle
            cx="36"
            cy="36"
            r={R}
            fill="none"
            stroke="#1677ff"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={queued ? C : offset}
            style={{ transition: "stroke-dashoffset 200ms linear" }}
          />
        </svg>
        <span className="absolute text-[13px] tabular-nums text-white/85">
          {queued ? (
            <Loader2 className="size-4 animate-spin text-white/55" />
          ) : (
            `${pct}%`
          )}
        </span>
      </div>
      <span className="text-[12px] text-white/40">
        {queued ? "排队中…" : "正在生成"}
      </span>
    </div>
  );
}

function NodeBody({ data }: { data: FlowNodeData }) {
  const { kind, output, status } = data;

  if (status === "running" || status === "queued") {
    return <ProgressRing progress={data.progress} queued={status === "queued"} />;
  }

  if (output?.text || output?.urls?.length) {
    return <OutputPreview output={output} marks={data.marks} />;
  }

  if (kind === "video" || kind === "image" || kind === "audio") {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-5 text-[#525252]">
        {kind === "video" && (
          <Play className="size-10 fill-[#525252] text-transparent" />
        )}
        {kind === "image" && <ImageIcon className="size-10" strokeWidth={1.4} />}
        {kind === "audio" && <AudioBars />}
        <SuggestionList kind={kind} />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col items-center justify-center text-[#525252]">
      <ParagraphLines />
    </div>
  );
}

/**
 * 空节点的占位图形：四道横线（对齐 LibTV 的段落横线）。
 * 比大图标安静，不会和“尝试:”建议列表抢注意力。
 */
function ParagraphLines() {
  const widths = ["100%", "100%", "72%", "44%"];
  return (
    <div aria-hidden className="flex w-[54px] flex-col gap-[5px]">
      {widths.map((w, i) => (
        <span
          key={i}
          className="h-[3px] rounded-full bg-[#525252]"
          style={{ width: w }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 参数下拉（小尺寸，用于节点内嵌编辑器）                               */
/* ------------------------------------------------------------------ */

function ChipSelect({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label?: string;
  value?: string | number;
  options: (string | number)[];
  onChange: (v: string) => void;
  icon?: React.ReactNode;
}) {
  const opts = options.filter((o) => o !== undefined && o !== null && o !== "");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] text-white/70 transition hover:bg-white/8 hover:text-white">
          {icon}
          <span className="max-w-[132px] truncate">{label ?? value ?? "—"}</span>
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-40">
        {opts.map((o) => (
          <DropdownMenuItem
            key={String(o)}
            onSelect={() => onChange(String(o))}
            className="justify-between text-[12.5px]"
          >
            {o}
            {String(o) === String(value) && <Check className="size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** 节点参数（模型 / 模式 / 比例 / 分辨率 / 时长 / 数量），内嵌与大弹窗共用 */
function useParamOptions(kind: NodeKind) {
  const meta = NODE_META[kind];
  return {
    meta,
    ratios: ASPECT_RATIOS,
    resolutions:
      kind === "video" || kind === "image" ? RESOLUTIONS : [],
    durations:
      kind === "video" || kind === "audio" ? DURATIONS : [],
  };
}

/* ------------------------------------------------------------------ */
/* 节点编辑大弹窗（点击放大按钮打开）                                   */
/* ------------------------------------------------------------------ */

function NodeEditorDialog({
  id,
  data,
  open,
  onOpenChange,
}: {
  id: string;
  data: FlowNodeData;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeParams = useCanvasStore((s) => s.updateNodeParams);
  const runNode = useCanvasStore((s) => s.runNode);
  const cancelNode = useCanvasStore((s) => s.cancelNode);
  const { meta, ratios, resolutions, durations } = useParamOptions(data.kind);
  const Icon = NODE_ICONS[data.kind];
  const p = data.params ?? {};

  const promptRef = React.useRef<HTMLTextAreaElement>(null);
  const addRef = React.useCallback(
    (ref: NodeRef) => {
      const existing = data.refs ?? [];
      if (existing.some((r) => r.id === ref.id)) return;
      updateNodeData(id, { refs: [...existing, ref] });
    },
    [data.refs, id, updateNodeData],
  );
  const mention = useMention({
    value: data.prompt,
    nodeId: id,
    data,
    onChange: (next) => updateNodeData(id, { prompt: next }),
    textareaRef: promptRef,
    onAddRef: addRef,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Icon className="size-4 text-white/60" />
            {data.title}
            {data.index ? ` ${data.index}` : ""}
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            {meta.outputLabel} · 在教学模式下这一步的提示词与参数可被锁定（M4）
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <div className="relative rounded-xl border border-white/10 bg-[#191919] p-3">
              <Textarea
                ref={promptRef}
                value={mention.mentionValue}
                onChange={mention.handleChange}
                onKeyDown={mention.handleKeyDown}
                placeholder={meta.placeholder}
                className="min-h-[200px] resize-none border-0 bg-transparent p-0 text-[13.5px] leading-relaxed shadow-none placeholder:text-white/25 focus-visible:ring-0 dark:bg-transparent"
              />
              {mention.mentionOpen && (
                <MentionMenu
                  groups={mention.mentionGroups}
                  query={mention.mentionQuery}
                  activeIndex={mention.mentionActive}
                  onPick={mention.pick}
                  onHover={mention.setMentionActive}
                  className="absolute top-full left-3 mt-1 z-50"
                />
              )}
            </div>
            <UpstreamChips id={id} />
            <RefChips id={id} data={data} />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="模型">
                <Select
                  value={p.model ?? ""}
                  onValueChange={(v) => updateNodeParams(id, { model: v })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="选择模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {meta.models.map((m) => (
                      <SelectItem key={m} value={m} className="text-[12.5px]">
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {meta.modes && (
                <Field label="模式">
                  <Select
                    value={p.mode ?? ""}
                    onValueChange={(v) => updateNodeParams(id, { mode: v })}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="选择模式" />
                    </SelectTrigger>
                    <SelectContent>
                      {meta.modes.map((m) => (
                        <SelectItem key={m} value={m} className="text-[12.5px]">
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="比例">
                <Select
                  value={p.aspectRatio ?? ""}
                  onValueChange={(v) => updateNodeParams(id, { aspectRatio: v })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="比例" />
                  </SelectTrigger>
                  <SelectContent>
                    {ratios.map((r) => (
                      <SelectItem key={r} value={r} className="text-[12.5px]">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              {resolutions.length > 0 && (
                <Field label="分辨率">
                  <Select
                    value={p.resolution ?? ""}
                    onValueChange={(v) => updateNodeParams(id, { resolution: v })}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="分辨率" />
                    </SelectTrigger>
                    <SelectContent>
                      {resolutions.map((r) => (
                        <SelectItem key={r} value={r} className="text-[12.5px]">
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              {durations.length > 0 && (
                <Field label="时长">
                  <Select
                    value={String(p.duration ?? "")}
                    onValueChange={(v) => updateNodeParams(id, { duration: Number(v) })}
                  >
                    <SelectTrigger size="sm" className="w-full">
                      <SelectValue placeholder="时长" />
                    </SelectTrigger>
                    <SelectContent>
                      {durations.map((d) => (
                        <SelectItem
                          key={d}
                          value={String(d)}
                          className="text-[12.5px]"
                        >
                          {d}s
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              )}

              <Field label="数量">
                <Select
                  value={String(p.count ?? 1)}
                  onValueChange={(v) => updateNodeParams(id, { count: Number(v) })}
                >
                  <SelectTrigger size="sm" className="w-full">
                    <SelectValue placeholder="数量" />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4].map((c) => (
                      <SelectItem
                        key={c}
                        value={String(c)}
                        className="text-[12.5px]"
                      >
                        {c} 个
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-white/45">产物预览</div>
            <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-[#0f0f11]">
              {data.output?.urls?.length ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={data.output.urls[0]}
                  alt=""
                  className="h-full w-full object-contain"
                />
              ) : data.output?.text ? (
                <pre className="no-scrollbar h-full w-full overflow-auto p-3 font-mono text-[11.5px] leading-relaxed text-emerald-300/85">
                  {data.output.text}
                </pre>
              ) : (
                <span className="text-[12px] text-white/30">
                  {data.status === "running"
                    ? `生成中 ${data.progress}%`
                    : "尚未生成"}
                </span>
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          {data.status === "running" || data.status === "queued" ? (
            <Button size="sm" variant="destructive" onClick={() => cancelNode(id)}>
              <Square className="size-3.5 fill-current" />
              停止生成
            </Button>
          ) : (
            <Button size="sm" onClick={() => runNode(id)}>
              <Play className="size-3.5" />
              运行本节点
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11.5px] text-white/45">{label}</div>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 节点内嵌编辑器（选中时浮出，对齐 LibTV）                            */
/* ------------------------------------------------------------------ */

function Composer({
  id,
  data,
  onExpand,
}: {
  id: string;
  data: FlowNodeData;
  onExpand: () => void;
}) {
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeParams = useCanvasStore((s) => s.updateNodeParams);
  const runNode = useCanvasStore((s) => s.runNode);
  const cancelNode = useCanvasStore((s) => s.cancelNode);
  const { meta } = useParamOptions(data.kind);

  const promptRef = React.useRef<HTMLTextAreaElement>(null);
  const addRef = React.useCallback(
    (ref: NodeRef) => {
      const existing = data.refs ?? [];
      if (existing.some((r) => r.id === ref.id)) return;
      updateNodeData(id, { refs: [...existing, ref] });
    },
    [data.refs, id, updateNodeData],
  );
  const mention = useMention({
    value: data.prompt,
    nodeId: id,
    data,
    onChange: (next) => updateNodeData(id, { prompt: next }),
    textareaRef: promptRef,
    onAddRef: addRef,
  });

  const p = data.params ?? {};
  const credit = data.kind === "video" ? 135 : data.kind === "image" ? 12 : 2;

  /* ---- 工具条（参考 / 标记 / 特效 / 角色库 / 运镜）---- */
  const [openTool, setOpenTool] = React.useState<string | null>(null);
  const [markingSource, setMarkingSource] = React.useState<MarkSource | null>(null);
  const markSources = useMarkSources(id, data);
  const presetKind =
    data.kind === "video" ? "video" : data.kind === "image" ? "image" : "text";

  /** 插入一个标记引用（已有标记 / 新建标记都走这里） */
  const insertMark = React.useCallback(
    (source: MarkSource, mark: import("@/types").NodeMark) => {
      mention.insertAtCaret(`@${mark.label} `);
      addRef({
        id: mark.id,
        type: "mark",
        label: mark.label,
        mark: { nodeId: source.nodeId, imageUrl: mark.imageUrl, rect: mark.rect },
      });
    },
    [mention, addRef],
  );

  /** 新建标记保存：写到来源图片节点的 data.marks，并插入提示词 */
  const handleMarkDone = React.useCallback(
    (source: MarkSource, mark: import("@/types").NodeMark) => {
      const srcNode = useCanvasStore
        .getState()
        .nodes.find((n) => n.id === source.nodeId);
      if (srcNode) {
        const d = srcNode.data as FlowNodeData;
        updateNodeData(source.nodeId, { marks: [...(d.marks ?? []), mark] });
      }
      insertMark(source, mark);
    },
    [updateNodeData, insertMark],
  );

  /** 工具条按钮点击：参考开引用浮层；其余切换各自弹出层 */
  const handleTool = (tool: string) => {
    if (tool === "参考") {
      setOpenTool(null);
      mention.openMention();
      return;
    }
    setOpenTool((t) => (t === tool ? null : tool));
  };

  const renderToolPopover = (tool: string) => {
    if (openTool !== tool) return null;
    const cls = "absolute top-full left-0 z-[60] mt-1";
    if (tool === "特效") {
      return (
        <PresetPopover
          groups={EFFECT_PRESETS[presetKind]}
          onPick={(item) => {
            mention.insertAtCaret(`${item}，`);
            setOpenTool(null);
          }}
          className={cls}
        />
      );
    }
    if (tool === "运镜") {
      return (
        <PresetPopover
          groups={CAMERA_PRESETS}
          onPick={(item) => {
            mention.insertAtCaret(`${item}，`);
            setOpenTool(null);
          }}
          className={cls}
        />
      );
    }
    if (tool === "角色库") {
      return (
        <CharacterPicker
          onPick={(c: CharacterDto) => {
            mention.insertAtCaret(`@${c.name} `);
            addRef({ id: c.id, type: "character", label: c.name });
            setOpenTool(null);
          }}
          className={cls}
        />
      );
    }
    if (tool === "标记") {
      return (
        <MarkPopover
          sources={markSources}
          onPickMark={(s, m) => {
            insertMark(s, m);
            setOpenTool(null);
          }}
          onCreateMark={(s) => {
            setMarkingSource(s);
            setOpenTool(null);
          }}
          className={cls}
        />
      );
    }
    return null;
  };

  // 该节点种类下真正适用的参数（对齐 LibTV 字段清单 / PRD §13.2）。
  // 文本只有模型；图片=模型·模式·比例·数量；视频=模型·模式·比例·分辨率·时长·数量；
  // 音频=模型·模式·时长·数量；脚本=模型·模式。
  const showRatio = data.kind === "image" || data.kind === "video";
  const showResolution = data.kind === "video";
  const showDuration = data.kind === "video" || data.kind === "audio";
  const showCount = data.kind === "image" || data.kind === "video" || data.kind === "audio";

  return (
    <div
      style={{ width: "min(520px, calc(100vw - 16px))" }}
      className="nodrag nowheel absolute top-[calc(100%+8px)] left-1/2 z-50 -translate-x-1/2 rounded-xl border border-white/10 bg-[#262626]/95 shadow-2xl backdrop-blur-xl"
    >
      {/* 上游自动参考 */}
      <UpstreamChips id={id} />
      {/* 工具条（点击外部区域关闭弹出层） */}
      {openTool && (
        <div className="fixed inset-0 z-40" onClick={() => setOpenTool(null)} />
      )}
      <div className="relative flex items-center gap-0.5 border-b border-white/6 px-1.5 py-1">
        {meta.tools?.map((t) => (
          <button
            key={t}
            onClick={() => handleTool(t)}
            className={cn(
              "flex h-6 items-center gap-1 rounded-md px-2 text-[11.5px] transition",
              openTool === t
                ? "bg-white/12 text-white"
                : "text-white/55 hover:bg-white/8 hover:text-white/85",
            )}
          >
            <Plus className="size-3" />
            {t}
          </button>
        ))}
        {meta.tools?.map(renderToolPopover)}
        <button
          onClick={onExpand}
          title="放大编辑"
          className="ml-auto flex size-6 items-center justify-center rounded-md text-white/40 hover:bg-white/8 hover:text-white/80"
        >
          <Expand className="size-3.5" />
        </button>
      </div>

      {/* 提示词 */}
      <div className="relative px-3 pt-2.5">
        <Textarea
          ref={promptRef}
          value={mention.mentionValue}
          onChange={mention.handleChange}
          onKeyDown={mention.handleKeyDown}
          placeholder={meta.placeholder}
          className="min-h-[74px] resize-none border-0 bg-transparent p-0 text-left text-[13px] leading-relaxed text-white/90 shadow-none placeholder:text-white/30 focus-visible:ring-0 dark:bg-transparent"
        />
        {mention.mentionOpen && (
          <MentionMenu
            groups={mention.mentionGroups}
            query={mention.mentionQuery}
            activeIndex={mention.mentionActive}
            onPick={mention.pick}
            onHover={mention.setMentionActive}
            className="absolute bottom-full left-0 mb-1 z-[60]"
          />
        )}
      </div>
      <RefChips id={id} data={data} />

      {/* 参数行 */}
      <div className="flex items-center gap-1 px-2 pt-1.5 pb-2">
        <ChipSelect
          value={p.model}
          options={meta.models}
          onChange={(v) => updateNodeParams(id, { model: v })}
        />
        {meta.modes && (
          <ChipSelect
            value={p.mode}
            options={meta.modes}
            onChange={(v) => updateNodeParams(id, { mode: v })}
          />
        )}
        {/* 参数各自独立成 chip：比例就是比例、分辨率就是分辨率、时长就是时长，
            不合并成“16:9 · 1个”这种描述 */}
        {showRatio && (
          <ChipSelect
            value={p.aspectRatio}
            options={ASPECT_RATIOS}
            onChange={(v) => updateNodeParams(id, { aspectRatio: v })}
          />
        )}
        {showResolution && (
          <ChipSelect
            value={p.resolution}
            options={RESOLUTIONS}
            onChange={(v) => updateNodeParams(id, { resolution: v })}
          />
        )}
        {showDuration && (
          <ChipSelect
            label={p.duration ? `${p.duration}s` : "时长"}
            options={DURATIONS.map((d) => `${d}s`)}
            onChange={(v) => {
              const d = Number(v.replace("s", ""));
              if (!Number.isNaN(d)) updateNodeParams(id, { duration: d });
            }}
          />
        )}
        {showCount && (
          <ChipSelect
            label={`${p.count ?? 1}个`}
            options={[1, 2, 4]}
            onChange={(v) => updateNodeParams(id, { count: Number(v) })}
          />
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => {
                  const url = data.output?.urls?.[0];
                  if (!url) return;
                  const ext = data.kind === "video" ? "mp4" : data.kind === "audio" ? "mp3" : "png";
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${data.title || data.kind}.${ext}`;
                  a.rel = "noreferrer";
                  document.body.appendChild(a);
                  a.click();
                  a.remove();
                }}
                aria-disabled={!data.output?.urls?.length}
                className={cn(
                  "flex size-7 items-center justify-center rounded-md",
                  data.output?.urls?.length
                    ? "text-white/40 hover:bg-white/8 hover:text-white/80"
                    : "cursor-not-allowed text-white/20",
                )}
              >
                <Download className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {data.output?.urls?.length ? "下载产物" : "还没有产物"}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onExpand}
                className="flex size-7 items-center justify-center rounded-md text-white/40 hover:bg-white/8 hover:text-white/80"
              >
                <Maximize2 className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>放大编辑</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-disabled="true"
                className="flex size-7 cursor-not-allowed items-center justify-center rounded-md text-white/20"
              >
                <SlidersHorizontal className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>高级参数 · M2 接入</TooltipContent>
          </Tooltip>
          <span className="mr-1 ml-1 flex items-center gap-1 text-[11.5px] text-white/35">
            <Wand2 className="size-3" />
            {credit}
          </span>
          {/* 生成中（含排队）发送按钮变为停止按钮（对齐 LibTV）；
              取消走 cancelNode → POST /api/runs/:id/cancel，终态由 SSE 回填 */}
          {data.status === "running" || data.status === "queued" ? (
            <Button
              size="icon-sm"
              className="rounded-full bg-destructive text-white hover:bg-destructive/85"
              title="停止生成"
              onClick={() => cancelNode(id)}
            >
              <Square className="size-3 fill-current" />
            </Button>
          ) : (
            <Button
              size="icon-sm"
              className="rounded-full"
              onClick={() => runNode(id)}
            >
              <ArrowUp className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 框选标记 Dialog（标记保存在来源图片节点上） */}
      <MarkingDialog
        source={markingSource}
        open={markingSource !== null}
        onOpenChange={(v) => {
          if (!v) setMarkingSource(null);
        }}
        onDone={handleMarkDone}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 节点外壳                                                            */
/* ------------------------------------------------------------------ */

/**
 * 卡片右下角的尺寸手柄（文本节点）。
 * 拖动即改卡片宽 / 高：位移除以当前缩放换算回画布坐标，
 * 尺寸通过 canvasStore.resizeNode 持久化（style / measured 同步更新，
 * 连线锚点、打组包围盒都会跟随）。
 */
function CardResizeHandle({
  id,
  cardW,
  cardH,
  onResizeStart,
  onResizeEnd,
}: {
  id: string;
  cardW: number;
  cardH: number;
  /** 拖拽起止通知：拖拽期间父组件要禁用尺寸过渡动画，避免卡片滞后于鼠标 */
  onResizeStart?: () => void;
  onResizeEnd?: () => void;
}) {
  const resizeNode = useCanvasStore((s) => s.resizeNode);
  const zoom = useStore((s) => s.transform[2]);
  const start = React.useRef<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);

  return (
    <div
      title="拖拽调整卡片大小"
      className="nodrag nowheel absolute right-0 bottom-0 z-20 flex size-6 cursor-nwse-resize items-end justify-end p-1.5 text-white/20 opacity-0 transition group-hover/card:opacity-100 hover:text-white/70"
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        start.current = { x: e.clientX, y: e.clientY, w: cardW, h: cardH };
        e.currentTarget.setPointerCapture(e.pointerId);
        onResizeStart?.();
      }}
      onPointerMove={(e) => {
        const st = start.current;
        if (!st) return;
        const w = Math.round(
          Math.min(
            TEXT_CARD_MAX.w,
            Math.max(TEXT_CARD_MIN.w, st.w + (e.clientX - st.x) / zoom),
          ),
        );
        const h = Math.round(
          Math.min(
            TEXT_CARD_MAX.h,
            Math.max(TEXT_CARD_MIN.h, st.h + (e.clientY - st.y) / zoom),
          ),
        );
        resizeNode(id, { w, h });
      }}
      onPointerUp={(e) => {
        start.current = null;
        if (e.currentTarget.hasPointerCapture(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
        onResizeEnd?.();
      }}
      onPointerCancel={() => {
        start.current = null;
        onResizeEnd?.();
      }}
    >
      {/* 角落斜纹把手 */}
      <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
        <path
          d="M9 1.5 L1.5 9 M9 5.5 L5.5 9"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

function BaseNode({ id, data, selected }: NodeProps<FlowNode>) {
  const Icon = NODE_ICONS[data.kind];
  // 图片/视频按节点当前画幅比例算卡片尺寸（切比例 → 卡片跟着变）；
  // 返回值是**卡片尺寸**，总高还要加标签行与间距。其他种类为固定卡片尺寸。
  // 文本节点支持拖右下角自定义卡片尺寸（data.size 持久化）。
  const base = aspectCardSize(data.kind, data.params?.aspectRatio);
  const custom = data.kind === "text" ? data.size : undefined;
  const cardW = custom?.w ?? base.w;
  const cardH = custom?.h ?? base.h;
  const w = cardW;
  const h = cardH + NODE_LABEL_H + 6;
  const connectingFrom = useCanvasStore((s) => s.connectingFrom);
  const [leftOff, setLeftOff] = React.useState({ x: 0, y: 0 });
  const [rightOff, setRightOff] = React.useState({ x: 0, y: 0 });
  const [tilt, setTilt] = React.useState({ x: 0, y: 0 });
  const [dialogOpen, setDialogOpen] = React.useState(false);
  /** 正在拖拽右下角调大小（此期间禁用尺寸过渡，让卡片贴着鼠标走） */
  const [resizing, setResizing] = React.useState(false);
  const cardRef = React.useRef<HTMLDivElement>(null);

  const isConnectTarget = !!connectingFrom && connectingFrom !== id;

  /**
   * 端口行为（对齐 LibTV）：
   * - 鼠标在卡片内移动 → + 显示但停在垂直居中，不跟随
   * - 鼠标移出卡片 → + 在卡片外半径 HANDLE_RANGE 的半圆弧内跟随鼠标
   */
  const onPointerMove = (e: React.PointerEvent) => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();

    const inside =
      e.clientX >= r.left &&
      e.clientX <= r.right &&
      e.clientY >= r.top &&
      e.clientY <= r.bottom;

    const mx = e.clientX - r.left;
    const my = e.clientY - r.top;
    const cy = r.height / 2;
    const clamp = (v: number) =>
      Math.max(-HANDLE_RANGE, Math.min(HANDLE_RANGE, v));

    let lo = { x: 0, y: 0 };
    let ro = { x: 0, y: 0 };
    if (!inside) {
      const vy = clamp(my - cy);
      lo = { x: clamp(Math.min(0, mx)), y: vy }; // 只向外扩，不向内缩
      ro = { x: clamp(Math.max(0, mx - r.width)), y: vy };
    }
    setLeftOff((p) => (p.x !== lo.x || p.y !== lo.y ? lo : p));
    setRightOff((p) => (p.x !== ro.x || p.y !== ro.y ? ro : p));

    if (isConnectTarget) {
      const nx = (mx - r.width / 2) / (r.width / 2);
      const ny = (my - cy) / cy;
      setTilt({
        x: Math.max(-1, Math.min(1, nx)),
        y: Math.max(-1, Math.min(1, ny)),
      });
    }
  };

  const onPointerLeave = () => {
    setLeftOff({ x: 0, y: 0 });
    setRightOff({ x: 0, y: 0 });
    setTilt({ x: 0, y: 0 });
  };

  // 鼠标移入的方位在 3D 上后退：右/下侧远离视线
  const tiltStyle: React.CSSProperties =
    isConnectTarget && (tilt.x !== 0 || tilt.y !== 0)
      ? {
          transform: `perspective(1000px) rotateY(${(tilt.x * TILT_MAX).toFixed(2)}deg) rotateX(${(-tilt.y * TILT_MAX).toFixed(2)}deg)`,
          transformStyle: "preserve-3d",
          transition: "transform 90ms linear",
        }
      : {
          transform: "perspective(1000px) rotateY(0deg) rotateX(0deg)",
          transition: "transform 220ms ease-out",
        };

  const leftStyle: React.CSSProperties = {
    top: `calc(50% + ${leftOff.y}px)`,
    // 基准 0 = 端口中心正好落在卡片边框上，连线因此紧贴卡片没有空隙
    left: `${leftOff.x}px`,
  };
  const rightStyle: React.CSSProperties = {
    top: `calc(50% + ${rightOff.y}px)`,
    right: `${-rightOff.x}px`,
  };

  return (
    <div
      style={{
        width: w,
        height: h,
        // 切比例 / 调大小后的尺寸过渡；首帧不会触发（transition 不动画初始值）
        transition: resizing ? "none" : SIZE_TRANSITION,
      }}
      className="relative flex flex-col"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* 扩大的感应区：鼠标移出卡片一点（30px 半圆弧内）仍能驱动端口跟随 */}
      <div aria-hidden className="absolute -inset-x-9 -inset-y-2" />

      {/* 节点标签：高度锁 NODE_LABEL_H，避免图标撑开后卡片高度被挤掉 */}
      <div
        style={{ height: NODE_LABEL_H }}
        className="flex shrink-0 items-center gap-1.5 text-[12px] text-white/45"
      >
        <Icon className="size-3" strokeWidth={1.8} />
        <span className="truncate">
          {data.title}
          {data.index ? ` ${data.index}` : ""}
        </span>
        <StatusPill id={id} data={data} />
      </div>

      {/* 卡片 */}
      <div
        ref={cardRef}
        className={cn(
          "group/card relative mt-1.5 flex-1 rounded-xl border bg-[#262626]",
          isConnectTarget && tilt.x !== 0
            ? "border-primary/50 shadow-[0_0_0_1px_rgba(22,119,255,0.25)]"
            : selected
              ? "border-white/25 shadow-[0_0_0_1px_rgba(255,255,255,0.06),0_18px_40px_-12px_rgba(0,0,0,0.9)]"
              : "border-white/8 hover:border-white/16",
        )}
        style={{
          marginTop: 6,
          height: cardH,
          ...tiltStyle,
          // 尺寸过渡与 3D 倾斜过渡合并（tiltStyle.transition 只管 transform）
          transition: resizing
            ? tiltStyle.transition
            : `${SIZE_TRANSITION}, ${tiltStyle.transition}`,
        }}
      >
        <div className="h-full w-full overflow-hidden rounded-[11px]">
          <NodeBody data={data} />
        </div>
        <Handle
          type="target"
          position={Position.Left}
          style={leftStyle}
        />
        <Handle
          type="source"
          position={Position.Right}
          style={rightStyle}
        />
        {data.kind === "text" && (
          <CardResizeHandle
            id={id}
            cardW={cardW}
            cardH={cardH}
            onResizeStart={() => setResizing(true)}
            onResizeEnd={() => setResizing(false)}
          />
        )}
      </div>

      {selected && (
        <Composer id={id} data={data} onExpand={() => setDialogOpen(true)} />
      )}
      {dialogOpen && (
        <NodeEditorDialog
          id={id}
          data={data}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 分组节点                                                            */
/* ------------------------------------------------------------------ */

function GroupNode({ data, selected }: NodeProps<FlowNode>) {
  const runAll = useCanvasStore((s) => s.runAll);
  const ungroupSelected = useCanvasStore((s) => s.ungroupSelected);

  return (
    <div
      className={cn(
        "h-full w-full rounded-2xl border border-dashed transition",
        selected ? "border-primary/60 bg-primary/4" : "border-white/12 bg-white/2",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 text-[12px] text-white/45">
        <Layers className="size-3.5" />
        <span>{data.title}</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => runAll()}
            className="nodrag flex h-6 items-center gap-1 rounded-md bg-white/8 px-2 text-[11.5px] text-white/70 hover:bg-white/14"
          >
            <Sparkles className="size-3" />
            整组执行
          </button>
          <button
            onClick={() => ungroupSelected()}
            className="nodrag flex h-6 items-center rounded-md px-2 text-[11.5px] text-white/50 hover:bg-white/10"
          >
            解组
          </button>
          <button
            onClick={() =>
              window.dispatchEvent(new CustomEvent("aiteach:save-toolbox"))
            }
            className="nodrag flex h-6 items-center gap-1 rounded-md px-2 text-[11.5px] text-white/50 hover:bg-white/10"
          >
            <PackagePlus className="size-3" />
            存为工具
          </button>
        </div>
      </div>
    </div>
  );
}

export const nodeTypes = {
  text: BaseNode,
  image: BaseNode,
  video: BaseNode,
  audio: BaseNode,
  script: BaseNode,
  group: GroupNode,
};

export { BaseNode };
