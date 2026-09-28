"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasStore } from "@/stores/canvasStore";
import { cn } from "@/lib/utils";
import type { FlowNodeData, NodeMark } from "@/types";
import type { PresetGroup } from "@/lib/toolPresets";
import {
  Boxes,
  Check,
  Crosshair,
  ImageIcon,
  Loader2,
  Plus,
  Upload,
  UserRound,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Composer 工具条的弹出层（对齐 LibTV：特效 / 运镜 / 角色库 / 标记）     */
/* ------------------------------------------------------------------ */

const panelCls =
  "nodrag nowheel w-[300px] overflow-hidden rounded-xl border border-white/10 bg-[#191a1d]/97 shadow-2xl backdrop-blur-xl";

/* ------------------------- 特效 / 运镜：预设词 ------------------------- */

export function PresetPopover({
  groups,
  onPick,
  className,
}: {
  groups: PresetGroup[];
  onPick: (item: string) => void;
  className?: string;
}) {
  return (
    <div className={cn(panelCls, className)}>
      <div className="max-h-[264px] overflow-y-auto py-1">
        {groups.map((g) => (
          <div key={g.key}>
            <div className="px-3 pt-2 pb-1 text-[11px] text-white/35">
              {g.label}
            </div>
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {g.items.map((item) => (
                <button
                  key={item}
                  onClick={() => onPick(item)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[12px] text-white/75 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ 角色库 ------------------------------ */

export interface CharacterDto {
  id: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
}

export function CharacterPicker({
  onPick,
  className,
}: {
  onPick: (c: CharacterDto) => void;
  className?: string;
}) {
  const [list, setList] = React.useState<CharacterDto[] | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/characters")
      .then((r) => (r.ok ? r.json() : { characters: [] }))
      .then((j) => setList(j.characters ?? []))
      .catch(() => setList([]));
  }, []);

  return (
    <div className={cn(panelCls, className)}>
      <div className="max-h-[264px] overflow-y-auto py-1">
        <div className="px-3 pt-2 pb-1 text-[11px] text-white/35">我的角色</div>
        {list === null ? (
          <div className="flex items-center gap-2 px-3 py-3 text-[12px] text-white/40">
            <Loader2 className="size-3.5 animate-spin" /> 加载中…
          </div>
        ) : list.length === 0 ? (
          <div className="px-3 py-3 text-[12px] leading-relaxed text-white/40">
            还没有角色。新建一个，插入后生成时会在提示词里带上角色设定与参考图，保证形象一致。
          </div>
        ) : (
          list.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c)}
              className="flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12.5px] text-white/80 hover:bg-white/6"
            >
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={c.imageUrl}
                  alt={c.name}
                  className="size-7 shrink-0 rounded-md object-cover"
                />
              ) : (
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-white/8 text-white/45">
                  <UserRound className="size-3.5" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{c.name}</span>
                {c.description && (
                  <span className="block truncate text-[11px] text-white/35">
                    {c.description}
                  </span>
                )}
              </span>
              {c.imageUrl && (
                <span className="shrink-0 text-[10.5px] text-emerald-300/70">
                  含参考图
                </span>
              )}
            </button>
          ))
        )}
      </div>
      <button
        onClick={() => setDialogOpen(true)}
        className="flex w-full items-center gap-1.5 border-t border-white/8 px-3 py-2 text-[12px] text-white/60 hover:bg-white/6 hover:text-white"
      >
        <Plus className="size-3.5" /> 新建角色
      </button>

      <CharacterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={(c) => {
          setDialogOpen(false);
          onPick(c);
        }}
      />
    </div>
  );
}

/** 新建角色：名称 + 形象描述 + 参考图（可选，走资产上传） */
function CharacterDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: CharacterDto) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle className="text-[15px]">新建角色</DialogTitle>
        {/* 仅在打开时挂载表单：关闭即卸载，重开自然重置所有输入态 */}
        {open && (
          <CharacterForm
            onCreated={onCreated}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 新建角色表单（持有全部输入态，随 Dialog 开关挂载/卸载） */
function CharacterForm({
  onCreated,
  onCancel,
}: {
  onCreated: (c: CharacterDto) => void;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/assets/upload", {
        method: "POST",
        body: form,
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.asset?.url) throw new Error(j.error ?? "上传失败");
      setImageUrl(j.asset.url as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          imageUrl: imageUrl ?? undefined,
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.character) throw new Error(j.error ?? "创建失败");
      onCreated(j.character as CharacterDto);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3 pt-1">
          <div className="flex items-start gap-3">
            <button
              onClick={() => fileRef.current?.click()}
              className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-white/15 bg-white/4 text-white/35 hover:border-white/30 hover:text-white/60"
              title="上传参考图（可选）"
            >
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt="参考图"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Upload className="size-4" />
              )}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload(f);
                e.target.value = "";
              }}
            />
            <div className="flex-1 space-y-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="角色名，如 小满"
                maxLength={40}
                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/25"
              />
              <div className="text-[11px] text-white/35">
                参考图可选；有图时生成会作为图生图参考
              </div>
            </div>
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="形象描述：发型、服装、气质、标志性特征……（插入提示词时一并带给模型）"
            rows={4}
            maxLength={2000}
            className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[13px] leading-relaxed text-white/90 outline-none placeholder:text-white/30 focus:border-white/25"
          />
          {error && <div className="text-[12px] text-red-400">{error}</div>}
          <div className="flex justify-end gap-2">
            <button
              onClick={onCancel}
              className="rounded-lg px-3 py-1.5 text-[12.5px] text-white/60 hover:bg-white/8"
            >
              取消
            </button>
            <button
              onClick={() => void submit()}
              disabled={!name.trim() || busy}
              className="flex items-center gap-1.5 rounded-lg bg-[#1677ff] px-3.5 py-1.5 text-[12.5px] text-white disabled:opacity-40"
            >
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              创建并插入
            </button>
          </div>
    </div>
  );
}

