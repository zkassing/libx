import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";

/* ------------------------------------------------------------------ */
/* Mock 可播放样片：按需用 ffmpeg 生成纯色 MP4，供 P5 顺序连播。            */
/* - 同一 (颜色/时长) 只生成一次，产物落 public/mock-clips，静态托管；      */
/* - ffmpeg 不可用 / 生成失败时返回 null，调用方回退到 SVG data-URL；       */
/* - M6 替换真实 Provider 后本模块删除即可，上层不感知。                    */
/* ------------------------------------------------------------------ */

export const MOCK_CLIP_DIR = "mock-clips";

const inflight = new Map<string, Promise<string | null>>();

/** 生成稳定短哈希作为文件名 */
function hashKey(color: string, duration: number): string {
  return createHash("sha1").update(`${color}:${duration}`).digest("hex").slice(0, 12);
}

/** 时长钳到 1–6 秒（Mock 样片不需要真按分镜 5–6 秒等） */
export function mockClipDuration(seconds: number): number {
  const n = Number(seconds);
  const d = Number.isFinite(n) ? Math.round(n) : 2;
  return Math.min(6, Math.max(1, d));
}

function runFfmpeg(file: string, color: string, duration: number): Promise<void> {
  return new Promise((resolve, reject) => {
    // 移动的白框 + 底部色条：让样片有「视频在动」的感觉，又不依赖 drawtext 字体
    const draw =
      "drawbox=x='iw*(t/{d})-60':y=40:w=60:h=60:color=white@0.9:t=fill,".replace("{d}", String(duration)) +
      "drawbox=x=0:y=ih-28:w=iw:h=28:color=black@0.35:t=fill";
    const args = [
      "-y",
      "-f", "lavfi", "-i", `color=c=${color}:s=640x360:d=${duration}:r=24`,
      "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
      "-vf", draw,
      "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "64k",
      "-shortest",
      file,
    ];
    const p = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (d) => { stderr += d; });
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(stderr.slice(-300))),
    );
  });
}

/**
 * 返回某 mock 视频样片的静态 URL；按需生成（并发同 key 去重）。
 * 失败 / 无 ffmpeg 时返回 null。
 */
export async function getMockClipUrl(
  color: string,
  duration: number,
): Promise<string | null> {
  const secs = mockClipDuration(duration);
  const key = hashKey(color, secs);
  const file = path.join(process.cwd(), "public", MOCK_CLIP_DIR, `${key}.mp4`);
  const url = `/${MOCK_CLIP_DIR}/${key}.mp4`;

  const existing = inflight.get(key);
  if (existing) return existing;

  const task = (async () => {
    try {
      await mkdir(path.dirname(file), { recursive: true });
      await runFfmpeg(file, color, secs);
      return url;
    } catch {
      return null;
    }
  })();
  inflight.set(key, task);
  try {
    return await task;
  } finally {
    inflight.delete(key);
  }
}
