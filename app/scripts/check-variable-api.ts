/**
 * 变量 CRUD API 端到端自测（T3.5 第二步）。
 * 真实 HTTP + NextAuth credentials 登录会话，覆盖：
 *   GET/POST/PATCH/DELETE、字段校验 400、唯一冲突 409、
 *   未登录 401、他人资源 403/404。
 * 运行：pnpm tsx scripts/check-variable-api.ts
 */

// 自测一律走 mock provider：绝不能因为 .env 里有 ARK_API_KEY 就真花钱调厂商 API
process.env.FORCE_MOCK_PROVIDERS = "1";

import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";

const prisma = new PrismaClient();
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, extra = "") {
  if (cond) passed += 1;
  else failed += 1;
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? `  → ${extra}` : ""}`);
}

const BASE = "http://localhost:8620";

/** NextAuth credentials 登录，返回带 cookie 的 fetch 包装器 */
async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const saveSetCookie = (res: Response) => {
    // Node fetch 暴露 getSetCookie
    const raw = (res as unknown as { headers: Headers }).headers;
    raw.getSetCookie?.().forEach((c: string) => {
      const [pair] = c.split(";");
      const idx = pair.indexOf("=");
      jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
    });
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  // 1) csrf
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  saveSetCookie(csrfRes);
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  // 2) callback/credentials
  const params = new URLSearchParams();
  params.set("email", email);
  params.set("password", password);
  params.set("csrfToken", csrfToken);
  params.set("callbackUrl", BASE);
  params.set("json", "true");
  const loginRes = await fetch(
    `${BASE}/api/auth/callback/credentials`,
    {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        cookie: cookieHeader(),
      },
      body: params.toString(),
      redirect: "manual",
    },
  );
  saveSetCookie(loginRes);

  return async (path: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: {
        ...(init?.headers ?? {}),
        cookie: cookieHeader(),
      },
      redirect: "manual",
    });
    return res;
  };
}

async function main() {
  const email = `varapi_${Date.now()}@t.edu`;
  const password = "test1234";
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10) },
  });

  // 另一个用户（用于越权测试）
  const otherEmail = `varapi_other_${Date.now()}@t.edu`;
  const other = await prisma.user.create({
    data: {
      email: otherEmail,
      passwordHash: await bcrypt.hash(password, 10),
    },
  });
  const wfOther = await prisma.workflow.create({
    data: { userId: other.id, title: "他人工作流" },
  });

  const wf = await prisma.workflow.create({
    data: { userId: user.id, title: "变量API测试" },
  });

  const api = await login(email, password);
  const root = `/api/workflows/${wf.id}/variables`;

  try {
    /* ---- 未登录 401 ---- */
    const anon = await fetch(`${BASE}${root}`);
    check("未登录 GET → 401", anon.status === 401, String(anon.status));

    /* ---- 初始列表为空 ---- */
    const empty = await api(root);
    const emptyJson = await empty.json() as { variables: unknown[] };
    check("初始变量列表为空", empty.status === 200 && emptyJson.variables.length === 0);

    /* ---- 新建 ---- */
    const created = await api(root, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "subject", label: "画面主体", type: "text", required: true, source: "student",
      }),
    });
    const createdJson = await created.json() as {
      variable: { id: string; key: string; options: string[] };
    };
    check("新建变量 → 201", created.status === 201, String(created.status));
    check("返回变量带 id", !!createdJson.variable?.id);
    check("变量默认 options=[]", JSON.stringify(createdJson.variable.options) === "[]");
    const varId = createdJson.variable.id;

    /* ---- select 变量（验证 options 持久化） ---- */
    const sel = await api(root, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key: "style", label: "风格", type: "select",
        options: ["电影感", "日系"], source: "teacher", default: "电影感",
      }),
    });
    const selJson = await sel.json() as {
      variable: { options: string[]; default: string; source: string };
    };
    check("select 新建 → 201", sel.status === 201, String(sel.status));
    check("select options 持久化", JSON.stringify(selJson.variable.options) === '["电影感","日系"]');
    check("teacher 默认值持久化", selJson.variable.default === "电影感" && selJson.variable.source === "teacher");

    /* ---- 列表 2 条 ---- */
    const list = await api(root);
    const listJson = await list.json() as { variables: unknown[] };
    check("列表返回 2 条", listJson.variables.length === 2, String(listJson.variables.length));

    /* ---- 唯一冲突 409 ---- */
    const dup = await api(root, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "subject", label: "重复" }),
    });
    check("重复 key → 409", dup.status === 409, String(dup.status));

    /* ---- 字段校验 400 ---- */
    const bad = await api(root, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "1bad", label: "x" }),
    });
    check("非法 key → 400", bad.status === 400, String(bad.status));
    const badJson = await bad.json() as { fields?: { key?: string } };
    check("返回字段错误明细", !!badJson.fields?.key);

    /* ---- PATCH 部分更新 ---- */
    const patched = await api(`${root}/${varId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ label: "新主体名称" }),
    });
    const patchedJson = await patched.json() as {
      variable: { label: string; key: string };
    };
    check("PATCH 改 label → 200", patched.status === 200, String(patched.status));
    check("label 更新且 key 保留", patchedJson.variable.label === "新主体名称" && patchedJson.variable.key === "subject");

    /* ---- PATCH 改 key 冲突 ---- */
    const clash = await api(`${root}/${varId}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "style" }),
    });
    check("PATCH 改成已存在 key → 409", clash.status === 409, String(clash.status));

    /* ---- 越权：他人工作流 ---- */
    const otherRoot = `/api/workflows/${wfOther.id}/variables`;
    const forbidden = await api(otherRoot);
    check("访问他人变量 → 403", forbidden.status === 403, String(forbidden.status));

    /* ---- 变量不属于该工作流 → 404 ---- */
    // 在别人工作流路径下访问自己的 varId
    const cross = await api(`${otherRoot}/${varId}`);
    check("跨工作流访问变量 → 403（先挡归属）", cross.status === 403, String(cross.status));

    /* ---- DELETE ---- */
    const del = await api(`${root}/${varId}`, { method: "DELETE" });
    check("DELETE → 200", del.status === 200, String(del.status));
    const afterList = await api(root);
    const afterJson = await afterList.json() as { variables: unknown[] };
    check("删除后列表剩 1 条", afterJson.variables.length === 1, String(afterJson.variables.length));

    /* 删除不存在变量 → 404 */
    const delMissing = await api(`${root}/${varId}`, { method: "DELETE" });
    check("重复删除 → 404", delMissing.status === 404, String(delMissing.status));
  } finally {
    // 清理：测试工作流级联删变量
    await prisma.variable.deleteMany({ where: { workflowId: wf.id } });
    await prisma.workflow.deleteMany({ where: { id: { in: [wf.id, wfOther.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [user.id, other.id] } } });
  }

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
