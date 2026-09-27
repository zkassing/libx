"use client";

import * as React from "react";
import {
  ChevronRight,
  FileText,
  Film,
  Folder,
  FolderPlus,
  Images,
  ListFilter,
  Music,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectAsset = {
  id: string;
  kind: "image" | "video" | "audio" | "text";
  title: string;
  url: string | null;
  text: string | null;
  folderId: string | null;
  createdAt: string;
};

export type ProjectFolder = {
  id: string;
  name: string;
  parentId: string | null;
};

/**
 * 项目本地文件管理器（画布内「资产」tab 内容）。
 * 与全局 /assets 的生成历史是两回事。
 * 布局：工具行 + 文件夹树 + 当前文件夹文件列表。
 */
export function ProjectFiles({ workflowId }: { workflowId: string | null }) {
  const [folders, setFolders] = React.useState<ProjectFolder[]>([]);
  const [assets, setAssets] = React.useState<ProjectAsset[]>([]);
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());
  /** 当前浏览的文件夹：null = 根（待分类资产） */
  const [current, setCurrent] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const load = React.useCallback(async () => {
    if (!workflowId) return;
    const [f, a] = await Promise.all([
      fetch(`/api/asset-folders?workflowId=${workflowId}`).then((r) => r.json()) as Promise<{ folders: ProjectFolder[] }>,
      fetch(`/api/assets?source=project&workflowId=${workflowId}`).then((r) => r.json()) as Promise<{ assets: ProjectAsset[] }>,
    ]);
    setFolders(f.folders);
    setAssets(a.assets);
  }, [workflowId]);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function createFolder() {
    if (!workflowId) return;
    const name = window.prompt("文件夹名称", "新建文件夹");
    if (!name?.trim()) return;
    await fetch("/api/asset-folders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ workflowId, name, parentId: current }),
    });
    if (current) setExpanded((s) => new Set(s).add(current));
    void load();
  }

  async function renameFolder(id: string, old: string) {
    const name = window.prompt("重命名文件夹", old);
    if (!name?.trim()) return;
    await fetch(`/api/asset-folders/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name }),
    });
    void load();
  }

  async function removeFolder(id: string) {
    const ok = window.confirm("删除文件夹？里面的文件会移到待分类资产。");
    if (!ok) return;
    await fetch(`/api/asset-folders/${id}`, { method: "DELETE" });
    if (current === id) setCurrent(null);
    void load();
  }

  async function onPick(files: FileList | null) {
    if (!files || !workflowId) return;
    setBusy(true);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("target", "project");
      fd.append("workflowId", workflowId);
      fd.append("folderId", current ?? "root");
      await fetch("/api/assets/upload", { method: "POST", body: fd });
    }
    setBusy(false);
    void load();
  }

  async function removeAsset(id: string) {
    await fetch(`/api/assets/${id}`, { method: "DELETE" });
    void load();
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const inCurrent = assets.filter((a) => a.folderId === current);
  const shownAssets = query.trim()
    ? inCurrent.filter((a) => a.title.toLowerCase().includes(query.trim().toLowerCase()))
    : inCurrent;
  const childFolders = folders.filter((f) => f.parentId === current);
  const currentName = current ? folders.find((f) => f.id === current)?.name ?? "文件夹" : "待分类资产";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 工具行 */}
      <div className="flex items-center gap-1 border-b border-white/8 px-2.5 py-2">
        <div className="flex flex-1 items-center gap-1 rounded-md bg-white/6 px-2 py-1">
          <Search className="h-3 w-3 shrink-0 text-white/35" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="筛选"
            className="w-full min-w-0 bg-transparent text-[11px] text-white placeholder:text-white/30 focus:outline-none"
          />
        </div>
        <IconTool title="新建文件夹" onClick={() => void createFolder()}>
          <FolderPlus className="h-3.5 w-3.5" />
        </IconTool>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => void onPick(e.target.files)}
        />
        <IconTool title="上传文件到当前文件夹" onClick={() => fileRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
        </IconTool>
      </div>

      {/* 文件夹树 */}
      <div className="max-h-[38%] shrink-0 overflow-y-auto px-1.5 py-1.5 no-scrollbar">
        <TreeRow
          depth={0}
          label="待分类资产"
          active={current === null}
          expanded={expanded.has("__root__")}
          hasChildren={folders.some((f) => f.parentId === null)}
          onOpen={() => setCurrent(null)}
          onToggle={() =>
            setExpanded((p) => {
              const n = new Set(p);
              if (n.has("__root__")) n.delete("__root__");
              else n.add("__root__");
              return n;
            })
          }
        />
        {expanded.has("__root__") &&
          folders
            .filter((f) => f.parentId === null)
            .map((f) => (
              <FolderNode
                key={f.id}
                folder={f}
                all={folders}
                depth={1}
                expanded={expanded}
                current={current}
                onToggle={toggle}
                onOpen={setCurrent}
                onRename={renameFolder}
                onDelete={removeFolder}
              />
            ))}
      </div>

      {/* 当前文件夹内容 */}
      <div className="flex min-h-0 flex-1 flex-col border-t border-white/8">
        <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-white/45">
          <ListFilter className="h-3 w-3 shrink-0" />
          {currentName}
          <span className="ml-auto text-white/30">
            {busy ? "上传中…" : `${shownAssets.length} 个文件`}
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4 no-scrollbar">
          {childFolders.length > 0 && (
            <div className="space-y-0.5 pb-2">
              {childFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={() => {
                    setCurrent(f.id);
                    setExpanded((s) => new Set(s).add(f.id));
                  }}
                  className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[11.5px] text-white/70 hover:bg-white/8"
                >
                  <Folder className="h-3.5 w-3.5 text-[#e8b339]" />
                  {f.name}
                </button>
              ))}
            </div>
          )}

          {shownAssets.length === 0 && childFolders.length === 0 && (
            <div className="px-1 pt-6 text-center text-[11px] leading-5 text-white/28">
              空文件夹
              <br />
              上传文件或新建子文件夹
            </div>
          )}

          <div className="space-y-0.5">
            {shownAssets.map((a) => (
              <FileRow key={a.id} asset={a} onRemove={() => void removeAsset(a.id)} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- 文件夹树节点（递归） ---------------- */

function FolderNode({
  folder,
  all,
  depth,
  expanded,
  current,
  onToggle,
  onOpen,
  onRename,
  onDelete,
}: {
  folder: ProjectFolder;
  all: ProjectFolder[];
  depth: number;
  expanded: Set<string>;
  current: string | null;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
  onRename: (id: string, old: string) => void;
  onDelete: (id: string) => void;
}) {
  const kids = all.filter((f) => f.parentId === folder.id);
  const isOpen = expanded.has(folder.id);
  const [menu, setMenu] = React.useState(false);

  return (
    <div>
      <div
        className={cn(
          "group relative flex items-center gap-0.5 rounded-md pr-1",
          current === folder.id ? "bg-white/10" : "hover:bg-white/6",
        )}
        style={{ paddingLeft: depth * 12 }}
      >
        <button onClick={() => onToggle(folder.id)} className="flex h-5 w-4 shrink-0 items-center justify-center text-white/40">
          <ChevronRight className={cn("h-3 w-3 transition", isOpen && "rotate-90")} />
        </button>
        <button onClick={() => onOpen(folder.id)} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[11.5px] text-white/75">
          <Folder className="h-3.5 w-3.5 shrink-0 text-[#e8b339]" />
          <span className="truncate">{folder.name}</span>
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setMenu((v) => !v);
          }}
          className="shrink-0 text-white/30 opacity-0 hover:text-white group-hover:opacity-100"
          title="更多"
        >
          <span className="block h-3 w-3 rotate-45 text-[12px] leading-3">+</span>
        </button>

        {menu && (
          <div className="absolute top-full left-6 z-40 mt-0.5 w-28 overflow-hidden rounded-md border border-white/10 bg-[#262626] py-0.5 text-[11px] shadow-xl">
            <button
              onClick={() => {
                setMenu(false);
                void onRename(folder.id, folder.name);
              }}
              className="block w-full px-2.5 py-1.5 text-left text-white/70 hover:bg-white/8"
            >
              重命名
            </button>
            <button
              onClick={() => {
                setMenu(false);
                void onDelete(folder.id);
              }}
              className="block w-full px-2.5 py-1.5 text-left text-red-400 hover:bg-white/8"
            >
              删除
            </button>
          </div>
        )}
      </div>

      {isOpen &&
        kids.map((k) => (
          <FolderNode
            key={k.id}
            folder={k}
            all={all}
            depth={depth + 1}
            expanded={expanded}
            current={current}
            onToggle={onToggle}
            onOpen={onOpen}
            onRename={onRename}
            onDelete={onDelete}
          />
        ))}
    </div>
  );
}

function TreeRow({
  depth,
  label,
  active,
  expanded,
  hasChildren,
  onOpen,
  onToggle,
}: {
  depth: number;
  label: string;
  active: boolean;
  expanded: boolean;
  hasChildren: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div
      className={cn("flex items-center rounded-md pr-1", active ? "bg-white/10" : "hover:bg-white/6")}
      style={{ paddingLeft: depth * 12 }}
    >
      <button onClick={onToggle} className="flex h-5 w-4 shrink-0 items-center justify-center text-white/40">
        {hasChildren ? <ChevronRight className={cn("h-3 w-3 transition", expanded && "rotate-90")} /> : <span className="w-3" />}
      </button>
      <button onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-1.5 py-1 text-left text-[11.5px] text-white/75">
        <Folder className="h-3.5 w-3.5 shrink-0 text-[#e8b339]" />
        <span className="truncate">{label}</span>
      </button>
    </div>
  );
}

/* ---------------- 文件行（可拖入画布） ---------------- */

function FileRow({ asset, onRemove }: { asset: ProjectAsset; onRemove: () => void }) {
  const Icon =
    asset.kind === "image" ? Images : asset.kind === "video" ? Film : asset.kind === "audio" ? Music : FileText;

  function onDragStart(e: React.DragEvent) {
    const payload = JSON.stringify({ type: "cloud-asset", assetId: asset.id });
    e.dataTransfer.setData("application/aiteach-cloud-asset", payload);
    e.dataTransfer.effectAllowed = "copy";
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      title="拖到画布创建节点"
      className="group flex cursor-grab items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-white/8 active:cursor-grabbing"
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-white/45" />
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-white/70">{asset.title}</span>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 text-white/30 opacity-0 hover:text-red-400 group-hover:opacity-100"
        title="删除"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function IconTool({
  children,
  title,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/55 hover:bg-white/10 hover:text-white"
    >
      {children}
    </button>
  );
}
