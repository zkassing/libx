import type { NodeKind, NodeParams } from "@/types";

export interface NodeMeta {
  label: string;
  /** lucide-react 图标名 */
  icon: "Type" | "Image" | "Video" | "Music" | "ScrollText";
  /** 强调色（标签、选中态、占位产物） */
  accent: string;
  defaults: NodeParams;
  /** 模型下拉选项（对齐 LibTV 实测清单，M6 接真实模型） */
  models: string[];
  /** 生成模式选项（LibTV 的 文生/图生/首尾帧） */
  modes?: string[];
  /** 空节点时展示的 "尝试" 建议 */
  suggestions?: string[];
  /** 节点底部工具条上的工具（LibTV: 参考/标记/特效/角色库/运镜） */
  tools?: string[];
  outputLabel: string;
  placeholder: string;
}

export const NODE_META: Record<NodeKind, NodeMeta> = {
  text: {
    label: "文本",
    icon: "Type",
    accent: "#8b5cf6",
    defaults: { model: "Doubao Seed 2.1 Pro" },
    models: ["Doubao Seed 2.1 Pro", "DeepSeek V4 Pro", "GLM 5.2"],
    // 对齐 LibTV 实测的文本节点「尝试」建议
    suggestions: ["自己编写内容", "文生视频", "图片反推提示词", "文字生音乐"],
    // 文本节点工具条只保留 参考/标记
    tools: ["参考", "标记"],
    outputLabel: "文本",
    placeholder: "写下你想讲的故事、场景或角色设定，@引用素材",
  },
  image: {
    label: "图片",
    icon: "Image",
    accent: "#2bd67b",
    defaults: {
      model: "Seedream 5.0 Pro",
      mode: "文生图",
      aspectRatio: "16:9",
      resolution: "2K",
      quality: "标准画质",
      background: "自动",
      count: 1,
    },
    models: ["Seedream 5.0 Pro", "Seedream 4.0"],
    modes: ["文生图", "图生图", "参考图"],
    // 对齐 LibTV 实测：图片节点空态「尝试」是动作入口
    suggestions: ["图生图", "图片高清"],
    // 对齐 LibTV 实测：图片节点工具条 = 参考/标记/风格
    tools: ["参考", "标记", "风格"],
    outputLabel: "图片",
    placeholder: "描述你想生成的画面内容，@引用素材",
  },
  video: {
    label: "视频",
    icon: "Video",
    accent: "#1677ff",
    defaults: {
      model: "Seedance 1.0 Pro Fast",
      mode: "文生视频",
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      count: 1,
    },
    models: ["Seedance 1.0 Pro Fast"],
    modes: ["文生视频", "图生视频", "首尾帧"],
    suggestions: ["5 分钟超长视频", "首尾帧生成视频", "首帧生成视频"],
    tools: ["参考", "标记", "特效", "角色库", "运镜"],
    outputLabel: "视频",
    placeholder: "描述你想要生成的画面内容，@引用素材",
  },
  audio: {
    label: "音频",
    icon: "Music",
    accent: "#06b6d4",
    defaults: { model: "火山语音", mode: "语音合成", duration: 10, count: 1 },
    models: ["火山语音", "MiniMax Audio", "通义音频"],
    modes: ["语音合成", "配乐", "音效"],
    suggestions: ["旁白配音", "背景音乐", "环境音效"],
    tools: ["参考", "标记", "角色库"],
    outputLabel: "音频",
    placeholder: "描述你想生成的音频 / 配乐，@引用素材",
  },
  script: {
    label: "脚本",
    icon: "ScrollText",
    accent: "#ec4899",
    defaults: { model: "Doubao Seed 2.1 Pro", mode: "分镜表" },
    models: ["Doubao Seed 2.1 Pro", "DeepSeek V4 Pro"],
    modes: ["分镜表", "口播稿", "小说体"],
    suggestions: ["生成分镜表", "生成口播稿", "改编成剧本"],
    outputLabel: "分镜脚本",
    placeholder: "描述主题，生成分镜脚本…",
  },
};

export const NODE_KINDS = Object.keys(NODE_META) as NodeKind[];

/**
 * 节点显示名：默认名（=kind 的中文名）带序号「文本节点 3」；
 * 用户自定义过名字后不再拼序号（「主角特写」而不是「主角特写 3」）。
 */
export function displayNodeTitle(data: {
  kind: NodeKind;
  title?: string;
  index?: number;
}): string {
  const t = data.title ?? "";
  const isDefault = t === NODE_META[data.kind]?.label;
  return isDefault && data.index ? `${t} ${data.index}` : t;
}

/* 对齐 LibTV 实测：13 种比例（带图标宫格选择） */
export const ASPECT_RATIOS = [
  "1:1", "1:2", "2:1", "9:16", "16:9",
  "3:4", "4:3", "3:2", "2:3", "5:4",
  "4:5", "21:9", "9:21",
];
export const RESOLUTIONS = ["480P", "720P", "1080P"];
/** 图片清晰度（LibTV 参数弹层） */
export const IMAGE_RESOLUTIONS = ["1K", "2K", "4K"];
/** 画质档位（LibTV 参数弹层） */
export const IMAGE_QUALITIES = ["低画质", "标准画质", "高画质", "超高画质", "极致画质"];
/** 背景处理（LibTV 参数弹层） */
export const IMAGE_BACKGROUNDS = ["自动", "保留背景", "透明背景"];
export const DURATIONS = [3, 5, 10, 15];

/* Seedance 1.0 实际支持的档位（UI 只给这些，provider 再 clamp 兼底老数据） */
export const VIDEO_ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"];
export const VIDEO_DURATIONS = [5, 10];
export const VIDEO_MAX_COUNT = 4;
