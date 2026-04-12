import { useState } from 'react';
import { ChildChat } from './child/Chat';
import { ParentDashboard } from './parent/Dashboard';
import { ParentLogin } from './parent/Login';

type Page = 'welcome' | 'child' | 'parent-login' | 'parent-dashboard';

export function App() {
  const [page, setPage] = useState<Page>('welcome');
  const [parentToken, setParentToken] = useState<string>('');
  const [parentId, setParentId] = useState<string>('');

  if (page === 'child') {
    return <ChildChat onBack={() => setPage('welcome')} />;
  }

  if (page === 'parent-login') {
    return (
      <ParentLogin
        onLogin={(token, pId) => {
          setParentToken(token);
          setParentId(pId);
          setPage('parent-dashboard');
        }}
        onBack={() => setPage('welcome')}
      />
    );
  }

  if (page === 'parent-dashboard') {
    return (
      <ParentDashboard
        parentId={parentId}
        token={parentToken}
        onBack={() => setPage('welcome')}
      />
    );
  }

  // 欢迎页：选角色
  return (
    <div style={{
      height: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(180deg, #E8F5FE 0%, #FFF5E1 100%)',
    }}>
      {/* 呜哩 Logo */}
      <div style={{
        width: 120, height: 120, borderRadius: '50%',
        background: 'linear-gradient(135deg, #B8E6FF 0%, #7DD3FC 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 64, marginBottom: 24,
        boxShadow: '0 4px 20px rgba(125,211,252,0.4)',
      }}>
        👽
      </div>

      <h1 style={{ fontSize: 28, color: '#333', marginBottom: 8 }}>呜哩 Uli</h1>
      <p style={{ fontSize: 15, color: '#999', marginBottom: 40 }}>你的外星小伙伴</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 260 }}>
        <button
          onClick={() => setPage('child')}
          style={{
            padding: '16px 24px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #4ECDC4 0%, #44B09E 100%)',
            color: 'white', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(78,205,196,0.3)',
          }}
        >
          👾 我是孩子，找呜哩玩
        </button>

        <button
          onClick={() => setPage('parent-login')}
          style={{
            padding: '16px 24px', borderRadius: 16, border: 'none',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white', fontSize: 18, fontWeight: 600,
            cursor: 'pointer', boxShadow: '0 4px 15px rgba(102,126,234,0.3)',
          }}
        >
          👨‍👩‍👧 我是家长，看成长
        </button>
      </div>
    </div>
  );
}
