/**
 * runStore（T2.5）自测：SSE 事件 → 节点运行状态的归并。
 * 运行：pnpm tsx scripts/check-runstore.ts
 */
import { useRunStore, type RunEventPayload } from "../src/stores/runStore";

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const ev = (e: Partial<RunEventPayload>): RunEventPayload => ({
  type: "progress",
  runId: "r1",
  nodeId: "n1",
  workflowId: "w1",
  ...e,
});

function main() {
  useRunStore.getState().reset();

  // queued
  useRunStore.getState().apply(ev({ type: "queued" }));
  let s = useRunStore.getState().nodeStatus.n1;
  check("queued → status=queued", s.status === "queued");

  // started
  useRunStore.getState().apply(ev({ type: "started", progress: 0 }));
  s = useRunStore.getState().nodeStatus.n1;
  check("started → running", s.status === "running" && s.progress === 0);

  // progress
  useRunStore.getState().apply(ev({ type: "progress", progress: 40 }));
  s = useRunStore.getState().nodeStatus.n1;
  check("progress → running/40", s.status === "running" && s.progress === 40);

  // 成功（带产物）
  useRunStore.getState().apply(
    ev({ type: "succeeded", progress: 100, output: { kind: "video", urls: ["x"] } }),
  );
  s = useRunStore.getState().nodeStatus.n1;
  check("succeeded → succeeded/100/有产物",
    s.status === "succeeded" && s.progress === 100 && !!s.output);

  // 失败
  useRunStore.getState().apply(ev({ nodeId: "n2", type: "failed", error: "出错了" }));
  s = useRunStore.getState().nodeStatus.n2;
  check("failed → failed/有错误", s.status === "failed" && s.error === "出错了");

  // 多节点互不干扰
  check("n1 仍是 succeeded", useRunStore.getState().nodeStatus.n1.status === "succeeded");

  // reset 指定节点
  useRunStore.getState().reset(["n2"]);
  check("reset(['n2']) 只清 n2",
    !useRunStore.getState().nodeStatus.n2 && !!useRunStore.getState().nodeStatus.n1);

  // reset 全部
  useRunStore.getState().reset();
  check("reset() 清空全部", Object.keys(useRunStore.getState().nodeStatus).length === 0);

  // succeeded 不带 progress 时补 100
  useRunStore.getState().apply(ev({ type: "succeeded" }));
  check("succeeded 无 progress → 100", useRunStore.getState().nodeStatus.n1.progress === 100);

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
