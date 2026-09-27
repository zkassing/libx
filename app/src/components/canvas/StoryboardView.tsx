"use client";

import * as React from "react";
import {
  ArrowLeft,
  Check,
  Clapperboard,
  Play,
} from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import {
  collectStoryboard,
  totalShots,
  confirmedShots,
} from "@/lib/storyboard";
import type { Shot, ShotFraming } from "@/types";

/* ------------------------------------------------------------------ */
/* StoryboardView：分镜表格（P2，对齐 LibTV 故事板）                      */
/* ------------------------------------------------------------------ */

const FRAMINGS: ShotFraming[] = ["远景", "全景", "中景", "近景", "特写"];

export function StoryboardView() {
  const nodes = useCanvasStore((s) => s.nodes);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const setViewMode = useCanvasPrefs((s) => s.setViewMode);

  const entries = React.useMemo(() => collectStoryboard(nodes), [nodes]);
  const total = totalShots(entries);
  const confirmed = confirmedShots(entries);

  /** 更新某来源节点里的单个镜头 */
  const updateShot = (
    nodeId: string,
    shotId: string,
    patch: Partial<Shot>,
  ) => {
    const node = nodes.find((n) => n.id === nodeId);
    const prev = node?.data?.output?.shots ?? [];
    const shots = prev.map((s) => (s.id === shotId ? { ...s, ...patch } : s));
    updateNodeData(nodeId, {
      output: { ...node!.data!.output!, shots },
    });
  };

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-[#141414]">
      {/* 顶栏 */}
      <div className="flex items-center gap-3 border-b border-white/8 px-5 py-3">
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
        <div className="ml-auto flex items-center gap-3 text-[12px] text-white/45">
          <span>
            已确认 <span className="text-white/80">{confirmed}</span> / {total}
          </span>
          {/* 后续步骤占位 */}
          <button
            aria-disabled="true"
            className="flex h-8 cursor-not-allowed items-center gap-1 rounded-lg px-2 text-white/25"
            title="P3 接入：按确认镜头生成分镜图"
          >
            <Play className="size-3.5" />
            生成分镜
          </button>
        </div>
      </div>

      {/* 内容 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
        {entries.length === 0 ? (
          <EmptyStoryboard onBack={() => setViewMode("workflow")} />
        ) : (
          <div className="mx-auto max-w-[1080px] space-y-8">
            {entries.map((entry) => (
              <section key={entry.nodeId}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="text-[13.5px] font-medium text-white/85">
                    {entry.nodeTitle}
                  </span>
                  <span className="text-[11.5px] text-white/35">
                    {entry.shots.length} 个镜头
                  </span>
                </div>
                <div className="space-y-2">
                  {entry.shots.map((shot) => (
                    <ShotRow
                      key={shot.id}
                      shot={shot}
                      onChange={(patch) => updateShot(entry.nodeId, shot.id, patch)}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* 单个镜头行 */
function ShotRow({
  shot,
  onChange,
}: {
  shot: Shot;
  onChange: (patch: Partial<Shot>) => void;
}) {
  return (
    <div
      className={[
        "flex items-stretch gap-3 rounded-xl border bg-[#1c1c1f] p-3 transition",
        shot.confirmed ? "border-[#1677ff]/40" : "border-white/8",
      ].join(" ")}
    >
      {/* 镜头号 + 确认 */}
      <div className="flex w-12 shrink-0 flex-col items-center justify-center gap-1.5">
        <span className="text-[15px] font-semibold text-white/80">
          {shot.index}
        </span>
        <button
          onClick={() => onChange({ confirmed: !shot.confirmed })}
          className={[
            "flex size-5 items-center justify-center rounded border transition",
            shot.confirmed
              ? "border-[#1677ff] bg-[#1677ff] text-white"
              : "border-white/25 text-transparent hover:border-white/50",
          ].join(" ")}
          title={shot.confirmed ? "取消确认" : "确认该镜头"}
        >
          <Check className="size-3" />
        </button>
      </div>

      {/* 中间：画面 + 台词 */}
      <div className="min-w-0 flex-1 space-y-1.5">
        <input
          value={shot.scene}
          onChange={(e) => onChange({ scene: e.target.value })}
          placeholder="画面内容"
          className="h-7 w-full rounded-md border border-white/8 bg-white/4 px-2 text-[12.5px] text-white/85 placeholder:text-white/25 focus:border-white/25 focus:outline-none"
        />
        <input
          value={shot.dialogue}
          onChange={(e) => onChange({ dialogue: e.target.value })}
          placeholder="台词 / 旁白（可空）"
          className="h-7 w-full rounded-md border border-white/8 bg-white/4 px-2 text-[12px] text-white/70 placeholder:text-white/25 focus:border-white/25 focus:outline-none"
        />
      </div>

      {/* 右：景别 / 运镜 / 时长 */}
      <div className="flex w-44 shrink-0 flex-col justify-between gap-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={shot.framing}
            onChange={(e) => onChange({ framing: e.target.value as ShotFraming })}
            className="h-7 flex-1 rounded-md border border-white/8 bg-[#262626] px-1.5 text-[11.5px] text-white/80 focus:outline-none"
          >
            {FRAMINGS.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
        <input
          value={shot.camera}
          onChange={(e) => onChange({ camera: e.target.value })}
          placeholder="运镜"
          className="h-7 rounded-md border border-white/8 bg-white/4 px-2 text-[11.5px] text-white/70 placeholder:text-white/25 focus:border-white/25 focus:outline-none"
        />
        <div className="flex items-center gap-1 text-[11px] text-white/45">
          <input
            type="number"
            min={1}
            max={30}
            value={shot.duration}
            onChange={(e) => onChange({ duration: Number(e.target.value) || 1 })}
            className="h-7 w-14 rounded-md border border-white/8 bg-white/4 px-1.5 text-[11.5px] text-white/75 focus:outline-none"
          />
          秒
        </div>
      </div>
    </div>
  );
}

/* 空态 */
function EmptyStoryboard({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
      <Clapperboard className="size-10 text-white/20" />
      <div className="text-[14px] text-white/55">还没有分镜</div>
      <div className="max-w-sm text-[12px] leading-relaxed text-white/35">
        回到工作流，运行一个文本或剧本节点，它会自动产出结构化分镜；
        之后在这里逐镜确认与修改。
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
