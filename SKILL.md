---
name: multi-agent-workflow
description: 多 Agent 协作工作流协议。当用户提到"工作流"、"走流程"、"L0/L1/L2/L3"、"spec pack"、"workflow"时触发。
invocation: user
---

# 多 Agent 协作工作流协议

你是工作流调度器。当用户启动本协议时，按以下规则执行。

## 核心原则

1. **显性交接**：所有阶段之间通过文件交接，不通过对话复述
2. **证据式完成**：交付必须附带验收映射和风险自评
3. **单一事实来源**：`workflow/registry.yaml` 是全局状态中心
4. **分级执行**：不同规模的任务走不同流程，避免过度流程化
5. **自动调度**：通过 OpenRouter API 自动调用 Codex 和 Gemini，无需人工搬运

## 自动调度机制

本 skill 包含两个脚本，用于自动调用外部模型：

- `scripts/call-agent.sh <model> <prompt_file> <output_file>`：调用外部模型
- `scripts/assemble-prompt.sh <template> <output> [context_files...]`：组装 prompt

**模型映射**：
- `codex` → OpenRouter 上的 `openai/codex-mini`（代码实现）
- `gemini` → OpenRouter 上的 `google/gemini-2.5-pro-preview-06-05`（设计规范）

**调度流程**：当流程进入需要外部模型执行的阶段时，你必须：
1. 用 `assemble-prompt.sh` 将 prompt 模板与上下文文件组装成完整 prompt
2. 用 `call-agent.sh` 调用对应模型
3. 将返回结果保存到 `workflow/artifacts/` 并更新 registry

**首次使用检查**：执行任何脚本前，先运行：
```bash
SKILL_DIR="$(find ~/.claude/skills -name 'call-agent.sh' -exec dirname {} \; | head -1 | xargs dirname)"
chmod +x "$SKILL_DIR/scripts/call-agent.sh" "$SKILL_DIR/scripts/assemble-prompt.sh"
```
如果 `$OPENROUTER_API_KEY` 未设置，脚本会提示用户配置。

## 启动流程

用户启动工作流后，你必须：

1. 在项目根目录创建 `workflow/artifacts/` 和 `workflow/tmp/` 目录（如不存在）
2. 从本 skill 的 `templates/registry.yaml` 复制初始注册表到 `workflow/registry.yaml`
3. 根据用户描述判断任务级别（见下方分级标准）
4. 按对应级别的流程执行
5. 定位 skill 目录：`SKILL_DIR="$(find ~/.claude/skills -name 'call-agent.sh' -exec dirname {} \; | head -1 | xargs dirname)"`

## 任务分级标准

评估以下三项：
- 是否超过一个 Agent（需要 Codex + Gemini 协作）
- 是否跨多个文件或模块
- 是否涉及高风险域（支付、认证、权限、数据迁移）

| 级别 | 条件 | 流程 |
|------|------|------|
| L0 | 改文案、修样式、单行修复 | 直接执行 → 在 registry 补一行记录 |
| L1 | 满足 0-1 项，预估 30 分钟内 | Spec Pack Lite → 执行 → Evidence Handoff Lite |
| L2 | 满足 2 项，预估半天到两天 | 完整流程（Spec Challenge 可选） |
| L3 | 涉及高风险域，预估两天以上 | 全流程强制，含 Spec Challenge + 双审查 |

如果用户直接指定了级别（如"走 L2"），使用用户指定的级别。
如果用户未指定，你判断后向用户确认。

## 阶段流程

### L0：直接执行

1. 直接完成任务
2. 在 `workflow/registry.yaml` 的 `quick_log` 中追加一条记录：日期、改了什么、为什么改

### L1：轻量流程

1. **Spec Pack Lite**：在 `workflow/artifacts/` 下创建 `spec-lite.md`，只写：目标、验收标准、约束（3-5 行）
2. **执行**：由你（Claude）直接完成实现
3. **Evidence Handoff Lite**：在 `workflow/artifacts/` 下创建 `evidence-lite.md`，只写：完成了什么、验收标准是否满足、一个最可能出问题的点
4. 更新 `workflow/registry.yaml`

### L2：标准流程

按以下顺序执行每个阶段。每个阶段开始前，读取 registry。每个阶段结束后，更新 registry。

#### ① Spec Pack
- 你（Claude）读取 `$SKILL_DIR/templates/spec-pack.md` 模板
- 产出 `workflow/artifacts/spec-pack.v{N}.md`

#### ② Spec Challenge（可选，需求有歧义时开启）
- 组装 prompt：
  ```bash
  $SKILL_DIR/scripts/assemble-prompt.sh $SKILL_DIR/prompts/spec-challenge.md workflow/tmp/challenge-codex.md workflow/artifacts/spec-pack.v{N}.md
  ```
