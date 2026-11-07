/**
 * Статус OAuth-провайдеров Supabase: GET /api/auth/google
 * Монтируется в src/server.ts до TanStack-роутера.
 *
 * Зачем: если провайдер Google не включён в проекте Supabase, редирект
 * signInWithOAuth приводит пользователя на страницу ошибки Supabase.
 * Клиент спрашивает статус заранее и показывает понятное сообщение.
 */

export type ProviderStatus = {
  provider: "google";
  available: boolean;
  reason: string | null;
};

const SUPABASE_HOST = /^https:\/\/[a-z0-9-]+\.supabase\.co$/;
const NOT_CONFIGURED = /missing oauth secret|unsupported provider|provider is not enabled|oauth secret/i;
const CACHE_MS = 5 * 60 * 1000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

/** Разбор ответа Supabase `/auth/v1/authorize` в понятный статус. Чистая функция. */
export function interpretAuthorizeProbe(status: number, body: string): ProviderStatus {
  if (status >= 200 && status < 400) {
    return { provider: "google", available: true, reason: null };
  }

  let message = "";
  try {
    const parsed = JSON.parse(body) as { msg?: unknown; error_description?: unknown; message?: unknown };
    const raw = parsed.msg ?? parsed.error_description ?? parsed.message;
    if (typeof raw === "string") message = raw;
  } catch {
    /* тело не JSON — разберёмся по коду ответа */
  }

  if (NOT_CONFIGURED.test(message)) {
    return {
      provider: "google",
      available: false,
      reason:
        "Вход через Google ещё не включён в проекте: в Supabase → Authentication → Providers → Google нужно добавить Client ID и Client Secret.",
    };
  }

  return {
    provider: "google",
    available: false,
    reason: `Провайдер Google недоступен (Supabase ответил ${status}${message ? `: ${message}` : ""}).`,
  };
}

async function probeGoogle(origin: string): Promise<ProviderStatus> {
  const base = (process.env["SUPABASE_URL"] ?? "").replace(/\/+$/, "");
  const key = (process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "").trim();

  if (!SUPABASE_HOST.test(base)) {
    return { provider: "google", available: false, reason: "Supabase не настроен на сервере." };
  }

  const redirectTo = `${origin}/auth`;
  const url = `${base}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(redirectTo)}`;

  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: key ? { apikey: key } : undefined,
      signal: AbortSignal.timeout(6000),
    });
    const body = await response.text().catch(() => "");
    return interpretAuthorizeProbe(response.status, body);
  } catch {
    return { provider: "google", available: false, reason: "Не удалось проверить вход через Google." };
  }
}

let cache: { at: number; origin: string; status: ProviderStatus } | undefined;

export async function handleAuthProviderApi(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith("/api/auth/")) return null;

  if (url.pathname !== "/api/auth/google") return json({ error: "not_found" }, 404);
  if (request.method !== "GET" && request.method !== "HEAD") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const origin = url.origin;
  if (cache && cache.origin === origin && cache.at + CACHE_MS > Date.now()) {
    return json(cache.status);
  }

  const status = await probeGoogle(origin);
  cache = { at: Date.now(), origin, status };
  return json(status);
}
