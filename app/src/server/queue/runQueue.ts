import { prisma } from "@/lib/prisma";
import { getProvider } from "@/server/providers/registry";
import { applyAutoLink } from "@/server/providers/autoLink";
import type { GenResult } from "@/server/providers/types";
import type { FlowNodeData } from "@/types";
import { runEventBus } from "./eventBus";
import { hashInput } from "./inputHash";
import { recordGeneratedAsset } from "./recordAsset";
import {
  loadOwnedNode,
  resolveUpstreams,
  resolveNodeVariables,
  resolveRefs,
} from "./resolveRunInput";
import type { VariableValues } from "@/lib/variableTypes";

/* ------------------------------------------------------------------ */
/* RunQueue：进程内任务队列 + 状态机（T2.3）                             */
/* ------------------------------------------------------------------ */
/* 状态机：                                                             */
/*   queued → running(progress) → succeeded | failed | canceled          */
/* - run API 只负责鉴权 + 创建 NodeRun(queued) + enqueue，立即返回；       */
/* - worker 在后台限并发执行；上游就绪检查放在“执行时”（而非入队时），      */
/*   这样整组批量入队时，排在前面的上游先跑完，后面的节点执行时自然就绪。    */
/* - 中间进度只走事件总线，不落库（避免与终态写库竞态）；                   */
/*   终态在一个事务里更新 NodeRun 并把产物写回 CanvasNode。                */
/* - 取消：每个任务一个 AbortController。未开始的直接出队；执行中的 abort()  */
/*   传给 provider 的 signal，provider 内部检查后抛 AbortError。           */
/* - 超时：同样走 abort，避免一个卡死的 provider 永久占住并发位。           */
/* ------------------------------------------------------------------ */

/** 最大并发执行数（Mock 耗时任务，2 路并发足够演示又不压垮单机） */
const MAX_CONCURRENCY = 2;

/**
 * 单个任务的最长执行时间，超过就中止并标 failed。
 * 真实厂商的图/视频生成可能几分钟，所以默认给 5 分钟；可用 env 覆盖便于测试。
 */
const MAX_RUN_MS = Number(process.env.RUN_TIMEOUT_MS ?? 5 * 60 * 1000);

interface QueueItem {
  runId: string;
}

export interface RunQueue {
  /** 已创建好的 NodeRun(queued) 入队，等待后台执行 */
  enqueue(runId: string): void;
  /** 取消单个任务（未开始→出队；执行中→中止）。返回是否真的取消了 */
  cancel(runId: string): Promise<boolean>;
  /** 取消某张画布上所有排队/执行中的任务，返回取消条数 */
  cancelByWorkflow(workflowId: string): Promise<number>;
  /** 当前队列中等待 + 正在执行的任务数（排查用） */
  size(): { waiting: number; active: number };
}

