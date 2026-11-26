import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { ensureDatabaseSchema, getPool, hasDatabase } from "./db";

export type UserRole = "user" | "super_admin";
export type TokenPurpose = "verify_email" | "reset_password";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  /** scrypt hash as salt:hash hex */
  passwordHash: string;
  role: UserRole;
  /** Active paid subscription / pack entitlement */
  paid: boolean;
  emailVerified: boolean;
  planId: string | null;
  creditsRemaining: number;
  planExpiresAt: string | null;
  renewalNotifiedAt: string | null;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  paid: boolean;
  emailVerified: boolean;
  planId: string | null;
  creditsRemaining: number;
  planExpiresAt: string | null;
  canDownload: boolean;
  createdAt: string;
};

type LocalTokenRecord = {
  tokenHash: string;
  userId: string;
  purpose: TokenPurpose;
  expiresAt: string;
  usedAt: string | null;
};

type LocalPaymentRecord = {
  id: string;
  userId: string;
  provider: "stripe" | "razorpay";
  providerPaymentId: string;
  planId: string;
  creditsGranted: number;
  amountCents: number;
  currency: string;
  status: string;
  createdAt: string;
};

type LocalDownloadRecord = {
  id: string;
  userId: string;
  assetTitle: string;
  imageUrl: string;
  sizeId: string;
  license: string;
  createdAt: string;
};

type UserFile = {
  users: StoredUser[];
  tokens?: LocalTokenRecord[];
  payments?: LocalPaymentRecord[];
  downloads?: LocalDownloadRecord[];
};

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export const SUPER_ADMIN_EMAIL = (process.env.LUMENSTOCK_ADMIN_EMAIL || "tarasu2008@gmail.com")
  .trim()
  .toLowerCase();

export function isValidEmail(email: string) {
  const value = email.trim();
  if (value.length < 5 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const next = scryptSync(password, salt, 64);
  const prev = Buffer.from(hash, "hex");
  if (prev.length !== next.length) return false;
  return timingSafeEqual(prev, next);
}

function hashToken(raw: string) {
  return createHash("sha256").update(raw).digest("hex");
}

export function userCanDownload(
  user: Pick<StoredUser, "role" | "paid" | "creditsRemaining" | "planExpiresAt">,
) {
  if (user.role === "super_admin") return true;
  if (!user.paid) return false;
  if (user.planExpiresAt && Date.now() > Date.parse(user.planExpiresAt) && user.creditsRemaining <= 0) {
    return false;
  }
  return user.creditsRemaining > 0;
}

export function publicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    paid: user.paid,
    emailVerified: user.emailVerified,
    planId: user.planId,
    creditsRemaining: user.creditsRemaining,
    planExpiresAt: user.planExpiresAt,
    canDownload: userCanDownload(user),
    createdAt: user.createdAt,
  };
}

// --- Local JSON store fallback (used only when DATABASE_URL is unset) ---

function loadLocalStore(): UserFile {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  let data: UserFile;
  if (!existsSync(USERS_FILE)) {
    data = { users: [], tokens: [], payments: [], downloads: [] };
  } else {
    try {
      data = JSON.parse(readFileSync(USERS_FILE, "utf8")) as UserFile;
      if (!Array.isArray(data.users)) data.users = [];
      if (!Array.isArray(data.tokens)) data.tokens = [];
      if (!Array.isArray(data.payments)) data.payments = [];
      if (!Array.isArray(data.downloads)) data.downloads = [];
    } catch {
      data = { users: [], tokens: [], payments: [], downloads: [] };
    }
  }

  let dirty = false;
  data.users = data.users.map((u) => {
    const next: StoredUser = {
      ...u,
      role: u.role || (normalizeEmail(u.email) === SUPER_ADMIN_EMAIL ? "super_admin" : "user"),
      paid: typeof u.paid === "boolean" ? u.paid : u.role === "super_admin",
      emailVerified: typeof u.emailVerified === "boolean" ? u.emailVerified : u.role === "super_admin",
      planId: u.planId ?? null,
      creditsRemaining:
        typeof u.creditsRemaining === "number"
          ? u.creditsRemaining
          : u.role === "super_admin"
            ? 999999
            : u.paid
              ? 10
              : 0,
      planExpiresAt: u.planExpiresAt ?? null,
      renewalNotifiedAt: u.renewalNotifiedAt ?? null,
    };
    if (
      next.role !== u.role ||
      next.paid !== u.paid ||
      next.emailVerified !== u.emailVerified ||
      next.creditsRemaining !== u.creditsRemaining
    ) {
      dirty = true;
    }
    return next;
  });

  if (seedLocalSuperAdmin(data)) dirty = true;
  if (dirty) saveLocalStore(data);
  return data;
}

