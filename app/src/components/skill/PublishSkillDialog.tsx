"use client";

import * as React from "react";
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
import type {
  SkillCategory,
  SkillOutputKind,
} from "@/lib/skillTypes";
import { exportSkillTemplate } from "@/server/skills/exportSkill";
import type { FieldErrors } from "@/server/skills/validatePublish";

/* ------------------------------------------------------------------ */
/* 发布当前画布为 Skill 弹窗                                              */
/* ------------------------------------------------------------------ */

const CATEGORY_OPTIONS: Array<{ value: SkillCategory; label: string }> = [
  { value: "film", label: "专业影视" },
  { value: "ad", label: "商业广告" },
  { value: "drama", label: "短剧漫剧" },
  { value: "anime", label: "动漫游戏" },
  { value: "music", label: "音乐 MV" },
  { value: "social", label: "自媒体创作" },
  { value: "general", label: "通用技能" },
];

export function PublishSkillDialog({
  open,
  onOpenChange,
  /** 提交成功回调（带上新 slug） */
  onPublished,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPublished?: (slug: string) => void;
}) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<SkillCategory>("general");
  const [outputKind, setOutputKind] = React.useState<SkillOutputKind>("video");
  const [summary, setSummary] = React.useState("");
  const [scenes, setScenes] = React.useState("");
  const [howTo, setHowTo] = React.useState("");
  const [outputs, setOutputs] = React.useState("");

  const [submitting, setSubmitting] = React.useState(false);
  const [fields, setFields] = React.useState<FieldErrors>({});
  const [fatal, setFatal] = React.useState<string | null>(null);
  const [nodeCount, setNodeCount] = React.useState(0);

  // 打开时取当前画布节点数（用于提示）
  React.useEffect(() => {
    if (!open) return;
    const state = window.__canvasStore?.getState();
    const n = state ? state.nodes.filter((x) => x.type !== "group").length : 0;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNodeCount(n);
  }, [open]);

  const canSubmit = name.trim().length > 0 && nodeCount > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFields({});
    setFatal(null);
    try {
      const storeApi = window.__canvasStore?.getState();
      if (!storeApi) {
        setFatal("画布未就绪");
        return;
      }
      const template = exportSkillTemplate(storeApi.nodes, storeApi.edges);

      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          outputKind,
          summary: summary.trim() || undefined,
          scenes: scenes.trim() || undefined,
          howTo: howTo.trim() || undefined,
          outputs: outputs.trim() || undefined,
          template,
        }),
      });

      if (res.status === 401) {
        setFatal("请先登录");
        return;
      }
      const j = (await res.json().catch(() => null)) as
        | { skill?: { slug: string }; error?: string; fields?: FieldErrors }
        | null;
      if (!res.ok) {
        if (j?.fields) setFields(j.fields);
        setFatal(j?.error ?? "发布失败");
        return;
      }
      onOpenChange(false);
      if (j?.skill?.slug) onPublished?.(j.skill.slug);
    } finally {
      setSubmitting(false);
    }
  };

  const labelCls = "mb-1 block text-[12px] text-white/50";
  const inputCls =
    "h-8 border-white/10 bg-white/5 text-[12.5px] text-white/85 placeholder:text-white/25";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-y-auto sm:max-w-md">
        <DialogHeader className="mb-3">
          <DialogTitle className="text-[15px]">发布为 Skill</DialogTitle>
          <DialogDescription className="text-[12px]">
            当前画布（{nodeCount} 个节点）会存成可复用模板，运行结果不会被带走
          </DialogDescription>
        </DialogHeader>

        {nodeCount === 0 && (
          <div className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-300">
            画布还没有节点，先搭好流程再发布
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className={labelCls}>名称</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如：赛博朋克城市短片"
              className={inputCls}
            />
            {fields.name && <FieldErr m={fields.name} />}
          </div>

          <div>
            <label className={labelCls}>分类</label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORY_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setCategory(c.value)}
                  className={[
                    "rounded-lg px-2.5 py-1 text-[12px] transition",
                    category === c.value
                      ? "bg-white/15 font-medium text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10",
                  ].join(" ")}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>产物类型（卡片角标）</label>
            <div className="flex gap-1.5">
              {(["video", "image"] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setOutputKind(k)}
                  className={[
                    "rounded-lg px-3 py-1 text-[12px] transition",
                    outputKind === k
                      ? "bg-white/15 font-medium text-white"
                      : "bg-white/5 text-white/50 hover:bg-white/10",
                  ].join(" ")}
                >
                  {k === "video" ? "视频" : "图片"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={labelCls}>一句话简介</label>
            <Input
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="这个 Skill 能做什么"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>使用场景</label>
            <Input
              value={scenes}
              onChange={(e) => setScenes(e.target.value)}
              placeholder="如：国风短剧、MV"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>如何使用</label>
            <Input
              value={howTo}
              onChange={(e) => setHowTo(e.target.value)}
              placeholder="如：一句话或一份剧本"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>输出内容</label>
            <Textarea
              value={outputs}
              onChange={(e) => setOutputs(e.target.value)}
              placeholder="如：资产图、分镜、视频成片"
              className="min-h-[56px] resize-none border-white/10 bg-white/5 text-[12.5px]"
            />
          </div>

          {fields.template && <FieldErr m={fields.template} />}
          {fatal && <FieldErr m={fatal} />}
        </div>

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button size="sm" disabled={!canSubmit} onClick={submit}>
            {submitting ? "发布中…" : "发布"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldErr({ m }: { m: string }) {
  return <div className="mt-1 text-[11.5px] text-red-400">{m}</div>;
}

/* ------------------------------------------------------------------ */
/* PublishSkillHost：挂弹窗 + 接事件，供画布页直接挂载                    */
/* ------------------------------------------------------------------ */

export function PublishSkillHost() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("aiteach:publish-skill", onOpen);
    return () => window.removeEventListener("aiteach:publish-skill", onOpen);
  }, []);

  return (
    <PublishSkillDialog
      open={open}
      onOpenChange={setOpen}
      onPublished={() => setOpen(false)}
    />
  );
}
