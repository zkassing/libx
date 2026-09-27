# PRD：AI 教学工作流平台（类 LibTV 工作区 + 教学引导）

> 版本 v0.1 ｜ 状态：待评审 ｜ 调研方式：browser-use 实地操作 LibTV（liblib.tv）+ 官方文档
> 调研截图：`D:/Project/_shots/`

---

## 0. 一句话定义

一个**基于无限画布 + 节点工作流的 AI 内容生成平台**：老师把创作流程保存成"可执行工作流/课程"，学生在引导模式下**按步骤填空、逐步运行**，最终产出老师预期的 AI 资源（图/文/音/视频），并支持作业提交与评分。

---

## 1. 背景与目标

### 1.1 背景
- LiblibAI 的 **LibTV（liblib.tv）** 是"同时面向人类创作者与 Agent"的 AI 视频创作系统，核心是**无限画布 + 节点工作流**。
- 它已具备"保存工作流 → 学生打开 → 逐步执行"的雏形，但**缺少教学层**：没有分步引导、检查点校验、参数填空、进度追踪、作业与评分。
- 目标不是复刻视频工厂，而是**把工作流变成可教学、可考核的课程载体**。

### 1.2 目标
1. 老师低门槛把"我怎么做出这个作品"固化成可复用工作流。
2. 学生不需懂模型/提示词工程，只需按步骤填空、点运行，产出**老师指定的**资源。
3. 全流程可追踪：谁做到哪步、产出什么、得多少分。

### 1.3 非目标（v1 不做）
- 实时协同编辑；完整视频剪辑时间轴；模型训练；社区广场与商业分发。

---

## 2. LibTV 调研结论（实测 + 文档）

### 2.1 功能地图

| 模块 | 内容 | 来源 |
|---|---|---|
| 首页 | 作品广场(TV Show)、精选画布、分类(全网爆款/专业影视/短剧漫剧/商业广告/动漫游戏/教育生活)、TV工具箱、创作者挑战赛、会员/积分 | 实测 |
| 项目管理 | 项目库、新建/删除项目、重命名(双击画布名) | 文档 |
| 无限画布 | 一个画布=一个项目；网格吸附、缩放、小地图、整理画布 | 实测 |
| 节点 | 文本/图片/视频/音频/脚本/智能剪辑/导演台/逐帧拉片 | 实测 |
| 节点端口 | 左/右 handle，可从右侧拉线新建下游节点 | 实测 |
| 节点内生成 | 提示词编辑区 + 模型选择 + 生成按钮；结果落在节点内 | 实测 |
| 文本节点 LLM | 输出结构化 `{action, action_input, supplementary}` | **实测** |
| Agent 对话 | 绑定当前节点的 AI 助手；爆款题材预设、剧本设定器、剧本创编 | 实测 |
| 工作流 | 打组(Ctrl+G) → 创建工作流 → 打开工作流 → 发送到画布；整组执行 | 文档 |
| 左侧栏 | 添加节点 / 工作流 / 资产 / 历史记录 / 教程 | 实测 |
| 画布工具 | Slash 快捷：九宫格/剧情四宫格/25宫格分镜/角色三视图/角色设定图/故事板/调度故事板；图像工具(720°/多角度/打光/分镜组)；视频工具(高清/剪辑/合成/智能剪辑/逐帧拉片/续写/片段重拍/动捕)；音频工具；导演台(角色/摄像机运镜、Blender 插件) | 文档 |
| 分享 | 发布与分享；社区精选 | 文档 |
| Agent 接口 | LibTV Plugin / CLI / Skill（`liblib.tv/plugin`） | 文档 |
| 计费 | 积分制，生成扣积分（实测文本生成扣 6 分） | 实测 |

### 2.2 技术栈实测（关键）
- 画布：**React Flow**（`react-flow__viewport` / `react-flow__handle` / `react-flow__node-*`）
- UI：**Mantine** + **Tailwind**
- 形态：SPA，路由如 `/canvas?spaceId=..&projectId=..`

> 结论：**画布直接用 React Flow**，最大化复用生态与交互范式。

### 2.3 可复刻性评估

