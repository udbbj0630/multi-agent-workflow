# Uli Brain — 独立智能模块架构方案

> 目标：将 uli 从"套壳 AI"升级为有科学基础的儿童认知发展伴侣
> 范围：学龄前（3-6 岁），中国市场优先
> 形态：独立微服务，通过 REST/WebSocket 与 uli 主程序对接

---

## 一、现状审计 — uli 目前有什么、缺什么

### 已有的（做得不错的）

| 模块 | 文件 | 完成度 | 评价 |
|------|------|--------|------|
| 4C 评分 | `assessment.ts` | 70% | 架构合理，EMA 平滑 + LLM/关键词双模式。缺年龄常模 |
| 人格系统 | `prompts/personality.md` | 85% | 呜哩人设完整温暖，年龄适配指令在 LLM 层 |
| 记忆系统 | `store.ts` + `llm.ts` | 75% | 提取/存储/检索闭环，5 类分类。缺去噪和衰减 |
| 叙事生成 | `narrative.ts` + `llm.ts` | 65% | 每周成长信，24h 缓存。缺归档和推送 |
| 数据持久化 | `store.ts` | 80% | SQLite WAL，8 表，migration 机制健壮 |
| 对话管道 | `session.ts` | 75% | WebSocket 完整流程：开始→聊天→结束→评分→记忆提取 |

### 缺失的（关键短板）

| 短板 | 严重程度 | 说明 |
|------|---------|------|
| **知识库** | 致命 | 只有 5 个硬编码概念（苹果/恐龙/月亮/水/猫），无语义匹配，无法扩展 |
| **安全层** | 致命 | 无输入安全检测，无输出内容审核，LLM 可以输出任何内容 |
| **词汇控制** | 严重 | 无年龄词汇边界，LLM 可能用超出孩子理解能力的词汇 |
| **认知评分** | 重要 | 只有 4C（社交情感），缺认知发展维度（词汇/推理/记忆/知识广度） |
| **年龄常模** | 重要 | 评分是绝对值（30-100），无法判断"50 分对 4 岁孩子算好还是差" |
| **情绪检测** | 中等 | 不检测孩子情绪状态，无法触发安慰/鼓励策略 |
| **对话策略** | 中等 | `generateGuidance` 只选最弱维度，缺少注意力节奏和话题转换 |
| **可读性检测** | 中等 | 输出无质量门控，可能太长/太复杂/包含不当内容 |

### 结论

uli 目前是一个**功能完整的聊天机器人框架**，但不是一个**有科学基础的儿童发展工具**。核心差距在于：没有安全网、知识引擎太薄弱、评分缺乏科学依据。

---

## 二、Brain 模块架构

```
┌─────────────────────────────────────────────────┐
│                   uli 主程序                      │
│         (React + Node.js + Socket.IO)            │
│                                                   │
│   Chat.tsx ←→ session.ts ←→ WebSocket            │
└──────────────┬──────────────────────┬─────────────┘
               │ REST API             │
               ▼                      ▼
┌──────────────────────────────────────────────────┐
│              Uli Brain（独立服务）                  │
│                                                    │
│  ┌─────────┐  ┌──────────┐  ┌────────────────┐   │
│  │ Safety  │→ │Vocabulary│→ │   Knowledge    │   │
│  │ Layer   │  │ Control  │  │   Engine       │   │
│  └─────────┘  └──────────┘  └───────┬────────┘   │
│                                     │             │
│  ┌─────────┐  ┌──────────┐         ▼             │
│  │Output   │← │   LLM    │← ┌────────────────┐   │
│  │Quality  │  │ Gateway  │  │  Assessment     │   │
│  │ Gate    │  │          │  │  Engine (4C+4D) │   │
│  └─────────┘  └──────────┘  └────────────────┘   │
│                                                    │
│  ┌──────────────────────────────────────────────┐ │
│  │           Data Layer (SQLite + JSON)          │ │
│  │  识字表 │ 知识图谱 │ 敏感词库 │ 年龄常模      │ │
│  └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### 数据流

```
孩子输入
  │
  ▼
