# 呜哩 Uli — 项目交接工作文档

## 一、项目概述

**呜哩 (Uli)** 是一个面向中国 3-8 岁儿童的 AI 互动成长平台。孩子通过语音/文字与一个叫"呜哩"的外星小朋友聊天，系统在对话中隐性地评估孩子的 4C 能力（创造力、批判性思维、沟通力、协作力），家长通过仪表盘查看孩子的成长数据和建议。

**团队**：3 人（开发者/vibe coding + 心理学专家 + 市场运营）
**市场**：仅中国大陆，需要国产化部署
**当前状态**：功能原型已完成，UI/UX 待提升

---

## 二、技术架构

### 2.1 Monorepo 结构

```
uli/
├── .env                          # 环境变量（LLM API key 等）
├── package.json                  # 根 monorepo 配置
├── turbo.json                    # Turborepo 配置
├── apps/
│   ├── server/                   # 后端服务
│   │   ├── src/
│   │   │   ├── index.ts          # Fastify + Socket.io 主入口（372 行）
│   │   │   ├── services/
│   │   │   │   ├── llm.ts        # DeepSeek LLM 对接（181 行）
│   │   │   │   ├── store.ts      # SQLite 持久化存储（502 行）
│   │   │   │   ├── assessment.ts # 4C 测评引擎（229 行）
│   │   │   │   ├── knowledge.ts  # 知识边界引擎（119 行）
│   │   │   │   └── auth.ts       # JWT 认证
│   │   │   ├── prompts/
│   │   │   │   └── personality.md # 呜哩人格系统 prompt
│   │   │   └── db/
│   │   │       └── schema.sql    # PostgreSQL schema（未来迁移用）
│   │   └── package.json
│   ├── web/                      # 前端 React 应用
│   │   ├── src/
│   │   │   ├── main.tsx          # 入口
│   │   │   ├── styles.css        # 全局样式系统
│   │   │   ├── components/
│   │   │   │   └── UliCharacter.tsx  # SVG 呜哩角色组件
│   │   │   └── pages/
│   │   │       ├── Welcome.tsx    # 登录 + 选择模式
│   │   │       ├── child/
│   │   │       │   └── Chat.tsx   # 孩子聊天界面
│   │   │       └── parent/
│   │   │           ├── Dashboard.tsx  # 家长仪表盘
│   │   │           └── Login.tsx      # （已废弃，登录合并到 Welcome.tsx）
│   │   ├── vite.config.ts
│   │   └── package.json
│   └── data/
│       └── uli.db                # SQLite 数据文件
└── packages/
    └── shared/                   # 共享类型定义
```

### 2.2 技术栈

| 层面 | 技术 | 说明 |
|------|------|------|
| 前端 | React 19 + Vite 6 + TypeScript | 单页应用，无路由库 |
| 后端 | Fastify 5 + Socket.io | REST API + WebSocket 实时通信 |
| 数据库 | SQLite (better-sqlite3) | WAL 模式，文件持久化 |
| LLM | DeepSeek via OpenRouter | 兼容 OpenAI SDK |
| 认证 | 自定义 JWT (HMAC-SHA256) | 手机号 + 密码登录 |
| 语音 | Web Speech API | 浏览器原生 STT + SpeechSynthesis TTS |
| 构建 | Turborepo monorepo | npm workspaces |

### 2.3 环境变量 (.env)

```
LLM_API_KEY=sk-or-v1-...（OpenRouter key）
LLM_BASE_URL=https://openrouter.ai/api/v1
LLM_MODEL=deepseek/deepseek-chat-v3-0324
PORT=4000
```

### 2.4 启动方式

需要两个终端：
```bash
# 终端 1：后端
cd ~/Desktop/uli/apps/server && npx tsx src/index.ts

# 终端 2：前端
cd ~/Desktop/uli/apps/web && npx vite dev --port 5173
```

前端运行在 `localhost:5173`，Vite 代理 `/api` 和 `/socket.io` 到后端 `localhost:4000`。

---

## 三、核心功能详解

### 3.1 用户流程

1. **登录/注册** → 手机号 + 密码，注册时填写孩子名字和出生日期
2. **选择模式** → 「找呜哩玩」（孩子端）或「成长报告」（家长端）
3. **孩子端** → 点击「开始」建立 WebSocket 会话，通过文字/语音与呜哩聊天
4. **家长端** → 查看孩子的 4C 能力雷达图、成长趋势、记忆标签、里程碑、建议

