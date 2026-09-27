// 核心类型定义（M1 画布内核）

export type NodeKind = "text" | "image" | "video" | "audio" | "script";

export type RunStatus = "idle" | "queued" | "running" | "succeeded" | "failed";

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

export interface NodeOutput {
  kind: NodeKind;
  text?: string;
  urls?: string[];
  /** 结构化分镜（text/script 节点产出，故事板视图读取） */
  shots?: Shot[];
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

/** `@` 引用（节点 / 素材 / 模型） */
export interface NodeRef {
  /** 节点 id、素材 url 或模型名 */
  id: string;
  type: "node" | "asset" | "model";
  label: string;
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