① Safety.inputGuard(text)
  │ 检测：敏感词 / 危险内容 / 个人信息请求
  │ 结果：PASS / REDIRECT / BLOCK
  │
  ▼
② Vocabulary.detectAge(text)
  │ 分析孩子用词 → 推测语言发展水平（辅助校准年龄）
  │
  ▼
③ Knowledge.retrieve(topic, age)
  │ 从知识图谱查找 → 返回该年龄段的 can_say / cannot_say
  │
  ▼
④ LLM Gateway.generate(prompt, boundary, vocab_limit)
  │ 构建 system prompt（含人格 + 知识边界 + 词汇边界 + 对话策略）
  │ 调用 LLM
  │
  ▼
⑤ OutputQuality.check(reply, age)
  │ 识字率检测（回复中的字是否在年龄段词表内）
  │ 句长检测（不超过年龄 × 3 个字）
  │ 禁用词复查
  │ 不通过 → 触发改写（最多 2 次）
  │
  ▼
⑥ Assessment.observe(childTurns)
  │ 实时采集信号：4C（社交情感）+ 4D（认知发展）
  │ 映射到年龄常模百分位
  │
  ▼
返回给 uli 主程序
```

---

## 三、七大模块详细设计

### 模块 1：安全层 Safety Layer

**现状**：无。

**目标**：三层安全门控，输入端 + 输出端各跑一次。

```
输入端：
  ├── 第一层：本地敏感词库（fwwdn/sensitive-stop-words）
  │   色情 + 涉枪涉爆 + 广告 → 直接 BLOCK
  │
  ├── 第二层：LLM 语义安全检测
  │   用小模型（DeepSeek/Qwen）快速判断是否涉及：
  │   暴力/自伤/性/歧视/极端 → BLOCK 或 REDIRECT
  │
  └── 第三层：儿童特有规则（NeMo Guardrails 风格）
      "怎么打人" → "这个我没办法告诉你"
      "你家住哪里" → "我不需要知道这些哦"
      "怎么制作xx" → REDIRECT

输出端：
  ├── 禁用词复查
  ├── 长度门控（3岁≤30字, 4岁≤40字, 5岁≤50字, 6岁≤60字）
  └── 内容安全 LLM 检查（可疑回复二次审核）