| 能力 | 难度 | 说明 |
|---|---|---|
| 无限画布 + 节点 + 连线 | ★★ | React Flow 直接支持 |
| 节点配置面板 + 生成参数 | ★★ | 常规表单 |
| 文生文 / 文生图 | ★★ | 接国内模型 API |
| 图生视频 / 文生视频 | ★★★★ | 长耗时、贵、异步任务 |
| 音频 / 智能剪辑 / 混流 | ★★★★ | 需 FFmpeg |
| 打组 / 保存工作流 / 整组执行 | ★★★ | 自研 DAG 引擎 |
| AutoLink 语义串联 | ★★★★ | 类型系统 + 规则/模型 |
| 导演台(运镜轨迹) | ★★★★★ | 3D/轨迹，v2 再考虑 |
| Agent 对话绑定节点 | ★★★ | LLM function-calling 操作节点 |
| **教学层（核心差异化）** | ★★★ | LibTV 没有 |

---

## 3. 产品定位与差异化

- **LibTV**：给专业创作者的"AI 视频车间"。
- **本产品**：给**教学场景**的"可执行课程"。工作流=课件，节点=步骤，变量=填空题，生成结果=作业。
- 差异化能力（全部需要）：分步引导、检查点校验、参数填空、进度追踪、评分与批改、提示词库。

---

## 4. 用户角色与场景

| 角色 | 目标 |
|---|---|
| 老师/课程作者 | 搭工作流 → 配教学说明 → 布置作业 → 批改 |
| 学生 | 打开课程 → 按步骤填空运行 → 产出 → 提交 |
| 管理员 | 用户/班级/模型额度管理 |

**一节课闭环**：老师搭节点链（主题变量→文本剧本→图片分镜→视频→音频→合成）→ 配步骤说明/变量/检查点 → 发布作业 → 学生在引导模式下逐步填空运行 → 检查点通过解锁 → 汇总产出提交 → 老师看板批改。

---

## 5. 功能需求

### 5.1 画布与节点（P0）
- 无限画布：平移/缩放/框选/小地图/网格吸附/整理布局。
- 节点类型（v1）：**文本、图片、视频、音频、脚本**（预留 合成/剪辑）。
- 节点：左/右端口、内容区、编辑区（提示词/参数/模型）、运行按钮、状态徽标（idle/排队/生成中%/成功/失败）。
- 连线：拖拽连接、类型校验、删除、插入。
- 从右端口拖出 → 弹出按类型过滤的下游节点菜单。
- 右键菜单：复制/删除/打组/创建工作流。
- 打组（`Ctrl/Cmd+G`）：整体拖动、整组执行。

### 5.2 节点能力定义

| 节点 | 输入 | 输出 | 国内模型 | 优先级 |
|---|---|---|---|---|
| 文本 | 提示词/变量 | 文本、结构化 action | 豆包/火山方舟、通义、DeepSeek | P0 |
| 图片 | 文本提示、参考图 | 图片 URL/多图 | 即梦(Seedream)、通义万相 | P0 |
| 视频 | 文本/首帧/尾帧 | 视频 URL | 可灵(Kling)、即梦(Seedance)、Vidu | P1 |
| 音频 | 文本/提示 | 音频 URL | 火山语音、MiniMax、通义 | P1 |
| 脚本 | 主题 | 分镜脚本(结构化) | 豆包/GVLM 类 | P1 |

- 统一生成适配层：`TextProvider / ImageProvider / VideoProvider / AudioProvider`，`submit(job)→jobId`、`poll(jobId)→status/result`。
- 节点输出带**类型标记 + 结构化 payload**（参考 LibTV 的 `{action, action_input, supplementary}`），供下游/AutoLink 消费。

### 5.3 工作流引擎（P0）
- 数据：`Workflow` = 节点 + 边 + 变量。
- **节点级运行**（教学分步）与**整组执行**（拓扑序，缓存命中则跳过）。
- **缓存**：输入哈希 → 复用输出，避免重复扣费。
- **状态机**：`idle → queued → running(progress) → succeeded | failed | canceled`。
- **实时**：SSE 优先推送进度。
- 失败重试、单节点重跑。
- 保存为工作流 / 打开工作流 / 发送到画布。

