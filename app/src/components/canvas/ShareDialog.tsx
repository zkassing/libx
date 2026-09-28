"use client";

import * as React from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
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

/**
 * 分享工作流弹窗。
 * 开启分享 → 后端发 shareToken → 拿到 `${origin}/share/${token}`。
 * 关掉分享 → 清 token，链接立刻失效（已经复制过的副本不受影响）。
 */
export function ShareDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const workflowId = useCanvasStore((s) => s.workflowId);
  const [token, setToken] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  /* 链接里的 origin 只能在客户端取，否则 SSR 会拿到空值 */
  const [origin, setOrigin] = React.useState("");

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrigin(window.location.origin);
  }, []);

  /* 打开时读一次当前分享状态（有没有 token / 标题） */
  React.useEffect(() => {
    if (!open || !workflowId) return;
    let alive = true;
    void (async () => {
      try {
        const res = await fetch(`/api/workflows/${workflowId}`);
        if (!res.ok) return;
        const j = (await res.json()) as {
          workflow?: { title?: string; shareToken?: string | null };
        };
        if (!alive) return;
        setToken(j.workflow?.shareToken ?? null);
        setTitle(j.workflow?.title ?? "");
      } catch {
        /* 读取失败就当作未分享，用户点开启会重新生成 */
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, workflowId]);

  const link = token ? `${origin}/share/${token}` : "";

  async function enableShare() {
    if (!workflowId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/share`, {
        method: "POST",
      });
      if (!res.ok) {
        setError(`生成分享链接失败（${res.status}）`);
        return;
      }
      const j = (await res.json()) as { token?: string };
      if (!j.token) {
        setError("生成分享链接失败：返回数据异常");
        return;
      }
      setToken(j.token);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // 非 https / 无权限时 clipboard 会拒绝：退化成手动选中
      const el = document.getElementById("share-link-input") as
        | HTMLInputElement
        | null;
      el?.select();
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function disableShare() {
    if (!workflowId || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflows/${workflowId}/share`, {
        method: "DELETE",
      });
      if (!res.ok) {
        setError(`关闭分享失败（${res.status}）`);
        return;
      }
      setToken(null);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle>分享工作流</DialogTitle>
          <DialogDescription>
            拿到链接的人可以预览{title ? `「${title}」` : "这份工作流"}
            并复制一份到自己的项目，不会影响你的原稿。
          </DialogDescription>
        </DialogHeader>

        <div className="py-1">
          {token ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <input
                  id="share-link-input"
                  readOnly
                  value={link}
                  onFocus={(e) => e.currentTarget.select()}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 text-[12.5px] text-white/80 outline-none focus:border-[#1677ff]/60"
                />
                <Button
                  onClick={copyLink}
                  className="h-9 shrink-0 gap-1.5 bg-[#1677ff] px-3 text-[12.5px] text-white hover:bg-[#3b8cff]"
                >
                  {copied ? (
                    <Check className="size-3.5" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copied ? "已复制" : "复制"}
                </Button>
              </div>
              <p className="text-[11.5px] text-white/35">
                链接已开启，任何拿到它的人都能访问。
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-4">
              <Link2 className="size-5 shrink-0 text-white/35" />
              <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-white/50">
                还没有开启分享。开启后会生成一条链接。
              </div>
            </div>
          )}

          {error && (
            <p className="mt-3 text-[12px] text-[#ff9c95]">{error}</p>
          )}
        </div>

        <DialogFooter className="gap-2">
          {token ? (
            <Button
              variant="ghost"
              onClick={disableShare}
              disabled={loading}
              className="text-[12.5px] text-[#ff9c95] hover:bg-[#f85149]/12 hover:text-[#ff9c95]"
            >
              关闭分享
            </Button>
          ) : (
            <Button
              onClick={enableShare}
              disabled={loading || !workflowId}
              className="gap-1.5 bg-[#1677ff] text-[12.5px] text-white hover:bg-[#3b8cff]"
            >
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              开启分享并生成链接
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
