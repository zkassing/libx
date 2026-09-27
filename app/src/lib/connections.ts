import type { Edge } from "@xyflow/react";
import type { NodeKind } from "../types";

/* ------------------------------------------------------------------ */
/* 连线校验（M2 口径，参考 LibTV）                                     */
/* ------------------------------------------------------------------ */
/* 连线不做类型限制、也不拦成环——图是自由的，用户想怎么连就怎么连。       */
/* 只保留两条纯粹的“防呆”规则：                                        */
/*   ① 不能连到节点自身（没有任何意义）                                 */
/*   ② 两个节点间不能重复连同样的边（否则会出现一堆重叠线）             */
/* 类型 / 环相关的提示放到运行时（整体执行时再提示），不在连线时阻拦。   */
/* ------------------------------------------------------------------ */

export interface ConnectionCheck {
  ok: boolean;
  reason?: string;
}

/** 端点：节点 id + 节点种类（保留入参形状，调用方不用改） */
export interface Endpoint {
  id: string;
  kind: NodeKind;
}

type EdgeLike = Pick<Edge, "source" | "target">;

/**
 * 校验一条连线。
 * M2：只挡「自连」和「重复边」，不做类型兼容 / 成环检查。
 */
export function checkConnection(
  source: Endpoint,
  target: Endpoint,
  edges: EdgeLike[],
): ConnectionCheck {
  if (source.id === target.id) {
    return { ok: false, reason: "不能连接到节点自身" };
  }

  if (edges.some((e) => e.source === source.id && e.target === target.id)) {
    return { ok: false, reason: "这两个节点之间已经有连线了" };
  }

  return { ok: true };
}
