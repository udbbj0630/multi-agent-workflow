import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import ForestFox from "../components-v2/ForestFox";
import Chat from "./child/Chat";
import Dashboard from "./parent/Dashboard";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface StoredSession {
  token: string;
  parentId: string;
  childId: string;
  childName: string;
}

type AppRoute = "welcome" | "child" | "parent";
type WelcomePage = "login" | "register" | "choose";

interface AuthResponse {
  token: string;
  parentId: string;
  childId: string;
  childName: string;
}

interface AuthFormState {
  phone: string;
  password: string;
  childName: string;
  childBirth: string;
}

/* ------------------------------------------------------------------ */
/*  Shared helpers (same logic as v1)                                  */
/* ------------------------------------------------------------------ */

export const SESSION_KEY = "uli-session";

export function isTokenExpired(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function saveSession(session: StoredSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession(): StoredSession | null {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed?.token || !parsed.parentId) return null;
    if (isTokenExpired(parsed.token)) {
      clearSession();
      return null;
    }
    return parsed;
  } catch {
    clearSession();
    return null;
  }
}

export async function apiFetch<T>(url: string, token: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      ...options?.headers,
      Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    let message = `请求失败 (${res.status})`;
    try {
      const body = await res.json();
      message = body.error || body.message || message;
    } catch { /* fallback */ }
    const err = new Error(message);
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }

  return (await res.json()) as T;
}

/* ------------------------------------------------------------------ */
/*  Firefly particles                                                  */
/* ------------------------------------------------------------------ */

