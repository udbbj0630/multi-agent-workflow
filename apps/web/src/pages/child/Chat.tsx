import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToChildEvents, ChildToServerEvents } from '@uli/shared';

type TypedSocket = Socket<ServerToChildEvents, ChildToServerEvents>;

interface ChatMessage {
  role: 'child' | 'uli';
  text: string;
}

interface Props {
  onBack: () => void;
}

// ============ TTS：浏览器语音合成 ============

function speak(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.9;
  utterance.pitch = 1.4; // 偏高一点，更像小朋友
  // 尝试找一个中文女声
  const voices = window.speechSynthesis.getVoices();
  const zhVoice = voices.find((v) => v.lang.startsWith('zh') && v.name.includes('Female'))
    || voices.find((v) => v.lang.startsWith('zh'));
  if (zhVoice) utterance.voice = zhVoice;
  window.speechSynthesis.speak(utterance);
}

export function ChildChat({ onBack }: Props) {
  const [connected, setConnected] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [uliAnimation, setUliAnimation] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const socketRef = useRef<TypedSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // 预加载语音列表
  useEffect(() => {
    window.speechSynthesis?.getVoices();
  }, []);

  useEffect(() => {
    const socket: TypedSocket = io({
      transports: ['polling', 'websocket'],
      path: '/socket.io',
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('[socket] connected');
      setConnected(true);
    });
    socket.on('disconnect', () => setConnected(false));
    socket.on('connect_error', (err) => console.error('[socket] error:', err.message));

    socket.on('thinking', () => {
      setUliAnimation('uli_think');
      setIsThinking(true);
    });

    socket.on('audio', ({ text, animation }) => {
      setUliAnimation(animation);
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'uli', text }]);
      // TTS 语音播放
      if (ttsEnabled) speak(text);
    });

    socket.on('session_started', ({ greeting }) => {
      setUliAnimation('uli_wave');
      setSessionActive(true);
      setMessages([{ role: 'uli', text: greeting }]);
      if (ttsEnabled) speak(greeting);
    });

    socket.on('session_ended', ({ goodbye }) => {
      setUliAnimation('uli_wave');
      setSessionActive(false);
      setMessages((prev) => [...prev, { role: 'uli', text: goodbye }]);
      if (ttsEnabled) speak(goodbye);
    });

    socket.on('reaction', ({ text, animation }) => {
      setUliAnimation(animation);
    });

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, [ttsEnabled]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = useCallback((text?: string) => {
    const msg = text || textInput.trim();
    if (!msg || !socketRef.current) return;
    socketRef.current.emit('text', { text: msg });
    setTextInput('');
    setMessages((prev) => [...prev, { role: 'child', text: msg }]);
    window.speechSynthesis?.cancel(); // 孩子说话时停止呜哩的语音
  }, [textInput]);

  const startRecording = useCallback(() => {
    if (!sessionActive) return;
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('请用 Chrome 浏览器使用语音功能'); return; }

    const recognition = new SR();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = true;

    let finalTranscript = '';
    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interim += t;
      }
      if (interim || finalTranscript) setTextInput(finalTranscript + interim);
    };
    recognition.onerror = (event: any) => {
      setIsRecording(false);
      if (event.error === 'not-allowed') alert('请允许浏览器使用麦克风');
    };
    recognition.onend = () => {
      setIsRecording(false);
      if (finalTranscript.trim()) sendText(finalTranscript.trim());
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [sessionActive, sendText]);

  const stopRecording = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  const toggleSession = () => {
    const socket = socketRef.current;
    if (!socket || !connected) return;
    if (sessionActive) socket.emit('end_session');
    else socket.emit('start_session');
  };

  // 动画表情映射
  const getEmoji = () => {
    if (uliAnimation === 'uli_think') return '🤔';
    if (uliAnimation === 'uli_talk') return '😊';
    if (uliAnimation === 'uli_wave') return '👋';
    if (uliAnimation === 'uli_giggle') return '😆';
    if (sessionActive) return '😊';
    return '👽';
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
    }}>
      {/* 顶部栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 12px',
      }}>
        <button onClick={onBack} style={{
          padding: '6px 12px', borderRadius: 16, border: 'none',
          background: 'rgba(0,0,0,0.05)', fontSize: 13, cursor: 'pointer',
        }}>
          ← 返回
        </button>
        <button onClick={() => setTtsEnabled(!ttsEnabled)} style={{
          padding: '6px 12px', borderRadius: 16, border: 'none',
          background: ttsEnabled ? '#E3F2FD' : '#FFEBEE',
          fontSize: 13, cursor: 'pointer',
        }}>
          🔊 {ttsEnabled ? '语音开' : '语音关'}
        </button>
      </div>

      {/* 呜哩头像 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingBottom: 8,
      }}>
        <div
          onClick={() => socketRef.current?.emit('tap_uli')}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: isThinking
              ? 'linear-gradient(135deg, #B8E6FF 0%, #FFE082 100%)'
              : 'linear-gradient(135deg, #B8E6FF 0%, #7DD3FC 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 36, cursor: 'pointer',
            border: '3px solid #7DD3FC',
            animation: isThinking ? 'pulse 1s infinite' : undefined,
            transition: 'all 0.3s',
          }}
        >
          {getEmoji()}
        </div>
        <span style={{ fontSize: 11, color: '#7DD3FC', marginTop: 2 }}>
          {isThinking ? '呜哩在想...' : '戳我'}
        </span>
      </div>

      {/* 对话区域 */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', color: '#999', marginTop: 40, fontSize: 15 }}>
            点击"开始"和呜哩聊天吧！
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'child' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '75%', padding: '10px 14px',
              borderRadius: 16,
              borderBottomRightRadius: msg.role === 'child' ? 4 : 16,
              borderBottomLeftRadius: msg.role === 'uli' ? 4 : 16,
              background: msg.role === 'child' ? '#2196F3' : 'white',
              color: msg.role === 'child' ? 'white' : '#333',
              fontSize: 16, lineHeight: 1.5,
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* 录音指示器 */}
      {isRecording && (
        <div style={{
          padding: '8px 16px', background: '#FFEBEE',
          textAlign: 'center', color: '#D32F2F', fontSize: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#F44336', animation: 'pulse 1s infinite' }} />
          正在听你说话...说完了点停止
        </div>
      )}

      {/* 底部控制区 */}
      <div style={{
        padding: '10px 12px', background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button onClick={toggleSession} style={{
          padding: '8px 14px', borderRadius: 20, border: 'none',
          background: sessionActive ? '#FF9800' : connected ? '#4CAF50' : '#ccc',
          color: 'white', fontSize: 14, cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          {sessionActive ? '结束' : '开始'}
        </button>

        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          placeholder={sessionActive ? '打字或按麦克风说话...' : ''}
          disabled={!sessionActive}
          style={{
            flex: 1, padding: '8px 12px', borderRadius: 20,
            border: '1px solid #ddd', fontSize: 16, outline: 'none',
            opacity: sessionActive ? 1 : 0.5,
          }}
        />

        <button
          onClick={sendText}
          disabled={!sessionActive || !textInput.trim()}
          style={{
            padding: '8px 12px', borderRadius: 20, border: 'none',
            background: sessionActive && textInput.trim() ? '#2196F3' : '#ddd',
            color: 'white', fontSize: 14, cursor: 'pointer',
          }}
        >
          发送
        </button>

        <button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!sessionActive}
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: isRecording ? '#FF5252' : sessionActive ? '#E3F2FD' : '#eee',
            fontSize: 18, cursor: sessionActive ? 'pointer' : 'not-allowed',
            transition: 'background 0.2s',
          }}
        >
          🎤
        </button>
      </div>
    </div>
  );
}
