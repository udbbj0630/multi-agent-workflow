#!/bin/bash
# assemble-prompt.sh - 组装完整 prompt：模板 + 上下文文件
# 用法: ./assemble-prompt.sh <prompt_template> <output_prompt> [context_files...]
#
# 将 prompt 模板和相关上下文文件合并成一个完整的 prompt 文件
# 供 call-agent.sh 使用
#
# 示例:
#   ./assemble-prompt.sh prompts/codex-execute.md workflow/tmp/codex-prompt.md \
#     workflow/artifacts/spec-pack.v1.md workflow/artifacts/codex-lock.v1.md

set -euo pipefail

TEMPLATE="${1:?用法: assemble-prompt.sh <prompt_template> <output_prompt> [context_files...]}"
OUTPUT="${2:?缺少 output_prompt 参数}"
shift 2

if [ ! -f "$TEMPLATE" ]; then
  echo "❌ 模板文件不存在: $TEMPLATE"
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"

# 写入 prompt 模板
{
  echo "# === 执行指令 ==="
  echo ""
  cat "$TEMPLATE"
  echo ""

  # 追加每个上下文文件
  for CONTEXT_FILE in "$@"; do
    if [ -f "$CONTEXT_FILE" ]; then
      echo "---"
      echo "# === 上下文文件: $(basename "$CONTEXT_FILE") ==="
      echo ""
      cat "$CONTEXT_FILE"
      echo ""
    else
      echo "# ⚠ 文件不存在: $CONTEXT_FILE"
    fi
  done
} > "$OUTPUT"

echo "✅ Prompt 已组装: $OUTPUT ($(wc -c < "$OUTPUT" | tr -d ' ') bytes)"