### 5.4 教学工作流层（P0，核心差异化）
节点教学元数据：
```ts
type NodeTeaching = {
  stepTitle: string;              // “第一步：确定主题与风格”
  instruction: string;            // Markdown 操作说明
  editable: 'locked' | 'student'; // 学生能否改提示词
  variables: VariableRef[];
  checkpoint?: { type: 'generated'|'type'|'constraint'|'manual'; rule?: string; message?: string };
  hints?: string[];               // 分层提示
  sampleOutput?: string;
};
```
工作流变量：
```ts
type Variable = {
  key: string; label: string; type: 'text'|'select'|'number'|'asset';
  default?: string; options?: string[]; required: boolean; source: 'teacher'|'student';
};
```
- 老师预设变量（主题/风格/时长/角色/比例），学生只需选/填。
- 提示词模板：锁定骨架，变量以 `{{主题}}` 注入。
- 检查点：不通过无法下一步；支持自动校验（产出存在/类型/参数）与人工确认。
- 引导模式 UI：步骤条 + 当前节点高亮 + 画布自动聚焦 + "上一步/下一步/运行本步"。
- 进度：保存每步状态，可中断续做。

### 5.5 提示词库/模板（P1）
老师维护模板库（提示词骨架 + 变量 + 适用模型 + 示例），学生一键套用。

### 5.6 班级与作业
- 班级：创建、邀请码/导入学生、成员管理（P0）。
- 作业：工作流绑定作业，设截止时间/要求/满分（P0）。
- 提交：产出图/视频/音频/文本 + 说明（P0）。
- 批改：打分 + 评语；学生互评（P2）。
- 看板：全班进度、完成率、平均分、卡点统计（P1）。

### 5.7 资产与历史（P0）
- 资产库：生成物按项目/类型归档，可拖入画布复用。
- 生成历史：输入/输出/成本可追溯、可重放。
- 本地素材上传。

### 5.8 计费与额度（P1）
积分/额度制，记录每节点成本；学生额度由老师/管理员分配，超限拦截。

---

## 6. 关键流程

### 6.1 老师：搭工作流 → 发布课程
1. 新建课程 → 进入画布。
2. 添加节点并连线（或导入已有工作流/模板）。
3. 选中节点 → 右侧属性面板：基础（提示词模板/模型/参数）+ 教学（步骤标题/说明/变量/检查点/提示）。
4. 框选全部 → 打组 → "创建工作流"。
5. "发布为作业"：选班级、截止时间、要求、分值。

### 6.2 学生：引导式完成
1. 进入课程 → 引导模式。
2. 每步：读说明 → 填变量 → "运行本步" → 看进度 → 检查点通过 → 解锁下一步。
3. 最后一步产出最终资源 → 预览 → 提交作业。

### 6.3 老师：批改
作业看板 → 逐学生看进度/产出/播放 → 打分 + 评语 → 可一键回退到某步重做。

---

## 7. 技术架构

### 7.1 技术栈
| 层 | 选型 | 理由 |
|---|---|---|
| 框架 | **Next.js 15 (App Router) + TypeScript** | 前后端一体、流式 |
| UI | **Tailwind + shadcn/ui**（可选 Mantine） | LibTV 同款范式 |
| 画布 | **React Flow `@xyflow/react`** | 实测 LibTV 使用，最贴合 |
| 画布状态 | **Zustand + Immer** | 节点/边/选中态 |
| 服务端状态 | **TanStack Query** | 缓存/轮询/失效 |
| 表单校验 | react-hook-form + zod | 属性面板、变量 |
| 认证 | **Auth.js (NextAuth)** | 多用户/班级 |
| 数据库 | **PostgreSQL + Prisma** | 关系型，适合课程/进度 |
| 队列 | **BullMQ + Redis**（简化可用 pg-boss） | 长任务生成 |
| 实时 | **SSE**（首选）/ WebSocket | 进度推送 |
| 存储 | **S3 / 阿里云 OSS / MinIO** | 图/视频/音频 |
| 媒体 | **FFmpeg**（worker 内） | 合成/转码/抽帧 |
| 部署 | Docker + 自建 Node / Vercel | — |

