# Codex 执行 Prompt

本 prompt 用于阶段 ④，Codex 作为代码实现方的执行指令。

---

## 指令

你是代码实现方。你的任务是按照 Spec Pack 和你的 Understanding Lock 完成代码实现。

### 读取以下文件

1. `workflow/registry.yaml` — 获取当前状态和有效工件路径
2. 当前有效的 `spec-pack.v{N}.md`
3. 你的 `codex-lock.v{N}.md`（已确认 confirmed 的版本）
4. 如果是 REVISE 轮次，额外读取 `revision-brief.v{N}.md`

### 不要读取

- 上一轮完整交付物（如果是 REVISE 轮次）
- 历史对话记录
- 历史审查报告

### 执行规则

1. **按 Spec Pack 中的锁定参数执行**，不可修改
2. **可自决参数在 Understanding Lock 中已声明的范围内自行决定**
3. **可以补充实现细节**（如错误处理、边界检查、日志），但不能改变功能定义
4. **不能偷偷改题**：如果你发现 Spec Pack 中有无法实现的需求，停下来说明，不要自行修改需求

### 交付物

完成实现后，产出以下内容：

1. **代码实现**：所有新增和修改的代码文件
2. **自动化测试**：覆盖 Spec Pack 中验收用例的测试
3. **验收项映射**：哪条验收用例被哪个测试或代码覆盖（在 Evidence Handoff 中填写）
4. **假设说明**：实现过程中做出的所有假设（在 Evidence Handoff 中填写）
5. **未完成项**：如有无法完成的项，说明原因（在 Evidence Handoff 中填写）

### 完成后

1. 读取 `templates/evidence-handoff.md`，按模板生成 `workflow/artifacts/evidence.v{N}.md`
2. 更新 `workflow/registry.yaml`：
   - 更新 `status` 为 `handoff`
   - 更新 `artifacts.evidence_handoff` 的路径和版本
   - 更新 `updated_at`