```

**数据来源**：
- 基础词库：`fwwdn/sensitive-stop-words`（Apache 2.0，直接 clone）
- 儿童补充词：从 NSPCC 指南 + 中国教育部安全规范整理（约 200 词，我生成）
- 规则引擎：参考 NeMo Guardrails 的 Colang 格式，用 TypeScript 实现（不引入 NeMo 依赖）

**uli 对接点**：`session.ts` 的 `text` handler 中，在调用 `chatStream` 之前插入 `safety.inputGuard()`，在收到回复后插入 `safety.outputGuard()`。

---

### 模块 2：词汇控制 Vocabulary Control

**现状**：`personality.md` 有一句"请用适合这个年龄的语言"，但这完全依赖 LLM 自觉。

**目标**：量化的年龄词汇边界。

#### 2.1 识字表（核心数据文件）

```json
// data/char_set.json
{
  "age3": {
    "chars": "一二人三个上下大小多少日月水火木土...",  // ~400 字
    "maxSentenceLength": 8,
    "description": "3岁：日常基本字"
  },
  "age4": {
    "chars": "...",  // ~800 字（含 age3）
    "maxSentenceLength": 12,
    "description": "4岁：加描述性字词"
  },
  "age5": {
    "chars": "...",  // ~1500 字（含 age3-4）
    "maxSentenceLength": 16,
    "description": "5岁：基础表达词汇"
  },
  "age6": {
    "chars": "...",  // ~2500 字（含 age3-5）
    "maxSentenceLength": 20,
    "description": "6岁：幼小衔接"
  }
}
```

**生成方式**：
1. 教育部《义务教育语文课程标准》附录常用字表（3000 字）→ 按 frequency 分级
2. 参考《3-6岁儿童学习与发展指南》语言领域各年龄段目标
3. LLM 辅助扩展和校验
4. 最终由幼儿教师审核（建议找 1-2 位老师花半天校验）

#### 2.2 可读性检测函数

```typescript
function checkReadability(text: string, age: number): {
  pass: boolean;
  outOfRange: string[];  // 超纲的字
  avgSentenceLength: number;
} {
  const charSet = CHAR_SETS[`age${age}`];
  const chars = [...text].filter(c => /[\u4e00-\u9fff]/.test(c));
  const outOfRange = chars.filter(c => !charSet.includes(c));
  const sentences = text.split(/[。！？.!?]/);
  const avgLen = sentences.reduce((s, t) => s + t.length, 0) / sentences.length;

  return {
    pass: outOfRange.length <= 1 && avgLen <= MAX_SENTENCE_LENGTH[age],
    outOfRange: [...new Set(outOfRange)],
    avgSentenceLength: avgLen,
  };
}
```

**关键区别**：国际版用 `textstat.flesch_kincaid_grade()`，这是英语专用（基于音节数）。中文不能用。我们用**识字率 + 句长**双指标，这在中国教育体系中是标准的可读性度量方式。

---

### 模块 3：知识引擎 Knowledge Engine

**现状**：`knowledge.ts` 只有 5 个硬编码概念，`detectConcept()` 用简单的 `text.includes()` 匹配。

**目标**：覆盖学龄前 50 个核心话题的知识图谱，支持模糊匹配。

#### 3.1 知识图谱结构

```json
// data/knowledge_graph.json
[
  {
    "id": "solar_system",
    "concepts": ["太阳", "月亮", "星星", "地球", "天空"],
    "levels": [
      {
        "minAge": 3, "maxAge": 4,
        "can_say": ["太阳在天上很亮", "月亮有时圆有时弯", "晚上能看到星星"],
        "cannot_say": ["公转", "自转", "引力", "行星", "光年"],
        "redirect": "这个问题太神奇了！你可以和爸爸妈妈一起查查看"
      },
      {
        "minAge": 5, "maxAge": 6,
        "can_say": ["地球是我们住的地方", "月亮绕着地球转", "太阳给我们光和热"],
        "cannot_say": ["核聚变", "开普勒定律", "万有引力"],
        "redirect": "太空的秘密好多呀！等上学了老师会教你的"
      }
    ]
  }
]
```

#### 3.2 主题列表（学龄前 50 个话题，6 大类）

> 详细框架见 [curriculum-topics-framework.md](./curriculum-topics-framework.md)
>
> 来源：Core Knowledge Sequence (CKLA K 12 Domains + CK Preschool 10 领域) × 中国教育部《3-6岁儿童学习与发展指南》(5 领域/14 子领域/32 目标)
> 美国特有主题（如 Native Americans, Columbus, Presidents）已替换为中国对应内容

**A. 自然与科学（14 个）**
A1 动物世界、A2 植物、A3 天气与季节、A4 水、A5 太阳月亮星星、A6 光与影、A7 声音、A8 身体、A9 五官感知、A10 食物与营养、A11 生长与变化、A12 地球与环境、A13 恐龙与远古、A14 材料与工具

**B. 语言与文学（8 个）**
B1 儿歌与韵律、B2 经典故事、B3 寓言故事、B4 童话、B5 中国传统故事、B6 诗歌与古诗词、B7 字与书写、B8 讲故事与表达

**C. 社会与文化（10 个）**
C1 家庭、C2 友谊与分享、C3 情绪认知、C4 职业、C5 社区与城市、C6 交通工具、C7 中国文化、C8 世界各地、C9 规则与安全、C10 节日与庆祝

**D. 数学思维（6 个）**
D1 数数与数量、D2 形状、D3 颜色、D4 大小与比较、D5 模式与规律、D6 空间与方向

**E. 艺术与创造力（6 个）**
E1 绘画与颜色、E2 音乐与节奏、E3 手工与制作、E4 想象与编故事、E5 舞蹈与运动、E6 欣赏与美感

**F. 生活技能（6 个）**
F1 日常自理、F2 时间概念、F3 金钱与交换、F4 帮助与关心、F5 解决问题、F6 好奇心与探索

#### 3.3 主题检测升级

现有 `detectConcept()` 用 `text.includes()`，太弱。升级方案：

```typescript
// 方案 A：关键词多义词匹配（推荐，零依赖）
function detectTopics(text: string): string[] {
  return KNOWLEDGE_GRAPH
    .filter(entry => entry.concepts.some(c => text.includes(c)))
    .map(entry => entry.id);
}