/* ------------------------------ 标记 ------------------------------ */

/** 可标记的图片来源：本节点产物（image 节点）或上游已生成的图片节点 */
export interface MarkSource {
  nodeId: string;
  title: string;
  imageUrl: string;
  marks: NodeMark[];
}

/** 收集当前节点可标记/可引用的图片来源 */
export function useMarkSources(nodeId: string, data: FlowNodeData) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  return React.useMemo<MarkSource[]>(() => {
    const sources: MarkSource[] = [];
    const push = (id: string, title: string, d: FlowNodeData) => {
      const url = d.output?.urls?.[0];
      if (!url) return;
      sources.push({
        nodeId: id,
        title,
        imageUrl: url,
        marks: (d.marks ?? []).filter((m) => m.imageUrl === url),
      });
    };
    // 本节点已生成的图片产物
    if (data.kind === "image" && data.status === "succeeded") {
      push(nodeId, "本节点产物", data);
    }
    // 上游（连进本节点的）已生成图片节点
    const upIds = new Set(
      edges.filter((e) => e.target === nodeId).map((e) => e.source),
    );
    for (const n of nodes) {
      if (!upIds.has(n.id)) continue;
      const d = n.data as FlowNodeData;
      if (d.kind === "image" && d.status === "succeeded") {
        push(n.id, `${d.title}${d.index ? ` ${d.index}` : ""}`, d);
      }
    }
    return sources;
  }, [nodes, edges, nodeId, data]);
}

