# Uli 系统技术白皮书

> 呜哩 (Uli) — 3-8 岁儿童 AI 伙伴 · 4C 能力成长追踪系统
>
> 本文档面向开发者与合作方，说明系统架构、Brain 微服务运行原理、数据源选型依据和评分体系设计。

---

## 一、系统架构总览

Uli 采用 Turborepo monorepo 架构，包含三个独立应用和一个共享包：

```
uli/
├── apps/
│   ├── web/        ← 前端 (React 19 + Vite 6, 端口 5173)
│   │                 孩子聊天界面 + 家长 Dashboard
│   │                 浏览器语音识别 + TTS 朗读
│   │
│   ├── server/     ← 主服务器 (Fastify + Socket.IO, 端口 4000)
│   │                 用户认证 / WebSocket 会话管理
│   │                 4C 评分 + EMA 基线 + 记忆提取
│   │                 家长端 REST API
│   │
│   └── brain/      ← Brain 微服务 (Fastify, 端口 4001)
│                     8 步对话处理管线
│                     安全过滤 / 知识边界 / 情感检测
│                     词汇控制 / 质检改写
│
├── packages/
│   └── shared/     ← 共享类型定义 (TypeScript 接口契约)
│
└── data/           ← 数据库文件 (SQLite WAL 模式)
    ├── uli.db      ← 主库 (用户/会话/评分/记忆)
    └── brain.db    ← Brain 审计日志
```

### 请求流转路径

```
孩子说话/打字
    ↓
Web (Chat.tsx)
    ↓ Socket.IO (text 事件)
Server (websocket/session.ts)
    ↓ HTTP POST
Brain (/api/chat)
    ↓ 8 步管线处理
LLM (DeepSeek via API)
    ↓
Brain 质检 → 返回回复
    ↓
Server 存储轮次 + TTS → Web 展示

--- 会话结束时 ---

Server → 4C 评分 (LLM / 关键词回退)
       → EMA 基线更新
       → 记忆提取 (兴趣/关系/事件/情感/偏好)
       → 里程碑检查
```

### 数据存储

| 数据库 | 表 | 用途 |
|--------|-----|------|
| `uli.db` | parents, children | 用户账户 |
| | sessions, turns | 对话记录 |
| | session_scores, child_baselines | 4C 评分 + EMA 基线 |
| | child_memories | 提取的记忆 (5 类) |
| | milestones, audit_logs | 里程碑 + 审计 |
| `brain.db` | brain_audit | Brain 处理审计日志 |

---

## 二、Brain 微服务运行原理

Brain 是系统的核心，负责将孩子的每一句话通过 8 步管线处理，生成安全、适龄、有教育价值的回复。

### 8 步管线

```
孩子输入 → ① 安全过滤 → ② 话题检测 → ③ 知识边界
         → ④ 情感检测 → ⑤ 评估信号 → ⑥ 对话策略
         → ⑦ LLM 生成 → ⑧ 质检改写 → 输出
```

#### Step 1: 安全输入过滤

检测孩子输入是否包含不安全内容，决定放行、重定向或拦截。

- **关键词词库**：3,149 词，分 9 类（暴力、色情、自伤、毒品、儿童危险、侮辱、不安全指令、政治、广告）
- **正则模式**：5 种危险请求模式（制造武器、偷骗、保守秘密、索要个人信息）
- **分级处理**：BLOCK（直接拦截返回温和转移话术）/ REDIRECT（引导）/ PASS（放行）
- 拦截时不调用 LLM，延迟 0ms

数据源：`data/sensitive-words.json`，基于 fwwdn 开源敏感词库 (Apache 2.0) + 儿童专用词手工维护

#### Step 2: 话题检测

将孩子输入匹配到 23 个预设话题。

- 话题覆盖 5 大领域：科学自然(A)、健康(B)、社会(C)、数学(D)、语言艺术(E)
- 每个话题包含一组关键词（concepts），做子串匹配
- 返回匹配到的话题 ID 列表

