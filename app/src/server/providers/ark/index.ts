import type { GenContext, GenInput, GenProvider, GenResult } from "../types";
import type { Shot, ShotFraming } from "@/types";
import { resolveArkModel } from "./config";
import { arkChat, arkCreateVideoTask, arkGetVideoTask, arkImage, toArkImageRef } from "./client";
import { persistRemoteMedia, persistAllRemote } from "../mediaStore";

/* ------------------------------------------------------------------ */
/* 火山方舟（豆包 / Seedream / Seedance）真实 provider 实现              */
/* ------------------------------------------------------------------ */

const FRAMINGS: ShotFraming[] = ["远景", "全景", "中景", "近景", "特写"];

/** 提示词里带上上游上下文，让生成结果接得上前面节点 */
function upstreamDigest(input: GenInput): string {
  const ups = input.upstreams ?? [];
  if (!ups.length) return "";
  return ups
    .map((u) => `# 来自 ${u.title}（${u.kind}）\n${u.summary}`)
    .join("\n\n");
}

/** 中止检查：取消/超时后立刻抛，别把 abort 吞成普通错误 */
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    const reason = signal.reason;
    throw reason instanceof Error ? reason : new Error("已取消");
  }
}

/**
 * 模拟进度 ticker：单次 ARK 调用（10-40s）没有真实中间进度，
 * 用缓动曲线从 start 逼近 cap，任务完成后由调用方打 100%。
 * 曲线 1-e^(-2.2t)：起步快（LibTV 的百分比也是“先快后慢”）。
 */
async function withProgress<T>(
  task: Promise<T>,
  onProgress: ((p: number) => void) | undefined,
  start: number,
  cap: number,
  expectedMs = 26000,
): Promise<T> {
  if (!onProgress || cap <= start) return task;
  const t0 = Date.now();
  onProgress(start);
  const timer = setInterval(() => {
    const t = (Date.now() - t0) / expectedMs;
    const p = start + (cap - start) * (1 - Math.exp(-2.2 * t));
    onProgress(Math.min(cap, Math.round(p)));
  }, 700);
  try {
    return await task;
  } finally {
    clearInterval(timer);
  }
}

/** 尽力从模型输出里抠出 JSON（模型偶尔会包一层 ```json 或加句开场白） */
function extractJson(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();

  for (const candidate of [unfenced, sliceBraces(unfenced)]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      /* 换下一个候选 */
    }
  }
  throw new Error(
    `模型未按要求返回 JSON 分镜，前 200 字：${trimmed.slice(0, 200)}`,
  );
}

function sliceBraces(s: string): string | null {
  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  return a >= 0 && b > a ? s.slice(a, b + 1) : null;
}

/** 把模型给的分镜行规整成内部 Shot（字段缺失/越界都要能兜住） */
function normalizeShots(raw: unknown): Shot[] {
  const list = Array.isArray(raw) ? raw : [];
  const shots: Shot[] = [];

  list.forEach((item, i) => {
    const o = (item ?? {}) as Record<string, unknown>;
    const scene = String(o.scene ?? o.画面 ?? "").trim();
    if (!scene) return; // 没画面的行直接丢，故事板画不出来

    const framingRaw = String(o.framing ?? "").trim();
    const framing = (FRAMINGS as string[]).includes(framingRaw)
      ? (framingRaw as ShotFraming)
      : FRAMINGS[i % FRAMINGS.length];

    const dRaw = Number(o.duration);
    const duration = Number.isFinite(dRaw)
      ? Math.min(12, Math.max(2, Math.round(dRaw)))
      : 5;

    shots.push({
      id: `shot-${shots.length + 1}`,
      index: shots.length + 1,
      scene,
      dialogue: String(o.dialogue ?? o.台词 ?? "").trim(),
      framing,
      camera: String(o.camera ?? o.运镜 ?? "固定").trim() || "固定",
      duration,
      confirmed: false,
    });
  });

  return shots;
}

/* --------------------------- 文本 / 脚本 --------------------------- */

