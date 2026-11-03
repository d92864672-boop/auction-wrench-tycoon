import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useGame } from "@/game/store";
import { carValue, fmt, fmtShort, garageCapacity, type Car } from "@/game/engine";
import { SHOP_ITEMS } from "@/game/shop";
import { Empty, Section, Tile } from "./ui";

function SignInCta({ text }: { text: string }) {
  return (
    <Tile className="space-y-3 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Button asChild className="w-full">
        <Link to="/auth">Войти</Link>
      </Button>
    </Tile>
  );
}

type Msg = { id: string; user_id: string; nickname: string; body: string; created_at: string };

export function MessengerApp() {
  const { user, nickname } = useGame();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("chat_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setMsgs((data ?? []).reverse()));
    const channel = supabase
      .channel(`chat-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        setMsgs((m) => (m.some((x) => x.id === (p.new as Msg).id) ? m : [...m.slice(-99), p.new as Msg]));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => { bottom.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  if (!user) return <SignInCta text="Общий чат всех игроков доступен после входа." />;

  const send = async () => {
    const body = text.trim().slice(0, 300);
    if (!body) return;
    setText("");
    const { error } = await supabase.from("chat_messages").insert({ user_id: user.id, nickname, body });
    if (error) toast.error("Сообщение не отправилось");
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 pb-3">
        {msgs.length === 0 && <Empty>Пока тихо. Напиши первым!</Empty>}
        {msgs.map((m) => {
          const mine = m.user_id === user.id;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div className={mine ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground" : "max-w-[80%] rounded-2xl rounded-bl-sm bg-card px-3 py-2"}>
                {!mine && <p className="text-[11px] font-semibold text-warning">{m.nickname}</p>}
                <p className="break-words text-sm">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="sticky bottom-0 flex gap-2 bg-background pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <Input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Сообщение" />
        <Button type="submit">Отпр.</Button>
      </form>
    </div>
  );
}

type Profile = { id: string; nickname: string; net_worth: number; level: number };
type ListingRow = { id: string; seller_id: string; seller_nickname: string; car: Car; price: number; status: string };

export function OnlineApp() {
  const { user, state, act, nickname } = useGame();
  const [top, setTop] = useState<Profile[]>([]);
  const [listings, setListings] = useState<ListingRow[]>([]);
  const [sellCar, setSellCar] = useState<string | null>(null);
  const [price, setPrice] = useState("");

  const load = useCallback(async () => {
    const [{ data: p }, { data: l }] = await Promise.all([
      supabase.from("profiles").select("id,nickname,net_worth,level").order("net_worth", { ascending: false }).limit(50),
      user
        ? supabase.from("market_listings").select("*").eq("status", "active").order("created_at", { ascending: false }).limit(50)
        : Promise.resolve({ data: [] }),
    ]);
    setTop((p ?? []) as Profile[]);
    setListings((l ?? []) as unknown as ListingRow[]);
  }, [user]);

  const collect = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.rpc("collect_sales");
    const total = Number(data ?? 0);
    if (total > 0) act((s) => ({ state: { ...s, money: s.money + total, stats: { ...s.stats, carsSold: s.stats.carsSold + 1 } }, message: `Ваши машины купили: +${fmt(total)}` }));
  }, [user, act]);

  useEffect(() => {
    load();
    collect();
  }, [load, collect]);

  const buy = async (l: ListingRow) => {
    if (state.money < l.price) { toast.error("Не хватает денег"); return; }
    if (state.garage.length >= garageCapacity(state)) { toast.error("Гараж заполнен"); return; }
    const { error } = await supabase.rpc("buy_listing", { _listing_id: l.id });
    if (error) {
      toast.error("Машину уже купили");
      { load(); return; }
    }
    act((s) => ({
      state: { ...s, money: s.money - l.price, garage: [...s.garage, { ...l.car, id: Math.random().toString(36).slice(2), boughtFor: l.price }], stats: { ...s.stats, carsBought: s.stats.carsBought + 1 } },
      message: `Куплено у ${l.seller_nickname}: ${l.car.name}`,
    }));
    load();
  };

  const publish = async (car: Car) => {
    const p = Math.floor(Number(price.replace(/\s/g, "")));
    if (!user || !p || p <= 0) { toast.error("Укажи цену"); return; }
    const { error } = await supabase.from("market_listings").insert({ seller_id: user.id, seller_nickname: nickname, car: car as never, price: p });
    if (error) { toast.error("Не удалось выставить"); return; }
    act((s) => ({ state: { ...s, garage: s.garage.filter((c) => c.id !== car.id) }, message: "Выставлено на барахолку" }));
    setSellCar(null);
    setPrice("");
    load();
  };

  const cancel = async (l: ListingRow) => {
    if (state.garage.length >= garageCapacity(state)) { toast.error("Освободи место в гараже"); return; }
    const { data, error } = await supabase.from("market_listings").update({ status: "cancelled" }).eq("id", l.id).eq("status", "active").select();
    if (error || !data?.length) { toast.error("Не получилось снять — возможно, уже купили"); return; }
    act((s) => ({ state: { ...s, garage: [...s.garage, l.car] }, message: "Снято с продажи" }));
    load();
  };

  return (
    <Tabs defaultValue="top">
      <TabsList className="w-full">
        <TabsTrigger value="top" className="flex-1">Рейтинг</TabsTrigger>
        <TabsTrigger value="market" className="flex-1">Барахолка</TabsTrigger>
      </TabsList>
      <TabsContent value="top" className="mt-3 space-y-2">
        {!user && <SignInCta text="Войди, чтобы попасть в рейтинг игроков." />}
        {top.length === 0 && <Empty>Пока никого нет</Empty>}
        {top.map((p, i) => (
          <Tile key={p.id} className={p.id === user?.id ? "flex items-center gap-3 border-primary" : "flex items-center gap-3"}>
            <span className="w-6 text-center font-display text-sm text-muted-foreground">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{p.nickname}</p>
              <p className="text-xs text-muted-foreground">Уровень {p.level}</p>
            </div>
            <span className="font-display text-sm text-success">{fmtShort(p.net_worth)}</span>
          </Tile>
        ))}
      </TabsContent>
      <TabsContent value="market" className="mt-3 space-y-3">
        {!user ? (
          <SignInCta text="Покупай и продавай машины другим игрокам после входа." />
        ) : (
          <>
            <Section title="Продать свою машину">
              {state.garage.length === 0 && <Empty>В гараже нет машин</Empty>}
              {state.garage.map((c) => (
                <Tile key={c.id}>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{c.name}</p>
                      <p className="text-xs text-muted-foreground">Оценка {fmt(carValue(c))}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={() => { setSellCar(sellCar === c.id ? null : c.id); setPrice(String(carValue(c))); }}>Выставить</Button>
                  </div>
                  {sellCar === c.id && (
                    <div className="mt-2 flex gap-2">
                      <Input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена" />
                      <Button onClick={() => publish(c)}>ОК</Button>
                    </div>
                  )}
                </Tile>
              ))}
            </Section>
            <Section title="Объявления игроков" right={<Button size="sm" variant="ghost" onClick={load}>Обновить</Button>}>
              {listings.length === 0 && <Empty>Пока пусто</Empty>}
              {listings.map((l) => (
                <Tile key={l.id}>
                  <p className="font-semibold">{l.car.name} · {l.car.year}</p>
                  <p className="text-xs text-muted-foreground">
                    Продавец {l.seller_nickname} · {l.car.condition}% · оценка {fmt(carValue(l.car))}
                  </p>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="font-display font-semibold">{fmt(l.price)}</p>
                    {l.seller_id === user.id ? (
                      <Button size="sm" variant="secondary" onClick={() => cancel(l)}>Снять</Button>
                    ) : (
                      <Button size="sm" onClick={() => buy(l)}>Купить</Button>
                    )}
                  </div>
                </Tile>
              ))}
            </Section>
          </>
        )}
      </TabsContent>
    </Tabs>
  );
}

export function ShopApp() {
  const { user, checkGrants } = useGame();
  const [checking, setChecking] = useState(false);
  return (
    <div className="space-y-3">
      <Tile className="icon-purple border-0 p-4">
        <p className="font-display text-lg font-semibold">Магазин wertперекуп</p>
        <p className="mt-1 text-sm opacity-90">Покупки приходят в игру автоматически сразу после оплаты.</p>
      </Tile>
      {!user && <SignInCta text="Войди, чтобы покупки привязались к твоему аккаунту." />}
      {SHOP_ITEMS.map((i) => (
        <Tile key={i.id} className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">
              {i.name} {i.badge && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{i.badge}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <Button size="sm" disabled={!user} onClick={() => toast("Оплата скоро заработает — магазин подключается")}>
            {i.priceRub} ₽
          </Button>
        </Tile>
      ))}
      {user && (
        <Button
          variant="secondary"
          className="w-full"
          disabled={checking}
          onClick={async () => {
            setChecking(true);
            const n = await checkGrants();
            setChecking(false);
            if (n === 0) toast("Новых покупок нет");
          }}
        >
          Проверить мои покупки
        </Button>
      )}
    </div>
  );
}