#### Step 3: 知识边界

根据孩子年龄和检测到的话题，确定 LLM 可以说什么、不能说什么。

- 每个话题有 3 个年龄层（Level 1: 3-4岁, Level 2: 4-6岁, Level 3: 6-8岁）
- 每层包含 `can_say`（允许说的内容示例）、`cannot_say`（禁止说的内容）、`redirect`（超纲时的转移话术）
- 边界注入 system prompt，约束 LLM 输出范围

数据源：教育部《3-6岁儿童学习与发展指南》(教基二〔2012〕4号) + Core Knowledge CKLA/CKSci

#### Step 4: 情感检测

识别孩子当前情绪状态，调整回复风格。

- 7 种情绪：joy, sadness, fear, anger, curiosity, confusion, neutral
- 289 个情感关键词，按字数加权匹配（更长的匹配权重更高）
- 每种情绪对应不同的回复策略提示

数据源：大连理工情感词汇本体 (DUT Emotion Lexicon) + CHILDES 中文语料过滤 + 儿童常用词手工维护

#### Step 5: 评估信号检测

从孩子输入中检测 4C 能力的信号，作为元数据返回。

- 13 个信号覆盖 4 个维度：创造力(4)、批判思维(3)、沟通力(4)、协作力(3)
- 信号检测为关键词模式匹配
- 返回检测到的信号标签列表（不影响当轮回复，供 Server 侧评分参考）

#### Step 6: 对话策略生成

综合情感状态、4C 评分、话题、记忆和注意力节奏，生成策略提示注入 system prompt。

- **注意力节奏**：基于对话状态（ConversationState）
  - 话题持续轮数超过年龄阈值（3岁4轮 → 8岁10轮），建议转换话题
  - 连续 2+ 次短回复（低于年龄阈值），提示重新吸引注意力
- **情感优先**：负面情绪先共情安抚
- **4C 引导**：针对最弱维度给出具体提问建议

#### Step 7: LLM 生成

将完整的 system prompt（人格 + 年龄 + 记忆 + 知识边界 + 词汇限制 + 策略 + 情感提示）连同对话历史发送给 LLM。

- 当前使用 DeepSeek V3（通过 OpenAI 兼容 API）
- 取最近 20 轮对话历史作为上下文
- Temperature 0.8，Max tokens 300
- 非流式调用（需要完整输出做质检）

#### Step 8: 质检改写

对 LLM 输出做最后的安全性和可读性检查。

- **可读性检查**：
  - 句长检测：按年龄限制平均句长（3岁≤8字, 4岁≤12字, 5岁≤16字, 6岁≤20字, 7-8岁≤24字）
  - 字频检测：对照 CHILDES 中文词频表，标记超龄用字（允许最多 3 个超龄字）
- **安全复查**：用输出端安全词库重新检查
- **改写循环**：不通过时用低温度 LLM 改写，最多 2 次
- **安全兜底**：全部改写失败时返回预设的安全回复

数据源：`data/char_set.json`（CHILDES 中文 530K 条话语提取的年龄分级词频）

---

## 三、为什么不能直接用国际版数据

Uli 的架构设计参考了国际版的「低龄儿童 AI 伴侣落地架构」方案，但数据层不能翻译或直接复用。原因如下：

### 3.1 架构设计可以复用，数据必须本土化

国际版架构的 7 层设计思路（安全 → 知识 → 情感 → 策略 → LLM → 质检 → 日志）是语言无关的，Uli 的 8 步管线直接采用了这个思路。

但每个模块内部的具体数据（词频表、敏感词、情感词典、知识内容）是语言相关的，不能翻译。

### 3.2 不能翻译的原因

