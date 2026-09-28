import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 关闭左下角的 Next 开发指示器（会遮挡画布左下角工具条）
  devIndicators: false,
  /**
   * 允许用局域网 IP / mDNS 名字访问 dev server。
   * Next 15.3+ 默认只信任 localhost，其他 origin 访问 /_next/* 开发资源时
   * 会导致客户端 hydration 起不来（页面停在 SSR 的初始态，看起来像“加载不出来”）。
   */
  allowedDevOrigins: [
    "192.168.105.116",
    "kassing-2.local",
    "*.local",
  ],
};

export default nextConfig;
