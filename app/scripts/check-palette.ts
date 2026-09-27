/**
 * 侧栏 / 拖拽放置相关纯逻辑自测：
 *   - `centerAt`：以落点为中心
 *   - `collectAssets`：资产汇总与筛选
 *   - `reuseAsset`：复用产物 = 一步可撤销，且不会落到视野外
 *   - `instantiateToolbox`：模板实例化（id 重映射 / 落点居中 / 运行态清空 / 边界过滤）
 *   - `dragPayload`：拖拽协议编解码
 * 运行：npx tsx scripts/check-palette.ts
 */
import type { Edge, Node } from "@xyflow/react";
import { NODE_SIZE, type FlowNodeData } from "../src/types";
import { useCanvasStore } from "../src/stores/canvasStore";
import type { ToolboxItem } from "../src/stores/toolboxStore";
import { centerAt, collectAssets, reuseAsset } from "../src/lib/assets";
import { instantiateToolbox } from "../src/lib/toolboxGraph";
import * as dragPayload from "../src/lib/dragPayload";

let failed = 0;
let total = 0;
void total;
function expect(name: string, ok: boolean, extra = "") {
  total++;
  if (ok) console.log(`PASS  ${name}${extra ? `  (${extra})` : ""}`);
  else {
    failed++;
    console.log(`FAIL  ${name}${extra ? `  (${extra})` : ""}`);
  }
}

const s = () => useCanvasStore.getState();

function makeNode(
  id: string,
  kind: FlowNodeData["kind"],
  x: number,
  y: number,
  patch: Partial<FlowNodeData> = {},
): Node<FlowNodeData> {
  return {
    id,
    type: kind,
    position: { x, y },
    measured: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    style: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    data: {
      kind,
      title: `${kind}-${id}`,
      index: 1,
      prompt: "",
      params: {},
      status: "idle",
      progress: 0,
      ...patch,
    },
  };
}

/* ① centerAt：以落点为中心 */
{
  const at = { x: 1000, y: 600 };
  const p = centerAt("image", at);
  expect(
    "centerAt 让节点中心落在鼠标点",
    p.x + NODE_SIZE.image.w / 2 === at.x && p.y + NODE_SIZE.image.h / 2 === at.y,
    `${p.x},${p.y}`,
  );
  expect("centerAt 取整", Number.isInteger(p.x) && Number.isInteger(p.y));
}

/* ② collectAssets：只收有产物的节点 */
{
  const nodes = [
    makeNode("a", "text", 0, 0, { output: { kind: "text", urls: [], text: "文案" } }),
    makeNode("b", "image", 0, 0), // 无产物
    makeNode("c", "video", 0, 0, { output: { kind: "video", urls: ["v.mp4"], text: "" } }),
  ];
  const assets = collectAssets(nodes);
  expect("collectAssets 过滤掉无产物节点", assets.length === 2, `${assets.length}`);
  expect(
    "collectAssets 保留 nodeId/kind/urls/text",
    assets[0].nodeId === "a" &&
      assets[0].text === "文案" &&
      assets[1].urls[0] === "v.mp4",
  );
}

/* ③ reuseAsset：一步可撤销 + 落在源节点附近（不会跑到负坐标外） */
{
  s().clearCanvas();
  useCanvasStore.setState({ past: [], future: [], lastHistory: null });
  const src = s().addNode("image", { x: 400, y: 300 });
  s().updateNodeData(src, {
    prompt: "一只猫",
    params: { resolution: "2K" },
    output: { kind: "image", urls: ["data:image/svg+xml,..."], text: "" },
    status: "succeeded",
    progress: 100,
  });
  useCanvasStore.setState({ past: [], future: [], lastHistory: null });

  const id = reuseAsset(src);
  expect("复用返回新节点 id", !!id && id !== src, `${id}`);
  expect("画布上多了 1 个节点", s().nodes.length === 2);
  expect("历史只有 1 条（合成一步）", s().past.length === 1, JSON.stringify(s().past.map((h) => h.label)));
  expect("历史 label = reuse", s().past[0]?.label === "reuse");

  const copy = s().nodes.find((n) => n.id === id)!;
  expect("复制了提示词", copy.data.prompt === "一只猫");
  expect("复制了参数", copy.data.params.resolution === "2K");
  expect("复制了产物并置为成功", !!copy.data.output && copy.data.status === "succeeded");
  expect(
    "未指定落点时落在源节点右下（不会是负坐标）",
    copy.position.x > 0 && copy.position.y > 0,
    `${copy.position.x},${copy.position.y}`,
  );

  s().undo();
  expect("撤销 1 次即回退整个复用", s().nodes.length === 1);
  s().redo();
  expect("可重做", s().nodes.length === 2);

  /* 拖拽落点复用 */
  const id2 = reuseAsset(src, { x: 2000, y: 1500 });
  const copy2 = s().nodes.find((n) => n.id === id2)!;
  expect(
    "指定落点时以落点为中心",
    copy2.position.x + NODE_SIZE.image.w / 2 === 2000 &&
      copy2.position.y + NODE_SIZE.image.h / 2 === 1500,
    `${copy2.position.x},${copy2.position.y}`,
  );
}

