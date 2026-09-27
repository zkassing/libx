import type {
  Shot,
  ShotFraming,
} from "@/types";

/* ------------------------------------------------------------------ */
/* Mock 分镜生成（P1）                                                    */
/* 根据创作主题产出一组结构化镜头。纯函数，便于单测。                        */
/* M6 接真实模型时由剧本模型产出同结构，上层无感。                         */
/* ------------------------------------------------------------------ */

/** 景别模板（按镜头循环） */
const FRAMINGS: ShotFraming[] = ["远景", "全景", "中景", "近景", "特写"];

/** 运镜模板（与景别搭配） */
const CAMERAS: Record<ShotFraming, string> = {
  远景: "航拍前推",
  全景: "缓慢横移",
  中景: "环绕跟拍",
  近景: "手持轻晃",
  特写: "缓推特写",
};

/** 从提示词里提取一个简短主题（取首行、去前缀、限长） */
export function extractTopic(prompt: string): string {
  const line = prompt
    .split("\n")
    .map((l) => l.replace(/^创作灵感：/, "").trim())
    .find((l) => l.length > 0) ?? prompt;
  return line.length > 24 ? `${line.slice(0, 24)}…` : line;
}

/**
 * 生成默认 5 个镜头（可指定数量，2–8）。
 * 镜头内容围绕主题 + 常见叙事节奏铺陈。
 */
export function buildMockShots(
  prompt: string,
  count = 5,
): Shot[] {
  const n = Math.min(8, Math.max(2, count));
  const topic = extractTopic(prompt);

  // 叙事节奏：交代 → 展开 → 发展 → 高潮 → 收束
  const beats = [
    `交代「${topic}」的环境与氛围`,
    `主角登场，呈现场景中的关键人物`,
    `冲突或关键动作开始推进`,
    `情绪与动作达到高潮`,
    `结果揭晓，画面回归平静`,
    `尾声留白，呼应开头`,
  ];

  const dialogues = [
    "",
    "（旁白）故事，就从这里开始。",
    "你来了。",
    "这一次，绝不会退缩。",
    "原来……一直都在。",
    "（音乐渐起）",
  ];

  const shots: Shot[] = [];
  for (let i = 0; i < n; i++) {
    const framing = FRAMINGS[i % FRAMINGS.length];
    shots.push({
      id: `shot-${i + 1}`,
      index: i + 1,
      scene: beats[i % beats.length],
      dialogue: dialogues[i % dialogues.length],
      framing,
      camera: CAMERAS[framing],
      duration: i === 3 ? 6 : 5,
      confirmed: false,
    });
  }
  return shots;
}

/** 可读的剧本文本（shots → 文本，填 output.text） */
export function shotsToText(shots: Shot[]): string {
  const lines = shots.map((s) => {
    const head = `镜头 ${s.index}｜${s.framing}｜${s.camera}｜${s.duration}s`;
    const body = `画面：${s.scene}`;
    const dl = s.dialogue ? `台词：${s.dialogue}` : "";
    return [head, body, dl].filter(Boolean).join("\n");
  });
  return lines.join("\n\n");
}
