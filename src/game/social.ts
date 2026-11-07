/**
 * Клиент онлайн-функций: присутствие, рейтинг по сделкам, чат, заявки на оплату,
 * выдачи администратора. Ходит в /api/social/* (см. src/server/social-api.ts).
 */

const DEVICE_KEY = "wert-device-id";

export type SocialPlayer = { id: string; nickname: string; level: number; netWorth: number; deals: number };
export type SocialDeal = { id: string; playerId: string; nickname: string; title: string; price: number; at: number };
export type SocialMsg = { id: string; playerId: string; nickname: string; body: string; at: number; admin?: boolean };
export type SocialOrder = {
  id: string;
  playerId: string;
  nickname: string;
  itemId: string;
  itemName: string;
  priceSom: number;
  note: string;
  status: "pending" | "approved" | "rejected";
  at: number;
};
export type SocialGrant = { id: string; playerId: string; kind: "item" | "money" | "reset"; itemId?: string; amount?: number; at: number };
export type SocialBan = { playerId: string; reason: string; at: number };

export type Snapshot = {
  me: { id: string; deals: number; online: boolean };
  online: SocialPlayer[];
  rating: SocialPlayer[];
  deals: SocialDeal[];
  chat: SocialMsg[];
  orders: SocialOrder[];
  grants: SocialGrant[];
  ban: SocialBan | null;
  onlineCount: number;
  serverTime: number;
};

export type AdminOverview = {
  players: (SocialPlayer & { lastSeen: number; banned: boolean; banReason: string | null; online: boolean })[];
  orders: SocialOrder[];
  chat: SocialMsg[];
  deals: SocialDeal[];
  totals: { players: number; online: number; deals: number; pendingOrders: number };
};

/** Постоянный id устройства — по нему сервер узнаёт игрока между заходами. */
export function deviceId(): string {
  if (typeof localStorage === "undefined") return "server";
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

type AuthHeaders = { authorization?: string; "x-sb-url"?: string; "x-sb-key"?: string };

/** Заголовки для админских запросов: access-token Supabase + публичные URL/ключ проекта. */
export async function adminHeaders(): Promise<AuthHeaders> {
  const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
  const key = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] as string | undefined;
  let token: string | undefined;
  try {
    const { supabase } = await import("@/integrations/supabase/client");
    const { data } = await supabase.auth.getSession();
    token = data.session?.access_token;
  } catch {
    token = undefined;
  }
  return {
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...(url ? { "x-sb-url": url } : {}),
    ...(key ? { "x-sb-key": key } : {}),
  };
}

async function request<T>(path: string, init?: { method?: "GET" | "POST"; body?: unknown; admin?: boolean }): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init?.admin) Object.assign(headers, await adminHeaders());
  const res = await fetch(`/api/social${path}`, {
    method: init?.method ?? "GET",
    headers,
    ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok || !data || (data as { ok?: boolean }).ok === false) {
    const message = (data as { error?: string } | null)?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export type PlayerStats = { id?: string; nickname?: string; level?: number; netWorth?: number };

export const social = {
  heartbeat: async (stats: PlayerStats) =>
    (await request<{ snapshot: Snapshot }>("/heartbeat", { method: "POST", body: { id: deviceId(), ...stats } })).snapshot,

  state: async () => (await request<{ snapshot: Snapshot }>(`/state?id=${encodeURIComponent(deviceId())}`)).snapshot,

  deal: async (title: string, price: number) =>
    (await request<{ snapshot: Snapshot }>("/deal", { method: "POST", body: { id: deviceId(), title, price } })).snapshot,

  chat: async (nickname: string, body: string) =>
    (await request<{ snapshot: Snapshot }>("/chat", { method: "POST", body: { id: deviceId(), nickname, body } })).snapshot,

  ackGrants: async (grantIds: string[]) =>
    (await request<{ snapshot: Snapshot }>("/grants/ack", { method: "POST", body: { id: deviceId(), grantIds } })).snapshot,

  order: async (input: { itemId: string; itemName: string; priceSom: number; note: string; nickname: string }) =>
    (await request<{ snapshot: Snapshot }>("/order", {
      method: "POST",
      body: { id: deviceId(), ...input },
    })).snapshot,

  whoami: async () => request<{ email: string | null; owner: boolean }>("/whoami", { admin: true }),

  adminOverview: async () => (await request<{ overview: AdminOverview }>("/admin", { admin: true })).overview,

  adminAction: async (action: Record<string, unknown>) =>
    (await request<{ message: string; overview: AdminOverview }>("/admin/action", {
      method: "POST",
      body: action,
      admin: true,
    })),
};

export const OWNER_EMAILS = ["d92864672@gmail.com"];

export const isOwnerEmail = (email?: string | null) =>
  Boolean(email && OWNER_EMAILS.includes(email.toLowerCase()));