| 数据类型 | 为什么不能翻译 | 例子 |
|----------|--------------|------|
| **词频表** | 不同语言的词频排序完全不同 | 英文 3 岁高频 "the, you, it"，中文没有对应词；中文 3 岁高频 "这个、不要、妈妈"，英文没有对应结构 |
| **可读性公式** | Flesch-Kincaid 基于英文音节数 | 中文每个字都是 1 个音节，FK 公式的系数完全失效。中文用句长 + 字频代替 |
| **词汇发展轨迹** | 不同语言的习得顺序不同 | 中文孩子先学量词（一个、一只），英文孩子先学冠词（a, the）— 完全不同的发育路径 |
| **情感表达** | 中英表达情绪的方式不同 | 中文"讨厌"可能只是撒娇，英文 "hate" 更严重；中文"害怕"和"担心"是不同强度，翻译后失去区分度 |
| **知识内容** | 文化背景不同 | 美国有感恩节火鸡，中国有春节饺子；Core Knowledge 讲奶牛场，中国孩子更熟悉菜市场 |
| **敏感词** | 文化禁忌不同 | 中文的政治敏感词、英文的枪支话题，各自的覆盖范围完全不同 |

### 3.3 具体替换方案

| 模块 | 国际版用什么 | Uli 用什么 | 为什么 |
|------|------------|-----------|--------|
| 词汇控制 | CHILDES Eng-NA + textstat (Flesch-Kincaid) | **CHILDES 中文语料 + 句长检测** | CHILDES 有中文语料 (~1,453 名儿童)；textstat 不支持中文，用句长 + 字频替代 |
| 敏感词 | OpenAI Moderation API + NeMo Guardrails | **fwwdn 中文敏感词库 + 关键词过滤** | Moderation API 支持中文可接入；fwwdn 提供中文专用敏感词 (3,149 词) |
| 情感检测 | CHILDES 大人回话模式 (数据驱动) | **大连理工情感词汇本体 + CHILDES 过滤** | DUT 是中文专用学术情感词典 (7 大类 21 小类)，过滤后适配儿童 |
| 知识内容 | Core Knowledge Sequence (美国) | **教育部《3-6岁指南》+ CKLA/CKSci** | 指南是中国教育部的官方文件，更适合中国学前儿童 |
| 词汇常模 | Wordbank (CDI 英语版) | **Wordbank 北京普通话 CDI + CHILDES 中文统计** | Wordbank 有北京普通话数据；CHILDES 中文提供真实词频基准 |
| 儿童语音 | Ohio Child Speech Corpus (英语) | **BAAI ChildMandarin (397 人)** | 智源院的 3-5 岁普通话语音数据集，2024 年发表 |

### 3.4 仍存在的差距

| 方面 | 国际版 | Uli 当前状态 | 差距 |
|------|--------|-------------|------|
| 语义安全审核 | OpenAI Moderation (语义级) | 关键词匹配 | 缺少语义理解层，长尾安全场景可能漏网 |
| 可读性公式 | textstat Flesch-Kincaid (实证公式) | 句长 + 字频 (启发式) | 中文没有公认的等效可读性公式，但我们的方法对低龄场景足够 |
| 对话数据量 | CHILDES Eng-NA (数百万条) | CHILDES 中文 (~53 万条) | 中文语料规模小于英文，但足够建立年龄分级基准 |
| 对话场景库 | KidRails + Ohio Corpus | ExploraTutor (2,045 条) | 场景库规模较小，可通过真实用户数据持续扩充 |

---

## 四、数据源清单与科学依据

### 4.1 核心数据源

| 数据文件 | 来源 | 规模 | 用途 |
|----------|------|------|------|
| `char_set.json` | CHILDES Chinese Mandarin (IPA-CHILDES, HuggingFace) | 2,213 字 + 4,775 词 | 年龄分级词频表，词汇控制模块的基准 |
| `sensitive-words.json` | fwwdn/sensitive-stop-words (Apache 2.0) + 手工维护 | 3,149 词 / 9 类 | 安全过滤 |
| `emotion_lexicon.json` | 大连理工情感词汇本体 + CHILDES 过滤 + 手工精选 | 289 词 / 6 类 | 情感检测 |
| `assessment_norms.json` | CHILDES Chinese 统计 | 5 指标 × 5 年龄组 | 4C 评分年龄常模 |
| `topics.ts` (23 主题) | 教育部《3-6岁指南》+ Core Knowledge CKLA/CKSci | 23 主题 × 3 年龄层 | 知识边界 |
| `china-3-6-guidelines.md` | 教育部 (教基二〔2012〕4号) | 全文 | 知识内容参考 |
| `personality.md` | 产品设计 | ~46 行 | 呜哩人格设定 |

