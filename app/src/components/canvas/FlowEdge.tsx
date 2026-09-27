"use client";

import {
  EdgeLabelRenderer,
  getBezierPath,
  Position,
  useInternalNode,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { X } from "lucide-react";
import { useCanvasStore } from "@/stores/canvasStore";

/** 水滴型光斑：右侧圆头 + 左侧尖尾（配合 rotate="auto" 朝向运动方向） */
const DROP = "M 0,-2.8 A 2.8,2.8 0 1 1 0,2.8 L -10,0 Z";

/** 一条线上的光斑数量 */
const DROPS = 3;
/** 光斑跑完一条线的时间（秒） */
const DUR = 2.8;

/**
 * 连接线：
 * - 实线，锚点直接用卡片边框坐标算（不用端口中心，避免 transform 导致的 ~9px 空隙）
 * - 只有当线的两端里有「被选中的卡片」时，才出现移动的水滴光斑
 * - 可点击选中（靠透明的宽 hit path），选中后高亮 + 显示删除按钮
 */
export function FlowEdge({ id, source, target, selected }: EdgeProps) {
  const sNode = useInternalNode(source);
  const tNode = useInternalNode(target);
  const { deleteElements } = useReactFlow();

  // 与选中卡片相连的线才显示光斑
  const active = useCanvasStore((s) =>
    s.nodes.some((n) => n.selected && (n.id === source || n.id === target)),
  );

  if (!sNode?.measured?.width || !tNode?.measured?.width) return null;

  const sp = sNode.internals.positionAbsolute;
  const tp = tNode.internals.positionAbsolute;
  const sw = sNode.measured.width;
  const sh = sNode.measured.height ?? 0;
  const tw = tNode.measured.width;
  const th = tNode.measured.height ?? 0;

  const toRight = tp.x + tw / 2 >= sp.x + sw / 2;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: toRight ? sp.x + sw : sp.x,
    sourceY: sp.y + sh / 2,
    sourcePosition: toRight ? Position.Right : Position.Left,
    targetX: toRight ? tp.x : tp.x + tw,
    targetY: tp.y + th / 2,
    targetPosition: toRight ? Position.Left : Position.Right,
    curvature: 0.35,
  });

  return (
    <>
      {/* 点击命中区：透明的加粗路径，没有它这条线基本点不中（点一下 = 选中） */}
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={22}
        className="react-flow__edge-interaction"
        style={{ cursor: "pointer" }}
      />

      {/* 选中时的外发光 */}
      {selected && (
        <path
          d={edgePath}
          fill="none"
          stroke="#1677ff"
          strokeWidth={7}
          opacity={0.16}
          style={{ filter: "blur(3px)" }}
        />
      )}

      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        fill="none"
        style={{
          stroke: selected
            ? "#4f9dff"
            : active
              ? "rgba(255,255,255,0.34)"
              : "rgba(255,255,255,0.2)",
          strokeWidth: selected ? 2.2 : active ? 1.6 : 1.3,
          pointerEvents: "none",
        }}
      />

      {active &&
        !selected &&
        Array.from({ length: DROPS }).map((_, i) => (
          <g key={i} style={{ pointerEvents: "none" }}>
            <animateMotion
              dur={`${DUR}s`}
              begin={`${(-(i * DUR) / DROPS).toFixed(3)}s`}
              repeatCount="indefinite"
              rotate="auto"
              path={edgePath}
            />
            {/* 外圈柔光 */}
            <path
              d={DROP}
              transform="scale(2.1)"
              fill="#1677ff"
              opacity="0.22"
              style={{ filter: "blur(1.5px)" }}
            />
            {/* 水滴本体 */}
            <path d={DROP} fill="#dbe9ff" />
          </g>
        ))}

      {selected && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-auto absolute flex items-center gap-1"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                deleteElements({ edges: [{ id }] });
              }}
              title="删除这条连线"
              className="flex size-5 items-center justify-center rounded-full border border-white/20 bg-[#1c1c20] text-white/70 shadow-lg transition hover:border-destructive/60 hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const edgeTypes = { flow: FlowEdge };
