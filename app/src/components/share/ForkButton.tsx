"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 「复制到我的项目」按钮。
 * 未登录时后端返回 401 —— 这里把用户送去登录，并把当前分享页作为 from，
 * 登录完自动回到这一页再点一次（cookie 按 origin 隔离，换地址要重登一次）。
 */
export function ForkButton({ token }: { token: string }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function fork() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/share/${token}/fork`, { method: "POST" });
      if (res.status === 401) {
        router.push(`/login?from=/share/${token}`);
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        setError(j.error ?? `复制失败（${res.status}）`);
        return;
      }
      const j = (await res.json()) as { workflow?: { id: string } };
      if (!j.workflow?.id) {
        setError("复制失败：返回数据异常");
        return;
      }
      router.push(`/canvas/${j.workflow.id}`);
    } catch {
      setError("网络异常，复制失败，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        onClick={fork}
        disabled={loading}
        className="h-10 gap-2 bg-[#1677ff] px-6 text-[13.5px] font-medium text-white hover:bg-[#3b8cff]"
      >
        {loading && <Loader2 className="size-4 animate-spin" />}
        {loading ? "复制中…" : "复制到我的项目"}
      </Button>
      {error && <span className="text-[12px] text-[#ff9c95]">{error}</span>}
    </div>
  );
}
