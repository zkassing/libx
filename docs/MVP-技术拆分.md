# MVP 技术拆分（M1–M4）

> 配套文档：`PRD-教学工作流平台.md`
> 目标：把 PRD 转成**可开工的工程规格**——目录、页面、组件、状态、接口、数据表、任务拆分。
> 交付定义：能演示"老师搭工作流 → 生成课程链接 → 学生引导式填空运行 → 产出 → 提交"。

---

## 1. MVP 范围

### 1.1 做（M1–M4）
| # | 能力 | 说明 |
|---|---|---|
| 1 | **无限画布** | React Flow：平移/缩放/框选/小地图/网格吸附 |
| 2 | **5 类节点** | 文本 / 图片 / 视频 / 音频 / 脚本 |
| 3 | **连线 + 端口** | 拖拽连接、类型校验、删除 |
| 4 | **节点属性面板** | 提示词模板、模型、参数（比例/分辨率/时长/数量） |
| 5 | **Mock 运行** | 文本/图片/图生视频，异步 + SSE 进度，**不扣费** |
| 6 | **工作流** | 打组(Ctrl+G)、保存(工具箱)、打开/发送到画布、整组执行、缓存 |
| 7 | **教学层** | 变量填空、分步引导、检查点、进度 |
| 8 | **账号与课程** | 登录、课程(工作流)、分享链接生成副本、学生进度 |

### 1.2 不做（后置）
真实模型接入（M6）、视频合成/FFmpeg、班级评分看板（M5）、多人协同、社区广场、导演台/运镜。

---

## 2. 技术选型（确认）

| 层 | 选型 | 备注 |
|---|---|---|
| 框架 | Next.js 15 App Router + TypeScript | RSC + Route Handlers |
| UI | Tailwind CSS + shadcn/ui | 深色主题对齐 LibTV 观感 |
| 画布 | `@xyflow/react` (React Flow) | 实测 LibTV 同款 |
| 画布状态 | Zustand + Immer | 节点/边/选中/视口 |
| 服务端状态 | TanStack Query | 轮询/失效 |
| 表单 | react-hook-form + zod | 属性面板、变量、登录 |
| 认证 | Auth.js (NextAuth) Credentials | MVP 用邮箱+密码 |
| DB | PostgreSQL + Prisma | 本地 Docker |
| 队列 | 进程内队列（MVP）→ BullMQ | 先简单，后换 Redis |
| 实时 | SSE（`/api/runs/:id/events`） | 进度推送 |
| 存储 | 本地 `public/uploads`（MVP）→ S3/OSS | 抽 `StorageAdapter` |
| 包管理 | pnpm | — |

---

## 3. 目录结构

