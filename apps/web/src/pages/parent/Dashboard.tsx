export function ParentDashboard() {
  return (
    <div style={{
      minHeight: '100vh', padding: 24,
      background: '#F5F7FA', fontFamily: '-apple-system, sans-serif',
    }}>
      <h1 style={{ fontSize: 24, color: '#333', marginBottom: 24 }}>
        呜哩成长仪表盘
      </h1>

      {/* 4C 雷达图占位 */}
      <div style={{
        background: 'white', borderRadius: 16, padding: 24, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <h2 style={{ fontSize: 18, color: '#555', marginBottom: 16 }}>4C 能力雷达</h2>
        <div style={{
          height: 250, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#bbb', fontSize: 14,
        }}>
          雷达图（开发中）— 需要孩子先完成对话
        </div>
      </div>

      {/* 成长趋势占位 */}
      <div style={{
        background: 'white', borderRadius: 16, padding: 24, marginBottom: 16,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        <h2 style={{ fontSize: 18, color: '#555', marginBottom: 16 }}>成长趋势</h2>
        <div style={{
          height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#bbb', fontSize: 14,
        }}>
          趋势图（开发中）— 需要多次对话数据
        </div>
      </div>

      {/* 快速建议 */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 16, padding: 24, color: 'white',
      }}>
        <h2 style={{ fontSize: 18, marginBottom: 12 }}>呜哩的建议</h2>
        <p style={{ fontSize: 14, opacity: 0.9 }}>
          还没有对话数据哦～让孩子先和呜哩聊聊天吧！
        </p>
      </div>
    </div>
  );
}
