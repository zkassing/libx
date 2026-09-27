"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Edge, Node } from "@xyflow/react";
import type { FlowNodeData } from "@/types";

/** 保存到「工具箱」的工作流模板（教学里 = 课程模板） */
export interface ToolboxItem {
  id: string;
  name: string;
  tags: string[];
  notes?: string;
  nodes: Node<FlowNodeData>[];
  edges: Edge[];
  createdAt: number;
  updatedAt: number;
}

interface ToolboxState {
  items: ToolboxItem[];
  saveItem: (item: Omit<ToolboxItem, "id" | "createdAt" | "updatedAt">) => string;
  updateItem: (id: string, patch: Partial<ToolboxItem>) => void;
  removeItem: (id: string) => void;
}

const uid = () =>
  `tpl_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export const useToolboxStore = create<ToolboxState>()(
  persist(
    (set) => ({
      items: [],

      saveItem: (item) => {
        const id = uid();
        const now = Date.now();
        set((s) => ({
          items: [{ ...item, id, createdAt: now, updatedAt: now }, ...s.items],
        }));
        return id;
      },

      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) =>
            i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i,
          ),
        })),

      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    { name: "aiteach-toolbox" },
  ),
);

// 开发期挂到 window，便于调试 / 自动化验证
if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
  (window as unknown as Record<string, unknown>).__toolboxStore = useToolboxStore;
}
