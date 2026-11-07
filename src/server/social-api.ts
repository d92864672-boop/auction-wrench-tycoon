/**
 * HTTP API для онлайн-функций игры: /api/social/*
 * Монтируется в src/server.ts до TanStack-роутера.
 */

import {
  ackGrants,
  addDeal,
  adminAct,
  adminOverview,
  createOrder,
  heartbeat,
  sendChat,
  snapshot,
  type AdminAction,
} from "./social-store";

/** Владелец игры. Админка доступна только этому email (после входа через Supabase). */
export const OWNER_EMAILS = ["d92864672@gmail.com"];

const SUPABASE_HOST = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
const PREFIX = "/api/social";

type Identity = { email: string | null; owner: boolean };

const tokenCache = new Map<string, { identity: Identity; until: number }>();

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await request.json();
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Проверяет access-token Supabase через /auth/v1/user.
 * URL и publishable-ключ приходят от клиента (это публичные значения, они и так
 * лежат в JS-бандле), но принимаются только для хоста *.supabase.co по https.
 */
async function identify(request: Request): Promise<Identity> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  if (!token) return { email: null, owner: false };

  const cached = tokenCache.get(token);
  if (cached && cached.until > Date.now()) return cached.identity;

  const sbUrl = (request.headers.get("x-sb-url") ?? "").trim().replace(/\/+$/, "");
  const sbKey = (request.headers.get("x-sb-key") ?? "").trim();
  if (!SUPABASE_HOST.test(sbUrl) || !sbKey) return { email: null, owner: false };

  let identity: Identity = { email: null, owner: false };
  try {
    const res = await fetch(`${sbUrl}/auth/v1/user`, {
      headers: { apikey: sbKey, authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const user = (await res.json()) as { email?: string };
      const email = (user.email ?? "").toLowerCase();
      identity = { email: email || null, owner: OWNER_EMAILS.includes(email) };
    }
  } catch {
    identity = { email: null, owner: false };
  }

  tokenCache.set(token, { identity, until: Date.now() + 5 * 60_000 });
  if (tokenCache.size > 500) tokenCache.clear();
  return identity;
}

function fail(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : "Ошибка";
  return json({ ok: false, error: message }, status);
}

export async function handleSocialApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(PREFIX)) return null;

  const route = url.pathname.slice(PREFIX.length) || "/";
  const method = request.method.toUpperCase();

  try {
    if (route === "/health") {
      return json({ ok: true, service: "social", time: Date.now() });
    }

    if (route === "/heartbeat" && method === "POST") {
      const body = await readJson(request);
      const snap = await heartbeat({
        id: String(body["id"] ?? ""),
        nickname: body["nickname"] as string | undefined,
        level: body["level"] as number | undefined,
        netWorth: body["netWorth"] as number | undefined,
      });
      return json({ ok: true, snapshot: snap });
    }

    if (route === "/state" && method === "GET") {
      const id = (url.searchParams.get("id") ?? "").trim();
      if (!id) return json({ ok: false, error: "id required" }, 400);
      return json({ ok: true, snapshot: await snapshot(id) });
    }

    if (route === "/deal" && method === "POST") {
      const body = await readJson(request);
      const snap = await addDeal({
        id: String(body["id"] ?? ""),
        title: body["title"] as string | undefined,
        price: body["price"] as number | undefined,
      });
      return json({ ok: true, snapshot: snap });
    }

    if (route === "/chat" && method === "POST") {
      const body = await readJson(request);
      const snap = await sendChat({
        id: String(body["id"] ?? ""),
        nickname: body["nickname"] as string | undefined,
        body: String(body["body"] ?? ""),
      });
      return json({ ok: true, snapshot: snap });
    }

    if (route === "/grants/ack" && method === "POST") {
      const body = await readJson(request);
      const snap = await ackGrants({
        id: String(body["id"] ?? ""),
        grantIds: Array.isArray(body["grantIds"]) ? (body["grantIds"] as string[]) : [],
      });
      return json({ ok: true, snapshot: snap });
    }

    if (route === "/order" && method === "POST") {
      const body = await readJson(request);
      const snap = await createOrder({
        id: String(body["id"] ?? ""),
        nickname: body["nickname"] as string | undefined,
        itemId: String(body["itemId"] ?? ""),
        itemName: body["itemName"] as string | undefined,
        priceSom: body["priceSom"] as number | undefined,
        note: body["note"] as string | undefined,
      });
      return json({ ok: true, snapshot: snap });
    }

    if (route === "/whoami" && method === "GET") {
      const identity = await identify(request);
      return json({ ok: true, ...identity });
    }

    if (route === "/admin" && method === "GET") {
      const identity = await identify(request);
      if (!identity.owner) return json({ ok: false, error: "Доступ только для владельца" }, 403);
      return json({ ok: true, overview: await adminOverview() });
    }

    if (route === "/admin/action" && method === "POST") {
      const identity = await identify(request);
      if (!identity.owner) return json({ ok: false, error: "Доступ только для владельца" }, 403);
      const body = await readJson(request);
      const result = await adminAct(body as unknown as AdminAction);
      return json({ ok: true, ...result, overview: await adminOverview() });
    }

    return json({ ok: false, error: "not found" }, 404);
  } catch (error) {
    return fail(error);
  }
}