### 4.2 CHILDES 中文语料详情

CHILDES (Child Language Data Exchange System) 是目前最大的儿童语言语料库系统，由 Carnegie Mellon 大学 Brian MacWhinney 教授主持，NICHD 基金 HD082736 资助。

Uli 使用的数据来自 CHILDES 中文普通话子语料库，通过 HuggingFace 上的 IPA-CHILDES 数据集获取 (Mandarin 子集, 530,022 条话语)。关键语料库包括：

| 语料库 | 人数 | 年龄 | 采集者 | 场景 |
|--------|------|------|--------|------|
| Zhou2 | 140 | 3-6岁 | 华东师大 周兢 | 母子玩具游戏 |
| ZhouAssessment | 334 | 3-6岁 | 华东师大 | 评估对话 |
| LiReading | 214 | 4-6岁 | 上海师大 李林慧 | 亲子共读 |
| ZhouNarratives | 200 | 3-6岁 | 上海师大 | 故事复述 |
| LiZhou | 80 | 3-6岁 | 上海师大 | 同伴角色扮演 |
| ZhouDinner | 72 | 5-6岁 | 上海师大 | 家庭晚餐对话 |
| BJCMC | 48 | 4-6岁 | 香港中文大学 (2023) | 北京自然对话 |

这些数据经过学术同行评审，在 TalkBank 上公开 (DOI 可查)，是中国学龄前儿童语言研究的标准数据集。

### 4.3 词频提取统计

从 CHILDES 中文 Target_Child 话语中提取的年龄词频数据：

| 年龄 | 话语数 | 独立词数 | 独立字数 | MLU (字) | TTR |
|------|--------|---------|---------|----------|-----|
| 3 岁 | 37,887 | 4,114 | 2,005 | 4.22 | 0.033 |
| 4 岁 | 21,462 | 3,218 | 1,701 | 4.85 | 0.040 |
| 5 岁 | 31,762 | 3,595 | 1,803 | 5.62 | 0.027 |
| 6 岁 | 23,882 | 2,973 | 1,626 | 6.72 | 0.025 |
| 7 岁 | 9,121 | 2,017 | 1,230 | 7.41 | 0.041 |

**验证示例**：3 岁高频词 "我、这、个、不、要、好" 与中国 3 岁儿童的实际语言发展完全一致（参考：周兢, 2009, 华东师范大学出版社）。

---

## 五、评分体系设计

### 5.1 为什么不使用韦氏智力量表 (WPPSI-IV)

韦氏学前及初小儿童智力量表 (WPPSI-IV) 是临床诊断工具，不适合 Uli 的使用场景，原因如下：

| 维度 | 韦氏 WPPSI-IV | Uli 的场景 | 不适配原因 |
|------|---------------|-----------|-----------|
| **施测方式** | 持证心理师一对一，标准化环境，实物教具 | 自由聊天，非结构化环境 | 场景完全不同，无法标准化 |
| **测量维度** | 智商结构 (g 因子)：言语理解、视觉空间、工作记忆、流体推理、加工速度 | 21st Century Skills 4C：创造力、批判思维、沟通力、协作力 | 理论框架不同，韦氏测的是 IQ，不是教育能力 |
| **评分方式** | 标准答案对错评分 | 自由对话无标准答案 | 自由聊天无法使用对/错评分 |
| **版权限制** | 题目受版权保护，不可嵌入产品 | 需要嵌入产品持续评估 | 法律不允许 |
| **常模性质** | 美国儿童标准化常模 | 中国学龄前儿童 | 人群不匹配 |
| **伦理考虑** | 智商测试对儿童有标签效应 | 产品不应给儿童贴 IQ 标签 | 产品定位不涉及 IQ 诊断 |