```
D:/Project/app/                      # Next.js 工程根
├─ prisma/schema.prisma
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login/page.tsx
│  │  ├─ (app)/
│  │  │  ├─ layout.tsx               # 侧边导航（首页/项目/课程/资产）
│  │  │  ├─ dashboard/page.tsx
│  │  │  ├─ projects/page.tsx
│  │  │  ├─ courses/page.tsx         # 课程/模板列表
│  │  │  ├─ courses/[id]/page.tsx    # 老师：课程概览
│  │  │  ├─ canvas/[workflowId]/page.tsx    # 老师：编辑器
│  │  │  └─ learn/[assignmentId]/page.tsx   # 学生：引导模式
│  │  ├─ share/[token]/page.tsx      # 分享链接 → 复制副本
│  │  └─ api/
│  │     ├─ auth/[...nextauth]/route.ts
│  │     ├─ workflows/route.ts
│  │     ├─ workflows/[id]/route.ts
│  │     ├─ workflows/[id]/run/route.ts
│  │     ├─ nodes/[id]/run/route.ts
│  │     ├─ runs/[id]/events/route.ts   # SSE
│  │     ├─ assignments/route.ts
│  │     ├─ submissions/route.ts
│  │     ├─ assets/route.ts
│  │     └─ share/[token]/route.ts
│  ├─ components/
│  │  ├─ canvas/
│  │  │  ├─ WorkflowCanvas.tsx       # <ReactFlow> 容器
│  │  │  ├─ CanvasToolbar.tsx        # 添加节点/缩放/小地图/整理
│  │  │  ├─ NodePalette.tsx          # 添加节点菜单
│  │  │  ├─ edges/DeletableEdge.tsx
│  │  │  └─ nodes/
│  │  │     ├─ BaseNode.tsx          # 通用外壳（标题/端口/状态）
│  │  │     ├─ TextNode.tsx
│  │  │     ├─ ImageNode.tsx
│  │  │     ├─ VideoNode.tsx
│  │  │     ├─ AudioNode.tsx
│  │  │     └─ ScriptNode.tsx
│  │  ├─ inspector/
│  │  │  ├─ NodeInspector.tsx        # 右侧属性面板（基础+教学）
│  │  │  ├─ ModelSelect.tsx
│  │  │  └─ ParamsForm.tsx
│  │  ├─ teaching/
│  │  │  ├─ StepList.tsx             # 步骤条
│  │  │  ├─ StepPanel.tsx            # 说明+变量+运行
│  │  │  ├─ CheckpointBadge.tsx
│  │  │  └─ ProgressBar.tsx
│  │  ├─ workflow/
│  │  │  ├─ GroupToolbar.tsx         # 整组执行/保存/解组
│  │  │  ├─ SaveToolboxDialog.tsx
│  │  │  └─ OpenWorkflowPanel.tsx
│  │  └─ ui/                         # shadcn 组件
│  ├─ stores/
│  │  ├─ canvasStore.ts              # nodes/edges/selection/viewport
│  │  └─ runStore.ts                 # 节点运行状态（SSE 合并）
│  ├─ server/
│  │  ├─ db.ts                       # Prisma client
│  │  ├─ auth.ts                     # Auth.js 配置
│  │  ├─ workflow/
│  │  │  ├─ graph.ts                 # 拓扑排序/依赖解析/缓存键
│  │  │  ├─ runner.ts                # 节点/整组执行编排
│  │  │  ├─ cache.ts
│  │  │  └─ events.ts                # 事件总线（SSE）
│  │  ├─ providers/
│  │  │  ├─ types.ts                 # GenProvider 接口
│  │  │  ├─ mock.ts                  # MockProvider
│  │  │  └─ registry.ts
│  │  ├─ teaching/
│  │  │  ├─ variables.ts             # {{var}} 渲染
│  │  │  ├─ checkpoints.ts           # 检查点校验
│  │  │  └─ progress.ts
│  │  └─ storage.ts                  # 本地/S3 适配
│  ├─ lib/
│  │  ├─ nodeTypes.ts                # 节点类型注册表 + 默认配置
│  │  ├─ schema.ts                   # zod：node config / teaching
│  │  └─ utils.ts
│  └─ types/
│     └─ index.ts
├─ public/uploads/                   # MVP 本地产物
└─ docs/
```

---

## 4. 数据模型（MVP 精简）