/* ④ instantiateToolbox */
{
  const item: ToolboxItem = {
    id: "tpl_1",
    name: "分镜模板",
    tags: [],
    nodes: [
      makeNode("n1", "text", 0, 0, { status: "succeeded", output: { kind: "text", urls: [], text: "旧产物" } }),
      makeNode("n2", "image", 500, 0, { status: "running", progress: 60 }),
    ],
    edges: [
      {
        id: "e1",
        source: "n1",
        target: "n2",
        type: "flow",
      } as Edge,
      // 指向模板外节点的边，应被丢弃
      { id: "e2", source: "n1", target: "ghost", type: "flow" } as Edge,
    ],
    createdAt: 0,
    updatedAt: 0,
  };

  const { nodes, edges } = instantiateToolbox(item, { x: 3000, y: 2000 });
  expect("实例化出 2 个节点", nodes.length === 2);
  expect("实例化出 1 条有效边", edges.length === 1, `${edges.length}`);
  expect(
    "id 全部重映射（不复用模板 id）",
    nodes.every((n) => n.id !== "n1" && n.id !== "n2") &&
      edges[0].source === nodes[0].id &&
      edges[0].target === nodes[1].id,
  );
  expect("边 id 指向新节点", edges[0].id.includes(nodes[0].id) && edges[0].id.includes(nodes[1].id));
  expect("运行态被清空", nodes.every((n) => n.data.status === "idle" && n.data.progress === 0 && !n.data.output));

  // 落点居中：模板 bbox 中心应落在落点上
  const minX = Math.min(...nodes.map((n) => n.position.x));
  const minY = Math.min(...nodes.map((n) => n.position.y));
  const maxX = Math.max(...nodes.map((n, i) => n.position.x + NODE_SIZE[nodes[i].data.kind].w));
  const maxY = Math.max(...nodes.map((n, i) => n.position.y + NODE_SIZE[nodes[i].data.kind].h));
  expect(
    "模板包围盒中心落在落点",
    Math.round((minX + maxX) / 2) === 3000 && Math.round((minY + maxY) / 2) === 2000,
    `${(minX + maxX) / 2},${(minY + maxY) / 2}`,
  );
  expect("节点保持相对位置", nodes[1].position.x - nodes[0].position.x === 500);

  // 不传落点：放到现有画布右侧
  s().clearCanvas();
  s().addNode("text", { x: 0, y: 0 });
  const right = instantiateToolbox(item);
  expect(
    "不传落点时落在现有内容右侧",
    Math.min(...right.nodes.map((n) => n.position.x)) > NODE_SIZE.text.w,
    `${Math.min(...right.nodes.map((n) => n.position.x))}`,
  );
}

/* ⑤ 拖拽协议 */
{
  const MIME = {
    node: "application/x-aiteach-node",
    toolbox: "application/x-aiteach-toolbox",
    asset: "application/x-aiteach-asset",
  };
  const mk = (payload: Record<string, unknown>) => {
    const store: Record<string, string> = {};
    const dt = {
      effectAllowed: "",
      types: Object.keys(MIME).map((k) => MIME[k as keyof typeof MIME]),
      setData: (m: string, v: string) => {
        store[m] = v;
      },
      getData: (m: string) => store[m] ?? "",
    };
    // 模拟 lib/dragPayload 的写入
    for (const [type, mime] of Object.entries(MIME)) {
      if (payload.type === type) dt.setData(mime, JSON.stringify(payload));
    }
    dt.setData("text/plain", "预览");
    return dt;
  };

  const { readDragPayload, hasDragPayload } = dragPayload;
  const dtNode = mk({ type: "node", kind: "text" });
  expect("hasDragPayload 识别自定义 MIME", hasDragPayload(dtNode as unknown as DataTransfer));
  const p = readDragPayload(dtNode as unknown as DataTransfer);
  expect("解析出节点载荷", p?.type === "node" && p.kind === "text", JSON.stringify(p));
  const dtTpl = mk({ type: "toolbox", id: "tpl_1" });
  const p2 = readDragPayload(dtTpl as unknown as DataTransfer);
  expect("解析出模板载荷", p2?.type === "toolbox" && p2.id === "tpl_1");
  const dtAsset = mk({ type: "asset", nodeId: "n9" });
  const p3 = readDragPayload(dtAsset as unknown as DataTransfer);
  expect("解析出资产载荷", p3?.type === "asset" && p3.nodeId === "n9");
  expect(
    "空 DataTransfer 不误判",
    !hasDragPayload(null) && readDragPayload(null) === null,
  );
  const dtPlain = {
    types: ["text/plain"],
    getData: () => "hello",
  };
  expect(
    "普通文本拖拽不会被当成放置",
    !hasDragPayload(dtPlain as unknown as DataTransfer) &&
      readDragPayload(dtPlain as unknown as DataTransfer) === null,
  );
}

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