### 7.2 生成适配层
```ts
interface GenProvider<In, Out> {
  name: string; kind: 'text' | 'image' | 'video' | 'audio';
  costEstimate(input: In): number;
  submit(input: In, ctx: JobCtx): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<{ status: JobStatus; progress?: number; result?: Out; error?: string }>;
}
```
国内实现：**火山方舟/豆包(文本/图)**、**即梦 Seedream/Seedance(图/视频)**、**可灵 Kling(视频)**、**通义万相/百炼(图/视频)**、**火山/MiniMax(音频)**。统一 job 记入 `NodeRun`，worker 异步执行，前端订阅进度。

### 7.3 运行时数据流
```
Canvas(学生操作) → API(tRPC/Route) → 创建 NodeRun
      ↓                                   ↓
   SSE 订阅  ←──── Worker(队列) ──→ Provider.submit/poll
      ↓                                   ↓
  节点实时状态/进度                  结果落库 + 上传 OSS
```

---

## 8. 数据模型（Prisma 草案）

```prisma
model User { id String @id @default(cuid()) name String email String @unique role Role @default(STUDENT) credit Int @default(0) }

model Classroom { id String @id @default(cuid()) name String ownerId String members Enrollment[] assignments Assignment[] }

model Enrollment { classroomId String userId String role Role @@id([classroomId,userId]) }

model Workflow { id String @id @default(cuid()) ownerId String title String published Boolean @default(false) nodes Node[] edges Edge[] variables Variable[] createdAt DateTime @default(now()) }

model Node { id String @id @default(cuid()) workflowId String type NodeType position Json config Json teaching Json? outgoing Edge[] @relation("src") incoming Edge[] @relation("dst") }

model Edge { id String @id @default(cuid()) workflowId String sourceId String targetId String sourceHandle String? targetHandle String? }

model Variable { id String @id @default(cuid()) workflowId String key String label String type String default String? options Json? source String }

model Assignment { id String @id @default(cuid()) classroomId String workflowId String title String dueAt DateTime? maxScore Int @default(100) submissions Submission[] }

model Run { id String @id @default(cuid()) workflowId String userId String mode RunMode @default(STUDENT) status RunStatus @default(IDLE) nodeRuns NodeRun[] createdAt DateTime @default(now()) }

model NodeRun { id String @id @default(cuid()) runId String nodeId String status RunStatus progress Int @default(0) input Json? output Json? providerJobId String? cost Int @default(0) error String? startedAt DateTime? finishedAt DateTime? }

model Asset { id String @id @default(cuid()) ownerId String type AssetType url String thumbUrl String? meta Json createdAt DateTime @default(now()) }

model Progress { id String @id @default(cuid()) userId String assignmentId String currentNodeId String? completedNodeIds Json status ProgressStatus updatedAt DateTime @updatedAt }

model Submission { id String @id @default(cuid()) assignmentId String userId String assets Json remark String? grade Int? feedback String? submittedAt DateTime @default(now()) }

model PromptTemplate { id String @id @default(cuid()) ownerId String title String body String variables Json tags String[] }
```

---