```prisma
// 用户与课程
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  name      String
  password  String                  // bcrypt
  role      Role     @default(STUDENT)
  credit    Int      @default(1000)
  workflows Workflow[]
  progress  Progress[]
  submissions Submission[]
}

model Classroom {
  id          String   @id @default(cuid())
  name        String
  ownerId     String
  members     Enrollment[]
  assignments Assignment[]
}

model Enrollment {
  classroomId String
  userId      String
  role        Role     @default(STUDENT)
  @@id([classroomId, userId])
}

// 工作流
model Workflow {
  id          String   @id @default(cuid())
  ownerId     String
  title       String
  description String?
  cover       String?
  tags        String[]                 // 最多 5
  slug        String?  @unique         // 课程模板可 /调用
  visibility  Visibility @default(PRIVATE)
  shareToken  String?  @unique         // 分享链接
  forkedFrom  String?
  isTemplate  Boolean  @default(false) // 工具箱/课程模板
  nodes       Node[]
  edges       Edge[]
  variables   Variable[]
  runs        Run[]
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model Node {
  id          String   @id @default(cuid())
  workflowId  String
  type        NodeType
  position    Json                     // {x,y}
  config      Json                     // prompt/model/params
  teaching    Json?                    // NodeTeaching
  status      String   @default("idle")
  output      Json?
  outgoing    Edge[]   @relation("src")
  incoming    Edge[]   @relation("dst")
}

model Edge {
  id           String  @id @default(cuid())
  workflowId   String
  sourceId     String
  targetId     String
  sourceHandle String?
  targetHandle String?
}

model Variable {
  id         String  @id @default(cuid())
  workflowId String
  key        String                      // {{subject}}
  label      String
  type       String                      // text|select|number|asset
  default    String?
  options    Json?
  required   Boolean @default(false)
  source     String  @default("student") // teacher|student
}

// 运行
model Run {
  id         String   @id @default(cuid())
  workflowId String
  userId     String
  mode       RunMode  @default(TEACHER)  // teacher|student
  status     RunStatus @default(IDLE)
  nodeRuns   NodeRun[]
  createdAt  DateTime @default(now())
}

model NodeRun {
  id         String   @id @default(cuid())
  runId      String
  nodeId     String
  status     RunStatus @default(IDLE)
  progress   Int       @default(0)
  inputHash  String?
  input      Json?
  output     Json?
  cost       Int       @default(0)
  error      String?
  startedAt  DateTime?
  finishedAt DateTime?
  @@index([runId, nodeId])
}

model Asset {
  id        String   @id @default(cuid())
  ownerId   String
  type      String                        // image|video|audio|text
  url       String
  meta      Json?
  createdAt DateTime @default(now())
}

// 教学
model Assignment {
  id          String   @id @default(cuid())
  classroomId String
  workflowId  String
  title       String
  dueAt       DateTime?
  maxScore    Int      @default(100)
  submissions Submission[]
  progress    Progress[]
}

model Progress {
  id               String   @id @default(cuid())
  userId           String
  assignmentId     String
  currentNodeId    String?
  completedNodeIds Json     @default("[]")
  status           String   @default("in_progress")
  updatedAt        DateTime @updatedAt
  @@unique([userId, assignmentId])
}

model Submission {
  id           String   @id @default(cuid())
  assignmentId String
  userId       String
  assets       Json
  remark       String?
  grade        Int?
  feedback     String?
  submittedAt  DateTime @default(now())
  @@unique([assignmentId, userId])
}

enum Role { STUDENT TEACHER ADMIN }
enum Visibility { PRIVATE CLASS PUBLIC }
enum NodeType { TEXT IMAGE VIDEO AUDIO SCRIPT }
enum RunMode { TEACHER STUDENT }
enum RunStatus { IDLE QUEUED RUNNING SUCCEEDED FAILED CANCELED }
```

---

## 5. 页面与路由

| 路由 | 角色 | 内容 |
|---|---|---|
| `/login` | 全部 | 登录/注册 |
| `/dashboard` | 全部 | 最近项目、最近课程、待办 |
| `/projects` | 老师 | 项目库（全部/回收站/新建） |
| `/canvas/[workflowId]` | 老师 | **工作流编辑器**（画布 + 属性面板 + 工具箱） |
| `/courses` | 全部 | 课程/模板列表（标签筛选、`/调用`） |
| `/courses/[id]` | 老师 | 课程详情、学生进度、导出分享链接 |
| `/learn/[assignmentId]` | 学生 | **引导模式**（步骤条 + 画布聚焦 + 运行 + 产出） |
| `/share/[token]` | 访客 | 预览并"复制到我的项目" |

---

## 6. 核心组件树

```
CanvasPage
├─ TopBar（画布名/工作流/故事板/分享/积分）
├─ WorkflowCanvas                 # React Flow
│  ├─ <Background/> <MiniMap/> <Controls/>
│  ├─ nodeTypes={ text,image,video,audio,script,group }
│  └─ edgeTypes={ deletable }
├─ NodePalette（添加节点菜单）
├─ NodeInspector（右侧）
│  ├─ 基础：模型/提示词/参数
│  └─ 教学：步骤标题/说明/变量/检查点/提示
└─ GroupToolbar（选中组时）
   └─ SaveToolboxDialog

LearnPage
├─ StepList（左：步骤条 + 完成态）
├─ WorkflowCanvas（只读缩放，当前节点高亮聚焦，禁止编辑）
└─ StepPanel（右：说明 + 变量表单 + 运行 + 检查点结果 + 产出预览）
```

