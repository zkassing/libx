/**
 * 发布 Skill 自测（Skill 第五步）。
 * 覆盖：
 *   exportSkillTemplate（过滤 group、seedId、边重映射）
 *   导出 → 实例化往返一致性
 *   validatePublishSkill / validateSkillTemplate
 *   POST /api/skills 真实登录会话（mine 可见、authorId、official=false、401/400）
 * 运行：pnpm tsx scripts/check-skill-publish.ts
 */
import type { Edge, Node } from "@xyflow/react";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { exportSkillTemplate } from "../src/server/skills/exportSkill";
import { instantiateSkillTemplate } from "../src/server/skills/instantiateSkill";
import {
  validatePublishSkill,
  validateSkillTemplate,
} from "../src/server/skills/validatePublish";
import type { FlowNodeData } from "../src/types";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

/* ---------- 构造一组画布节点/边 ---------- */
function node(
  id: string,
  kind: FlowNodeData["kind"],
  x: number,
  y: number,
): Node<FlowNodeData> {
  return {
    id,
    type: kind,
    position: { x, y },
    data: {
      kind,
      title: `${kind}节点`,
      prompt: `p-${kind}`,
      params: { model: "X" },
      status: "succeeded",
      progress: 100,
      output: { kind, text: "运行产物不应被导出" },
    },
  };
}

const nodes: Node<FlowNodeData>[] = [
  node("n0", "text", 0, 0),
  node("n1", "image", 500, 0),
  node("n2", "video", 1000, 0),
  // group 应被过滤
  {
    id: "g", type: "group", position: { x: 0, y: 0 },
    data: { kind: "text", title: "组", prompt: "", params: {}, status: "idle", progress: 0 },
  } as Node<FlowNodeData>,
];
const edges: Edge[] = [
  { id: "e1", source: "n0", target: "n1" },
  { id: "e2", source: "n1", target: "n2" },
  // 连到 group 的边应被丢弃
  { id: "e3", source: "n0", target: "g" },
];

/* ---------- exportSkillTemplate ---------- */
const tpl = exportSkillTemplate(nodes, edges);
check("导出过滤 group → 3 节点", tpl.nodes.length === 3, String(tpl.nodes.length));
check("导出 2 边（丢弃连 group）", tpl.edges.length === 2, String(tpl.edges.length));
check("seedId 从 0 连续", tpl.nodes.map((n) => n._seedId).join(",") === "0,1,2");
check("边重映射为 seedId", JSON.stringify(tpl.edges[0]) === '{"from":0,"to":1}');
check("导出不带运行产物", tpl.nodes.every((n) => !(n as { output?: unknown }).output));
check("保留 prompt/params", tpl.nodes[0].prompt === "p-text" && tpl.nodes[1].params.model === "X");
check("位置保留", tpl.nodes[2].x === 1000);

/* ---------- 往返：导出 → 实例化 ---------- */
const round = instantiateSkillTemplate(tpl);
check("往返节点数一致", round.nodes.length === 3);
check("往返边数一致", round.edges.length === 2);
check("往返 prompt 一致", round.nodes.map((n) => n.data.prompt).join(",") === "p-text,p-image,p-video");
check("往返运行态清空 idle", round.nodes.every((n) => n.data.status === "idle"));

/* ---------- validateSkillTemplate ---------- */
check("合法模板通过", validateSkillTemplate(tpl) === true);
check("非对象不通过", validateSkillTemplate("x") === false);
check("空节点不通过", validateSkillTemplate({ nodes: [], edges: [] }) === false);
check("重复 seedId 不通过",
  validateSkillTemplate({ nodes: [{ _seedId: 1 }, { _seedId: 1 }], edges: [] }) === false);
check("边引用无效不通过",
  validateSkillTemplate({ nodes: [{ _seedId: 0, kind: "text", title: "t", prompt: "p", x: 0, y: 0 }], edges: [{ from: 0, to: 9 }] }) === false);

/* ---------- validatePublishSkill ---------- */
const v1 = validatePublishSkill({
  name: "我的技能", category: "film", template: tpl,
});
check("合法发布无错", Object.keys(v1.errors).length === 0 && v1.input?.name === "我的技能");
check("空 name 被拦", validatePublishSkill({ name: "", category: "film", template: tpl }).errors.name !== undefined);
check("非法 category 被拦", validatePublishSkill({ name: "a", category: "xx", template: tpl }).errors.category !== undefined);
check("非法 template 被拦", validatePublishSkill({ name: "a", category: "film", template: {} }).errors.template !== undefined);

/* ---------- HTTP ---------- */
const BASE = "http://localhost:3000";

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
  p.set("email", email); p.set("password", password);
  p.set("csrfToken", csrfToken); p.set("callbackUrl", BASE); p.set("json", "true");
  const lr = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: cookie() },
    body: p.toString(), redirect: "manual",
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
  const email = `skillpub_${Date.now()}@t.edu`;
  const password = "test1234";
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10), name: "测试作者" },
  });
  const api = await login(email, password);

  let createdSlug = "";

  try {
    const res = await api("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "我的发布技能", category: "drama", outputKind: "video",
        summary: "简介", scenes: "场景", template: tpl,
      }),
    });
    const j = await res.json() as { skill: { slug: string; authorName: string; official: boolean } };
    check("发布 201", res.status === 201, String(res.status));
    check("返回 slug 以 u 开头", j.skill.slug.startsWith("u"), j.skill.slug);
    check("作者名正确", j.skill.authorName === "测试作者");
    check("official=false", j.skill.official === false);
    createdSlug = j.skill.slug;

    /* source=mine 可见 */
    const mine = await api("/api/skills?source=mine");
    const mineJson = await mine.json() as { skills: Array<{ slug: string }> };
    check("mine 含刚发布", mineJson.skills.some((s) => s.slug === createdSlug), String(mineJson.skills.length));

    /* start 自定义技能可用 */
    const start = await api(`/api/skills/${createdSlug}/start`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ inspiration: "测试灵感" }),
    });
    const startJson = await start.json() as { workflowId: string; nodeCount: number };
    check("自定义技能可 start", start.status === 200 && startJson.nodeCount === 3);
    await prisma.workflow.deleteMany({ where: { id: startJson.workflowId } }).catch(() => {});

    /* 401 / 400 */
    const anon = await fetch(`${BASE}/api/skills`, { method: "POST" });
    check("未登录发布 → 401", anon.status === 401, String(anon.status));
    const bad = await api("/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "" }),
    });
    check("字段缺失发布 → 400", bad.status === 400, String(bad.status));
  } finally {
    if (createdSlug) {
      await prisma.skill.deleteMany({ where: { slug: createdSlug } }).catch(() => {});
    }
    await prisma.user.deleteMany({ where: { id: user.id } }).catch(() => {});
  }

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