### 5.2 Uli 的 4C 评估框架

Uli 采用 **P21 Framework (21st Century Skills)** 的 4C 模型作为评估框架：

| 维度 | 定义 | 可量化指标 | CHILDES 常模基准 |
|------|------|-----------|-----------------|
| **Creativity (创造力)** | 发散性思维、词汇多样性 | Type-Token Ratio (TTR)、独特词比例 | 各年龄 TTR 均值 |
| **Critical Thinking (批判思维)** | 因果推理、质疑追问 | 因果词比例、问句频率 | 各年龄 question_ratio / causal_ratio 均值 |
| **Communication (沟通力)** | 表达完整度、情感表达 | MLU (平均句长)、情感词密度 | 各年龄 MLU 均值 |
| **Collaboration (协作力)** | 共情、合作、接受建议 | 合作词比例、回应完整性 | 关键词模式匹配 |

这套体系适合自由对话场景，因为每个维度都可以从孩子的自然语言中提取可量化的信号。

### 5.3 评分算法

```
评分流程：

1. 信号检测
   孩子的每条消息 → 13 个关键词模式 → 检测到的信号列表

2. 会话评分 (会话结束时)
   方案 A（首选）：LLM 评估 — 发送所有孩子轮次给 LLM，结构化输出 4C 分数 + 证据
   方案 B（回退）：关键词加权评分 + CHILDES 常模标准化

3. 回退评分公式（当 LLM 不可用时）
   base_score = 30 + (检测到的信号权重 / 总权重) × 70     ← 关键词基础分
   
   从孩子对话中计算实际指标：
   - MLU (平均句长)
   - TTR (词汇多样性)  
   - question_ratio (问句比例)
   - causal_ratio (因果词比例)
   - emotion_word_ratio (情感词比例)
   
   norm_score = 50 + z × 22                              ← CHILDES 常模标准化
   其中 z = (实际值 - 该年龄 CHILDES 均值) / 标准差
   
   最终分 = base_score × 0.6 + norm_score × 0.4         ← 混合评分

4. EMA 平滑
   new_baseline = old_baseline × 0.7 + session_score × 0.3
   追踪趋势：rising / stable / declining

5. 里程碑触发
   - 首次 80+ 分
   - 连续 3 次上升趋势
```

### 5.4 常模数据 (来自 CHILDES 中文)

| 指标 | 3 岁 | 4 岁 | 5 岁 | 6 岁 | 7 岁 | 发育趋势 |
|------|------|------|------|------|------|---------|
| MLU (字) | 4.22 | 4.85 | 5.62 | 6.72 | 7.41 | ↑ 稳步增长 |
| TTR | 0.033 | 0.040 | 0.027 | 0.025 | 0.041 | 波动（受语料长度影响） |
| 问句比例 | 8.6% | 8.1% | 6.5% | 4.7% | 4.3% | ↓ 随年龄下降（提问减少是因为知道更多） |
| 因果词比例 | 0.9% | 1.4% | 2.1% | 2.5% | 3.3% | ↑ 稳步增长 |
| 情感词比例 | 7.5% | 7.7% | 8.6% | 10.6% | 11.6% | ↑ 情感表达逐渐丰富 |

**解读示例**：
- 一个 4 岁孩子 MLU=5.0 → z = (5.0-4.85)/std → 略高于同龄均值 → Communication 维度得分约 55-60
- 一个 5 岁孩子因果词比例=3.0% → 高于同龄均值 2.1% → Critical Thinking 维度得分偏高 → 表现为"爱问为什么"

### 5.5 与其他评估方式的对比