const SHOT_SYSTEM_PROMPT = `你是资深影视分镜师，为 AI 视频生成提供分镜脚本。

只输出一个 JSON 对象，不要任何解释文字、不要 markdown 代码块，格式严格如下：
{"text":"整体文案或口播稿；若用户只要分镜可给空串","action_input":"给下游文生图/文生视频直接使用的完整画面提示词（一段连贯描述，含主体、环境、光线、风格）","style":"整体美术风格，如 电影级写实/赛博朋克/新中式/皮克斯动画","aspect_ratio":"建议画幅比例，从 16:9 / 9:16 / 1:1 / 4:3 / 3:4 中选一个","shots":[{"scene":"画面内容描述","dialogue":"该镜头台词或旁白，无则空串","framing":"远景|全景|中景|近景|特写","camera":"运镜方式，如 缓慢推近 / 固定 / 横移","duration":5}]}

要求：
1. shots 给 3 到 6 个，按时长与叙事节奏排布；
2. duration 是整数秒，取值 2 到 10；
3. scene 必须具体可画：写清主体、动作、环境、光线与氛围，不要写"同上""延续前一镜"这类无法作画的话（它会直接作为文生图提示词）；
4. dialogue 只放真正会被念出来的台词/旁白，纯画面镜头给空串；
5. action_input、style、aspect_ratio 必填，下游节点会机器消费这三个字段；
6. 全程使用简体中文。`;

