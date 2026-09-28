import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* 远端产物落盘                                                          */
/* ------------------------------------------------------------------ */
/* 真实厂商（ARK 等）返回的是**带签名、有有效期的临时 URL**（实测 Seedream 的   */
/* 图片链接 X-Tos-Expires=86400，即 24 小时后失效）。直接把这种 URL 存进画布，   */
/* 过一天产物就全挂了。所以真实 provider 拿到 URL 后必须立刻下载到本地，      */
/* 存本地静态路径。                                                      */
/* 这对应 PRD §2 里说的「抽 StorageAdapter，M6 换 OSS」——目前落             */
/* public/uploads/generated，将来换 OSS 只改这一个函数。                    */
/* ------------------------------------------------------------------ */

const KIND_EXT: Record<string, string> = {
  image: "jpeg",
  video: "mp4",
  audio: "mp3",
};

/** Content-Type → 扩展名（拿不到就按产物种类给默认值） */
const MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 已经是本地/内联产物就不用下载 */
function isAlreadyLocal(url: string): boolean {
  return url.startsWith("/") || url.startsWith("data:") || url.startsWith("blob:");
}

/**
 * 把远端临时 URL 下载到 public/uploads/generated，返回本地静态路径。
 * 下载失败会重试 3 次后抛错——**不做静默回退**：宁可让这次运行标失败让用户重试，
 * 也不要存一个 24 小时后必然失效的链接（那才是真正的坑）。
 */
export async function persistRemoteMedia(
  url: string,
  kind: "image" | "video" | "audio",
  signal?: AbortSignal,
): Promise<string> {
  if (isAlreadyLocal(url)) return url;

  const dir = path.join(process.cwd(), "public", "uploads", "generated");
  await mkdir(dir, { recursive: true });

  let lastErr: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        throw new Error(`下载产物失败：HTTP ${res.status}`);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length === 0) throw new Error("下载到空文件");

      const ctype = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      const ext =
        MIME_EXT[ctype] ||
        (url.split("?")[0].split(".").pop() ?? "").slice(0, 5) ||
        KIND_EXT[kind] ||
        "bin";

      const name = `gen_${Date.now().toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}.${ext}`;
      await writeFile(path.join(dir, name), buf);
      return `/uploads/generated/${name}`;
    } catch (e) {
      // 取消要立刻冒泡，不能当成"重试一次就好了"
      if (signal?.aborted) throw e;
      lastErr = e;
      if (attempt < 3) await sleep(400 * attempt);
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error("下载产物失败");
}

/** 批量落盘（图片可能一次多张），保持顺序 */
export async function persistAllRemote(
  urls: string[],
  kind: "image" | "video" | "audio",
  signal?: AbortSignal,
): Promise<string[]> {
  const out: string[] = [];
  for (const u of urls) {
    out.push(await persistRemoteMedia(u, kind, signal));
  }
  return out;
}
