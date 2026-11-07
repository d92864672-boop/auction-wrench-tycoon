import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import { fmt, fmtShort } from "@/game/engine";
import { SHOP_ITEMS } from "@/game/shop";
import type { AdminOverview } from "@/game/social";
import { Empty, Section, Tile } from "./ui";

const INFINITE = 1_000_000_000_000; // 1 трлн

function parseAmount(v: string) {
  const n = Math.floor(Number(v.replace(/\s/g, "")));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function ItemSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Товар"
      className="h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm"
    >
      {SHOP_ITEMS.map((i) => (
        <option key={i.id} value={i.id}>{i.name}</option>
      ))}
    </select>
  );
}

type Player = AdminOverview["players"][number];

export function AdminApp() {
  const { isAdmin, social, adminOverview, adminAction } = useGame();
  const [ov, setOv] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOv(await adminOverview());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Нет доступа");
    } finally {
      setLoading(false);
    }
  }, [adminOverview]);

  useEffect(() => {
    if (!isAdmin) return;
    void load();
  }, [isAdmin, load]);

  const run = useCallback(
    async (action: Record<string, unknown>) => {
      try {
        toast.success(await adminAction(action));
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Не получилось");
      }
    },
    [adminAction, load],
  );

  if (!isAdmin)
    return (
      <Empty>
        Админка только для владельца d92864672@gmail.com. Войди под этой почтой на экране «Войти» — и раздел появится на рабочем столе.
      </Empty>
    );

  return (
    <Tabs defaultValue="me">
      <TabsList className="w-full">
        <TabsTrigger value="me" className="flex-1">Себе</TabsTrigger>
        <TabsTrigger value="players" className="flex-1">Игроки</TabsTrigger>
        <TabsTrigger value="mod" className="flex-1">Модерация</TabsTrigger>
        <TabsTrigger value="pay" className="flex-1">Оплаты</TabsTrigger>
      </TabsList>

      <TabsContent value="me" className="mt-3">
        <SelfTab playerId={social?.me.id ?? ""} run={run} />
      </TabsContent>

      <TabsContent value="players" className="mt-3">
        <PlayersTab ov={ov} loading={loading} error={error} reload={load} run={run} />
      </TabsContent>

      <TabsContent value="mod" className="mt-3">
        <ModTab ov={ov} reload={load} run={run} />
      </TabsContent>

      <TabsContent value="pay" className="mt-3">
        <PaymentsTab ov={ov} reload={load} run={run} />
      </TabsContent>
    </Tabs>
  );
}

