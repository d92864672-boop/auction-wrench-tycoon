import { useMemo, useRef, useState } from "react";
import { Car as CarIcon, Flame, MessageSquare, Send, ShoppingBag, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGame } from "@/game/store";
import { blackOf, fmt, fmtShort } from "@/game/engine";
import { BLACK_CARS, BLACK_ITEMS, BLACK_SELLERS } from "@/game/data";
import {
  acceptSellerOffer,
  blackBoostBonus,
  blackCarPrice,
  buyBlackCar,
  buyBlackItem,
  dealsLeaderboard,
  openSellerChat,
  playerRating,
  sellerChat,
  talkToSeller,
} from "@/game/black";
import { carPhotos } from "@/game/photos";

type Tab = "shop" | "cars" | "chat" | "rating";

const TABS: { id: Tab; label: string; icon: typeof ShoppingBag }[] = [
  { id: "shop", label: "Магазин", icon: ShoppingBag },
  { id: "cars", label: "Тачки", icon: CarIcon },
  { id: "chat", label: "Дилеры", icon: MessageSquare },
  { id: "rating", label: "Рейтинг", icon: Trophy },
];

const QUICK = ["Привет", "Какая цена?", "Скинь скидку", "Документы чистые?"];

export function BlackShopApp() {
  const { state, set, act, nickname } = useGame();
  const [tab, setTab] = useState<Tab>("shop");
  const [sellerId, setSellerId] = useState(BLACK_SELLERS[0]!.id);
  const [carId, setCarId] = useState(BLACK_SELLERS[0]!.cars[0]!);
  const [text, setText] = useState("");
  const [offer, setOffer] = useState("");
  const chatRef = useRef<HTMLDivElement>(null);

  const seller = BLACK_SELLERS.find((s) => s.id === sellerId) ?? BLACK_SELLERS[0]!;
  const chat = sellerChat(state, sellerId);
  // Рейтинг строится по реальным игрокам с сервера. Ботов в списке нет:
  // если сервер ещё не ответил, показываем только себя.
  const liveRating = social?.rating;
  const board = useMemo(() => {
    const meId = social?.me.id;
    if (liveRating && liveRating.length > 0) {
      return liveRating.map((p) => ({
        id: p.id,
        name: p.nickname,
        tag: p.deals > 0 ? "сделки" : "новичок",
        rating: playerRating(p.deals),
        deals: p.deals,
        online: p.id === meId || Boolean(social?.online.some((o) => o.id === p.id)),
        me: p.id === meId,
      }));
    }
    return dealsLeaderboard(state, nickname).filter((p) => p.me);
  }, [liveRating, social, state, nickname]);
  const myRank = board.findIndex((p) => p.me) + 1;
  const deals = blackOf(state).deals;
  const boost = blackBoostBonus(state);

  const openChat = (sid: string, cid: string) => {
    set((s) => openSellerChat(s, sid, cid));
    setSellerId(sid);
    setCarId(cid);
    setTab("chat");
  };

  const send = (body: string) => {
    const value = body.trim();
    if (!value) return;
    set((s) => talkToSeller(s, sellerId, carId, value).state);
    setText("");
    setOffer("");
    requestAnimationFrame(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }));
  };

  return (
    <div className="wb-shell space-y-3">
      <div className="wb-hero">
        <div className="flex items-start justify-between">
          <div>
            <p className="wb-kicker">закрытый клуб перекупов</p>
            <h2 className="wb-logo">
              WERTOOS <span className="wb-logo-red">BLACK</span>
            </h2>
          </div>
          <span className="wb-crest">
            <Flame className="h-5 w-5" />
          </span>
        </div>
        <div className="wb-stats">
          <div>
            <span>Баланс</span>
            <b>{fmtShort(state.money)}</b>
          </div>
          <div>
            <span>Сделки</span>
            <b>{deals.length}</b>
          </div>
          <div>
            <span>Бонус</span>
            <b>+{boost}%</b>
          </div>
          <div>
            <span>Место</span>
            <b>#{myRank}</b>
          </div>
        </div>
      </div>

      <div className="wb-seg">
        {TABS.map((t) => (
          <button key={t.id} type="button" data-active={tab === t.id} onClick={() => setTab(t.id)}>
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === "shop" && (
        <div className="space-y-2">
          <p className="px-1 text-[11px] text-muted-foreground">
            Товары клуба: мерч, VIP и вечные бонусы к цене продажи. Скидки только для своих.
          </p>
          <div className="grid grid-cols-2 gap-2">
            {BLACK_ITEMS.map((item) => {
              const owned = item.kind === "acc" && state.accessories.includes(item.id);
              return (
                <div key={item.id} className="wb-card flex flex-col gap-1.5 p-3">
                  <p className="text-[13px] leading-tight font-semibold">{item.name}</p>
                  <p className="text-[10px] leading-snug text-muted-foreground">{item.desc}</p>
                  <div className="mt-auto space-y-1.5 pt-1">
                    <p className="wb-price">{fmt(item.price)}</p>
                    <Button
                      size="sm"
                      className="wb-btn w-full"
                      disabled={owned}
                      onClick={() => act((s) => buyBlackItem(s, item.id))}
                    >
                      {owned ? "Куплено" : "Купить"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "cars" && (
        <div className="space-y-2">
          {BLACK_SELLERS.map((sl) => (
            <div key={sl.id} className="wb-card space-y-2 p-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-bold">{sl.name}</p>
                  <p className="text-[10px] text-muted-foreground">{sl.title}</p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold text-red-400">★ {sl.rating}</p>
                  <p className="text-[10px] text-muted-foreground">{sl.deals} сделок</p>
                </div>
              </div>
              {sl.cars.map((cid) => {
                const model = BLACK_CARS.find((c) => c.id === cid);
                if (!model) return null;
                const photo = carPhotos({ id: cid, modelId: cid })[0];
                return (
                  <div key={cid} className="wb-car">
                    <img
                      src={photo}
                      alt={model.name}
                      loading="lazy"
                      className="h-20 w-full rounded-lg object-cover"
                    />
                    <div className="flex items-end justify-between gap-2 pt-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{model.name}</p>
                        <p className="wb-price">{fmt(blackCarPrice(sl.id, cid))}</p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="wb-btn-ghost h-8 px-2"
                          aria-label={`Торговаться с ${sl.name}`}
                          onClick={() => openChat(sl.id, cid)}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          className="wb-btn h-8"
                          onClick={() => act((s) => buyBlackCar(s, sl.id, cid))}
                        >
                          Забрать
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      {tab === "chat" && (
        <div className="wb-card space-y-2 p-3">
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {BLACK_SELLERS.map((sl) => (
              <button
                key={sl.id}
                type="button"
                className="wb-chip"
                data-active={sl.id === sellerId}
                onClick={() => openChat(sl.id, sl.cars[0]!)}
              >
                {sl.name} · ★{sl.rating}
              </button>
            ))}
          </div>
          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {seller.cars.map((cid) => (
              <button
                key={cid}
                type="button"
                className="wb-chip"
                data-active={cid === carId}
                onClick={() => openChat(seller.id, cid)}
              >
                {BLACK_CARS.find((c) => c.id === cid)?.name ?? cid}
              </button>
            ))}
          </div>

          <div ref={chatRef} className="wb-chat max-h-60 space-y-1.5 overflow-y-auto">
            {chat && chat.messages.length > 0 ? (
              chat.messages.map((m, i) => (
                <div key={`${i}-${m.at}`} className={m.from === "me" ? "wb-bubble-me" : "wb-bubble-seller"}>
                  {m.text}
                </div>
              ))
            ) : (
              <p className="text-[11px] text-muted-foreground">
                Напиши дилеру первым — торг приветствуется, но грубость он не любит.
              </p>
            )}
          </div>

          {chat?.agreed && chat.offer ? (
            <Button className="wb-btn w-full" onClick={() => act((s) => acceptSellerOffer(s, seller.id))}>
              Забрать за {fmt(chat.offer)}
            </Button>
          ) : null}

          <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
            {QUICK.map((q) => (
              <button key={q} type="button" className="wb-quick" onClick={() => send(q)}>
                {q}
              </button>
            ))}
          </div>

          <div className="space-y-1">
            <label htmlFor="wb-chat-msg" className="wb-field-label block">
              Сообщение дилеру
            </label>
            <div className="flex gap-1.5">
              <Input
                id="wb-chat-msg"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(text)}
                placeholder="Сообщение дилеру"
                className="wb-input h-9"
              />
              <Button size="sm" className="wb-btn h-9 px-3" aria-label="Отправить" onClick={() => send(text)}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Input
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send(offer)}
              placeholder="Своя цена: 18млн / 900 тыс"
              className="wb-input h-9"
            />
            <Button size="sm" className="wb-btn h-9 px-3" onClick={() => send(offer)}>
              Торг
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Попыток торга: {chat?.tries ?? 3}/3 · {seller.title}
          </p>
        </div>
      )}

      {tab === "rating" && (
        <div className="space-y-2">
          <div className="wb-card space-y-1.5 p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">Рейтинг по сделкам</p>
              <span className="wb-badge">
                <Users className="h-3 w-3" /> онлайн {board.filter((p) => p.online).length}
              </span>
            </div>
            {board.map((p, i) => (
              <div key={p.id} className={`wb-row ${p.me ? "wb-row-me" : ""}`}>
                <span className="wb-rank">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold">
                    {p.name}
                    {p.me ? " (ты)" : ""}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {p.tag} · ★ {p.rating}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-bold">{p.deals}</p>
                  <p className="text-[9px] text-muted-foreground">сделок</p>
                </div>
                <span className={p.online ? "wb-dot-on" : "wb-dot-off"} />
              </div>
            ))}
          </div>

          <div className="wb-card space-y-1.5 p-3">
            <p className="text-sm font-bold">Последние сделки</p>
            {deals.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Пока ни одной сделки. Купи тачку у дилера или продай свою на рынке — каждая сделка идёт в рейтинг.
              </p>
            ) : (
              deals
                .slice(-6)
                .reverse()
                .map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg bg-white/5 px-2 py-1.5">
                    <div className="min-w-0">
                      <p className="truncate text-[12px] font-semibold">{d.car}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {d.seller} · {d.via === "black" ? "BLACK" : "рынок"}
                      </p>
                    </div>
                    <p className="wb-price shrink-0">{fmt(d.price)}</p>
                  </div>
                ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
