import { NODE_META } from "@/lib/nodeTypes";
import type { NodeKind } from "@/types";
import { buildMockShots, shotsToText } from "../skills/shotBuilder";
import type {
  GenContext,
  GenInput,
  GenProvider,
  GenResult,
} from "./types";

/* ------------------------------------------------------------------ */
/* Mock 产物生成（离线可用，不依赖任何外部服务）                         */
/* ------------------------------------------------------------------ */

/** 生成一张占位 SVG（data URL），模拟图片 / 视频 / 音频产物 */
function mockAsset(
  kind: NodeKind,
  seed: string,
  label: string,
  upstreamTitles: string[] = [],
): string {
  const color = NODE_META[kind]?.accent ?? "#8b5cf6";
  const text = label.slice(0, 34).replace(/[<>&]/g, "");
  const up = upstreamTitles
    .slice(0, 3)
    .join("，")
    .slice(0, 60)
    .replace(/[<>&]/g, "");
  const upLine = up
    ? `<text x="40" y="170" fill="#ffffffaa" font-size="15" font-family="sans-serif">基于上游：${up}</text>`
    : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="768" height="432">
  <rect width="768" height="432" fill="${color}"/>
  <text x="40" y="72" fill="#fff" font-size="26" font-family="sans-serif">${kind.toUpperCase()} · MOCK</text>
  <text x="40" y="122" fill="#ffffffcc" font-size="17" font-family="sans-serif">${text}</text>
  ${upLine}
  <text x="40" y="400" fill="#ffffff77" font-size="14" font-family="monospace">${seed}</text>
</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 把 0–100 的进度分若干步，用定时器推进，模拟真实生成耗时 */
function runWithProgress(
  totalMs: number,
  steps: number,
  onProgress?: (p: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let i = 0;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      if (signal?.aborted) {
        clearTimeout(timer);
        reject(new DOMException("生成已取消", "AbortError"));
        return;
      }
      i += 1;
      onProgress?.(Math.min(99, Math.round((i / steps) * 100)));
      if (i >= steps) resolve();
      else timer = setTimeout(tick, totalMs / steps);
    };
    timer = setTimeout(tick, totalMs / steps);
  });
}

/** 文本 / 脚本类 mock 产物（与前端 buildMockOutput 保持一致） */
function buildTextResult(input: GenInput): GenResult {
  const { nodeKind: kind, prompt, title, params, upstreams = [] } = input;
  const label = prompt || title;

  // P1：text/script 均产出结构化分镜（故事板视图读取）
  const shots = buildMockShots(label, 5);
  const shotDigest = shotsToText(shots);

  const text = JSON.stringify(
    {
      action: kind === "script" ? "generate_storyboard" : "text_to_image",
      action_input: `[Mock] ${label}`,
      upstream_context: upstreams.map((u) => ({
        from: u.title,
        kind: u.kind,
        summary: u.summary,
      })),
      supplementary: {
        style: "电影级",
        aspect_ratio: params?.aspectRatio ?? "16:9",
      },
    },
    null,
    2,
  );
  const digest = upstreams
    .map((u) => `# 来自 ${u.title}（${u.kind}）\n${u.summary}`)
    .join("\n\n");
  const shotBlock = `\n\n/* --- 分镜 ---\n${shotDigest}\n*/`;
  return {
    kind,
    text: digest
      ? `${text}\n\n/* --- 上游上下文 ---\n${digest}\n*/${shotBlock}`
      : `${text}${shotBlock}`,
    shots,
  };
}

/** 各类节点的模拟耗时（ms） */
const DURATION: Partial<Record<NodeKind, number>> = {
  text: 1500,
  script: 1800,
  image: 3000,
  video: 6500,
  audio: 3500,
};

function makeProvider(
  name: string,
  kind: GenProvider["kind"],
  handles: readonly NodeKind[],
  cost: number,
): GenProvider {
  return {
    name,
    kind,
    handles,
    costEstimate: () => cost,
    async generate(input: GenInput, ctx: GenContext): Promise<GenResult> {
      const ms = DURATION[input.nodeKind] ?? 2000;
      await runWithProgress(ms, kind === "video" ? 10 : 6, ctx.onProgress, ctx.signal);

      if (kind === "text") return buildTextResult(input);

      const seed = input.nodeId.slice(-6);
      return {
        kind: input.nodeKind,
        urls: [
          mockAsset(
            input.nodeKind,
            seed,
            input.prompt || input.title,
            input.upstreams?.map((u) => u.title),
          ),
        ],
      };
    },
  };
}

export const mockTextProvider = makeProvider(
  "mock-text",
  "text",
  ["text", "script"],
  2,
);
export const mockImageProvider = makeProvider(
  "mock-image",
  "image",
  ["image"],
  12,
);
export const mockVideoProvider = makeProvider(
  "mock-video",
  "video",
  ["video"],
  135,
);
export const mockAudioProvider = makeProvider(
  "mock-audio",
  "audio",
  ["audio"],
  18,
);
