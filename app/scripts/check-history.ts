/**
 * 撤销 / 重做的自测
 * 运行：pnpm tsx scripts/check-history.ts
 *
 * 直接操作 zustand store（不需要浏览器；@xyflow/react 的核心工具是纯函数）
 */
import { HISTORY_LABEL_TEXT, useCanvasStore } from "../src/stores/canvasStore";
import { useRunStore } from "../src/stores/runStore";

/*
 * 本脚本测历史栈，不依赖网络。在 Node 环境下 stub 掉 runNode 需要的浏览器 API：
 * - fetch：模拟 POST /run 返回 queued + runId；
 * - EventSource：连接后按帧把 started/progress/succeeded 推进 runStore（模拟 SSE）。
 */
const stubFetch = async (input: string) => {
  const nodeId = String(input).split("/api/nodes/")[1]?.split("/")[0] ?? "x";
  const runId = `stubrun_${nodeId.slice(-4)}`;
  // 模拟 SSE：同步推进事件（不依赖定时器）
  queueMicrotask(() => {
    const base = { runId, nodeId, workflowId: "w" };
    useRunStore.getState().apply({ ...base, type: "started", progress: 0 });
    useRunStore.getState().apply({ ...base, type: "progress", progress: 50 });
    useRunStore.getState().apply({
      ...base, type: "succeeded", progress: 100,
      output: { kind: "video", urls: ["data:x"] },
    });
  });
  return {
    ok: true,
    json: async () => ({ ok: true, runId, status: "queued" }),
  };
};
class StubEventSource {
  onmessage: ((e: { data: string }) => void) | null = null;
  close() {}
  constructor() {}
}
(globalThis as Record<string, unknown>).fetch = stubFetch;
(globalThis as Record<string, unknown>).EventSource = StubEventSource;

