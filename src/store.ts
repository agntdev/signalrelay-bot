import { createRequire } from "node:module";

export interface Provider {
  provider_id: string;
  user_id: number;
  display_name: string;
  description: string;
  approved: boolean;
  api_token: string;
}

export interface Follower {
  user_id: number;
  followed_providers: string[];
}

export interface Signal {
  signal_id: string;
  provider_id: string;
  content: string;
  symbol?: string;
  direction?: "buy" | "sell";
  size?: string;
  timestamp: number;
}

export interface Report {
  report_id: string;
  signal_id: string;
  user_id: number;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Storage backend — Redis when REDIS_URL is set, in-memory otherwise.
// Never enumerate keyspace (no KEYS/SCAN); use explicit index records.
// ---------------------------------------------------------------------------

interface StoreBackend {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

class MemoryBackend implements StoreBackend {
  private data = new Map<string, string>();
  async get(key: string) { return this.data.get(key) ?? null; }
  async set(key: string, value: string) { this.data.set(key, value); }
  async del(key: string) { this.data.delete(key); }
}

function createRedisBackend(url: string): StoreBackend {
  const require = createRequire(import.meta.url);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ioredis: any = require("ioredis");
  const Redis = ioredis.default ?? ioredis.Redis ?? ioredis;
  const client = new Redis(url, { maxRetriesPerRequest: null, lazyConnect: false });
  return {
    async get(key: string) { return client.get(key); },
    async set(key: string, value: string) { await client.set(key, value); },
    async del(key: string) { await client.del(key); },
  };
}

let _backend: StoreBackend | null = null;
function backend(): StoreBackend {
  if (!_backend) {
    _backend = process.env.REDIS_URL
      ? createRedisBackend(process.env.REDIS_URL)
      : new MemoryBackend();
  }
  return _backend;
}

const P = "sd:";
const key = (...parts: string[]) => P + parts.join(":");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function load<T>(k: string): Promise<T | null> {
  const raw = await backend().get(k);
  return raw ? (JSON.parse(raw) as T) : null;
}

async function save<T>(k: string, v: T): Promise<void> {
  await backend().set(k, JSON.stringify(v));
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export async function getProvider(id: string): Promise<Provider | null> {
  return load<Provider>(key("prov", id));
}

export async function saveProvider(p: Provider): Promise<void> {
  await save(key("prov", p.provider_id), p);
}

export async function getProviderByToken(token: string): Promise<Provider | null> {
  const raw = await backend().get(key("ptok", token));
  if (!raw) return null;
  return getProvider(raw);
}

export async function getAllProviders(): Promise<Provider[]> {
  const raw = await backend().get(key("allprov"));
  if (!raw) return [];
  const ids: string[] = JSON.parse(raw);
  const providers: Provider[] = [];
  for (const id of ids) {
    const p = await getProvider(id);
    if (p) providers.push(p);
  }
  return providers;
}

export async function createProvider(data: {
  user_id: number;
  display_name: string;
  description: string;
}): Promise<Provider> {
  const p: Provider = {
    provider_id: genId(),
    user_id: data.user_id,
    display_name: data.display_name,
    description: data.description,
    approved: false,
    api_token: genId(),
  };
  await saveProvider(p);
  // Maintain index
  const all = await backend().get(key("allprov"));
  const ids: string[] = all ? JSON.parse(all) : [];
  ids.push(p.provider_id);
  await backend().set(key("allprov"), JSON.stringify(ids));
  // Token index
  await backend().set(key("ptok", p.api_token), p.provider_id);
  return p;
}

// ---------------------------------------------------------------------------
// Follower
// ---------------------------------------------------------------------------

export async function getFollower(userId: number): Promise<Follower | null> {
  return load<Follower>(key("fol", String(userId)));
}

export async function saveFollower(f: Follower): Promise<void> {
  await save(key("fol", String(f.user_id)), f);
}

export async function isFollowing(userId: number, providerId: string): Promise<boolean> {
  const f = await getFollower(userId);
  return f ? f.followed_providers.includes(providerId) : false;
}

export async function follow(userId: number, providerId: string): Promise<void> {
  const f = (await getFollower(userId)) ?? { user_id: userId, followed_providers: [] };
  if (!f.followed_providers.includes(providerId)) {
    f.followed_providers.push(providerId);
    await saveFollower(f);
  }
}

export async function unfollow(userId: number, providerId: string): Promise<void> {
  const f = await getFollower(userId);
  if (!f) return;
  f.followed_providers = f.followed_providers.filter((id) => id !== providerId);
  await saveFollower(f);
}

export async function getFollowerIdsForProvider(providerId: string): Promise<number[]> {
  const raw = await backend().get(key("pfol", providerId));
  if (!raw) return [];
  const ids: number[] = JSON.parse(raw);
  const result: number[] = [];
  for (const uid of ids) {
    const f = await getFollower(uid);
    if (f && f.followed_providers.includes(providerId)) {
      result.push(uid);
    }
  }
  return result;
}

export async function addFollowerIndex(userId: number, providerId: string): Promise<void> {
  const raw = await backend().get(key("pfol", providerId));
  const ids: number[] = raw ? JSON.parse(raw) : [];
  if (!ids.includes(userId)) {
    ids.push(userId);
    await backend().set(key("pfol", providerId), JSON.stringify(ids));
  }
}

export async function removeFollowerIndex(userId: number, providerId: string): Promise<void> {
  const raw = await backend().get(key("pfol", providerId));
  if (!raw) return;
  const ids: number[] = JSON.parse(raw);
  const filtered = ids.filter((id) => id !== userId);
  await backend().set(key("pfol", providerId), JSON.stringify(filtered));
}

// ---------------------------------------------------------------------------
// Signal
// ---------------------------------------------------------------------------

export async function createSignal(data: {
  provider_id: string;
  content: string;
  symbol?: string;
  direction?: "buy" | "sell";
  size?: string;
}): Promise<Signal> {
  const s: Signal = {
    signal_id: genId(),
    ...data,
    timestamp: Date.now(),
  };
  await save(key("sig", s.signal_id), s);
  // Provider's signal index
  const raw = await backend().get(key("psig", data.provider_id));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  ids.push(s.signal_id);
  await backend().set(key("psig", data.provider_id), JSON.stringify(ids));
  return s;
}

export async function getSignal(signalId: string): Promise<Signal | null> {
  return load<Signal>(key("sig", signalId));
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

export async function createReport(data: {
  signal_id: string;
  user_id: number;
}): Promise<Report> {
  const r: Report = {
    report_id: genId(),
    signal_id: data.signal_id,
    user_id: data.user_id,
    timestamp: Date.now(),
  };
  await save(key("rpt", r.report_id), r);
  // All reports index
  const raw = await backend().get(key("allrpt"));
  const ids: string[] = raw ? JSON.parse(raw) : [];
  ids.push(r.report_id);
  await backend().set(key("allrpt"), JSON.stringify(ids));
  return r;
}

export async function getReport(reportId: string): Promise<Report | null> {
  return load<Report>(key("rpt", reportId));
}

export async function getAllReports(): Promise<Report[]> {
  const raw = await backend().get(key("allrpt"));
  if (!raw) return [];
  const ids: string[] = JSON.parse(raw);
  const reports: Report[] = [];
  for (const id of ids) {
    const r = await getReport(id);
    if (r) reports.push(r);
  }
  return reports;
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function getAdminIds(): number[] {
  const raw = process.env.ADMIN_IDS;
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n));
}

// ---------------------------------------------------------------------------
// Admin actions
// ---------------------------------------------------------------------------

export async function logAdminAction(data: {
  action_type: string;
  provider_id: string;
}): Promise<void> {
  await save(key("adm", genId()), {
    ...data,
    timestamp: Date.now(),
  });
}
