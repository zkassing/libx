"use client";

import * as React from "react";
import {
  ArrowUpRight,
  Check,
  Clock3,
  FolderOpen,
  Save,
  Tags,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasStore } from "@/stores/canvasStore";
import { useToolboxStore } from "@/stores/toolboxStore";
import { type FlowNodeData } from "@/types";
import { loadToolboxToCanvas } from "@/lib/toolboxGraph";

/* 封面纯色（按节点数取色，不用渐变） */
const COVER_COLORS = [
  "#1d4ed8",
  "#6d28d9",
  "#0f766e",
  "#b45309",
  "#be185d",
];

function Cover({ nodes }: { nodes: { id: string }[] }) {
  const idx = (nodes.length || 1) - 1;
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ backgroundColor: COVER_COLORS[idx % COVER_COLORS.length] }}
    >
      <FolderOpen className="size-7 text-white/70" strokeWidth={1.6} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 保存到工具箱                                                        */
/* ------------------------------------------------------------------ */

export function SaveToolboxDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const saveItem = useToolboxStore((s) => s.saveItem);

  const realNodes = nodes.filter((n) => n.type !== "group");

  const [name, setName] = React.useState("");
  const [tags, setTags] = React.useState<string[]>([]);
  const [notes, setNotes] = React.useState("");
  const [tagInput, setTagInput] = React.useState("");

  // 打开时重置表单。
  // 用“渲染期按 prop 变化调整 state”取代 effect 里 setState
  // （后者会触发级联渲染，且 open 期间 nodes 变化会反复覆盖用户输入）
  const [wasOpen, setWasOpen] = React.useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(nodes[0]?.data?.title ? `${nodes[0].data.title}工作流` : "我的工作流");
      setTags([]);
      setNotes("");
      setTagInput("");
    }
  }

  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, "");
    if (!t) return;
    if (tags.includes(t) || tags.length >= 5) return;
    setTags([...tags, t]);
    setTagInput("");
  };

  const canSave = name.trim().length > 0 && realNodes.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    // 封面一律纯色，不用节点产物
    saveItem({
      name: name.trim(),
      tags,
      notes: notes.trim() || undefined,
      // 只存可编辑的配置，运行态在发送到画布时会重置
      nodes: realNodes.map((n) => ({
        ...n,
        selected: false,
        parentId: undefined,
        extent: undefined,
        data: {
          ...n.data,
          status: "idle",
          progress: 0,
          output: undefined,
        } as FlowNodeData,
      })),
      edges: edges.map((e) => ({
        ...e,
        type: "flow",
        animated: false,
        selected: false,
        style: undefined,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <Save className="size-4 text-white/60" />
            保存到工具箱
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            工具箱里的工作流就是「课程模板」，可以反复发送给学生使用
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* 封面预览 + 名称 */}
          <div className="flex gap-3">
            <div className="size-[88px] shrink-0 overflow-hidden rounded-xl border border-white/10">
              <Cover nodes={realNodes} />
            </div>
            <div className="flex-1 space-y-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="给工作流起个名字"
                className="h-9 text-[13px]"
              />
              <div className="text-[11.5px] text-white/35">
                {realNodes.length} 个节点 · {edges.length} 条连线
              </div>
            </div>
          </div>

          {/* 标签（最多 5 个） */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[12px] text-white/45">
              <Tags className="size-3" />
              标签（最多 5 个，回车添加）
            </div>
            <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-white/10 bg-white/4 p-2">
              {tags.map((t) => (
                <span
                  key={t}
                  className="flex items-center gap-1 rounded-md border border-primary/25 bg-primary/10 py-0.5 pr-1 pl-1.5 text-[11.5px] text-primary-200"
                >
                  {t}
                  <button
                    onClick={() => setTags(tags.filter((x) => x !== t))}
                    className="flex size-3.5 items-center justify-center rounded-full hover:bg-white/15"
                  >
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
              {tags.length < 5 && (
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    } else if (
                      e.key === "Backspace" &&
                      !tagInput &&
                      tags.length
                    ) {
                      setTags(tags.slice(0, -1));
                    }
                  }}
                  placeholder={tags.length ? "" : "如：短视频教学"}
                  className="h-6 min-w-[120px] flex-1 bg-transparent text-[12px] text-white/85 outline-none placeholder:text-white/30"
                />
              )}
            </div>
          </div>

          {/* 备注/教学说明 */}
          <div className="space-y-1.5">
            <div className="text-[12px] text-white/45">备注 / 教学说明</div>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="这个工作流适合教什么、分几步、学生要注意什么…"
              className="min-h-[72px] resize-none text-[12.5px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!canSave}>
            <Check className="size-3.5" />
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* 工具箱面板：打开模板 / 发送到画布 / 删除                            */
/* ------------------------------------------------------------------ */


export function ToolboxDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const items = useToolboxStore((s) => s.items);
  const removeItem = useToolboxStore((s) => s.removeItem);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <FolderOpen className="size-4 text-white/60" />
            我的工具箱
          </DialogTitle>
          <DialogDescription className="text-[12px]">
            把模板发送到当前画布，节点会重新编号、清空运行结果
          </DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-14 text-center">
            <FolderOpen className="size-8 text-white/25" />
            <div className="text-[13px] text-white/45">工具箱还是空的</div>
            <div className="text-[12px] text-white/30">
              先在画布上搭好流程，再点上方「保存到工具箱」
            </div>
          </div>
        ) : (
          <div className="grid max-h-[440px] grid-cols-2 gap-3 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="group overflow-hidden rounded-xl border border-white/10 bg-[#151517] transition hover:border-white/20"
              >
                <div className="h-[110px] overflow-hidden border-b border-white/8">
                  <Cover nodes={item.nodes} />
                </div>
                <div className="space-y-1.5 p-3">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[13px] font-medium text-white/85">
                      {item.name}
                    </span>
                  </div>
                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((t) => (
                        <span
                          key={t}
                          className="rounded bg-white/8 px-1.5 py-0.5 text-[10.5px] text-white/50"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-1 text-[11px] text-white/30">
                    <Clock3 className="size-3" />
                    {new Date(item.updatedAt).toLocaleDateString("zh-CN")}
                    <span className="ml-1">
                      · {item.nodes.length} 节点
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-1">
                    <Button
                      size="sm"
                      className="h-7 flex-1 text-[12px]"
                      onClick={() => {
                        loadToolboxToCanvas(item);
                        onOpenChange(false);
                      }}
                    >
                      <ArrowUpRight className="size-3" />
                      发送到画布
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="outline"
                      className="size-7"
                      onClick={() => removeItem(item.id)}
                      title="删除模板"
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* 供顶栏使用的小图标按钮（放在文件里方便统一管理） */
export function ToolboxEntry({
  onSave,
  onOpen,
}: {
  onSave: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="ml-1 flex items-center gap-0.5 rounded-lg border border-white/10 bg-white/4 p-0.5">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7 text-white/70"
        onClick={onSave}
        title="保存到工具箱"
      >
        <Save className="size-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-7 text-white/40"
        onClick={onOpen}
        title="打开工具箱"
      >
        <FolderOpen className="size-3.5" />
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ToolboxHost：集中挂载保存/打开弹窗，并接管快捷键与自定义事件。      */
/* 删除 TopBar 后用它避免入口丢失。                                     */
/* ------------------------------------------------------------------ */

export function ToolboxHost() {
  const [saveOpen, setSaveOpen] = React.useState(false);
  const [boxOpen, setBoxOpen] = React.useState(false);

  // Ctrl/Cmd + S → 保存到工具箱
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        setSaveOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // 组节点工具条上的「存为工具」
  React.useEffect(() => {
    const onSave = () => setSaveOpen(true);
    const onOpen = () => setBoxOpen(true);
    window.addEventListener("aiteach:save-toolbox", onSave);
    window.addEventListener("aiteach:open-toolbox", onOpen);
    return () => {
      window.removeEventListener("aiteach:save-toolbox", onSave);
      window.removeEventListener("aiteach:open-toolbox", onOpen);
    };
  }, []);

  return (
    <>
      <SaveToolboxDialog open={saveOpen} onOpenChange={setSaveOpen} />
      <ToolboxDialog open={boxOpen} onOpenChange={setBoxOpen} />
    </>
  );
}