## 9. API 设计（草案）

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/workflows` | 新建工作流 |
| GET | `/api/workflows/:id` | 获取工作流（节点/边/变量） |
| PATCH | `/api/workflows/:id` | 保存画布 |
| POST | `/api/workflows/:id/run` | 整组执行 |
| POST | `/api/nodes/:id/run` | 单节点运行（教学分步） |
| GET | `/api/runs/:id/events` | **SSE** 进度流 |
| POST | `/api/assets/upload` | 上传/预签名 |
| GET | `/api/assets` | 资产列表 |
| POST | `/api/assignments` | 布置作业 |
| GET | `/api/assignments/:id/progress` | 全班进度（老师） |
| POST | `/api/submissions` | 提交作业 |
| PATCH | `/api/submissions/:id/grade` | 打分/评语 |
| GET | `/api/prompt-templates` | 提示词库 |

---

## 10. 教学编排规范（老师只需回答 4 个问题）

1. **这一步产出什么？**（步骤标题 + 说明）
2. **哪些让学生填？**（勾选变量）
3. **怎样算合格？**（检查点规则）
4. **卡住给什么提示？**（hints）

学生端永远只看到：`说明 + 填空 + 运行按钮 + 结果`。

---

## 11. 里程碑计划

| 阶段 | 内容 | 产出 |
|---|---|---|
| **M0** | 调研 + PRD（当前） | 本文件 + 截图 |
| **M1 画布内核** | Next.js 工程 + React Flow 无限画布 + 5 节点 + 连线 + 属性面板 + Mock 运行 | 可拖拽搭图、假生成 |
| **M2 生成接入** | Provider 适配层 + 文本/图片生成 + 队列 + SSE + 资产库 | 真实产出图/文 |
| **M3 工作流** | 打组/保存工作流/打开工作流/整组执行/缓存 | 可复用工作流 |
| **M4 教学层** | 变量填空/分步引导/检查点/进度 | 学生可跟做 |
| **M5 班级作业** | 多用户/班级/布置/提交/评分/看板 | 教学闭环 |
| **M6 视频音频** | 视频/音频节点 + 合成(FFmpeg) | 完整成片 |

建议 **M1–M4 作为第一个可演示版本**。

---

## 12. 风险与开放问题

### 12.1 风险
- **成本**：视频生成贵且慢 → 缓存 + 额度控制 + 降级为图片。
- **长任务**：需队列、超时、重试、取消。
- **内容安全**：接入方需审核/敏感词。
- **版权**：生成物归属与教学使用边界。
- **学生易用性**：引导模式必须"傻瓜化"。
- **Provider 稳定性**：多家兜底、统一错误码。

### 12.2 待确认
1. **火山方舟/即梦/可灵的 API Key 是否已有？**
2. 第一版是否需要**视频节点**？（建议放 M6）
3. 课程粒度：一个工作流 = 一节课，还是一个单元含多节课？
4. 是否允许学生**改编工作流**（进阶模式），还是只填空？
5. 检查点以**自动校验**还是**人工确认**为主？
6. 部署形态：校内自建 / 云 / 单机演示？
7. 是否只需要中文？

---

## 附录 A：LibTV 实测证据
- 截图：`D:/Project/_shots/libtv_*.png`
- 画布 URL：`https://www.liblib.tv/canvas?spaceId=...&projectId=...`
- 官方指南：`https://resonate.feishu.cn/wiki/Loxfw6XHziYRk0kKzdjcFfp9nhb`
- Plugin/CLI/Skill：`https://www.liblib.tv/plugin`

## 附录 B：本地浏览器调试环境（调研用）
- Windows Edge CDP：`--remote-debugging-port=9222 --user-data-dir=C:\edge-cdp-profile`
- WSL→Windows 转发器：`C:\Users\kassi\.pi\agent\edge-cdp-forward.js`（9223→9222）
- 用法：`BU_CDP_URL=http://172.31.96.1:9223 browser-use <<'PY' ... PY`
- 停止：关闭 Edge 窗口；结束 node 转发器进程

---

## 13. 调研补充（第二轮实测）

### 13.1 添加节点菜单（实测）
底部工具栏「**添加节点**」/ 双击画布 → 弹出菜单：
`文本 | 图片 | 视频 | 智能剪辑(Beta) | 导演台(NEW) | 逐帧拉片(SD2.5) | 音频 | 脚本 | 素材库(添加资源 / 上传 / 从生成历史选择)`

### 13.2 视频节点参数面板（实测，v1 直接对标）
- 工具行：`+参考`（参考图）· `标记` · `特效` · `角色库` · `运镜`
- 输入框：`描述你想要生成的画面内容，@引用素材`
- 参数行：**模型**（实测默认 `Wan 2.0`，可切换）· **模式**（`文生视频`，可切图生视频/首尾帧）· **比例** `16:9` · **分辨率** `720P` · **时长** `5s` · **数量** `1个` · 字数计数 → 发送
- 节点底部还有待确认卡片：`待确认生成`
- 高级设置弹层：`高级设置 · 联网搜索 · 自动校验素材 · 智能引用 AutoLink`

**→ v1 视频节点字段清单**：`referenceImages[] / prompt / model / mode(文生/图生/首尾帧) / aspectRatio / resolution / duration / count / autoLink`

