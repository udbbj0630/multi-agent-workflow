import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import ForestFox from "../../components-v2/ForestFox";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  childId: string;
  childName: string;
  token: string;
  onBack: () => void;
  onLogout: () => void;
}

type FoxMood = "idle" | "thinking" | "talking" | "happy" | "wave" | "giggle";

interface ChatMessage {
  id: string;
  sender: "child" | "uli" | "system";
  text: string;
}

interface AudioPayload {
  text: string;
  animation?: string;
}

interface ReactionPayload {
  text?: string;
  animation?: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: ((ev: Event) => void) | null;
  onresult: ((ev: { results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }> }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: ((ev: Event) => void) | null;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapMood(animation?: string): FoxMood {
  if (["thinking", "talking", "happy", "wave", "giggle", "idle"].includes(animation || "")) {
    return animation as FoxMood;
  }
  return "idle";
}

function createFireflies(count: number): JSX.Element[] {
  return Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 4 + 2;
    return (
      <span
        key={`cf-${i}`}
        className="firefly"
        style={{
          width: size, height: size,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${Math.random() * 4 + 3}s`,
        }}
      />
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Chat: React.FC<Props> = ({ childId, childName, token, onBack, onLogout }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionActive, setSessionActive] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mood, setMood] = useState<FoxMood>("idle");
  const [error, setError] = useState("");
  const [disconnected, setDisconnected] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [thinkingHint, setThinkingHint] = useState("");

  const socketRef = useRef<Socket | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const msgEndRef = useRef<HTMLDivElement | null>(null);
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fireflies = useMemo(() => createFireflies(14), []);

  const addMessage = useCallback((sender: ChatMessage["sender"], text: string) => {
    if (!text.trim()) return;
    setMessages((prev) => [
      ...prev,
      { id: `${sender}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, sender, text },
    ]);
  }, []);

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 0.9;
    utterance.pitch = 1.4;
    utterance.onstart = () => setMood("talking");
    utterance.onend = () => {
      setThinking(false);
      setMood("happy");
      setTimeout(() => setMood("idle"), 800);
    };
    synth.speak(utterance);
  }, []);

  // ---- Socket lifecycle ----
  useEffect(() => {
    setError("");
    setConnecting(true);
    setDisconnected(false);

    const socket = io({
      transports: ["polling", "websocket"],
      path: "/socket.io",
      auth: { token },
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      setConnecting(false);
      setDisconnected(false);
      setError("");
      socket.emit("start_session", { childId, childName });
    });

    socket.on("disconnect", (reason) => {
      setSessionActive(false);
      setDisconnected(true);
      if (reason === "io server disconnect") {
        setError("会话已断开，请返回重试");
      } else {
        setError("网络连接中断，正在尝试重连...");
      }
    });

    socket.on("connect_error", (err: Error) => {
      setConnecting(false);
      setDisconnected(true);
      const msg = err.message;
      if (msg === "Unauthorized" || msg === "Forbidden") {
        setError("登录已过期，请重新登录");
      } else {
        setError("连接失败，请检查网络");
      }
    });

    socket.on("thinking", () => {
      setThinking(true);
      setMood("thinking");
      setThinkingHint("呜哩在认真想...");
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = setTimeout(() => {
        setThinkingHint("快想好了...");
      }, 3500);
    });

    socket.on("session_started", (payload: { greeting?: string }) => {
      setSessionActive(true);
      setThinking(false);
      setMood("wave");
      if (payload?.greeting) {
        addMessage("uli", payload.greeting);
        speakText(payload.greeting);
      }
      setTimeout(() => setMood("idle"), 1200);
    });

    socket.on("audio", (payload: AudioPayload) => {
      const nextMood = mapMood(payload?.animation);
      setThinking(false);
      setThinkingHint("");
      if (thinkingTimerRef.current) { clearTimeout(thinkingTimerRef.current); thinkingTimerRef.current = null; }
      setMood(nextMood === "idle" ? "talking" : nextMood);
      if (payload?.text) {
        addMessage("uli", payload.text);
        speakText(payload.text);
      }
    });

    socket.on("reaction", (payload: ReactionPayload) => {
      if (payload?.text) addMessage("uli", payload.text);
      setMood(mapMood(payload?.animation) || "giggle");
      setTimeout(() => setMood("idle"), 1200);
    });

    socket.on("session_ended", (payload: { goodbye?: string }) => {
      setSessionActive(false);
      setThinking(false);
      setMood("wave");
      if (payload?.goodbye) {
        addMessage("uli", payload.goodbye);
        speakText(payload.goodbye);
      }
    });

    return () => {
      try { socket.emit("end_session"); } catch { /* noop */ }
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      if (thinkingTimerRef.current) clearTimeout(thinkingTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, [childId, childName, token, addMessage, speakText]);

  // ---- Auto-scroll ----
  useEffect(() => {
    msgEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  // ---- Speech recognition ----
  useEffect(() => {
    const w = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "zh-CN";
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => { setRecording(true); setMood("thinking"); setError(""); };
    recognition.onresult = (event) => {
      let finalText = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) finalText += event.results[i][0].transcript;
      }
      if (finalText.trim()) {
        setInput(finalText.trim());
        handleSend(finalText.trim());
      }
    };
    recognition.onerror = (event) => {
      setRecording(false);
      setMood("idle");
      setError(event.error === "not-allowed" ? "请允许麦克风访问" : "语音识别暂时不可用");
    };
    recognition.onend = () => {
      setRecording(false);
      if (!thinking) setMood("idle");
    };
    recognitionRef.current = recognition;
    return () => { recognition.stop(); recognitionRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thinking]);

  // ---- Handlers ----
  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !socketRef.current || !sessionActive) return;
    addMessage("child", trimmed);
    setInput("");
    setThinking(true);
    setMood("thinking");
    socketRef.current.emit("text", { text: trimmed });
  }, [addMessage, sessionActive]);

  const handleEndSession = useCallback(() => {
    setConfirmEnd(true);
  }, []);

  const confirmEndSession = useCallback(() => {
    setConfirmEnd(false);
    socketRef.current?.emit("end_session");
    setSessionActive(false);
    setThinking(false);
    setMood("wave");
  }, []);

  const cancelEndSession = useCallback(() => {
    setConfirmEnd(false);
  }, []);

  const handleMicClick = useCallback(() => {
    if (!recognitionRef.current) {
      setError("当前浏览器不支持语音识别");
      return;
    }
    if (!sessionActive) {
      setError("请先开启会话");
      return;
    }
    if (recording) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  }, [sessionActive, recording]);

  const handleTapFox = useCallback(() => {
    socketRef.current?.emit("tap_uli");
    setMood("giggle");
    setTimeout(() => setMood("idle"), 1000);
  }, []);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    handleSend(input);
  };

  const showExpiredOverlay = disconnected && error.includes("过期");

  return (
    <>
      <section className="page page-child active" style={{ position: "relative" }}>
        <div className="firefly-layer">{fireflies}</div>

        {/* Header */}
        <button type="button" className="btn-close-chat" onClick={onBack} aria-label="返回">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="session-toggle">
          {sessionActive ? (
            <button type="button" className="active" onClick={handleEndSession}>
              结束会话
            </button>
          ) : (
            <button type="button" disabled={connecting || disconnected}>
              {connecting ? "连接中..." : disconnected ? "已断开" : "等待"}
            </button>
          )}
          <span className={`toggle-chip ${sessionActive ? "active" : ""}`}>
            {sessionActive ? "聊天中" : connecting ? "连接中" : disconnected ? "已断开" : "等待"}
          </span>
        </div>

        {/* End session confirmation */}
        {confirmEnd && (
          <div className="chat-overlay" style={{ zIndex: 60 }}>
            <div className="chat-overlay-box">
              <p>确定要结束这次对话吗？</p>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" className="btn-ghost" onClick={cancelEndSession}>
                  继续聊
                </button>
                <button type="button" className="btn-mushroom" onClick={confirmEndSession}
                  style={{ minHeight: 44, padding: "10px 24px" }}>
                  结束
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Character + messages */}
        <div className="chat-sky" style={{ flexDirection: "column", gap: 12, paddingInline: 16 }}>
          <div style={{ marginTop: 54, display: "flex", flexDirection: "column", alignItems: "center", position: "relative", zIndex: 3 }}>
            <ForestFox mood={thinking ? "thinking" : mood} size={sessionActive ? 80 : 160} onClick={handleTapFox} />
            {!sessionActive && (
              <div style={{ marginTop: 12, color: "var(--f-trunk)", fontWeight: 700, fontFamily: "var(--font-display)", fontSize: 18 }}>
                呀，{childName} 来啦
              </div>
            )}
            {thinking && (
              <div className="recording-indicator" style={{ marginTop: 12 }}>
                <span>{thinkingHint || "呜哩在认真想..."}</span>
                <div className="sound-wave" aria-hidden="true"><span /><span /><span /><span /><span /></div>
              </div>
            )}
          </div>

          <div style={{ width: "100%", flex: 1, overflowY: "auto", padding: "8px 4px 10px", position: "relative", zIndex: 5 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }} role="log" aria-live="polite">
              {messages.map((msg) => {
                const isChild = msg.sender === "child";
                const isSystem = msg.sender === "system";
                return (
                  <div
                    key={msg.id}
                    style={{
                      alignSelf: isSystem ? "center" : isChild ? "flex-end" : "flex-start",
                      maxWidth: "82%",
                      background: isSystem
                        ? "rgba(107,66,38,0.06)"
                        : isChild
                          ? "linear-gradient(135deg, #F5B041 0%, #D4881C 100%)"
                          : "var(--f-cream)",
                      color: isChild ? "#3C2415" : isSystem ? "var(--f-text-muted)" : "var(--f-text)",
                      border: isChild
                        ? "2px solid rgba(212,136,28,0.3)"
                        : "var(--border-clay)",
                      borderRadius: isSystem ? 12 : isChild ? "20px 20px 4px 20px" : "20px 20px 20px 4px",
                      padding: "12px 16px",
                      boxShadow: "var(--shadow-soft)",
                      fontFamily: "var(--font-body)",
                      fontSize: 15,
                      lineHeight: 1.5,
                    }}
                  >
                    {msg.text}
                  </div>
                );
              })}
              <div ref={msgEndRef} />
            </div>
          </div>
        </div>

        {/* Persistent error bar */}
        {error && !showExpiredOverlay && (
          <div className="chat-error-bar">
            {error}
            {disconnected && !error.includes("过期") && (
              <button type="button" onClick={onBack} className="chat-error-action">
                返回
              </button>
            )}
          </div>
        )}

        {/* Session expired overlay */}
        {showExpiredOverlay && (
          <div className="chat-overlay">
            <div className="chat-overlay-box">
              <p>登录已过期</p>
              <button type="button" className="btn-mushroom" onClick={onLogout}>
                重新登录
              </button>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="chat-controls">
          <form className="chat-input-cloud" onSubmit={handleSubmit} style={{ alignItems: "center", gap: 10 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={sessionActive ? "和呜哩说点什么..." : "先开启会话吧"}
              aria-label="聊天输入"
              disabled={!sessionActive}
              className="chat-input-field"
              maxLength={500}
            />
            {recording && (
              <div className="recording-indicator" style={{ paddingInline: 12 }}>
                <span className="recording-dot" />
                <div className="sound-wave" aria-hidden="true"><span /><span /><span /><span /><span /></div>
              </div>
            )}
            <button
              type="button"
              className={`btn-leaf-mic ${recording ? "recording" : ""}`}
              onClick={handleMicClick}
              aria-label="语音输入"
              disabled={!sessionActive}
            >
              <svg className="mic-icon" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
            </button>
            <button
              type="submit"
              className="btn-send-forest"
              disabled={!sessionActive || !input.trim()}
            >
              发送
            </button>
          </form>
        </div>
      </section>
    </>
  );
};

export default Chat;
