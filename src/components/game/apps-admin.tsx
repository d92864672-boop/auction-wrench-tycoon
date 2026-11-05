import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useGame } from "@/game/store";
import { fmt, fmtShort } from "@/game/engine";
import { SHOP_ITEMS } from "@/game/shop";
import { Empty, Section, Tile } from "./ui";

type Player = { id: string; nickname: string; email: string | null; net_worth: number; level: number; banned: boolean; ban_reason: string | null };
type Msg = { id: string; nickname: string; body: string; created_at: string };
type Listing = { id: string; seller_nickname: string; price: number; car: { name?: string } };

const INFINITE = 1_000_000_000_000; // 1 трлн

function parseAmount(v: string) {
  const n = Math.floor(Number(v.replace(/\s/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function run(p: PromiseLike<{ error: { message: string } | null }>, ok: string) {
  const { error } = await p;
  if (error) {
    toast.error(`Ошибка: ${error.message}`);
    return false;
  }
  toast.success(ok);
  return true;
}

export function AdminApp() {
  const { user, isAdmin, checkGrants } = useGame();
  if (!user || !isAdmin) return <Empty>Доступ только для администратора</Empty>;
  return (
    <Tabs defaultValue="me">
      <TabsList className="w-full">
        <TabsTrigger value="me" className="flex-1">Себе</TabsTrigger>
        <TabsTrigger value="players" className="flex-1">Игроки</TabsTrigger>
        <TabsTrigger value="mod" className="flex-1">Модерация</TabsTrigger>
        <TabsTrigger value="pay" className="flex-1">Оплаты</TabsTrigger>
      </TabsList>
      <TabsContent value="me" className="mt-3">
        <SelfTab userId={user.id} deliver={checkGrants} />
      </TabsContent>
      <TabsContent value="players" className="mt-3">
        <PlayersTab />
      </TabsContent>
      <TabsContent value="mod" className="mt-3">
        <ModTab />
      </TabsContent>
      <TabsContent value="pay" className="mt-3">
        <PaymentsTab />
      </TabsContent>
    </Tabs>
  );
}

function SelfTab({ userId, deliver }: { userId: string; deliver: () => Promise<number> }) {
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState(SHOP_ITEMS[0]?.id ?? "");
  const give = async (n: number) => {
    if (!n) { toast.error("Укажи сумму"); return; }
    if (await run(supabase.rpc("admin_give_money", { _user_id: userId, _amount: n }), "Выдано")) await deliver();
  };
  return (
    <div className="space-y-3">
      <Section title="1. Бесконечные деньги">
        <Tile className="space-y-2">
          <p className="text-sm text-muted-foreground">Начислить себе {fmtShort(INFINITE)} за одно нажатие.</p>
          <Button className="w-full" onClick={() => give(INFINITE)}>+ {fmtShort(INFINITE)}</Button>
          <div className="flex gap-2">
            <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Своя сумма" />
            <Button variant="secondary" onClick={() => give(parseAmount(amount))}>Выдать</Button>
          </div>
        </Tile>
      </Section>
      <Section title="Выдать себе предмет">
        <Tile className="flex gap-2">
          <ItemSelect value={item} onChange={setItem} />
          <Button
            variant="secondary"
            onClick={async () => {
              if (await run(supabase.rpc("admin_grant_item", { _user_id: userId, _item_id: item }), "Предмет выдан")) await deliver();
            }}
          >
            Выдать
          </Button>
        </Tile>
      </Section>
    </div>
  );
}

function ItemSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
    >
      {SHOP_ITEMS.map((i) => (
        <option key={i.id} value={i.id}>{i.name}</option>
      ))}
    </select>
  );
}

function PlayersTab() {
  const [search, setSearch] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [allAmount, setAllAmount] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_list_players", { _search: search });
    if (error) toast.error(error.message);
    setPlayers((data ?? []) as Player[]);
  }, [search]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <Section title="4. Деньги всем игрокам">
        <Tile className="flex gap-2">
          <Input inputMode="numeric" value={allAmount} onChange={(e) => setAllAmount(e.target.value)} placeholder="Сумма каждому" />
          <Button
            onClick={async () => {
              const n = parseAmount(allAmount);
              if (!n) { toast.error("Укажи сумму"); return; }
              const { data, error } = await supabase.rpc("admin_give_money_all", { _amount: n });
              if (error) { toast.error(error.message); return; }
              toast.success(`Выдано ${fmt(n)} — игроков: ${data}. Каждый получит при входе в игру`);
              setAllAmount("");
            }}
          >
            Всем
          </Button>
        </Tile>
      </Section>
      <Section title="Игроки" right={<Button size="sm" variant="ghost" onClick={load}>Обновить</Button>}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по нику или почте" />
        {players.length === 0 && <Empty>Никого не нашли</Empty>}
        {players.map((p) => (
          <Tile key={p.id} className={p.banned ? "border-destructive" : undefined}>
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.nickname} {p.banned && <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">БАН</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.email ?? "—"} · ур. {p.level}</p>
              </div>
              <span className="font-display text-sm text-success">{fmtShort(p.net_worth)}</span>
            </button>
            {open === p.id && <PlayerActions p={p} onDone={load} />}
          </Tile>
        ))}
      </Section>
    </div>
  );
}