function createFireflies(count: number, prefix: string): JSX.Element[] {
  return Array.from({ length: count }, (_, i) => {
    const size = Math.random() * 5 + 3;
    return (
      <span
        key={`${prefix}-${i}`}
        className="firefly"
        style={{
          width: size,
          height: size,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 4}s`,
          animationDuration: `${Math.random() * 4 + 3}s`,
        }}
      />
    );
  });
}

/* ------------------------------------------------------------------ */
/*  Leaf decorations                                                   */
/* ------------------------------------------------------------------ */

function LeafDecorations() {
  const leaves = useMemo(() => [
    { top: "5%", left: "3%", size: 18, rotation: -25, delay: 0 },
    { top: "15%", right: "5%", size: 14, rotation: 15, delay: 0.5 },
    { bottom: "20%", left: "8%", size: 16, rotation: -10, delay: 1 },
    { bottom: "10%", right: "10%", size: 12, rotation: 20, delay: 1.5 },
  ], []);

  return (
    <>
      {leaves.map((leaf, i) => (
        <svg
          key={`leaf-${i}`}
          className="leaf-particle"
          style={{
            position: "absolute",
            ...(leaf.top ? { top: leaf.top } : {}),
            ...(leaf.bottom ? { bottom: leaf.bottom } : {}),
            ...(leaf.left ? { left: leaf.left } : {}),
            ...(leaf.right ? { right: leaf.right } : {}),
            width: leaf.size,
            height: leaf.size,
            transform: `rotate(${leaf.rotation}deg)`,
            animationDelay: `${leaf.delay}s`,
            zIndex: 1,
          }}
          viewBox="0 0 24 24"
        >
          <path
            d="M17 8C8 10 5.9 16.17 3.82 21.34L5.71 22l1-2.3A4.49 4.49 0 008 20c4 0 8.5-3 10.36-7.86A8.18 8.18 0 0021 8a1 1 0 00-1-1c-1 0-2 .1-3 1z"
            fill="#81C784"
            opacity={0.6}
          />
        </svg>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Welcome (login / register / choose)                                */
/* ------------------------------------------------------------------ */

interface WelcomeProps {
  session: StoredSession | null;
  onAuth: (session: StoredSession) => void;
  onChildMode: () => void;
  onParentMode: () => void;
  onLogout: () => void;
}

const Welcome: React.FC<WelcomeProps> = ({
  session,
  onAuth,
  onChildMode,
  onParentMode,
  onLogout,
}) => {
  const [page, setPage] = useState<WelcomePage>(session ? "choose" : "login");
  const [form, setForm] = useState<AuthFormState>({
    phone: "",
    password: "",
    childName: "",
    childBirth: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const fireflies = useMemo(() => createFireflies(18, "w"), []);

  const updateField = useCallback((field: keyof AuthFormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    if (session) setPage("choose");
  }, [session]);

  const validateField = useCallback((field: keyof AuthFormState, value: string) => {
    const errors: Record<string, string> = {};
    if (field === "phone") {
      if (value && !/^\d{11}$/.test(value)) errors.phone = "请输入11位手机号";
    }
    if (field === "password") {
      if (value && value.length < 8) errors.password = "密码至少8位";
    }
    if (field === "childName" && page === "register") {
      if (value && /[<>{}\\]/.test(value)) errors.childName = "名字不能包含特殊符号";
    }
    setFieldErrors((prev) => ({ ...prev, ...errors, [field]: errors[field] || "" }));
  }, [page]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const isRegister = page === "register";
    const endpoint = isRegister ? "/api/auth/register" : "/api/auth/login";
    const body = isRegister
      ? { phone: form.phone, password: form.password, childName: form.childName, childBirth: form.childBirth }
      : { phone: form.phone, password: form.password };

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        let msg = "认证失败，请稍后再试";
        try {
          const json = await res.json();
          msg = json.error || msg;
        } catch { /* use default */ }
        throw new Error(msg);
      }

      const data = (await res.json()) as AuthResponse;
      const s: StoredSession = {
        token: data.token,
        parentId: data.parentId,
        childId: data.childId,
        childName: data.childName,
      };
      saveSession(s);
      onAuth(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    clearSession();
    setForm({ phone: "", password: "", childName: "", childBirth: "" });
    setError("");
    onLogout();
  }, [onLogout]);

  const childDisplayName = session?.childName || form.childName || "小宝贝";

  /* ---- Login / Register ---- */
  if (page !== "choose") {
    return (
      <>
        <div className="firefly-layer">{fireflies}</div>
        <LeafDecorations />
        <section className="page page-login active">
          <div
            style={{
              width: "100%",
              minHeight: "100vh",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: 24,
            }}
          >
            <form className="portal-form page-enter" onSubmit={handleSubmit}>
              <div className="portal-uli-wrap">
                <ForestFox mood={page === "register" ? "wave" : "idle"} size={120} />
              </div>

              <h1 className="portal-title">
                {page === "login" ? "呜哩 Uli" : "创建新账号"}
              </h1>
              <p className="portal-subtitle">
                {page === "login"
                  ? "3-8岁孩子的AI成长伙伴"
                  : "注册后即可开始使用呜哩"}
              </p>

              <input
                className="input-forest"
                type="tel"
                inputMode="numeric"
                placeholder="家长手机号"
                aria-label="家长手机号"
                maxLength={11}
                value={form.phone}
                onChange={(e) => { updateField("phone", e.target.value); if (fieldErrors.phone) setFieldErrors((p) => ({ ...p, phone: "" })); }}
                onBlur={() => validateField("phone", form.phone)}
                autoComplete="tel"
                required
              />
              {fieldErrors.phone && <div style={{ color: "var(--f-mushroom)", fontSize: 13, marginTop: -8 }}>{fieldErrors.phone}</div>}
              <input
                className="input-forest"
                type="password"
                placeholder="密码（至少8位）"
                aria-label="密码"
                minLength={8}
                value={form.password}
                onChange={(e) => { updateField("password", e.target.value); if (fieldErrors.password) setFieldErrors((p) => ({ ...p, password: "" })); }}
                onBlur={() => validateField("password", form.password)}
                autoComplete={page === "login" ? "current-password" : "new-password"}
                required
              />
              {fieldErrors.password && <div style={{ color: "var(--f-mushroom)", fontSize: 13, marginTop: -8 }}>{fieldErrors.password}</div>}

              {page === "register" && (
                <>
                  <input
                    className="input-forest"
                    type="text"
                    placeholder="孩子昵称"
                    aria-label="孩子昵称"
                    value={form.childName}
                    onChange={(e) => updateField("childName", e.target.value)}
                    required
                  />
                  <div style={{ position: "relative" }}>
                    <input
                      className="input-forest"
                      type="date"
                      max={new Date().toISOString().split("T")[0]}
                      min="2010-01-01"
                      value={form.childBirth}
                      onChange={(e) => updateField("childBirth", e.target.value)}
                      required
                      style={{ width: "100%" }}
                    />
                    {!form.childBirth && (
                      <span
                        style={{
                          position: "absolute",
                          left: 18,
                          top: "50%",
                          transform: "translateY(-50%)",
                          color: "var(--f-bark-light)",
                          pointerEvents: "none",
                          fontSize: "1rem",
                        }}
                      >
                        孩子生日
                      </span>
                    )}
                  </div>
                </>
              )}

              {error && (
                <div className="auth-error">{error}</div>
              )}

              <button className="btn-mushroom" type="submit" disabled={loading}>
                {loading
                  ? "登录中..."
                  : page === "login"
                    ? "登录"
                    : "创建账号"}
              </button>

              <button
                type="button"
                className="btn-switch-auth"
                onClick={() => {
                  setError("");
                  setPage((p) => (p === "login" ? "register" : "login"));
                }}
              >
                {page === "login" ? "没有账号？去注册" : "已有账号？去登录"}
              </button>

              <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 4 }}>
                <a href="/api/legal/privacy" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12 }}>
                  隐私政策
                </a>
                <a href="/api/legal/terms" target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12 }}>
                  服务条款
                </a>
              </div>
            </form>
          </div>
        </section>
      </>
    );
  }

  /* ---- Choose Mode ---- */
  return (
    <>
      <div className="firefly-layer">{fireflies}</div>
      <LeafDecorations />
      <section className="page page-select active">
        <div className="select-header page-enter">
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
            <ForestFox mood="happy" size={132} />
          </div>
          <h1>今天去森林的哪一边？</h1>
          <p>{childDisplayName} 的魔法森林已经醒过来了</p>
        </div>

        <div className="path-container page-enter">
          <button
            type="button"
            className="path-card path-card-child"
            onClick={onChildMode}
            style={{ appearance: "none", width: "100%" }}
          >
            <div className="path-icon-circle">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="5" fill="#F5B041" />
                <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="#F5B041" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h2>去玩耍</h2>
            <p>和呜哩聊天、听故事、把今天的小想法种进花园里</p>
          </button>

          <button
            type="button"
            className="path-card path-card-parent"
            onClick={onParentMode}
            style={{ appearance: "none", width: "100%" }}
          >
            <div className="path-icon-circle" style={{ background: "rgba(45,122,58,0.1)", borderColor: "rgba(45,122,58,0.15)" }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#2D7A3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2>去观测</h2>
            <p>查看成长星图、里程碑与呜哩记录下来的闪光记忆</p>
          </button>
        </div>

        <button type="button" className="btn-logout-choose" onClick={handleLogout}>
          退出登录
        </button>
      </section>
    </>
  );
};

/* ------------------------------------------------------------------ */
/*  Sidebar (desktop only)                                             */
/* ------------------------------------------------------------------ */

interface SidebarProps {
  childName: string;
  route: AppRoute;
  onChildMode: () => void;
  onParentMode: () => void;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ childName, route, onChildMode, onParentMode, onLogout }) => (
  <aside className="sidebar">
    <div className="sidebar-brand">
      <ForestFox mood="idle" size={64} />
      <div className="sidebar-brand-name">呜哩 Uli</div>
    </div>

    <nav className="sidebar-nav">
      <button
        type="button"
        className={`sidebar-nav-btn ${route === "child" ? "active" : ""}`}
        onClick={onChildMode}
      >
        <span className="sidebar-nav-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="5" fill="currentColor" opacity="0.6"/>
            <path d="M12 2v2M12 20v2M2 12h2M20 12h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </span>
        去玩耍
      </button>
      <button
        type="button"
        className={`sidebar-nav-btn ${route === "parent" ? "active" : ""}`}
        onClick={onParentMode}
      >
        <span className="sidebar-nav-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
        去观测
      </button>
    </nav>

    <div className="sidebar-footer">
      <div className="sidebar-child-name">{childName || "小宝贝"}</div>
      <button type="button" className="sidebar-logout" onClick={onLogout}>
        退出登录
      </button>
    </div>
  </aside>
);

/* ------------------------------------------------------------------ */
/*  App root — layout shell + routing                                  */
/* ------------------------------------------------------------------ */

export function App(): JSX.Element {
  const [session, setSession] = useState<StoredSession | null>(null);
  const [route, setRoute] = useState<AppRoute>("welcome");

  useEffect(() => {
    const saved = loadSession();
    if (saved) setSession(saved);
  }, []);

  const handleLogout = useCallback(() => {
    clearSession();
    setSession(null);
    setRoute("welcome");
  }, []);

  const handleAuth = useCallback((s: StoredSession) => {
    setSession(s);
  }, []);

  const isDesktop = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  if (!session) {
    return (
      <div className="app-shell">
        <div className="main-content">
          <Welcome
            session={null}
            onAuth={handleAuth}
            onChildMode={() => {}}
            onParentMode={() => {}}
            onLogout={handleLogout}
          />
        </div>
      </div>
    );
  }

  if (isDesktop) {
    return (
      <div className="app-shell app-shell--desktop">
        <Sidebar
          childName={session.childName}
          route={route}
          onChildMode={() => setRoute("child")}
          onParentMode={() => setRoute("parent")}
          onLogout={handleLogout}
        />
        <div className="main-content">
          {route === "child" ? (
            <Chat
              childId={session.childId}
              childName={session.childName}
              token={session.token}
              onBack={() => setRoute("welcome")}
              onLogout={handleLogout}
            />
          ) : route === "parent" ? (
            <Dashboard
              parentId={session.parentId}
              token={session.token}
              onBack={() => setRoute("welcome")}
              onLogout={handleLogout}
            />
          ) : (
            <Welcome
              session={session}
              onAuth={handleAuth}
              onChildMode={() => setRoute("child")}
              onParentMode={() => setRoute("parent")}
              onLogout={handleLogout}
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="main-content">
        {route === "child" ? (
          <Chat
            childId={session.childId}
            childName={session.childName}
            token={session.token}
            onBack={() => setRoute("welcome")}
            onLogout={handleLogout}
          />
        ) : route === "parent" ? (
          <Dashboard
            parentId={session.parentId}
            token={session.token}
            onBack={() => setRoute("welcome")}
            onLogout={handleLogout}
          />
        ) : (
          <Welcome
            session={session}
            onAuth={handleAuth}
            onChildMode={() => setRoute("child")}
            onParentMode={() => setRoute("parent")}
            onLogout={handleLogout}
          />
        )}
      </div>
    </div>
  );
}

export default Welcome;
