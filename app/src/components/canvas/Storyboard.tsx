"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clapperboard,
  Download,
  Image as ImageIcon,
  LocateFixed,
  Music,
  RotateCw,
  ScrollText,
  Type as TypeIcon,
  Video as VideoIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCanvasStore } from "@/stores/canvasStore";
import { cn } from "@/lib/utils";
import { displayNodeTitle } from "@/lib/nodeTypes";

const KIND_ICON = {
  text: TypeIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: Music,
  script: ScrollText,
} as const;

/**
 * 故事板：把整个画布的节点产物按顺序汇总成「确认台」。
 * LibTV 的故事板是导出前的确认页；教学场景下也是学生的产出汇总。
 */
export function StoryboardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const runNode = useCanvasStore((s) => s.runNode);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const steps = nodes.filter((n) => n.type !== "group");

  const done = steps.filter((n) => n.data.status === "succeeded").length;

  const locate = (id: string) => {
    onOpenChange(false);
    setSelected(id);
    // 由底部坞/外层在 Dialog 关闭后做 fitView；这里先选中
    setTimeout(() => {
      const evt = new CustomEvent("aiteach:focus-node", { detail: { id } });
      window.dispatchEvent(evt);
    }, 120);
  };

  const download = (url: string, name: string) => {
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Clapperboard className="size-4 text-white/60" />
            故事板
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            按画布顺序确认每个节点的产物 · 已完成 {done} / {steps.length} 步
          </DialogDescription>
        </DialogHeader>

        {steps.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <Clapperboard className="size-8 text-white/25" />
            <div className="text-[13px] text-white/45">还没有任何节点</div>
            <div className="text-[12px] text-white/30">
              先在画布上添加节点并运行
            </div>
          </div>
        ) : (
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {steps.map((n, i) => {
              const d = n.data;
              const Icon = KIND_ICON[d.kind];
              const hasImage = d.output?.urls?.length;
              const hasText = d.output?.text;
              const ok = d.status === "succeeded";
              const running = d.status === "running";

              return (
                <div
                  key={n.id}
                  className={cn(
                    "flex gap-3 rounded-xl border p-2.5 transition",
                    ok
                      ? "border-white/12 bg-[#151517]"
                      : "border-white/7 bg-[#121214]",
                  )}
                >
                  {/* 序号 */}
                  <div className="flex w-7 shrink-0 flex-col items-center gap-1 pt-1">
                    <span className="flex size-6 items-center justify-center rounded-full border border-white/12 text-[11.5px] text-white/55">
                      {i + 1}
                    </span>
                  </div>

                  {/* 预览 */}
                  <div className="flex size-[92px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/8 bg-[#0e0e10]">
                    {hasImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={d.output!.urls![0]}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : hasText ? (
                      <pre className="no-scrollbar h-full w-full overflow-hidden p-2 font-mono text-[8.5px] leading-tight text-emerald-300/80">
                        {d.output!.text}
                      </pre>
                    ) : (
                      Icon && (
                        <Icon
                          className="size-6 text-white/20"
                          strokeWidth={1.5}
                        />
                      )
                    )}
                  </div>

                  {/* 信息 + 操作 */}
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13px] font-medium text-white/85">
                        {displayNodeTitle(d)}
                      </span>
                      {ok ? (
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400/90" />
                      ) : running ? (
                        <span className="shrink-0 text-[11px] text-primary">
                          {d.progress}%
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] text-white/30">
                          未完成
                        </span>
                      )}
                    </div>

                    <div className="line-clamp-2 text-[11.5px] leading-relaxed text-white/38">
                      {d.prompt || "（没有填写提示词）"}
                    </div>

                    <div className="mt-auto flex items-center gap-1.5 pt-0.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11.5px]"
                        onClick={() => locate(n.id)}
                      >
                        <LocateFixed className="size-3" />
                        定位节点
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11.5px]"
                        onClick={() => runNode(n.id)}
                        disabled={running}
                      >
                        <RotateCw className="size-3" />
                        {running ? "生成中" : "重新生成"}
                      </Button>
                      {hasImage && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-[11.5px] text-white/55"
                          onClick={() =>
                            download(
                              d.output!.urls![0],
                              `${d.title}${d.index ?? ""}.svg`,
                            )
                          }
                        >
                          <Download className="size-3" />
                          下载
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DialogFooter className="items-center">
          <div className="mr-auto text-[11.5px] text-white/35">
            {done === steps.length && steps.length > 0
              ? "全部完成，可以导出 / 提交了"
              : `还有 ${steps.length - done} 步未完成`}
          </div>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