function seedLocalSuperAdmin(data: UserFile) {
  const email = SUPER_ADMIN_EMAIL;
  const existing = data.users.find((u) => u.email === email);
  if (existing) {
    let changed = false;
    if (existing.role !== "super_admin") {
      existing.role = "super_admin";
      changed = true;
    }
    if (!existing.paid) {
      existing.paid = true;
      changed = true;
    }
    if (!existing.emailVerified) {
      existing.emailVerified = true;
      changed = true;
    }
    return changed;
  }

  const bootstrapPassword =
    process.env.LUMENSTOCK_ADMIN_PASSWORD || `Ls-${randomBytes(9).toString("base64url")}`;

  data.users.push({
    id: createHash("sha256")
      .update(`admin:${email}:${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 24),
    name: "Tara Super Admin",
    email,
    passwordHash: hashPassword(bootstrapPassword),
    role: "super_admin",
    paid: true,
    emailVerified: true,
    planId: "super_admin",
    creditsRemaining: 999999,
    planExpiresAt: null,
    renewalNotifiedAt: null,
    createdAt: new Date().toISOString(),
  });

  if (!process.env.LUMENSTOCK_ADMIN_PASSWORD) {
    try {
      writeFileSync(
        path.join(DATA_DIR, "admin-bootstrap.txt"),
        `email=${email}\npassword=${bootstrapPassword}\nrole=super_admin\n`,
        "utf8",
      );
    } catch {
      /* ignore */
    }
  }
  return true;
}

function saveLocalStore(data: UserFile) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
}

// --- PostgreSQL row mapper & admin seeding ---

type PgUserRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  role: UserRole;
  paid: boolean;
  email_verified: boolean;
  plan_id: string | null;
  credits_remaining: number;
  plan_expires_at: Date | string | null;
  renewal_notified_at: Date | string | null;
  created_at: Date | string;
};

function rowToStoredUser(r: PgUserRow): StoredUser {
  return {
    id: r.id,
    name: r.name,
    email: r.email,
    passwordHash: r.password_hash,
    role: r.role,
    paid: r.paid,
    emailVerified: r.email_verified,
    planId: r.plan_id,
    creditsRemaining: Number(r.credits_remaining ?? 0),
    planExpiresAt: r.plan_expires_at ? new Date(r.plan_expires_at).toISOString() : null,
    renewalNotifiedAt: r.renewal_notified_at ? new Date(r.renewal_notified_at).toISOString() : null,
    createdAt: new Date(r.created_at).toISOString(),
  };
}

let pgAdminSeeded = false;

async function ensurePgStore() {
  await ensureDatabaseSchema();
  if (pgAdminSeeded) return;
  const pool = getPool();
  const existing = await pool.query<PgUserRow>("SELECT * FROM users WHERE email = $1 LIMIT 1", [
    SUPER_ADMIN_EMAIL,
  ]);
  if (existing.rows.length > 0) {
    const u = existing.rows[0];
    if (u.role !== "super_admin" || !u.paid || !u.email_verified) {
      await pool.query(
        "UPDATE users SET role = 'super_admin', paid = TRUE, email_verified = TRUE WHERE id = $1",
        [u.id],
      );
    }
    pgAdminSeeded = true;
    return;
  }

  const adminPassword = process.env.LUMENSTOCK_ADMIN_PASSWORD;
  if (adminPassword && adminPassword.length >= 8) {
    const id = createHash("sha256")
      .update(`admin:${SUPER_ADMIN_EMAIL}:${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 24);
    await pool.query(
      `INSERT INTO users (id, name, email, password_hash, role, paid, email_verified, plan_id, credits_remaining)
       VALUES ($1, $2, $3, $4, 'super_admin', TRUE, TRUE, 'super_admin', 999999)
       ON CONFLICT (email) DO NOTHING`,
      [id, "Tara Super Admin", SUPER_ADMIN_EMAIL, hashPassword(adminPassword)],
    );
  }
  pgAdminSeeded = true;
}

// --- Public async repository API ---

export async function ensureAuthStore() {
  if (hasDatabase()) {
    await ensurePgStore();
  } else {
    loadLocalStore();
  }
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const key = normalizeEmail(email);
  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query<PgUserRow>("SELECT * FROM users WHERE email = $1 LIMIT 1", [key]);
    return res.rows[0] ? rowToStoredUser(res.rows[0]) : null;
  }
  const data = loadLocalStore();
  return data.users.find((u) => u.email === key) ?? null;
}

export async function findUserById(id: string): Promise<StoredUser | null> {
  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query<PgUserRow>("SELECT * FROM users WHERE id = $1 LIMIT 1", [id]);
    return res.rows[0] ? rowToStoredUser(res.rows[0]) : null;
  }
  const data = loadLocalStore();
  return data.users.find((u) => u.id === id) ?? null;
}

