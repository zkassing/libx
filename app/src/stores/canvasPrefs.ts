"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { createDebouncedLocalStorage } from "@/lib/debouncedStorage";

/** 侧栏分区 */
export type PaletteSection =
  | "nodes"
  | "workflows"
  | "assets"
  | "history"
  | "guide";

/** 画布偏好设置（UI 层，与节点数据分开持久化） */
export interface CanvasPrefsState {
  /** 拖拽节点时吸附到网格 */
  snapToGrid: boolean;
  /** 右下角小地图 */
  showMiniMap: boolean;
  /** 选择模式：拖空白处是框选（true）还是平移（false） */
  selectMode: boolean;
  /** 是否已开启生成完成通知（Mock 期仅本地记录） */
  notifyOn: boolean;
  /** 左侧栏是否展开（收起时只留图标栏，默认收起以让出画布宽度） */
  paletteOpen: boolean;
  /** 左侧栏当前分区 */
  paletteSection: PaletteSection;
  /** 画布主侧栏是否展开（对齐 LibTV：展开为宽面板，收起为细竖条；默认收起） */
  sidebarExpanded: boolean;
  /** 侧栏当前 tab：画布（节点列表）/ 资产（项目文件管理器） */
  sidebarTab: "canvas" | "assets";
  /** 右侧 AI 助教面板是否展开 */
  agentOpen: boolean;
  /** 画布视图：工作流（节点图）/ 故事板（分镜表） */
  viewMode: "workflow" | "storyboard";

  setSnapToGrid: (v: boolean) => void;
  setShowMiniMap: (v: boolean) => void;
  setSelectMode: (v: boolean) => void;
  setNotifyOn: (v: boolean) => void;
  setPaletteOpen: (v: boolean) => void;
  setPaletteSection: (v: PaletteSection) => void;
  setSidebarExpanded: (v: boolean) => void;
  toggleSidebar: () => void;
  setSidebarTab: (v: "canvas" | "assets") => void;
  setAgentOpen: (v: boolean) => void;
  setViewMode: (v: "workflow" | "storyboard") => void;
  toggleSnapToGrid: () => void;
  toggleMiniMap: () => void;
  toggleSelectMode: () => void;
}

const prefsPersistence = createDebouncedLocalStorage(200);

export const useCanvasPrefs = create<CanvasPrefsState>()(
  persist(
    (set) => ({
      snapToGrid: true,
      showMiniMap: true,
      selectMode: false,
      notifyOn: false,
      paletteOpen: false,
      paletteSection: "nodes",
      sidebarExpanded: false,
      sidebarTab: "canvas",
      agentOpen: true,
      viewMode: "workflow",

      setSnapToGrid: (v) => set({ snapToGrid: v }),
      setShowMiniMap: (v) => set({ showMiniMap: v }),
      setSelectMode: (v) => set({ selectMode: v }),
      setNotifyOn: (v) => set({ notifyOn: v }),
      setPaletteOpen: (v) => set({ paletteOpen: v }),
      setPaletteSection: (v) => set({ paletteSection: v }),
      setSidebarExpanded: (v) => set({ sidebarExpanded: v }),
      toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
      setSidebarTab: (v) => set({ sidebarTab: v }),
      setAgentOpen: (v) => set({ agentOpen: v }),
      setViewMode: (v) => set({ viewMode: v }),
      toggleSnapToGrid: () => set((s) => ({ snapToGrid: !s.snapToGrid })),
      toggleMiniMap: () => set((s) => ({ showMiniMap: !s.showMiniMap })),
      toggleSelectMode: () => set((s) => ({ selectMode: !s.selectMode })),
    }),
    {
      name: "aiteach-canvas-prefs",
      storage: createJSONStorage(() => prefsPersistence.storage),
    },
  ),
);
