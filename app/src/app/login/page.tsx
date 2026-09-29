"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Loader2, Droplet, Mail, Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Mode = "login" | "register";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "注册失败");
          return;
        }
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("邮箱或密码不正确");
        return;
      }
      // 登录后落到首页 /project；若从受保护页面被弹来（middleware 带 from），则回到那一页
      const from = new URLSearchParams(window.location.search).get("from");
      router.push(from && from.startsWith("/") ? from : "/project");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0b0b0d] px-4">
      {/* 背景氛围 */}
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[600px] -translate-x-1/2 rounded-full bg-primary/10 blur-[140px]" />

      <div className="relative w-full max-w-[380px]">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-2.5 text-white"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-white">
            <Droplet className="size-5" />
          </span>
          <span className="text-[17px] font-medium tracking-tight">
            墨点 MoDot
          </span>
        </Link>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-7 shadow-2xl backdrop-blur-xl">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as Mode);
              setError(null);
            }}
            className="mb-6"
          >
            <TabsList className="w-full">
              <TabsTrigger value="login" className="flex-1">
                登录
              </TabsTrigger>
              <TabsTrigger value="register" className="flex-1">
                注册
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "register" && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="name" className="text-[13px] text-white/70">
                  昵称
                </Label>
                <div className="relative">
                  <User className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30" />
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="老师怎么称呼"
                    required
                    className="h-10 border-white/10 bg-white/5 pl-9 text-[14px] text-white placeholder:text-white/25"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="text-[13px] text-white/70">
                邮箱
              </Label>
              <div className="relative">
                <Mail className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@school.edu"
                  required
                  autoComplete="email"
                  className="h-10 border-white/10 bg-white/5 pl-9 text-[14px] text-white placeholder:text-white/25"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="text-[13px] text-white/70">
                密码
              </Label>
              <div className="relative">
                <Lock className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/30" />
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位"
                  required
                  minLength={6}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  className="h-10 border-white/10 bg-white/5 pl-9 text-[14px] text-white placeholder:text-white/25"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12.5px] text-red-300">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="mt-1 h-10 w-full text-[14px]"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "登录" : "注册并登录"}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px] text-white/30">
          画布内容保存在本地浏览器，M2 起支持云端同步
        </p>
      </div>
    </div>
  );
}