---

## 7. 状态管理

```ts
// stores/canvasStore.ts
type CanvasState = {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedNodeId: string | null;
  variables: Variable[];
  dirty: boolean;
  // actions
  addNode(type: NodeType, pos: XY): void;
  updateNodeConfig(id: string, patch: Partial<NodeConfig>): void;
  updateNodeTeaching(id: string, patch: Partial<NodeTeaching>): void;
  connect(edge: Edge): void;
  removeNodes(ids: string[]): void;
  group(ids: string[]): void;
  hydrate(snapshot: WorkflowSnapshot): void;
};

// stores/runStore.ts  —— 与 SSE 合并
type RunState = {
  runId: string | null;
  nodeStatus: Record<string, { status: RunStatus; progress: number; output?: any; error?: string }>;
  apply(event: RunEvent): void;
  reset(): void;
};
```

**持久化策略**：`canvasStore` 变更 → 500ms 防抖 → `PATCH /api/workflows/:id`（增量保存 nodes/edges/variables）。

---

## 8. 工作流引擎设计

### 8.1 节点输出契约（照 LibTV 实测）
```ts
type NodeOutput =
  | { kind: 'text';  text: string }
  | { kind: 'image'; images: string[] }
  | { kind: 'video'; videos: string[] }
  | { kind: 'audio'; audio: string[] }
  | { kind: 'action'; action: string; action_input: string;
      supplementary?: Record<string, unknown> };   // 如 text_to_image
```

### 8.2 依赖与执行
```ts
// server/workflow/graph.ts
topoSort(nodes, edges): string[]              // 拓扑序
upstreamOf(nodeId, edges): string[]           // 直接上游
collectInputs(nodeId, nodeOutputs, variables) // 组装节点输入
hashInput(input): string                      // 缓存键
```

### 8.3 运行编排
```ts
// server/workflow/runner.ts
runNode(runId, nodeId): Promise<NodeRun>      // 单节点（教学分步）
runAll(runId, nodeIds?): Promise<void>        // 整组/全部（拓扑序）
  for (const id of topoSort(...)) {
    if (cache.hit(inputHash)) { mark succeeded from cache; continue; }
    await runNode(runId, id);
  }
```

**状态机**：`IDLE → QUEUED → RUNNING(progress) → SUCCEEDED | FAILED | CANCELED`
**缓存**：`inputHash` 命中则复用上次 `output`，`cost=0`（教学重复运行不扣费）。
**重试**：失败可单独重跑该节点及其下游（标记下游为 stale）。

### 8.4 实时进度（SSE）
```
GET /api/runs/:id/events
data: {"type":"node","nodeId":"n1","status":"RUNNING","progress":40}
data: {"type":"node","nodeId":"n1","status":"SUCCEEDED","output":{...}}
data: {"type":"run","status":"SUCCEEDED"}
```
实现：`server/workflow/events.ts` 内存 EventEmitter（单实例）；多实例时换 Redis Pub/Sub。

### 8.5 Mock 运行策略（MVP 关键）
| 节点 | Mock 行为 | 耗时 |
|---|---|---|
| 文本 | 依据提示词生成一段结构化 `action` JSON（可用模板+随机） | 1–2s |
| 图片 | 从 `public/mock/*.jpg` 轮播返回，附带随机尺寸 | 2–4s |
| 视频 | 返回 `public/mock/demo.mp4`，按 progress 递增 | 5–8s |
| 音频 | 返回 `public/mock/demo.mp3` | 2s |

**要求**：Mock 必须走**与真实 Provider 完全相同的接口与状态机**，保证 M6 只替换实现、不动上层。

---

## 9. 教学层设计

