/**
 * Skill 驱动画布自测（Skill 第四步）。
 * 覆盖：
 *   instantiateSkillTemplate 纯函数（id 重映射/边/灵感注入/运行态）
 *   POST /api/skills/:slug/start 真实登录会话（建项目+节点边、usageCount、401/404）
 * 运行：pnpm tsx scripts/check-skill-start.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { instantiateSkillTemplate } from "../src/server/skills/instantiateSkill";
import type { SkillTemplate } from "../src/lib/skillTypes";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

/* ---------- 纯函数 ---------- */
const tpl: SkillTemplate = {
  nodes: [
    { _seedId: 0, kind: "script", title: "剧本", prompt: "写剧本", x: 0, y: 0, params: {} },
    { _seedId: 1, kind: "image", title: "图", prompt: "出图", x: 300, y: 0, params: { ratio: "1:1" } },
  ],
  edges: [{ from: 0, to: 1 }],
};

const inst = instantiateSkillTemplate(tpl);
check("实例化 2 节点", inst.nodes.length === 2);
check("实例化 1 边", inst.edges.length === 1);
check("节点 id 已重映射（script_ 前缀）", inst.nodes[0].id.startsWith("script_") && !inst.nodes[0].id.includes("_seed"));
check("边 source/target 重映射", inst.edges[0].source === inst.nodes[0].id && inst.edges[0].target === inst.nodes[1].id);
check("运行态清空 idle", inst.nodes.every((n) => n.data.status === "idle" && n.data.progress === 0));
check("params 保留", inst.nodes[1].data.params.ratio === "1:1");
check("位置保留", inst.nodes[1].position.x === 300);
check("节点 type=kind", inst.nodes[0].type === "script");

const inst2 = instantiateSkillTemplate(tpl, "云端城市");
check("灵感注入首个节点", inst2.nodes[0].data.prompt.includes("云端城市"), inst2.nodes[0].data.prompt.slice(0, 20));
check("灵感只注入首个", !inst2.nodes[1].data.prompt.includes("云端城市"));

/* ---------- HTTP start ---------- */
const BASE = "http://localhost:8620";

async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const save = (res: Response) => {
    (res as unknown as { headers: Headers }).headers
      .getSetCookie?.()
      .forEach((c: string) => {
        const [pair] = c.split(";");
        const i = pair.indexOf("=");
        jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      });
  };
  const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  save(csrfRes);
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };
  const p = new URLSearchParams();
  p.set("email", email);
  p.set("password", password);
  p.set("csrfToken", csrfToken);
  p.set("callbackUrl", BASE);
  p.set("json", "true");
  const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: p.toString(),
    redirect: "manual",
  });
  save(lr);
  return (path: string, init?: RequestInit) =>
    fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), cookie: cookie() },
      redirect: "manual",
    });
}

async function main() {
  const email = `skillstart_${Date.now()}@t.edu`;
  const password = "test1234";
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10) },
  });
  const api = await login(email, password);

  const createdWorkflowIds: string[] = [];

  try {
    const before = await prisma.skill.findUnique({
      where: { slug: "oriental-aesthetic-film" },
      select: { usageCount: true },
    });

    const res = await api("/api/skills/oriental-aesthetic-film/start", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inspiration: "黄昏云端城市" }),
    });
    const j = await res.json() as {
      ok: boolean; workflowId: string; nodeCount: number; edgeCount: number;
    };
    check("start 200", res.status === 200, String(res.status));
    check("返回 workflowId", !!j.workflowId);
    check("4 节点 4 边", j.nodeCount === 4 && j.edgeCount === 4, `${j.nodeCount}/${j.edgeCount}`);
    createdWorkflowIds.push(j.workflowId);

    // 工作流与节点真实落库
    const wf = await prisma.workflow.findUnique({ where: { id: j.workflowId } });
    check("工作流标题取灵感", wf?.title === "黄昏云端城市", wf?.title ?? "");
    const nodeCount = await prisma.canvasNode.count({ where: { workflowId: j.workflowId } });
    const edgeCount = await prisma.canvasEdge.count({ where: { workflowId: j.workflowId } });
    check("库内 4 节点 4 边", nodeCount === 4 && edgeCount === 4);
    // 首节点含灵感
    const first = await prisma.canvasNode.findFirst({
      where: { workflowId: j.workflowId },
      orderBy: { x: "asc" },
    });
    const firstData = JSON.parse(first!.data) as { prompt: string };
    check("首节点 prompt 含灵感", firstData.prompt.includes("黄昏云端城市"));

    // usageCount +1
    const after = await prisma.skill.findUnique({
      where: { slug: "oriental-aesthetic-film" },
      select: { usageCount: true },
    });
    check("usageCount +1", after!.usageCount === before!.usageCount + 1, `${before!.usageCount}→${after!.usageCount}`);

    /* 无灵感启动：标题=Skill 名 */
    const res2 = await api("/api/skills/oriental-aesthetic-film/start", { method: "POST" });
    const j2 = await res2.json() as { workflowId: string };
    createdWorkflowIds.push(j2.workflowId);
    const wf2 = await prisma.workflow.findUnique({ where: { id: j2.workflowId } });
    check("无灵感标题=Skill 名", wf2?.title === "东方巨构美学短剧", wf2?.title ?? "");

    /* 404 / 401 */
    const noSkill = await api("/api/skills/no-slug/start", { method: "POST" });
    check("Skill 不存在 → 404", noSkill.status === 404, String(noSkill.status));
    const anon = await fetch(`${BASE}/api/skills/oriental-aesthetic-film/start`, { method: "POST" });
    check("未登录 → 401", anon.status === 401, String(anon.status));
  } finally {
    // 清理：级联节点边
    for (const id of createdWorkflowIds) {
      await prisma.workflow.deleteMany({ where: { id } }).catch(() => {});
    }
    // 还原 usageCount（本次测试 +2）
    await prisma.skill.update({
      where: { slug: "oriental-aesthetic-film" },
      data: { usageCount: { decrement: createdWorkflowIds.length } },
    }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: user.id } });
  }

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
