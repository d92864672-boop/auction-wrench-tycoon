import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGame } from "@/game/store";
import { fmt, fmtShort } from "@/game/engine";
import { SHOP_ITEMS, type ShopItem } from "@/game/shop";
import qrAsset from "@/assets/mbank-qr.jpg.asset.json";
import { Empty, Section, Tile } from "./ui";

function Offline({ error, retry }: { error: string | null; retry: () => void }) {
  return (
    <Tile className="space-y-2 text-center">
      <p className="text-sm font-semibold">Сервер игроков недоступен</p>
      <p className="text-xs text-muted-foreground">{error ?? "Пробуем подключиться…"}</p>
      <Button size="sm" variant="secondary" className="w-full" onClick={retry}>Повторить</Button>
    </Tile>
  );
}

/** Общий чат живых игроков. */
export function MessengerApp() {
  const { social, socialError, sendChat, refreshSocial } = useGame();
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);
  const msgs = social?.chat ?? [];
  const me = social?.me.id;

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [msgs.length]);

  if (!social) return <Offline error={socialError} retry={() => void refreshSocial()} />;

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    try {
      await sendChat(body);
    } catch {
      toast.error("Сообщение не отправилось");
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-2 pb-3">
        {msgs.length === 0 && <Empty>Пока тихо. Напиши первым — сообщение увидят все игроки.</Empty>}
        {msgs.map((m) => {
          const mine = m.playerId === me;
          return (
            <div key={m.id} className={mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  mine
                    ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-primary-foreground"
                    : "max-w-[80%] rounded-2xl rounded-bl-sm bg-card px-3 py-2"
                }
              >
                {!mine && (
                  <p className="text-[11px] font-semibold text-warning">
                    {m.nickname}
                    {m.admin ? " · админ" : ""}
                  </p>
                )}
                <p className="break-words text-sm">{m.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      <form
        className="sticky bottom-0 space-y-1 bg-background pt-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <label htmlFor="chat-msg" className="wb-field-label block">Сообщение игрокам</label>
        <div className="flex gap-2">
          <Input id="chat-msg" value={text} maxLength={300} onChange={(e) => setText(e.target.value)} placeholder="Написать в общий чат" />
          <Button type="submit">Отпр.</Button>
        </div>
      </form>
    </div>
  );
}

/** Онлайн: реальные игроки в сети и рейтинг по успешным сделкам. */
export function OnlineApp() {
  const { social, socialError, refreshSocial } = useGame();
  const online = social?.online ?? [];
  const rating = social?.rating ?? [];
  const deals = social?.deals ?? [];

  if (!social) return <Offline error={socialError} retry={() => void refreshSocial()} />;

  return (
    <Tabs defaultValue="rating">
      <TabsList className="w-full">
        <TabsTrigger value="rating" className="flex-1">Рейтинг</TabsTrigger>
        <TabsTrigger value="online" className="flex-1">Онлайн · {social.onlineCount}</TabsTrigger>
      </TabsList>
      <TabsContent value="rating" className="mt-3 space-y-2">
        <Section title="Рейтинг по сделкам" right={<Button size="sm" variant="ghost" onClick={() => void refreshSocial()}>Обновить</Button>}>
          {rating.length === 0 && <Empty>Сделок пока нет — стань первым</Empty>}
          {rating.map((p, i) => (
            <Tile key={p.id} className={p.id === social.me.id ? "flex items-center gap-3 border-primary" : "flex items-center gap-3"}>
              <span className="w-6 text-center font-display text-sm text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nickname}</p>
                <p className="text-xs text-muted-foreground">{p.deals} сделок · ур. {p.level}</p>
              </div>
              <span className="font-display text-sm text-success">{fmtShort(p.netWorth)}</span>
            </Tile>
          ))}
        </Section>
        <Section title="Последние сделки">
          {deals.length === 0 && <Empty>Пока никто не закрыл сделку</Empty>}
          {deals.slice(0, 10).map((d) => (
            <Tile key={d.id} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{d.title}</p>
                <p className="text-xs text-muted-foreground">{d.nickname}</p>
              </div>
              <span className="font-display text-sm text-success">{fmt(d.price)}</span>
            </Tile>
          ))}
        </Section>
      </TabsContent>
      <TabsContent value="online" className="mt-3 space-y-2">
        <Section title={`Сейчас в игре · ${social.onlineCount}`} right={<Button size="sm" variant="ghost" onClick={() => void refreshSocial()}>Обновить</Button>}>
          {online.length === 0 && <Empty>Никого нет в сети. Заходи с другого устройства — и вы увидите друг друга.</Empty>}
          {online.map((p) => (
            <Tile key={p.id} className="flex items-center gap-3">
              <span className="h-2 w-2 shrink-0 rounded-full bg-success" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{p.nickname}</p>
                <p className="text-xs text-muted-foreground">{p.deals} сделок · ур. {p.level}</p>
              </div>
              <span className="font-display text-sm text-success">{fmtShort(p.netWorth)}</span>
            </Tile>
          ))}
        </Section>
      </TabsContent>
    </Tabs>
  );
}

/** Магазин: заявка на оплату уходит администратору, товар выдаётся после проверки. */
export function ShopApp() {
  const { social, refreshSocial, orderItem } = useGame();
  const [buying, setBuying] = useState<ShopItem | null>(null);
  const [note, setNote] = useState("");
  const [qrOk, setQrOk] = useState(true);
  const [sending, setSending] = useState(false);

  const myOrders = (social?.orders ?? []).filter((o) => o.playerId === social?.me.id);

  if (buying)
    return (
      <div className="space-y-3">
        <Tile className="border-destructive space-y-1">
          <p className="font-semibold">⚠️ Принимается только в сомах</p>
          <p className="text-sm">
            Если другая валюта, то вы не сможете купить. Когда купите, ожидайте ответа администратора — он вам выдаст ваш товар.
          </p>
        </Tile>
        <Tile className="space-y-2 text-center">
          <p className="font-semibold">{buying.name} · {buying.priceRub} сом</p>
          {qrOk ? (
            <img
              src={qrAsset.url}
              alt="QR для оплаты MBank"
              className="mx-auto w-56 rounded-lg"
              onError={() => setQrOk(false)}
            />
          ) : (
            <div className="mx-auto w-56 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
              QR-картинка не загрузилась. Напиши в мессенджер — администратор пришлёт реквизиты MBank, оплата всё равно засчитается по заявке.
            </div>
          )}
          <p className="text-xs text-muted-foreground">Отсканируй QR в MBank и переведи ровно {buying.priceRub} сом</p>
        </Tile>
        <div className="space-y-1">
          <label htmlFor="order-note" className="wb-field-label block">Имя отправителя или последние цифры номера</label>
          <Input id="order-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Например: Азамат, 4412" />
        </div>
        <Button
          className="w-full"
          disabled={!note.trim() || sending}
          onClick={async () => {
            setSending(true);
            try {
              await orderItem({ id: buying.id, name: buying.name, priceSom: buying.priceRub, note: note.trim() });
              toast.success("Заявка отправлена. Ожидайте ответа администратора");
              setBuying(null);
              setNote("");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Заявка не отправилась");
            } finally {
              setSending(false);
            }
          }}
        >
          {sending ? "Отправляем…" : "Я оплатил"}
        </Button>
        <Button variant="ghost" className="w-full" onClick={() => setBuying(null)}>Назад</Button>
      </div>
    );

  return (
    <div className="space-y-3">
      <Tile className="icon-purple border-0 p-4">
        <p className="font-display text-lg font-semibold">Магазин wertперекуп</p>
        <p className="mt-1 text-sm opacity-90">Оплата только в сомах по QR. Товар выдаёт администратор после проверки.</p>
      </Tile>
      {SHOP_ITEMS.map((i) => (
        <Tile key={i.id} className="flex items-center justify-between gap-2">
          <div>
            <p className="font-semibold">
              {i.name}{" "}
              {i.badge && <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-[10px] text-primary-foreground">{i.badge}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{i.desc}</p>
          </div>
          <Button size="sm" onClick={() => setBuying(i)}>{i.priceRub} сом</Button>
        </Tile>
      ))}

      <Section title="Мои заявки" right={<Button size="sm" variant="ghost" onClick={() => void refreshSocial()}>Обновить</Button>}>
        {myOrders.length === 0 && <Empty>Заявок нет</Empty>}
        {myOrders.slice(0, 8).map((o) => (
          <Tile key={o.id} className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{o.itemName}</p>
              <p className="text-xs text-muted-foreground">{new Date(o.at).toLocaleString("ru-RU")}</p>
            </div>
            <span
              className={
                o.status === "approved"
                  ? "text-xs font-semibold text-success"
                  : o.status === "rejected"
                    ? "text-xs font-semibold text-destructive"
                    : "text-xs font-semibold text-warning"
              }
            >
              {o.status === "approved" ? "выдано" : o.status === "rejected" ? "отклонено" : "на проверке"}
            </span>
          </Tile>
        ))}
      </Section>
    </div>
  );
}
