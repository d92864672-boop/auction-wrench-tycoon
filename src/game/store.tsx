import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  GAME_MINUTES_PER_SECOND,
  advance,
  applyGrant,
  level,
  migrate,
  netWorth,
  newGame,
  type GameState,
  type Result,
} from "./engine";

const LOCAL_KEY = "wert-save-v1";

type Ctx = {
  state: GameState;
  set: (fn: (s: GameState) => GameState) => void;
  act: (fn: (s: GameState) => Result) => boolean;
  user: User | null;
  nickname: string;
  setNickname: (n: string) => Promise<void>;
  cloudReady: boolean;
  checkGrants: () => Promise<number>;
  reset: () => void;
  isAdmin: boolean;
  ban: { reason: string } | null;
};

const GameCtx = createContext<Ctx | null>(null);

export function useGame() {
  const c = useContext(GameCtx);
  if (!c) throw new Error("useGame outside provider");
  return c;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState>(() => newGame());
  const stateRef = useRef(state);
  stateRef.current = state;
  const [loaded, setLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [nickname, setNick] = useState("Игрок");
  const [cloudReady, setCloudReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ban, setBan] = useState<{ reason: string } | null>(null);

  const set = useCallback((fn: (s: GameState) => GameState) => setState((s) => fn(s)), []);

  const act = useCallback((fn: (s: GameState) => Result) => {
    const r = fn(stateRef.current);
    if (r.error) {
      toast.error(r.error);
      return false;
    }
    stateRef.current = r.state;
    setState(r.state);
    if (r.message) toast(r.message);
    return true;
  }, []);

  // Load local save
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LOCAL_KEY);
      if (raw) setState(migrate(JSON.parse(raw)));
    } catch {
      /* ignore broken save */
    }
    setLoaded(true);
  }, []);

  // Persist locally
  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => localStorage.setItem(LOCAL_KEY, JSON.stringify(state)), 500);
    return () => clearTimeout(t);
  }, [state, loaded]);

  // Game clock
  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => {
      const r = advance(stateRef.current, GAME_MINUTES_PER_SECOND);
      stateRef.current = r.state;
      setState(r.state);
      r.messages.forEach((m, i) => setTimeout(() => toast(m), i * 600));
    }, 1000);
    return () => clearInterval(id);
  }, [loaded]);

  // Auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        setUser(session?.user ?? null);
      }
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const checkGrants = useCallback(async () => {
    if (!user) return 0;
    const { data } = await supabase.from("item_grants").select("id,item_id,amount").order("created_at");
    let count = 0;
    for (const g of data ?? []) {
      if (stateRef.current.appliedGrants.includes(g.id)) continue;
      const r = applyGrant(stateRef.current, g.id, g.item_id, g.amount);
      stateRef.current = r.state;
      setState(r.state);
      if (r.message) toast.success(`Покупка доставлена: ${r.message}`);
      count++;
    }
    return count;
  }, [user]);

  // Admin role + ban status
  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setBan(null);
      return;
    }
    let cancelled = false;
    const check = async () => {
      const [{ data: admin }, { data: b }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase.from("bans").select("reason").eq("user_id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      setIsAdmin(Boolean(admin));
      setBan(b ? { reason: b.reason } : null);
    };
    check();
    const id = setInterval(check, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [user]);

  // Cloud load when signed in
  useEffect(() => {
    if (!loaded) return;
    if (!user) {
      setCloudReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      const [{ data: save }, { data: profile }] = await Promise.all([
        supabase.from("game_saves").select("state").eq("user_id", user.id).maybeSingle(),
        supabase.from("profiles").select("nickname").eq("id", user.id).maybeSingle(),
      ]);
      if (cancelled) return;
      if (save?.state && Object.keys(save.state as object).length > 0) {
        const s = migrate(save.state);
        stateRef.current = s;
        setState(s);
      } else {
        await supabase.from("game_saves").upsert({ user_id: user.id, state: stateRef.current as never });
      }
      if (profile?.nickname) setNick(profile.nickname);
      else await supabase.from("profiles").upsert({ id: user.id, nickname: "Игрок" });
      setCloudReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, loaded]);

  // Deliver purchases once cloud is ready, then every 30s
  useEffect(() => {
    if (!cloudReady) return;
    checkGrants();
    const id = setInterval(checkGrants, 30_000);
    return () => clearInterval(id);
  }, [cloudReady, checkGrants]);

  // Cloud save + rating update
  useEffect(() => {
    if (!cloudReady || !user) return;
    const save = async () => {
      const s = stateRef.current;
      await Promise.all([
        supabase.from("game_saves").upsert({ user_id: user.id, state: s as never, updated_at: new Date().toISOString() }),
        supabase
          .from("profiles")
          .update({ net_worth: netWorth(s), level: level(s), updated_at: new Date().toISOString() })
          .eq("id", user.id),
      ]);
    };
    save();
    const id = setInterval(save, 15_000);
    return () => clearInterval(id);
  }, [cloudReady, user]);

  const setNickname = useCallback(
    async (n: string) => {
      const clean = n.trim().slice(0, 20);
      if (!clean) return;
      setNick(clean);
      if (user) await supabase.from("profiles").update({ nickname: clean }).eq("id", user.id);
      toast("Ник сохранён");
    },
    [user],
  );

  const reset = useCallback(() => {
    const s = newGame();
    s.appliedGrants = stateRef.current.appliedGrants; // purchases stay delivered once
    stateRef.current = s;
    setState(s);
    toast("Прогресс сброшен");
  }, []);

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <p className="font-display text-xl text-muted-foreground">wertперекуп</p>
      </div>
    );
  }

  return (
    <GameCtx.Provider value={{ state, set, act, user, nickname, setNickname, cloudReady, checkGrants, reset, isAdmin, ban }}>
      {children}
    </GameCtx.Provider>
  );
}