### 13.3 节点输出契约（实测）
文本节点 LLM 输出结构化 action，下游/工作流据此驱动：
```json
{ "action": "text_to_image",
  "action_input": "<完整画面提示词>",
  "supplementary": { "style": "电影级科幻插画/赛博朋克", "aspect_ratio": "16:9" } }
```
**→ 我们的引擎要点**：每个节点产出 `{type, payload, action?}`；变量与上游输出以 `{{var}}`/`@引用` 注入。

### 13.4 故事板视图（实测，重要教学功能）
顶部「**故事板**」= 生成确认台，按类型分列：
- 左列 **文本**：文本节点清单
- 中列 **图片 / 视频**：每个节点的产出卡片（状态 `待确认生成`、模型标识）
- 顶部筛选 `全部`
**→ 教学用途**：学生生成后在此**确认产出**；老师可在此**审核**；天然可作为"作业产出汇总页"。

### 13.5 顶部导航（实测）
`画布 N ▾ ｜ 工作流 ｜ 故事板 ｜ 发布与分享 ｜ 积分超市 ｜ 积分` —— 说明「画布 / 工作流 / 故事板」是三种视图；「工作流」视图用于管理已保存工作流（对应文档的"打开工作流→发送到画布"）。

### 13.6 计费实测
文本节点一次生成 **扣 6 积分**（100 → 94）。**→ 我们的额度模型按节点类型计费，Mock 期不扣费。**

### 13.7 结论：v1 范围（据你的选择调整）
| 决策 | 你的选择 | 对 PRD 的影响 |
|---|---|---|
| 模型 Key | 暂无 → **先用 Mock** | M1/M2 用 MockProvider，真实 Provider 后置；先跑通教学闭环 |
| 视频节点 | **v1 就要图生视频** | 视频节点从 P1 提到 **P0**；M2 起就定义视频节点与异步任务，先 Mock 后接真实 |
| 学生权限 | **基础 + 进阶双模式** | 工作流需支持 `mode: basic | advanced`；进阶模式解锁节点编辑/新增 |

> 调整后里程碑：**M1 画布内核 → M2 节点生成(Mock：文本/图片/图生视频) → M3 工作流引擎 → M4 教学层(双模式) → M5 班级作业 → M6 接真实模型**。

---

## 14. 调研补充（第三轮实测，登录后）

### 14.1 发布与分享（实测）
点击画布右上「发布与分享」弹出两项：
| 选项 | 说明 |
|---|---|
| **在LibTV上发布** | 发布你的作品和创作过程，让更多创作者看到 |
| **分享链接** | **拥有此链接的人可以查看并复制你的画布** |

**→ 分发机制定论**：我们采用同样范式——老师生成**分享链接**，学生点开得到**一份工作流副本**，然后在引导模式下跟做。

### 14.2 Skill 系统（重大发现）
Agent 面板 →「**选择Skill开始创作**」打开 Skill 目录：
- 分类 Tab：`创建 | 全部 | 通用 | 收藏 | 我的`
- 每个 Skill = **命名 + slug + 描述 + 详情**，即"打包好的完整工作流"
- 通过 **`/` 调用**（如 `/pixar-animated-ad-creator`），与官方文档的"Slash 快捷功能"对应
- 示例 Skill：皮克斯动画广告、爆款拉片复刻、新中式美学TVC、古典武侠电影全流程导演、游戏实机PV、精品女频短剧一键成片、是枝裕和电影美学、韦斯安德森电影美学、剧情TVC广告片、伊斯特伍德西部片、汽车TVC、旅拍大师、狼人吸血鬼短剧、无厘头喜剧……

**→ 对 PRD 的关键影响**：
- 我们的"教学工作流/课程" = **Skill**：有名称、slug、描述、封面、分类、作者。
- 老师可✅**创建**自己的 Skill；学生可浏览目录 / 收藏 / `/` 调用。
- 数据模型需给 `Workflow` 增加：`slug, description, cover, category, tags, visibility(public/class/private), forkedFrom`。

