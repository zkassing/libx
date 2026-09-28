/**
 * Skill API 端到端自测（Skill 第二步）。
 * 真实 NextAuth 登录会话 + HTTP，覆盖：
 *   GET /api/skills（全量/分类/搜索/source=favorite|mine）
 *   GET /api/skills/:slug（含模板）
 *   POST/DELETE /api/skills/:slug/favorite
 *   401 / 404
 * 运行：pnpm tsx scripts/check-skill-api.ts
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

const BASE = "http://localhost:3000";

async function login(email: string, password: string) {
  const jar = new Map<string, string>();
  const saveSetCookie = (res: Response) => {
    (res as unknown as { headers: Headers }).headers
      .getSetCookie?.()
      .forEach((c: string) => {
        const [pair] = c.split(";");
        const idx = pair.indexOf("=");
        jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
      });
  };
  const cookieHeader = () =>
    [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  const csrfRes = await fetch(`${BASE}/api/auth/csrf`);
  saveSetCookie(csrfRes);
  const { csrfToken } = await csrfRes.json() as { csrfToken: string };

  const params = new URLSearchParams();
  params.set("email", email);
  params.set("password", password);
  params.set("csrfToken", csrfToken);
  params.set("callbackUrl", BASE);
  params.set("json", "true");
  const loginRes = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: cookieHeader(),
    },
    body: params.toString(),
    redirect: "manual",
  });
  saveSetCookie(loginRes);

  return async (path: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}${path}`, {
      ...init,
      headers: { ...(init?.headers ?? {}), cookie: cookieHeader() },
      redirect: "manual",
    });
    return res;
  };
}

async function main() {
  const email = `skillapi_${Date.now()}@t.edu`;
  const password = "test1234";
  const user = await prisma.user.create({
    data: { email, passwordHash: await bcrypt.hash(password, 10) },
  });
  const api = await login(email, password);

  try {
    /* 全量列表：含 6 个官方种子 */
    const all = await api("/api/skills");
    const allJson = await all.json() as {
      skills: Array<{ slug: string; official: boolean; favorited: boolean }>;
    };
    check("列表 200 且 ≥6", all.status === 200 && allJson.skills.length >= 6, String(allJson.skills.length));
    check("官方种子在内", allJson.skills.some((s) => s.slug === "oriental-aesthetic-film"));
    check("官方排前", allJson.skills[0].official === true);
    check("默认未收藏", allJson.skills[0].favorited === false);

    /* 分类过滤 */
    const film = await api("/api/skills?category=film");
    const filmJson = await film.json() as { skills: Array<{ category: string }> };
    check("film 分类只返回 film", filmJson.skills.length >= 1 && filmJson.skills.every((s) => s.category === "film"), String(filmJson.skills.length));

    /* 搜索 */
    const search = await api("/api/skills?q=A24");
    const searchJson = await search.json() as { skills: Array<{ name: string }> };
    check("搜索命中 A24", searchJson.skills.length === 1 && searchJson.skills[0].name.includes("A24"), String(searchJson.skills.length));
    const nohit = await api("/api/skills?q=zzzz不存在");
    const nohitJson = await nohit.json() as { skills: unknown[] };
    check("搜索无结果=空数组", nohitJson.skills.length === 0);

    /* 详情（含模板） */
    const detail = await api("/api/skills/oriental-aesthetic-film");
    const detailJson = await detail.json() as {
      skill: {
        name: string; scenes: string; outputs: string;
        template: { nodes: unknown[]; edges: unknown[] };
      };
    };
    check("详情 200", detail.status === 200);
    check("详情含 scenes/outputs", !!detailJson.skill.scenes && !!detailJson.skill.outputs);
    check("详情模板含 4 节点", detailJson.skill.template.nodes.length === 4, String(detailJson.skill.template.nodes.length));
    check("详情模板含 4 边", detailJson.skill.template.edges.length === 4, String(detailJson.skill.template.edges.length));

    /* 不存在 → 404 */
    const missing = await api("/api/skills/no-such-slug");
    check("详情不存在 → 404", missing.status === 404, String(missing.status));

    /* 收藏 */
    const fav = await api("/api/skills/oriental-aesthetic-film/favorite", { method: "POST" });
    check("收藏 → 200", fav.status === 200, String(fav.status));

    // 列表标记 favorited
    const favCheck = await api("/api/skills?category=drama");
    const favCheckJson = await favCheck.json() as {
      skills: Array<{ favorited: boolean }>;
    };
    check("列表标记已收藏", favCheckJson.skills.some((s) => s.favorited === true));

    // source=favorite 只返回收藏
    const favList = await api("/api/skills?source=favorite");
    const favListJson = await favList.json() as { skills: unknown[] };
    check("source=favorite 返回 ≥1", favListJson.skills.length >= 1, String(favListJson.skills.length));

    // 重复收藏幂等
    const favAgain = await api("/api/skills/oriental-aesthetic-film/favorite", { method: "POST" });
    check("重复收藏幂等 200", favAgain.status === 200);

    /* 取消收藏 */
    const unfav = await api("/api/skills/oriental-aesthetic-film/favorite", { method: "DELETE" });
    check("取消收藏 → 200", unfav.status === 200);
    const afterUnfav = await api("/api/skills?source=favorite");
    const afterUnfavJson = await afterUnfav.json() as {
      skills: Array<{ slug: string }>;
    };
    check("取消后收藏列表不含该 Skill", !afterUnfavJson.skills.some((s) => s.slug === "oriental-aesthetic-film"));

    /* source=mine：本用户无发布 → 空 */
    const mine = await api("/api/skills?source=mine");
    const mineJson = await mine.json() as { skills: unknown[] };
    check("source=mine 初始为空", mineJson.skills.length === 0, String(mineJson.skills.length));

    /* 未登录访问 favorite 源 → 401 */
    const anonFav = await fetch(`${BASE}/api/skills?source=favorite`);
    check("未登录 favorite 源 → 401", anonFav.status === 401, String(anonFav.status));
  } finally {
    await prisma.skillFavorite.deleteMany({ where: { userId: user.id } });
    await prisma.user.deleteMany({ where: { id: user.id } });
  }

  console.log(`\n${failed === 0 ? "全部通过" : "存在失败"}：${passed} 通过 / ${failed} 失败`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
