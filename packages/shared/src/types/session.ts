export interface Session {
  id: string;
  childId: string;
  startedAt: string;
  endedAt?: string;
  durationSec?: number;
  turnCount: number;
  scenarioType?: string;
  difficultyLevel: number;
  summary?: string;
  emotionArc?: string[];
  keyMoments?: KeyMoment[];
}

export interface Turn {
  id: string;
  sessionId: string;
  turnNumber: number;
  role: 'child' | 'uli';
  text: string;
  audioUrl?: string;
  emotionTag?: string;
  assessmentTag?: string;
  createdAt: string;
}

export interface KeyMoment {
  turn: number;
  type: 'insight' | 'milestone' | 'emotion_shift' | 'assessment';
  description: string;
}
