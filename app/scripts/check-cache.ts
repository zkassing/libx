/**
 * 输入哈希缓存（T2.9）自测。
 * 自建临时数据，验证：
 *  - 同节点同样输入二次运行命中缓存（cost=0、状态 succeeded、cached 标记）；
 *  - 改提示词 / 参数 → 哈希不同，不命中；
 *  - 哈希对字段顺序不敏感（稳定序列化）。
 * 运行：pnpm tsx scripts/check-cache.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { PrismaClient } from "../src/generated/prisma/client";
import { runQueue } from "../src/server/queue/runQueue";
import { hashInput } from "../src/server/queue/inputHash";
import { runEventBus } from "../src/server/queue/eventBus";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const TERMINAL = new Set(["succeeded", "failed"]);
async function waitNodeTerminal(nodeId: string, since: number) {
  while (Date.now() - since < 15000) {
    const runs = await prisma.nodeRun.findMany({ where: { nodeId }, orderBy: { createdAt: "desc" } });
    const r = runs.find((x) => x.createdAt.getTime() >= since - 5);
    if (r && TERMINAL.has(r.status)) return r;
    await new Promise((r) => setTimeout(r, 120));
  }
  const all = await prisma.nodeRun.findMany({ where: { nodeId } });
  console.log("超时相关 runs:", all.map((x) => ({ s: x.status, c: x.createdAt.toISOString(), p: x.progress })));
  throw new Error("超时");
}

async function main() {
  // 清掉之前失败运行可能留下的临时节点（及其关联）
  const leftovers = await prisma.canvasNode.findMany({
    where: { id: { startsWith: "c_node_" } },
    select: { id: true, workflowId: true },
  });
  for (const l of leftovers) {
    await prisma.nodeRun.deleteMany({ where: { nodeId: l.id } });
    const wfId = l.workflowId;
    await prisma.canvasNode.delete({ where: { id: l.id } });
    await prisma.workflow.deleteMany({ where: { id: wfId } }).catch(() => {});
  }

  // 最早版本留下的固定 id 残留
  const old = await prisma.canvasNode.findUnique({ where: { id: "c_node" } });
  if (old) {
    await prisma.nodeRun.deleteMany({ where: { nodeId: "c_node" } });
    await prisma.canvasNode.delete({ where: { id: "c_node" } });
    await prisma.workflow.deleteMany({ where: { id: old.workflowId } }).catch(() => {});
  }

  // 纯函数：哈希稳定性
  const h1 = hashInput({ nodeKind: "text", prompt: "你好", params: { a: 1, b: 2 } });
  const h2 = hashInput({ nodeKind: "text", prompt: "你好", params: { b: 2, a: 1 } });
  check("参数字段顺序不影响哈希", h1 === h2);
  const h3 = hashInput({ nodeKind: "text", prompt: "你好吗" });
  check("提示词不同 → 哈希不同", h1 !== h3);
  const h4 = hashInput({ nodeKind: "text", prompt: "你好",
    upstreams: [{ kind: "image", summary: "图A" }] });
  const h5 = hashInput({ nodeKind: "text", prompt: "你好",
    upstreams: [{ kind: "image", summary: "图B" }] });
  check("上游摘要不同 → 哈希不同", h4 !== h5);

  // 端到端缓存
  const email = `cache_${Date.now()}@t.edu`;
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } });
  const wf = await prisma.workflow.create({ data: { userId: user.id } });
  const NID = `c_node_${Date.now().toString(36)}`;
  await prisma.canvasNode.create({
    data: {
      id: NID, workflowId: wf.id, type: "text", x: 0, y: 0,
      data: JSON.stringify({
        kind: "text", title: "文本节点", prompt: "讲解光合作用",
        params: { model: "GVLM 3.1" }, status: "idle", progress: 0,
      }),
    },
  });

  // 第一次运行（真实生成）
  let cachedEvent: boolean = false;
  const unsub = runEventBus.subscribe((e) => {
    if (e.nodeId === NID && e.type === "cached") cachedEvent = true;
  });

  const t1Start = Date.now();
  const r1id = await prisma.nodeRun.create({
    data: { nodeId: NID, workflowId: wf.id, userId: user.id, status: "queued", cost: 2 },
  }).then((r) => r.id);
  console.log("首次入队前 queue size:", JSON.stringify(runQueue.size()));
  runQueue.enqueue(r1id);
  const r1 = await waitNodeTerminal(NID, t1Start);
  check("首次真实生成", r1.status === "succeeded" && r1.cost === 2 && !!r1.inputHash);
  check("首次不是缓存事件", cachedEvent === false);

  // 第二次同样输入
  const t2 = Date.now();
  const r2id = await prisma.nodeRun.create({
    data: { nodeId: NID, workflowId: wf.id, userId: user.id, status: "queued", cost: 2 },
  }).then((r) => r.id);
  runQueue.enqueue(r2id);
  const r2 = await waitNodeTerminal(NID, t2);
  check("二次命中缓存 succeeded", r2.status === "succeeded");
  check("命中缓存 cost=0", r2.cost === 0);
  check("命中缓存复用产物", r2.output === r1.output);
  check("发布 cached 事件", Boolean(cachedEvent));

  // 改提示词 → 不命中（真实生成）
  await prisma.canvasNode.update({
    where: { id: NID },
    data: {
      data: JSON.stringify({
        kind: "text", title: "文本节点", prompt: "讲解细胞呼吸",
        params: { model: "GVLM 3.1" }, status: "idle", progress: 0,
      }),
    },
  });
  const t3 = Date.now();
  const r3id = await prisma.nodeRun.create({
    data: { nodeId: NID, workflowId: wf.id, userId: user.id, status: "queued", cost: 2 },
  }).then((r) => r.id);
  runQueue.enqueue(r3id);
  const r3 = await waitNodeTerminal(NID, t3);
  check("改提示词不命中、真实生成", r3.cost === 2);

  unsub();

  // 清理
  await prisma.nodeRun.deleteMany({ where: { workflowId: wf.id } });
  await prisma.canvasNode.deleteMany({ where: { workflowId: wf.id } });
  await prisma.workflow.delete({ where: { id: wf.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("临时数据已清理");

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