let failed = 0;
function expect(name: string, pass: boolean, detail = "") {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

const s = () => useCanvasStore.getState();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const kinds = () =>
  s()
    .nodes.map((n) => n.data.kind)
    .join(",");
const nodeCount = () => s().nodes.length;
const pastLen = () => s().past.length;
const futureLen = () => s().future.length;

async function main() {
  /* ① addNode 可撤销 */
  s().addNode("text", { x: 0, y: 0 });
  s().addNode("image", { x: 400, y: 0 });
  expect("两次 addNode 后 2 节点", nodeCount() === 2, kinds());
  s().undo();
  expect("撤销一次 → 1 节点", nodeCount() === 1, kinds());
  s().undo();
  expect("再撤销 → 0 节点", nodeCount() === 0, kinds());
  expect("撤销到底后 past 为空", pastLen() === 0, `past=${pastLen()}`);

  /* ② redo */
  s().redo();
  s().redo();
  expect("redo 两次 → 2 节点", nodeCount() === 2, kinds());
  expect("redo 到底后 future 为空", futureLen() === 0, `future=${futureLen()}`);

  /* ③ 新操作清空 future */
  s().undo();
  expect("撤销后 future=1", futureLen() === 1);
  s().addNode("audio", { x: 800, y: 0 });
  expect("新操作后 future 清空", futureLen() === 0, `future=${futureLen()}`);

  /* ④ 删除可撤销，且删除节点时连带边一起恢复 */
  const ids = () => s().nodes.map((n) => n.id);
  s().clearCanvas();
  const a = s().addNode("text", { x: 0, y: 0 });
  const b = s().addNode("image", { x: 400, y: 0 });
  s().onConnect({
    source: a,
    target: b,
    sourceHandle: null,
    targetHandle: null,
  } as never);
  expect("连线成功", s().edges.length === 1);
  s().removeNode(b);
  expect("删除后 1 节点 0 边", nodeCount() === 1 && s().edges.length === 0);
  s().undo();
  expect(
    "撤销删除 → 节点与边都回来",
    nodeCount() === 2 && s().edges.length === 1,
    `nodes=${nodeCount()} edges=${s().edges.length}`,
  );
  expect("恢复的边端点有效", ids().includes(s().edges[0].source));
  expect("恢复后无残留选中", s().nodes.every((n) => !n.selected));

  /* ⑤ 拖动合并：连续 position 变更只记一条 */
  const nid = s().nodes[0].id;
  const before = pastLen();
  for (let i = 1; i <= 25; i++) {
    s().onNodesChange([
      { id: nid, type: "position", position: { x: i * 7, y: i * 3 }, dragging: true },
    ]);
  }
  expect(
    "25 次连续拖动只记 1 条历史",
    pastLen() === before + 1,
    `+${pastLen() - before}`,
  );
  const draggedTo = s().nodes.find((n) => n.id === nid)!.position.x;
  s().undo();
  expect(
    "撤销拖动 → 回到拖动前位置",
    s().nodes.find((n) => n.id === nid)!.position.x !== draggedTo,
    `was=${draggedTo} now=${s().nodes.find((n) => n.id === nid)!.position.x}`,
  );

  /* ⑥ 连续输入合并（800ms 窗口内） */
  const t = s().nodes.find((n) => n.data.kind === "text")!.id;
  const beforeEdit = pastLen();
  for (const v of ["a", "ab", "abc", "abcd"]) s().updateNodeData(t, { prompt: v });
  expect(
    "窗口内连续输入只记 1 条",
    pastLen() === beforeEdit + 1,
    `+${pastLen() - beforeEdit}`,
  );
  await sleep(850);
  s().updateNodeData(t, { prompt: "abcde" });
  expect(
    "超过合并窗口后另记 1 条",
    pastLen() === beforeEdit + 2,
    `+${pastLen() - beforeEdit}`,
  );

  /* ⑦ 选中变化不进历史 */
  const beforeSel = pastLen();
  s().onNodesChange([{ id: t, type: "select", selected: true }]);
  s().onNodesChange([{ id: t, type: "select", selected: false }]);
  expect("选中变化不记历史", pastLen() === beforeSel, `+${pastLen() - beforeSel}`);

  /* ⑧ 生成过程（运行态）不进历史 */
  const beforeRun = pastLen();
  const video = s().addNode("video", { x: 0, y: 900 });
  const afterAdd = pastLen();
  await s().runNode(video);
  // stub SSE 事件走 queueMicrotask，等两帧让 runStore→桥接同步完
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
  expect("运行结束后节点 succeeded", s().nodes.find((n) => n.id === video)!.data.status === "succeeded");
  expect(
    "生成过程的 progress/status 不进历史",
    pastLen() === afterAdd,
    `beforeRun=${beforeRun} afterAdd=${afterAdd} now=${pastLen()}`,
  );
  expect("运行未把 historyPause 泄漏（仍为 0）", s().historyPause === 0, `${s().historyPause}`);

  /* ⑨ 历史栈上限 */
  for (let i = 0; i < 90; i++) s().addNode("audio", { x: 0, y: i * 10 });
  expect("历史栈不超过上限 60", pastLen() <= 60, `past=${pastLen()}`);

  /* ⑩ clearCanvas 可撤销 */
  const beforeClear = nodeCount();
  s().clearCanvas();
  expect("清空后 0 节点", nodeCount() === 0);
  s().undo();
  expect("撤销清空 → 节点回来", nodeCount() === beforeClear, `${nodeCount()} vs ${beforeClear}`);
  s().clearCanvas();
  s().clearCanvas();
  expect("空画布重复清空不再记历史", nodeCount() === 0 && futureLen() === 0);

  /* ⑪ 连线被拒（自连）不进历史 */
  const x = s().addNode("video", { x: 0, y: 0 });
  const beforeReject = pastLen();
  s().onConnect({
    source: x,
    target: x,
    sourceHandle: null,
    targetHandle: null,
  } as never);
  expect("自连连线被拒", s().edges.length === 0 && !!s().connectionError);
  expect("被拒的连线不进历史", pastLen() === beforeReject, `+${pastLen() - beforeReject}`);

  /* ⑫ 一键整理可撤销（位置变化） */
  s().addNode("text", { x: 3000, y: 3000 });
  const posBefore = s().nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`).join("|");
  s().autoLayout();
  const posAfter = s().nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`).join("|");
  expect("一键整理改变了位置", posBefore !== posAfter);
  s().undo();
  const posUndone = s().nodes.map((n) => `${n.id}:${n.position.x},${n.position.y}`).join("|");
  expect("撤销整理 → 位置完全恢复", posUndone === posBefore);

  /* ⑬ 历史面板：jumpHistory 跳回某一步 */
  s().clearCanvas();
  // 前面的用例已经堆了 60 条历史，这里先清空栈，只留本用例的 3 步
  useCanvasStore.setState({ past: [], future: [], lastHistory: null });
  const h1 = s().addNode("text", { x: 0, y: 0 });
  const h2 = s().addNode("image", { x: 400, y: 0 });
  const h3 = s().addNode("video", { x: 800, y: 0 });
  expect("三个操作都在历史里", pastLen() === 3, `past=${pastLen()}`);
  expect("历史条目带 label", s().past.every((h) => typeof h.label === "string" && h.label.length > 0));
  expect("历史条目带时间戳", s().past.every((h) => typeof h.at === "number" && h.at > 0));
  expect(
    "历史条目 label 可转中文",
    s().past.every((h) => HISTORY_LABEL_TEXT[h.label] !== undefined),
    s().past.map((h) => h.label).join(","),
  );

  // 跳回第 0 条之前（即 addNode(a) 之前）→ 空
  s().jumpHistory(0);
  expect("jumpHistory(0) → 回到最早之前（空画布）", s().nodes.length === 0, `${s().nodes.length}`);
  expect("跳走后 past 清空", pastLen() === 0, `${pastLen()}`);
  expect("被跳过的部分进 future", s().future.length === 3, `${s().future.length}`);

  // redo 逐步回来
  s().redo();
  expect("redo 1 次 → 1 个节点（且是 a）", s().nodes.length === 1 && s().nodes[0].id === h1);
  s().redo();
  s().redo();
  expect(
    "redo 到底 → 三个节点都在且 id 一致",
    s().nodes.length === 3 &&
      s().nodes.map((n) => n.id).join(",") === [h1, h2, h3].join(","),
  );

  // 跳到中间某一层
  s().jumpHistory(1);
  expect("jumpHistory(1) → 只剩 1 个节点", s().nodes.length === 1, `${s().nodes.length}`);
  expect("jump 后 past=1 / future=2", pastLen() === 1 && s().future.length === 2, `${pastLen()}/${s().future.length}`);
  expect("jump 后选中/连线态被清空", s().selectedNodeId === null && s().connectingFrom === null);
  expect("jumpHistory 越界安全", (() => {
    const before = JSON.stringify(s().nodes);
    s().jumpHistory(-1);
    s().jumpHistory(99);
    return JSON.stringify(s().nodes) === before;
  })());

  console.log(failed === 0 ? "\n全部通过" : `\n${failed} 个失败`);
  process.exit(failed === 0 ? 0 : 1);
}

void main();
