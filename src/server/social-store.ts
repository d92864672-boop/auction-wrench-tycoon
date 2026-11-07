/**
 * Общее состояние онлайн-игры: присутствие игроков, рейтинг по сделкам,
 * чат, заявки на оплату, выдачи администратора и баны.
 *
 * Хранится в JSON-файле на сервере (по умолчанию /tmp/wert-social.json).
 * Файл живёт столько же, сколько контейнер приложения: после передеплоя
 * список игроков начинается заново, личный прогресс при этом не теряется —
 * он лежит в localStorage и в game_saves пользователя.
 */

export type Player = {
  id: string;
  nickname: string;
  level: number;
  netWorth: number;
  deals: number;
  lastSeen: number;
};

export type Deal = { id: string; playerId: string; nickname: string; title: string; price: number; at: number };
export type ChatMsg = { id: string; playerId: string; nickname: string; body: string; at: number; admin?: boolean };
export type Order = {
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
export type Grant = { id: string; playerId: string; kind: "item" | "money" | "reset"; itemId?: string; amount?: number; at: number };
export type Ban = { playerId: string; reason: string; at: number };

type Data = {
  players: Record<string, Player>;
  deals: Deal[];
  chat: ChatMsg[];
  orders: Order[];
  grants: Grant[];
  bans: Record<string, Ban>;
};

const ONLINE_TTL = 45_000;
const MAX_CHAT = 200;
const MAX_DEALS = 200;
const MAX_ORDERS = 200;

const now = () => Date.now();
const uid = (p: string) => `${p}_${now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const clean = (v: unknown, max: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (v: unknown, max = 1e15) => {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, max) : 0;
};

function emptyData(): Data {
  return { players: {}, deals: [], chat: [], orders: [], grants: [], bans: {} };
}

let data: Data = emptyData();
let loading: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function storageFile() {
  return process.env["SOCIAL_DATA_FILE"] || "/tmp/wert-social.json";
}

async function ensureLoaded() {
  if (!loading) {
    loading = (async () => {
      try {
        const fs = await import("node:fs/promises");
        const raw = await fs.readFile(storageFile(), "utf8");
        const parsed = JSON.parse(raw) as Partial<Data>;
        data = {
          players: parsed.players ?? {},
          deals: parsed.deals ?? [],
          chat: parsed.chat ?? [],
          orders: parsed.orders ?? [],
          grants: parsed.grants ?? [],
          bans: parsed.bans ?? {},
        };
      } catch {
        data = emptyData();
      }
    })();
  }
  return loading;
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    void (async () => {
      try {
        const fs = await import("node:fs/promises");
        await fs.writeFile(storageFile(), JSON.stringify(data), "utf8");
      } catch {
        /* диск недоступен — работаем в памяти */
      }
    })();
  }, 400);
  if (typeof saveTimer === "object" && "unref" in saveTimer) saveTimer.unref();
}

function onlinePlayers() {
  const cutoff = now() - ONLINE_TTL;
  return Object.values(data.players)
    .filter((p) => p.lastSeen >= cutoff)
    .sort((a, b) => b.netWorth - a.netWorth);
}

function ratingPlayers() {
  return Object.values(data.players)
    .sort((a, b) => b.deals - a.deals || b.netWorth - a.netWorth || a.nickname.localeCompare(b.nickname))
    .slice(0, 50);
}

export type Snapshot = {
  me: { id: string; deals: number; online: boolean };
  online: { id: string; nickname: string; level: number; netWorth: number; deals: number }[];
  rating: { id: string; nickname: string; deals: number; netWorth: number; level: number }[];
  deals: Deal[];
  chat: ChatMsg[];
  orders: Order[];
  grants: Grant[];
  ban: Ban | null;
  onlineCount: number;
  serverTime: number;
};

export async function heartbeat(input: {
  id: string;
  nickname?: string;
  level?: number;
  netWorth?: number;
}): Promise<Snapshot> {
  await ensureLoaded();
  const id = clean(input.id, 64);
  if (!id) throw new Error("player id required");
  const prev = data.players[id];
  data.players[id] = {
    id,
    nickname: clean(input.nickname, 20) || prev?.nickname || "Игрок",
    level: num(input.level, 1000) || prev?.level || 1,
    netWorth: num(input.netWorth) || prev?.netWorth || 0,
    deals: prev?.deals ?? 0,
    lastSeen: now(),
  };
  scheduleSave();
  return snapshot(id);
}

export async function snapshot(id: string): Promise<Snapshot> {
  await ensureLoaded();
  const me = data.players[id];
  return {
    me: { id, deals: me?.deals ?? 0, online: Boolean(me && me.lastSeen >= now() - ONLINE_TTL) },
    online: onlinePlayers().slice(0, 50),
    rating: ratingPlayers(),
    deals: data.deals.slice(0, 30),
    chat: data.chat.slice(-80),
    orders: data.orders.filter((o) => o.playerId === id).slice(-20),
    grants: data.grants.filter((g) => g.playerId === id),
    ban: data.bans[id] ?? null,
    onlineCount: onlinePlayers().length,
    serverTime: now(),
  };
}

export async function addDeal(input: { id: string; title?: string; price?: number }): Promise<Snapshot> {
  await ensureLoaded();
  const id = clean(input.id, 64);
  if (!id) throw new Error("player id required");
  const p = data.players[id];
  if (p) {
    p.deals += 1;
    p.lastSeen = now();
  }
  data.deals.unshift({
    id: uid("deal"),
    playerId: id,
    nickname: p?.nickname ?? "Игрок",
    title: clean(input.title, 60) || "Сделка",
    price: num(input.price),
    at: now(),
  });
  data.deals = data.deals.slice(0, MAX_DEALS);
  scheduleSave();
  return snapshot(id);
}

export async function sendChat(input: { id: string; nickname?: string; body: string }): Promise<Snapshot> {
  await ensureLoaded();
  const id = clean(input.id, 64);
  const body = clean(input.body, 300);
  if (!id || !body) throw new Error("player id and body required");
  if (data.bans[id]) throw new Error("banned");
  const p = data.players[id];
  if (p) {
    p.lastSeen = now();
    if (input.nickname) p.nickname = clean(input.nickname, 20) || p.nickname;
  }
  data.chat.push({ id: uid("msg"), playerId: id, nickname: p?.nickname ?? clean(input.nickname, 20) || "Игрок", body, at: now() });
  data.chat = data.chat.slice(-MAX_CHAT);
  scheduleSave();
  return snapshot(id);
}

export async function ackGrants(input: { id: string; grantIds: string[] }): Promise<Snapshot> {
  await ensureLoaded();
  const id = clean(input.id, 64);
  const ids = new Set((input.grantIds ?? []).map((g) => clean(g, 64)));
  data.grants = data.grants.filter((g) => !(g.playerId === id && ids.has(g.id)));
  scheduleSave();
  return snapshot(id);
}

export async function createOrder(input: {
  id: string;
  nickname?: string;
  itemId: string;
  itemName?: string;
  priceSom?: number;
  note?: string;
}): Promise<Snapshot> {
  await ensureLoaded();
  const id = clean(input.id, 64);
  if (!id) throw new Error("player id required");
  const p = data.players[id];
  data.orders.unshift({
    id: uid("ord"),
    playerId: id,
    nickname: p?.nickname ?? clean(input.nickname, 20) || "Игрок",
    itemId: clean(input.itemId, 40),
    itemName: clean(input.itemName, 60) || clean(input.itemId, 40),
    priceSom: num(input.priceSom, 1_000_000),
    note: clean(input.note, 120),
    status: "pending",
    at: now(),
  });
  data.orders = data.orders.slice(0, MAX_ORDERS);
  scheduleSave();
  return snapshot(id);
}

export type AdminOverview = {
  players: (Player & { banned: boolean; banReason: string | null; online: boolean })[];
  orders: Order[];
  chat: ChatMsg[];
  deals: Deal[];
  totals: { players: number; online: number; deals: number; pendingOrders: number };
};

export async function adminOverview(): Promise<AdminOverview> {
  await ensureLoaded();
  const cutoff = now() - ONLINE_TTL;
  const players = Object.values(data.players)
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map((p) => ({
      ...p,
      banned: Boolean(data.bans[p.id]),
      banReason: data.bans[p.id]?.reason ?? null,
      online: p.lastSeen >= cutoff,
    }));
  return {
    players,
    orders: data.orders.filter((o) => o.status === "pending").slice(0, 50),
    chat: data.chat.slice(-40).reverse(),
    deals: data.deals.slice(0, 30),
    totals: {
      players: players.length,
      online: players.filter((p) => p.online).length,
      deals: data.deals.length,
      pendingOrders: data.orders.filter((o) => o.status === "pending").length,
    },
  };
}

export type AdminAction =
  | { type: "money"; playerId: string; amount: number }
  | { type: "moneyAll"; amount: number }
  | { type: "item"; playerId: string; itemId: string }
  | { type: "ban"; playerId: string; reason?: string }
  | { type: "unban"; playerId: string }
  | { type: "reset"; playerId: string }
  | { type: "nickname"; playerId: string; nickname: string }
  | { type: "broadcast"; text: string }
  | { type: "deleteMessage"; messageId: string }
  | { type: "resolveOrder"; orderId: string; approve: boolean };

export async function adminAct(action: AdminAction): Promise<{ ok: true; message: string }> {
  await ensureLoaded();
  switch (action.type) {
    case "money": {
      const playerId = clean(action.playerId, 64);
      const amount = num(action.amount);
      if (!playerId || !amount) throw new Error("playerId and amount required");
      data.grants.push({ id: uid("gr"), playerId, kind: "money", amount, at: now() });
      scheduleSave();
      return { ok: true, message: `Начислено ${amount} — игрок получит при следующем заходе` };
    }
    case "moneyAll": {
      const amount = num(action.amount);
      if (!amount) throw new Error("amount required");
      for (const p of Object.values(data.players)) {
        data.grants.push({ id: uid("gr"), playerId: p.id, kind: "money", amount, at: now() });
      }
      scheduleSave();
      return { ok: true, message: `Начислено ${amount} каждому игроку` };
    }
    case "item": {
      const playerId = clean(action.playerId, 64);
      const itemId = clean(action.itemId, 40);
      if (!playerId || !itemId) throw new Error("playerId and itemId required");
      data.grants.push({ id: uid("gr"), playerId, kind: "item", itemId, at: now() });
      scheduleSave();
      return { ok: true, message: "Предмет выдан" };
    }
    case "ban": {
      const playerId = clean(action.playerId, 64);
      if (!playerId) throw new Error("playerId required");
      data.bans[playerId] = { playerId, reason: clean(action.reason, 120), at: now() };
      scheduleSave();
      return { ok: true, message: "Игрок забанен" };
    }
    case "unban": {
      const playerId = clean(action.playerId, 64);
      delete data.bans[playerId];
      scheduleSave();
      return { ok: true, message: "Игрок разбанен" };
    }
    case "reset": {
      const playerId = clean(action.playerId, 64);
      data.grants.push({ id: uid("gr"), playerId, kind: "reset", at: now() });
      scheduleSave();
      return { ok: true, message: "Прогресс сброшен при следующем заходе" };
    }
    case "nickname": {
      const playerId = clean(action.playerId, 64);
      const nickname = clean(action.nickname, 20);
      if (!data.players[playerId] || !nickname) throw new Error("Игрок не найден");
      data.players[playerId].nickname = nickname;
      scheduleSave();
      return { ok: true, message: "Ник изменён" };
    }
    case "broadcast": {
      const text = clean(action.text, 300);
      if (!text) throw new Error("text required");
      data.chat.push({ id: uid("msg"), playerId: "admin", nickname: "Администрация", body: text, at: now(), admin: true });
      data.chat = data.chat.slice(-MAX_CHAT);
      scheduleSave();
      return { ok: true, message: "Объявление отправлено" };
    }
    case "deleteMessage": {
      const messageId = clean(action.messageId, 64);
      data.chat = data.chat.filter((m) => m.id !== messageId);
      scheduleSave();
      return { ok: true, message: "Сообщение удалено" };
    }
    case "resolveOrder": {
      const orderId = clean(action.orderId, 64);
      const order = data.orders.find((o) => o.id === orderId);
      if (!order) throw new Error("Заявка не найдена");
      order.status = action.approve ? "approved" : "rejected";
      if (action.approve) {
        data.grants.push({ id: uid("gr"), playerId: order.playerId, kind: "item", itemId: order.itemId, at: now() });
      }
      scheduleSave();
      return { ok: true, message: action.approve ? "Товар выдан" : "Заявка отклонена" };
    }
    default:
      throw new Error("unknown action");
  }
}

/** Только для тестов: сбросить состояние. */
export async function __resetForTests() {
  await ensureLoaded();
  data = emptyData();
  loading = null;
}