// 方案 B（可选增强）：bge-small-zh 向量匹配
// 对知识主题做 embedding，对孩子输入做 embedding，余弦相似度 > 0.6 则匹配
// 引入 chromadb 或直接用 onnxruntime 推理
// 50 个话题关键词匹配已基本够用，扩展到 100+ 再启用向量检索
```

**建议**：先用方案 A，50 个话题关键词匹配够用。扩展到 100+ 再引入向量检索。

#### 3.4 知识条目生成策略

50 个话题 × 2 个年龄段 = 100 组知识条目。用 LLM 批量生成：

```
Prompt 模板：
"你是一名幼儿教育专家。请为"{topic}"这个主题，分别写出适合 3-4 岁和 5-6 岁儿童的知识讲解。
每个年龄段需要：
- can_say: 3-5 个可以用简单语言描述的知识点
- cannot_say: 3-5 个不应涉及的概念或词汇
- redirect: 当孩子问到超纲内容时的引导语

要求：符合中国《3-6岁儿童学习与发展指南》"
```

成本：约 100 次 LLM 调用，GPT-4o-mini 约 ¥5-8。

---

### 模块 4：评分引擎 Assessment Engine（4C + 4D）

**现状**：4C 评分（创造力/批判性思维/沟通力/协作力），0-100 绝对分，无年龄常模。

**目标**：4C（社交情感）+ 4D（认知发展）双轨评分，带年龄常模百分位。

#### 4.1 认知发展维度（4D — 新增）

| 维度 | 英文 | 观察什么 | 对应 WPPSI 维度 | 数据采集方式 |
|------|------|---------|----------------|-------------|
| 词汇广度 | vocabulary | 使用的不同字/词数量 | 言语理解 | 自动统计 |
| 语言推理 | reasoning | 因果/类比/假设性表达 | 流体推理 | 关键词 + LLM |
| 记忆能力 | memory | 回忆之前对话内容的能力 | 工作记忆 | 主动回测 |
| 知识广度 | knowledge | 对多主题有先验知识 | 常识 | 话题覆盖率统计 |

#### 4.2 年龄常模（新增）

```json
// data/age_norms.json
{
  "vocabulary": {
    "age3": { "p10": 5, "p25": 10, "p50": 15, "p75": 25, "p90": 35 },
    "age4": { "p10": 10, "p25": 18, "p50": 28, "p75": 40, "p90": 55 },
    "age5": { "p10": 20, "p25": 30, "p50": 45, "p75": 60, "p90": 80 },
    "age6": { "p10": 35, "p25": 50, "p50": 70, "p75": 90, "p90": 120 }
  },
  "reasoning": {
    "age3": { "p10": 0, "p25": 1, "p50": 2, "p75": 3, "p90": 4 },
    "age4": { "p10": 1, "p25": 2, "p50": 3, "p75": 5, "p90": 7 },
    "age5": { "p10": 2, "p25": 3, "p50": 5, "p75": 7, "p90": 10 },
    "age6": { "p10": 3, "p25": 5, "p50": 7, "p75": 10, "p90": 14 }
  }
}
```

> 来源：中国学术文献（CCDCS, ASQ 中文常模）的公开百分位数据 + LLM 辅助插值。
> 注意：初始版本数据不必完美，有参考系就比绝对值强 10 倍。上线后用真实数据回归校准。

#### 4.3 评分呈现

```
uli 家长端仪表板（升级后）

