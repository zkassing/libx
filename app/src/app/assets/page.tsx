"use client";

import * as React from "react";
import {
  Clock,
  Download,
  Heart,
  Images,
  Layers,
  Play,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { GlobalNav } from "@/components/home/GlobalNav";
import { useRouter } from "next/navigation";

type Asset = {
  id: string;
  source: string;
  kind: "image" | "video" | "audio" | "text";
  title: string;
  url: string | null;
  text: string | null;
  workflowId: string | null;
  nodeId: string | null;
  rating: number | null;
  createdAt: string;
};

type TabKey = "history" | "library";
type KindFilter = "all" | "image" | "video" | "audio";

export default function AssetsHomePage() {
  const router = useRouter();
  const [tab, setTab] = React.useState<TabKey>("history");
  const [kind, setKind] = React.useState<KindFilter>("all");
  const [history, setHistory] = React.useState<Asset[]>([]);
  const [library, setLibrary] = React.useState<Asset[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    const [h, l] = await Promise.all([
      fetch("/api/assets?source=generated").then((r) => r.json()) as Promise<{ assets: Asset[] }>,
      fetch("/api/assets?source=library").then((r) => r.json()) as Promise<{ assets: Asset[] }>,
    ]);
    setHistory(h.assets);
    setLibrary(l.assets);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const list = tab === "history" ? history : library;
  const filtered = kind === "all" ? list : list.filter((a) => a.kind === kind);
  const groups = groupByDate(filtered);

  const counts = {
    image: history.filter((a) => a.kind === "image").length,
    video: history.filter((a) => a.kind === "video").length,
    audio: history.filter((a) => a.kind === "audio").length,
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#141414] text-white">
      <GlobalNav
        onNewProject={() => {
          router.push("/project");
        }}
      />

      {/* 主区 */}
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center gap-4 border-b border-white/8 bg-[#141414]/90 px-8 py-4 backdrop-blur">
          <h1 className="text-[15px] font-semibold">
            {tab === "history" ? "生成历史" : "个人资产库"}
          </h1>
          {tab === "history" ? (
            <div className="flex items-center gap-1">
              {(["all", "image", "video", "audio"] as KindFilter[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={
                    kind === k
                      ? "rounded-full bg-white/12 px-3 py-1 text-[12px] font-medium text-white"
                      : "rounded-full px-3 py-1 text-[12px] text-white/45 hover:bg-white/5 hover:text-white"
                  }
                >
                  {k === "all"
                    ? "全部"
                    : k === "image"
                      ? `图片 ${counts.image}`
                      : k === "video"
                        ? `视频 ${counts.video}`
                        : `音频 ${counts.audio}`}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5">
              <Search className="h-4 w-4 text-white/40" />
              <input
                placeholder="搜索资产"
                className="w-44 bg-transparent text-[13px] placeholder:text-white/30 focus:outline-none"
              />
            </div>
          )}
        </header>

        <div className="flex-1 px-8 py-6">
          {loading ? (
            <div className="text-[13px] text-white/40">加载中…</div>
          ) : filtered.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <div className="space-y-8">
              {groups.map((g) => (
                <section key={g.date}>
                  <div className="mb-3 text-[12px] font-medium text-white/40">{g.date}</div>
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-4">
                    {g.items.map((a) => (
                      <AssetCard
                        key={a.id}
                        asset={a}
                        inLibrary={tab === "library"}
                        onChange={() => void load()}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* 右侧二级面板 */}
      <aside className="flex w-[248px] shrink-0 flex-col border-l border-white/8 bg-[#17171a] px-3 py-4">
        <SideItem
          active={tab === "history"}
          icon={Clock}
          label="生成历史"
          count={history.length}
          onClick={() => setTab("history")}
        />
        <SideItem
          active={tab === "library"}
          icon={Layers}
          label="个人资产库"
          count={library.length}
          onClick={() => setTab("library")}
        />
        <div className="mt-6 px-2 text-[11px] leading-5 text-white/30">
          生成历史会在节点产出图片、视频、音频时自动保存；可点卡片上的收藏按钮存入个人资产库。
        </div>
      </aside>
    </div>
  );
}

/* ---------------- 资产卡 ---------------- */

function AssetCard({
  asset,
  inLibrary,
  onChange,
}: {
  asset: Asset;
  inLibrary: boolean;
  onChange: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  async function saveToLibrary(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    await fetch(`/api/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ saveToLibrary: true }),
    });
    setBusy(false);
    onChange();
  }

  async function remove(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
    setBusy(false);
    onChange();
  }

  return (
    <div className="group">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-white/8 bg-[#262626]">
        {asset.url ? (
          asset.kind === "audio" ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/35">
              <Play className="h-7 w-7" />
              <span className="text-[11px]">音频</span>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.title} className="h-full w-full object-cover" />
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/20">
            <Images className="h-7 w-7" />
          </div>
        )}

        {asset.kind === "video" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/45">
              <Play className="h-4 w-4 fill-white text-white" />
            </span>
          </div>
        )}

        {/* hover 操作 */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-1 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 transition group-hover:opacity-100">
          {!inLibrary && (
            <IconBtn title="存入资产库" onClick={saveToLibrary}>
              <Heart className="h-3.5 w-3.5" />
            </IconBtn>
          )}
          {asset.url && (
            <a href={asset.url} download title="下载" onClick={(e) => e.stopPropagation()}>
              <span className="flex h-6 w-6 cursor-pointer items-center justify-center rounded text-white/80 hover:bg-white/15">
                <Download className="h-3.5 w-3.5" />
              </span>
            </a>
          )}
          <IconBtn title="删除" onClick={remove}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>
      <div className="mt-1.5 truncate px-0.5 text-[12px] text-white/70">
        {asset.title}
        {busy ? " …" : ""}
      </div>
    </div>
  );
}

function IconBtn({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center rounded text-white/80 hover:bg-white/15 hover:text-white"
    >
      {children}
    </button>
  );
}

function SideItem({
  active,
  icon: Icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  icon: typeof Clock;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? "mb-1 flex w-full items-center gap-2.5 rounded-lg bg-white/10 px-3 py-2 text-[13px] font-medium text-white"
          : "mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-white/55 hover:bg-white/5 hover:text-white"
      }
    >
      <Icon className="h-4 w-4" />
      {label}
      <span className="ml-auto text-[11px] text-white/35">{count}</span>
    </button>
  );
}

function EmptyState({ tab }: { tab: TabKey }) {
  return (
    <div className="flex flex-col items-center gap-3 py-24 text-white/30">
      {tab === "history" ? <Clock className="h-10 w-10" /> : <Star className="h-10 w-10" />}
      <div className="text-[13px]">
        {tab === "history"
          ? "还没有生成历史。在画布中生成图片、视频或音频后会自动出现在这里。"
          : "个人资产库还是空的，可从生成历史中收藏资产。"}
      </div>
    </div>
  );
}

/** 按日期（YYYY-MM-DD）分组 */
function groupByDate(items: Asset[]): { date: string; items: Asset[] }[] {
  const map = new Map<string, Asset[]>();
  for (const a of items) {
    const d = new Date(a.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  }
  return [...map.entries()].map(([date, list]) => ({ date, items: list }));
}