### 3.2 呜哩角色 (AI 人格)

- 来自 Z 星球的 5 岁外星小朋友，好奇、温暖、偶尔迷糊
- 人格定义在 `apps/server/src/prompts/personality.md`
- **知识边界**：按年龄分层的知识树（苹果/恐龙/月亮/水/猫），每个概念有 3 个深度级别
- **记忆系统**：会话结束时用 LLM 提取记忆（兴趣/关系/事件/情绪/偏好），下次聊天时注入 system prompt
- **永远不会说**"我是 AI"

### 3.3 4C 测评系统

基于 WISC-IV 魔改，从对话文本中检测信号：
- **创造力**：发散词汇、词汇多样性、回答丰富度、叙事能力
- **批判性思维**：因果推理、比较判断、质疑追问
- **沟通力**：表达完整度、情绪表达、主动回应、描述性表达
- **协作力**：共情表达、接受建议、积极参与

评分范围 30-100，使用 EMA（指数移动平均）平滑更新基线。

### 3.4 会话管理

- Socket.io 建立 WebSocket 连接
- `start_session` / `end_session` / `disconnect` 事件
- 会话结束时自动：保存 4C 评分 → 更新基线 → 提取记忆 → 检查里程碑
- 浏览器关闭也会触发 finalizeSession（通过 disconnect 事件）

### 3.5 REST API 端点

```
POST   /api/auth/register          # 注册
POST   /api/auth/login             # 登录
GET    /api/parents/:id/children   # 获取家长的孩子列表
GET    /api/children/:id/baseline  # 获取基线 + 雷达数据
GET    /api/children/:id/trend     # 获取趋势数据
GET    /api/children/:id/milestones # 获取里程碑
GET    /api/children/:id/memories  # 获取记忆标签
GET    /api/children/:id/sessions  # 获取会话列表
GET    /api/children/:id/scores    # 获取评分历史
```

---

## 四、前端页面详解

### 4.1 登录页 (Welcome.tsx — page=login)

- 深空黑背景 `#070B14`
- 80 颗随机闪烁星星
- 4 层极光/星云色块（紫/蓝/粉/青），`blur(80px)` 慢速漂移
- SVG 呜哩角色居中浮动
- 玻璃拟态登录卡片，全息旋转边框（conic-gradient）
- 输入框：半透明背景 + 紫色 focus 发光

### 4.2 选择模式页 (Welcome.tsx — page=choose)

- 四色柔和渐变背景（蓝→紫→橙→粉）缓慢流动
- SVG 呜哩角色（开心状态）
- 两张大型交互卡片（hover 上浮 + 阴影增强）：
  - 孩子：青色系，「👾 找呜哩玩 · 语音聊天 · 互动成长」
  - 家长：紫色系，「📊 成长报告 · 4C能力 · 数据洞察」
- 卡片右侧箭头 hover 时右移

### 4.3 孩子聊天页 (Chat.tsx)

- **背景**：柔和渐变（蓝→紫→橙→绿）+ 3 个模糊色块漂移
- **角色**：SVG 呜哩角色（80px），6 种表情状态：
  - `idle`：浮动 + 自动眨眼（每 3-5 秒）
  - `thinking`：左右摇晃 + 天线发光脉冲 + 金色火花
  - `talking`：上下弹跳 + 嘴巴张合
  - `happy`：左右摇摆 + 眯眼笑 + 星星
  - `wave`：挥手动画 + 右臂摆动
  - `giggle`：快速弹跳 + 彩色纸屑
- **消息区**：左右滑入动画，紫色（孩子）和白色（呜哩）气泡
- **思考状态**：三点跳动动画
- **底部控制栏**：毛玻璃背景，开始/结束按钮（青色/橙色渐变），输入框，发送按钮，麦克风（录音时红色脉冲）
- **录音状态条**：红色脉冲点 + "正在听你说..."

### 4.4 家长仪表盘 (Dashboard.tsx)

- **背景**：深海军蓝 `#070B14 → #0D1B2A → #1A1A2E`
- **头部**：返回按钮 + 标题 + 副标题
- **雷达图**：SVG 钻石形 4 轴雷达图
  - 4 层网格线（25/50/75/100）
  - 紫色半透明填充 + 紫色描边
  - 4 个彩色数据点（粉/青/紫/橙），带发光和入场动画
  - 分数标签 + 维度标签
