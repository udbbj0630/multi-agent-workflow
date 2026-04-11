import type { Dimension } from '../constants/dimensions.js';

export interface SessionScore {
  id: string;
  sessionId: string;
  childId: string;
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
  overall: number;
  sampleCount: number;
  confidence: number;
  createdAt: string;
}

export interface ChildBaseline {
  id: string;
  childId: string;
  dimension: Dimension;
  currentScore: number;
  difficultyLevel: number;
  trend: 'rising' | 'stable' | 'declining';
  sessionCount: number;
  updatedAt: string;
}

export interface RadarData {
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
}

export interface TrendPoint {
  date: string;
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
}
