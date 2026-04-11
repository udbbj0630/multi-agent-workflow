import { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ServerToChildEvents, ChildToServerEvents } from '@uli/shared';

type TypedSocket = Socket<ServerToChildEvents, ChildToServerEvents>;

export function ChildChat() {
  const [connected, setConnected] = useState(false);
  const [uliText, setUliText] = useState('');
  const [uliAnimation, setUliAnimation] = useState('idle');
  const [isRecording, setIsRecording] = useState(false);
  const socketRef = useRef<TypedSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  useEffect(() => {
    const socket: TypedSocket = io('/', {
      transports: ['websocket'],
    });

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('thinking', ({ animation }) => {
      setUliAnimation(animation);
      setUliText('呜哩在想...');
    });

    socket.on('audio', ({ text, animation }) => {
      setUliText(text);
      setUliAnimation(animation);
    });

    socket.on('session_started', ({ greeting }) => {
      setUliText(greeting);
      setUliAnimation('uli_wave');
    });

    socket.on('session_ended', ({ goodbye }) => {
      setUliText(goodbye);
      setUliAnimation('uli_wave');
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
    if (!socket) return;
    if (!connected) return;
    // 简单切换：如果呜哩还没说话就开始 session
    if (!uliText) {
      socket.emit('start_session');
    } else {
      socket.emit('end_session');
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
    }}>
      {/* 呜哩角色区 */}
      <div style={{
        width: 200, height: 200, borderRadius: '50%',
        background: '#B8E6FF', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontSize: 64, marginBottom: 20,
        border: '4px solid #7DD3FC',
      }}>
        {uliAnimation === 'uli_think' ? '🤔' :
         uliAnimation === 'uli_talk' ? '😊' :
         uliAnimation === 'uli_wave' ? '👋' :
         uliAnimation === 'uli_giggle' ? '😆' : '👽'}
      </div>

      {/* 对话气泡 */}
      <div style={{
        maxWidth: 300, minHeight: 60, padding: '12px 16px',
        background: 'white', borderRadius: 16, marginBottom: 30,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)', textAlign: 'center',
        fontSize: 18, color: '#333',
      }}>
        {uliText || '点击下方按钮开始和呜哩聊天吧！'}
      </div>

      {/* 控制按钮 */}
      <div style={{ display: 'flex', gap: 16 }}>
        <button
          onClick={toggleSession}
          style={{
            padding: '12px 24px', borderRadius: 25, border: 'none',
            background: connected ? '#4CAF50' : '#ccc', color: 'white',
            fontSize: 16, cursor: 'pointer',
          }}
        >
          {uliText ? '结束聊天' : '开始聊天'}
        </button>

        <button
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onTouchStart={startRecording}
          onTouchEnd={stopRecording}
          style={{
            width: 64, height: 64, borderRadius: '50%', border: 'none',
            background: isRecording ? '#FF5252' : '#2196F3', color: 'white',
            fontSize: 24, cursor: 'pointer',
          }}
        >
          🎤
        </button>
      </div>

      <div style={{ marginTop: 10, fontSize: 12, color: '#999' }}>
        {connected ? '🟢 已连接' : '🔴 未连接'} · 按住麦克风说话
      </div>
    </div>
  );
}