### 14.3 Agent 对话面板（实测）
- 快捷入口：`选择Skill开始创作` · `从爆款预设开始剧本原创` · `上传故事来改编` · `批量创建分镜`
- 输入框提示：**"开始你的创作，或者 @ 引用工作流/节点/资源"** → 支持 **`@` 引用工作流/节点/资源**
- 模式选择：`全能创作`
- Agent 名称：**TV Director**
**→ 启示**：我们的引导模式可复用"@引用 + /调用"两种快捷交互。

### 14.4 项目管理（实测）
- 路径 `/project`：`全部项目 / 回收站 / 新建文件夹 / 搜索 / 开始创作`
- 左侧主导航：`新建项目 / LibTV Agent / LibTV 3D-BOX / 首页 / 项目 / 资产 / 插件与扩展 / 社区(TV Show, 创作者挑战赛)`

### 14.5 对 v1 功能的增补
在 §5 基础上新增三条 P0：
1. **教学模板库（Skill 目录）**：列表 + 分类 + 详情 + 收藏 + `/` 调用。
2. **分享链接（可复制画布）**：老师一键生成链接，学生获得副本。
3. **@ 引用工作流 / 节点 / 资源**：在 Agent 输入框与提示词中可用。

> 结论：LibTV 的"Skill + 分享链接 + 故事板确认台"三者，正好对应我们的"**课程模板 + 分发 + 作业产出**"，
> 我们只需在上面补 **引导 / 检查点 / 进度 / 评分** 四件它没有的事。

---

## 15. 调研补充（第四轮：打组 / 保存工作流 / 模型清单）

### 15.1 打组工具条（实测）
框选节点 `Ctrl/Cmd+G` 打组后，组上方出现工具条：
| 按钮 | 作用 |
|---|---|
| **整组执行** | 一键重跑整组（按依赖自动执行） |
| **添加到工具箱** | **= 保存工作流**（文档旧称"创建工作流"） |
| **转分镜组** | 把组转为「分镜组」→ 与"故事板"联动 |
| **解组** | 取消分组 |
| `···` | 更多（未展开） |

### 15.2 保存工作流 = 「添加到工具箱」（实测弹窗字段）
- Tab：`创建新工具箱` / `更新工具箱`
- 字段：`封面`（+ 更换封面）· `名称` · `标签`（最多 5 个，`添加标签`）· `备注`（占位：*请描述您的工具箱，例如应用场景、使用步骤及使用技巧*）
- 动作：`创建`

**→ 我们的对应**：工作流元数据 = `cover, name, tags[≤5], description`；已有工作流可"更新"。

### 15.3 Agent `@` 引用（实测）
在 Agent 输入框输入 `@`，弹出可引用项，分类包括：
- **节点**：`Group 1 / 视频节点 2 / 视频节点 1`
- **模型**：见下
**→ 我们的对应**：变量注入与引用体系，支持 `@节点 / @工作流 / @资源`。

### 15.4 可用模型清单（实测 `@` 菜单）
| 类型 | 模型（实测可见） |
|---|---|
| 图像 | `Lib Image 2.5 Pro` · `Lib Image 2.5 Fast` · `Lib Image` · `General image Pro` · `General image V2` · `Seedream 5.0 Pro` · `Style Image V8.2 / V8.1 / V7` |
| 视频 | `Seedance 2.5` · `Seedance 2.0 VIP` · `Seedance 2.0 Fast VIP` · `Wan 3.0` · `Wan 3.0 Prime` · `Minimax H3` · `Kling O3` · `Kling 3.0` |

**→ 我们的对应**：Provider 适配层首批候选 = `即梦 Seedream（图）`、`可灵 Kling / 即梦 Seedance / 通义 Wan（视频）`、`豆包/火山方舟（文本）`；
节点参数面板的"模型选择器"直接照此设计（**图/视频/文本各一组，带快慢档**）。

### 15.5 本轮结论
LibTV 的"工作流"落地为 **工具箱（Toolbox）**：**打组 → 添加到工具箱(名称/封面/标签/备注) → 复用/更新**，并可 **转分镜组**接入故事板。
教学场景下，我们的映射为：**工具箱 = 课程模板**；标签 = 学科/难度；备注 = 教学说明；更新 = 老师迭代课件。