┌─────────────────────────────────────┐
│  社交情感能力 (4C)    认知发展 (4D)  │
│                                       │
│  ┌─ 创造力 ──┐        ┌─ 词汇 ──┐   │
│  │   72  ████│ P65    │  68  ███ │P50│
│  └───────────┘        └─────────┘    │
│  ┌─ 批判思维 ─┐      ┌─ 推理 ──┐    │
│  │   58  ███ │ P40   │  45  ██  │P30│
│  └───────────┘        └─────────┘    │
│  ┌─ 沟通力 ──┐        ┌─ 记忆 ──┐   │
│  │   65  ███ │ P55   │  70  ███ │P60│
│  └───────────┘        └─────────┘    │
│  ┌─ 协作力 ──┐        ┌─ 知识 ──┐   │
│  │   80  ████│ P75   │  55  ██  │P45│
│  └───────────┘        └─────────┘    │
│                                       │
│  * P65 = 超过同龄 65% 的孩子          │
└─────────────────────────────────────┘
```

---

### 模块 5：情绪引擎 Emotion Engine

**现状**：无。`session.ts` 的 `Turn` 表有 `emotion_tag` 字段但未使用。

**目标**：实时检测孩子情绪，影响回复策略。

#### 5.1 情绪分类

```typescript
type ChildEmotion = 'joy' | 'curiosity' | 'confusion' | 'sadness' | 'fear' | 'anger' | 'neutral';

// 关键词初步检测（零延迟）
const EMOTION_KEYWORDS = {
  joy: ['开心', '高兴', '太棒了', '哈哈', '好玩', '喜欢', '厉害'],
  curiosity: ['为什么', '怎么', '什么', '真的吗', '然后呢', '是什么'],
  confusion: ['不懂', '不明白', '什么意思', '不知道', '听不懂'],
  sadness: ['难过', '伤心', '想妈妈', '不开心', '哭', '不想'],
  fear: ['害怕', '吓', '恐怖', '怪物', '黑'],
  anger: ['讨厌', '生气', '不要', '不行', '讨厌'],
};

// LLM 二次确认（可选，对 sadness/fear/anger 触发）
// 只在关键词检测到负面情绪时才调用，节省成本
```

#### 5.2 策略映射

| 情绪 | 回复策略 |
|------|---------|
| joy | 共享兴奋，引导深入表达 |
| curiosity | 鼓励提问，提供适龄知识 |
| confusion | 换更简单的方式解释，用具象比喻 |
| sadness | 先共情（"听起来你有点难过"），不急于解决问题 |
| fear | 安慰 + 转移注意力到安全话题 |
| anger | 接纳情绪（"你看起来有点不高兴"），不否定 |
| neutral | 主动抛问题，提高参与度 |

#### 5.3 对接 uli

`session.ts` 的 `Turn` 表已有 `emotion_tag` 字段。Brain 模块在处理每轮对话时检测情绪，返回给 uli，uli 存入 `emotion_tag`。后续 `emotionArc` 可用于叙事生成。

---

### 模块 6：对话策略 Conversation Strategy

**现状**：`generateGuidance()` 只选最弱维度推荐话题，没有注意力管理。

**目标**：基于情绪 + 注意力 + 评分的综合策略。

#### 6.1 注意力节奏

```typescript
// 国际版方案直接翻译
const MAX_TOPIC_TURNS = { 3: 4, 4: 5, 5: 6, 6: 8 };

