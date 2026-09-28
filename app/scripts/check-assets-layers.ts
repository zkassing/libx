/**
 * 三层资产 + 自动生成历史 自测。
 * 验证：
 *  - 节点真实生成图片后，自动产生 source=generated 资产，带 workflowId/nodeId/runId；
 *  - 项目封面自动补上；
 *  - 命中缓存时不重复产生生成历史；
 *  - source=project / library 的资产按层隔离查询；
 *  - 纯函数 assetKindOf / firstMediaUrl。
 * 运行：pnpm tsx scripts/check-assets-layers.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { PrismaClient } from "../src/generated/prisma/client";
import { runQueue } from "../src/server/queue/runQueue";
import { assetKindOf, firstMediaUrl } from "../src/server/queue/recordAsset";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const TERMINAL = new Set(["succeeded", "failed"]);
async function waitNode(nodeId: string, since: number) {
  while (Date.now() - since < 15000) {
    const runs = await prisma.nodeRun.findMany({ where: { nodeId }, orderBy: { createdAt: "desc" } });
    const r = runs.find((x) => x.createdAt.getTime() >= since - 5);
    if (r && TERMINAL.has(r.status)) return r;
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error("等待节点终态超时");
}

async function main() {
  // 纯函数
  check("image → image 层", assetKindOf("image") === "image");
  check("video → video 层", assetKindOf("video") === "video");
  check("audio → audio 层", assetKindOf("audio") === "audio");
  check("text 不进媒体网格", assetKindOf("text") === null);
  check("script 不进媒体网格", assetKindOf("script") === null);
  check(
    "firstMediaUrl 取第一个",
    firstMediaUrl({ kind: "image", urls: ["a", "b"] }) === "a",
  );
  check("firstMediaUrl 空数组安全", firstMediaUrl({ kind: "image", urls: [] }) === undefined);

  // 临时用户 / 工作流 / 图片节点
  const email = `assetlayer_${Date.now()}@t.edu`;
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } });
  const wf = await prisma.workflow.create({ data: { userId: user.id } });
  const NID = `al_node_${Date.now().toString(36)}`;
  await prisma.canvasNode.create({
    data: {
      id: NID, workflowId: wf.id, type: "image", x: 0, y: 0,
      data: JSON.stringify({
        kind: "image", title: "图片节点", prompt: "一只猫",
        params: { ratio: "1:1" }, status: "idle", progress: 0,
      }),
    },
  });

  // 第一次真实生成（图片 ~3s）
  const t1 = Date.now();
  const r1id = (await prisma.nodeRun.create({
    data: { nodeId: NID, workflowId: wf.id, userId: user.id, status: "queued", cost: 0 },
  })).id;
  runQueue.enqueue(r1id);
  const r1 = await waitNode(NID, t1);
  check("图片真实生成成功", r1.status === "succeeded" && r1.cost === 12, `实际 ${r1.cost}`);

  // 自动生成历史资产
  const genAfter1 = await prisma.asset.findMany({
    where: { source: "generated", nodeId: NID },
  });
  check("自动产生 1 条生成历史", genAfter1.length === 1, `实际 ${genAfter1.length}`);
  check("生成历史带 workflowId", genAfter1[0]?.workflowId === wf.id);
  check("生成历史带 runId", genAfter1[0]?.runId === r1id);
  check("生成历史 kind=image", genAfter1[0]?.kind === "image");
  check("生成历史有 url", typeof genAfter1[0]?.url === "string");

  // 项目封面
  const wfAfter = await prisma.workflow.findUnique({ where: { id: wf.id } });
  check("项目封面自动补上", !!wfAfter?.coverUrl && wfAfter.coverUrl === genAfter1[0]?.url);

  // 第二次同样输入 → 命中缓存
  const t2 = Date.now();
  const r2id = (await prisma.nodeRun.create({
    data: { nodeId: NID, workflowId: wf.id, userId: user.id, status: "queued", cost: 3 },
  })).id;
  runQueue.enqueue(r2id);
  const r2 = await waitNode(NID, t2);
  check("二次命中缓存 cost=0", r2.status === "succeeded" && r2.cost === 0);
  const genAfter2 = await prisma.asset.count({
    where: { source: "generated", nodeId: NID },
  });
  check("缓存不重复产生生成历史", genAfter2 === 1);

  // 项目资产 / 个人库：手动建，按层隔离
  await prisma.asset.create({
    data: { userId: user.id, source: "project", kind: "image", title: "项目素材", url: "p1", workflowId: wf.id },
  });
  await prisma.asset.create({
    data: { userId: user.id, source: "library", kind: "video", title: "我的收藏", url: "l1" },
  });

  const projCount = await prisma.asset.count({ where: { source: "project", workflowId: wf.id } });
  const libCount = await prisma.asset.count({ where: { source: "library", userId: user.id } });
  const generatedCount = await prisma.asset.count({ where: { source: "generated", nodeId: NID } });
  check("项目资产独立计数=1", projCount === 1);
  check("个人库不含项目资产", libCount === 1);
  check("本节点生成历史仍=1", generatedCount === 1);

  // 清理
  await prisma.asset.deleteMany({ where: { userId: user.id } });
  await prisma.nodeRun.deleteMany({ where: { workflowId: wf.id } });
  await prisma.canvasNode.deleteMany({ where: { workflowId: wf.id } });
  await prisma.workflow.delete({ where: { id: wf.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("临时数据已清理");

  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