function SelfTab({ playerId, run }: { playerId: string; run: (a: Record<string, unknown>) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [item, setItem] = useState(SHOP_ITEMS[0]?.id ?? "");

  return (
    <div className="space-y-3">
      <Section title="1. Бесконечные деньги">
        <Tile className="space-y-2">
          <p className="text-sm text-muted-foreground">Начислить себе {fmtShort(INFINITE)} за одно нажатие.</p>
          <Button className="w-full" disabled={!playerId} onClick={() => void run({ type: "money", playerId, amount: INFINITE })}>
            + {fmtShort(INFINITE)}
          </Button>
          <div className="space-y-1">
            <label htmlFor="admin-own-amount" className="wb-field-label block">Своя сумма</label>
            <div className="flex gap-2">
              <Input id="admin-own-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" />
              <Button variant="secondary" onClick={() => void run({ type: "money", playerId, amount: parseAmount(amount) })}>Выдать</Button>
            </div>
          </div>
        </Tile>
      </Section>
      <Section title="Выдать себе предмет">
        <Tile className="flex gap-2">
          <ItemSelect value={item} onChange={setItem} />
          <Button variant="secondary" onClick={() => void run({ type: "item", playerId, itemId: item })}>Выдать</Button>
        </Tile>
      </Section>
    </div>
  );
}

function PlayersTab({
  ov,
  loading,
  error,
  reload,
  run,
}: {
  ov: AdminOverview | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  run: (a: Record<string, unknown>) => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [allAmount, setAllAmount] = useState("");

  const players = (ov?.players ?? []).filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.nickname.toLowerCase().includes(q) || p.id.toLowerCase().includes(q);
  });

  return (
    <div className="space-y-3">
      <Section title="4. Деньги всем игрокам">
        <Tile className="space-y-1">
          <label htmlFor="admin-all-amount" className="wb-field-label block">Сумма каждому</label>
          <div className="flex gap-2">
            <Input id="admin-all-amount" inputMode="numeric" value={allAmount} onChange={(e) => setAllAmount(e.target.value)} placeholder="Сумма" />
            <Button onClick={() => void run({ type: "moneyAll", amount: parseAmount(allAmount) })}>Всем</Button>
          </div>
          <p className="text-xs text-muted-foreground">Игрок получит деньги при следующем заходе в игру.</p>
        </Tile>
      </Section>

      <Section title={`Игроки · ${ov?.totals.players ?? 0} · онлайн ${ov?.totals.online ?? 0}`} right={<Button size="sm" variant="ghost" onClick={() => void reload()}>Обновить</Button>}>
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по нику или id" />
        {loading && !ov && <Empty>Загружаем…</Empty>}
        {error && <Tile className="border-destructive"><p className="text-sm">{error}</p></Tile>}
        {!loading && players.length === 0 && <Empty>Игроков пока нет — они появятся, когда кто-то зайдёт в игру.</Empty>}
        {players.map((p) => (
          <Tile key={p.id} className={p.banned ? "border-destructive" : undefined}>
            <button className="flex w-full items-center gap-2 text-left" onClick={() => setOpen(open === p.id ? null : p.id)}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  {p.nickname}
                  {p.online && <span className="ml-1 rounded-full bg-success px-2 py-0.5 text-[10px] text-background">в сети</span>}
                  {p.banned && <span className="ml-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] text-destructive-foreground">БАН</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{p.deals} сделок · ур. {p.level}</p>
              </div>
              <span className="font-display text-sm text-success">{fmtShort(p.netWorth)}</span>
            </button>
            {open === p.id && <PlayerActions p={p} run={run} />}
          </Tile>
        ))}
      </Section>
    </div>
  );
}

function PlayerActions({ p, run }: { p: Player; run: (a: Record<string, unknown>) => Promise<void> }) {
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [nick, setNick] = useState(p.nickname);
  const [item, setItem] = useState(SHOP_ITEMS[0]?.id ?? "");

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">2–3. Выдать / забрать деньги</p>
        <div className="flex gap-2">
          <Input inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Сумма" aria-label="Сумма" />
          <Button size="sm" onClick={() => void run({ type: "money", playerId: p.id, amount: parseAmount(amount) })}>+</Button>
          <Button size="sm" variant="secondary" onClick={() => void run({ type: "money", playerId: p.id, amount: -parseAmount(amount) })}>−</Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">5–6. Бан / разбан</p>
        {p.banned ? (
          <div className="space-y-2">
            <p className="text-sm">Причина: {p.banReason || "—"}</p>
            <Button size="sm" variant="secondary" className="w-full" onClick={() => void run({ type: "unban", playerId: p.id })}>Разбанить</Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Причина" aria-label="Причина бана" />
            <Button size="sm" variant="destructive" onClick={() => void run({ type: "ban", playerId: p.id, reason })}>Бан</Button>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">7. Выдать предмет</p>
        <div className="flex gap-2">
          <ItemSelect value={item} onChange={setItem} />
          <Button size="sm" variant="secondary" onClick={() => void run({ type: "item", playerId: p.id, itemId: item })}>Выдать</Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">8. Сменить ник</p>
        <div className="flex gap-2">
          <Input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} aria-label="Новый ник" />
          <Button size="sm" variant="secondary" onClick={() => void run({ type: "nickname", playerId: p.id, nickname: nick })}>ОК</Button>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">9. Сбросить прогресс</p>
        <Button
          size="sm"
          variant="destructive"
          className="w-full"
          onClick={() => {
            if (!confirm(`Сбросить весь прогресс игрока ${p.nickname}?`)) return;
            void run({ type: "reset", playerId: p.id });
          }}
        >
          Сбросить прогресс
        </Button>
      </div>
    </div>
  );
}

function ModTab({
  ov,
  reload,
  run,
}: {
  ov: AdminOverview | null;
  reload: () => Promise<void>;
  run: (a: Record<string, unknown>) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const msgs = ov?.chat ?? [];

  return (
    <div className="space-y-3">
      <Section title="10. Объявление всем в чат">
        <Tile className="space-y-1">
          <label htmlFor="admin-broadcast" className="wb-field-label block">Текст объявления</label>
          <div className="flex gap-2">
            <Input id="admin-broadcast" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Текст" />
            <Button
              onClick={async () => {
                if (!text.trim()) return;
                await run({ type: "broadcast", text: text.trim() });
                setText("");
              }}
            >
              Отпр.
            </Button>
          </div>
        </Tile>
      </Section>

      <Section title="11. Удалить сообщения чата" right={<Button size="sm" variant="ghost" onClick={() => void reload()}>Обновить</Button>}>
        {msgs.length === 0 && <Empty>Сообщений нет</Empty>}
        {msgs.slice().reverse().map((m) => (
          <Tile key={m.id} className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold text-warning">{m.nickname}</p>
              <p className="break-words text-sm">{m.body}</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => void run({ type: "deleteMessage", messageId: m.id })}>Удалить</Button>
          </Tile>
        ))}
      </Section>

      <Section title="12. Последние сделки">
        {(ov?.deals ?? []).length === 0 && <Empty>Сделок нет</Empty>}
        {(ov?.deals ?? []).slice(0, 20).map((d) => (
          <Tile key={d.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{d.title}</p>
              <p className="text-xs text-muted-foreground">{d.nickname}</p>
            </div>
            <span className="font-display text-sm text-success">{fmt(d.price)}</span>
          </Tile>
        ))}
      </Section>
    </div>
  );
}

function PaymentsTab({
  ov,
  reload,
  run,
}: {
  ov: AdminOverview | null;
  reload: () => Promise<void>;
  run: (a: Record<string, unknown>) => Promise<void>;
}) {
  const orders = (ov?.orders ?? []).filter((o) => o.status === "pending");

  return (
    <div className="space-y-2">
      <Button variant="secondary" className="w-full" onClick={() => void reload()}>Обновить</Button>
      {orders.length === 0 && <Empty>Новых заявок нет</Empty>}
      {orders.map((r) => (
        <Tile key={r.id} className="space-y-2">
          <p className="font-semibold">
            {SHOP_ITEMS.find((i) => i.id === r.itemId)?.name ?? r.itemName} · {r.priceSom} сом
          </p>
          <p className="text-xs text-muted-foreground">
            {r.nickname} · отправитель: {r.note || "—"} · {new Date(r.at).toLocaleString("ru-RU")}
          </p>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => void run({ type: "resolveOrder", orderId: r.id, approve: true })}>Подтвердить</Button>
            <Button size="sm" variant="destructive" className="flex-1" onClick={() => void run({ type: "resolveOrder", orderId: r.id, approve: false })}>Отклонить</Button>
          </div>
        </Tile>
      ))}
    </div>
  );
}
