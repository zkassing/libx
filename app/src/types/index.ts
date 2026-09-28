// 核心类型定义（M1 画布内核）

export type NodeKind = "text" | "image" | "video" | "audio" | "script";

export type RunStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled";

export interface NodeParams {
  model?: string;
  /** 生成模式，如 文生视频 / 图生视频 / 首尾帧 */
  mode?: string;
  aspectRatio?: string;
  resolution?: string;
  duration?: number;
  count?: number;
  [key: string]: unknown;
}

/** 教学元数据（M4 使用，M1 占位） */
export interface TeachingInfo {
  stepTitle?: string;
  instruction?: string;
  editable: "locked" | "student";
  checkpoint?: string;
  hints?: string[];
}

/**
 * LibTV 风格动作契约（对齐实测）：节点产出附带的结构化声明。
 * 下游节点 / AutoLink 据此消费——`action_input` 是可直接使用的提示词，
 * `supplementary` 携带风格 / 画幅比例等参数建议。
 */
export interface NodeAction {
  /** 动作类型，如 text_to_image / generate_storyboard */
  action: string;
  /** 给下游直接可用的完整提示词 */
  action_input: string;
  /** 补充参数建议（style / aspect_ratio …） */
  supplementary?: Record<string, unknown>;
}

export interface NodeOutput {
  kind: NodeKind;
  text?: string;
  urls?: string[];
  /** 结构化分镜（text/script 节点产出，故事板视图读取） */
  shots?: Shot[];
  /** 动作契约（text/script 节点产出，AutoLink 消费） */
  action?: NodeAction;
}

/** 景别 */
export type ShotFraming = "远景" | "全景" | "中景" | "近景" | "特写";

/**
 * 单个镜头（分镜表的一行）。
 * 对齐 LibTV 拆解维度：画面 / 台词 / 景别 / 运镜 / 时长。
 */
export interface Shot {
  /** 稳定标识，如 shot-1 */
  id: string;
  /** 镜头号（从 1） */
  index: number;
  /** 画面内容描述（生成分镜图的提示词来源） */
  scene: string;
  /** 台词 / 旁白（无则空串） */
  dialogue: string;
  /** 景别 */
  framing: ShotFraming;
  /** 运镜方式 */
  camera: string;
  /** 时长（秒） */
  duration: number;
  /** 故事板中是否已确认（确认后才进入后续生成） */
  confirmed: boolean;
  /** P3：该镜头的分镜图节点 id（已创建则复用） */
  imageNodeId?: string;
  /** P4：该镜头的图生视频节点 id */
  videoNodeId?: string;
  /** P5：是否已纳入成片 */
  inFilm?: boolean;
}

/** 图片产物上的区域标记（对齐 LibTV「标记」）：归一化矩形 + 名称 */
export interface NodeMark {
  id: string;
  /** 标记挂在哪张产物图上（节点 output.urls 之一） */
  imageUrl: string;
  /** 归一化矩形（0-1，相对图片宽/高） */
  rect: { x: number; y: number; w: number; h: number };
  /** 标记名（AI 识别生成，可手改）；插入提示词时显示为 @label */
  label: string;
}

/** `@` 引用（节点 / 素材 / 模型 / 区域标记 / 角色） */
export interface NodeRef {
  /** 节点 id、`asset:节点id`、`model:模型名`、标记 id 或角色 id */
  id: string;
  type: "node" | "asset" | "model" | "mark" | "character";
  label: string;
  /** type=mark 时的区域快照：来源节点 / 图 / 归一化矩形 */
  mark?: {
    nodeId: string;
    imageUrl: string;
    rect: NodeMark["rect"];
  };
}

/** React Flow 节点携带的数据 */
export interface FlowNodeData {
  kind: NodeKind;
  title: string;
  /** 同类节点内的序号，用于 "视频节点 1" 这样的标签 */
  index?: number;
  prompt: string;
  params: NodeParams;
  status: RunStatus;
  progress: number;
  output?: NodeOutput;
  /** `@` 引用列表 */
  refs?: NodeRef[];
  /** 图片节点产物上的区域标记（LibTV 标记） */
  marks?: NodeMark[];
  /** 用户自定义卡片尺寸（拖右下角调整；目前仅文本节点暴露手柄） */
  size?: { w: number; h: number };
  teaching?: TeachingInfo;
  /** 打组后由 group 节点使用 */
  collapsed?: boolean;
  [key: string]: unknown;
}

