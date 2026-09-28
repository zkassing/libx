// 注意：middleware 跑在 Node runtime（见下方 runtime 导出），可以直接引用带 Prisma 的 auth
import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * 路由保护（T1.3）：
 * - /project（首页）、/assets、/canvas 必须登录，未登录跳 /login（带上 from）
 * - 已登录还访问 /login，送回首页 /project
 * - 首页重定向、Auth API 放行
 */
const PROTECTED = ["/project", "/assets", "/canvas"];

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  const needsAuth = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  if (needsAuth && !isLoggedIn) {
    const url = new URL("/login", req.nextUrl);
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && isLoggedIn) {
    return NextResponse.redirect(new URL("/project", req.nextUrl));
  }

  return NextResponse.next();
});

// Next 16：让 middleware 跑在 Node 运行时（auth.ts 依赖 Prisma/bcrypt，Edge 跑不了）
export const runtime = "nodejs";

export const config = {
  matcher: [
    // 只护页面：所有 API（各自在 handler 里校验会话）、静态资源都不进 middleware
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
