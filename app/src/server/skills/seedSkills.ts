/* ------------------------------------------------------------------ */
/* 官方内置 Skill 种子（对齐 LibTV 分类）                                */
/* 每个 Skill 带可加载到画布的模板（nodes/edges）。                       */
/* ------------------------------------------------------------------ */

export interface SeedNode {
  kind: string;
  title: string;
  prompt: string;
  x: number;
  y: number;
  params?: Record<string, unknown>;
}

export interface SeedEdge {
  from: number; // seed node 序号
  to: number;
}

export interface SeedSkill {
  slug: string;
  name: string;
  category: string;
  outputKind: "video" | "image";
  summary: string;
  scenes: string;
  howTo: string;
  outputs: string;
  nodes: SeedNode[];
  edges: SeedEdge[];
}

/* 统一模板构造器：把种子节点描述转成画布节点 JSON（加载时再重映射 id） */
function buildTemplate(skill: SeedSkill): string {
  const nodes = skill.nodes.map((n, i) => ({
    _seedId: i,
    kind: n.kind,
    title: n.title,
    prompt: n.prompt,
    x: n.x,
    y: n.y,
    params: n.params ?? {},
  }));
  const edges = skill.edges.map((e) => ({ from: e.from, to: e.to }));
  return JSON.stringify({ nodes, edges });
}

export const SEED_SKILLS: SeedSkill[] = [
  {
    slug: "oriental-aesthetic-film",
    name: "东方巨构美学短剧",
    category: "drama",
    outputKind: "video",
    summary: "一站式生成东方巨构美学短剧",
    scenes: "东方美学短剧、国风电视剧",
    howTo: "一份剧本或一句话，可选人脸/造型参考图",
    outputs: "角色/道具/场景资产图、逐镜分镜表格、仙侠短剧视频成片",
    nodes: [
      { kind: "script", title: "剧本节点", prompt: "根据灵感创作三幕式东方奇幻短剧剧本，含分镜描述", x: 0, y: 220 },
      { kind: "image", title: "场景资产", prompt: "基于剧本生成东方巨构场景概念图，宏伟建筑与云海", x: 500, y: 0 },
      { kind: "image", title: "角色资产", prompt: "基于剧本生成主角角色设定图，国风服饰", x: 500, y: 440 },
      { kind: "video", title: "分镜成片", prompt: "按分镜结合场景与角色资产生成短剧视频", x: 1020, y: 220 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 0, to: 2 },
      { from: 1, to: 3 },
      { from: 2, to: 3 },
    ],
  },
  {
    slug: "a24-cinematic-aesthetic",
    name: "A24 电影美学",
    category: "film",
    outputKind: "video",
    summary: "高级怪诞电影美学，以作者视角，用粗粝真实的表皮包裹荒诞底色",
    scenes: "艺术短片、作者电影、电影节投递",
    howTo: "一句话主题或一段情境，可附氛围参考图",
    outputs: "电影感分镜图、粗粝质感短片",
    nodes: [
      { kind: "script", title: "文学剧本", prompt: "以 A24 风格创作带作者表达的文学短片剧本", x: 0, y: 140 },
      { kind: "image", title: "电影分镜", prompt: "生成自然光、粗粝质感的电影分镜画面", x: 500, y: 140 },
      { kind: "video", title: "成片", prompt: "结合分镜生成 A24 美学短片", x: 1000, y: 140 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    slug: "beauty-blogger-reviewer",
    name: "真人感美妆 UGC 测评",
    category: "ad",
    outputKind: "video",
    summary: "一键把美妆卖点变成可见证据与自然口播",
    scenes: "美妆带货、产品测评、信息流广告",
    howTo: "给出产品名与核心卖点，可上传产品图",
    outputs: "口播文案、真人感测评视频",
    nodes: [
      { kind: "text", title: "卖点拆解", prompt: "把产品卖点拆成可信的测评口播要点", x: 0, y: 140 },
      { kind: "script", title: "口播文案", prompt: "写自然口语的真人感测评口播", x: 500, y: 140 },
      { kind: "video", title: "测评视频", prompt: "生成真人博主对镜测评带货视频", x: 1000, y: 140 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    slug: "pop-music-video",
    name: "POP MV",
    category: "music",
    outputKind: "video",
    summary: "聚焦国际一线流行音乐 MV 创作体系，一句话自动完成 MV 创作",
    scenes: "流行单曲 MV、视觉专辑",
    howTo: "提供歌曲主题/歌词或一句情绪",
    outputs: "视觉概念、分镜画面、MV 成片",
    nodes: [
      { kind: "text", title: "视觉概念", prompt: "为流行歌曲提炼 MV 核心视觉概念", x: 0, y: 140 },
      { kind: "image", title: "关键画面", prompt: "生成时尚前卫的 MV 关键画面", x: 500, y: 140 },
      { kind: "video", title: "MV 成片", prompt: "生成节奏化的流行 MV 视频", x: 1000, y: 140 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    slug: "ecommerce-ugc-ad-planner",
    name: "北美电商出海 UGC",
    category: "social",
    outputKind: "video",
    summary: "为跨境电商策划 30 秒内的本地化 UGC 信息流带货视频",
    scenes: "跨境电商、信息流带货、本地化广告",
    howTo: "给出产品与目标人群/地区",
    outputs: "本地化脚本、UGC 带货视频",
    nodes: [
      { kind: "text", title: "人群洞察", prompt: "分析目标地区人群痛点与卖点匹配", x: 0, y: 140 },
      { kind: "script", title: "UGC 脚本", prompt: "写 30 秒本地化 UGC 带货脚本", x: 500, y: 140 },
      { kind: "video", title: "带货视频", prompt: "生成原生 UGC 风格带货视频", x: 1000, y: 140 },
    ],
    edges: [
      { from: 0, to: 1 },
      { from: 1, to: 2 },
    ],
  },
  {
    slug: "casting-director",
    name: "选角 Casting",
    category: "general",
    outputKind: "image",
    summary: "你的专属选角导演，一键为你挑选最合适的角色",
    scenes: "影视/广告选角、角色形象设计",
    howTo: "描述角色年龄/气质/外形",
    outputs: "多角度角色形象图",
    nodes: [
      { kind: "text", title: "角色描述", prompt: "细化角色的年龄、气质、外形特征", x: 0, y: 140 },
      { kind: "image", title: "角色定妆", prompt: "生成角色正面定妆照，真实人像", x: 500, y: 140 },
    ],
    edges: [{ from: 0, to: 1 }],
  },
];

/** 生成全部种子的模板 JSON（slug → template） */
export function seedTemplates(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of SEED_SKILLS) out[s.slug] = buildTemplate(s);
  return out;
}