/** 节点卡片默认尺寸（打组包围盒计算用） */
/**
 * 节点卡片尺寸。对齐 LibTV：文本/脚本/音频/图片偏近正方，视频保 16:9。
 * （改这里就够了，落位、一键整理、打组包围盒都读这张表）
 */
export const NODE_SIZE: Record<NodeKind, { w: number; h: number }> = {
  text: { w: 340, h: 330 },
  image: { w: 420, h: 380 },
  video: { w: 460, h: 320 },
  audio: { w: 380, h: 330 },
  script: { w: 360, h: 350 },
};

/** 节点标签行高度（在卡片上方） */
export const NODE_LABEL_H = 26;

/** 文本节点卡片自定义尺寸的限制（拖右下角调整时生效） */
export const TEXT_CARD_MIN = { w: 240, h: 160 };
export const TEXT_CARD_MAX = { w: 880, h: 880 };

/**
 * 图片 / 视频节点按「画幅比例」计算的卡片尺寸。
 *
 * 用户在参数里切换 16:9 / 9:16 / 1:1… 时，**卡片本身要跟着比例变**（对齐 LibTV），
 * 而不是卡片永远一个尺寸、只在生成时才按比例出图。
 *
 * 约定长边固定为 ASPECT_LONG_EDGE，短边按比例算；节点以左上角为锚点，所以
 * 切换比例只改宽高、不挪位置。文本/音频/脚本不设画幅比例，仍用 NODE_SIZE。
 */
export const ASPECT_LONG_EDGE = 300;

/** 把 "16:9" 解析成宽高比（非法值回退 16:9） */
function parseRatio(ratio: string): [number, number] {
  const m = /^\s*(\d+(?:\.\d+)?)\s*[:：xX]\s*(\d+(?:\.\d+)?)\s*$/.exec(ratio);
  if (!m) return [16, 9];
  const w = Number(m[1]);
  const h = Number(m[2]);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return [16, 9];
  return [w, h];
}

export function aspectCardSize(
  kind: NodeKind,
  ratio?: string,
): { w: number; h: number } {
  // 返回值统一是**卡片尺寸**（不含标签行与间距）。
  // 文本/音频/脚本不设画幅比例，卡片宽=NODE_SIZE.w，卡片高=总高-标签-间距。
  if (kind !== "image" && kind !== "video") {
    const s = NODE_SIZE[kind];
    return { w: s.w, h: s.h - NODE_LABEL_H - 6 };
  }

  const [rw, rh] = parseRatio(ratio ?? "16:9");
  let w: number;
  let h: number;
  if (rw >= rh) {
    w = ASPECT_LONG_EDGE;
    h = Math.round((ASPECT_LONG_EDGE * rh) / rw);
  } else {
    h = ASPECT_LONG_EDGE;
    w = Math.round((ASPECT_LONG_EDGE * rw) / rh);
  }
  return { w, h };
}

/**
 * 节点在画布上的总尺寸 = 卡片 + 标签行(NODE_LABEL_H) + 6px 间距。
 *
 * 图片/视频节点的卡片按画幅比例算，与 NODE_SIZE 里的写死值**不一致**，
 * 所以凡是要写 style / measured 的地方（新建、复制、切比例、刷新恢复、
 * 云端加载）都必须用这张表，否则 React Flow 按错误尺寸算连线锚点，
 * 连线端点会偏到卡片外面。
 *
 * custom：文本节点用户自定义卡片尺寸（data.size）。
 */
export function flowNodeSize(
  kind: NodeKind,
  ratio?: string,
  custom?: { w: number; h: number },
): { w: number; h: number } {
  const card = custom ?? aspectCardSize(kind, ratio);
  return { w: card.w, h: card.h + NODE_LABEL_H + 6 };
}