- **能力卡片**：2x2 网格，左侧彩色竖条，数字计数动画（从 0 滚动到实际分数），微型进度条
- **成长趋势**：暗色卡片，每行显示日期 + 4C 分数
- **记忆标签**：彩色胶囊标签，hover 放大
- **里程碑**：金色渐变图标 + 白色文字
- **建议卡片**：紫色渐变 + 光晕背景

---

## 五、SVG 呜哩角色 (UliCharacter.tsx)

自定义 SVG 外星人角色，替代之前的 emoji，主要组成：

```
- 椭圆身体（蓝色渐变）
- 圆形头部（浅蓝渐变 + 高光）
- 两根天线（贝塞尔曲线）+ 顶端发光球（金色渐变）
- 大眼睛（白色椭圆 + 黑色瞳孔 + 白色高光点）
- 自动眨眼（每 3-5 秒）
- 表情嘴巴（6 种 SVG path 形状）
- 粉色腮红
- 两个小手臂
- 地面阴影（随浮动缩放）
```

6 种表情通过 `mood` prop 控制，CSS 动画驱动状态切换。

---

## 六、已完成功能清单

- [x] Monorepo 项目搭建（Turborepo + npm workspaces）
- [x] 后端 Fastify + Socket.io 服务
- [x] DeepSeek LLM 对接（流式 + 非流式）
- [x] 呜哩人格系统 prompt
- [x] 4C 隐形测评引擎（WISC-IV 魔改）
- [x] SQLite 持久化存储（重启不丢数据）
- [x] JWT 认证系统（注册/登录）
- [x] 记忆系统（LLM 提取 + 下次注入）
- [x] 知识边界引擎（年龄分层知识树）
- [x] 会话自动 finalize（disconnect 时保存）
- [x] 里程碑检测
- [x] EMA 基线平滑更新
- [x] 前端单页应用（登录→选择→聊天/仪表盘）
- [x] Web Speech API 语音输入
- [x] SpeechSynthesis TTS 语音输出
- [x] SVG 呜哩角色（6 种表情 + 动画）
- [x] 星空极光登录页
- [x] SVG 雷达图（家长仪表盘）
- [x] 数字计数动画
- [x] 毛玻璃/全息卡片效果

---

## 七、待提升：UI/UX 全面升级

**用户反馈**：「目前的太普通了非常不高级不专业；我需要炫酷但是符合孩子使用或者说符合低龄家庭的观感」

**二次反馈**：「你做的太不够创意，太不够炫酷了，感觉非常的幼稚」

### 7.1 当前 UI 的具体问题

1. **角色设计**：SVG 角色虽然比 emoji 好了，但设计和动画仍偏简陋，缺乏专业角色设计的质感和表现力
2. **整体视觉风格**：停留在"React 教程"级别，没有形成独特的品牌视觉语言
3. **动画品质**：基础 CSS 动画（float/bounce/wobble），缺乏物理感和高级感
4. **背景氛围**：极光效果和模糊色块是常见套路，没有记忆点
5. **家长仪表盘**：功能完整但视觉上不够"数据分析"的专业感
6. **缺少微交互**：按钮点击、消息发送、页面切换等缺乏令人愉悦的反馈
7. **移动端适配**：目前主要针对手机屏幕，但没有精细的响应式处理

### 7.2 设计方向参考

用户想要的是「炫酷但符合低龄家庭观感」——不是幼稚的卡通风格，而是**高级感 + 亲和力**的结合。参考标杆：

- **Duolingo**：角色动画精致、交互反馈丰富、色彩高级但温暖
- **Headspace/Calm**：治愈系动画、有机形状、高级配色
- **苹果教育类 App**：克制但有质感的动画、专业排版
- **国内标杆**：VIPKID、猿辅导等教育 App 的角色和交互品质

### 7.3 具体需要提升的点

#### A. 角色动画升级
- 呜哩的 SVG 需要更精细的设计（更像专业插画，而不是几何图形拼接）
- 呼吸动画、微表情、更流畅的状态过渡
- 考虑是否用 Lottie 动画替代纯 SVG + CSS

#### B. 视觉品牌升级
- 建立完整的色彩系统（不只是几组渐变色）
- 统一的图标风格
- 字体排版层级（标题/正文/辅助文字的 size/weight/color 规范）
- 独特的视觉元素（不是通用的毛玻璃+粒子）

