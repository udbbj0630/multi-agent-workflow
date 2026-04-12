/**
 * 4C 测评引擎 — 从对话行为中隐形评估孩子能力
 *
 * 基于 WISC-IV 魔改，通过对话信号打分
 * 不需要孩子知道在被测评
 */

// ============ 信号检测器 ============

interface Signal {
  dimension: 'creativity' | 'critical_thinking' | 'communication' | 'collaboration';
  weight: number;
  detected: boolean;
  description: string;
}

/**
 * 从单轮对话中检测 4C 信号
 */
function detectSignals(childText: string, allChildTexts: string[]): Signal[] {
  const signals: Signal[] = [];

  // === 创造力信号 ===

  // 发散词汇：想象、如果、假如、要是、可能、说不定、也许
  const divergentWords = ['想象', '如果', '假如', '要是', '可能', '说不定', '也许', '我觉得可以', '还可以', '另一个'];
  const hasDivergent = divergentWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'creativity', weight: 25, detected: hasDivergent,
    description: '使用发散性词汇',
  });

  // 词汇多样性：和之前说过的词差异
  const currentWords = new Set(childText.split(''));
  const prevWords = new Set(allChildTexts.flatMap((t) => t.split('')));
  const newWordRatio = allChildTexts.length > 0
    ? [...currentWords].filter((w) => !prevWords.has(w)).length / Math.max(currentWords.size, 1)
    : 0.5;
  signals.push({
    dimension: 'creativity', weight: 20, detected: newWordRatio > 0.3,
    description: '词汇多样性',
  });

  // 回答长度（较长的回答通常意味着更丰富的表达）
  signals.push({
    dimension: 'creativity', weight: 15, detected: childText.length > 20,
    description: '回答丰富度',
  });

  // 故事性：包含叙事元素
  const storyWords = ['然后', '后来', '有一天', '从前', '以前', '因为', '所以', '结果'];
  const hasStory = storyWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'creativity', weight: 15, detected: hasStory,
    description: '叙事能力',
  });

  // === 批判性思维信号 ===

  // 因果推理
  const causalWords = ['因为', '所以', '因为...所以', '原因是', '导致', '因此'];
  const hasCausal = causalWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'critical_thinking', weight: 30, detected: hasCausal,
    description: '因果推理',
  });

  // 比较判断
  const compareWords = ['但是', '不过', '相比', '一样', '不同', '更大', '更好', '比...更'];
  const hasCompare = compareWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'critical_thinking', weight: 25, detected: hasCompare,
    description: '比较判断',
  });

  // 质疑/追问
  const questionWords = ['为什么', '怎么会', '真的吗', '不对吧', '可是', '不是'];
  const hasQuestion = questionWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'critical_thinking', weight: 25, detected: hasQuestion,
    description: '质疑追问',
  });

  // === 沟通力信号 ===

  // 表达完整度（句号、感叹号表示完整表达）
  const hasCompleteSentence = /[。！？.!?]/.test(childText) || childText.length > 10;
  signals.push({
    dimension: 'communication', weight: 25, detected: hasCompleteSentence,
    description: '表达完整度',
  });

  // 情绪词汇
  const emotionWords = ['开心', '高兴', '难过', '生气', '害怕', '喜欢', '讨厌', '惊讶', '感动', '紧张', '兴奋'];
  const hasEmotion = emotionWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'communication', weight: 25, detected: hasEmotion,
    description: '情绪表达',
  });

  // 主动回应（不是简单的是/否）
  const isNotSimple = childText.length > 5 && !/^(好|是|对|嗯|不行|不要|不知道)$/.test(childText.trim());
  signals.push({
    dimension: 'communication', weight: 20, detected: isNotSimple,
    description: '主动回应',
  });

  // 描述性语言
  const descWords = ['很', '非常', '特别', '超级', '有点', '好像', '看起来', '感觉'];
  const hasDesc = descWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'communication', weight: 15, detected: hasDesc,
    description: '描述性表达',
  });

  // === 协作力信号 ===

  // 共情表达
  const empathyWords = ['没关系', '没事', '一起', '帮你', '帮你', '我们', '陪你', '理解'];
  const hasEmpathy = empathyWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'collaboration', weight: 30, detected: hasEmpathy,
    description: '共情表达',
  });

  // 接受建议
  const acceptWords = ['好的', '可以', '行', '好吧', '试试看', '那我们'];
  const hasAccept = acceptWords.some((w) => childText.includes(w));
  signals.push({
    dimension: 'collaboration', weight: 20, detected: hasAccept,
    description: '接受建议',
  });

  // 轮流表达（多轮对话中都积极参与）
  const isActive = allChildTexts.length >= 2;
  signals.push({
    dimension: 'collaboration', weight: 20, detected: isActive,
    description: '积极参与',
  });

  return signals;
}

