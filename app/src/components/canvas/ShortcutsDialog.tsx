"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/** 画布快捷键与操作说明；TopBar 的 ? 与底部工具坞共用 */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "画布",
    items: [
      ["拖拽空白处", "平移画布（选择模式下为框选，见下）"],
      ["滚轮 / 触控板", "缩放画布"],
      ["空格 + 拖拽", "临时平移（任何模式下都可用）"],
      ["双击空白处", "在该位置添加节点"],
      ["右键空白处", "添加节点菜单"],
      ["缩放百分比", "左下角可切 25% ~ 200% / 适应画布"],
    ],
  },
  {
    title: "节点",
    items: [
      ["单击节点", "选中并展开底部编辑器"],
      ["拖右侧 + 到别的节点", "连线（会做端口类型校验）"],
      ["拖到空白处松手", "弹出节点选择，选完自动连线"],
      ["右键节点", "复制 / 打组 / 解组 / 删除"],
      ["Backspace / Delete", "删除选中节点或连线"],
      ["节点右侧 ⤢", "放大编辑提示词"],
    ],
  },
  {
    title: "组织与运行",
    items: [
      ["⌘/Ctrl + G", "把选中的多个节点打组"],
      ["⇧⌘/Ctrl + G", "解组"],
      ["拖到空白处 · 组工具条", "整组执行"],
      ["底部 🤖", "整体执行整个工作流"],
      ["底部场记板", "故事板：汇总全部产出"],
      ["⌘/Ctrl + S", "保存当前画布到工具箱"],
      ["⌘/Ctrl + Enter", "生成选中节点"],
      ["⌘/Ctrl + D", "创建选中节点的副本"],
      ["⌘/Ctrl + 0", "适应画布"],
      ["Tab", "在画布中央唤出新建节点"],
      ["⌥⇧ + F", "一键整理画布布局"],
    ],
  },
  {
    title: "编辑",
    items: [
      ["⌘/Ctrl + Z", "撤销"],
      ["⇧⌘/Ctrl + Z 或 ⌘/Ctrl + Y", "重做"],
      ["@", "在提示词里引用节点 / 素材 / 模型"],
      ["↑ ↓ Enter Esc", "@ 浮层里选择与确认"],
      ["底部 ⏱", "历史记录：可跳回任意一步"],
    ],
  },
];

export function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] overflow-y-auto sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>快捷键与操作</DialogTitle>
          <DialogDescription>
            画布支持鼠标、触控板与键盘混合操作；提示词输入框内的 ⌘Z
            仍交给浏览器原生撤销。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 sm:grid-cols-2">
          {GROUPS.map((g) => (
            <section key={g.title} className="space-y-2">
              <h3 className="text-[12px] font-medium tracking-wide text-white/45">
                {g.title}
              </h3>
              <ul className="space-y-1.5">
                {g.items.map(([k, v]) => (
                  <li key={k} className="flex items-start gap-2 text-[12.5px]">
                    <kbd className="shrink-0 rounded-md border border-white/12 bg-white/6 px-1.5 py-0.5 font-mono text-[11px] text-white/80">
                      {k}
                    </kbd>
                    <span className="text-white/55">{v}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