export async function createUser(input: { name: string; email: string; password: string }) {
  if (!isValidEmail(input.email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  const email = normalizeEmail(input.email);
  if (input.password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }

  const isAdmin = email === SUPER_ADMIN_EMAIL;
  const id = createHash("sha256")
    .update(`${email}:${Date.now()}:${randomBytes(8).toString("hex")}`)
    .digest("hex")
    .slice(0, 24);
  const passwordHash = hashPassword(input.password);

  if (hasDatabase()) {
    await ensurePgStore();
    const pool = getPool();
    const exists = await pool.query("SELECT 1 FROM users WHERE email = $1 LIMIT 1", [email]);
    if (exists.rows.length > 0) {
      return { ok: false as const, error: "An account with that email already exists." };
    }
    const res = await pool.query<PgUserRow>(
      `INSERT INTO users (id, name, email, password_hash, role, paid, email_verified, plan_id, credits_remaining)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        input.name.trim(),
        email,
        passwordHash,
        isAdmin ? "super_admin" : "user",
        isAdmin,
        isAdmin,
        isAdmin ? "super_admin" : null,
        isAdmin ? 999999 : 0,
      ],
    );
    return { ok: true as const, user: publicUser(rowToStoredUser(res.rows[0])) };
  }

  const data = loadLocalStore();
  if (data.users.some((u) => u.email === email)) {
    return { ok: false as const, error: "An account with that email already exists." };
  }
  const user: StoredUser = {
    id,
    name: input.name.trim(),
    email,
    passwordHash,
    role: isAdmin ? "super_admin" : "user",
    paid: isAdmin,
    emailVerified: isAdmin,
    planId: isAdmin ? "super_admin" : null,
    creditsRemaining: isAdmin ? 999999 : 0,
    planExpiresAt: null,
    renewalNotifiedAt: null,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  saveLocalStore(data);
  return { ok: true as const, user: publicUser(user) };
}

export async function authenticateUser(email: string, password: string) {
  if (!isValidEmail(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  const user = await findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  return { ok: true as const, user: publicUser(user) };
}

export async function createEmailToken(userId: string, purpose: TokenPurpose, ttlMinutes = 60) {
  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  if (hasDatabase()) {
    await ensurePgStore();
    await getPool().query(
      `INSERT INTO email_tokens (token_hash, user_id, purpose, expires_at)
       VALUES ($1, $2, $3, $4)`,
      [tokenHash, userId, purpose, expiresAt],
    );
    return rawToken;
  }

  const data = loadLocalStore();
  data.tokens = (data.tokens || []).filter((t) => Date.parse(t.expiresAt) > Date.now());
  data.tokens.push({ tokenHash, userId, purpose, expiresAt, usedAt: null });
  saveLocalStore(data);
  return rawToken;
}

export async function consumeEmailToken(rawToken: string, purpose: TokenPurpose): Promise<string | null> {
  const tokenHash = hashToken(rawToken.trim());
  if (!tokenHash) return null;

  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query<{ user_id: string }>(
      `UPDATE email_tokens
       SET used_at = NOW()
       WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > NOW()
       RETURNING user_id`,
      [tokenHash, purpose],
    );
    return res.rows[0]?.user_id ?? null;
  }

  const data = loadLocalStore();
  const tok = (data.tokens || []).find(
    (t) =>
      t.tokenHash === tokenHash &&
      t.purpose === purpose &&
      !t.usedAt &&
      Date.parse(t.expiresAt) > Date.now(),
  );
  if (!tok) return null;
  tok.usedAt = new Date().toISOString();
  saveLocalStore(data);
  return tok.userId;
}

export async function markEmailVerified(userId: string): Promise<PublicUser | null> {
  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query<PgUserRow>(
      "UPDATE users SET email_verified = TRUE WHERE id = $1 RETURNING *",
      [userId],
    );
    return res.rows[0] ? publicUser(rowToStoredUser(res.rows[0])) : null;
  }

  const data = loadLocalStore();
  const u = data.users.find((x) => x.id === userId);
  if (!u) return null;
  u.emailVerified = true;
  saveLocalStore(data);
  return publicUser(u);
}

export async function updateUserPassword(userId: string, newPassword: string) {
  if (newPassword.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }
  const passwordHash = hashPassword(newPassword);

  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query("UPDATE users SET password_hash = $1 WHERE id = $2", [
      passwordHash,
      userId,
    ]);
    if (!res.rowCount) return { ok: false as const, error: "User not found." };
    return { ok: true as const };
  }

  const data = loadLocalStore();
  const u = data.users.find((x) => x.id === userId);
  if (!u) return { ok: false as const, error: "User not found." };
  u.passwordHash = passwordHash;
  saveLocalStore(data);
  return { ok: true as const };
}

export async function grantPaymentEntitlement(input: {
  userId: string;
  provider: "stripe" | "razorpay";
  providerPaymentId: string;
  planId: string;
  credits: number;
  amountCents: number;
  currency: string;
  durationDays: number | null;
}) {
  const paymentId = `pay_${randomBytes(10).toString("hex")}`;
  const expiresAt =
    input.durationDays && input.durationDays > 0
      ? new Date(Date.now() + input.durationDays * 86_400_000).toISOString()
      : null;

  if (hasDatabase()) {
    await ensurePgStore();
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const inserted = await client.query(
        `INSERT INTO payments (id, user_id, provider, provider_payment_id, plan_id, credits_granted, amount_cents, currency, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'paid')
         ON CONFLICT (provider_payment_id) DO NOTHING
         RETURNING id`,
        [
          paymentId,
          input.userId,
          input.provider,
          input.providerPaymentId,
          input.planId,
          input.credits,
          input.amountCents,
          input.currency.toUpperCase(),
        ],
      );
      if (inserted.rows.length === 0) {
        await client.query("ROLLBACK");
        const existingUser = await findUserById(input.userId);
        return { alreadyProcessed: true, user: existingUser ? publicUser(existingUser) : null };
      }

      const updated = await client.query<PgUserRow>(
        `UPDATE users
         SET paid = TRUE,
             plan_id = $2,
             credits_remaining = credits_remaining + $3,
             plan_expires_at = CASE
               WHEN $4::timestamptz IS NULL THEN plan_expires_at
               WHEN plan_expires_at IS NOT NULL AND plan_expires_at > $4::timestamptz THEN plan_expires_at
               ELSE $4::timestamptz
             END,
             renewal_notified_at = NULL
         WHERE id = $1
         RETURNING *`,
        [input.userId, input.planId, input.credits, expiresAt],
      );
      await client.query("COMMIT");
      return {
        alreadyProcessed: false,
        user: updated.rows[0] ? publicUser(rowToStoredUser(updated.rows[0])) : null,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  const data = loadLocalStore();
  if ((data.payments || []).some((p) => p.providerPaymentId === input.providerPaymentId)) {
    const existing = data.users.find((u) => u.id === input.userId);
    return { alreadyProcessed: true, user: existing ? publicUser(existing) : null };
  }
  const user = data.users.find((u) => u.id === input.userId);
  if (!user) return { alreadyProcessed: false, user: null };

  data.payments = data.payments || [];
  data.payments.push({
    id: paymentId,
    userId: input.userId,
    provider: input.provider,
    providerPaymentId: input.providerPaymentId,
    planId: input.planId,
    creditsGranted: input.credits,
    amountCents: input.amountCents,
    currency: input.currency.toUpperCase(),
    status: "paid",
    createdAt: new Date().toISOString(),
  });
  user.paid = true;
  user.planId = input.planId;
  user.creditsRemaining = (user.creditsRemaining || 0) + input.credits;
  if (expiresAt && (!user.planExpiresAt || Date.parse(expiresAt) > Date.parse(user.planExpiresAt))) {
    user.planExpiresAt = expiresAt;
  }
  user.renewalNotifiedAt = null;
  saveLocalStore(data);
  return { alreadyProcessed: false, user: publicUser(user) };
}

export async function consumeDownloadCredit(
  userId: string,
  meta: { assetTitle: string; imageUrl: string; sizeId: string; license: string },
): Promise<{ ok: true; creditsRemaining: number } | { ok: false; error: string }> {
  const downloadId = `dl_${randomBytes(10).toString("hex")}`;

  if (hasDatabase()) {
    await ensurePgStore();
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query<PgUserRow>("SELECT * FROM users WHERE id = $1 FOR UPDATE", [userId]);
      const row = res.rows[0];
      if (!row) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Account not found." };
      }
      const u = rowToStoredUser(row);
      if (!userCanDownload(u)) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: "No download credits remaining. Choose a plan or pack on Pricing to continue.",
        };
      }
      let nextCredits = u.creditsRemaining;
      if (u.role !== "super_admin") {
        nextCredits = Math.max(0, u.creditsRemaining - 1);
        await client.query("UPDATE users SET credits_remaining = $2 WHERE id = $1", [
          userId,
          nextCredits,
        ]);
      }
      await client.query(
        `INSERT INTO downloads (id, user_id, asset_title, image_url, size_id, license)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [downloadId, userId, meta.assetTitle, meta.imageUrl, meta.sizeId, meta.license],
      );
      await client.query("COMMIT");
      return { ok: true, creditsRemaining: nextCredits };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  const data = loadLocalStore();
  const u = data.users.find((x) => x.id === userId);
  if (!u || !userCanDownload(u)) {
    return {
      ok: false,
      error: "No download credits remaining. Choose a plan or pack on Pricing to continue.",
    };
  }
  if (u.role !== "super_admin") {
    u.creditsRemaining = Math.max(0, (u.creditsRemaining || 0) - 1);
  }
  data.downloads = data.downloads || [];
  data.downloads.push({
    id: downloadId,
    userId,
    assetTitle: meta.assetTitle,
    imageUrl: meta.imageUrl,
    sizeId: meta.sizeId,
    license: meta.license,
    createdAt: new Date().toISOString(),
  });
  saveLocalStore(data);
  return { ok: true, creditsRemaining: u.creditsRemaining };
}

export async function findUsersExpiringSoon(withinDays = 3): Promise<StoredUser[]> {
  const cutoff = new Date(Date.now() + withinDays * 86_400_000).toISOString();
  if (hasDatabase()) {
    await ensurePgStore();
    const res = await getPool().query<PgUserRow>(
      `SELECT * FROM users
       WHERE role = 'user'
         AND paid = TRUE
         AND plan_expires_at IS NOT NULL
         AND plan_expires_at > NOW()
         AND plan_expires_at <= $1
         AND (renewal_notified_at IS NULL OR renewal_notified_at < NOW() - INTERVAL '7 days')`,
      [cutoff],
    );
    return res.rows.map(rowToStoredUser);
  }

  const data = loadLocalStore();
  const now = Date.now();
  return data.users.filter(
    (u) =>
      u.role === "user" &&
      u.paid &&
      u.planExpiresAt &&
      Date.parse(u.planExpiresAt) > now &&
      Date.parse(u.planExpiresAt) <= Date.parse(cutoff) &&
      (!u.renewalNotifiedAt || Date.parse(u.renewalNotifiedAt) < now - 7 * 86_400_000),
  );
}

export async function markRenewalNotified(userId: string) {
  const now = new Date().toISOString();
  if (hasDatabase()) {
    await ensurePgStore();
    await getPool().query("UPDATE users SET renewal_notified_at = $2 WHERE id = $1", [userId, now]);
    return;
  }
  const data = loadLocalStore();
  const u = data.users.find((x) => x.id === userId);
  if (u) {
    u.renewalNotifiedAt = now;
    saveLocalStore(data);
  }
}
