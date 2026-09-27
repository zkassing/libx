/**
 * 一键整理（autoLayout）的自测
 * 运行：pnpm tsx scripts/check-layout.ts
 */
import type { Edge, Node } from "@xyflow/react";
import { autoLayoutNodes } from "../src/lib/layout";
import { NODE_SIZE, type FlowNodeData, type NodeKind } from "../src/types";

let failed = 0;
function expect(name: string, pass: boolean, detail = "") {
  if (!pass) failed += 1;
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
}

function node(
  id: string,
  kind: NodeKind,
  x: number,
  y: number,
  extra: Partial<Node<FlowNodeData>> = {},
): Node<FlowNodeData> {
  return {
    id,
    type: kind,
    position: { x, y },
    style: { width: NODE_SIZE[kind].w, height: NODE_SIZE[kind].h },
    data: {
      kind,
      title: id,
      prompt: "",
      params: {},
      status: "idle",
      progress: 0,
    },
    ...extra,
  };
}

const edge = (source: string, target: string) => ({ source, target }) as Edge;

/* ① 链式 A→B→C 应排成三列，x 严格递增，y 都对齐 */
{
  const nodes = [
    node("a", "text", 500, 900),
    node("b", "image", 100, 300),
    node("c", "video", 800, 50),
  ];
  const out = autoLayoutNodes(nodes, [edge("a", "b"), edge("b", "c")]);
  const pos = (id: string) => out.find((n) => n.id === id)!.position;
  const [a, b, c] = [pos("a"), pos("b"), pos("c")];
  expect("链式：x 递增 a<b<c", a.x < b.x && b.x < c.x, `${a.x},${b.x},${c.x}`);
  // 单节点列是「整列垂直居中」，高度不同的列顶边本来就不同 → 比中心线
  const centerY = (id: string, kind: NodeKind) =>
    pos(id).y + NODE_SIZE[kind].h / 2;
  expect(
    "链式：三列中心线对齐（垂直居中）",
    centerY("a", "text") === centerY("b", "image") &&
      centerY("b", "image") === centerY("c", "video"),
    `${centerY("a", "text")},${centerY("b", "image")},${centerY("c", "video")}`,
  );
  expect(
    "链式：列间距 = 列宽 + gapX",
    b.x - a.x === NODE_SIZE.text.w + 140,
    `${b.x - a.x}`,
  );
  const minX = Math.min(...out.map((n) => n.position.x));
  const minY = Math.min(...out.map((n) => n.position.y));
  expect(
    "链式：包围盒左上角保持原位 (100,50)",
    minX === 100 && minY === 50,
    `${minX},${minY}`,
  );
}

/* ② 分叉 a→b, a→c：b、c 同层，纵向不重叠 */
{
  const nodes = [
    node("a", "text", 0, 0),
    node("b", "image", 0, 500),
    node("c", "video", 0, 900),
  ];
  const out = autoLayoutNodes(nodes, [edge("a", "b"), edge("a", "c")]);
  const pos = (id: string) => out.find((n) => n.id === id)!.position;
  const a = pos("a");
  const b = pos("b");
  const c = pos("c");
  expect("分叉：b 与 c 同列", b.x === c.x, `${b.x},${c.x}`);
  expect("分叉：b 在 c 上方", b.y < c.y, `${b.y},${c.y}`);
  expect(
    "分叉：同层垂直间距 = gapY",
    c.y - b.y === NODE_SIZE.image.h + 56,
    `${c.y - b.y}`,
  );
  expect("分叉：a 在 b/c 左侧", a.x < b.x, `${a.x},${b.x}`);
}

/* ③ 菱形 a→b→d, a→c→d：d 必须在 b、c 右边（最长路径 2） */
{
  const nodes = [
    node("a", "text", 0, 0),
    node("b", "image", 0, 0),
    node("c", "image", 0, 0),
    node("d", "video", 0, 0),
  ];
  const out = autoLayoutNodes(nodes, [
    edge("a", "b"),
    edge("a", "c"),
    edge("b", "d"),
    edge("c", "d"),
  ]);
  const pos = (id: string) => out.find((n) => n.id === id)!.position;
  expect(
    "菱形：d 在第 3 层（最长路径）",
    pos("d").x > pos("b").x && pos("d").x > pos("c").x,
    `${pos("d").x} > ${pos("b").x}`,
  );
  expect("菱形：a 在第 1 层", pos("a").x < pos("b").x);
}

/* ④ 打组整体搬运：组内子节点相对坐标不变，组外上游仍在左边 */
{
  const group: Node<FlowNodeData> = {
    ...node("g", "text", 1000, 1000),
    type: "group",
    style: { width: 800, height: 400 },
  };
  const nodes = [
    node("src", "text", 0, 0),
    group,
    node("in1", "image", 40, 60, { parentId: "g", extent: "parent" }),
    node("in2", "video", 40, 220, { parentId: "g", extent: "parent" }),
    node("out", "audio", 2000, 0),
  ];
  const edges = [edge("src", "in1"), edge("in2", "out")];
  const out = autoLayoutNodes(nodes, edges);
  const get = (id: string) => out.find((n) => n.id === id)!;

  expect(
    "打组：子节点相对坐标未变",
    get("in1").position.x === 40 && get("in2").position.y === 220,
    `${get("in1").position.x},${get("in2").position.y}`,
  );
  expect(
    "打组：组在 src 右边（因为子节点吃 src）",
    get("g").position.x > get("src").position.x,
    `${get("g").position.x} > ${get("src").position.x}`,
  );
  expect(
    "打组：out 在组右边",
    get("out").position.x > get("g").position.x,
    `${get("out").position.x} > ${get("g").position.x}`,
  );
}

/* ⑤ 空画布 / 无连线不崩 */
{
  expect("空画布返回空", autoLayoutNodes([], []).length === 0);
  const nodes = [node("a", "text", 5, 7), node("b", "audio", 90, 7)];
  const out = autoLayoutNodes(nodes, []);
  const xs = new Set(out.map((n) => n.position.x));
  expect("无连线：全孤立时同列不重叠", xs.size === 1, `x 集合 ${[...xs].join(",")}`);
  const ys = out.map((n) => n.position.y).sort((a, b) => a - b);
  expect("无连线：纵向堆叠无重叠", ys[1] - ys[0] === NODE_SIZE.text.h + 56, `${ys.join(",")}`);
}

/* ⑥ 孤立节点单独排到最后一列（不混进首列） */
{
  const nodes = [
    node("a", "text", 0, 0),
    node("b", "image", 400, 0),
    node("orphan", "audio", 900, 0),
  ];
  const out = autoLayoutNodes(nodes, [edge("a", "b")]);
  const pos = (id: string) => out.find((n) => n.id === id)!.position;
  expect(
    "孤立节点排到最后一列（在 b 右边）",
    pos("orphan").x > pos("b").x,
    `orphan=${pos("orphan").x} > b=${pos("b").x}`,
  );
  expect(
    "孤立节点不占首列",
    pos("a").x !== pos("orphan").x,
    `a=${pos("a").x} orphan=${pos("orphan").x}`,
  );
}

/* ⑦ 有环也不卡死（防御性） */
{
  const nodes = [node("a", "text", 0, 0), node("b", "image", 0, 0)];
  const out = autoLayoutNodes(nodes, [edge("a", "b"), edge("b", "a")]);
  expect("有环：不抛错且位置有效", out.every((n) => Number.isFinite(n.position.x)));
}

console.log(failed === 0 ? "\n全部通过" : `\n${failed} 个失败`);
process.exit(failed === 0 ? 0 : 1);
