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
      { name: "description", content: "Войди в wertперекуп, чтобы играть онлайн и сохранять прогресс." },
      { property: "og:title", content: "Вход — wertперекуп" },
      { property: "og:description", content: "Аккаунт для онлайн-игры в wertперекуп." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [googleHint, setGoogleHint] = useState<string | null>(null);

  // Возврат с accounts.google.com: Supabase отдаёт сессию в hash — client сам её подхватит.
  useEffect(() => {
    let alive = true;
    const goHome = () => {
      if (alive) navigate({ to: "/" });
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) goHome();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) goHome();
    });

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const errorText = params.get("error_description") ?? new URLSearchParams(window.location.search).get("error_description");
    if (errorText) toast.error(decodeURIComponent(errorText).replace(/\+/g, " "));

    void fetchGoogleStatus().then((status) => {
      if (!alive) return;
      setGoogleHint(status.available ? null : "Google-вход пока недоступен — войди по почте.");
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error("Неверная почта или пароль"); return; }
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { nickname: nickname || undefined } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Проверь почту и подтверди аккаунт");
    }
  };

  const google = async () => {
    setGoogleBusy(true);
    const result = await signInWithGoogle();
    if (!result.started) {
      setGoogleBusy(false);
      toast.error(result.message ?? "Не удалось войти через Google");
      return;
    }
    // Дальше браузер уходит на страницу выбора Google-аккаунта.
    toast("Переходим в Google…");
  };

  return (
    <div className="wp-default flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-sm space-y-4 rounded-3xl border border-border p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">wertперекуп</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "in" ? "Вход в аккаунт" : "Новый аккаунт"}</p>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          data-testid="google-signin"
          disabled={googleBusy}
          onClick={google}
        >
          <span aria-hidden className="mr-2 font-display text-base font-bold">G</span>
          {googleBusy ? "Открываем Google…" : "Продолжить с Google"}
        </Button>
        {googleHint && <p className="text-center text-xs text-muted-foreground">{googleHint}</p>}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          или по почте
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-2">
          {mode === "up" && <Input placeholder="Ник в игре" maxLength={20} value={nickname} onChange={(e) => setNickname(e.target.value)} />}
          <Input type="email" required placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input type="password" required minLength={6} placeholder="Пароль" value={password} onChange={(e) => setPassword(e.target.value)} />
          <Button type="submit" className="w-full" disabled={busy}>{mode === "in" ? "Войти" : "Создать аккаунт"}</Button>
        </form>
        <button className="w-full text-sm text-muted-foreground underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "Нет аккаунта? Регистрация" : "Уже есть аккаунт? Войти"}
        </button>
        <Link to="/" className="block text-center text-sm text-primary">← Играть без входа</Link>
      </div>
    </div>
  );
}
