import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  /** scrypt hash as salt:hash hex */
  passwordHash: string;
  createdAt: string;
};

type UserFile = { users: StoredUser[] };

const DATA_DIR = path.join(process.cwd(), ".data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

function ensureStore(): UserFile {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  if (!existsSync(USERS_FILE)) {
    const empty: UserFile = { users: [] };
    writeFileSync(USERS_FILE, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
  try {
    return JSON.parse(readFileSync(USERS_FILE, "utf8")) as UserFile;
  } catch {
    return { users: [] };
  }
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

export function findUserByEmail(email: string) {
  const data = ensureStore();
  const key = normalizeEmail(email);
  return data.users.find((u) => u.email === key) ?? null;
}

export function createUser(input: { name: string; email: string; password: string }) {
  const data = ensureStore();
  const email = normalizeEmail(input.email);
  if (data.users.some((u) => u.email === email)) {
    return { ok: false as const, error: "An account with that email already exists." };
  }
  if (input.password.length < 8) {
    return { ok: false as const, error: "Password must be at least 8 characters." };
  }
  const user: StoredUser = {
    id: createHash("sha256").update(`${email}:${Date.now()}:${randomBytes(8).toString("hex")}`).digest("hex").slice(0, 24),
    name: input.name.trim(),
    email,
    passwordHash: hashPassword(input.password),
    createdAt: new Date().toISOString(),
  };
  data.users.push(user);
  saveStore(data);
  return { ok: true as const, user: publicUser(user) };
}

export function authenticateUser(email: string, password: string) {
  const user = findUserByEmail(email);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { ok: false as const, error: "Invalid email or password." };
  }
  return { ok: true as const, user: publicUser(user) };
}

export function publicUser(user: StoredUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
  };
}
