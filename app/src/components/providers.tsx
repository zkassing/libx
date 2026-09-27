"use client";

import { SessionProvider } from "next-auth/react";

/**
 * 全局客户端 provider。
 * SessionProvider 让 TopBar 等组件能拿到当前登录用户。
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
