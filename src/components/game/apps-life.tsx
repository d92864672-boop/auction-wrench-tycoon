import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGame } from "@/game/store";
import { supabase } from "@/integrations/supabase/client";
import {
  QUESTS,
  buyUpgrade,
  claimQuest,
  cityOf,
  finishJob,
  fmt,
  fmtShort,
  level,
  startJob,
  travel,
  upg,
  upgradeCost,
} from "@/game/engine";
import { ACCESSORIES, CITIES, DELIVERIES, JOBS, UPGRADES } from "@/game/data";
import { Empty, Progress, Section, Tile } from "./ui";

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  return now;
}

function ActiveJob({ kind }: { kind: "delivery" | "shift" }) {
  const { state, act } = useGame();
  const now = useNow();
  const j = state.job;
  if (!j) return null;
  const total = kind === "delivery" ? DELIVERIES.find((d) => d.id === j.id)?.seconds : JOBS.find((d) => d.id === j.id)?.seconds;
  const left = Math.max(0, j.endAt - now);
  const pct = 100 - (left / ((total ?? 1) * 1000)) * 100;
  return (
    <Tile className="border-primary">
      <p className="text-xs text-muted-foreground">{j.kind === "delivery" ? "Доставка в пути" : "Идёт смена"}</p>
      <p className="font-semibold">{j.name}</p>
      <div className="my-2">
        <Progress value={pct} />
      </div>
      <Button className="w-full" disabled={left > 0} onClick={() => act((s) => finishJob(s))}>
        {left > 0 ? `Осталось ${Math.ceil(left / 1000)} с` : `Забрать ${fmt(j.pay)}`}
      </Button>
    </Tile>
  );
}

export function DeliveryApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-3">
      <ActiveJob kind="delivery" />
      <Section title="Заказы">
        {DELIVERIES.map((d) => (
          <Tile key={d.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{d.name}</p>
              <p className="text-xs text-muted-foreground">
                {d.seconds} с · {fmt(Math.round(d.pay * (1 + 0.2 * upg(state, "logistics"))))}
                {d.needsLicense ? " · нужны права" : ""}
              </p>
            </div>
            <Button
              size="sm"
              disabled={!!state.job}
              onClick={() => act((s) => (d.needsLicense && !s.license ? { state: s, error: "Нужны права — оформи в Госуслугах" } : startJob(s, "delivery", d)))}
            >
              Взять
            </Button>
          </Tile>
        ))}
      </Section>
    </div>
  );
}

export function ShiftApp() {
  const { state, act } = useGame();
  const lvl = level(state);
  return (
    <div className="space-y-3">
      <ActiveJob kind="shift" />
      <Section title={`Вакансии · ваш уровень ${lvl}`}>
        {JOBS.map((j) => {
          const locked = (j.minLevel ?? 1) > lvl;
          return (
            <Tile key={j.id} className="flex items-center justify-between gap-2">
              <div>
                <p className="font-semibold">{j.name}</p>
                <p className="text-xs text-muted-foreground">
                  {j.seconds} с · {fmt(Math.round(j.pay * (1 + 0.2 * upg(state, "charisma"))))}
                  {locked ? ` · с ${j.minLevel} уровня` : ""}
                </p>
              </div>
              <Button size="sm" disabled={locked || !!state.job} onClick={() => act((s) => startJob(s, "shift", j))}>Выйти</Button>
            </Tile>
          );
        })}
      </Section>
    </div>
  );
}

export function QuestsApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-2">
      {QUESTS.map((q) => {
        const [p, t] = q.progress(state);
        const claimed = state.questsClaimed.includes(q.id);
        const ready = p >= t && !claimed;
        return (
          <Tile key={q.id} className={claimed ? "opacity-50" : undefined}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{q.title}</p>
              <p className="shrink-0 text-xs text-warning">+{fmtShort(q.reward)}</p>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1">
                <Progress value={(p / t) * 100} />
              </div>
              {ready ? (
                <Button size="sm" onClick={() => act((s) => claimQuest(s, q.id))}>Забрать</Button>
              ) : (
                <span className="text-xs text-muted-foreground">{claimed ? "Готово" : `${Math.min(p, t).toLocaleString("ru-RU")}/${t.toLocaleString("ru-RU")}`}</span>
              )}
            </div>
          </Tile>
        );
      })}
    </div>
  );
}

export function TravelApp() {
  const { state, act } = useGame();
  const here = cityOf(state);
  const originName = { ru: "отечественные", eu: "европейские", jp: "японские", us: "американские" } as const;
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Покупай дёшево в одном городе — продавай дорого в другом.</p>
      {CITIES.map((c) => (
        <Tile key={c.id} className={c.id === here.id ? "border-primary" : undefined}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{c.name}{c.id === here.id ? " · вы здесь" : ""}</p>
              <p className="text-xs text-muted-foreground">
                Цены ×{c.buy.toFixed(2)} · Продажа ×{c.sell.toFixed(2)}
                {c.bonus ? ` · дешёвые ${originName[c.bonus]}` : ""}
              </p>
            </div>
            {c.id !== here.id && (
              <Button size="sm" onClick={() => act((s) => travel(s, c.id))}>{fmt(Math.max(c.travel, here.travel))}</Button>
            )}
          </div>
        </Tile>
      ))}
    </div>
  );
}

