"use client";

import * as React from "react";
import { CornerUpLeft, History, Redo2, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { HISTORY_LABEL_TEXT, useCanvasStore } from "@/stores/canvasStore";
import { cn } from "@/lib/utils";

function timeAgo(at: number) {
  const diff = Date.now() - at;
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  return new Date(at).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const label = (k: string) => HISTORY_LABEL_TEXT[k] ?? k;

export function HistoryPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const past = useCanvasStore((s) => s.past);
  const future = useCanvasStore((s) => s.future);
  const undo = useCanvasStore((s) => s.undo);
  const redo = useCanvasStore((s) => s.redo);
  const jumpHistory = useCanvasStore((s) => s.jumpHistory);
  const liveNodes = useCanvasStore((s) => s.nodes.length);
  const liveEdges = useCanvasStore((s) => s.edges.length);

  // 展示顺序：最早 → 最近，最后追加“当前”一行
  const rows = React.useMemo(
    () => [...past].reverse(),
    [past],
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[380px] flex-col gap-0 p-0 sm:max-w-[380px]"
      >
        <SheetHeader className="shrink-0 border-b border-white/8 px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-[14px]">
            <History className="size-4 text-white/60" />
            历史记录
          </SheetTitle>
          <SheetDescription className="text-[12px]">
            每一步都可以跳回（最多保留 60 步，刷新后清空）
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {/* 当前状态 */}
          <div className="mb-1 flex items-center gap-2 rounded-lg border border-primary/35 bg-primary/8 px-2.5 py-2 text-[12.5px]">
            <span className="size-1.5 rounded-full bg-primary" />
            <span className="font-medium text-white/85">当前</span>
            <span className="text-white/45">
              {liveNodes} 节点 · {liveEdges} 连线
            </span>
          </div>

          {rows.length === 0 && (
            <p className="px-2 py-6 text-center text-[12.5px] text-white/35">
              还没有可回溯的操作
            </p>
          )}

          {rows.map((entry, i) => {
            // rows 是倒序的，i=0 对应 past 的最后一条
            const pastIndex = past.length - 1 - i;
            return (
              <button
                key={`${entry.at}-${entry.label}-${pastIndex}`}
                onClick={() => jumpHistory(pastIndex)}
                className={cn(
                  "group flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] transition",
                  "text-white/60 hover:bg-white/8 hover:text-white",
                )}
              >
                <span className="w-9 shrink-0 font-mono text-[11px] text-white/30">
                  #{pastIndex + 1}
                </span>
                <span className="flex-1 truncate">{label(entry.label)}</span>
                <span className="shrink-0 text-[11px] text-white/28">
                  {timeAgo(entry.at)}
                </span>
                <CornerUpLeft className="size-3.5 shrink-0 text-white/25 group-hover:text-white/70" />
              </button>
            );
          })}

          {future.length > 0 && (
            <>
              <div className="mt-3 mb-1 px-2.5 text-[11px] text-white/30">
                已撤销（可重做）
              </div>
              {future.map((entry, i) => (
                <div
                  key={`${entry.at}-f-${i}`}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12.5px] text-white/32"
                >
                  <span className="w-9 shrink-0 font-mono text-[11px] text-white/20">
                    ↷
                  </span>
                  <span className="flex-1 truncate">{label(entry.label)}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <SheetFooter className="shrink-0 flex-row gap-2 border-t border-white/8 px-4 py-3">
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={past.length === 0}
            onClick={undo}
          >
            <Undo2 className="size-3.5" />
            撤销
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="flex-1"
            disabled={future.length === 0}
            onClick={redo}
          >
            <Redo2 className="size-3.5" />
            重做
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
