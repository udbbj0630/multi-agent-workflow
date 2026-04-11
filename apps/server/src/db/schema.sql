-- 呜哩 (Uli) 数据库 Schema
-- PostgreSQL

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 家长账号
CREATE TABLE parents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone         VARCHAR(11) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  nickname      VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 孩子档案
CREATE TABLE children (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id     UUID REFERENCES parents(id) ON DELETE CASCADE,
  nickname      VARCHAR(50) NOT NULL,
  birth_date    DATE NOT NULL,
  gender        VARCHAR(10),
  avatar_url    VARCHAR(500),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 对话会话
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  duration_sec    INTEGER,
  turn_count      INTEGER DEFAULT 0,
  scenario_type   VARCHAR(50),
  difficulty_level SMALLINT DEFAULT 1,
  summary         TEXT,
  emotion_arc     JSONB,
  key_moments     JSONB
);

CREATE INDEX idx_sessions_child ON sessions(child_id);
CREATE INDEX idx_sessions_started ON sessions(started_at);

-- 对话轮次明细
CREATE TABLE turns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID REFERENCES sessions(id) ON DELETE CASCADE,
  turn_number   INTEGER NOT NULL,
  role          VARCHAR(10) NOT NULL,
  text          TEXT NOT NULL,
  audio_url     VARCHAR(500),
  emotion_tag   VARCHAR(30),
  assessment_tag VARCHAR(50),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_turns_session ON turns(session_id);

-- 4C 评分（每次 session 一条）
CREATE TABLE session_scores (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        UUID REFERENCES sessions(id) ON DELETE CASCADE,
  child_id          UUID REFERENCES children(id) ON DELETE CASCADE,
  creativity        DECIMAL(5,2),
  critical_thinking DECIMAL(5,2),
  communication     DECIMAL(5,2),
  collaboration     DECIMAL(5,2),
  overall           DECIMAL(5,2),
  sample_count      INTEGER DEFAULT 0,
  confidence        DECIMAL(3,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scores_child ON session_scores(child_id);
CREATE INDEX idx_scores_created ON session_scores(created_at);

-- 能力基线（每个孩子每个维度一条，持续更新）
CREATE TABLE child_baselines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id        UUID REFERENCES children(id) ON DELETE CASCADE,
  dimension       VARCHAR(30) NOT NULL,
  current_score   DECIMAL(5,2) DEFAULT 50,
  difficulty_level SMALLINT DEFAULT 1,
  trend           VARCHAR(10) DEFAULT 'stable',
  session_count   INTEGER DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(child_id, dimension)
);

-- 长期记忆
CREATE TABLE child_memories (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id       UUID REFERENCES children(id) ON DELETE CASCADE,
  category       VARCHAR(30) NOT NULL,
  key            VARCHAR(100) NOT NULL,
  value          TEXT NOT NULL,
  source         VARCHAR(30) DEFAULT 'extracted',
  confidence     DECIMAL(3,2) DEFAULT 0.5,
  mention_count  INTEGER DEFAULT 1,
  last_mentioned TIMESTAMPTZ DEFAULT NOW(),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_child ON child_memories(child_id);
CREATE INDEX idx_memories_category ON child_memories(child_id, category);

-- 里程碑
CREATE TABLE milestones (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID REFERENCES children(id) ON DELETE CASCADE,
  dimension     VARCHAR(30) NOT NULL,
  event_type    VARCHAR(50) NOT NULL,
  description   TEXT NOT NULL,
  triggered_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_milestones_child ON milestones(child_id);

-- 知识点树
CREATE TABLE knowledge_nodes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  concept       VARCHAR(100) NOT NULL,
  parent_id     UUID REFERENCES knowledge_nodes(id),
  level         SMALLINT NOT NULL,
  min_age       SMALLINT,
  max_age       SMALLINT,
  content       JSONB NOT NULL,
  is_boundary   BOOLEAN DEFAULT FALSE,
  tags          TEXT[]
);

CREATE INDEX idx_knowledge_concept ON knowledge_nodes(concept);

-- 家长报告
CREATE TABLE parent_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id      UUID REFERENCES children(id) ON DELETE CASCADE,
  period_type   VARCHAR(20) NOT NULL,
  period_start  DATE NOT NULL,
  period_end    DATE NOT NULL,
  radar_data    JSONB NOT NULL,
  trend_data    JSONB NOT NULL,
  insights      JSONB NOT NULL,
  suggestions   JSONB NOT NULL,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reports_child ON parent_reports(child_id);
