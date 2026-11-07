import { supabase } from "@/integrations/supabase/client";

export type GoogleStatus = { available: boolean; reason: string | null };
export type GoogleSignInResult = { started: boolean; message?: string };

const FALLBACK_HINT = "Вход через Google сейчас недоступен — войди по почте или попробуй позже.";

/** Спрашиваем сервер, включён ли Google-провайдер в Supabase. */
export async function fetchGoogleStatus(): Promise<GoogleStatus> {
  try {
    const response = await fetch("/api/auth/google", { headers: { accept: "application/json" } });
    if (!response.ok) return { available: false, reason: FALLBACK_HINT };
    const data = (await response.json()) as { available?: unknown; reason?: unknown };
    return {
      available: data.available === true,
      reason: typeof data.reason === "string" ? data.reason : null,
    };
  } catch {
    return { available: false, reason: FALLBACK_HINT };
  }
}

/**
 * Вход через Google: настоящий OAuth Supabase.
 * При успехе браузер уходит на accounts.google.com и возвращается на /auth.
 */
export async function signInWithGoogle(): Promise<GoogleSignInResult> {
  const status = await fetchGoogleStatus();
  if (!status.available) {
    return { started: false, message: status.reason ?? FALLBACK_HINT };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${window.location.origin}/auth`,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) return { started: false, message: error.message };
  return { started: true };
}
