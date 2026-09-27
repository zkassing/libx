"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Boxes,
  FolderKanban,
  Images,
  LogOut,
  Plus,
  Puzzle,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/** 全局左侧导航（Agent / 项目 / 资产 / 插件），仿 LibTV */
export function GlobalNav({ onNewProject }: { onNewProject: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex h-full w-[208px] shrink-0 flex-col border-r border-white/8 bg-[#17171a] px-3 py-4">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1677ff] text-[15px] font-bold text-white">
          AI
        </div>
        <span className="text-[15px] font-semibold tracking-wide text-white">AI 创作台</span>
      </div>

      {/* 新建 */}
      <button
        onClick={onNewProject}
        className="mb-4 flex items-center justify-center gap-1.5 rounded-lg bg-[#1677ff] px-3 py-2 text-[13px] font-medium text-white transition hover:bg-[#3b8cff]"
      >
        <Plus className="h-4 w-4" />
        新建项目
      </button>

      {/* 创作工具 */}
      <div className="space-y-1.5">
        <NavLink
          href="/skill"
          icon={Sparkles}
          label="AI Agent"
          active={pathname.startsWith("/skill")}
        />
        <NavLink
          href="/project"
          icon={FolderKanban}
          label="项目"
          active={pathname === "/project" || pathname === "/"}
        />
        <NavLink
          href="/assets"
          icon={Images}
          label="资产"
          active={pathname.startsWith("/assets")}
        />
        <NavLink href="#" icon={Puzzle} label="插件与扩展" disabled />
      </div>

      {/* 底部 */}
      <div className="mt-auto space-y-1.5 border-t border-white/8 pt-4">
        <button
          onClick={() => router.push("/canvas")}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <Sparkles className="h-4 w-4" />
          快速进入画布
        </button>
        <button
          onClick={() => router.push("/login")}
          className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
          退出登录
        </button>
        <div className="flex items-center gap-2 px-2.5 pt-1 text-[11px] text-white/30">
          <Boxes className="h-3.5 w-3.5" />
          <span>AI 影视与内容创作工作台</span>
        </div>
      </div>
    </nav>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  active,
  disabled,
}: {
  href: string;
  icon: typeof Boxes;
  label: string;
  active?: boolean;
  disabled?: boolean;
}) {
  const cls = cn(
    "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] transition",
    active
      ? "bg-white/10 font-medium text-white"
      : "text-white/60 hover:bg-white/5 hover:text-white",
    disabled && "cursor-not-allowed text-white/25 hover:bg-transparent",
  );
  if (disabled) {
    return (
      <span className={cls} title="后续里程碑开放">
        <Icon className="h-4 w-4" />
        {label}
      </span>
    );
  }
  return (
    <Link href={href} className={cls}>
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}
