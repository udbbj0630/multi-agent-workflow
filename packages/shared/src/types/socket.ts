// 孩子端 WebSocket 事件类型
export interface ChildToServerEvents {
  audio: (data: { data: string }) => void;
  tap_uli: () => void;
  start_session: () => void;
  end_session: () => void;
}

export interface ServerToChildEvents {
  thinking: (data: { animation: string }) => void;
  audio: (data: { data: string; text: string; animation: string }) => void;
  reaction: (data: { animation: string; text: string }) => void;
  session_started: (data: { greeting: string }) => void;
  session_ended: (data: { goodbye: string }) => void;
  error: (data: { message: string }) => void;
}

// 家长端 API 请求/响应
export interface AuthResponse {
  token: string;
  parent: {
    id: string;
    phone: string;
    nickname?: string;
  };
}

export interface GrowthData {
  baseline: Record<string, number>;
  radar: {
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  };
  trend: Array<{
    date: string;
    creativity: number;
    criticalThinking: number;
    communication: number;
    collaboration: number;
  }>;
}
