import { useCanvasStore } from "@/stores/canvasStore";
import { centerAt } from "@/lib/assets";
import { ASPECT_RATIOS } from "@/lib/nodeTypes";
import type { NodeKind } from "@/types";

/* ------------------------------------------------------------------ */
/* 本地文件 → 画布节点（T-上传）                                          */
/* ------------------------------------------------------------------ */
/* 画布三处入口共用：                                                    */
/*   1) 从桌面/访达拖文件到画布（drop）                                   */
/*   2) ⌘V 粘贴剪贴板图片/文件                                           */
/*   3) 空白右键菜单「上传素材…」                                         */
/* 媒体文件走 /api/assets/upload 落盘+登记资产；小文本文件直接读内容。     */
/* ------------------------------------------------------------------ */

/** 与上传 API 的 MIME_TO_KIND 保持一致（先在前端判型，不支持的直接跳过） */
const MEDIA_MIME: Record<string, NodeKind> = {
  "image/png": "image",
  "image/jpeg": "image",
  "image/webp": "image",
  "image/gif": "image",
  "image/svg+xml": "image",
  "image/avif": "image",
  "image/heic": "image",
  "image/heif": "image",
  "video/mp4": "video",
  "video/webm": "video",
  "video/quicktime": "video",
  "audio/mpeg": "audio",
  "audio/wav": "audio",
  "audio/ogg": "audio",
  "audio/mp4": "audio",
  "audio/x-m4a": "audio",
  "audio/aac": "audio",
  "audio/flac": "audio",
};

/** 文本类：直接读内容建文本节点（不上传文件），限制 200KB 防误拖大文件 */
const TEXT_MIME = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
]);
const TEXT_EXT = /\.(txt|md|markdown|csv|json|srt)$/i;
const TEXT_READ_LIMIT = 200 * 1024;

export type FileDisposition =
  | { kind: NodeKind } // 媒体：上传
  | { kind: "text" } // 文本：读内容
  | null;

export function classifyFile(file: File): FileDisposition {
  if (MEDIA_MIME[file.type]) return { kind: MEDIA_MIME[file.type] };
  if (
    (TEXT_MIME.has(file.type) || (file.type === "" && TEXT_EXT.test(file.name))) &&
    file.size <= TEXT_READ_LIMIT
  ) {
    return { kind: "text" };
  }
  return null;
}

/** 上传一个媒体文件到资产库，返回可访问地址 */
export async function uploadMediaFile(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/assets/upload", { method: "POST", body: form });
  const j = (await res.json().catch(() => ({}))) as {
    asset?: { url?: string };
    error?: string;
  };
  if (!res.ok || !j.asset?.url) {
    throw new Error(j.error ?? `上传失败（HTTP ${res.status}）`);
  }
  return j.asset.url;
}

/** "16:9" → 16/9（本地小解析，非法回退 16:9） */
function ratioValue(r: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*[:：]\s*(\d+(?:\.\d+)?)$/.exec(r);
  if (!m) return 16 / 9;
  const w = Number(m[1]);
  const h = Number(m[2]);
  return w > 0 && h > 0 ? w / h : 16 / 9;
}

/** 按真实宽高把卡片比例吸附到最接近的标准比例，并锁定 */
function adoptAspect(nodeId: string, w: number, h: number): void {
  if (!w || !h) return;
  const actual = w / h;
  let best: string | null = null;
  let bestDiff = Infinity;
  for (const r of ASPECT_RATIOS) {
    const diff = Math.abs(Math.log(actual / ratioValue(r)));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = r;
    }
  }
  if (best) {
    useCanvasStore.getState().updateNodeParams(nodeId, {
      aspectRatio: best,
      ratioLocked: true,
    });
  }
}

/** 上传成功后读媒体真实尺寸，把卡片比例吸附到最接近的标准比例（竖图/竖视频不再被 16:9 黑框装） */
function adoptMediaAspect(nodeId: string, url: string, kind: NodeKind): void {
  if (kind === "image") {
    const img = new Image();
    img.onload = () => adoptAspect(nodeId, img.naturalWidth, img.naturalHeight);
    img.src = url;
  } else if (kind === "video") {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => adoptAspect(nodeId, v.videoWidth, v.videoHeight);
    v.src = url;
  }
}

const truncateName = (name: string) =>
  name.length > 24 ? `${name.slice(0, 22)}…` : name.replace(/\.[a-z0-9]+$/i, "");

/**
 * 把一批本地文件落成画布节点：
 * 先创建「上传中」占位节点（running 进度环），成功后写入产物；
 * 多文件按 60px 阶梯错位排开。返回成功节点数。
 */
export async function materializeFilesToCanvas(
  files: File[],
  at: { x: number; y: number },
): Promise<number> {
  const store = useCanvasStore.getState();
  let done = 0;
  let index = 0;

  await Promise.all(
    files.map(async (file) => {
      const disp = classifyFile(file);
      if (!disp) return;
      const offset = { x: at.x + index * 60, y: at.y + index * 40 };
      index += 1;

      const kind = disp.kind as NodeKind;
      const nid = store.addNode(kind, centerAt(kind, offset));
      store.updateNodeData(nid, {
        title: truncateName(file.name || "本地上传"),
        status: "running",
        progress: 0,
      });

      try {
        if (disp.kind === "text") {
          const text = await file.text();
          useCanvasStore.getState().updateNodeData(nid, {
            status: "succeeded",
            progress: 100,
            output: { kind: "text", text: text.slice(0, TEXT_READ_LIMIT) },
          });
        } else {
          const url = await uploadMediaFile(file);
          useCanvasStore.getState().updateNodeData(nid, {
            status: "succeeded",
            progress: 100,
            output: { kind, urls: [url] },
          });
          if (kind === "image" || kind === "video") adoptMediaAspect(nid, url, kind);
        }
        done += 1;
      } catch (err) {
        useCanvasStore.getState().updateNodeData(nid, {
          status: "failed",
          error: err instanceof Error ? err.message : "上传失败",
        });
      }
    }),
  );
  return done;
}
