import type { NodeKind } from "@/types";

/**
 * 侧栏 → 画布的拖拽协议。
 * 用自定义 MIME，避免把页面上其它文本拖拽误判成「放置节点」。
 */
export const DRAG_MIME = {
  node: "application/x-aiteach-node",
  toolbox: "application/x-aiteach-toolbox",
  asset: "application/x-aiteach-asset",
  cloudAsset: "application/x-aiteach-cloud-asset",
} as const;

export type DragPayload =
  | { type: "node"; kind: NodeKind }
  | { type: "toolbox"; id: string }
  | { type: "asset"; nodeId: string }
  | { type: "cloud-asset"; assetId: string };

/** 统一的拖拽预览文案（浏览器默认拖影用它） */
function labelOf(p: DragPayload) {
  if (p.type === "node") return `新建${p.kind}节点`;
  if (p.type === "toolbox") return "载入工作流";
  if (p.type === "cloud-asset") return "拖入资产";
  return "复用产物";
}

export function setDragPayload(
  e: React.DragEvent,
  payload: DragPayload,
): void {
  const dt = e.dataTransfer;
  dt.effectAllowed = "copy";
  dt.setData(
    payload.type === "cloud-asset" ? "application/x-aiteach-cloud-asset" : DRAG_MIME[payload.type],
    JSON.stringify(payload),
  );
  // 兜底：某些浏览器只透传 text/plain
  dt.setData("text/plain", labelOf(payload));
}

/** dragover 阶段只能看 types，不能读数据 */
export function hasDragPayload(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  // 桌面/访达拖来的本地文件（Files type）也算可放置
  if (dt.types.includes("Files")) return true;
  return Object.values(DRAG_MIME).some((m) => dt.types.includes(m));
}

/** 是否为 OS 拖来的本地文件（区别于应用内自定义 payload） */
export function hasFilePayload(dt: DataTransfer | null): boolean {
  if (!dt) return false;
  return dt.types.includes("Files") && !Object.values(DRAG_MIME).some((m) => dt.types.includes(m));
}

/** drop 阶段才能读数据 */
export function readDragPayload(dt: DataTransfer | null): DragPayload | null {
  if (!dt) return null;
  const cloud = dt.getData(DRAG_MIME.cloudAsset);
  if (cloud) {
    try {
      const p = JSON.parse(cloud) as DragPayload;
      if (p.type === "cloud-asset") return p;
    } catch {
      return null;
    }
  }
  for (const [type, mime] of Object.entries(DRAG_MIME)) {
    const raw = dt.getData(mime);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as DragPayload;
      if (parsed?.type === type) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}
