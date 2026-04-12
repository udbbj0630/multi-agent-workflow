import { useState, useEffect } from 'react';

interface RadarData {
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
}

interface Baseline {
  dimension: string;
  currentScore: number;
  difficultyLevel: number;
  trend: string;
  sessionCount: number;
  updatedAt: string;
}

interface TrendPoint {
  date: string;
  creativity: number;
  criticalThinking: number;
  communication: number;
  collaboration: number;
}

interface Milestone {
  dimension: string;
  eventType: string;
  description: string;
  triggeredAt: string;
}

interface Memory {
  category: string;
  key: string;
  value: string;
  mentionCount: number;
}

const DIMENSION_NAMES: Record<string, string> = {
  creativity: '创造力',
  critical_thinking: '批判性思维',
  communication: '沟通力',
  collaboration: '协作力',
};

const TREND_ICON: Record<string, string> = {
  rising: '📈',
  stable: '➡️',
  declining: '📉',
};

interface Props {
  parentId: string;
  token: string;
  onBack: () => void;
}

export function ParentDashboard({ parentId, token, onBack }: Props) {
  const [childId, setChildId] = useState<string>('');
  const [childName, setChildName] = useState<string>('');
  const [radar, setRadar] = useState<RadarData | null>(null);
  const [baselines, setBaselines] = useState<Baseline[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loading, setLoading] = useState(true);

  // 获取家长的孩子列表
  useEffect(() => {
    fetch(`/api/parents/${parentId}/children`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.children?.[0]) {
          setChildId(data.children[0].id);
          setChildName(data.children[0].nickname);
        }
      })
      .catch(console.error);
  }, [parentId, token]);

  // 加载数据
  useEffect(() => {
    if (!childId) return;
    setLoading(true);

    Promise.all([
      fetch(`/api/children/${childId}/baseline`).then((r) => r.json()),
      fetch(`/api/children/${childId}/trend`).then((r) => r.json()),
      fetch(`/api/children/${childId}/milestones`).then((r) => r.json()),
      fetch(`/api/children/${childId}/memories`).then((r) => r.json()),
    ])
      .then(([baselineData, trendData, milestoneData, memoryData]) => {
        setRadar(baselineData.radar);
        setBaselines(baselineData.baselines || []);
        setTrend(trendData || []);
        setMilestones(milestoneData || []);
        setMemories(memoryData || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [childId]);

  const maxScore = Math.max(
    radar ? Math.max(radar.creativity, radar.criticalThinking, radar.communication, radar.collaboration) : 50,
    60,
  );

  return (
    <div style={{
      minHeight: '100vh', padding: '20px 16px',
      background: '#F5F7FA', fontFamily: '-apple-system, sans-serif',
      maxWidth: 480, margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
        <button onClick={onBack} style={{
          padding: '6px 12px', borderRadius: 16, border: 'none',
          background: 'rgba(0,0,0,0.05)', fontSize: 13, cursor: 'pointer',
        }}>
          ← 返回
        </button>
        <h1 style={{ fontSize: 22, color: '#333' }}>呜哩成长仪表盘</h1>
      </div>
      <p style={{ fontSize: 13, color: '#999', marginBottom: 20 }}>{childName || '孩子'}的 4C 能力追踪</p>

      {loading && <div style={{ textAlign: 'center', color: '#999', padding: 40 }}>加载中...</div>}

      {!loading && radar && (
        <>
          {/* 4C 能力条 */}
          <div style={{
            background: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: 16, color: '#555', marginBottom: 16 }}>4C 能力</h2>
            {[
              { key: 'creativity', label: '创造力', score: radar.creativity, color: '#FF6B6B' },
              { key: 'criticalThinking', label: '批判性思维', score: radar.criticalThinking, color: '#4ECDC4' },
              { key: 'communication', label: '沟通力', score: radar.communication, color: '#45B7D1' },
              { key: 'collaboration', label: '协作力', score: radar.collaboration, color: '#96CEB4' },
            ].map((dim) => (
              <div key={dim.key} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: '#333' }}>{dim.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: dim.color }}>{dim.score}</span>
                    {baselines.find((b) => b.dimension === (dim.key === 'criticalThinking' ? 'critical_thinking' : dim.key)) && (
                      <span style={{ fontSize: 12 }}>
                        {TREND_ICON[baselines.find((b) => b.dimension === (dim.key === 'criticalThinking' ? 'critical_thinking' : dim.key))?.trend || 'stable']}
                      </span>
                    )}
                  </div>
                </div>
                <div style={{
                  height: 8, borderRadius: 4, background: '#f0f0f0',
                }}>
                  <div style={{
                    height: 8, borderRadius: 4, background: dim.color,
                    width: `${dim.score}%`, transition: 'width 0.5s',
                  }} />
                </div>
              </div>
            ))}
          </div>

          {/* 成长趋势 */}
          <div style={{
            background: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
            boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <h2 style={{ fontSize: 16, color: '#555', marginBottom: 16 }}>成长趋势</h2>
            {trend.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {trend.map((point, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 12, color: '#666',
                    padding: '6px 0', borderBottom: '1px solid #f5f5f5',
                  }}>
                    <span style={{ width: 70, color: '#999' }}>{point.date.slice(5)}</span>
                    <span style={{ color: '#FF6B6B', width: 40 }}>C:{point.creativity}</span>
                    <span style={{ color: '#4ECDC4', width: 40 }}>思:{point.criticalThinking}</span>
                    <span style={{ color: '#45B7D1', width: 40 }}>说:{point.communication}</span>
                    <span style={{ color: '#96CEB4', width: 40 }}>合:{point.collaboration}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: '#bbb', fontSize: 14, padding: 20 }}>
                还没有对话数据～让孩子先和呜哩聊聊天吧！
              </div>
            )}
          </div>

          {/* 呜哩的记忆 */}
          {memories.length > 0 && (
            <div style={{
              background: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <h2 style={{ fontSize: 16, color: '#555', marginBottom: 16 }}>呜哩记得关于小宇的事</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {memories.map((mem, i) => (
                  <span key={i} style={{
                    padding: '6px 12px', borderRadius: 12,
                    background: mem.category === 'interest' ? '#FFF3E0' :
                                mem.category === 'relation' ? '#E3F2FD' :
                                mem.category === 'emotion' ? '#FCE4EC' : '#F3E5F5',
                    fontSize: 13, color: '#555',
                  }}>
                    {mem.value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 里程碑 */}
          {milestones.length > 0 && (
            <div style={{
              background: 'white', borderRadius: 16, padding: 20, marginBottom: 16,
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
            }}>
              <h2 style={{ fontSize: 16, color: '#555', marginBottom: 16 }}>里程碑</h2>
              {milestones.map((m, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid #f5f5f5',
                }}>
                  <span style={{ fontSize: 20 }}>🏆</span>
                  <div>
                    <div style={{ fontSize: 14, color: '#333' }}>{m.description}</div>
                    <div style={{ fontSize: 12, color: '#999' }}>{new Date(m.triggeredAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 呜哩的建议 */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 16, padding: 20, color: 'white',
          }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>呜哩的建议</h2>
            {radar.creativity >= 70 || radar.criticalThinking >= 70 || radar.communication >= 70 || radar.collaboration >= 70 ? (
              <div style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>
                <p>小宇最近表现很棒！</p>
                {radar.creativity >= 70 && <p>· 创造力突出，可以多提供开放性的话题，让想象力继续飞！</p>}
                {radar.criticalThinking >= 70 && <p>· 批判性思维在进步，试着和他讨论"为什么"的问题。</p>}
                {radar.communication >= 70 && <p>· 沟通能力不错，鼓励他讲完整的故事。</p>}
                {radar.collaboration >= 70 && <p>· 协作意识在增强，可以安排一些需要合作完成的任务。</p>}
              </div>
            ) : (
              <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.9 }}>
                还没有对话数据哦～让孩子先和呜哩聊聊天，多聊几次就能看到成长曲线了！
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
