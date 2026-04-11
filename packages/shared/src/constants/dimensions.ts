// 4C 能力维度
export const DIMENSIONS = {
  CREATIVITY: 'creativity',
  CRITICAL_THINKING: 'critical_thinking',
  COMMUNICATION: 'communication',
  COLLABORATION: 'collaboration',
} as const;

export type Dimension = (typeof DIMENSIONS)[keyof typeof DIMENSIONS];

export const DIMENSION_LABELS: Record<Dimension, string> = {
  [DIMENSIONS.CREATIVITY]: '创造力',
  [DIMENSIONS.CRITICAL_THINKING]: '批判性思维',
  [DIMENSIONS.COMMUNICATION]: '沟通力',
  [DIMENSIONS.COLLABORATION]: '协作力',
};

// 难度等级
export const DIFFICULTY_LEVELS = {
  L1: { level: 1, minAge: 3, maxAge: 4, label: '认知启蒙' },
  L2: { level: 2, minAge: 4, maxAge: 5, label: '探索发现' },
  L3: { level: 3, minAge: 5, maxAge: 6, label: '思考推理' },
  L4: { level: 4, minAge: 6, maxAge: 8, label: '创造表达' },
} as const;

// 场景类型
export const SCENARIO_TYPES = {
  EXPLORE: 'explore',       // 探索类
  PROBLEM: 'problem',       // 问题类
  COOPERATE: 'cooperate',   // 合作类
  CREATIVE: 'creative',     // 创意类
  EMOTIONAL: 'emotional',   // 情感类
} as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[keyof typeof SCENARIO_TYPES];
