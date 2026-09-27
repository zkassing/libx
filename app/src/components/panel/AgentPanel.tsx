"use client";

import * as React from "react";
import {
  ArrowUp,
  ChevronDown,
  History,
  Maximize2,
  Megaphone,
  Minus,
  PanelRight,
  Plus,
  SplitSquareHorizontal,
  Timer,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useCanvasPrefs } from "@/stores/canvasPrefs";

/** 对齐 LibTV 右侧 "新对话" 浮窗 —— 教学场景下即 AI 助教 */
const TOPICS = [
  "短视频分镜教学",
  "电商主图改造",
  "绘本故事创作",
  "非遗文化短片",
  "校园宣传片",
  "科普动画讲解",
  "产品广告大片",
  "毕业作品集",
];

const SKILLS = ["教学模式", "分镜脚本", "提示词润色", "知识点拆解"];
const MODELS = ["GVLM 3.1", "Doubao Seed Evolving", "DeepSeek V3"];

export function AgentPanel({ hidden }: { hidden?: boolean }) {
  const open = useCanvasPrefs((s) => s.agentOpen);
  const setOpen = useCanvasPrefs((s) => s.setAgentOpen);
  const [value, setValue] = React.useState("");
  const [skill, setSkill] = React.useState(SKILLS[0]);
  const [model, setModel] = React.useState(MODELS[0]);
  const [notice, setNotice] = React.useState(true);
  // 「开启通知」：Mock 期无推送服务，先落到本地偏好，刷新后不再打扰
  const notifyOn = useCanvasPrefs((s) => s.notifyOn);
  const setNotifyOn = useCanvasPrefs((s) => s.setNotifyOn);

  if (hidden) return null;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="absolute top-16 right-4 z-30 flex size-9 items-center justify-center rounded-xl border border-white/10 bg-[#17171a]/90 text-white/70 shadow-xl backdrop-blur-xl transition hover:text-white"
        aria-label="打开 AI 助手"
      >
        <Sparkles className="size-4" />
      </button>
    );
  }

  return (
    <aside className="absolute top-16 right-4 bottom-4 z-30 flex w-[372px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#141416]/95 shadow-2xl backdrop-blur-xl">
      {/* 标题栏 */}
      <div className="flex h-11 shrink-0 items-center px-3">
        <span className="text-[13px] font-medium text-white/80">新对话</span>
        {notifyOn && (
          <span className="ml-2 text-[11px] text-emerald-300/70">已开启通知</span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          {[
            { icon: Timer, label: "历史任务" },
            { icon: History, label: "对话记录" },
            { icon: Maximize2, label: "展开" },
            { icon: SplitSquareHorizontal, label: "分屏" },
          ].map(({ icon: Icon, label }) => (
            <button
              key={label}
              title={`${label} · M4 接入`}
              aria-disabled="true"
              className="flex size-7 cursor-not-allowed items-center justify-center rounded-md text-white/22"
            >
              <Icon className="size-3.5" />
            </button>
          ))}
          <button
            onClick={() => setOpen(false)}
            className="flex size-7 items-center justify-center rounded-md text-white/40 transition hover:bg-white/8 hover:text-white/80"
            aria-label="收起"
          >
            <Minus className="size-3.5" />
          </button>
        </div>
      </div>

      {/* 主体 */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6">
        <div className="flex flex-col items-center gap-3">
          <div className="relative flex size-11 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-blue-500/25">
            <Sparkles className="size-5 text-white" />
          </div>
          <div className="text-[13.5px] font-medium text-white/85">
            从教学主题开始
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-1.5">
          {TOPICS.map((t, i) => (
            <button
              key={t}
              onClick={() => setValue(t)}
              className="flex items-center gap-1.5 rounded-lg border border-white/8 bg-white/[0.03] px-2.5 py-2 text-left text-[12px] text-white/60 transition hover:border-white/20 hover:bg-white/8 hover:text-white/90"
            >
              <span className="text-white/30">#{i + 1}</span>
              <span className="truncate">{t}</span>
            </button>
          ))}
        </div>

        {notice && !notifyOn && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-sky-400/25 bg-sky-500/10 px-2.5 py-2 text-[12px] text-sky-100/85">
            <Megaphone className="size-3.5 shrink-0 text-sky-300" />
            <span className="truncate">开启通知，及时获取生成完成提醒</span>
            <button
              onClick={() => {
                setNotifyOn(true);
                setNotice(false);
              }}
              className="ml-auto shrink-0 rounded bg-white/12 px-2 py-0.5 text-[11.5px] hover:bg-white/20"
            >
              开启
            </button>            <button onClick={() => setNotice(false)} aria-label="关闭">
              <X className="size-3.5 text-white/50 hover:text-white" />
            </button>
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="shrink-0 p-3">
        <div className="rounded-xl border border-white/10 bg-[#1b1b1e] p-2">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="描述你想让学生完成的任务…"
            className="min-h-[62px] resize-none border-0 bg-transparent p-1 text-[13px] text-white/90 shadow-none placeholder:text-white/25 focus-visible:ring-0 dark:bg-transparent"
          />
          <div className="flex items-center gap-1 pt-1">
            <button
              title="上传素材 · M2 接入"
              aria-disabled="true"
              className="flex size-7 cursor-not-allowed items-center justify-center rounded-md text-white/22"
            >
              <Plus className="size-4" />
            </button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-white/60 hover:bg-white/8 hover:text-white/85">
                  {skill}
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="min-w-36">
                <DropdownMenuLabel className="text-[11px]">技能</DropdownMenuLabel>
                {SKILLS.map((s) => (
                  <DropdownMenuItem
                    key={s}
                    className="text-[12.5px]"
                    onSelect={() => setSkill(s)}
                  >
                    {s}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex h-7 max-w-[110px] items-center gap-1 rounded-md px-2 text-[12px] text-white/60 hover:bg-white/8 hover:text-white/85">
                  <span className="truncate">{model}</span>
                  <ChevronDown className="size-3 opacity-60" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="min-w-44">
                {MODELS.map((m) => (
                  <DropdownMenuItem
                    key={m}
                    className="text-[12.5px]"
                    onSelect={() => setModel(m)}
                  >
                    {m}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="ml-auto flex items-center gap-1">
              <PanelRight className="size-3.5 text-white/30" />
              <Button
                size="icon-sm"
                className={cn("rounded-full", !value && "opacity-60")}
                disabled={!value}
              >
                <ArrowUp className="size-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
