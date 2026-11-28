import { Pool } from "pg";

declare global {
  var __lumenstockPgPool: Pool | undefined;
  var __lumenstockSchemaReady: Promise<void> | undefined;
}

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim().length > 0);
}

export function getPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured.");
  }
  if (!globalThis.__lumenstockPgPool) {
    const conn = process.env.DATABASE_URL;
    const isLocal = conn.includes("localhost") || conn.includes("127.0.0.1");
    globalThis.__lumenstockPgPool = new Pool({
      connectionString: conn,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30_000,
    });
  }
  return globalThis.__lumenstockPgPool;
}

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'super_admin')),
    paid BOOLEAN NOT NULL DEFAULT FALSE,
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    plan_id TEXT,
    credits_remaining INTEGER NOT NULL DEFAULT 0,
    plan_expires_at TIMESTAMPTZ,
    renewal_notified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`,
  `CREATE INDEX IF NOT EXISTS idx_users_plan_expires_at ON users (plan_expires_at)`,
  `CREATE TABLE IF NOT EXISTS email_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_email_tokens_user_id ON email_tokens (user_id)`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('stripe', 'razorpay')),
    provider_payment_id TEXT NOT NULL UNIQUE,
    plan_id TEXT NOT NULL,
    credits_granted INTEGER NOT NULL DEFAULT 0,
    amount_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'paid',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments (user_id)`,
  `CREATE TABLE IF NOT EXISTS downloads (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    asset_title TEXT NOT NULL,
    image_url TEXT NOT NULL,
    size_id TEXT NOT NULL,
    license TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS idx_downloads_user_id ON downloads (user_id)`,
];

export async function ensureDatabaseSchema(): Promise<void> {
  if (!hasDatabase()) return;
  if (!globalThis.__lumenstockSchemaReady) {
    globalThis.__lumenstockSchemaReady = (async () => {
      const pool = getPool();
      for (const sql of SCHEMA_STATEMENTS) {
        await pool.query(sql);
      }
    })().catch((err) => {
      globalThis.__lumenstockSchemaReady = undefined;
      throw err;
    });
  }
  await globalThis.__lumenstockSchemaReady;
}
