import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type UserRole = "user" | "super_admin";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  /** scrypt hash as salt:hash hex */
  passwordHash: string;
  role: UserRole;
  /** Active paid subscription / pack entitlement */
  paid: boolean;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  paid: boolean;
  canDownload: boolean;
  createdAt: string;
};

type UserFile = { users: StoredUser[] };

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

export const SUPER_ADMIN_EMAIL = "tarasu2008@gmail.com";

/** Basic email shape check (registered accounts still required for download). */
export function isValidEmail(email: string) {
  const value = email.trim();
  if (value.length < 5 || value.length > 254) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function ensureStore(): UserFile {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  let data: UserFile;
  if (!existsSync(USERS_FILE)) {
    data = { users: [] };
  } else {
    try {
      data = JSON.parse(readFileSync(USERS_FILE, "utf8")) as UserFile;
      if (!Array.isArray(data.users)) data = { users: [] };
    } catch {
      data = { users: [] };
    }
  }

  // Migrate legacy records missing role/paid
  let dirty = false;
  data.users = data.users.map((u) => {
    const next = { ...u };
    if (!next.role) {
      next.role = normalizeEmail(next.email) === SUPER_ADMIN_EMAIL ? "super_admin" : "user";
      dirty = true;
    }
    if (typeof next.paid !== "boolean") {
      next.paid = next.role === "super_admin";
      dirty = true;
    }
    return next;
  });

  if (seedSuperAdmin(data)) dirty = true;
  if (dirty) saveStore(data);
  return data;
}

function seedSuperAdmin(data: UserFile) {
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
    return changed;
  }

  const bootstrapPassword =
    process.env.LUMENSTOCK_ADMIN_PASSWORD ||
    `Ls-${randomBytes(9).toString("base64url")}`;

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
    createdAt: new Date().toISOString(),
  });

  // Local bootstrap only (.data is gitignored). Prefer LUMENSTOCK_ADMIN_PASSWORD in prod.
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

function saveStore(data: UserFile) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(USERS_FILE, JSON.stringify(data, null, 2), "utf8");
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

export function userCanDownload(user: Pick<StoredUser, "role" | "paid">) {
  return user.role === "super_admin" || user.paid === true;
}

export function findUserByEmail(email: string) {
  const data = ensureStore();
  const key = normalizeEmail(email);
  return data.users.find((u) => u.email === key) ?? null;
}

export function findUserById(id: string) {
  const data = ensureStore();
  return data.users.find((u) => u.id === id) ?? null;
}

export function createUser(input: { name: string; email: string; password: string }) {
  if (!isValidEmail(input.email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  const data = ensureStore();
  const email = normalizeEmail(input.email);
  if (data.users.some((u) => u.email === email)) {
    return { ok: false as const, error: "An account with that email already exists." };
  }
  if (input.password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }
  const isAdmin = email === SUPER_ADMIN_EMAIL;
  const user: StoredUser = {
    id: createHash("sha256")
      .update(`${email}:${Date.now()}:${randomBytes(8).toString("hex")}`)
      .digest("hex")
      .slice(0, 24),
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    role: isAdmin ? "super_admin" : "user",
    paid: isAdmin,
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  saveStore(data);
  return { ok: true as const, user: publicUser(user) };
}

export function authenticateUser(email: string, password: string) {
  if (!isValidEmail(email)) {
    return { ok: false as const, error: "Enter a valid email address." };
  }
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  return { ok: true as const, user: publicUser(user) };
}

export function publicUser(user: StoredUser): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    paid: user.paid,
    canDownload: userCanDownload(user),
    createdAt: user.createdAt,
  };
}

/** Ensure store + super admin exist (call from API routes). */
export function ensureAuthStore() {
  return ensureStore();
}
