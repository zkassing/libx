/**
 * 项目资产文件夹（画布内文件管理器）自测。
 * 直接用 Prisma 验证数据模型与归属约束：
 *  - 建文件夹（根/子）、组树；
 *  - 资产放入文件夹、按文件夹筛选；
 *  - 重命名/移动；
 *  - 删除文件夹后资产回到待分类（SetNull）、子文件夹级联删除。
 * 运行：pnpm tsx scripts/check-asset-folders.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

async function main() {
  const email = `folders_${Date.now()}@t.edu`;
  const user = await prisma.user.create({ data: { email, passwordHash: "x" } });
  const wf = await prisma.workflow.create({ data: { userId: user.id } });

  try {
    // 根文件夹 + 子文件夹
    const root = await prisma.assetFolder.create({
      data: { workflowId: wf.id, name: "素材" },
    });
    const sub = await prisma.assetFolder.create({
      data: { workflowId: wf.id, name: "分镜图", parentId: root.id },
    });
    check("根/子文件夹建立并组树", sub.parentId === root.id);

    // 待分类资产 + 放入子文件夹的资产
    const loose = await prisma.asset.create({
      data: { userId: user.id, source: "project", kind: "image", title: "loose", workflowId: wf.id },
    });
    const filed = await prisma.asset.create({
      data: { userId: user.id, source: "project", kind: "video", title: "clip", workflowId: wf.id, folderId: sub.id },
    });
    check("待分类资产 folderId=null", loose.folderId === null);
    check("资产可归入子文件夹", filed.folderId === sub.id);

    // 按文件夹筛选
    const inSub = await prisma.asset.count({ where: { source: "project", folderId: sub.id } });
    const inRoot = await prisma.asset.count({ where: { source: "project", folderId: root.id } });
    const unclassified = await prisma.asset.count({ where: { source: "project", workflowId: wf.id, folderId: null } });
    check("按子文件夹筛选=1", inSub === 1);
    check("根文件夹直接资产=0", inRoot === 0);
    check("待分类=1", unclassified === 1);

    // 重命名 + 移动（把 sub 移到根下同级；这里测改名）
    const renamed = await prisma.assetFolder.update({
      where: { id: root.id },
      data: { name: "项目素材" },
    });
    check("文件夹可重命名", renamed.name === "项目素材");
    // 把资产从 sub 移到待分类
    const moved = await prisma.asset.update({ where: { id: filed.id }, data: { folderId: null } });
    check("资产可移回待分类", moved.folderId === null);
    // 重新放回
    await prisma.asset.update({ where: { id: filed.id }, data: { folderId: sub.id } });

    // 删除根文件夹：子文件夹级联删除，资产 SetNull
    await prisma.assetFolder.delete({ where: { id: root.id } });
    const subGone = await prisma.assetFolder.findUnique({ where: { id: sub.id } });
    const assetAfter = await prisma.asset.findUnique({ where: { id: filed.id } });
    check("删除父文件夹 → 子文件夹级联删除", subGone === null);
    check("删除文件夹 → 内部资产回到待分类", assetAfter?.folderId === null);

    // 与全局生成历史严格隔离：生成历史 source=generated，不出现在项目文件统计
    await prisma.asset.create({
      data: { userId: user.id, source: "generated", kind: "image", title: "历史", workflowId: wf.id },
    });
    const projectFiles = await prisma.asset.count({ where: { source: "project", workflowId: wf.id } });
    check("生成历史不混入项目文件", projectFiles === 2);

  } finally {
    await prisma.assetFolder.deleteMany({ where: { workflowId: wf.id } });
    await prisma.asset.deleteMany({ where: { userId: user.id } });
    await prisma.workflow.delete({ where: { id: wf.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  console.log("临时数据已清理");
  console.log(`\n全部通过：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
