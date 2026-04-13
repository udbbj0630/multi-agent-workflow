# Multi-Agent Workflow Protocol

多 Agent 协作工作流协议，用于 Claude Code 环境下的 vibe coding 流程管理。

## 核心理念

- **显性交接**：所有阶段通过文件交接，不依赖对话复述
- **证据式完成**：交付必须附带验收映射和风险自评
- **分级执行**：L0-L3 四级任务分级，避免过度流程化
- **单一事实来源**：`registry.yaml` 统一管理全局状态

## 安装

```bash
# 1. 克隆仓库
git clone https://github.com/udbbj0630/multi-agent-workflow.git ~/.claude/skills/workflow

# 2. 设置 OpenRouter API Key（只需一次）
echo 'export OPENROUTER_API_KEY="你的key"' >> ~/.zshrc
source ~/.zshrc

# 获取 key: https://openrouter.ai/keys
```

## 使用

在 Claude Code 中，以下方式均可触发：

- "用工作流来做这个功能"
- "走 L2 流程"
- "这个任务走 L3"
- `/workflow`

不提及工作流相关词汇时，不会触发。

Claude Code 会自动通过 OpenRouter API 调用 Codex 和 Gemini，无需手动搬运。

## 任务分级

| 级别 | 适用场景 | 流程 |
|------|----------|------|
| L0 | 改文案、修样式 | 直接执行 + 记录 |
| L1 | 小功能、小 bug | Spec Lite → 执行 → Evidence Lite |
| L2 | 普通功能开发 | 完整七阶段流程 |
| L3 | 支付/认证/迁移等高风险 | 全流程强制 + 双审查 |

## 目录结构

```
.
├── SKILL.md                  # 主入口：流程调度 + 自动化指令
├── README.md                 # 本文件
├── scripts/                  # 自动调度脚本
│   ├── call-agent.sh         # 通过 OpenRouter 调用外部模型
│   └── assemble-prompt.sh    # 组装 prompt + 上下文文件
├── templates/                # 工件模板
│   ├── spec-pack.md
│   ├── understanding-lock.md
│   ├── evidence-handoff.md
│   ├── revision-brief.md
│   └── registry.yaml
└── prompts/                  # 阶段 prompt 模板
    ├── spec-challenge.md
    ├── codex-execute.md
    ├── gemini-execute.md
    ├── review.md
    └── decision.md
```

## 更新

```bash
cd ~/.claude/skills/workflow
git pull
```
