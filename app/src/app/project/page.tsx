"use client";

import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import * as React from "react";
import {
  Archive,
  ChevronLeft,
  FolderPlus,
  ImageIcon,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { GlobalNav } from "@/components/home/GlobalNav";

type ProjectCard = {
  id: string;
  title: string;
  coverUrl: string | null;
  updatedAt: string;
  _count: { nodes: number };
};

export default function ProjectHomePage() {
  const router = useRouter();
  const [projects, setProjects] = React.useState<ProjectCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [query, setQuery] = React.useState("");
  const [creating, setCreating] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  /** 会话失效（未登录 / 账号已不存在）：清掉 cookie 再去登录，避免被 middleware 弹回画布卡死 */
  const gotoLogin = React.useCallback(async () => {
    await signOut({ redirect: false }).catch(() => {});
    router.replace("/login?from=/project");
  }, [router]);

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/workflows");
      if (res.status === 401) {
        await gotoLogin();
        return;
      }
      if (!res.ok) {
        setError(`加载项目失败（${res.status}），请刷新重试`);
        return;
      }
      const j = (await res.json()) as { workflows: ProjectCard[] };
      setProjects(j.workflows);
    } catch {
      setError("网络异常，加载项目失败");
    } finally {
      setLoading(false);
    }
  }, [gotoLogin]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createProject() {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workflows", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "未命名项目" }),
      });
      if (res.status === 401) {
        await gotoLogin();
        return;
      }
      if (!res.ok) {
        setError(`创建项目失败（${res.status}），请重试`);
        return;
      }
      const j = (await res.json()) as { workflow?: { id: string } };
      if (!j.workflow?.id) {
        setError("创建项目失败：返回数据异常");
        return;
      }
      router.push(`/canvas/${j.workflow.id}`);
    } catch {
      setError("网络异常，创建项目失败，请重试");
    } finally {
      setCreating(false);
    }
  }

  async function removeProject(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const ok = window.confirm("确定删除这个项目？画布与节点会一并删除。");
    if (!ok) return;
    const res = await fetch(`/api/workflows/${id}`, { method: "DELETE" });
    if (res.ok) void load();
  }

  const shown = query.trim()
    ? projects.filter((p) => p.title.toLowerCase().includes(query.trim().toLowerCase()))
    : projects;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#141414] text-white">
      <GlobalNav onNewProject={createProject} />

      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* 顶栏 */}
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-white/8 bg-[#141414]/90 px-8 py-3.5 backdrop-blur">
          <button
            onClick={() => router.push("/project")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/60 transition hover:bg-white/8 hover:text-white"
            title="返回"
          >
            <ChevronLeft className="h-4.5 w-4.5" />
          </button>
          <span className="text-[15px] font-medium text-white">全部项目</span>

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <Search className="h-4 w-4 text-white/40" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索项目"
                className="w-44 bg-transparent text-[13px] text-white placeholder:text-white/30 focus:outline-none"
              />
            </div>
            <TopBtn icon={Archive} label="回收站" disabled title="回收站 · 后续开放" />
            <TopBtn icon={FolderPlus} label="新建文件夹" disabled title="文件夹 · 后续开放" />
          </div>
        </header>

        <div className="flex-1 px-8 py-7">
          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#f85149]/35 bg-[#f85149]/10 px-3.5 py-2.5 text-[12.5px] text-[#ff9c95]">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => router.refresh()}
                className="rounded border border-[#f85149]/40 px-2 py-0.5 text-[11.5px] transition hover:bg-[#f85149]/15"
              >
                刷新
              </button>
            </div>
          )}
          {loading ? (
            <div className="text-[13px] text-white/40">加载中…</div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-x-6 gap-y-8">
              {/* 开始创作卡（卡片+下方说明，同项目卡排版） */}
              <div>
                <button
                  onClick={createProject}
                  disabled={creating}
                  className="group flex aspect-[16/10] w-full flex-col items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] text-white/40 transition hover:border-[#1677ff]/60 hover:text-[#1677ff] disabled:cursor-wait disabled:opacity-60"
                >
                  {creating ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <Plus className="h-6 w-6" />
                  )}
                  <span className="text-[13px]">{creating ? "创建中…" : "开始创作"}</span>
                </button>
                <div className="mt-2 truncate px-0.5 text-[13px] text-white/55">创建新的视频项目</div>
              </div>

              {shown.map((p) => (
                <div key={p.id} className="group cursor-pointer" onClick={() => router.push(`/canvas/${p.id}`)}>
                  <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-white/8 bg-[#232323] transition group-hover:border-white/20">
                    {p.coverUrl ? (
                      // 产物为 SVG data URL / 动态上传地址，不适用 next/image
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.coverUrl}
                        alt={p.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-white/20">
                        <ImageIcon className="h-9 w-9" />
                      </div>
                    )}
                    <button
                      onClick={(e) => removeProject(e, p.id)}
                      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/55 text-white/70 opacity-0 transition hover:bg-red-500/80 hover:text-white group-hover:opacity-100"
                      title="删除项目"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 px-0.5">
                    <div className="truncate text-[13px] font-medium text-white/90">{p.title}</div>
                    <div className="mt-1 text-[11px] text-white/35">{formatDate(p.updatedAt)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loading && shown.length > 0 && (
            <div className="py-10 text-center text-[12px] text-white/30">没有更多了</div>
          )}

          {!loading && shown.length === 0 && (
            <div className="py-20 text-center text-[13px] text-white/35">
              还没有项目，点左上角「新建项目」开始第一张画布
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function TopBtn({
  icon: Icon,
  label,
  disabled,
  title,
}: {
  icon: typeof Archive;
  label: string;
  disabled?: boolean;
  title: string;
}) {
  return (
    <button
      aria-disabled={disabled}
      title={title}
      className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12.5px] text-white/50 transition hover:bg-white/10 aria-disabled:cursor-not-allowed aria-disabled:opacity-60 aria-disabled:hover:bg-white/5"
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
