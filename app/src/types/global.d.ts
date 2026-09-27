import type { CanvasState } from "@/stores/canvasStore";
import type { CanvasPrefsState } from "@/stores/canvasPrefs";
import type { ToolboxState } from "@/stores/toolboxStore";

/* ------------------------------------------------------------------ */
/* 开发期挂到 window 的 debug hooks 类型声明                              */
/* ------------------------------------------------------------------ */

declare global {
  interface Window {
    __canvasStore?: {
      getState: () => CanvasState;
    };
    __canvasPrefs?: CanvasPrefsState;
    __toolboxStore?: {
      getState: () => ToolboxState;
    };
  }
}

export {};
