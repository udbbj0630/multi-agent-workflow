# 呜哩 Uli

3-8 岁儿童的 AI 成长伙伴，基于 4C 能力模型（创造力、批判思维、沟通表达、协作力）追踪孩子的成长轨迹。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 19 + TypeScript + Vite 6 |
| 后端 | Fastify 5 + Socket.IO + TypeScript |
| 数据库 | SQLite (better-sqlite3, WAL mode) |
| LLM | DeepSeek Chat V3 (via OpenRouter) |
| 认证 | JWT (HS256, 30 天过期) |
| 构建 | Turborepo monorepo |

## 项目结构

```
uli/
├── apps/
│   ├── server/                 # Fastify 后端
│   │   └── src/
│   │       ├── index.ts            # 入口 + Socket.IO 注册
│   │       ├── config.ts           # 环境变量配置
│   │       ├── middleware/
│   │       │   ├── auth.ts         # JWT 认证中间件
│   │       │   └── rateLimit.ts    # IP 级限流
│   │       ├── routes/
│   │       │   ├── auth.ts         # 登录 / 注册
│   │       │   ├── children.ts     # 孩子数据 API
│   │       │   └── legal.ts        # 隐私政策 / 数据导出删除
│   │       ├── services/
│   │       │   ├── assessment.ts   # 4C 能力评估
│   │       │   ├── auth.ts         # JWT 签发 / 验证
│   │       │   ├── knowledge.ts    # 知识边界检测
│   │       │   ├── llm.ts          # LLM 对话 + 记忆提取
│   │       │   ├── narrative.ts    # 周成长报告生成
│   │       │   └── store.ts        # SQLite 数据层
│   │       └── websocket/
│   │           └── session.ts      # 实时聊天会话管理
│   │
│   └── web/                    # React 前端
│       └── src/
│           ├── main.tsx            # 入口
│           ├── styles.css          # 全局样式 (Cosmic Garden 主题)
│           ├── components/
│           │   └── UliCharacter.tsx # SVG 吉祥物组件 (6 种表情)
│           └── pages/
│               ├── Welcome.tsx     # 登录 / 注册 / 模式选择 + App 布局
│               ├── child/Chat.tsx  # 孩子聊天界面
│               └── parent/Dashboard.tsx # 家长观测台
│
├── packages/shared/            # 共享类型和常量
├── data/                       # SQLite 数据文件 (gitignored)
└── .env                        # 环境变量 (gitignored)
```

## 快速开始

### 前置要求

- Node.js >= 18
- npm >= 10
- OpenRouter API Key

### 安装

```bash
git clone <repo-url> uli && cd uli
npm install
```

### 配置

```bash
cp .env.example .env
# 编辑 .env，填入你的 OpenRouter API Key
```

`.env` 必填项：

| 变量 | 说明 |
|------|------|
| `LLM_API_KEY` | OpenRouter API Key (必须) |
| `JWT_SECRET` | JWT 签名密钥，生产环境必须修改 |

### 启动开发环境

```bash
# 同时启动前端 (5173) 和后端 (4000)
npm run dev

# 或分别启动
npm run dev:server   # 后端 http://localhost:4000
npm run dev:web      # 前端 http://localhost:5173
```

### 演示账号

开发环境自动创建演示数据：

- 手机号：`13800000000`
- 密码：`password`
- 孩子：小宇

> 生产环境 (`NODE_ENV=production`) 不会创建演示数据。

## API 文档

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 注册（手机号 + 密码 + 孩子信息） |
| POST | `/api/auth/login` | 登录，返回 JWT token |

### 孩子数据（需 JWT）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/parents/:parentId/children` | 获取孩子列表 |
| GET | `/api/children/:childId/baseline` | 4C 基线分数 + 雷达图数据 |
| GET | `/api/children/:childId/trend` | 成长趋势时序数据 |
| GET | `/api/children/:childId/milestones` | 里程碑列表 |
| GET | `/api/children/:childId/memories` | 闪光记忆云 |
| GET | `/api/children/:childId/narrative` | AI 成长周报 |
| GET | `/api/children/:childId/sessions` | 会话历史 |
| GET | `/api/children/:childId/scores` | 各次评分记录 |

### 法律与账户

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/legal/privacy` | 隐私政策 |
| GET | `/api/legal/terms` | 服务条款 |
| GET | `/api/account/export` | 导出全部数据 (JSON) |
| POST | `/api/account/delete` | 申请删除账户 |

### 实时通信 (Socket.IO)

连接路径：`/socket.io`，认证方式：`auth.token`

| 事件 | 方向 | 说明 |
|------|------|------|
| `start_session` | Client → Server | 开始聊天会话 |
| `text` | Client → Server | 发送消息 |
| `tap_uli` | Client → Server | 点击呜哩 |
| `end_session` | Client → Server | 结束会话 |
| `thinking` | Server → Client | 呜哩正在思考 |
| `audio` | Server → Client | 呜哩回复 |
| `reaction` | Server → Client | 点击反应 |
| `session_started` | Server → Client | 会话已建立 |
| `session_ended` | Server → Client | 会话已结束 |

## 安全特性

- JWT 认证 + 30 天过期，客户端自动检测过期
- bcrypt 密码哈希
- API 路由 parentId 所有权校验（家长只能访问自己的孩子数据）
- WebSocket 连接认证 + `start_session` 所有权验证
- 限流：普通 API 100次/分钟，认证 API 30次/分钟
- 输入校验：手机号 11 位、密码 8 位起、孩子名字仅允许中文/字母/数字
- CORS 按环境配置锁定

## 4C 评估模型

每次聊天会话结束后，系统自动评估孩子在四个维度上的表现：

| 维度 | 英文 | 说明 |
|------|------|------|
| 创造力 | Creativity | 想象力、发散思维、原创性 |
| 批判思维 | Critical Thinking | 逻辑推理、因果关系、问题分析 |
| 沟通表达 | Communication | 表达清晰度、词汇运用、叙述能力 |
| 协作力 | Collaboration | 回应配合、共情能力、角色意识 |

评分采用 EMA（指数移动平均）平滑算法（0.7/0.3 权重），避免单次波动。

## 生产部署

```bash
# 构建
npm run build

# 环境变量
NODE_ENV=production
JWT_SECRET=<随机64位字符串>
LLM_API_KEY=<你的key>
CORS_ORIGIN=https://yourdomain.com

# 启动
cd apps/server && node dist/index.js
```

需要反向代理（Nginx/Caddy）同时处理：
- 静态文件（前端构建产物）
- `/api/*` 和 `/socket.io/*` 代理到后端 4000 端口
- HTTPS 证书

## 环境变量完整列表

| 变量 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `LLM_API_KEY` | 是 | - | OpenRouter API Key |
| `JWT_SECRET` | 是 | - | JWT 签名密钥 |
| `PORT` | 否 | 4000 | 后端端口 |
| `NODE_ENV` | 否 | development | 环境 (production 跳过 demo 数据) |
| `LLM_BASE_URL` | 否 | https://openrouter.ai/api/v1 | LLM API 地址 |
| `LLM_MODEL` | 否 | deepseek/deepseek-chat-v3-0324 | LLM 模型 |
| `JWT_EXPIRES_IN` | 否 | 30d | JWT 过期时间 |
| `CORS_ORIGIN` | 否 | http://localhost:5173 | CORS 允许的源 (逗号分隔) |

## License

Private — All rights reserved.
