import { readFile } from "node:fs/promises";
import path from "node:path";
import { ARK_BASE_URL, arkApiKey } from "./config";

/* ------------------------------------------------------------------ */
/* ARK HTTP 客户端                                                      */
/* ------------------------------------------------------------------ */
/* 三类接口形态完全不同，所以这里分开封装：                                */
/*  - 文本：OpenAI 兼容 /chat/completions，同步返回                       */
/*  - 图片：/images/generations，同步返回（但给的是**会过期的签名 URL**）    */
/*  - 视频：/contents/generations/tasks，**异步任务**：先建任务拿 id，再轮询  */
/* ------------------------------------------------------------------ */

/** ARK 错误体：{"error":{"code","message","type"}} */
interface ArkErrorBody {
  error?: { code?: string; message?: string; type?: string };
}

/** 把 ARK 的错误码翻译成给人看的话，便于在节点上展示 */
function describeArkError(status: number, body: ArkErrorBody, raw: string): string {
  const code = body.error?.code ?? "";
  const msg = body.error?.message ?? raw.slice(0, 200);

  if (status === 401 || code === "AuthenticationError" || code === "InvalidApiKey") {
    return "ARK 鉴权失败：请检查 ARK_API_KEY 是否正确";
  }
  if (code === "ModelNotOpen") {
    return `ARK 模型未开通：${msg}（需到方舟控制台开通该模型）`;
  }
  if (code === "InvalidEndpointOrModel.NotFound") {
    return `ARK 模型不存在或无权访问：${msg}`;
  }
  if (code === "InvalidEndpoint.ClosedEndpoint") {
    return `ARK 模型已下线：${msg}`;
  }
  if (status === 429 || code === "RateLimitExceeded") {
    return "ARK 触发限流（429），请稍后重试";
  }
  if (code === "QuotaExceeded" || code === "InsufficientBalance") {
    return `ARK 额度不足：${msg}`;
  }
  if (code === "SensitiveContent" || /sensitive/i.test(code)) {
    return `提示词未通过内容审核：${msg}`;
  }
  return `ARK 调用失败（HTTP ${status}${code ? ` / ${code}` : ""}）：${msg}`;
}

async function arkFetch(
  path: string,
  init: RequestInit & { signal?: AbortSignal },
): Promise<unknown> {
  const res = await fetch(`${ARK_BASE_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${arkApiKey()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const raw = await res.text();
  if (!res.ok) {
    let body: ArkErrorBody = {};
    try {
      body = JSON.parse(raw) as ArkErrorBody;
    } catch {
      /* 非 JSON 错误体，走 raw */
    }
    throw new Error(describeArkError(res.status, body, raw));
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`ARK 返回非 JSON：${raw.slice(0, 200)}`);
  }
}

/* ------------------------------- 文本 ------------------------------- */

export interface ArkChatOptions {
  signal?: AbortSignal;
  maxTokens?: number;
  temperature?: number;
  /** 要求返回 JSON 对象（Doubao 支持 response_format） */
  json?: boolean;
}

/** 消息内容：纯文本，或多模态分段（text + image_url） */
export type ArkMessageContent = string | Array<Record<string, unknown>>;

/**
 * 把本地/内联图片转成 ARK 可消费的形态：
 *  - /uploads/...（本地落盘产物）→ 读文件转 base64 data URL（方舟够不到 localhost）
 *  - data: / http(s): 原样透传
 */
export async function toArkImageRef(url: string): Promise<string> {
  if (url.startsWith("data:") || /^https?:\/\//.test(url)) return url;
  if (url.startsWith("/")) {
    const file = path.join(process.cwd(), "public", url);
    const buf = await readFile(file);
    const ext = url.split(".").pop()?.toLowerCase() ?? "jpeg";
    const mime =
      ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return `data:${mime};base64,${buf.toString("base64")}`;
  }
  return url;
}

export async function arkChat(
  model: string,
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: ArkMessageContent;
  }>,
  opts: ArkChatOptions = {},
): Promise<string> {
  const data = (await arkFetch("/chat/completions", {
    method: "POST",
    signal: opts.signal,
    body: JSON.stringify({
      model,
      messages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.8,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  })) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("ARK 文本接口返回为空");
  return content;
}

/* ------------------------------- 图片 ------------------------------- */

export interface ArkImageOptions {
  /** ARK 尺寸写法是 "1024x1024" / "2048x2048" 这种像素串 */
  size?: string;
  count?: number;
  watermark?: boolean;
  /** 参考图（图生图/多图参考）：本地路径会先转 base64（Seedream 4.0+ 支持） */
  referenceImages?: string[];
  signal?: AbortSignal;
}

export async function arkImage(
  model: string,
  prompt: string,
  opts: ArkImageOptions = {},
): Promise<string[]> {
  // 参考图：本地产物统一转 base64 内联，避免方舟回源不到 localhost
  const refs = opts.referenceImages?.length
    ? await Promise.all(opts.referenceImages.map(toArkImageRef))
    : undefined;

  const data = (await arkFetch("/images/generations", {
    method: "POST",
    signal: opts.signal,
    body: JSON.stringify({
      model,
      prompt,
      size: opts.size ?? "1024x1024",
      // 只要 URL（b64_json 会让响应体巨大，没必要）
      response_format: "url",
      watermark: opts.watermark ?? false,
      // 图生图/参考图：单张传字符串，多张传数组（Seedream 4.0+ 多图参考）
      ...(refs?.length ? { image: refs.length === 1 ? refs[0] : refs } : {}),
      ...(opts.count && opts.count > 1 ? { sequential_image_generation: "auto" } : {}),
    }),
  })) as { data?: Array<{ url?: string; b64_json?: string }> };

  const urls = (data.data ?? [])
    .map((d) => d.url)
    .filter((u): u is string => !!u);
  if (!urls.length) throw new Error("ARK 图片接口未返回图片");
  return urls;
}

/* ------------------------------- 视频 ------------------------------- */

export type ArkVideoContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string }; role?: "first_frame" | "last_frame" };

export interface ArkVideoTask {
  id: string;
  status: "queued" | "running" | "succeeded" | "failed";
  videoUrl?: string;
  error?: string;
}

/** 创建视频生成任务，返回任务 id */
export async function arkCreateVideoTask(
  model: string,
  content: ArkVideoContent[],
  signal?: AbortSignal,
): Promise<string> {
  const data = (await arkFetch("/contents/generations/tasks", {
    method: "POST",
    signal,
    body: JSON.stringify({ model, content }),
  })) as { id?: string };
  if (!data.id) throw new Error("ARK 视频任务创建失败：未返回任务 id");
  return data.id;
}

/** 查询视频任务状态 */
export async function arkGetVideoTask(
  taskId: string,
  signal?: AbortSignal,
): Promise<ArkVideoTask> {
  const data = (await arkFetch(
    `/contents/generations/tasks/${encodeURIComponent(taskId)}`,
    { method: "GET", signal },
  )) as {
    id?: string;
    status?: string;
    content?: { video_url?: string };
    error?: { code?: string; message?: string };
  };

  const status = (data.status ?? "running") as ArkVideoTask["status"];
  return {
    id: data.id ?? taskId,
    status,
    videoUrl: data.content?.video_url,
    error: data.error?.message ?? data.error?.code,
  };
}