### 9.1 工作流级
```ts
type Variable = { key; label; type; default?; options?; required; source: 'teacher'|'student' };
```
### 9.2 节点级
```ts
type NodeTeaching = {
  stepTitle: string;
  instruction: string;             // Markdown
  editable: 'locked' | 'student';
  variables: string[];             // 引用 Variable.key
  checkpoint?: { type: 'generated'|'type'|'constraint'|'manual'; rule?: string; message?: string };
  hints?: string[];
  sampleOutput?: string;
};
```
### 9.3 变量渲染
`server/teaching/variables.ts`
```ts
renderTemplate("画面：{{subject}}，风格：{{style}}", vars) // → 实际提示词
```
### 9.4 检查点校验
`server/teaching/checkpoints.ts`
| type | 规则示例 |
|---|---|
| generated | 节点 `status===SUCCEEDED` 且 `output` 非空 |
| type | 产出类型匹配（image/video…） |
| constraint | `duration>=5`、`resolution==='720P'`、`count>=1` |
| manual | 学生点"我确认完成" |

不通过 → 返回 `{ ok:false, message }`，前端禁止"下一步"。
### 9.5 进度
- `GET /api/assignments/:id/progress`（学生）：当前步、已完成节点、状态。
- 每次节点成功后 `PATCH` 更新 `completedNodeIds`。
- 引导模式从 `Progress.currentNodeId` 恢复，支持中断续做。

---

## 10. API 清单

| 方法 | 路径 | 说明 |
|---|---|---|
| POST | `/api/auth/*` | Auth.js |
| GET/POST | `/api/workflows` | 列表 / 新建 |
| GET/PATCH/DELETE | `/api/workflows/:id` | 读取（含 nodes/edges/variables）/ 保存 / 删除 |
| POST | `/api/workflows/:id/duplicate` | 复制（分享链接用） |
| POST | `/api/nodes/:id/run` | 运行单节点（创建/复用 NodeRun） |
| POST | `/api/workflows/:id/run` | 整组执行 |
| GET | `/api/runs/:id/events` | **SSE 进度** |
| POST | `/api/runs/:id/cancel` | 取消 |
| POST | `/api/workflows/:id/share` | 生成 `shareToken` |
| GET | `/api/share/:token` | 预览 |
| POST | `/api/share/:token/fork` | 复制到我的项目 |
| GET/POST | `/api/assets` | 资产列表 / 登记 |
| POST | `/api/assets/upload` | 上传（MVP 本地） |
| GET/POST | `/api/assignments` | 作业列表 / 布置 |
| GET | `/api/assignments/:id/progress` | 全班进度（老师）/ 个人进度（学生） |
| POST | `/api/submissions` | 提交作业 |
| GET | `/api/teaching/check` | 检查点校验（或内联在 node run 结果） |

---

## 11. Provider 接口（MVP 用 Mock 实现）

```ts
// server/providers/types.ts
export interface GenProvider<In = any, Out = any> {
  readonly name: string;
  readonly kind: 'text' | 'image' | 'video' | 'audio';
  costEstimate(input: In): number;
  submit(input: In, ctx: { nodeId: string; runId: string }): Promise<{ jobId: string }>;
  poll(jobId: string): Promise<{ status: 'running'|'succeeded'|'failed'; progress?: number; result?: Out; error?: string }>;
}

// server/providers/mock.ts
export const mockTextProvider: GenProvider = { /* 1–2s 后返回 action JSON */ };
export const mockImageProvider: GenProvider = { /* 2–4s 返回图片 URL */ };
export const mockVideoProvider: GenProvider = { /* 5–8s 返回视频 URL，progress 递增 */ };

// server/providers/registry.ts —— M6 只改这里
export const providers = { text: mockTextProvider, image: mockImageProvider, video: mockVideoProvider, audio: mockAudioProvider };
```
**M6 接真实**：新增 `arkTextProvider`(豆包) / `seedreamImageProvider`(即梦) / `klingVideoProvider`(可灵) 等，按 env 切换。

---

## 12. 任务拆分

### M1 画布内核（可交付：能拖拽搭图 + 假运行）
- [ ] T1.1 初始化工程：Next.js 15 + TS + Tailwind + shadcn + pnpm
- [ ] T1.2 Prisma + Postgres（docker-compose）+ 迁移
- [ ] T1.3 Auth.js 登录页 + 会话
- [ ] T1.4 `/canvas/[id]`：React Flow 无限画布（背景/缩放/小地图/吸附）
- [ ] T1.5 5 类节点 `BaseNode` 外壳（端口/标题/状态徽标）
- [ ] T1.6 `NodePalette` 添加节点 + 拖拽放置
- [ ] T1.7 连线（类型校验）+ 删除边
- [ ] T1.8 打组/解组（Ctrl+G）
- [ ] T1.9 `canvasStore` + 防抖持久化
- [ ] T1.10 节点右键菜单（复制/删除）