function shouldSwitchTopic(ctx: ConversationContext): boolean {
  // 同一话题超过年龄上限 → 转换
  if (ctx.topicTurns > MAX_TOPIC_TURNS[ctx.childAge]) return true;
  // 连续 2 次超短回复（<5字）→ 可能失去兴趣
  if (ctx.lastTwoReplies.every(r => r.length < 5)) return true;
  // 检测到负面情绪持续 → 转到轻松话题
  if (ctx.consecutiveNegativeEmotions >= 2) return true;
  return false;
}
```

#### 6.2 话题转换话术

```typescript
const TRANSITIONS = [
  '哎，你知道一个有趣的事情吗？',
  '呜哩突然想到一个问题想问你！',
  '要不我们来玩个猜谜游戏？',
  '对了，你最喜欢什么颜色呀？',
  '呜哩想跟你讲一个小故事……',
];
```

---

### 模块 7：输出质检 Output Quality Gate

**现状**：无。LLM 输出直接发给前端。

**目标**：输出必须通过 3 道检查才能发给用户。

```typescript
interface QualityCheckResult {
  pass: boolean;
  reason?: string;
  rewrittenReply?: string;
}

async function qualityGate(reply: string, age: number): Promise<QualityCheckResult> {
  // ① 识字率检查
  const readability = checkReadability(reply, age);
  if (!readability.pass) {
    return { pass: false, reason: `超纲字: ${readability.outOfRange.join(',')}` };
  }

  // ② 句长检查
  const sentences = reply.split(/[。！？]/);
  const maxLen = (age + 2) * 4;  // 3岁→20字, 6岁→32字
  const tooLong = sentences.find(s => s.length > maxLen);
  if (tooLong) {
    return { pass: false, reason: `句子过长: ${tooLong.length}字` };
  }

  // ③ 安全复查
  const safeCheck = outputSafetyCheck(reply);
  if (!safeCheck.safe) {
    return { pass: false, reason: `不安全内容: ${safeCheck.flag}` };
  }

  return { pass: true };
}

// 质检不通过 → 要求 LLM 改写（最多 2 次）
// 2 次都不通过 → 使用预设安全回复
```

---

## 四、技术栈

| 组件 | 选择 | 理由 |
|------|------|------|
| 运行时 | Node.js + TypeScript | 与 uli 一致，团队无学习成本 |
| 框架 | Fastify | 比 Express 快 2x，内置 TypeScript 支持 |
| 数据库 | SQLite (better-sqlite3) | 与 uli 一致，无额外运维 |
| 向量检索 | 暂不用 | 50 个话题关键词够用，100+ 再引入 |
| LLM | OpenRouter (DeepSeek/Qwen) | 与 uli 现有配置一致 |
| Embedding | bge-small-zh-v1.5（预留） | MIT，本地推理，后续知识扩展用 |
| 敏感词 | fwwdn/sensitive-stop-words | Apache 2.0，直接 clone |
| 通信 | REST API + WebSocket 事件 | uli 通过 HTTP 调用 Brain |

### 目录结构

```
uli-brain/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts              # Fastify 服务入口
│   ├── routes/
│   │   ├── chat.ts           # POST /chat — 主对话接口
│   │   ├── assess.ts         # POST /assess — 评分接口
│   │   └── health.ts         # GET /health
│   ├── services/
│   │   ├── safety.ts         # 安全层
│   │   ├── vocabulary.ts     # 词汇控制 + 可读性检测
│   │   ├── knowledge.ts      # 知识引擎（知识图谱 + 主题检测）
│   │   ├── assessment.ts     # 评分引擎（4C + 4D + 常模）
│   │   ├── emotion.ts        # 情绪检测
│   │   ├── strategy.ts       # 对话策略
│   │   └── qualityGate.ts    # 输出质检
│   ├── data/
│   │   ├── char_set.json     # 年龄识字表
│   │   ├── knowledge_graph.json  # 知识图谱
│   │   ├── sensitive_words.json  # 敏感词库
│   │   ├── age_norms.json    # 年龄常模
│   │   └── safety_rules.json # 儿童特有安全规则
│   └── types.ts              # 共享类型
└── scripts/
    ├── generate-char-set.ts  # 生成识字表
    ├── generate-knowledge.ts # 批量生成知识条目
    └── import-sensitive-words.ts  # 导入敏感词库
