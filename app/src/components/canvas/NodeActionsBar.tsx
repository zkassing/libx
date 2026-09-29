"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCanvasStore } from "@/stores/canvasStore";
import { flowNodeSize, type FlowNodeData } from "@/types";
import {
  Copy,
  Download,
  FileDown,
  Hd as HdIcon,
  Maximize2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* NodeActionsBar：选中「带产物的节点」时浮在顶部的工具条（对齐 LibTV）     */
/* 图片：高清派生 / 下载 / 全屏；视频：下载 / 全屏；                      */
/* 音频：下载；文本：复制 / 下载 .md                                      */
/* 高清放大 = 派生节点哲学：右侧生成子节点 + 连线 + node 引用（图生图 4K）  */
/* ------------------------------------------------------------------ */

export function NodeActionsBar() {
  const nodes = useCanvasStore((s) => s.nodes);
  const selectedId = useCanvasStore((s) => s.selectedNodeId);
  const addNode = useCanvasStore((s) => s.addNode);
  const onConnect = useCanvasStore((s) => s.onConnect);
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeParams = useCanvasStore((s) => s.updateNodeParams);
  const setSelected = useCanvasStore((s) => s.setSelected);
  const [preview, setPreview] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const node = nodes.find((n) => n.id === selectedId);
  const data = node?.data as FlowNodeData | undefined;
  const succeeded = data?.status === "succeeded";
  const mediaUrl = succeeded ? data?.output?.urls?.[0] : undefined;
  const text = succeeded ? data?.output?.text : undefined;

  if (!node || !data || (!mediaUrl && !text)) return null;
  const kind = data.kind;

  /** 高清放大：派生一个图生图 4K 子节点（对齐 LibTV 的「高清」动作） */
  const createUpscale = (resolution: "2K" | "4K") => {
    const size = flowNodeSize(data.kind, data.params?.aspectRatio, data.size);
    const nid = addNode("image", {
      x: node.position.x + size.w + 96,
      y: node.position.y,
    });
    updateNodeData(nid, {
      title: "高清",
      prompt: "高清放大，保持画面内容、构图、色彩完全不变",
      // 连线只进文本上下文，图片要靠 node 引用进 referenceImages
      refs: [
        {
          id: node.id,
          type: "node",
          label: `${data.title}${data.index ? ` ${data.index}` : ""}`,
        },
      ],
    });
    updateNodeParams(nid, {
      model: data.params?.model,
      mode: "图生图",
      aspectRatio: data.params?.aspectRatio,
      ratioLocked: true,
      resolution,
      quality: "高画质",
    });
    onConnect({ source: node.id, target: nid, sourceHandle: null, targetHandle: null });
    setSelected(nid);
  };

  const ext = kind === "video" ? "mp4" : kind === "audio" ? "mp3" : "png";
  const download = () => {
    if (!mediaUrl) return;
    const a = document.createElement("a");
    a.href = mediaUrl;
    a.download = `${data.title || "output"}.${ext}`;
    a.rel = "noreferrer";
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copyText = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* 剪贴板权限被拒绝时静默 */
    }
  };

  const downloadMd = () => {
    if (!text) return;
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.title || "text"}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const btnCls =
    "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-white/75 transition hover:bg-white/10 hover:text-white";

  return (
    <>
      <div className="nodrag absolute top-16 left-4 z-30 flex items-center gap-0.5 rounded-xl border border-white/10 bg-[#191a1d]/95 px-1.5 py-1 shadow-2xl backdrop-blur-xl">
        {/* 图片：高清派生 */}
        {kind === "image" && mediaUrl && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={btnCls} title="高清放大（生成派生节点）">
                <HdIcon className="size-3.5" />
                高清
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => createUpscale("2K")}>
                放大到 2K
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => createUpscale("4K")}>
                放大到 4K
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {/* 媒体产物：下载 */}
        {mediaUrl && (
          <button className={btnCls} onClick={download} title="下载产物">
            <Download className="size-3.5" />
            下载
          </button>
        )}
        {/* 图片 / 视频：全屏预览 */}
        {mediaUrl && (kind === "image" || kind === "video") && (
          <button className={btnCls} onClick={() => setPreview(true)} title="全屏预览">
            <Maximize2 className="size-3.5" />
            全屏
          </button>
        )}
        {/* 文本产物：复制 / 下载 md */}
        {text && (
          <>
            <button className={btnCls} onClick={() => void copyText()} title="复制文本">
              <Copy className="size-3.5" />
              {copied ? "已复制" : "复制"}
            </button>
            <button className={btnCls} onClick={downloadMd} title="下载为 Markdown">
              <FileDown className="size-3.5" />
              存为.md
            </button>
          </>
        )}
      </div>

      {mediaUrl && (
        <Dialog open={preview} onOpenChange={setPreview}>
          <DialogContent className="max-w-[92vw] p-0 sm:max-w-[92vw]">
            <DialogTitle className="sr-only">产物预览</DialogTitle>
            <div className="flex h-[85vh] w-full items-center justify-center overflow-hidden rounded-xl bg-black">
              {kind === "video" ? (
                <video
                  src={mediaUrl}
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={mediaUrl} alt="预览" className="h-full w-full object-contain" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