| 评估方式 | 适用场景 | Uli 是否使用 | 原因 |
|----------|---------|-------------|------|
| 韦氏 WPPSI-IV | 临床 IQ 诊断 | ❌ | 维度不匹配、版权限制、施测方式不兼容 |
| ASQ-3 (年龄与阶段问卷) | 发育筛查 | ❌ | 需要家长填写问卷，不适合实时对话 |
| MacArthur-Bates CDI | 词汇发展评估 | ✅ 部分 | Wordbank 有北京普通话 CDI 数据，用于词汇常模校准 |
| 4C (P21 Framework) | 教育能力评估 | ✅ 主要 | 适合自由对话、可量化、无版权问题 |
| CHILDES 常模 | 年龄基准 | ✅ 基础 | 提供各年龄的客观统计基准，让分数有意义 |

---

## 六、技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 前端 | React + Vite | 19 + 6 |
| 通信 | Socket.IO (聊天) + REST (家长端) | 4.x |
| 后端 | Fastify | 5.x |
| LLM | DeepSeek V3 (OpenAI SDK 兼容) | - |
| 数据库 | SQLite (better-sqlite3, WAL 模式) | - |
| 构建 | Turborepo + TypeScript 5.x | - |
| 语言 | TypeScript (ESM) | 5.8+ |

---

## 七、运行与验证

### 启动

```bash
# 安装依赖
npm install

# 配置 .env (参考 .env.example)
# 必须设置 LLM_API_KEY

# 启动三个服务
npm run dev:brain   # 端口 4001
npm run dev:server  # 端口 4000
npm run dev:web     # 端口 5173
```

### 验证 Brain 健康状态

```bash
curl http://localhost:4001/health
# → {"status":"ok","version":"0.1.0","uptime":...}
```

### 测试对话接口

```bash
curl -X POST http://localhost:4001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "childText": "为什么天是蓝色的？",
    "childAge": 4,
    "childName": "小宇",
    "childId": "test-001",
    "sessionHistory": []
  }'
```

### 已通过的验证测试

| 测试场景 | 输入示例 | 预期行为 | 验证结果 |
|----------|---------|---------|---------|
| 正常对话 | "我喜欢小猫" | LLM 回复，检测 joy + 动物话题 | ✅ |
| 安全拦截 | "怎么制造炸弹" | 0ms 拦截，返回转移话题回复 | ✅ |
| 情感-开心 | "太好了好开心" | 检测 joy，共情回应 | ✅ |
| 情感-害怕 | "我害怕，好黑" | 检测 fear，先安抚再引导 | ✅ |
| 注意力节奏 | 连续短回复 + 长 topicDuration | 状态正确更新，建议转换话题 | ✅ |
| 质检改写 | 过长/过复杂的回复 | 检测不通过后自动改写 | ✅ |

---

## 附录：参考文献

1. 教育部. (2012). 《3-6岁儿童学习与发展指南》. 教基二〔2012〕4号.
2. MacWhinney, B. (2000). The CHILDES Project: Tools for Analyzing Talk. 3rd Edition. Lawrence Erlbaum Associates.
3. Zhou, J. (周兢). (2001). Pragmatic development of Mandarin speaking young children. Doctoral dissertation, University of Hong Kong.
4. Li, L. & Zhou, J. (李林慧, 周兢). (2008). 同伴对话语料库. 华东师范大学.
5. Mai, Z. et al. (2024). BJCMC: Beijing Child Mandarin Corpus. IASCL-2024, Prague.
6. 张亦斌, MacWhinney, B., & 周兢. (2024). Indicators for Building a Norm-Referenced Dataset. Sage Open, 14(1).
7. Core Knowledge Foundation. CKLA/CKSci Curriculum. CC BY-SA 4.0.
8. 徐琳, 潘海华, 等. 大连理工大学情感词汇本体.
9. BAAI (北京智源人工智能研究院). (2024). ChildMandarin: A Comprehensive Mandarin Speech Dataset for Young Children. arXiv:2409.18584.
10. Partnership for 21st Century Skills (P21). Framework for 21st Century Learning.
