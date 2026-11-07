import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { fetchGoogleStatus, signInWithGoogle } from "@/lib/google-auth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Вход — wertперекуп" },
      { name: "description", content: "Вход в игру: код на почту, пароль или Google." },
    ],
  }),
  component: AuthPage,
});

const errorText = (e: unknown, fallback: string) =>
  e instanceof Error && e.message ? e.message : typeof e === "string" ? e : fallback;

function AuthPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"form" | "code">("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [passwordLogin, setPasswordLogin] = useState(false);
  const [google, setGoogle] = useState<{ available: boolean; reason: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    void fetchGoogleStatus().then((s) => {
      if (alive) setGoogle(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/" });
    });
  }, [navigate]);

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

  async function sendCode() {
    if (!emailOk) {
      toast.error("Введи корректную почту");
      return;
    }
    setBusy(true);
    try {
      // Пароль сохраняем при первом входе, но пускаем по коду из письма.
      if (password.trim().length >= 6) {
        const { error } = await supabase.auth.signUp({ email: email.trim(), password });
        // «Уже зарегистрирован» не мешает: код отправим всё равно.
        if (error && !/registered|exists/i.test(error.message)) throw error;
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: true,
          emailRedirectTo: typeof window === "undefined" ? undefined : `${window.location.origin}/auth`,
        },
      });
      if (error) throw error;
      setStep("code");
      toast.success("Код отправлен на почту");
    } catch (e) {
      toast.error(errorText(e, "Не удалось отправить код"));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    const token = code.replace(/\D/g, "");
    if (token.length < 6) {
      toast.error("Введи 6-значный код из письма");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
      if (error) throw error;
      toast.success("Готово, ты в игре");
      navigate({ to: "/" });
    } catch (e) {
      toast.error(errorText(e, "Код не подошёл. Проверь письмо и попробуй ещё раз"));
    } finally {
      setBusy(false);
    }
  }

  async function loginWithPassword() {
    if (!emailOk) {
      toast.error("Введи корректную почту");
      return;
    }
    if (password.trim().length < 6) {
      toast.error("Пароль — минимум 6 символов");
      return;
    }
    setBusy(true);
    try {
      const signIn = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (!signIn.error) {
        toast.success("Готово, ты в игре");
        navigate({ to: "/" });
        return;
      }
      const signUp = await supabase.auth.signUp({ email: email.trim(), password });
      if (signUp.error) throw signUp.error;
      toast.success("Аккаунт создан. Проверь почту, чтобы подтвердить его");
    } catch (e) {
      toast.error(errorText(e, "Не удалось войти"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-4 p-5">
      <div className="space-y-1">
        <h1 className="font-display text-2xl font-bold">Вход в wertперекуп</h1>
        <p className="text-sm text-muted-foreground">
          Введи почту и пароль — пришлём код на почту. Кодом и подтвердишь вход.
        </p>
      </div>

      {step === "form" ? (
        <form
          className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void sendCode();
          }}
        >
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Почта</span>
            <Input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="you@mail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Пароль</span>
            <Input
              type="password"
              autoComplete="current-password"
              placeholder="минимум 6 символов"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Отправляем…" : "Получить код на почту"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full text-xs"
            onClick={() => setPasswordLogin((v) => !v)}
          >
            {passwordLogin ? "Вход по коду из письма" : "Войти только по паролю"}
          </Button>
          {passwordLogin && (
            <Button type="button" variant="secondary" className="w-full" disabled={busy} onClick={() => void loginWithPassword()}>
              Войти по паролю
            </Button>
          )}
        </form>
      ) : (
        <form
          className="space-y-3 rounded-xl border border-border/60 bg-card/70 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void verifyCode();
          }}
        >
          <p className="text-sm">
            Код отправлен на <span className="font-semibold">{email.trim()}</span>
          </p>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Код из письма</span>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              placeholder="000000"
              className="text-center font-display text-2xl tracking-[0.4em]"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </label>
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Проверяем…" : "Войти"}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => void sendCode()}>
              Отправить снова
            </Button>
            <Button type="button" variant="ghost" className="flex-1" onClick={() => setStep("form")}>
              Изменить почту
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Код действует час. Если в письме только ссылка — нажми её, вход произойдёт автоматически.
          </p>
        </form>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />или<span className="h-px flex-1 bg-border" />
        </div>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={async () => {
            const result = await signInWithGoogle();
            if (!result.started) toast.error(result.message ?? "Не удалось войти через Google");
          }}
        >
          <span aria-hidden className="mr-2 font-display text-base font-bold">G</span>
          Продолжить с Google
        </Button>
        {google && !google.available && google.reason && (
          <p className="text-xs text-muted-foreground">{google.reason}</p>
        )}
      </div>

      <Button variant="ghost" asChild className="w-full">
        <Link to="/">Вернуться в игру</Link>
      </Button>
    </main>
  );
}
