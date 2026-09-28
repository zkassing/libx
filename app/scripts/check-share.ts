/**
 * 分享链接 + 复制副本（T3.6）自测。
 * 重点验证 **id 重映射**：CanvasNode.id / CanvasEdge.id 是全局主键，
 * 复制时若不重映射会直接撞主键；parentId（分组）与边的 source/target 也必须跟着改。
 * 自建临时数据，跑完即清理。
 * 运行：pnpm tsx scripts/check-share.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { PrismaClient } from "../src/generated/prisma/client";
import { forkWorkflow } from "../src/server/workflow/fork";
import {
  buildSharePreview,
  findSharedWorkflow,
  uniqueShareToken,
} from "../src/server/workflow/share";

const prisma = new PrismaClient();

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

/** 带运行态的节点 data：复制后这些字段必须被清掉 */
const nodeData = (kind: string, runtime = false) =>
  JSON.stringify({
    kind,
    title: `${kind} 节点`,
    prompt: `画一个 ${kind}`,
    params: { aspectRatio: "16:9" },
    status: runtime ? "succeeded" : "idle",
    progress: runtime ? 100 : 0,
    ...(runtime ? { output: { kind, urls: ["/mock/a.png"] } } : {}),
  });

async function main() {
  const stamp = Date.now();
  const email = `share_test_${stamp}@t.edu`;
  const user = await prisma.user.create({
    data: { email, name: "分享测试", passwordHash: "x" },
  });
  const src = await prisma.workflow.create({
    data: {
      title: "源工作流",
      description: "一份用来测试复制的工作流",
      userId: user.id,
      coverUrl: "/mock/cover.png",
      nodes: {
        create: [
          { id: `g_${stamp}`, type: "group", x: 0, y: 0, data: nodeData("group"), index: 0 },
          {
            id: `t_${stamp}`,
            type: "text",
            x: 10,
            y: 20,
            parentId: `g_${stamp}`,
            data: nodeData("text", true),
            index: 1,
          },
          { id: `i_${stamp}`, type: "image", x: 300, y: 20, data: nodeData("image", true), index: 2 },
        ],
      },
      edges: {
        create: [
          {
            id: `e_${stamp}`,
            source: `t_${stamp}`,
            target: `i_${stamp}`,
            sourceHandle: "out",
            targetHandle: "in",
            index: 0,
          },
        ],
      },
      variables: {
        create: [
          { key: "subject", label: "主题", type: "text", required: true, source: "student" },
          {
            key: "style",
            label: "风格",
            type: "select",
            options: JSON.stringify(["写实", "动漫"]),
            default: "写实",
            source: "teacher",
          },
        ],
      },
    },
  });

  /* ---------------- 1. 复制副本 ---------------- */
  const newId = await forkWorkflow({ sourceId: src.id, targetUserId: user.id });
  check("forkWorkflow 返回新 workflow id", !!newId && newId !== src.id, String(newId));

  const copy = await prisma.workflow.findUnique({
    where: { id: newId! },
    include: { nodes: { orderBy: { index: "asc" } }, edges: true, variables: true },
  });
  check("副本存在且属于同一用户", copy?.userId === user.id);
  check("副本标题为「源工作流 的副本」", copy?.title === "源工作流 的副本", String(copy?.title));
  check("副本记录来源 forkedFrom", copy?.forkedFrom === src.id);
  check("副本继承 description", copy?.description === src.description);
  check("副本不继承封面（没有产物）", copy?.coverUrl === null, String(copy?.coverUrl));

  /* ---------------- 2. id 重映射（核心） ---------------- */
  const srcIds = new Set([`g_${stamp}`, `t_${stamp}`, `i_${stamp}`]);
  const copyIds = copy!.nodes.map((n) => n.id);
  check("节点数一致（3）", copy!.nodes.length === 3, String(copy!.nodes.length));
  check(
    "节点 id 全部换了新值（不撞全局主键）",
    copyIds.every((id) => !srcIds.has(id)) && new Set(copyIds).size === copyIds.length,
    copyIds.join(","),
  );

  const group = copy!.nodes.find((n) => n.type === "group")!;
  const textNode = copy!.nodes.find((n) => n.type === "text")!;
  const imageNode = copy!.nodes.find((n) => n.type === "image")!;
  check("分组节点的 parentId 已重映射到新分组 id", textNode.parentId === group.id, String(textNode.parentId));
  check("未分组节点 parentId 仍为空", imageNode.parentId === null);

  const edge = copy!.edges[0];
  check("边数一致（1）", copy!.edges.length === 1, String(copy!.edges.length));
  check(
    "边的 source/target 指向副本节点",
    edge.source === textNode.id && edge.target === imageNode.id,
    `${edge.source}→${edge.target}`,
  );
  check("边 id 已重映射", edge.id !== `e_${stamp}`, edge.id);
  check("边的 handle 原样保留", edge.sourceHandle === "out" && edge.targetHandle === "in");

  /* ---------------- 3. 运行态清空 ---------------- */
  const textData = JSON.parse(textNode.data) as Record<string, unknown>;
  check("副本节点 status 归零", textData.status === "idle", String(textData.status));
  check("副本节点 progress 归零", textData.progress === 0, String(textData.progress));
  check("副本节点 output 被清掉", !("output" in textData));
  check("副本节点保留提示词", textData.prompt === "画一个 text", String(textData.prompt));

  /* ---------------- 4. 变量复制 ---------------- */
  check("变量全部复制（2）", copy!.variables.length === 2, String(copy!.variables.length));
  const styleVar = copy!.variables.find((v) => v.key === "style");
  check("变量 options/default/source 保留", styleVar?.default === "写实" && styleVar?.source === "teacher");
  check("(workflowId,key) 唯一约束未冲突", new Set(copy!.variables.map((v) => v.key)).size === 2);

  /* ---------------- 5. 源工作流不受影响 ---------------- */
  const srcAfter = await prisma.workflow.findUnique({
    where: { id: src.id },
    include: { nodes: true, edges: true },
  });
  check("源工作流节点数不变（3）", srcAfter!.nodes.length === 3);
  check("源工作流内容未被改动", srcAfter!.nodes.some((n) => n.id === `t_${stamp}` && n.workflowId === src.id));
  check("源工作流仍保留自己的封面", srcAfter!.coverUrl === "/mock/cover.png");
  check(
    "源节点的运行态没被误清",
    (JSON.parse(srcAfter!.nodes.find((n) => n.id === `t_${stamp}`)!.data) as { status: string }).status === "succeeded",
  );

  /* 默认标题 */
  const plainId = await forkWorkflow({ sourceId: src.id, targetUserId: user.id });
  const plain = await prisma.workflow.findUnique({ where: { id: plainId! } });
  check("不传 title 时自动叫「… 的副本」", plain?.title === "源工作流 的副本", String(plain?.title));

  /* 自定义标题 */
  const namedId = await forkWorkflow({ sourceId: src.id, targetUserId: user.id, title: "我的改编" });
  const named = await prisma.workflow.findUnique({ where: { id: namedId! } });
  check("传 title 时用自定义标题", named?.title === "我的改编", String(named?.title));

  /* 源不存在 */
  check("源工作流不存在时返回 null", (await forkWorkflow({ sourceId: "not_exist", targetUserId: user.id })) === null);

  /* ---------------- 6. shareToken ---------------- */
  const t1 = await uniqueShareToken();
  const t2 = await uniqueShareToken();
  check("shareToken 长度 16（hex）", t1.length === 16, t1);
  check("两次生成不重复", t1 !== t2);

  await prisma.workflow.update({
    where: { id: src.id },
    data: { shareToken: t1, visibility: "private" },
  });
  check("visibility=private 时 findSharedWorkflow 返回 null", (await findSharedWorkflow(t1)) === null);

  await prisma.workflow.update({ where: { id: src.id }, data: { visibility: "link" } });
  const found = await findSharedWorkflow(t1);
  check("visibility=link 时能找到", found?.id === src.id);
  check("token 不存在时返回 null", (await findSharedWorkflow("deadbeefdeadbeef")) === null);
  check("空 token 返回 null", (await findSharedWorkflow("")) === null);

  /* ---------------- 7. 公开预览结构 ---------------- */
  const preview = buildSharePreview(found!);
  check("预览标题正确", preview.title === "源工作流", preview.title);
  check("预览作者名取自 name", preview.authorName === "分享测试", preview.authorName);
  check("nodeKinds 排除分组框", !("group" in preview.nodeKinds), JSON.stringify(preview.nodeKinds));
  check("nodeKinds 统计正确", preview.nodeKinds.text === 1 && preview.nodeKinds.image === 1);
  check("nodeCount 为 2（不含分组）", preview.nodeCount === 2, String(preview.nodeCount));
  check("edgeCount 为 1", preview.edgeCount === 1);
  check("变量 options 被解析成数组", Array.isArray(preview.variables.find((v) => v.key === "style")?.options));
  check(
    "预览不泄漏邮箱",
    !JSON.stringify(preview).includes(email),
  );
  check("预览不泄漏提示词正文", !JSON.stringify(preview).includes("画一个 text"));

  /* ---------------- 清理 ---------------- */
  await prisma.workflow.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("临时数据已清理");

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main();
