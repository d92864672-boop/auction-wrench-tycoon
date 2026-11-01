import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import "@lovable.dev/cloud-auth-js/styles.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

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

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (mode === "in") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return toast.error("Неверная почта или пароль");
      navigate({ to: "/" });
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin, data: { nickname: nickname || undefined } },
      });
      setBusy(false);
      if (error) return toast.error(error.message);
      toast.success("Проверь почту и подтверди аккаунт");
    }
  };

  const oauth = async (provider: "google" | "lovable") => {
    const r = await lovable.auth.signInWithOAuth(provider, { redirect_uri: window.location.origin });
    if (r.error) return toast.error("Не удалось войти");
    if (r.redirected) return;
    navigate({ to: "/" });
  };

  return (
    <div className="wp-default flex min-h-screen items-center justify-center p-4">
      <div className="glass w-full max-w-sm space-y-4 rounded-3xl border border-border p-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold">wertперекуп</h1>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "in" ? "Вход в аккаунт" : "Новый аккаунт"}</p>
        </div>
        <Button variant="secondary" className="w-full" onClick={() => oauth("google")}>Продолжить с Google</Button>
        <button type="button" className="lovable-auth-button w-full" onClick={() => oauth("lovable")}>Continue with Lovable</button>
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
