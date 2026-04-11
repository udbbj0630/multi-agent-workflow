import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToChildEvents, ChildToServerEvents } from '@uli/shared';

type TypedSocket = Socket<ServerToChildEvents, ChildToServerEvents>;

interface ChatMessage {
  role: 'child' | 'uli';
  text: string;
}

export function ChildChat() {
  const [connected, setConnected] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [uliText, setUliText] = useState('');
  const [uliAnimation, setUliAnimation] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const socketRef = useRef<TypedSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket: TypedSocket = io('/', {
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('thinking', () => {
      setUliAnimation('uli_think');
      setIsThinking(true);
    });

    socket.on('audio', ({ text, animation }) => {
      setUliText(text);
      setUliAnimation(animation);
      setIsThinking(false);
      setMessages((prev) => [...prev, { role: 'uli', text }]);
    });

    socket.on('session_started', ({ greeting }) => {
      setUliText(greeting);
      setUliAnimation('uli_wave');
      setSessionActive(true);
      setMessages([{ role: 'uli', text: greeting }]);
    });

    socket.on('session_ended', ({ goodbye }) => {
      setUliText(goodbye);
      setUliAnimation('uli_wave');
      setSessionActive(false);
      setMessages((prev) => [...prev, { role: 'uli', text: goodbye }]);
    });

    socket.on('reaction', ({ text, animation }) => {
      setUliText(text);
      setUliAnimation(animation);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendText = useCallback(() => {
    const text = textInput.trim();
    if (!text || !socketRef.current) return;
    socketRef.current.emit('text', { text });
    setTextInput('');
    setMessages((prev) => [...prev, { role: 'child', text }]);
  }, [textInput]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          socketRef.current?.emit('audio', { data: base64 });
        };
        reader.readAsDataURL(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      console.error('无法获取麦克风');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const toggleSession = () => {
    const socket = socketRef.current;
    if (!socket || !connected) return;
    if (sessionActive) {
      socket.emit('end_session');
    } else {
      socket.emit('start_session');
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
    }}>
      {/* 顶部呜哩头像 */}
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        paddingTop: 16, paddingBottom: 8,
      }}>
        <div
          onClick={() => socketRef.current?.emit('tap_uli')}
          style={{
            width: 80, height: 80, borderRadius: '50%',
            background: '#B8E6FF', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 40,
            border: '3px solid #7DD3FC', cursor: 'pointer',
            animation: isThinking ? 'pulse 1s infinite' : undefined,
          }}
        >
          {uliAnimation === 'uli_think' ? '🤔' :
           uliAnimation === 'uli_talk' ? '😊' :
           uliAnimation === 'uli_wave' ? '👋' :
           uliAnimation === 'uli_giggle' ? '😆' : '👽'}
        </div>
        <span style={{ fontSize: 12, color: '#7DD3FC', marginTop: 4 }}>
          {isThinking ? '呜哩在想...' : '点我戳呜哩'}
        </span>
      </div>

      {/* 对话区域 */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '0 16px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {messages.length === 0 && (
          <div style={{
            textAlign: 'center', color: '#999', marginTop: 60,
            fontSize: 16,
          }}>
            点击"开始聊天"和呜哩打招呼吧！
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'child' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '70%', padding: '10px 14px',
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

      {/* 底部控制区 */}
      <div style={{
        padding: '12px 16px', background: 'white',
        borderTop: '1px solid #eee',
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button
          onClick={toggleSession}
          style={{
            padding: '8px 16px', borderRadius: 20, border: 'none',
            background: sessionActive ? '#FF9800' : connected ? '#4CAF50' : '#ccc',
            color: 'white', fontSize: 14, cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {sessionActive ? '结束' : '开始'}
        </button>

        <input
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendText()}
          placeholder={sessionActive ? '打字和呜哩聊天...' : ''}
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
            padding: '8px 14px', borderRadius: 20, border: 'none',
            background: sessionActive && textInput.trim() ? '#2196F3' : '#ddd',
            color: 'white', fontSize: 14, cursor: 'pointer',
          }}
        >
          发送
        </button>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          disabled={!sessionActive}
          style={{
            width: 44, height: 44, borderRadius: '50%', border: 'none',
            background: isRecording ? '#FF5252' : sessionActive ? '#E3F2FD' : '#eee',
            fontSize: 20, cursor: sessionActive ? 'pointer' : 'not-allowed',
          }}
        >
          🎤
        </button>
      </div>
    </div>
  );
}