export function MarkPopover({
  sources,
  onPickMark,
  onCreateMark,
  className,
}: {
  sources: MarkSource[];
  onPickMark: (source: MarkSource, mark: NodeMark) => void;
  onCreateMark: (source: MarkSource) => void;
  className?: string;
}) {
  return (
    <div className={cn(panelCls, className)}>
      <div className="max-h-[280px] overflow-y-auto py-1">
        {sources.length === 0 ? (
          <div className="px-3 py-3 text-[12px] leading-relaxed text-white/40">
            没有可标记的图片。先生成一张图片（或连一个已生成的图片节点到本节点），再框选区域做标记。
          </div>
        ) : (
          sources.map((s) => (
            <div key={s.nodeId} className="px-3 pt-2 pb-1.5">
              <div className="flex items-center gap-2 pb-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={s.imageUrl}
                  alt={s.title}
                  className="size-8 rounded-md object-cover"
                />
                <span className="flex items-center gap-1 text-[11.5px] text-white/50">
                  <Boxes className="size-3" />
                  {s.title}
                </span>
                <button
                  onClick={() => onCreateMark(s)}
                  className="ml-auto flex items-center gap-1 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/55 hover:border-white/25 hover:text-white"
                >
                  <Crosshair className="size-3" /> 框选标记
                </button>
              </div>
              {s.marks.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {s.marks.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => onPickMark(s, m)}
                      className="flex items-center gap-1 rounded-md border border-emerald-400/25 bg-emerald-400/8 px-2 py-0.5 text-[11.5px] text-emerald-200/85 hover:border-emerald-300/50"
                    >
                      <ImageIcon className="size-3" />
                      {m.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * 框选标记 Dialog：在图片上拖出矩形 → AI 识别该区域内容 → 命名保存。
 * 标记保存在**来源图片节点**的 data.marks 上（随画布云同步）。
 */
export function MarkingDialog({
  source,
  open,
  onOpenChange,
  onDone,
}: {
  source: MarkSource | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** 保存成功回调：父组件负责写入来源节点 + 插入提示词 */
  onDone: (source: MarkSource, mark: NodeMark) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[88vw] p-0 sm:max-w-[560px]">
        <DialogTitle className="sr-only">框选标记</DialogTitle>
        {/* 打开且图片来源就绪时才挂载：关闭即卸载，重开自然重置拖拽/识别态 */}
        {open && source && (
          <MarkingBody
            source={source}
            onDone={(m) => {
              onDone(source, m);
              onOpenChange(false);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

/** 框选交互主体（持有全部拖拽/识别状态，随 Dialog 开关挂载/卸载） */
function MarkingBody({
  source,
  onDone,
}: {
  source: MarkSource;
  onDone: (mark: NodeMark) => void;
}) {
  const imgRef = React.useRef<HTMLImageElement>(null);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  /** 图片在容器里的实际绘制框（img 元素无显式宽高时，元素框==内容框） */
  const [imgBox, setImgBox] = React.useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);
  /** 正在拖拽的矩形（归一化） */
  const [drag, setDrag] = React.useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const startRef = React.useRef<{ x: number; y: number } | null>(null);
  const [identifying, setIdentifying] = React.useState(false);
  const [label, setLabel] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const measure = React.useCallback(() => {
    const wrap = wrapRef.current;
    const img = imgRef.current;
    if (!wrap || !img) return;
    const wr = wrap.getBoundingClientRect();
    const ir = img.getBoundingClientRect();
    setImgBox({
      left: ir.left - wr.left,
      top: ir.top - wr.top,
      width: ir.width,
      height: ir.height,
    });
  }, []);

  React.useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // 以 img 元素框为准（无显式宽高 → 元素框即图像内容框，坐标精确）
  const norm = (e: React.PointerEvent) => {
    const r = imgRef.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  };

  const identify = async (rect: NonNullable<typeof drag>) => {
    setIdentifying(true);
    setError(null);
    try {
      const res = await fetch("/api/marks/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl: source.imageUrl, rect }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok || !j.label) throw new Error(j.error ?? "识别失败");
      setLabel(j.label as string);
    } catch (e) {
      setError(e instanceof Error ? e.message : "识别失败，请手动命名");
    } finally {
      setIdentifying(false);
    }
  };

  const save = () => {
    if (!drag || !label.trim()) return;
    const mark: NodeMark = {
      id: `mark-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      imageUrl: source.imageUrl,
      rect: drag,
      label: label.trim().slice(0, 24),
    };
    onDone(mark);
  };

  return (
    <div className="space-y-3 p-4">
          <div className="text-[12.5px] text-white/55">
            在「{source.title}」的图片上<b>按住拖出矩形</b>框选要标记的区域，松开后
            AI 会自动识别该区域内容。
          </div>

          {/* 图片 + 框选层 */}
          <div
            ref={wrapRef}
            onPointerDown={(e) => {
              if (identifying || !imgRef.current) return;
              const p = norm(e);
              startRef.current = p;
              setDrag({ x: p.x, y: p.y, w: 0, h: 0 });
              setLabel("");
              setError(null);
              (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
            }}
            onPointerMove={(e) => {
              const s = startRef.current;
              if (!s) return;
              const p = norm(e);
              setDrag({
                x: Math.min(s.x, p.x),
                y: Math.min(s.y, p.y),
                w: Math.abs(p.x - s.x),
                h: Math.abs(p.y - s.y),
              });
            }}
            onPointerUp={() => {
              startRef.current = null;
              setDrag((d) => {
                // 太小的框视为误触
                if (d && d.w > 0.02 && d.h > 0.02) {
                  void identify(d);
                  return d;
                }
                return null;
              });
            }}
            className="relative flex max-h-[52vh] w-full touch-none items-center justify-center overflow-hidden rounded-xl bg-black select-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={source.imageUrl}
              alt={source.title}
              draggable={false}
              onLoad={measure}
              className="block max-h-[52vh] w-auto max-w-full object-contain"
            />
            {/* 已有标记 + 当前框选：叠在实测图片绘制框上 */}
            {imgBox && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: imgBox.left,
                  top: imgBox.top,
                  width: imgBox.width,
                  height: imgBox.height,
                }}
              >
                {source.marks.map((m) => (
                  <div
                    key={m.id}
                    className="absolute border border-white/45"
                    style={{
                      left: `${m.rect.x * 100}%`,
                      top: `${m.rect.y * 100}%`,
                      width: `${m.rect.w * 100}%`,
                      height: `${m.rect.h * 100}%`,
                    }}
                  >
                    <span className="absolute -bottom-6 left-0 rounded bg-black/70 px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-white/80">
                      {m.label}
                    </span>
                  </div>
                ))}
                {drag && drag.w > 0 && (
                  <div
                    className="absolute border-2 border-emerald-300 bg-emerald-300/10"
                    style={{
                      left: `${drag.x * 100}%`,
                      top: `${drag.y * 100}%`,
                      width: `${drag.w * 100}%`,
                      height: `${drag.h * 100}%`,
                    }}
                  />
                )}
              </div>
            )}
            {identifying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 text-[12.5px] text-white/85">
                <Loader2 className="mr-2 size-4 animate-spin" />
                AI 正在识别框选区域…
              </div>
            )}
          </div>

          {/* 命名 + 保存 */}
          {drag && drag.w > 0.02 && !identifying && (
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[12px] text-white/45">标记名</span>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="AI 识别中…也可直接手动命名"
                maxLength={24}
                autoFocus
                className="min-w-0 flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[13px] text-white/90 outline-none placeholder:text-white/30 focus:border-white/25"
                onKeyDown={(e) => {
                  if (e.key === "Enter") save();
                }}
              />
              <button
                onClick={save}
                disabled={!label.trim()}
                className="flex shrink-0 items-center gap-1 rounded-lg bg-[#1677ff] px-3 py-1.5 text-[12.5px] text-white disabled:opacity-40"
              >
                <Check className="size-3.5" /> 保存并插入
              </button>
              <button
                onClick={() => {
                  setDrag(null);
                  setLabel("");
                }}
                className="shrink-0 rounded-lg p-1.5 text-white/50 hover:bg-white/8"
              >
                <X className="size-4" />
              </button>
            </div>
          )}
          {error && <div className="text-[12px] text-red-400">{error}</div>}
    </div>
  );
}