#### C. 交互动效升级
- 按钮按下时有弹性/涟漪反馈
- 消息发送时有飞出动画
- 页面切换有流畅过渡（不是瞬间切换）
- 成功/失败状态有庆祝/鼓励动画
- 录音时的声波可视化

#### D. 家长仪表盘升级
- 更专业的数据可视化（不只是简单雷达图）
- 趋势线图（用 recharts 或自定义 SVG）
- 成长报告的叙事感（不只是数字和条形图）
- 更好的空状态设计（没有数据时的引导）

#### E. 整体品质感
- 精细的阴影层级（不是通用的 `box-shadow`）
- 合理的间距系统（4px/8px 基数）
- 一致的圆角系统
- 高光/阴影/反射等细节
- 加载状态的骨架屏

---

## 八、技术约束

1. **不引入大型 UI 框架**（不用 Ant Design/MUI 等），保持自定义 CSS
2. **不引入动画库**（framer-motion 等暂不考虑），用纯 CSS + React state
3. **字体**：Noto Sans SC（已通过 Google Fonts CDN 引入）
4. **浏览器兼容**：主要针对 Chrome（Web Speech API 依赖 Chrome）
5. **无构建配置变更**：Vite 配置已稳定，不要改
6. **后端不动**：所有改动只涉及前端文件（styles.css、Welcome.tsx、Chat.tsx、Dashboard.tsx、UliCharacter.tsx）
7. **已安装但未使用的依赖**：`lottie-react`、`recharts`、`react-router-dom` 可供使用

---

## 九、数据结构

### 9.1 Socket.io 事件

```typescript
// Client → Server
socket.emit('start_session', { childId, childName })
socket.emit('text', { text: string })
socket.emit('end_session')
socket.emit('tap_uli')

// Server → Client
socket.on('thinking')
socket.on('audio', { text: string, animation: string })
socket.on('session_started', { greeting: string })
socket.on('session_ended', { goodbye: string })
socket.on('reaction')
```

### 9.2 API 返回数据结构

```typescript
// GET /api/children/:id/baseline
{
  radar: { creativity: number, criticalThinking: number, communication: number, collaboration: number },
  baselines: Array<{
    dimension: string,       // 'creativity' | 'critical_thinking' | 'communication' | 'collaboration'
    currentScore: number,
    difficultyLevel: number,
    trend: string,           // 'rising' | 'stable' | 'declining'
    sessionCount: number,
    updatedAt: string,
  }>
}

// GET /api/children/:id/trend
Array<{ date: string, creativity: number, criticalThinking: number, communication: number, collaboration: number }>

// GET /api/children/:id/milestones
Array<{ dimension: string, eventType: string, description: string, triggeredAt: string }>

// GET /api/children/:id/memories
Array<{ category: string, key: string, value: string, mentionCount: number }>
```

---

## 十、关键设计决策历史

1. **单页应用 vs 多页**：选择单页应用，通过 state 切换页面（login → choose → child/parent），不使用路由库
2. **emoji 角色 vs SVG 角色**：从 emoji 升级到自定义 SVG（UliCharacter.tsx），但用户仍不满意
3. **内存存储 vs SQLite**：从内存 Map 迁移到 SQLite（better-sqlite3），解决重启丢数据问题
4. **MediaRecorder vs Web Speech API**：从服务端 STT 切换到浏览器原生 Web Speech API
5. **独立登录 vs 统一登录**：从孩子/家长独立登录改为统一登录后选择模式
6. **部署**：暂不部署，本地开发阶段

---

## 十一、已知 Bug / 待解决

1. `apps/web/src/pages/parent/Login.tsx` 已废弃但未删除
2. SVG 角色的 CSS `d` path 动画在某些浏览器不支持（天线动画用了 transform 替代）
3. Web Speech API 只在 Chrome 可用，其他浏览器会提示"请用 Chrome"
4. 雷达图的 SVG `<animate>` 在 React 中可能有控制台警告
5. 页面切换没有过渡动画（瞬间切换）

---

## 十二、下一步计划

1. **UI/UX 全面升级**（当前正在做）— 需要真正达到"炫酷 + 高级 + 专业"的水准
2. **对接讯飞语音**（#30 pending）— 替代 Web Speech API，获得更好的中文语音识别
3. **部署上线** — 用户说暂时不用
