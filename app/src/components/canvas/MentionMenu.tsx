"use client";

import * as React from "react";
import { Boxes, ImageIcon, Sparkles, Type } from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";
import { NODE_META } from "@/lib/nodeTypes";
import { cn } from "@/lib/utils";
import type { FlowNodeData, NodeRef } from "@/types";

export interface MentionItem {
  id: string;
  type: NodeRef["type"];
  label: string;
  hint?: string;
}

export interface MentionGroup {
  key: string;
  label: string;
  items: MentionItem[];
}

const GROUP_ICON: Record<string, React.ElementType> = {
  node: Boxes,
  asset: ImageIcon,
  model: Sparkles,
};

/** 供 `@` 引用的候选：本画布节点 / 上游素材 / 模型 */
export function useMentionGroups(nodeId: string, data: FlowNodeData) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  return React.useMemo<MentionGroup[]>(() => {
    const others = nodes.filter((n) => n.id !== nodeId);

    const nodeItems: MentionItem[] = others.map((n) => {
      const d = n.data as FlowNodeData;
      return {
        id: n.id,
        type: "node",
        label: d.title,
        hint: NODE_META[d.kind]?.label ?? d.kind,
      };
    });

    // 上游（连进本节点的）已产出节点 → 素材
    const upstreamIds = new Set(
      edges.filter((e) => e.target === nodeId).map((e) => e.source),
    );
    const assetItems: MentionItem[] = others
      .filter((n) => upstreamIds.has(n.id) && n.data.status === "succeeded")
      .map((n) => {
        const d = n.data as FlowNodeData;
        return { id: `asset:${n.id}`, type: "asset", label: `${d.title} 的产物` };
      });

    const modelItems: MentionItem[] = (NODE_META[data.kind]?.models ?? []).map(
      (m) => ({ id: `model:${m}`, type: "model", label: m }),
    );

    return [
      { key: "node", label: "本画布节点", items: nodeItems },
      { key: "asset", label: "输入素材", items: assetItems },
      { key: "model", label: "模型", items: modelItems },
    ].filter((g) => g.items.length > 0);
  }, [nodes, edges, nodeId, data.kind]);
}

/**
 * `@` 引用浮层：在提示词里输入 `@` 后弹出，
 * 支持 ↑↓ 选择 / Enter 确认 / Esc 关闭。
 */
export function MentionMenu({
  groups,
  query,
  activeIndex,
  onPick,
  onHover,
  className,
}: {
  groups: MentionGroup[];
  query: string;
  activeIndex: number;
  onPick: (item: MentionItem) => void;
  onHover: (index: number) => void;
  className?: string;
}) {
  const q = query.trim().toLowerCase();
  const filtered = groups
    .map((g) => ({
      ...g,
      items: q
        ? g.items.filter((i) => i.label.toLowerCase().includes(q))
        : g.items,
    }))
    .filter((g) => g.items.length > 0);

  const flat = filtered.flatMap((g) => g.items);
  // 用查表代替渲染期的可变游标（原实现会在 render 里递增外部变量）
  const indexOf = new Map(
    flat.map((item, i) => [`${item.type}:${item.id}`, i] as const),
  );

  if (flat.length === 0) {
    return (
      <div
        className={cn(
          "nodrag nowheel w-[300px] rounded-xl border border-white/10 bg-[#191a1d]/97 p-3 text-[12px] text-white/40 shadow-2xl backdrop-blur-xl",
          className,
        )}
      >
        没有匹配的节点 / 素材 / 模型
      </div>
    );
  }

  return (
    <div
      className={cn(
        "nodrag nowheel w-[300px] overflow-hidden rounded-xl border border-white/10 bg-[#191a1d]/97 shadow-2xl backdrop-blur-xl",
        className,
      )}
    >
      <div className="max-h-[264px] overflow-y-auto py-1">
        {filtered.map((g) => {
          const Icon = GROUP_ICON[g.key] ?? Boxes;
          return (
            <div key={g.key}>
              <div className="flex items-center gap-1.5 px-3 pt-2 pb-1 text-[11px] text-white/35">
                <Icon className="size-3" strokeWidth={1.9} />
                {g.label}
              </div>
              {g.items.map((item) => {
                const idx = indexOf.get(`${item.type}:${item.id}`) ?? 0;
                const active = idx === activeIndex;
                const NodeIcon =
                  item.type === "node"
                    ? Type
                    : item.type === "asset"
                      ? ImageIcon
                      : Sparkles;
                return (
                  <button
                    key={`${g.key}:${item.id}`}
                    onMouseEnter={() => onHover(idx)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onPick(item)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-1.5 text-left text-[12.5px]",
                      active
                        ? "bg-white/10 text-white"
                        : "text-white/70 hover:bg-white/6",
                    )}
                  >
                    <NodeIcon
                      className="size-3.5 shrink-0 text-white/40"
                      strokeWidth={1.8}
                    />
                    <span className="truncate">{item.label}</span>
                    {item.hint && (
                      <span className="ml-auto shrink-0 text-[11px] text-white/30">
                        {item.hint}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-white/8 px-3 py-1.5 text-[11px] text-white/30">
        <span>↑↓ 选择</span>
        <span>Enter 确认</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}

/** 把 `@` 触发逻辑收成一个 hook，Composer 和放大编辑弹窗共用 */
export function useMention({
  value,
  nodeId,
  data,
  onChange,
  textareaRef,
  onAddRef,
}: {
  value: string;
  nodeId: string;
  data: FlowNodeData;
  onChange: (next: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onAddRef: (ref: NodeRef) => void;
}) {
  const [query, setQuery] = React.useState<string | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const atIndexRef = React.useRef(0);
  const groups = useMentionGroups(nodeId, data);

  /** 光标前是否处于 `@xxx` 语境 */
  const sync = React.useCallback(
    (next: string, caret: number) => {
      const before = next.slice(0, caret);
      const m = before.match(/@([^\s@]{0,20})$/);
      if (m) {
        atIndexRef.current = caret - m[0].length;
        setQuery(m[1]);
        setActiveIndex(0);
      } else {
        setQuery(null);
      }
    },
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    sync(e.target.value, e.target.selectionStart ?? e.target.value.length);
  };

  const pick = React.useCallback(
    (item: MentionItem) => {
      const el = textareaRef.current;
      const caret = el?.selectionStart ?? value.length;
      const before = value.slice(0, atIndexRef.current);
      const after = value.slice(caret);
      const inserted = `@${item.label} `;
      onChange(before + inserted + after);
      onAddRef({ id: item.id, type: item.type, label: item.label });
      setQuery(null);
      // 光标落到插入内容之后
      const pos = before.length + inserted.length;
      requestAnimationFrame(() => {
        el?.focus();
        el?.setSelectionRange(pos, pos);
      });
    },
    [onAddRef, onChange, textareaRef, value],
  );

  const flat = React.useMemo(
    () =>
      groups
        .map((g) => ({
          ...g,
          items: query?.trim()
            ? g.items.filter((i) =>
                i.label.toLowerCase().includes(query.trim().toLowerCase()),
              )
            : g.items,
        }))
        .filter((g) => g.items.length > 0)
        .flatMap((g) => g.items),
    [groups, query],
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (query === null || flat.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % flat.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      pick(flat[Math.min(activeIndex, flat.length - 1)]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setQuery(null);
    }
  };

  return {
    mentionOpen: query !== null,
    mentionQuery: query ?? "",
    mentionGroups: groups,
    mentionActive: activeIndex,
    setMentionActive: setActiveIndex,
    handleChange,
    handleKeyDown,
    pick,
    closeMention: () => setQuery(null),
  };
}
