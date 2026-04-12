import { useState } from 'react';

interface Props {
  onLogin: (token: string, parentId: string) => void;
  onBack: () => void;
}

export function ParentLogin({ onLogin, onBack }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [childName, setChildName] = useState('');
  const [childBirth, setChildBirth] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || phone.length !== 11) {
      setError('请输入11位手机号');
      return;
    }
    if (!password || password.length < 4) {
      setError('密码至少4位');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const url = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister
        ? { phone, password, nickname, childName, childBirth }
        : { phone, password };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        onLogin(data.token, data.parentId);
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #F5F7FA 0%, #E8EAF6 100%)',
      padding: 20,
    }}>
      <button
        onClick={onBack}
        style={{
          position: 'absolute', top: 20, left: 20,
          padding: '8px 16px', borderRadius: 20, border: 'none',
          background: '#eee', cursor: 'pointer', fontSize: 14,
        }}
      >
        ← 返回
      </button>

      <h2 style={{ fontSize: 22, color: '#333', marginBottom: 24 }}>
        {isRegister ? '创建家长账号' : '家长登录'}
      </h2>

      <div style={{
        width: '100%', maxWidth: 360, background: 'white',
        borderRadius: 16, padding: 24,
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="手机号"
          maxLength={11}
          style={{
            padding: '12px 16px', borderRadius: 12,
            border: '1px solid #ddd', fontSize: 16, outline: 'none',
          }}
        />

        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="密码"
          type="password"
          style={{
            padding: '12px 16px', borderRadius: 12,
            border: '1px solid #ddd', fontSize: 16, outline: 'none',
          }}
        />

        {isRegister && (
          <>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="你的称呼（选填）"
              style={{
                padding: '12px 16px', borderRadius: 12,
                border: '1px solid #ddd', fontSize: 16, outline: 'none',
              }}
            />
            <input
              value={childName}
              onChange={(e) => setChildName(e.target.value)}
              placeholder="孩子的名字"
              style={{
                padding: '12px 16px', borderRadius: 12,
                border: '1px solid #ddd', fontSize: 16, outline: 'none',
              }}
            />
            <div>
              <label style={{ fontSize: 13, color: '#999', marginBottom: 4, display: 'block' }}>孩子出生日期</label>
              <input
                value={childBirth}
                onChange={(e) => setChildBirth(e.target.value)}
                type="date"
                style={{
                  padding: '12px 16px', borderRadius: 12,
                  border: '1px solid #ddd', fontSize: 16, outline: 'none', width: '100%',
                }}
              />
            </div>
          </>
        )}

        {error && <div style={{ color: '#F44336', fontSize: 14, textAlign: 'center' }}>{error}</div>}

        <button
          onClick={handleSubmit}
          disabled={loading}
          style={{
            padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', fontSize: 16, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
        </button>

        <div style={{ textAlign: 'center', fontSize: 14, color: '#999' }}>
          {isRegister ? '已有账号？' : '没有账号？'}
          <span
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            style={{ color: '#667eea', cursor: 'pointer', marginLeft: 4 }}
          >
            {isRegister ? '登录' : '注册'}
          </span>
        </div>
      </div>
    </div>
  );
}
