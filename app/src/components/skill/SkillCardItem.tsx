"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Film,
  Image as ImageIcon,
  Star,
} from "lucide-react";
import type { SkillCard } from "@/lib/skillTypes";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Skill 卡片（对齐 LibTV：左封面 + 右文字/作者/使用）                    */
/* ------------------------------------------------------------------ */

export function SkillCardItem({
  skill,
  onOpen,
}: {
  skill: SkillCard;
  onOpen: (s: SkillCard) => void;
}) {
  return (
    <button
      onClick={() => onOpen(skill)}
      className={cn(
        "group flex overflow-hidden rounded-xl border border-white/8 bg-[#1c1c1f] text-left",
        "transition hover:border-white/20 hover:bg-[#202024]",
      )}
    >
      {/* 封面 */}
      <div className="relative h-[92px] w-[132px] shrink-0 overflow-hidden bg-[#2a2a2e]">
        {skill.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={skill.coverUrl}
            alt={skill.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <CoverPlaceholder category={skill.category} />
        )}
        {/* 角标：视频/图片 */}
        <span className="absolute left-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/85">
          {skill.outputKind === "video" ? (
            <Film className="size-2.5" />
          ) : (
            <ImageIcon className="size-2.5" />
          )}
          {skill.outputKind === "video" ? "视频" : "图片"}
        </span>
      </div>

      {/* 文字 */}
      <div className="min-w-0 flex-1 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-[13.5px] font-medium text-white/88 group-hover:text-white">
            {skill.name}
          </span>
          {skill.favorited && <Star className="size-3 shrink-0 fill-[#e8b339] text-[#e8b339]" />}
        </div>
        <div className="mt-1 line-clamp-2 text-[11.5px] leading-snug text-white/40">
          {skill.summary}
        </div>
        <div className="mt-1.5 flex items-center gap-2 text-[10.5px] text-white/30">
          <span className="truncate">{skill.authorName ?? "创作者"}</span>
          <span className="flex items-center gap-0.5">
            <ArrowUpRight className="size-2.5" />
            {skill.usageCount > 0 ? `${(skill.usageCount / 1000).toFixed(1)}k` : "新"}
          </span>
        </div>
      </div>
    </button>
  );
}

/* 无封面时的分类色块占位 */
function CoverPlaceholder({ category }: { category: string }) {
  const colors: Record<string, [string, string]> = {
    drama: ["#3a2e4a", "#6b5b8a"],
    film: ["#2e3a44", "#5b7286"],
    ad: ["#443a2e", "#8a7156"],
    music: ["#2e4438", "#5b8a6b"],
    social: ["#442e3a", "#8a5671"],
    general: ["#333338", "#66666f"],
    anime: ["#3a2e44", "#7a5b8a"],
  };
  const [a, b] = colors[category] ?? colors.general;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: `linear-gradient(135deg, ${a}, ${b})` }}
    >
      <Film className="size-6 text-white/30" />
    </div>
  );
}
