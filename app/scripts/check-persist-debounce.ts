/**
 * 持久化防抖的自测（不需要浏览器）
 * 运行：pnpm tsx scripts/check-persist-debounce.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { createDebouncedLocalStorage } from "../src/lib/debouncedStorage";

/* 假的 localStorage：统计真实写入次数 */
const store = new Map<string, string>();
let rawWrites = 0;
const fake = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (k: string) => store.get(k) ?? null,
  key: (i: number) => [...store.keys()][i] ?? null,
  removeItem: (k: string) => void store.delete(k),
  setItem: (k: string, v: string) => {
    rawWrites += 1;
    store.set(k, v);
  },
} as unknown as Storage;

Object.assign(globalThis, { localStorage: fake });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
function expect(name: string, pass: boolean, detail = "") {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

async function main() {
  const db = createDebouncedLocalStorage(120);

  // ① 高频写入合并成一次
  rawWrites = 0;
  for (let i = 0; i < 200; i++) db.storage.setItem("k", `v${i}`);
  expect("200 次 setItem 后尚未落盘", rawWrites === 0, `raw=${rawWrites}`);
  expect("防抖计数仍为 0", db.writes() === 0, `writes=${db.writes()}`);

  await sleep(200);
  expect("防抖窗口结束后只落盘 1 次", rawWrites === 1, `raw=${rawWrites}`);
  expect("落盘的是最后一份快照", store.get("k") === "v199", store.get("k") ?? "");

  // ② 待写入期间 getItem 读到内存里的新值
  rawWrites = 0;
  db.storage.setItem("k", "fresh");
  expect("待写入时 getItem 返回新值", db.storage.getItem("k") === "fresh");
  await sleep(200);
  expect("之后落盘为新值", store.get("k") === "fresh", store.get("k") ?? "");

  // ③ flush 立即落盘
  rawWrites = 0;
  db.storage.setItem("k", "forced");
  db.flush();
  expect("flush 立即落盘", rawWrites === 1 && store.get("k") === "forced", `raw=${rawWrites}`);

  // ④ removeItem 取消待写入
  rawWrites = 0;
  db.storage.setItem("k", "will-be-removed");
  db.storage.removeItem("k");
  await sleep(200);
  expect("removeItem 取消待写入", rawWrites === 0 && store.get("k") === undefined, `raw=${rawWrites}`);

  // ⑤ 无 localStorage 时不抛错（模拟 SSR）
  const saved = (globalThis as { localStorage?: Storage }).localStorage;
  delete (globalThis as { localStorage?: Storage }).localStorage;
  const ssrDb = createDebouncedLocalStorage(30);
  let threw = false;
  try {
    ssrDb.storage.setItem("k", "x");
    ssrDb.flush();
    ssrDb.storage.removeItem("k");
    expect("SSR 下 getItem 返回 null", ssrDb.storage.getItem("k") === null);
  } catch {
    threw = true;
  }
  expect("无 localStorage 时不抛错", !threw);
  (globalThis as { localStorage?: Storage }).localStorage = saved;

  console.log(failed === 0 ? "\n全部通过" : `\n${failed} 个失败`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