export const arkTextProvider: GenProvider = {
  name: "ark-text",
  kind: "text",
  handles: ["text", "script"],
  costEstimate: () => 2,
  async generate(input: GenInput, ctx: GenContext): Promise<GenResult> {
    const model = resolveArkModel(input.nodeKind, String(input.params?.model ?? ""));
    const digest = upstreamDigest(input);

    const userPrompt = [
      input.prompt || input.title,
      digest ? `\n\n--- 上游素材/上下文 ---\n${digest}` : "",
      input.params?.mode === "分镜表" ? "\n\n请以分镜表形式输出。" : "",
    ].join("");

    ctx.onProgress?.(10);
    throwIfAborted(ctx.signal);

    const raw = await withProgress(
      arkChat(
        model,
        [
          { role: "system", content: SHOT_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        { signal: ctx.signal, json: true, maxTokens: 3000 },
      ),
      ctx.onProgress,
      10,
      72,
      18000,
    );

    ctx.onProgress?.(75);

    const parsed = extractJson(raw) as Record<string, unknown>;
    const shots = normalizeShots(parsed.shots);
    if (!shots.length) {
      throw new Error("模型返回的分镜为空，无法进入故事板流程");
    }

    const body = String(parsed.text ?? "").trim();

    // 动作契约（对齐 LibTV 实测结构）：action_input 优先取模型给的完整提示词，
    // 缺失时按 整体文案 → 首镜画面 的顺序兜底，保证下游永远有可消费的东西。
    const actionInput =
      String(parsed.action_input ?? "").trim() || body || shots[0].scene;
    const style = String(parsed.style ?? "").trim() || "电影级";
    const aspectRatio = String(parsed.aspect_ratio ?? "").trim() || "16:9";
    const shotBlock = `\n\n/* --- 分镜（${shots.length} 镜） ---\n${shots
      .map(
        (s) =>
          `#${s.index} 【${s.framing}·${s.camera}·${s.duration}s】${s.scene}${
            s.dialogue ? `\n    台词：${s.dialogue}` : ""
          }`,
      )
      .join("\n")}\n*/`;

    ctx.onProgress?.(100);

    return {
      kind: input.nodeKind,
      text: `${body || input.title}${digest ? `\n\n/* --- 上游上下文 ---\n${digest}\n*/` : ""}${shotBlock}`,
      shots,
      action: {
        action: input.nodeKind === "script" ? "generate_storyboard" : "text_to_image",
        action_input: actionInput,
        supplementary: { style, aspect_ratio: aspectRatio },
      },
    };
  },
};

/* ------------------------------ 图片 ------------------------------ */

/** 画布上的比例 → ARK 像素尺寸（2K 基准；ARK 只收像素串或 "2K"，像素串更可控） */
const RATIO_SIZE: Record<string, string> = {
  "16:9": "2048x1152",
  "9:16": "1152x2048",
  "1:1": "2048x2048",
  "4:3": "2048x1536",
  "3:4": "1536x2048",
  "21:9": "2048x878",
  "9:21": "878x2048",
  "3:2": "2048x1365",
  "2:3": "1365x2048",
  "1:2": "1152x2304",
  "2:1": "2304x1152",
  "5:4": "2048x1638",
  "4:5": "1638x2048",
};

/** 清晰度档位 → 尺寸缩放（1K 省算力草稿、2K 默认、4K 成片；边长钳制在 [512, 4096]） */
function scaleSize(size: string, resolution?: string): string {
  const m = /^(\d+)x(\d+)$/.exec(size);
  if (!m) return size;
  const factor = resolution === "1K" ? 0.5 : resolution === "4K" ? 2 : 1;
  if (factor === 1) return size;
  const clamp = (v: number) => Math.min(4096, Math.max(512, Math.round(v / 2) * 2));
  return `${clamp(Number(m[1]) * factor)}x${clamp(Number(m[2]) * factor)}`;
}

/** 画质档位 → 提示词后缀（没有独立 API 字段，用提示词工程真实影响产出） */
const QUALITY_SUFFIX: Record<string, string> = {
  高画质: "，高清画质，细节丰富",
  超高画质: "，超高清画质，细节极为丰富，锐利干净",
  极致画质: "，极致画质，大师级细节与光影，纤毫毕现",
};

const BG_SUFFIX: Record<string, string> = {
  保留背景: "保持原图片背景不变",
  透明背景: "主体孤立呈现，干净纯色背景，贴纸风格，便于后期抠图",
};

export const arkImageProvider: GenProvider = {
  name: "ark-image",
  kind: "image",
  handles: ["image"],
  costEstimate: () => 12,
  async generate(input: GenInput, ctx: GenContext): Promise<GenResult> {
    const model = resolveArkModel(input.nodeKind, String(input.params?.model ?? ""));
    const ratio = String(input.params?.aspectRatio ?? "16:9");
    const count = Math.min(4, Math.max(1, Number(input.params?.count) || 1));

    const digest = upstreamDigest(input);
    // 画质 / 背景参数 → 提示词后缀（对齐 LibTV 参数弹层的真实语义）
    const quality = String(input.params?.quality ?? "");
    const background = String(input.params?.background ?? "");
    const suffix =
      (QUALITY_SUFFIX[quality] ?? "") +
      (background && background !== "自动" && BG_SUFFIX[background]
        ? `，${BG_SUFFIX[background]}`
        : "");
    const base =
      [input.prompt || input.title, digest ? `参考上下文：\n${digest}` : ""]
        .filter(Boolean)
        .join("\n\n") + suffix;
    const resolution = String(input.params?.resolution ?? "2K");

    const all: string[] = [];
    for (let i = 0; i < count; i += 1) {
      throwIfAborted(ctx.signal);
      // 多张时补一句"第 i/N 张"，避免每张几乎一样
      const prompt =
        count > 1 ? `${base}\n\n（第 ${i + 1} 张，共 ${count} 张，构图与视角需明显不同）` : base;

      // 每张占 [i/N, (i+1)/N] 的进度切片，片内 8%→92% 缓动推进
      const sliceStart = Math.round((i / count) * 100);
      const sliceCap = Math.round(((i + 1) / count) * 100) - 8;
      const urls = await withProgress(
        arkImage(model, prompt, {
          size: scaleSize(RATIO_SIZE[ratio] ?? RATIO_SIZE["16:9"], resolution),
          // `@引用` 的参考图（被引用节点产物 / 标记图 / 角色参考图）→ 图生图
          referenceImages: input.referenceImages,
          signal: ctx.signal,
        }),
        ctx.onProgress,
        sliceStart,
        Math.max(sliceStart + 1, sliceCap),
      );

      // 立刻落盘：ARK 给的是 24 小时后过期的签名 URL
      all.push(...(await persistAllRemote(urls.slice(0, 1), "image", ctx.signal)));
      ctx.onProgress?.(Math.round(((i + 1) / count) * 100));
    }

    return { kind: input.nodeKind, urls: all };
  },
};

/* ------------------------------ 视频 ------------------------------ */

/** Seedance 只接受若干档时长，取最接近的合法值 */
function normalizeVideoDuration(seconds: number): number {
  const n = Number(seconds);
  const d = Number.isFinite(n) ? Math.round(n) : 5;
  const allowed = [5, 10];
  return allowed.reduce((best, cur) =>
    Math.abs(cur - d) < Math.abs(best - d) ? cur : best,
  );
}

/** 画布分辨率 → Seedance 的 --resolution 取值 */
function normalizeResolution(raw: unknown): string {
  const s = String(raw ?? "720P").toUpperCase().replace(/P$/, "p");
  return s === "1080p" || s === "720p" || s === "480p" ? s : "720p";
}

const VIDEO_POLL_MS = 5000;

export const arkVideoProvider: GenProvider = {
  name: "ark-video",
  kind: "video",
  handles: ["video"],
  costEstimate: () => 135,
  async generate(input: GenInput, ctx: GenContext): Promise<GenResult> {
    const model = resolveArkModel(input.nodeKind, String(input.params?.model ?? ""));
    const ratio = String(input.params?.aspectRatio ?? "16:9");
    const duration = normalizeVideoDuration(Number(input.params?.duration) || 5);
    const resolution = normalizeResolution(input.params?.resolution);

    const digest = upstreamDigest(input);
    const base = [input.prompt || input.title, digest].filter(Boolean).join("\n\n");

    // Seedance 的参数是拼在提示词尾巴上的文本指令，不是独立字段
    const text = `${base} --ratio ${ratio} --duration ${duration} --resolution ${resolution}`;

    const content: Array<Record<string, unknown>> = [{ type: "text", text }];

    // 图生视频：把上游已就绪的图片当首帧（文生视频则不加）；
    // 没有连线上游图时，退而取 `@引用` 的第一张参考图
    const edgeImage = (input.upstreams ?? [])
      .filter((u) => u.kind === "image")
      .flatMap((u) => u.urls ?? [])[0];
    const upstreamImage = edgeImage ?? input.referenceImages?.[0];
    if (upstreamImage) {
      content.push({
        type: "image_url",
        // 本地产物转 base64 内联，方舟回源不到 localhost
        image_url: { url: await toArkImageRef(upstreamImage) },
        role: "first_frame",
      });
    }

    ctx.onProgress?.(5);
    throwIfAborted(ctx.signal);

    const taskId = await arkCreateVideoTask(model, content as never, ctx.signal);

    // 轮询到终态。进度是估的（ARK 不给百分比），所以封顶 90，把 100 留给落盘完成
    let progress = 10;
    for (;;) {
      await new Promise((r) => setTimeout(r, VIDEO_POLL_MS));
      throwIfAborted(ctx.signal);

      const task = await arkGetVideoTask(taskId, ctx.signal);

      if (task.status === "succeeded") {
        if (!task.videoUrl) throw new Error("ARK 视频任务成功但未返回视频地址");
        ctx.onProgress?.(92);
        const local = await persistRemoteMedia(task.videoUrl, "video", ctx.signal);
        ctx.onProgress?.(100);
        return { kind: input.nodeKind, urls: [local] };
      }

      if (task.status === "failed") {
        throw new Error(`视频生成失败：${task.error ?? "厂商未给出原因"}`);
      }

      progress = Math.min(90, progress + 5);
      ctx.onProgress?.(progress);
    }
  },
};
