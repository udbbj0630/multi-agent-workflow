export interface ChildMemory {
  id: string;
  childId: string;
  category: 'interest' | 'relation' | 'event' | 'emotion' | 'preference';
  key: string;
  value: string;
  source: 'extracted' | 'explicit' | 'parent';
  confidence: number;
  mentionCount: number;
  lastMentioned: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  childId: string;
  summary: string;
  topics: string[];
  emotionTrajectory: string[];
  keyMoments: Array<{
    turn: number;
    type: string;
    description: string;
  }>;
}

// 注入 LLM context 的记忆摘要
export interface MemoryContext {
  interests: string[];       // ["喜欢恐龙", "爱画画"]
  relations: string[];       // ["妈妈叫小红", "有个弟弟"]
  recentTopics: string[];    // 最近聊过的话题
  emotionNotes: string[];    // ["上次聊到幼儿园时有点难过"]
  lastSessionSummary?: string;
}
