"use client";

import * as React from "react";
import {
  ChevronDown,
  FileText,
  Film,
  Image as ImageIcon,
  List,
  MoreHorizontal,
  Music,
  Navigation,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useCanvasStore } from "@/stores/canvasStore";
import { cn } from "@/lib/utils";

/** 画布 tab：节点列表（搜索 + 筛选 + 每项可选中/定位） */
export function NodeList() {
  const nodes = useCanvasStore((s) => s.nodes);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const selectedId = useCanvasStore((s) => s.selectedNodeId);
  const removeNode = useCanvasStore((s) => s.removeNode);
  const duplicateNode = useCanvasStore((s) => s.duplicateNode);
  const { fitView } = useReactFlow();
  const [query, setQuery] = React.useState("");
  const [menuFor, setMenuFor] = React.useState<string | null>(null);

  // 关闭背景点击时的菜单
  React.useEffect(() => {
    if (!menuFor) return;
    const close = () => setMenuFor(null);
    window.addEventListener("aiteach:close-node-menu", close);
    return () => window.removeEventListener("aiteach:close-node-menu", close);
  }, [menuFor]);

  const shown = query.trim()
    ? nodes.filter((n) => n.data.title.toLowerCase().includes(query.trim().toLowerCase()))
    : nodes;

  function focusNode(id: string) {
    setSelected(id);
    fitView({ duration: 320, nodes: [{ id }], padding: 0.7, maxZoom: 1.3 });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 搜索 / 筛选行 */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button className="flex h-6 w-6 items-center justify-center text-white/50 hover:text-white" title="搜索">
          <Search className="h-4 w-4" />
        </button>
        <button className="flex h-6 w-6 items-center justify-center text-white/50 hover:text-white" title="筛选条件">
          <SlidersHorizontal className="h-4 w-4" />
        </button>
        <div className="flex flex-1 items-center gap-1 text-[12.5px] text-white/70">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="所有评级"
            className="w-full min-w-0 bg-transparent text-white placeholder:text-white/50 focus:outline-none"
          />
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/40" />
        </div>
        <button className="flex h-6 w-6 items-center justify-center text-white/50 hover:text-white" title="列表视图">
          <List className="h-4 w-4" />
        </button>
      </div>

      {/* 节点列表 */}
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4 no-scrollbar">
        {shown.length === 0 && (
          <div className="px-2 pt-8 text-center text-[12px] text-white/30">
            {nodes.length === 0 ? "画布还没有节点" : "没有匹配的节点"}
          </div>
        )}
        {shown.map((n) => {
          const active = n.id === selectedId;
          return (
            <div
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 transition",
                active ? "bg-white/10" : "hover:bg-white/6",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/8 text-white/60">
                <NodeKindIcon kind={n.data.kind} />
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] text-white/90">
                {n.data.title}
              </span>

              {/* 更多菜单 */}
              <div className="relative shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor((v) => (v === n.id ? null : n.id));
                  }}
                  className="flex h-6 w-6 items-center justify-center text-white/40 opacity-0 hover:text-white group-hover:opacity-100"
                  title="更多操作"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {menuFor === n.id && (
                  <div className="absolute top-7 right-0 z-40 w-28 overflow-hidden rounded-lg border border-white/10 bg-[#262626] py-1 text-[12px] shadow-2xl">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        duplicateNode(n.id);
                        setMenuFor(null);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-white/75 hover:bg-white/8"
                    >
                      复制节点
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        focusNode(n.id);
                        setMenuFor(null);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-white/75 hover:bg-white/8"
                    >
                      定位节点
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNode(n.id);
                        setMenuFor(null);
                      }}
                      className="block w-full px-3 py-1.5 text-left text-red-400 hover:bg-white/8"
                    >
                      删除节点
                    </button>
                  </div>
                )}
              </div>

              {/* 定位箭头 */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  focusNode(n.id);
                }}
                className="shrink-0 text-white/40 opacity-0 transition hover:text-white group-hover:opacity-100"
                title="在画布中定位"
              >
                <Navigation className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function NodeKindIcon({ kind }: { kind: string }) {
  const cls = "h-[18px] w-[18px]";
  if (kind === "image") return <ImageIcon className={cls} />;
  if (kind === "video") return <Film className={cls} />;
  if (kind === "audio") return <Music className={cls} />;
  return <FileText className={cls} />;
}