### M2 节点生成（Mock）
- [ ] T2.1 `GenProvider` 接口 + Mock 三种
- [ ] T2.2 `POST /api/nodes/:id/run` + `NodeRun` 落库
- [ ] T2.3 进程内队列 + 状态机
- [ ] T2.4 `GET /api/runs/:id/events` SSE
- [ ] T2.5 `runStore` 合并 SSE，节点进度环
- [ ] T2.6 `NodeInspector`：模型/提示词/参数表单（图/视频参数对齐 §13.2）
- [ ] T2.7 节点内产物预览（图/视频/文本）
- [ ] T2.8 资产库 `/api/assets` + 拖入画布
- [ ] T2.9 输入哈希缓存

### M3 工作流引擎
- [ ] T3.1 拓扑排序 + 依赖解析
- [ ] T3.2 整组执行（整组执行按钮）
- [ ] T3.3 保存工作流（`SaveToolboxDialog`：封面/名称/标签≤5/备注）
- [ ] T3.4 打开工作流面板 + 发送到画布
- [ ] T3.5 变量定义（老师预设/学生填）
- [ ] T3.6 分享链接（`shareToken`）+ 复制副本

### M4 教学层（核心）
- [ ] T4.1 `NodeTeaching` 编辑 UI（步骤标题/说明/变量/检查点/提示）
- [ ] T4.2 `/learn/[assignmentId]` 引导模式页面
- [ ] T4.3 `StepList` + 当前节点高亮/自动聚焦（`fitView` + 节点描边）
- [ ] T4.4 `StepPanel`：说明 + 变量表单 + 运行本步
- [ ] T4.5 检查点校验 + 解锁下一步
- [ ] T4.6 进度持久化 + 中断续做
- [ ] T4.7 学生产出汇总页（类"故事板"确认台）
- [ ] T4.8 提交作业（基础版，评分的完整看板留 M5）

**建议排期**：M1(3–4d) → M2(3–4d) → M3(2–3d) → M4(4–5d)。

---

## 13. 验收标准（DoD）

| 里程碑 | 验收 |
|---|---|
| M1 | 新建项目→拖入 5 类节点→连线→打组→刷新页面状态保留 |
| M2 | 点"运行"→进度实时→产出展示→重复运行命中缓存不重复耗时 |
| M3 | 打组→保存工具箱→新画布"打开工作流"→发送到画布→整组执行 |
| M4 | 老师配 3 步教学→生成分享链接→学生打开副本→逐步填空运行→检查点拦截→进度恢复→提交 |

---

## 14. 风险与降级

| 风险 | 降级方案 |
|---|---|
| React Flow 大图性能 | 虚拟化/简化节点渲染；限制节点数 |
| SSE 在 serverless 不稳定 | 改轮询 `/api/runs/:id` |
| 视频 Mock 太假 | 用真实短样片 + 明确"演示"标识 |
| 队列进程内重启丢任务 | MVP 允许重跑；M6 上 BullMQ+Redis |
| 本地存储不可共享 | 抽 `StorageAdapter`，M6 换 OSS |

---

## 15. 本地开发环境

```bash
# 依赖
pnpm create next-app@latest app --ts --tailwind --app --src-dir
pnpm add @xyflow/react zustand immer @tanstack/react-query \
         react-hook-form zod next-auth @prisma/client bcryptjs
pnpm add -D prisma @types/bcryptjs

# 数据库（docker-compose.yml）
docker compose up -d   # postgres:16 on 5432
pnpm prisma migrate dev

# 运行
pnpm dev

# Mock 素材目录
public/mock/{img-1.jpg,img-2.jpg,demo.mp4,demo.mp3}
```

**环境变量**（`.env`）
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aiteach
NEXTAUTH_SECRET=dev-secret
NEXTAUTH_URL=http://localhost:3000
# M6 再填
# ARK_API_KEY=
# SEEDREAM_API_KEY=
# KLING_API_KEY=
```