- 调用 Codex 做可实现性检查：
  ```bash
  $SKILL_DIR/scripts/call-agent.sh codex workflow/tmp/challenge-codex.md workflow/artifacts/challenge-codex.v{N}.md
  ```
- 同理调用 Gemini 做可设计性检查
- 你（Claude）综合 Challenge 结果，决定是否修改 Spec Pack

#### ③ Understanding Lock
- 为每个执行 Agent 组装 prompt 并调用：
  ```bash
  $SKILL_DIR/scripts/assemble-prompt.sh $SKILL_DIR/templates/understanding-lock.md workflow/tmp/codex-lock-prompt.md workflow/artifacts/spec-pack.v{N}.md
  $SKILL_DIR/scripts/call-agent.sh codex workflow/tmp/codex-lock-prompt.md workflow/artifacts/codex-lock.v{N}.md
  ```
- 你（Claude）检查每个 Lock 文件，确认三项：
  1. 是否遗漏关键目标
  2. 是否误解边界或硬约束
  3. 锁定参数与可自决参数是否分对了
- 确认结果：`confirmed` 或 `rework-lock`
- **未 confirmed 不得进入下一阶段**

#### ④ 执行
- 为 Codex 组装完整 prompt（含 spec-pack + codex-lock + evidence-handoff 模板）：
  ```bash
  $SKILL_DIR/scripts/assemble-prompt.sh $SKILL_DIR/prompts/codex-execute.md workflow/tmp/codex-exec-prompt.md \
    workflow/artifacts/spec-pack.v{N}.md \
    workflow/artifacts/codex-lock.v{N}.md \
    $SKILL_DIR/templates/evidence-handoff.md
  $SKILL_DIR/scripts/call-agent.sh codex workflow/tmp/codex-exec-prompt.md workflow/artifacts/codex-delivery.v{N}.md
  ```
- 如果任务涉及设计，同理调用 Gemini
- 如果是 REVISE 轮次，额外附加 `revision-brief.v{N}.md` 作为上下文

#### ⑤ Evidence Handoff
- 从 Codex/Gemini 的交付物中提取 Evidence Handoff 部分
- 如果交付物中没有按模板格式填写 Evidence Handoff，你（Claude）根据交付内容补充生成
- 保存到 `workflow/artifacts/evidence.v{N}.md`
- **检查强制字段**：两个自评字段必须非空且具体

#### ⑥ 审查
- 组装审查 prompt，让 Codex 审 Gemini 产出（或反之）：
  ```bash
  $SKILL_DIR/scripts/assemble-prompt.sh $SKILL_DIR/prompts/review.md workflow/tmp/review-prompt.md \
    workflow/artifacts/spec-pack.v{N}.md \
    workflow/artifacts/evidence.v{N}.md \
    workflow/artifacts/codex-delivery.v{N}.md
  $SKILL_DIR/scripts/call-agent.sh gemini workflow/tmp/review-prompt.md workflow/artifacts/review.v{N}.md
  ```
- L2 单审查即可；L3 必须双异构审查

#### ⑦ 决策
- 你（Claude）读取所有审查报告和 Evidence Handoff
- 按 `$SKILL_DIR/prompts/decision.md` 中的标准做出 PASS / REVISE / REDO 决策
- **PASS**：提示用户做人工分层验收
- **REVISE**：生成 `revision-brief.v{N}.md`，回到阶段 ④，iteration + 1
- **REDO**：回到阶段 ①

### L3：全流程

与 L2 相同，但以下环节强制执行：
- Spec Challenge 不可跳过
- Understanding Lock 必须由用户人工确认 confirmed
- 审查阶段必须做双异构审查（Codex 审 Gemini 产出，Gemini 审 Codex 产出）
- Evidence Handoff 的两个强制字段不可省略

## 决策与迭代

- REVISE 不超过 3 次。超过 3 次则强制 REDO 或 PASS
- REVISE 时只回传 revision-brief，不回传完整历史
- 每次迭代 iteration 字段 + 1

## 人工分层验收

PASS 后提示用户按以下层次验收：

1. **必须满足**：功能是否正确、约束是否被遵守
2. **建议满足**：代码结构、可维护性
3. **高风险提醒**：安全边界、异常处理

## Registry 维护规则（Agent-managed）

- 每个阶段开始前：读取 `workflow/registry.yaml`
- 每个阶段结束后：更新对应字段、版本号、文件路径、状态
- 只更新自己负责的字段
- `status` 和 `final_decision` 只在决策阶段更新
- 并行执行时（L3），各 Agent 只写自己的产出文件，由 Claude 在收口阶段统一更新 registry

## 上下文管理

- 所有交接通过文件路径，不通过对话复述
- Understanding Lock 是结构化文件，不是对话中的回显
- REVISE 时只读取 Spec Pack + revision-brief，不读取完整历史
- 组装后的完整 prompt 保存在 `workflow/tmp/`，便于调试和回溯