export function UpgradesApp() {
  const { state, act } = useGame();
  return (
    <div className="space-y-2">
      {UPGRADES.map((u) => {
        const l = upg(state, u.id);
        return (
          <Tile key={u.id} className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{u.name} · {l}/{u.max}</p>
              <p className="text-xs text-muted-foreground">{u.desc}</p>
            </div>
            <Button size="sm" disabled={l >= u.max} onClick={() => act((s) => buyUpgrade(s, u.id))}>
              {l >= u.max ? "Макс." : fmtShort(upgradeCost(state, u.id))}
            </Button>
          </Tile>
        );
      })}
    </div>
  );
}

export function AccessoriesApp() {
  const { state, act, set } = useGame();
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">Вещи добавляют к капиталу. Обои меняют фон телефона.</p>
      {ACCESSORIES.map((a) => {
        const owned = state.accessories.includes(a.id);
        return (
          <Tile key={a.id} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              {a.kind === "wallpaper" && <span className={`${a.id} h-10 w-7 rounded-md`} />}
              <div>
                <p className="font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{fmt(a.price)}</p>
              </div>
            </div>
            {owned ? (
              a.kind === "wallpaper" ? (
                <Button size="sm" variant="secondary" disabled={state.wallpaper === a.id} onClick={() => set((s) => ({ ...s, wallpaper: a.id }))}>
                  {state.wallpaper === a.id ? "Стоит" : "Поставить"}
                </Button>
              ) : (
                <span className="text-xs text-success">Куплено</span>
              )
            ) : (
              <Button
                size="sm"
                onClick={() =>
                  act((s) =>
                    s.money < a.price
                      ? { state: s, error: "Не хватает денег" }
                      : { state: { ...s, money: s.money - a.price, accessories: [...s.accessories, a.id], wallpaper: a.kind === "wallpaper" ? a.id : s.wallpaper }, message: `Куплено: ${a.name}` },
                  )
                }
              >
                Купить
              </Button>
            )}
          </Tile>
        );
      })}
    </div>
  );
}

export function SettingsApp() {
  const { state, set, user, nickname, setNickname, reset, cloudReady } = useGame();
  const [nick, setNick] = useState(nickname);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => setNick(nickname), [nickname]);
  const wallpapers = ["default", ...state.accessories.filter((a) => a.startsWith("wp-"))];
  return (
    <div className="space-y-4">
      <Section title="Аккаунт">
        {user ? (
          <Tile className="space-y-3">
            <p className="text-sm">
              {user.email} · <span className="text-success">{cloudReady ? "прогресс в облаке" : "синхронизация…"}</span>
            </p>
            <div className="flex gap-2">
              <Input value={nick} maxLength={20} onChange={(e) => setNick(e.target.value)} placeholder="Ник" />
              <Button onClick={() => setNickname(nick)}>Сохранить</Button>
            </div>
            <Button variant="secondary" className="w-full" onClick={() => supabase.auth.signOut()}>Выйти</Button>
          </Tile>
        ) : (
          <Tile className="space-y-2">
            <p className="text-sm text-muted-foreground">Войди, чтобы играть онлайн: рейтинг, чат, барахолка и покупки в магазине.</p>
            <Button asChild className="w-full">
              <Link to="/auth">Войти или создать аккаунт</Link>
            </Button>
          </Tile>
        )}
      </Section>
      <Section title="Обои">
        <div className="flex flex-wrap gap-2">
          {wallpapers.map((w) => (
            <button
              key={w}
              aria-label={`Обои ${w}`}
              onClick={() => set((s) => ({ ...s, wallpaper: w }))}
              className={`${w === "default" ? "wp-default" : w} h-16 w-10 rounded-lg border-2 ${state.wallpaper === w ? "border-primary" : "border-transparent"}`}
            />
          ))}
        </div>
      </Section>
      <Section title="Прогресс">
        {confirm ? (
          <div className="flex gap-2">
            <Button variant="destructive" className="flex-1" onClick={() => { reset(); setConfirm(false); }}>Да, сбросить</Button>
            <Button variant="secondary" className="flex-1" onClick={() => setConfirm(false)}>Отмена</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setConfirm(true)}>Начать заново</Button>
        )}
        {state.garage.length === 0 && state.businesses.length === 0 && <Empty>Совет: начни с дешёвых машин и ремонта</Empty>}
      </Section>
      <p className="text-center font-display text-xs text-muted-foreground">wertперекуп · v1.0</p>
    </div>
  );
}
