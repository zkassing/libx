/**
 * 连线校验的自测（纯函数，不需要浏览器）
 * M2 口径：连线不限制类型、不拦成环；只防「自连」和「重复边」。
 * 运行：pnpm tsx scripts/check-connections.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import type { Edge } from "@xyflow/react";
import { checkConnection, type Endpoint } from "../src/lib/connections";

const E = (source: string, target: string) => ({ source, target }) as Edge;

const cases: [string, Endpoint, Endpoint, Edge[], boolean][] = [
  // —— 任意类型组合都允许 ——
  ["text → image", { id: "a", kind: "text" }, { id: "b", kind: "image" }, [], true],
  ["text → video", { id: "a", kind: "text" }, { id: "b", kind: "video" }, [], true],
  ["image → video", { id: "a", kind: "image" }, { id: "b", kind: "video" }, [], true],
  ["video → audio", { id: "a", kind: "video" }, { id: "b", kind: "audio" }, [], true],
  ["image → text", { id: "a", kind: "image" }, { id: "b", kind: "text" }, [], true],
  ["video → image（以前会被拒，现在允许）", { id: "a", kind: "video" }, { id: "b", kind: "image" }, [], true],
  ["image → script（以前会被拒，现在允许）", { id: "a", kind: "image" }, { id: "b", kind: "script" }, [], true],
  ["audio → image（以前会被拒，现在允许）", { id: "a", kind: "audio" }, { id: "b", kind: "image" }, [], true],
  // —— 成环不再拦（自由图） ——
  ["成环 a→b→c→a 也允许", { id: "c", kind: "text" }, { id: "a", kind: "text" }, [E("a", "b"), E("b", "c")], true],
  // —— 只防自连 / 重复 ——
  ["自连 拒绝", { id: "a", kind: "text" }, { id: "a", kind: "text" }, [], false],
  ["重复连 拒绝", { id: "a", kind: "text" }, { id: "b", kind: "image" }, [E("a", "b")], false],
  ["已存在 a→c 时再连 a→c 拒绝", { id: "a", kind: "text" }, { id: "c", kind: "text" }, [E("a", "c")], false],
  ["无关已有边 仍合法", { id: "a", kind: "text" }, { id: "c", kind: "text" }, [E("b", "c")], true],
];

let failed = 0;
for (const [name, source, target, edges, want] of cases) {
  const result = checkConnection(source, target, edges);
  const pass = result.ok === want;
  if (!pass) failed += 1;
  console.log(
    `${pass ? "PASS" : "FAIL"}  ${name}  → ${result.ok ? "ok" : result.reason}`,
  );
}

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