function createQueue(): RunQueue {
  const waiting: QueueItem[] = [];
  const active = new Set<string>();
  /** runId → 中止控制器（执行中的任务才有） */
  const controllers = new Map<string, AbortController>();

  /** 发布事件 */
  const emit = (
    runId: string,
    type: Parameters<typeof runEventBus.emit>[0]["type"],
    extra: Partial<Parameters<typeof runEventBus.emit>[0]> = {},
  ) => {
    const run = cache.get(runId);
    runEventBus.emit({
      type,
      runId,
      nodeId: run?.nodeId ?? "",
      workflowId: run?.workflowId ?? "",
      at: Date.now(),
      ...extra,
    });
  };

  // runId → { nodeId, workflowId }（emit 时用，避免每个事件都查库）
  const cache = new Map<string, { nodeId: string; workflowId: string }>();

  /** 把任务标记为失败（并发布事件） */
  const fail = async (
    runId: string,
    message: string,
  ) => {
    await prisma.nodeRun.update({
      where: { id: runId },
      data: { status: "failed", error: message, progress: 0, finishedAt: new Date() },
    });
    emit(runId, "failed", { progress: 0, error: message });
  };

  /**
   * 把任务标为已取消。
   * 只对仍是 queued/running 的行生效——若任务刚刚跑完（succeeded），
   * 取消不该把已完成的结果覆盖掉。
   */
  const markCanceled = async (runId: string, message: string) => {
    const res = await prisma.nodeRun.updateMany({
      where: { id: runId, status: { in: ["queued", "running"] } },
      data: {
        status: "canceled",
        error: message,
        progress: 0,
        finishedAt: new Date(),
      },
    });
    if (res.count === 0) return false;

    // 排队中就被取消的任务从没进过 process，cache 里没它 → 现查一次拿到 nodeId/workflowId
    let info = cache.get(runId);
    let temp = false;
    if (!info) {
      const row = await prisma.nodeRun.findUnique({
        where: { id: runId },
        select: { nodeId: true, workflowId: true },
      });
      if (row) {
        info = { nodeId: row.nodeId, workflowId: row.workflowId };
        cache.set(runId, info);
        temp = true;
      }
    }
    runEventBus.emit({
      type: "canceled",
      runId,
      nodeId: info?.nodeId ?? "",
      workflowId: info?.workflowId ?? "",
      progress: 0,
      error: message,
      at: Date.now(),
    });
    if (temp) cache.delete(runId);
    return true;
  };

  /** worker：执行一个任务 */
  const process = async (item: QueueItem) => {
    const { runId } = item;
    active.add(runId);

    /* 取消与超时都走同一个 abort；reason 用来区分最后的终态文案 */
    const ctrl = new AbortController();
    controllers.set(runId, ctrl);
    let timedOut = false;
    const timeoutTimer = setTimeout(() => {
      timedOut = true;
      ctrl.abort("timeout");
    }, MAX_RUN_MS);

    try {
      const run = await prisma.nodeRun.findUnique({ where: { id: runId } });
      if (!run) return; // 任务可能已被清理
      const { nodeId, workflowId } = run;
      cache.set(runId, { nodeId, workflowId });

      // 1) 执行时再解析一次节点与上游（批量入队时上游此刻可能刚好跑完）
      const loaded = await loadOwnedNode(nodeId, run.userId);
      if ("error" in loaded) {
        await fail(runId, loaded.error.message);
        return;
      }
      let nodeData: FlowNodeData;
      try {
        nodeData = JSON.parse(loaded.row.data) as FlowNodeData;
      } catch {
        await fail(runId, "节点数据损坏");
        return;
      }

      const { upstreams, pending } = await resolveUpstreams(workflowId, nodeId);
      if (pending.length > 0) {
        await fail(runId, `上游节点还没生成产物：${pending.join("、")}`);
        return;
      }

      // 1.5) 变量渲染：从本次运行 input 取提交值，回退老师默认，渲染 {{key}}
      let submittedVars: VariableValues = {};
      try {
        const snap = run.input ? JSON.parse(run.input) as { variables?: VariableValues } : null;
        if (snap?.variables && typeof snap.variables === "object") {
          submittedVars = snap.variables;
        }
      } catch {
        // 快照损坏时退回仅默认值
      }
      const vres = await resolveNodeVariables(workflowId, nodeData, submittedVars);
      if (vres.missing.length > 0) {
        await fail(
          runId,
          `还有变量没填写：${vres.missing.map((k) => `{{${k}}}`).join("、")}`,
        );
        return;
      }
      // 后续统一用渲染后的提示词（哈希 / provider / 画布回写）
      const renderedData: FlowNodeData = { ...nodeData, prompt: vres.prompt };

      // 1.6) AutoLink（对齐 LibTV）：上游文本/脚本产出的动作契约驱动下游。
      // 必须在算哈希之前注入，缓存键才与真实输入一致。
      const auto = applyAutoLink(
        renderedData.kind,
        renderedData.prompt,
        renderedData.params as Record<string, unknown> | undefined,
        upstreams,
      );
      const effectivePrompt = auto.prompt;

      // 1.7) `@引用` 解析（参考/标记/角色库）：进上下文、参考图与模型覆盖。
      // 与 AutoLink 同理：必须在算哈希之前注入，缓存键才与真实输入一致。
      const refRes = await resolveRefs(nodeData, run.userId);
      const seenUp = new Set(upstreams.map((u) => u.nodeId));
      const mergedUpstreams = [
        ...upstreams,
        ...refRes.upstreams.filter((u) => !seenUp.has(u.nodeId)),
      ];
      const effectiveParams = {
        ...(auto.params ??
          (renderedData.params as Record<string, unknown> | undefined)),
        ...(refRes.modelOverride ? { model: refRes.modelOverride } : {}),
      };

      // 2) queued → running 之前先查缓存：同节点同样输入且上次成功 → 直接复用
      const inputHash = hashInput({
        nodeKind: renderedData.kind,
        prompt: effectivePrompt,
        params: effectiveParams,
        upstreams: mergedUpstreams.map((u) => ({ kind: u.kind, summary: u.summary })),
        refs: (nodeData.refs ?? []).map((r) => ({ type: r.type, id: r.id })),
        referenceImages: refRes.referenceImages,
      });

      const cached = await prisma.nodeRun.findFirst({
        where: {
          nodeId,
          status: "succeeded",
          inputHash,
        },
        orderBy: { createdAt: "desc" },
      });

      if (cached?.output) {
        const cachedResult = JSON.parse(cached.output) as GenResult;
        const finishedAt = new Date();
        await prisma.nodeRun.update({
          where: { id: runId },
          data: {
            status: "succeeded",
            progress: 100,
            cost: 0,
            inputHash,
            output: cached.output,
            finishedAt,
          },
        });
        // 产物已在画布节点上（缓存来源就是它/或同输入的产物）；确保画布节点也是成功态
        await prisma.canvasNode.updateMany({
          where: { id: nodeId },
          data: {
            data: JSON.stringify({
              ...nodeData,
              status: "succeeded",
              progress: 100,
              output: cachedResult,
            } satisfies FlowNodeData),
          },
        });
        emit(runId, "cached", {
          progress: 100,
          output: cachedResult,
          cached: true,
        });
        return;
      }

      // 未命中缓存：标记 running，记下本次 inputHash（结束时随产物一起成为可命中项）
      // worker 自行估算积分（与 run route 同口径，真实成功要写入实际 cost）
      const provider0 = getProvider(nodeData.kind);
      const actualCost = provider0.costEstimate({
        nodeId,
        nodeKind: nodeData.kind,
        prompt: effectivePrompt,
        title: nodeData.title,
        params: effectiveParams,
        upstreams: mergedUpstreams,
        referenceImages: refRes.referenceImages,
      });
      await prisma.nodeRun.update({
        where: { id: runId },
        data: { status: "running", startedAt: new Date(), inputHash, cost: actualCost },
      });
      emit(runId, "started", { progress: 0 });

      // 3) 执行 provider（中间进度只发事件）
      const provider = getProvider(nodeData.kind);
      const result: GenResult = await provider.generate(
        {
          nodeId,
          nodeKind: nodeData.kind,
          prompt: effectivePrompt,
          title: nodeData.title,
          params: effectiveParams,
          upstreams: mergedUpstreams,
          referenceImages: refRes.referenceImages,
        },
        {
          runId,
          onProgress: (progress) => emit(runId, "progress", { progress }),
          // 队列→provider 的取消信号：Mock 的 runWithProgress 会检查它并抛 AbortError
          signal: ctrl.signal,
        },
      );

      // 刚拿到结果就被取消：不再写成功终态（尊重用户的停止意图）
      if (ctrl.signal.aborted) {
        await markCanceled(runId, "已取消").catch(() => {});
        return;
      }

      // 4) 终态事务：NodeRun succeeded + 产物写回 CanvasNode
      const finishedAt = new Date();
      await prisma.$transaction([
        prisma.nodeRun.update({
          where: { id: runId },
          data: {
            status: "succeeded",
            progress: 100,
            output: JSON.stringify(result),
            inputHash,
            cost: actualCost,
            finishedAt,
          },
        }),
        prisma.canvasNode.update({
          where: { id: nodeId },
          data: {
            data: JSON.stringify({
              ...nodeData,
              status: "succeeded",
              progress: 100,
              output: result,
            } satisfies FlowNodeData),
          },
        }),
      ]);
      // 真实生成成功：媒体产物自动进入「生成历史」，并补项目封面
      await recordGeneratedAsset({
        userId: run.userId,
        workflowId,
        nodeId,
        runId,
        nodeKind: nodeData.kind,
        result,
      }).catch(() => {});
      emit(runId, "succeeded", { progress: 100, output: result });
    } catch (e) {
      if (ctrl.signal.aborted) {
        // 中止不算“失败”：用户取消 → canceled；超时 → failed 并附上原因
        if (timedOut) {
          await fail(
            runId,
            `生成超时（超过 ${Math.round(MAX_RUN_MS / 1000)} 秒）`,
          ).catch(() => {});
        } else {
          await markCanceled(runId, "已取消").catch(() => {});
        }
      } else {
        const message = e instanceof Error ? e.message : "生成失败";
        await fail(runId, message).catch(() => {});
      }
    } finally {
      clearTimeout(timeoutTimer);
      controllers.delete(runId);
      active.delete(runId);
      cache.delete(runId);
      pump();
    }
  };

  /** 调度：只要有空位就从等待队列取下一个执行 */
  const pump = () => {
    while (active.size < MAX_CONCURRENCY && waiting.length > 0) {
      const item = waiting.shift()!;
      void process(item);
    }
  };

  /**
   * 取消任务。
   * - 还在排队 → 直接出队并写 canceled（worker 不会再碰它）
   * - 执行中 → abort，让 provider 抛 AbortError，终态由 process 的 catch 写
   * - 已终态 / 不在本队列 → markCanceled 的 where 条件不会命中，返回 false
   */
  const cancelRun = async (runId: string): Promise<boolean> => {
    const idx = waiting.findIndex((w) => w.runId === runId);
    if (idx >= 0) {
      waiting.splice(idx, 1);
      return markCanceled(runId, "已取消");
    }
    const ctrl = controllers.get(runId);
    if (ctrl) {
      ctrl.abort("canceled");
      return true;
    }
    // 不在队列里：可能刚结束，也可能进程重启后遗留——按 DB 现状兜底
    return markCanceled(runId, "已取消");
  };

  return {
    enqueue(runId) {
      waiting.push({ runId });
      pump();
    },

    cancel: cancelRun,

    /**
     * 取消某张画布上全部排队 + 执行中的任务（画布上的「停止」按钮用）。
     * 直接以数据库为准：不依赖队列内存里记得 workflowId。
     */
    async cancelByWorkflow(workflowId) {
      const rows = await prisma.nodeRun.findMany({
        where: { workflowId, status: { in: ["queued", "running"] } },
        select: { id: true },
      });
      let n = 0;
      for (const r of rows) {
        if (await cancelRun(r.id)) n += 1;
      }
      return n;
    },

    size: () => ({ waiting: waiting.length, active: active.size }),
  };
}

const KEY = "__aiteachRunQueue__";
const globalForQueue = globalThis as unknown as Record<string, RunQueue | undefined>;

export const runQueue: RunQueue =
  globalForQueue[KEY] ?? (globalForQueue[KEY] = createQueue());

/** 启动时恢复：把上次进程异常退出留下的 running 任务标记为失败（避免永久卡住） */
export async function recoverStaleRuns() {
  const stale = await prisma.nodeRun.updateMany({
    where: { status: { in: ["running", "queued"] } },
    data: { status: "failed", error: "服务重启，任务中断", finishedAt: new Date() },
  });
  return stale.count;
}
