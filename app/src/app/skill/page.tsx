"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Search, X } from "lucide-react";
import { GlobalNav } from "@/components/home/GlobalNav";
import { SkillCardItem } from "@/components/skill/SkillCardItem";
import { SkillDetailDialog } from "@/components/skill/SkillDetailDialog";
import type { SkillCard, SkillDetail } from "@/lib/skillTypes";

/* ------------------------------------------------------------------ */
/* /skill —— Skill 市场（对齐 LibTV）                                    */
/* 顶部：创作灵感大输入框；下方：Skill/收藏/我的 + 分类 + 卡片网格          */
/* ------------------------------------------------------------------ */

/** 分类 chips：显示名 → API category（推荐=all） */
const CATEGORY_CHIPS: Array<{ label: string; value: string }> = [
  { label: "推荐", value: "all" },
  { label: "专业影视", value: "film" },
  { label: "商业广告", value: "ad" },
  { label: "短剧漫剧", value: "drama" },
  { label: "动漫游戏", value: "anime" },
  { label: "音乐 MV", value: "music" },
  { label: "自媒体创作", value: "social" },
  { label: "通用技能", value: "general" },
];

/** 顶部 tab → API source */
const TABS: Array<{ label: string; value: "all" | "favorite" | "mine" }> = [
  { label: "Skill", value: "all" },
  { label: "收藏", value: "favorite" },
  { label: "我的", value: "mine" },
];

