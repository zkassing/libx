"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  FolderKanban,
  Images,
  Loader2,
  LogIn,
  LogOut,
  Plus,
  Puzzle,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/** 全局左侧导航（Agent / 项目 / 资产 / 插件 + 账户），仿 LibTV */
export function GlobalNav({ onNewProject }: { onNewProject: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <nav className="flex h-full w-[208px] shrink-0 flex-col border-r border-white/8 bg-[#17171a] px-3 py-4">
      {/* Logo */}
      <div className="mb-5 flex items-center gap-2 px-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1677ff] text-white">
          {/* 墨点 */}
          <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
            <circle cx="8" cy="10.5" r="5" fill="#fff" />
            <circle cx="14.6" cy="4.4" r="1.7" fill="#fff" />
          </svg>
        </div>
        <span className="text-[15px] font-semibold tracking-wide text-white">墨点 MoDot</span>
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

      {/* 底部：快速进入画布 + 当前登录账户 */}
      <div className="mt-auto space-y-1.5 border-t border-white/8 pt-4">
        <button
          onClick={() => router.push("/canvas")}
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white"
        >
          <Sparkles className="h-4 w-4" />
          快速进入画布
        </button>
        <AccountMenu />
      </div>
    </nav>
  );
}

/** 左下角当前登录账户：头像 + 昵称 + 邮箱，点开可退出登录 */
function AccountMenu() {
  const { data: session, status } = useSession();
  const user = session?.user;

  if (status === "loading") {
    return (
      <div className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[12.5px] text-white/30">
        <Loader2 className="h-4 w-4 animate-spin" />
        加载账户…
      </div>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-[13px] text-white/60 transition hover:bg-white/5 hover:text-white"
      >
        <LogIn className="h-4 w-4" />
        未登录 · 去登录
      </Link>
    );
  }

  const initial = (user.name ?? user.email ?? "?").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-white/5"
          aria-label="账号菜单"
        >
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt={user.name ?? "用户头像"}
              className="size-7 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-[12px] font-medium text-white">
              {initial}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12.5px] text-white">
              {user.name ?? "未命名用户"}
            </div>
            <div className="truncate text-[10.5px] text-white/40">{user.email}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-52">
        <div className="px-2 py-1.5 text-[11px] text-white/35">{user.email}</div>
        <DropdownMenuItem
          onSelect={() => signOut({ redirectTo: "/login" })}
          className="text-red-300 focus:text-red-200"
        >
          <LogOut className="size-3.5" />
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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
  icon: LucideIcon;
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