function PlayerActions({ p, onDone }: { p: Player; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [nick, setNick] = useState(p.nickname);
  const [item, setItem] = useState(SHOP_ITEMS[0]?.id ?? "");

  const money = async (sign: 1 | -1) => {
    const n = parseAmount(amount);
    if (!n) { toast.error("Укажи сумму"); return; }
    if (await run(supabase.rpc("admin_give_money", { _user_id: p.id, _amount: sign * n }), sign > 0 ? `Выдано ${fmt(n)} — придёт, как только игрок зайдёт в игру` : `Списано ${fmt(n)} — спишется при входе игрока`)) setAmount("");
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">2–3. Выдать / забрать деньги</p>
        <div className="flex gap-2">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
          <Button size="sm" onClick={() => money(1)}>+</Button>
          <Button size="sm" variant="secondary" onClick={() => money(-1)}>−</Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">5–6. Бан / разбан</p>
        {p.banned ? (
          <div className="space-y-2">
            <p className="text-sm">Причина: {p.ban_reason || "—"}</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={async () => { if (await run(supabase.rpc("admin_unban", { _user_id: p.id }), "Разбанен")) onDone(); }}>
              Разбанить
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" />
            <Button size="sm" variant="destructive" onClick={async () => { if (await run(supabase.rpc("admin_ban", { _user_id: p.id, _reason: reason }), "Забанен")) onDone(); }}>
              Бан
            </Button>
          </div>
        )}
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">7. Выдать предмет</p>
        <div className="flex gap-2">
          <ItemSelect value={item} onChange={setItem} />
          <Button size="sm" variant="secondary" onClick={() => run(supabase.rpc("admin_grant_item", { _user_id: p.id, _item_id: item }), "Предмет выдан — придёт при входе игрока")}>
            Выдать
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">8. Сменить ник</p>
        <div className="flex gap-2">
          <Input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} />
          <Button size="sm" variant="secondary" onClick={async () => { if (await run(supabase.rpc("admin_set_nickname", { _user_id: p.id, _nickname: nick }), "Ник изменён")) onDone(); }}>
            ОК
          </Button>
        </div>
      </div>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">9. Сбросить прогресс</p>
        <Button
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={async () => {
            if (!confirm(`Сбросить весь прогресс игрока ${p.nickname}?`)) return;
            if (await run(supabase.rpc("admin_reset_player", { _user_id: p.id }), "Прогресс будет сброшен")) onDone();
          }}
        >
          Сбросить прогресс
        </Button>
      </div>
    </div>
  );
}

function ModTab() {
  const [text, setText] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);

  const load = useCallback(async () => {
    const [{ data: m }, { data: l }] = await Promise.all([
      supabase.from("chat_messages").select("id,nickname,body,created_at").order("created_at", { ascending: false }).limit(30),
      supabase.from("market_listings").select("id,seller_nickname,price,car").eq("status", "active").order("created_at", { ascending: false }).limit(30),
    ]);
    setMsgs((m ?? []) as Msg[]);
    setListings((l ?? []) as unknown as Listing[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-3">
      <Section title="10. Объявление всем в чат">
        <Tile className="flex gap-2">
          <Input value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Текст объявления" />
          <Button onClick={async () => { if (await run(supabase.rpc("admin_broadcast", { _text: text }), "Отправлено")) { setText(""); load(); } }}>
            Отпр.
          </Button>
        </Tile>
      </Section>
      <Section title="11. Удалить сообщения чата" right={<Button size="sm" variant="ghost" onClick={load}>Обновить</Button>}>
        {msgs.length === 0 && <Empty>Сообщений нет</Empty>}
        {msgs.map((m) => (
          <Tile key={m.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-warning">{m.nickname}</p>
              <p className="break-words text-sm">{m.body}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={async () => { if (await run(supabase.rpc("admin_delete_message", { _message_id: m.id }), "Удалено")) load(); }}>
              Удалить
            </Button>
          </Tile>
        ))}
      </Section>
      <Section title="12. Снять объявления с барахолки">
        {listings.length === 0 && <Empty>Объявлений нет</Empty>}
        {listings.map((l) => (
          <Tile key={l.id} className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{l.car?.name ?? "Машина"}</p>
              <p className="text-xs text-muted-foreground">{l.seller_nickname} · {fmt(l.price)}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={async () => { if (await run(supabase.rpc("admin_remove_listing", { _listing_id: l.id }), "Снято")) load(); }}>
              Снять
            </Button>
          </Tile>
        ))}
      </Section>
    </div>
  );
}

type PayReq = { id: string; user_id: string; item_id: string; price_som: number; payer_note: string; created_at: string };
function PaymentsTab() {
  const [list, setList] = useState<PayReq[]>([]);
  const load = async () => {
    const { data } = await supabase.from("payment_requests").select("*").eq("status", "pending").order("created_at");
    setList((data ?? []) as PayReq[]);
  };
  useEffect(() => { void load(); }, []);
  return (
    <div className="space-y-2">
      <Button variant="secondary" className="w-full" onClick={load}>Обновить</Button>
      {list.length === 0 && <Empty>Новых заявок нет</Empty>}
      {list.map((r) => (
        <Tile key={r.id} className="space-y-2">
          <p className="font-semibold">{SHOP_ITEMS.find((i) => i.id === r.item_id)?.name ?? r.item_id} · {r.price_som} сом</p>
          <p className="text-xs text-muted-foreground">Отправитель: {r.payer_note} · {new Date(r.created_at).toLocaleString("ru-RU")}</p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={async () => { if (await run(supabase.rpc("admin_resolve_payment", { _id: r.id, _approve: true }), "Товар выдан")) load(); }}>Подтвердить</Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={async () => { if (await run(supabase.rpc("admin_resolve_payment", { _id: r.id, _approve: false }), "Отклонено")) load(); }}>Отклонить</Button>
          </div>
        </Tile>
      ))}
    </div>
  );
}