export default function SkillMarketPage() {
  const router = useRouter();

  const [tab, setTab] = React.useState<"all" | "favorite" | "mine">("all");
  const [category, setCategory] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [debouncedQ, setDebouncedQ] = React.useState("");

  const [skills, setSkills] = React.useState<SkillCard[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [authNote, setAuthNote] = React.useState(false);

  const [opened, setOpened] = React.useState<SkillCard | null>(null);
  const [loadedSkill, setLoadedSkill] = React.useState<SkillDetail | null>(null);
  const [inspiration, setInspiration] = React.useState("");

  // 搜索防抖
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(search.trim()), 250);
    return () => clearTimeout(t);
  }, [search]);

  // 拉列表
  const load = React.useCallback(async () => {
    setLoading(true);
    setAuthNote(false);
    const params = new URLSearchParams();
    params.set("source", tab);
    if (tab === "all" && category !== "all") params.set("category", category);
    if (debouncedQ) params.set("q", debouncedQ);

    const res = await fetch(`/api/skills?${params.toString()}`);
    if (res.status === 401) {
      setAuthNote(true);
      setSkills([]);
    } else if (res.ok) {
      const j = (await res.json()) as { skills: SkillCard[] };
      setSkills(j.skills);
    }
    setLoading(false);
  }, [tab, category, debouncedQ]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // 收藏 / 取消
  const toggleFavorite = React.useCallback(
    async (slug: string, next: boolean) => {
      const res = await fetch(`/api/skills/${slug}/favorite`, {
        method: next ? "POST" : "DELETE",
      });
      if (res.ok) {
        setSkills((list) =>
          list.map((s) => (s.slug === slug ? { ...s, favorited: next } : s)),
        );
        setOpened((o) => (o?.slug === slug ? { ...o, favorited: next } : o));
      }
    },
    [],
  );

  // 添加 Skill → 加载到顶部输入框（真正驱动画布在下一步）
  const handleAdd = React.useCallback((s: SkillDetail) => {
    setLoadedSkill(s);
    setOpened(null);
  }, []);

  const [starting, setStarting] = React.useState(false);
  const [startError, setStartError] = React.useState<string | null>(null);

  // 发送：用 Skill + 灵感创建项目并跳转画布
  const handleStart = React.useCallback(async () => {
    if (!loadedSkill || !inspiration.trim() || starting) return;
    setStarting(true);
    setStartError(null);
    try {
      const res = await fetch(
        `/api/skills/${loadedSkill.slug}/start`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ inspiration: inspiration.trim() }),
        },
      );
      if (res.status === 401) {
        setStartError("请先登录后再开始创作");
        return;
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as
          | { error?: string }
          | null;
        setStartError(j?.error ?? "启动失败，请重试");
        return;
      }
      const j = (await res.json()) as { workflowId: string };
      router.push(`/canvas/${j.workflowId}`);
    } finally {
      setStarting(false);
    }
  }, [loadedSkill, inspiration, starting, router]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#141414] text-white">
      <GlobalNav
        onNewProject={() => {
          router.push("/canvas");
        }}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        {/* 顶部：标题 + 灵感输入框 */}
        <div className="flex flex-col items-center px-8 pt-10">
          <h1 className="mb-5 text-[26px] font-semibold tracking-wide">
            一个 Skill，打开一种可能
          </h1>

          <div className="w-full max-w-[720px]">
            {/* 已加载 Skill 提示 */}
            {loadedSkill && (
              <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12.5px]">
                <span className="truncate text-white/70">
                  已加载「{loadedSkill.name}」，等待你的输入
                </span>
                <button
                  onClick={() => setLoadedSkill(null)}
                  className="ml-2 text-white/40 hover:text-white"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-[#1c1c1f] p-3 shadow-lg transition focus-within:border-white/25">
              <textarea
                value={inspiration}
                onChange={(e) => setInspiration(e.target.value)}
                rows={2}
                placeholder="请输入你的创作灵感，或从下方挑选一个 Skill 开始"
                className="w-full resize-none bg-transparent px-1 text-[13.5px] text-white/90 placeholder:text-white/30 focus:outline-none"
              />
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1 text-white/35">
                  <span className="flex size-7 items-center justify-center rounded-md hover:bg-white/8 hover:text-white/70">
                    +
                  </span>
                </div>
                <button
                  aria-label="发送"
                  disabled={!loadedSkill || inspiration.trim().length === 0 || starting}
                  onClick={() => void handleStart()}
                  className={[
                    "flex size-8 items-center justify-center rounded-full transition",
                    loadedSkill && inspiration.trim() && !starting
                      ? "bg-white text-black hover:bg-white/85"
                      : "cursor-not-allowed bg-white/10 text-white/30",
                  ].join(" ")}
                  title={loadedSkill ? "开始创作" : "请先添加一个 Skill"}
                >
                  {starting ? (
                    <span className="size-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
                  ) : (
                    <ArrowUp className="size-4" />
                  )}
                </button>
              </div>
              {startError && (
                <div className="mt-2 text-[12px] text-red-400">{startError}</div>
              )}
            </div>
          </div>
        </div>

        {/* 下方：tab + 分类 + 网格 */}
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto px-8 pb-10">
          <div className="mx-auto max-w-[1080px]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              {/* 左：tab */}
              <div className="flex items-center gap-4">
                {TABS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTab(t.value)}
                    className={[
                      "pb-1 text-[14px] transition",
                      tab === t.value
                        ? "border-b-2 border-white font-medium text-white"
                        : "text-white/45 hover:text-white/75",
                    ].join(" ")}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* 右：搜索 */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-white/30" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索 Skill"
                  className="h-8 w-56 rounded-lg border border-white/10 bg-[#1c1c1f] pl-8 pr-2 text-[12.5px] text-white/85 placeholder:text-white/30 focus:border-white/25 focus:outline-none"
                />
              </div>
            </div>

            {/* 分类 chips（仅 Skill tab 显示） */}
            {tab === "all" && (
              <div className="mt-4 flex flex-wrap gap-2">
                {CATEGORY_CHIPS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setCategory(c.value)}
                    className={[
                      "rounded-lg px-3 py-1.5 text-[12px] transition",
                      category === c.value
                        ? "bg-white/15 font-medium text-white"
                        : "bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80",
                    ].join(" ")}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}

            {/* 网格 */}
            <div className="mt-5">
              {authNote ? (
                <div className="py-16 text-center text-[13px] text-white/45">
                  请先登录后查看收藏 / 我的 Skill
                </div>
              ) : loading ? (
                <div className="py-16 text-center text-[13px] text-white/35">
                  加载中…
                </div>
              ) : skills.length === 0 ? (
                <div className="py-16 text-center text-[13px] text-white/40">
                  {tab === "mine"
                    ? "还没有发布自己的 Skill"
                    : tab === "favorite"
                      ? "还没有收藏 Skill"
                      : "没有符合条件的 Skill"}
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {skills.map((s) => (
                    <SkillCardItem key={s.id} skill={s} onOpen={setOpened} />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <SkillDetailDialog
        skill={opened}
        onClose={() => setOpened(null)}
        onAdd={handleAdd}
        onToggleFavorite={toggleFavorite}
      />
    </div>
  );
}
