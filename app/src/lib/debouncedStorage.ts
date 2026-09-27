import type { StateStorage } from "zustand/middleware";

/**
 * 防抖的 localStorage 适配器。
 *
 * 背景：zustand persist 默认在**每次** state 变化时同步写盘。
 * 拖动节点 / 连线时 `onNodesChange` 每帧触发一次，等于每帧
 * `JSON.stringify(整个节点图)` + 一次同步 localStorage 写入 —— D 盘上尤其明显。
 *
 * 这里把写入合并成 trailing 单次写：高频变更只保留最后一份快照。
 * 同时注册 beforeunload / pagehide / visibilitychange 兜底 flush，
 * 保证关页面或切标签时不会丢掉最后一次拖拽。
 */
export interface DebouncedLocalStorage {
  storage: StateStorage;
  /** 立即把待写入的快照落盘 */
  flush: () => void;
  /** 真实落盘次数（调试 / 验证用） */
  writes: () => number;
}

function resolveLocalStorage(): Storage | null {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  // SSR / 测试环境：允许通过 globalThis.localStorage 注入
  const g = globalThis as typeof globalThis & { localStorage?: Storage };
  return g.localStorage ?? null;
}

export function createDebouncedLocalStorage(
  delay = 400,
): DebouncedLocalStorage {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { key: string; value: string } | null = null;
  let writeCount = 0;

  const flush = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!pending) return;
    const { key, value } = pending;
    pending = null;
    const store = resolveLocalStorage();
    if (!store) return;
    try {
      store.setItem(key, value);
      writeCount += 1;
    } catch {
      // 配额满 / 隐私模式：静默忽略，不影响画布使用
    }
  };

  const storage: StateStorage = {
    getItem: (name) => {
      // 有待写入的快照时以内存中的为准，避免读到旧值
      if (pending && pending.key === name) return pending.value;
      return resolveLocalStorage()?.getItem(name) ?? null;
    },

    setItem: (name, value) => {
      pending = { key: name, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(flush, delay);
    },

    removeItem: (name) => {
      pending = null;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      resolveLocalStorage()?.removeItem(name);
    },
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", flush);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flush();
    });
  }

  return { storage, flush, writes: () => writeCount };
}
