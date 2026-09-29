"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* ConfirmDialog / PromptDialog                                        */
/* 替代浏览器原生 window.confirm / window.prompt 的统一弹窗。             */
/* 受控组件：父组件持有 open 状态，onConfirm/onSubmit 里做异步动作；       */
/* 内部表单仅在打开时挂载，重开自然重置（不需 effect 清状态）。            */
/* ------------------------------------------------------------------ */

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "确定",
  cancelText = "取消",
  danger = false,
  busy = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  /** 危险操作（删除等）：确认按钮用 destructive 样式 */
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-[12.5px] leading-relaxed">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            {cancelText}
          </Button>
          <Button
            variant={danger ? "destructive" : "default"}
            size="sm"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy && <Loader2 className="size-3.5 animate-spin" />}
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PromptDialog({
  open,
  onOpenChange,
  title,
  defaultValue = "",
  placeholder,
  confirmText = "确定",
  cancelText = "取消",
  maxLength = 60,
  busy = false,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  maxLength?: number;
  busy?: boolean;
  onSubmit: (value: string) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{title}</DialogTitle>
        </DialogHeader>
        {/* 仅在打开时挂载：关闭即卸载，重开输入态自然重置回 defaultValue */}
        {open && (
          <PromptForm
            defaultValue={defaultValue}
            placeholder={placeholder}
            confirmText={confirmText}
            cancelText={cancelText}
            maxLength={maxLength}
            busy={busy}
            onSubmit={onSubmit}
            onCancel={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function PromptForm({
  defaultValue,
  placeholder,
  confirmText,
  cancelText,
  maxLength,
  busy,
  onSubmit,
  onCancel,
}: {
  defaultValue: string;
  placeholder?: string;
  confirmText: string;
  cancelText: string;
  maxLength: number;
  busy: boolean;
  onSubmit: (value: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [value, setValue] = React.useState(defaultValue);
  const trimmed = value.trim();

  const submit = () => {
    if (!trimmed || busy) return;
    void onSubmit(trimmed);
  };

  return (
    <div className="space-y-4">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
        }}
        onFocus={(e) => e.target.select()}
      />
      <DialogFooter>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          {cancelText}
        </Button>
        <Button size="sm" disabled={!trimmed || busy} onClick={submit}>
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {confirmText}
        </Button>
      </DialogFooter>
    </div>
  );
}
