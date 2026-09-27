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
    defaults: { model: "GVLM 3.1" },
    models: ["GVLM 3.1", "Doubao Seed Evolving", "DeepSeek V3"],
    suggestions: ["写一段视频脚本", "提取画面提示词", "结构化输出 JSON"],
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
      count: 1,
    },
    models: [
      "Seedream 5.0 Pro",
      "Lib Image 2.5 Pro",
      "General image Pro",
      "Style Image V8.2",
    ],
    modes: ["文生图", "图生图", "参考图"],
    suggestions: ["电影级光影", "写实人物特写", "概念场景设定"],
    tools: ["参考", "标记", "特效", "角色库"],
    outputLabel: "图片",
    placeholder: "描述你想生成的画面内容，@引用素材",
  },
  video: {
    label: "视频",
    icon: "Video",
    accent: "#1677ff",
    defaults: {
      model: "Wan 2.0",
      mode: "文生视频",
      aspectRatio: "16:9",
      resolution: "720P",
      duration: 5,
      count: 1,
    },
    models: ["Wan 2.0", "Wan 3.0 Prime", "Seedance 2.5", "Kling O3", "Minimax H3"],
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
    defaults: { model: "GVLM 3.1", mode: "分镜表" },
    models: ["GVLM 3.1", "Doubao Seed Evolving"],
    modes: ["分镜表", "口播稿", "小说体"],
    suggestions: ["生成分镜表", "生成口播稿", "改编成剧本"],
    outputLabel: "分镜脚本",
    placeholder: "描述主题，生成分镜脚本…",
  },
};

export const NODE_KINDS = Object.keys(NODE_META) as NodeKind[];

export const ASPECT_RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
export const RESOLUTIONS = ["480P", "720P", "1080P"];
export const DURATIONS = [3, 5, 10, 15];
