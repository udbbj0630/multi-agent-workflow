import { config as loadDotenv } from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (3 levels up from this file)
loadDotenv({ path: join(__dirname, '../../../.env') });

function requireEnv(name: 'LLM_API_KEY' | 'JWT_SECRET'): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`[config] Missing required environment variable: ${name}`);
  }
  return value;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`[config] Invalid PORT: ${value}`);
  }
  return parsed;
}

export interface AppConfig {
  PORT: number;
  NODE_ENV: string;
  LLM_API_KEY: string;
  LLM_BASE_URL: string;
  LLM_MODEL: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  DB_PATH: string;
  CORS_ORIGIN: string;
  BRAIN_URL: string;
  BRAIN_TIMEOUT: number;
}

export const config: AppConfig = Object.freeze({
  PORT: parsePort(process.env.PORT, 4000),
  NODE_ENV: process.env.NODE_ENV?.trim() || 'development',
  LLM_API_KEY: requireEnv('LLM_API_KEY'),
  LLM_BASE_URL: process.env.LLM_BASE_URL?.trim() || 'https://openrouter.ai/api/v1',
  LLM_MODEL: process.env.LLM_MODEL?.trim() || 'deepseek/deepseek-chat-v3-0324',
  JWT_SECRET: requireEnv('JWT_SECRET'),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN?.trim() || '30d',
  DB_PATH: join(__dirname, '../../../data/uli.db'),
  CORS_ORIGIN: process.env.CORS_ORIGIN?.trim() || 'http://localhost:5173',
  BRAIN_URL: process.env.BRAIN_URL?.trim() || 'http://localhost:4001',
  BRAIN_TIMEOUT: Number(process.env.BRAIN_TIMEOUT) || 30000,
});