"use client";

import * as React from "react";
import {
  Film,
  Image as ImageIcon,
  Link2,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SkillCard, SkillDetail } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* Skill 详情弹窗（对齐 LibTV）                                          */
/* 简介表格：介绍 / 使用场景 / 如何使用 / 输出内容                        */
/* 操作：复制链接 / 收藏 / 添加 Skill                                    */
/* ------------------------------------------------------------------ */

export function SkillDetailDialog({
  skill,
  onClose,
  onAdd,
  onToggleFavorite,
}: {
  /** 卡片用于即时展示，详情（含 outputs/template）异步加载 */
  skill: SkillCard | SkillDetail | null;
  onClose: () => void;
  onAdd: (s: SkillDetail) => void;
  onToggleFavorite: (slug: string, next: boolean) => void;
}) {
  const [detail, setDetail] = React.useState<SkillDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  const open = !!skill;
  const slug = skill?.slug;

  React.useEffect(() => {
    if (!slug) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/skills/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j?.skill) setDetail(j.skill as SkillDetail);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const shown: SkillCard | SkillDetail | null = detail ?? skill;
  const isFav = shown?.favorited ?? false;
  const rows: Array<[string, string | null]> = shown
    ? [
        ["介绍", "summary" in shown ? shown.summary : null],
        ["使用场景", (shown as SkillDetail).scenes],
        ["如何使用", (shown as SkillDetail).howTo],
        ["输出内容", (shown as SkillDetail).outputs],
      ]
    : [];

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent className="gap-0 p-0 sm:max-w-lg">
        {shown && (
          <>
            <DialogHeader className="px-5 pb-3 pt-5">
              <DialogTitle asChild>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-[16px] text-white">{shown.name}</div>
                    <div className="mt-1.5 flex items-center gap-2 text-[11px] text-white/40">
                      <span>{shown.authorName ?? "创作者"}</span>
                      <span>·</span>
                      <span>{shown.category}</span>
                      <span>·</span>
                      <span className="flex items-center gap-0.5">
                        {shown.outputKind === "video" ? (
                          <Film className="size-3" />
                        ) : (
                          <ImageIcon className="size-3" />
                        )}
                        {shown.usageCount > 0 ? `${shown.usageCount}` : "新"}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>

            {/* 上排操作 */}
            <div className="flex items-center gap-2 px-5">
              <Button
                variant="outline"
                size="icon-sm"
                className="size-8"
                title="复制链接"
                onClick={() => {
                  const url = `${window.location.origin}/skill/${shown.slug}`;
                  void navigator.clipboard?.writeText(url);
                }}
              >
                <Link2 className="size-3.5" />
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="size-8"
                title={isFav ? "取消收藏" : "收藏"}
                onClick={() => onToggleFavorite(shown.slug, !isFav)}
              >
                <Star
                  className={
                    isFav
                      ? "size-3.5 fill-[#e8b339] text-[#e8b339]"
                      : "size-3.5"
                  }
                />
              </Button>
              <Button
                size="sm"
                className="ml-auto h-8 text-[12.5px]"
                disabled={loading || !detail}
                onClick={() => detail && onAdd(detail)}
              >
                添加 Skill
              </Button>
            </div>

            {/* 简介表格 */}
            <div className="mt-4 px-5 pb-5">
              <div className="mb-2 text-[12.5px] font-medium text-white/80">简介</div>
              <dl className="space-y-2.5">
                {rows.map(([label, value]) => (
                  <div key={label} className="flex gap-3 text-[12px]">
                    <dt className="w-16 shrink-0 text-white/40">{label}</dt>
                    <dd className="min-w-0 flex-1 text-white/75">
                      {value || "—"}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
