"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, Play, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeMark, NodeOutput } from "@/types";

/* ------------------------------------------------------------------ */
/* OutputPreview：节点内产物预览（T2.7）                                 */
/* ------------------------------------------------------------------ */
/* 统一渲染文本 / 图片 / 视频 / 音频产物：                                 */
/*  - 卡片内自适应显示；hover 右下角出现「放大」按钮；                     */
/*  - 点击放大进入 Dialog，大图/原生 <video>/<audio> 可直接播放；          */
/*  - 文本产物等宽显示，放大后可滚动查看全文；                             */
/*  - text/script 产物带动作契约时，走 LibTV 风格结构化字段视图。             */
/* ------------------------------------------------------------------ */

function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(url) || url.startsWith("data:image");
}
function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) || url.startsWith("data:video");
}
function isAudioUrl(url: string) {
  return /\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url) || url.startsWith("data:audio");
}

/* --------------- 文本/脚本产物：LibTV 风格结构化字段视图 --------------- */

/**
 * 从 output.text 里剥掉 `/* --- ... --- *\/` 注释块（上游上下文 / 分镜附录），
 * 取出正文文案。mock 的 text 是一个 JSON blob，不作为正文展示。
 */
function bodyText(text?: string): string {
  const t = (text ?? "").replace(/\/\* ---[\s\S]*?\*\//g, "").trim();
  return t && !t.startsWith("{") ? t : "";
}

function StructField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <div className="font-mono text-[10px] tracking-wider text-white/35">
        {label}
      </div>
      {children}
    </div>
  );
}

/**
 * 对齐 LibTV 文本节点的结构化输出 `{action, action_input, supplementary}`：
 * 以字段视图呈现动作契约；正文文案与分镜数量作为附加区块。
 * 数据全部来自 NodeOutput（action / shots / text），mock 与真实厂商一致。
 */
function StructuredTextOutput({
  output,
  large,
}: {
  output: NodeOutput;
  large?: boolean;
}) {
  const action = output.action!;
  const body = bodyText(output.text);
  const supp = Object.entries(action.supplementary ?? {}).filter(
    ([, v]) => v !== undefined && String(v).trim() !== "",
  );

  return (
    <div
      className={cn(
        "nodrag nowheel h-full w-full overflow-auto text-left",
        large ? "p-6" : "p-4",
      )}
    >
      <div className="flex flex-col gap-3.5">
        {/* action */}
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
            <Zap className="size-3" />
            {action.action}
          </span>
          {!!output.shots?.length && (
            <span className="text-[10.5px] text-white/40">
              分镜 {output.shots.length} 镜
            </span>
          )}
        </div>

        {/* action_input：给下游直接可用的完整提示词 */}
        <StructField label="action_input">
          <p
            className={cn(
              "whitespace-pre-wrap break-all font-mono leading-relaxed text-emerald-300/85",
              large ? "text-[13px]" : "text-[11.5px]",
            )}
          >
            {action.action_input}
          </p>
        </StructField>

        {/* supplementary：风格 / 画幅等参数建议 */}
        {supp.length > 0 && (
          <StructField label="supplementary">
            <div className="flex flex-wrap gap-1.5">
              {supp.map(([k, v]) => (
                <span
                  key={k}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10.5px] text-white/60"
                >
                  {k}: {String(v)}
                </span>
              ))}
            </div>
          </StructField>
        )}

        {/* text：整体文案 / 口播稿（有正文时才显示） */}
        {body && (
          <StructField label="text">
            <p
              className={cn(
                "whitespace-pre-wrap break-all leading-relaxed text-white/75",
                large ? "text-[13.5px]" : "text-[12px]",
              )}
            >
              {body}
            </p>
          </StructField>
        )}
      </div>
    </div>
  );
}

/* ------------------------- 图片上的区域标记框 ------------------------- */

/**
 * 把归一化矩形标记叠到 object-contain 图片上：
 * object-contain 会留黑边，标记框必须按图片实际绘制框换算，
 * 这里用 img 元素的 getBoundingClientRect 实测（加载与尺寸变化时都重算）。
 */
function MarkOverlay({ url, marks }: { url: string; marks?: NodeMark[] }) {
  const list = (marks ?? []).filter((m) => m.imageUrl === url);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    if (!list.length) return;
    const container = containerRef.current;
    const img = container?.querySelector("img");
    if (!container || !img) return;

    const measure = () => {
      const cr = container.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      setBox({
        left: ir.left - cr.left,
        top: ir.top - cr.top,
        width: ir.width,
        height: ir.height,
      });
    };
    measure();
    img.addEventListener("load", measure);
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    return () => {
      img.removeEventListener("load", measure);
      ro.disconnect();
    };
  }, [list.length, url]);

  if (!list.length || !box) return null;

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0">
      {list.map((m) => (
        <div
          key={m.id}
          className="absolute border border-white/60"
          style={{
            left: box.left + m.rect.x * box.width,
            top: box.top + m.rect.y * box.height,
            width: m.rect.w * box.width,
            height: m.rect.h * box.height,
          }}
        >
          <span className="absolute -bottom-5 left-0 rounded bg-black/75 px-1 py-px text-[9.5px] whitespace-nowrap text-white/85">
            {m.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 卡片内的单条媒体 */
/* ------------------------------------------------------------------ */
/* InlineVideo：节点卡片内联视频 —— 点击播放/暂停（对齐 LibTV），          */
/* 暂停时中央播放钮；放大（large）时用原生 controls 自动播放。             */
/* ------------------------------------------------------------------ */
function InlineVideo({
  url,
  large,
  onImageSize,
}: {
  url: string;
  large?: boolean;
  onImageSize?: (s: { w: number; h: number }) => void;
}) {
  const ref = React.useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = React.useState(false);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const v = ref.current;
    if (!v) return;
    if (v.paused) {
      void v.play().catch(() => {});
    } else {
      v.pause();
    }
  };

  return (
    // 注意：不能加 nodrag——产物区几乎占满卡片，加了整个节点都拖不动；
    // React Flow 要拖动才会拖节点，纯点击（无位移）正常触发播放。
    <div className="relative h-full w-full bg-black/40">
      <video
        ref={ref}
        src={url}
        controls={large}
        autoPlay={large}
        loop={!large}
        playsInline
        className="h-full w-full object-contain"
        onClick={large ? undefined : toggle}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && onImageSize) {
            onImageSize({ w: v.videoWidth, h: v.videoHeight });
          }
        }}
      />
      {/* AI 生成角标（对齐 LibTV，与图片一致） */}
      <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur">
        AI生成
      </span>
      {/* 暂停态播放钮（点击同区域即播放） */}
      {!large && !playing && (
        <button
          type="button"
          onClick={toggle}
          title="播放"
          className="absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/20"
        >
          <Play className="size-10 fill-white/85 text-transparent drop-shadow" />
        </button>
      )}
    </div>
  );
}

