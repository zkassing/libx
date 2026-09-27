"use client";

import * as React from "react";
import {
  ASPECT_RATIOS,
  DURATIONS,
  NODE_META,
  RESOLUTIONS,
} from "@/lib/nodeTypes";
import { useCanvasStore } from "@/stores/canvasStore";
import { useCanvasPrefs } from "@/stores/canvasPrefs";
import { cn } from "@/lib/utils";
import type { NodeKind, NodeParams } from "@/types";

/* ------------------------------------------------------------------ */
/* NodeInspector：选中节点的右侧属性面板（T2.6）                         */
/* ------------------------------------------------------------------ */
/* 基础：模型 / 提示词 / 参数（比例、分辨率、时长、数量、模式）。           */
/* 参数按节点种类动态出现，图/视频参数对齐 NODE_META 与 §13.2。            */
/* 教学相关（步骤标题/检查点等）属 M4，本面板先只做基础部分。               */
/* ------------------------------------------------------------------ */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11.5px] text-white/40">{label}</span>
      {children}
    </label>
  );
}

/** 分段选择器（chip 组），受控 */
function Segmented<T extends string | number>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value?: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o === value;
        return (
          <button
            key={String(o)}
            type="button"
            onClick={() => onChange(o)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-[12px] transition",
              active
                ? "border-primary/50 bg-primary/15 text-white"
                : "border-white/10 bg-white/4 text-white/60 hover:border-white/20 hover:text-white/85",
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
  );
}

/** 根据节点种类决定要显示哪些参数 */
function ParamFields({
  kind,
  params,
  update,
}: {
  kind: NodeKind;
  params: NodeParams;
  update: (patch: Partial<NodeParams>) => void;
}) {
  const meta = NODE_META[kind];
  return (
    <div className="flex flex-col gap-3.5">
      {meta.modes && (
        <Field label="生成模式">
          <Segmented
            options={meta.modes}
            value={params.mode}
            onChange={(mode) => update({ mode })}
          />
        </Field>
      )}

      {(kind === "image" || kind === "video") && (
        <Field label="画幅比例">
          <Segmented
            options={ASPECT_RATIOS}
            value={params.aspectRatio}
            onChange={(aspectRatio) => update({ aspectRatio })}
          />
        </Field>
      )}

      {kind === "video" && (
        <Field label="分辨率">
          <Segmented
            options={RESOLUTIONS}
            value={params.resolution}
            onChange={(resolution) => update({ resolution })}
          />
        </Field>
      )}

      {(kind === "video" || kind === "audio") && (
        <Field label="时长（秒）">
          <Segmented
            options={DURATIONS}
            value={params.duration}
            onChange={(duration) => update({ duration })}
          />
        </Field>
      )}

      {(kind === "image" || kind === "video" || kind === "audio") && (
        <Field label="生成数量">
          <Segmented
            options={[1, 2, 4] as const}
            value={params.count}
            onChange={(count) => update({ count })}
          />
        </Field>
      )}
    </div>
  );
}

export function NodeInspector() {
  const selectedNodeId = useCanvasStore((s) => s.selectedNodeId);
  const node = useCanvasStore((s) =>
    s.nodes.find((n) => n.id === (selectedNodeId ?? s.selectedNodeId)),
  );
  const updateNodeData = useCanvasStore((s) => s.updateNodeData);
  const updateNodeParams = useCanvasStore((s) => s.updateNodeParams);
  const agentOpen = useCanvasPrefs((s) => s.agentOpen);
  // Agent 面板展开时向左让出 396px + 间距，避免被盖住（同 MiniMap）
  const right = agentOpen ? 412 : 16;

  // 未选中节点：安静的空态（不强占注意力）
  if (!node) {
    return (
      <aside
        style={{ right }}
        className="pointer-events-none absolute top-16 z-30 w-[264px] rounded-xl border border-white/8 bg-[#1b1b1e]/70 p-3 text-[12px] text-white/30 backdrop-blur-xl"
      >
        选中一个节点可编辑模型、提示词与参数
      </aside>
    );
  }

  const { data, id } = node;
  const meta = NODE_META[data.kind];

  return (
    <aside
      style={{ right }}
      className="absolute top-16 z-30 max-h-[calc(100vh-160px)] w-[264px] overflow-y-auto rounded-xl border border-white/10 bg-[#1b1b1e]/92 p-3.5 shadow-2xl backdrop-blur-xl no-scrollbar"
    >
      {/* 标题 */}
      <div className="mb-3 flex items-center gap-2 text-[13px] text-white/85">
        <span
          className="size-2 rounded-full"
          style={{ background: meta.accent }}
        />
        {meta.label}节点属性
      </div>

      <div className="flex flex-col gap-3.5">
        {/* 模型 */}
        <Field label="模型">
          <Segmented
            options={meta.models}
            value={data.params?.model}
            onChange={(model) => updateNodeParams(id, { model })}
          />
        </Field>

        {/* 提示词 */}
        <Field label="提示词">
          <textarea
            value={data.prompt}
            onChange={(e) => updateNodeData(id, { prompt: e.target.value })}
            rows={4}
            placeholder={meta.placeholder}
            className="w-full resize-none rounded-lg border border-white/10 bg-black/30 p-2.5 text-[12.5px] leading-relaxed text-white/90 outline-none placeholder:text-white/30 focus:border-primary/50"
          />
        </Field>

        {/* 动态参数 */}
        <ParamFields
          kind={data.kind}
          params={data.params ?? {}}
          update={(patch) => updateNodeParams(id, patch)}
        />
      </div>
    </aside>
  );
}
