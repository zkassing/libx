"use client";

import * as React from "react";
import type { Node } from "@xyflow/react";
import {
  ChevronLeft,
  ChevronRight,
  Film,
  Pause,
  Play,
  X,
} from "lucide-react";
import type { StoryboardEntry } from "@/lib/storyboard";
import type { FlowNodeData } from "@/types";

/* ------------------------------------------------------------------ */
/* P5 串联成片（Mock 期）：按镜头顺序顺序播放所有已生成视频。               */
/* M6 接真实管线时在此替换为真实拼接产物，UI 不变。                        */
/* ------------------------------------------------------------------ */

interface Clip {
  index: number;
  url: string;
  scene: string;
  duration: number;
}

export function FinalFilmDialog({
  entries,
  nodes,
  onClose,
}: {
  entries: StoryboardEntry[];
  nodes: Node<FlowNodeData>[];
  onClose: () => void;
}) {
  // 汇总所有有视频产物的镜头，按镜头顺序排列
  const clips = React.useMemo<Clip[]>(() => {
    const list: Clip[] = [];
    for (const e of entries) {
      for (const s of e.shots) {
        if (!s.videoNodeId) continue;
        const node = nodes.find((n) => n.id === s.videoNodeId);
        const url = node?.data.output?.urls?.[0];
        if (url) list.push({ index: s.index, url, scene: s.scene, duration: s.duration });
      }
    }
    return list.sort((a, b) => a.index - b.index);
  }, [entries, nodes]);

  const [cur, setCur] = React.useState(0);
  const [playing, setPlaying] = React.useState(true);
  const videoRef = React.useRef<HTMLVideoElement>(null);

  // 切换播放状态
  React.useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    if (playing) void v.play().catch(() => {});
    else v.pause();
  }, [playing, cur]);

  const goPrev = React.useCallback(() => {
    setCur((c) => Math.max(0, c - 1));
    setPlaying(true);
  }, []);
  const goNext = React.useCallback(() => {
    setCur((c) => Math.min(clips.length - 1, c + 1));
    setPlaying(true);
  }, [clips.length]);

  const totalSec = clips.reduce((a, c) => a + c.duration, 0);
  const clip = clips[cur];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm">
      <div className="flex max-h-full w-full max-w-[960px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1f] shadow-2xl">
        {/* 头 */}
        <div className="flex items-center gap-2 border-b border-white/8 px-5 py-3">
          <Film className="size-4 text-white/60" />
          <span className="text-[14px] font-medium text-white">成片预览</span>
          <span className="text-[11.5px] text-white/40">
            {clips.length} 个镜头 · 约 {totalSec} 秒
          </span>
          <button
            onClick={onClose}
            className="ml-auto flex size-7 items-center justify-center rounded-lg text-white/50 transition hover:bg-white/8 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>

        {clips.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Film className="size-7 text-white/25" />
            <div className="text-[13px] text-white/50">还没有可串联的镜头视频</div>
            <div className="text-[11.5px] text-white/35">
              先在故事板里生成至少一个镜头视频
            </div>
          </div>
        ) : (
          <>
            {/* 播放器 */}
            <div className="relative bg-black">
              <video
                ref={videoRef}
                key={clip.url}
                src={clip.url}
                className="aspect-video w-full"
                autoPlay
                muted
                playsInline
                onEnded={() => {
                  if (cur < clips.length - 1) goNext();
                  else setPlaying(false);
                }}
              />
              {/* 控制条 */}
              <div className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/80 to-transparent px-4 py-3">
                <button
                  onClick={() => setPlaying((p) => !p)}
                  className="flex size-8 items-center justify-center rounded-full bg-white/90 text-black transition hover:bg-white"
                >
                  {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
                </button>
                <button
                  onClick={goPrev}
                  disabled={cur === 0}
                  className="text-white/80 transition hover:text-white disabled:text-white/30"
                >
                  <ChevronLeft className="size-5" />
                </button>
                <button
                  onClick={goNext}
                  disabled={cur === clips.length - 1}
                  className="text-white/80 transition hover:text-white disabled:text-white/30"
                >
                  <ChevronRight className="size-5" />
                </button>
                <span className="text-[12px] text-white/80">
                  镜头 {clip.index}
                </span>
                <span className="ml-auto text-[11.5px] text-white/55">
                  {cur + 1} / {clips.length}
                </span>
              </div>
            </div>

            <div className="truncate px-5 py-2.5 text-[12px] text-white/55">
              {clip.scene}
            </div>

            {/* 镜头条 */}
            <div className="flex gap-2 overflow-x-auto border-t border-white/8 px-5 py-3">
              {clips.map((c, i) => (
                <button
                  key={c.url}
                  onClick={() => { setCur(i); setPlaying(true); }}
                  className={[
                    "relative size-16 shrink-0 overflow-hidden rounded-lg border-2 transition",
                    i === cur ? "border-[#1677ff]" : "border-transparent opacity-60 hover:opacity-100",
                  ].join(" ")}
                >
                  <video src={c.url} className="size-full object-cover" muted preload="metadata" />
                  <span className="absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[9px] text-white">
                    {c.index}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
