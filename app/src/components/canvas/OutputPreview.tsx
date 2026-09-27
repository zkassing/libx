"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Maximize2, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NodeOutput } from "@/types";

/* ------------------------------------------------------------------ */
/* OutputPreview：节点内产物预览（T2.7）                                 */
/* ------------------------------------------------------------------ */
/* 统一渲染文本 / 图片 / 视频 / 音频产物：                                 */
/*  - 卡片内自适应显示；hover 右下角出现「放大」按钮；                     */
/*  - 点击放大进入 Dialog，大图/原生 <video>/<audio> 可直接播放；          */
/*  - 文本产物等宽显示，放大后可滚动查看全文。                             */
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

/** 卡片内的单条媒体 */
function MediaInner({
  url,
  kind,
  large,
}: {
  url: string;
  kind: NodeOutput["kind"];
  large?: boolean;
}) {
  // SVG 占位产物（Mock）：图片/视频统一当图显示，视频叠一个播放钮
  const asImage = isImageUrl(url) || (kind === "video" && url.startsWith("data:image"));
  const asVideo = isVideoUrl(url);
  const asAudio = isAudioUrl(url);

  if (asVideo) {
    return (
      <video
        src={url}
        controls={large}
        autoPlay={large}
        className="h-full w-full object-contain"
      />
    );
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
        <img src={url} alt="产物" className="h-full w-full object-contain" />
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
  className,
}: {
  output: NodeOutput;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className={cn("group/preview relative h-full w-full", className)}>
      {/* 文本产物 */}
      {output.text !== undefined && (
        <pre className="no-scrollbar h-full w-full overflow-auto whitespace-pre-wrap break-all p-4 text-left font-mono text-[11.5px] leading-relaxed text-emerald-300/85">
          {output.text}
        </pre>
      )}

      {/* 媒体产物 */}
      {output.urls?.length && (
        <div className="h-full w-full">
          <MediaInner url={output.urls[0]} kind={output.kind} />
        </div>
      )}

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
              <pre className="no-scrollbar h-full w-full overflow-auto whitespace-pre-wrap break-all p-6 text-left font-mono text-[13px] leading-relaxed text-emerald-300/90">
                {output.text}
              </pre>
            ) : output.urls?.length ? (
              <MediaInner url={output.urls[0]} kind={output.kind} large />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
