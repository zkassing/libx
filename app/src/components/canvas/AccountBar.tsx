"use client";

import * as React from "react";
import {
  Coins,
  Crown,
  HelpCircle,
  Loader2,
  LogOut,
  Share2,
  User as UserIcon,
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ShortcutsDialog } from "@/components/canvas/ShortcutsDialog";
import { useCanvasStore } from "@/stores/canvasStore";

/** 画布右上角浮条：保存状态 + 分享 + 帮助 + 会员 + 积分 + 账号（对齐 LibTV） */
export function AccountBar() {
  const cloudStatus = useCanvasStore((s) => s.cloudStatus);
  const savedAt = useCanvasStore((s) => s.savedAt);
  const { data: session } = useSession();
  const user = session?.user;
  const [helpOpen, setHelpOpen] = React.useState(false);

  return (
    <header className="pointer-events-none absolute top-3 right-4 z-30 flex items-center gap-2">
      <div className="pointer-events-auto">
        <SavePill status={cloudStatus} savedAt={savedAt} />
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="pointer-events-auto flex size-8 cursor-not-allowed items-center justify-center rounded-lg text-white/25"
            aria-disabled="true"
            aria-label="分享"
          >
            <Share2 className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>分享链接 · M3 接入</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setHelpOpen(true)}
            className="pointer-events-auto flex size-8 items-center justify-center rounded-lg text-white/55 transition hover:bg-white/8 hover:text-white"
            aria-label="帮助"
          >
            <HelpCircle className="size-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>快捷键与操作说明</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            className="pointer-events-auto flex h-8 cursor-not-allowed items-center gap-1.5 rounded-full bg-white/8 px-3 text-[12.5px] text-white/35"
            aria-disabled="true"
            aria-label="开通会员"
          >
            <Crown className="size-3.5" />
            开通会员
          </button>
        </TooltipTrigger>
        <TooltipContent>会员体系 · v1 后置</TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="pointer-events-auto flex h-8 items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 text-[12.5px] text-amber-200/80">
            <Coins className="size-3.5" />
            1000
          </div>
        </TooltipTrigger>
        <TooltipContent>积分 · Mock 期不扣费</TooltipContent>
      </Tooltip>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="pointer-events-auto relative flex items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            aria-label="账号菜单"
          >
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.image}
                alt={user.name ?? "用户头像"}
                className="size-8 rounded-full object-cover"
              />
            ) : (
              <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-[13px] font-medium text-white">
                {(user?.name ?? user?.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-[#0a0a0b] bg-emerald-400" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <div className="flex items-start gap-2 px-2 py-2">
            <UserIcon className="mt-0.5 size-4 shrink-0 text-white/40" />
            <div className="min-w-0">
              <div className="truncate text-[13px] text-white">
                {user?.name ?? "未命名老师"}
              </div>
              <div className="truncate text-[11.5px] text-white/40">
                {user?.email}
              </div>
            </div>
          </div>
          <DropdownMenuItem
            onSelect={() => signOut({ redirectTo: "/login" })}
            className="text-red-300 focus:text-red-200"
          >
            <LogOut className="size-3.5" />
            退出登录
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ShortcutsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </header>
  );
}

/** 保存状态小药丸 */
function SavePill({ status, savedAt }: { status: string; savedAt: string | null }) {
  if (status === "loading" || status === "saving") {
    return (
      <span className="flex items-center gap-1.5 rounded-full bg-white/6 px-2.5 py-1.5 text-[11.5px] text-white/50">
        <Loader2 className="size-3 animate-spin" />
        {status === "loading" ? "加载中" : "保存中"}
      </span>
    );
  }
  if (status === "error") {
    return <span className="px-1 text-[11.5px] text-red-300">保存失败</span>;
  }
  if (status === "saved" && savedAt) {
    const time = new Date(savedAt).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return <span className="px-1 text-[11.5px] text-white/35">已保存 {time}</span>;
  }
  return null;
}