// ============ 评分计算 ============

export interface AssessmentResult {
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
  overall: number;
  sampleCount: number;
  confidence: number;
  detectedSignals: string[];
}

/**
 * 对一轮对话进行评估
 * 累积所有轮次的信号计算最终分数
 */
export function assessSession(childTurns: string[]): AssessmentResult {
  if (childTurns.length === 0) {
    return {
      creativity: 50, criticalThinking: 50, communication: 50, collaboration: 50,
      overall: 50, sampleCount: 0, confidence: 0, detectedSignals: [],
    };
  }

  // 收集所有信号
  const allSignals: Signal[] = [];
  for (let i = 0; i < childTurns.length; i++) {
    const prevTurns = childTurns.slice(0, i);
    allSignals.push(...detectSignals(childTurns[i], prevTurns));
  }

  // 按维度分组计算
  const dimensions = {
    creativity: allSignals.filter((s) => s.dimension === 'creativity'),
    critical_thinking: allSignals.filter((s) => s.dimension === 'critical_thinking'),
    communication: allSignals.filter((s) => s.dimension === 'communication'),
    collaboration: allSignals.filter((s) => s.dimension === 'collaboration'),
  };

  const calcScore = (signals: Signal[]) => {
    if (signals.length === 0) return 50;
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const detectedWeight = signals.filter((s) => s.detected).reduce((sum, s) => sum + s.weight, 0);
    // 基础分 30 + 信号触发比例 * 70，映射到 30-100
    return Math.round(30 + (detectedWeight / totalWeight) * 70);
  };

  const creativity = calcScore(dimensions.creativity);
  const criticalThinking = calcScore(dimensions.critical_thinking);
  const communication = calcScore(dimensions.communication);
  const collaboration = calcScore(dimensions.collaboration);
  const overall = Math.round((creativity + criticalThinking + communication + collaboration) / 4);

  const detectedSignals = allSignals.filter((s) => s.detected).map((s) => s.description);

  // 置信度：样本越多越可信
  const confidence = Math.min(1, childTurns.length / 10);

  return {
    creativity, criticalThinking, communication, collaboration,
    overall, sampleCount: childTurns.length, confidence, detectedSignals,
  };
}

/**
 * 决定下一轮对话应该探测哪个维度（选最缺数据的）
 */
export function pickAssessmentDimension(baselines: Array<{ dimension: string; sessionCount: number }>): string {
  const dims = [
    { dimension: 'creativity', label: '创造力' },
    { dimension: 'critical_thinking', label: '批判性思维' },
    { dimension: 'communication', label: '沟通力' },
    { dimension: 'collaboration', label: '协作力' },
  ];

  // 选 sessionCount 最少的维度，优先探测数据少的
  const sorted = [...dims].sort((a, b) => {
    const aCount = baselines.find((bl) => bl.dimension === a.dimension)?.sessionCount || 0;
    const bCount = baselines.find((bl) => bl.dimension === b.dimension)?.sessionCount || 0;
    return aCount - bCount;
  });

  return sorted[0].label;
}