function MediaInner({
  url,
  kind,
  large,
  marks,
  onImageSize,
}: {
  url: string;
  kind: NodeOutput["kind"];
  large?: boolean;
  marks?: NodeMark[];
  onImageSize?: (s: { w: number; h: number }) => void;
}) {
  // SVG 占位产物（Mock）：图片/视频统一当图显示，视频叠一个播放钮
  const asImage = isImageUrl(url) || (kind === "video" && url.startsWith("data:image"));
  const asVideo = isVideoUrl(url);
  const asAudio = isAudioUrl(url);

  if (asVideo) {
    return <InlineVideo url={url} large={large} onImageSize={onImageSize} />;
  }
  if (asAudio) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-4">
        <audio src={url} controls className="w-full" />
      </div>
    );
  }
  if (asImage) {
    return (
      <div className="relative h-full w-full bg-black/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt="产物"
          className="h-full w-full object-contain"
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && onImageSize) {
              onImageSize({ w: img.naturalWidth, h: img.naturalHeight });
            }
          }}
        />
        {/* AI 生成角标（对齐 LibTV） */}
        <span className="pointer-events-none absolute top-1.5 left-1.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/70 backdrop-blur">
          AI生成
        </span>
        {/* 区域标记框（LibTV 标记）：实测图片绘制框后按归一化矩形叠放 */}
        <MarkOverlay url={url} marks={marks} />
        {kind === "video" && !large && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
            <Play className="size-10 fill-white/85 text-transparent drop-shadow" />
          </div>
        )}
      </div>
    );
  }
  // 兜底
  return (
    <div className="flex h-full items-center justify-center text-[12px] text-white/40">
      无法预览此产物
    </div>
  );
}

export function OutputPreview({
  output,
  marks,
  className,
  onImageSize,
}: {
  output: NodeOutput;
  /** 图片节点产物上的区域标记（LibTV 标记） */
  marks?: NodeMark[];
  className?: string;
  /** 图片加载后回传像素尺寸（节点标题行展示 2048 × 1152） */
  onImageSize?: (s: { w: number; h: number }) => void;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("group/preview relative h-full w-full", className)}>
      {/* 文本产物：内容超出自动出滚动条；
          nodrag/nowheel 让滚轮与滚动条操作作用于文本本身，不拖节点、不缩放画布。
          带动作契约（text/script 节点）时走 LibTV 风格结构化字段视图 */}
      {output.text !== undefined &&
        (output.action ? (
          <StructuredTextOutput output={output} />
        ) : (
          <pre className="nodrag nowheel h-full w-full overflow-auto whitespace-pre-wrap break-all p-4 text-left font-mono text-[11.5px] leading-relaxed text-emerald-300/85">
            {output.text}
          </pre>
        ))}

      {/* 媒体产物：多张时宫格展示（LibTV 生成 2/4 张为宫格） */}
      {output.urls?.length ? (
        output.urls.length > 1 ? (
          <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white/5">
            {output.urls.slice(0, 4).map((u) => (
              <div key={u} className="relative min-h-0 min-w-0 overflow-hidden">
                <MediaInner url={u} kind={output.kind} marks={marks} onImageSize={onImageSize} />
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full w-full">
            <MediaInner url={output.urls[0]} kind={output.kind} marks={marks} onImageSize={onImageSize} />
          </div>
        )
      ) : null}

      {/* hover 放大按钮 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        title="放大预览"
        className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg border border-white/10 bg-black/55 text-white/75 opacity-0 backdrop-blur transition group-hover/preview:opacity-100 hover:text-white"
      >
        <Maximize2 className="size-3.5" />
      </button>

      {/* 放大 Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[88vw] p-0 sm:max-w-[88vw]">
          <DialogTitle className="sr-only">产物预览</DialogTitle>
          <div className="h-[80vh] w-full overflow-hidden rounded-xl bg-black">
            {output.text !== undefined ? (
              output.action ? (
                <StructuredTextOutput output={output} large />
              ) : (
                <pre className="no-scrollbar h-full w-full overflow-auto whitespace-pre-wrap break-all p-6 text-left font-mono text-[13px] leading-relaxed text-emerald-300/90">
                  {output.text}
                </pre>
              )
            ) : output.urls?.length ? (
              <MediaInner url={output.urls[0]} kind={output.kind} marks={marks} large />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