```

---

## 五、uli 主程序对接方案

### API 接口设计

```typescript
// POST /api/chat
interface ChatRequest {
  childText: string;         // 孩子本轮输入
  childAge: number;          // 孩子年龄
  childId: string;           // 孩子ID（用于评分/记忆）
  conversationHistory: Array<{role: string; text: string}>;  // 最近对话
  childName?: string;
}

interface ChatResponse {
  reply: string;             // AI 回复（已通过质检）
  emotion: ChildEmotion;     // 检测到的情绪
  topics: string[];          // 检测到的知识主题
  signals: string[];         // 本次采集到的评分信号
  qualityGrade: number;      // 回复可读性等级
  metadata: {
    safetyPassed: boolean;
    readabilityScore: number;
    rewriteCount: number;    // 改写次数
    latencyMs: number;
  };
}

// POST /api/assess
interface AssessRequest {
  childId: string;
  childAge: number;
  childTurns: string[];
}

interface AssessResponse {
  social4C: { creativity, criticalThinking, communication, collaboration };
  cognitive4D: { vocabulary, reasoning, memory, knowledge };
  percentileRank: Record<string, number>;  // 各维度百分位
  detectedSignals: string[];
  recommendations: string[];  // 给家长的互动建议
}
```

### session.ts 改造点

```diff
// 现有流程：
socket.on('text', async (payload) => {
  const text = payload.text;
- addTurn(sessionId, 'child', text);
- // 直接调用 chatStream
- const reply = await chatStream(messages, options);

// 改造后：
+ const brainResult = await brain.chat({
+   childText: text,
+   childAge: ctx.childAge,
+   childId: ctx.childId,
+   conversationHistory: ctx.messages,
+   childName: ctx.childName,
+ });
+
+ addTurn(sessionId, 'child', text, brainResult.emotion);
+ addTurn(sessionId, 'uli', brainResult.reply);
+ // emotion_tag 终于有数据了
});
```

---

## 六、科学基础对照表

这份文档提到的每个设计决策的科学依据：

| 设计决策 | 依据 | 来源 |
|---------|------|------|
| 4C 评分维度 | 21st Century Skills 框架 | NEA, P21 白皮书 |
| 4D 认知维度 | WPPSI-IV (韦氏学龄前) 的言语理解/流体推理/工作记忆/常识 | Pearson Clinical |
| 年龄常模百分位 | 标准化测评的百分位排名方法 | 心理测量学基础 |
| EMA 平滑 | 指数移动平均消除单次波动 | uli 已有实现 |
| 识字率可读性 | 中国语文教育传统的识字率指标 | 教育部课程标准 |
| 句长控制 | CHILDES 研究中的儿童 MLU（平均句长）指标 | Roger Brown, 1973 |
| 知识深度分级 | Vygotsky 最近发展区理论 (ZPD) | Mind in Society, 1978 |
| 情绪先共情策略 | Gottman 情绪辅导 (Emotion Coaching) | Raising an Emotionally Intelligent Child |
| 注意力节奏 | 儿童注意持续时间研究 | 3岁~5min, 5岁~10min, 6岁~15min |
| 安全层三级设计 | 中国《未成年人网络保护条例》+ COPPA | 国务院/FTC |
| 话题覆盖率统计 | ASQ (Ages & Stages) 问卷的认知发展维度 | Brookes Publishing |

---

## 七、执行计划

### Phase 1：骨架搭建（1 周）

| 天 | 任务 | 产出 |
|----|------|------|
| 1 | 初始化 uli-brain 项目，Fastify + TypeScript | 可运行的服务骨架 |
| 2 | 生成识字表 `char_set.json` + 可读性检测 | vocabulary.ts |
| 3 | 导入敏感词库 + 输入安全检测 | safety.ts |
| 4 | 输出质检（识字率 + 句长 + 安全复查） | qualityGate.ts |
| 5 | LLM Gateway（从 uli 抽取，加入安全+词汇+知识注入） | 端到端可测试 |

**里程碑**：`POST /api/chat` 能返回经过安全检查 + 词汇控制的回复。

### Phase 2：知识 + 评分（1 周）

| 天 | 任务 | 产出 |
|----|------|------|
| 6-7 | LLM 批量生成 50 个话题的知识图谱 | knowledge_graph.json |
| 8 | 知识引擎（主题检测 + 知识边界注入） | knowledge.ts |
| 9 | 4D 认知评分 + 年龄常模 | assessment.ts 升级 |
| 10 | 评分 API + 百分位计算 | POST /api/assess |

**里程碑**：知识引擎覆盖 50 个话题，评分输出 4C+4D+百分位。

### Phase 3：情绪 + 策略 + 对接（1 周）

| 天 | 任务 | 产出 |
|----|------|------|
| 11 | 情绪检测（关键词 + LLM 可选确认） | emotion.ts |
| 12 | 对话策略（注意力节奏 + 话题转换） | strategy.ts |
| 13 | uli session.ts 对接 Brain API | uli 改造 |
| 14 | 端到端测试 + 家长端数据对接 | 全链路验证 |
| 15 | 调优 + Bug 修复 | 可内测版本 |

**里程碑**：uli 通过 Brain API 完成对话，安全+知识+评分+情绪全链路打通。

---

## 八、风险与待决策

| 风险 | 影响 | 缓解方案 |
|------|------|---------|
| 年龄常模数据不准确 | 评分百分位可能误导家长 | 初始版本标注"参考值"，用真实数据回归校准 |
| LLM 生成的知识条目质量参差 | 可能不适合儿童 | 教师审核 + 上线后收集反馈修正 |
| 敏感词误杀 | 正常对话被错误拦截 | 白名单机制（儿童常用词排除） |
| 识字表不完全 | 可读性误判 | 保守策略：不认识的字 ≤2 个就算通过 |
| Brain 服务宕机 | uli 无法对话 | 降级到直接调用 LLM（无安全网，但至少能用） |

### 待用户确认的决策

1. **Brain 部署方式**：同一台机器独立进程？还是 Docker？还是未来云部署？
2. **LLM 选择**：继续用 OpenRouter？还是换国内直连（通义千问/文心）？
3. **知识审核**：是否找幼儿教师审核知识条目？（强烈建议，¥2,000-5,000 可覆盖）
4. **合规审查**：产品上线前是否需要法律顾问审查安全机制？

---

## 九、与"套壳 AI"的根本区别

| | 套壳 AI | Uli + Brain |
|---|---------|------------|
| 知识边界 | LLM 想说什么说什么 | 按 3-6 岁分级，超纲自动截断 |
| 词汇控制 | 无 | 识字率 + 句长双门控，超标自动改写 |
| 安全 | 无 | 三层输入门控 + 三层输出质检 |
| 评分 | 无 or LLM 随意打分 | 8 维度（4C+4D）+ 年龄常模百分位 |
| 情绪 | 无 | 实时检测 + 策略调整 |
| 知识来源 | LLM 自带训练数据 | 外部知识图谱，可审查、可校准 |
| 对话策略 | 无 | 注意力节奏 + 弱项引导 + 话题转换 |
| 可解释性 | 黑盒 | 每个评分都有 evidence，每个回复都有 qualityGrade |
