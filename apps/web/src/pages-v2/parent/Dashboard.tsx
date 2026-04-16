import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch } from "../Welcome";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  parentId: string;
  token: string;
  onBack: () => void;
  onLogout: () => void;
}

interface ChildItem { id: string; nickname: string }
interface ChildrenResponse { children: ChildItem[] }
interface BaselineRadar { creativity: number; criticalThinking: number; communication: number; collaboration: number }
interface BaselineResponse { radar: BaselineRadar; baselines: BaselineDim[] }
interface BaselineDim { dimension: string; currentScore: number; trend: string; sessionCount: number }
interface TrendItem { date: string; creativity: number; criticalThinking: number; communication: number; collaboration: number }
interface MilestoneItem { dimension: string; eventType: string; description: string; triggeredAt: string }
interface MemoryItem { category: string; key: string; value: string; mentionCount: number }
interface NarrativeResponse { narrative: string }

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDate(date: string): string {
  if (!date) return "";
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? date : `${d.getMonth() + 1}/${d.getDate()}`;
}

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [target, duration]);
  return value;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const Dashboard: React.FC<Props> = ({ parentId, token, onBack, onLogout }) => {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [baseline, setBaseline] = useState<BaselineResponse | null>(null);
  const [trend, setTrend] = useState<TrendItem[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [narrative, setNarrative] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Load children list
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await apiFetch<ChildrenResponse>(`/api/parents/${parentId}/children`, token);
        if (!mounted) return;
        setChildren(res.children);
        if (res.children.length > 0) {
          setSelectedChildId(res.children[0].id);
        }
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "获取孩子列表失败";
        setError(msg);
        setLoading(false);
        if ((err as Error & { status?: number }).status === 401) onLogout();
      }
    };
    load();
    return () => { mounted = false; };
  }, [parentId, token, onLogout]);

  // Load child dashboard data
  useEffect(() => {
    if (!selectedChildId) return;
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setError("");
      setBaseline(null);
      setTrend([]);
      setMilestones([]);
      setMemories([]);
      setNarrative("");

      try {
        const [b, t, m, mem, n] = await Promise.all([
          apiFetch<BaselineResponse>(`/api/children/${selectedChildId}/baseline`, token),
          apiFetch<TrendItem[]>(`/api/children/${selectedChildId}/trend`, token),
          apiFetch<MilestoneItem[]>(`/api/children/${selectedChildId}/milestones`, token),
          apiFetch<MemoryItem[]>(`/api/children/${selectedChildId}/memories`, token),
          apiFetch<NarrativeResponse>(`/api/children/${selectedChildId}/narrative`, token),
        ]);
        if (!mounted) return;
        setBaseline(b);
        setTrend(t);
        setMilestones(m);
        setMemories(mem);
        setNarrative(n.narrative);
      } catch (err) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : "获取成长数据失败";
        setError(msg);
        if ((err as Error & { status?: number }).status === 401) onLogout();
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [selectedChildId, token, onLogout]);

  const selectedChild = useMemo(
    () => children.find((c) => c.id === selectedChildId),
    [children, selectedChildId],
  );

  const radarData = useMemo(
    () => baseline
      ? [
          { subject: "创造力", value: baseline.radar.creativity },
          { subject: "批判思维", value: baseline.radar.criticalThinking },
          { subject: "沟通表达", value: baseline.radar.communication },
          { subject: "协作力", value: baseline.radar.collaboration },
        ]
      : [],
    [baseline],
  );

  const scoreCards = useMemo(() => [
    { label: "创造力", value: baseline?.radar.creativity ?? 0, cls: "amber" },
    { label: "批判思维", value: baseline?.radar.criticalThinking ?? 0, cls: "forest" },
    { label: "沟通表达", value: baseline?.radar.communication ?? 0, cls: "leaf" },
    { label: "协作力", value: baseline?.radar.collaboration ?? 0, cls: "honey" },
  ], [baseline]);

  const c1 = useCountUp(scoreCards[0].value);
  const c2 = useCountUp(scoreCards[1].value);
  const c3 = useCountUp(scoreCards[2].value);
  const c4 = useCountUp(scoreCards[3].value);
  const animated = [c1, c2, c3, c4];

  const handleRetry = useCallback(() => setError(""), []);

  const tooltipStyle = {
    background: "rgba(60,36,21,0.92)",
    border: "1px solid rgba(232,108,90,0.2)",
    borderRadius: 14,
    color: "#fff",
    fontFamily: "var(--font-body)",
  };

  return (
    <>
      <section className="page page-parent active">
        {/* Header */}
        <div className="dash-header">
          <button type="button" className="btn-back-dash" onClick={onBack} aria-label="返回"
            style={{ border: "none", background: "transparent", padding: 0 }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <div style={{ color: "white", fontWeight: 700, fontSize: 18 }}>成长观测台</div>
          {children.length > 0 ? (
            <div className="child-selector">
              <div className="child-avatar">
                {(selectedChild?.nickname || "宝贝").slice(0, 2)}
              </div>
              <select
                value={selectedChildId}
                onChange={(e) => setSelectedChildId(e.target.value)}
                className="child-select"
              >
                {children.map((c) => (
                  <option key={c.id} value={c.id}>{c.nickname}</option>
                ))}
              </select>
            </div>
          ) : (
            <button type="button" className="btn-logout-header" onClick={onLogout}>
              退出
            </button>
          )}
        </div>

        <div className="dash-content">
          {error && (
            <div className="dash-error-banner">
              <span>{error}</span>
              <button type="button" className="dash-retry-btn" onClick={handleRetry}>
                重试
              </button>
            </div>
          )}

          {!loading && children.length === 0 && (
            <div className="dash-empty-state">
              <p>还没有孩子的记录</p>
              <p style={{ fontSize: 14, opacity: 0.7, marginTop: 8 }}>
                请在注册时添加孩子信息
              </p>
            </div>
          )}

          {children.length > 0 && (
            <>
              {/* Score Grid */}
              <div className="score-grid-card">
                <h3 className="section-title">能力树苗分布</h3>
                <div className="score-grid">
                  {loading ? (
                    Array.from({ length: 4 }, (_, i) => (
                      <div key={`sk-${i}`} className={`score-pill skeleton`}>
                        <div className="score-label" style={{ opacity: 0.3 }}>加载中</div>
                        <div className="score-value">--</div>
                      </div>
                    ))
                  ) : (
                    scoreCards.map((card, i) => (
                      <div key={card.label} className={`score-pill ${card.cls}`}>
                        <div className="score-label">{card.label}</div>
                        <div className="score-value">{animated[i]}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Radar Chart */}
              <div className="constellation-card">
                <h3 className="section-title">能力森林图</h3>
                <div style={{ width: "100%", height: 280 }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--f-text-muted)" }}>
                      加载中...
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart outerRadius="72%" data={radarData}>
                      <PolarGrid stroke="rgba(60,36,21,0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "var(--f-text-muted)", fontSize: 12 }} />
                      <Radar name="能力值" dataKey="value" stroke="var(--f-amber)" fill="var(--f-canopy-light)" fillOpacity={0.25} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Trend Chart */}
              <div className="trend-card">
                <h3 className="section-title">本周成长趋势</h3>
                <div style={{ height: 260 }}>
                  {loading ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--f-text-muted)" }}>
                      加载中...
                    </div>
                  ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend}>
                      <defs>
                        <linearGradient id="gCreativity" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#D4881C" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#D4881C" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gCritical" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2D7A3A" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#2D7A3A" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gCommunication" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#81C784" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#81C784" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gCollaboration" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#F5B041" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="#F5B041" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(60,36,21,0.06)" />
                      <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(60,36,21,0.2)" tick={{ fill: "var(--f-text-muted)", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} stroke="rgba(60,36,21,0.2)" tick={{ fill: "var(--f-text-muted)", fontSize: 11 }} />
                      <Tooltip labelFormatter={(v) => formatDate(String(v))} contentStyle={tooltipStyle} />
                      <Legend />
                      <Area type="monotone" dataKey="creativity" stroke="#D4881C" fill="url(#gCreativity)" strokeWidth={2} name="创造力" />
                      <Area type="monotone" dataKey="criticalThinking" stroke="#2D7A3A" fill="url(#gCritical)" strokeWidth={2} name="批判思维" />
                      <Area type="monotone" dataKey="communication" stroke="#81C784" fill="url(#gCommunication)" strokeWidth={2} name="沟通表达" />
                      <Area type="monotone" dataKey="collaboration" stroke="#F5B041" fill="url(#gCollaboration)" strokeWidth={2} name="协作力" />
                    </AreaChart>
                  </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Milestones */}
              <div className="milestone-card">
                <h3 className="section-title" style={{ color: "var(--f-honey)" }}>里程碑</h3>
                {milestones.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {milestones.map((ms, i) => (
                      <div key={i}>
                        <div className="milestone-badge">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ verticalAlign: -2, marginRight: 4 }}>
                            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                          </svg>
                          {ms.dimension} · {ms.eventType}
                        </div>
                        <div style={{ color: "rgba(255,253,245,0.9)", lineHeight: 1.6 }}>
                          {ms.description}
                        </div>
                        <div style={{ marginTop: 4, color: "rgba(255,253,245,0.5)", fontSize: 13 }}>
                          {formatDate(ms.triggeredAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: "rgba(255,253,245,0.7)" }}>
                    这周还在悄悄酝酿新的小成就。
                  </div>
                )}
              </div>

              {/* Memory Cloud */}
              <div className="memory-card">
                <h3 className="section-title">闪光记忆云</h3>
                <div className="memory-cloud">
                  {memories.length > 0 ? (
                    memories.map((m) => (
                      <div key={`${m.category}-${m.key}-${m.value}`} className="memory-tag">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93z"/>
                        </svg>
                        {m.value || m.key} · {m.mentionCount}
                      </div>
                    ))
                  ) : (
                    <div className="memory-tag">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                      </svg>
                      还在收集今天的闪光片段
                    </div>
                  )}
                </div>
              </div>

              {/* Narrative */}
              <div className="narrative-card">
                <h3 className="section-title" style={{ color: "var(--f-amber)" }}>成长来信</h3>
                <div className="narrative-date">{new Date().toLocaleDateString("zh-CN")}</div>
                <p className="narrative-text">
                  {narrative || "呜哩正在整理今天的观察，稍后会送来一封温柔的小信。"}
                </p>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
};

export default Dashboard;
