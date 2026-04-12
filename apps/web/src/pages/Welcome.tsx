import { useState } from 'react';
import { ChildChat } from './child/Chat';
import { ParentDashboard } from './parent/Dashboard';

type Page = 'login' | 'choose' | 'child' | 'parent';

export function App() {
  const [page, setPage] = useState<Page>('login');
  const [token, setToken] = useState('');
  const [parentId, setParentId] = useState('');
  const [childId, setChildId] = useState('');
  const [childName, setChildName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [childBirth, setChildBirth] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!phone || phone.length !== 11) { setError('请输入11位手机号'); return; }
    if (!password || password.length < 4) { setError('密码至少4位'); return; }
    if (isRegister && !childName) { setError('请输入孩子名字'); return; }
    if (isRegister && !childBirth) { setError('请输入孩子出生日期'); return; }
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
      if (data.error) { setError(data.error); }
      else {
        setToken(data.token);
        setParentId(data.parentId);
        setChildId(data.childId || '');
        setChildName(data.childName || '');
        setPage('choose');
      }
    } catch { setError('网络错误'); }
    finally { setLoading(false); }
  };

  // ============ 登录/注册页 ============
  if (page === 'login') {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
        padding: 20,
      }}>
        <div style={{
          width: 90, height: 90, borderRadius: '50%',
          background: 'linear-gradient(135deg, #B8E6FF 0%, #7DD3FC 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, marginBottom: 16,
          boxShadow: '0 4px 20px rgba(125,211,252,0.4)',
        }}>👽</div>
        <h1 style={{ fontSize: 26, color: '#333', marginBottom: 4 }}>呜哩 Uli</h1>
        <p style={{ fontSize: 14, color: '#999', marginBottom: 24 }}>你的外星小伙伴</p>

        <div style={{
          width: '100%', maxWidth: 340, background: 'white',
          borderRadius: 16, padding: 24,
          boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          <h2 style={{ fontSize: 18, color: '#333', textAlign: 'center', marginBottom: 4 }}>
            {isRegister ? '创建家庭账号' : '登录'}
          </h2>

          <input value={phone} onChange={(e) => setPhone(e.target.value)}
            placeholder="手机号" maxLength={11}
            style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd', fontSize: 16, outline: 'none' }} />

          <input value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="密码" type="password"
            style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd', fontSize: 16, outline: 'none' }} />

          {isRegister && (
            <>
              <input value={nickname} onChange={(e) => setNickname(e.target.value)}
                placeholder="家长称呼（选填）"
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd', fontSize: 16, outline: 'none' }} />
              <input value={childName} onChange={(e) => setChildName(e.target.value)}
                placeholder="孩子的名字"
                style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd', fontSize: 16, outline: 'none' }} />
              <div>
                <label style={{ fontSize: 13, color: '#999', marginBottom: 4, display: 'block' }}>孩子出生日期</label>
                <input value={childBirth} onChange={(e) => setChildBirth(e.target.value)}
                  type="date"
                  style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid #ddd', fontSize: 16, outline: 'none', width: '100%' }} />
              </div>
            </>
          )}

          {error && <div style={{ color: '#F44336', fontSize: 14, textAlign: 'center' }}>{error}</div>}

          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '14px', borderRadius: 12, border: 'none',
            background: loading ? '#ccc' : 'linear-gradient(135deg, #4ECDC4 0%, #44B09E 100%)',
            color: 'white', fontSize: 16, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
          }}>
            {loading ? '请稍候...' : isRegister ? '注册' : '登录'}
          </button>

          <div style={{ textAlign: 'center', fontSize: 14, color: '#999' }}>
            {isRegister ? '已有账号？' : '没有账号？'}
            <span onClick={() => { setIsRegister(!isRegister); setError(''); }}
              style={{ color: '#4ECDC4', cursor: 'pointer', marginLeft: 4, fontWeight: 600 }}>
              {isRegister ? '登录' : '注册'}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ============ 选择模式页 ============
  if (page === 'choose') {
    return (
      <div style={{
        height: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
        padding: 20,
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #B8E6FF 0%, #7DD3FC 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, marginBottom: 16,
        }}>👽</div>
        <h2 style={{ fontSize: 22, color: '#333', marginBottom: 8 }}>欢迎回来！</h2>
        <p style={{ fontSize: 14, color: '#999', marginBottom: 32 }}>选择你要进入的模式</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 260 }}>
          <button onClick={() => setPage('child')} style={{
            padding: '16px 24px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #4ECDC4 0%, #44B09E 100%)',
            color: 'white', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(78,205,196,0.3)',
          }}>
            👾 孩子模式 — 找呜哩玩
          </button>

          <button onClick={() => setPage('parent')} style={{
            padding: '16px 24px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(102,126,234,0.3)',
          }}>
            👨‍👩‍👧 家长模式 — 看成长
          </button>

          <button onClick={() => { setPage('login'); setToken(''); }} style={{
            padding: '10px', borderRadius: 12, border: 'none',
            background: 'transparent', color: '#999',
            fontSize: 14, cursor: 'pointer',
          }}>
            退出登录
          </button>
        </div>
      </div>
    );
  }

  // ============ 孩子端 ============
  if (page === 'child') {
    return (
      <ChildChat
        childId={childId}
        childName={childName}
        token={token}
        onBack={() => setPage('choose')}
      />
    );
  }

  // ============ 家长端 ============
  return (
    <ParentDashboard
      parentId={parentId}
      token={token}
      onBack={() => setPage('choose')}
    />
  );
}
