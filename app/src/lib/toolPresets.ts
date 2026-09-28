/* ------------------------------------------------------------------ */
/* 节点 Composer 工具预设（对齐 LibTV 工具条：特效 / 运镜）               */
/* 点击词条即插入提示词，纯文本助手；词条按节点种类分组。                 */
/* ------------------------------------------------------------------ */

export interface PresetGroup {
  key: string;
  label: string;
  items: string[];
}

/** 「特效」预设：image / video 节点用（text 节点给文案向修辞） */
export const EFFECT_PRESETS: Record<"text" | "image" | "video", PresetGroup[]> = {
  image: [
    {
      key: "light",
      label: "光影",
      items: ["电影级打光", "体积光", "霓虹光晕", "逆光剪影", "丁达尔效应", "赛博灯光"],
    },
    {
      key: "visual",
      label: "视觉特效",
      items: ["粒子飞散", "烟雾缭绕", "镜头光晕", "故障艺术", "动态模糊", "景深虚化", "胶片颗粒"],
    },
    {
      key: "style",
      label: "风格",
      items: ["电影感", "赛博朋克", "新中式", "皮克斯动画", "水彩手绘", "超现实主义"],
    },
  ],
  video: [
    {
      key: "motion",
      label: "动效",
      items: ["慢动作", "延时摄影", "定格瞬间", "希区柯克变焦", "子弹时间", "画面渐显"],
    },
    {
      key: "light",
      label: "光影",
      items: ["体积光扫过", "霓虹闪烁", "逆光轮廓", "火光映照", "闪电划破"],
    },
    {
      key: "visual",
      label: "视觉特效",
      items: ["粒子飞散", "烟雾弥漫", "雨滴飞溅", "镜头光晕", "故障闪烁", "雪花飘落"],
    },
  ],
  text: [
    {
      key: "rhetoric",
      label: "文案修辞",
      items: ["悬念开场", "金句收尾", "三段式排比", "口语化表达", "画面感描写", "情绪递进"],
    },
  ],
};

/** 「运镜」预设（视频节点专用）：点击插入提示词 */
export const CAMERA_PRESETS: PresetGroup[] = [
  {
    key: "basic",
    label: "基础运镜",
    items: ["缓慢推近", "匀速拉远", "水平横移", "垂直升降", "固定机位"],
  },
  {
    key: "advanced",
    label: "高级运镜",
    items: ["环绕主体", "跟拍移动", "手持晃动", "第一人称视角", "无人机俯冲", "穿越飞行"],
  },
  {
    key: "transition",
    label: "镜头衔接",
    items: ["淡入淡出", "甩镜转场", "匹配剪辑", "遮挡转场"],
  },
];
