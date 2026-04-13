#!/bin/bash
# call-agent.sh - 通过 OpenRouter API 调用外部模型
# 用法: ./call-agent.sh <model> <prompt_file> <output_file>
#
# model 可选值:
#   codex    → openai/codex-mini (代码实现)
#   gemini   → google/gemini-2.5-pro-preview-06-05 (设计规范)
#   自定义   → 直接传入 OpenRouter 模型 ID
#
# 示例:
#   ./call-agent.sh codex workflow/tmp/codex-prompt.md workflow/artifacts/codex-delivery.v1.md

set -euo pipefail

# ===== 检查 API Key =====
if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "❌ 未检测到 OPENROUTER_API_KEY"
  echo ""
  echo "请设置你的 OpenRouter API Key:"
  echo ""
  echo "  export OPENROUTER_API_KEY=\"你的key\""
  echo "  echo 'export OPENROUTER_API_KEY=\"你的key\"' >> ~/.zshrc"
  echo ""
  echo "获取 key: https://openrouter.ai/keys"
  exit 1
fi

# ===== 参数解析 =====
MODEL_ALIAS="${1:?用法: call-agent.sh <model> <prompt_file> <output_file>}"
PROMPT_FILE="${2:?缺少 prompt_file 参数}"
OUTPUT_FILE="${3:?缺少 output_file 参数}"

if [ ! -f "$PROMPT_FILE" ]; then
  echo "❌ Prompt 文件不存在: $PROMPT_FILE"
  exit 1
fi

# ===== 模型映射 =====
case "$MODEL_ALIAS" in
  codex)
    MODEL_ID="openai/codex-mini"
    ;;
  gemini)
    MODEL_ID="google/gemini-2.5-pro-preview-06-05"
    ;;
  *)
    MODEL_ID="$MODEL_ALIAS"
    ;;
esac

echo "🤖 调用模型: $MODEL_ID"
echo "📄 Prompt: $PROMPT_FILE"
echo "📝 输出: $OUTPUT_FILE"

# ===== 读取 prompt 内容并转义 =====
PROMPT_CONTENT=$(cat "$PROMPT_FILE")

# 转义 JSON 特殊字符
ESCAPED_CONTENT=$(echo "$PROMPT_CONTENT" | python3 -c "
import sys, json
content = sys.stdin.read()
print(json.dumps(content)[1:-1])
")

# ===== 调用 OpenRouter API =====
RESPONSE=$(curl -s -w "\n%{http_code}" "https://openrouter.ai/api/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d "{
    \"model\": \"$MODEL_ID\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": \"$ESCAPED_CONTENT\"
      }
    ],
    \"max_tokens\": 16000
  }")

# ===== 解析响应 =====
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
  echo "❌ API 调用失败 (HTTP $HTTP_CODE)"
  echo "$BODY" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'error' in data:
        print(f\"错误: {data['error'].get('message', data['error'])}\")
    else:
        print(json.dumps(data, indent=2))
except:
    print(sys.stdin.read())
" 2>/dev/null || echo "$BODY"
  exit 1
fi

# ===== 提取内容并写入输出文件 =====
mkdir -p "$(dirname "$OUTPUT_FILE")"

echo "$BODY" | python3 -c "
import sys, json
data = json.load(sys.stdin)
content = data['choices'][0]['message']['content']
print(content)
" > "$OUTPUT_FILE"

echo "✅ 完成，结果已写入: $OUTPUT_FILE"
