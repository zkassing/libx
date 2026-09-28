import { NextRequest } from "next/server";
import { handlers } from "@/auth";

/* ------------------------------------------------------------------ */
/* Auth.js 的动态 origin 修正                                            */
/* ------------------------------------------------------------------ */
/* `next dev` 默认 hostname 是 localhost，Next.js 在 route handler 里把      */
/* request.url 固定成 http://localhost:3000，而不是请求头里的 Host。        */
/* Auth.js 用 request.url 当 base URL，导致：                             */
/*   - 通过局域网 IP（或 .local）访问时，登录后被 302 弹回 localhost；       */
/*   - cookie 的 callback-url 也被写成 localhost。                        */
/* 这里用请求头（x-forwarded-host ?? host）重建真实 origin，               */
/* 使 localhost / 局域网 IP / mDNS 名字都能正确工作。                      */
/* ------------------------------------------------------------------ */

function withRequestOrigin(req: NextRequest): NextRequest {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) return req;

  const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "") ?? "http";
  const origin = `${proto}://${host}`;
  if (req.nextUrl.origin === origin) return req;

  const target = new URL(req.nextUrl.pathname + req.nextUrl.search, origin);
  return new NextRequest(target, req);
}

export const GET = (req: NextRequest) => handlers.GET(withRequestOrigin(req));
export const POST = (req: NextRequest) => handlers.POST(withRequestOrigin(req));
