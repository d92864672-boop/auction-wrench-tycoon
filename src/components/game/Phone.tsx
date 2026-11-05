import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowLeft, Building2, CreditCard, Gavel, Globe, Hash, Home, Landmark, LineChart, Package, Plane, Send,
  Settings, ShieldAlert, Ship, Skull, ShoppingBag, Smartphone, Store, Tag, TrendingUp, Trophy, User, Wrench, Dices, CarFront,
} from "lucide-react";
import { useGame } from "@/game/store";
import { QUESTS, cityOf, fmt, gameDay, level, netWorth, fmtShort } from "@/game/engine";
import { AuctionApp, GosApp, PerekupApp, PlatesApp, RepairApp } from "./apps-cars";
import { BankApp, BusinessApp, CasinoApp, RealtyApp, StocksApp } from "./apps-money";
import { AccessoriesApp, DeliveryApp, QuestsApp, SettingsApp, ShiftApp, TravelApp, UpgradesApp } from "./apps-life";
import { MessengerApp, OnlineApp, ShopApp } from "./apps-online";
import { AdminApp } from "./apps-admin";
import { BlackMarketApp, ImportApp } from "./apps-shadow";
import { DriveApp } from "./apps-drive";

type AppDef = { id: string; name: string; icon: ComponentType<{ className?: string }>; color: string; C: ComponentType };

const APPS: AppDef[] = [
  { id: "perekup", name: "Перекуп", icon: Tag, color: "icon-blue", C: PerekupApp },
  { id: "bank", name: "Банк", icon: CreditCard, color: "icon-navy", C: BankApp },
  { id: "delivery", name: "Доставка", icon: Package, color: "icon-orange", C: DeliveryApp },
  { id: "casino", name: "Казино", icon: Dices, color: "icon-violet", C: CasinoApp },
  { id: "settings", name: "Настройки", icon: Settings, color: "icon-gray", C: SettingsApp },
  { id: "auction", name: "Аукционы", icon: Gavel, color: "icon-amber", C: AuctionApp },
  { id: "repair", name: "Ремонт", icon: Wrench, color: "icon-teal", C: RepairApp },
  { id: "gos", name: "Госуслуги", icon: Landmark, color: "icon-royal", C: GosApp },
  { id: "upgrades", name: "Улучшения", icon: TrendingUp, color: "icon-purple", C: UpgradesApp },
  { id: "acc", name: "Аксессуары", icon: Smartphone, color: "icon-pink", C: AccessoriesApp },
  { id: "quests", name: "Задания", icon: Trophy, color: "icon-gold", C: QuestsApp },
  { id: "travel", name: "Путешествие", icon: Plane, color: "icon-sky", C: TravelApp },
  { id: "stocks", name: "Биржа", icon: LineChart, color: "icon-green", C: StocksApp },
  { id: "plates", name: "Номера", icon: Hash, color: "icon-lime", C: PlatesApp },
  { id: "realty", name: "Недвижимость", icon: Home, color: "icon-peach", C: RealtyApp },
  { id: "business", name: "Бизнес", icon: Store, color: "icon-emerald", C: BusinessApp },
  { id: "shift", name: "Смена", icon: User, color: "icon-coral", C: ShiftApp },
  { id: "online", name: "Онлайн", icon: Globe, color: "icon-cyan", C: OnlineApp },
  { id: "shop", name: "Магазин", icon: ShoppingBag, color: "icon-red", C: ShopApp },
  { id: "messenger", name: "Мессенджер", icon: Send, color: "icon-sky", C: MessengerApp },
  { id: "black", name: "Чёрный рынок", icon: Skull, color: "icon-dark", C: BlackMarketApp },
  { id: "import", name: "Пригон", icon: Ship, color: "icon-teal", C: ImportApp },
  { id: "drive", name: "Покатушки", icon: CarFront, color: "icon-red", C: DriveApp },
];

const ADMIN_APP: AppDef = { id: "admin", name: "Админка", icon: ShieldAlert, color: "icon-red", C: AdminApp };

function clock(min: number) {
  const m = min % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function Phone() {
  const { state, isAdmin, ban } = useGame();
  const apps = isAdmin ? [...APPS, ADMIN_APP] : APPS;
  const [open, setOpen] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const app = apps.find((a) => a.id === open);
  const questReady = QUESTS.filter((q) => { const [p, t] = q.progress(state); return p >= t && !state.questsClaimed.includes(q.id); }).length;
  const badges: Record<string, number> = {
    quests: questReady,
    gos: state.fines.length,
    delivery: state.job?.kind === "delivery" && now >= state.job.endAt ? 1 : 0,
    shift: state.job?.kind === "shift" && now >= state.job.endAt ? 1 : 0,
  };
  if (ban) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="max-w-sm space-y-3 text-center">
          <ShieldAlert className="mx-auto h-12 w-12 text-destructive" />
          <h1 className="font-display text-2xl font-semibold">Аккаунт заблокирован</h1>
          <p className="text-sm text-muted-foreground">Администрация wertперекуп заблокировала ваш аккаунт.</p>
          {ban.reason && <p className="text-sm">Причина: {ban.reason}</p>}
        </div>
      </div>
    );
  }
  const wp = state.wallpaper === "default" ? "wp-default" : state.wallpaper;

  return (
    <div className="flex min-h-screen justify-center bg-background">
      <div className={`${wp} relative flex min-h-screen w-full max-w-[440px] flex-col overflow-hidden`}>
        <div className="flex items-center justify-between px-5 pt-3 text-sm font-semibold">
          <span>{clock(state.minutes)}</span>
          <span className="font-display text-xs tracking-wide">wertперекуп</span>
          <span>{fmtShort(state.money)}</span>
        </div>
        {!app ? (
          <main className="anim-fade-up flex flex-1 flex-col px-5 pb-6">
            <p className="mt-6 font-display text-7xl font-light tracking-tight">{clock(state.minutes)}</p>
            <p className="mt-1 text-lg font-medium">День {gameDay(state)} · {cityOf(state).name}</p>
            <div className="glass mt-4 grid grid-cols-3 gap-2 rounded-2xl p-3 text-center">
              <div><p className="text-[11px] text-muted-foreground">Наличные</p><p className="font-display text-sm">{fmtShort(state.money)}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Капитал</p><p className="font-display text-sm">{fmtShort(netWorth(state))}</p></div>
              <div><p className="text-[11px] text-muted-foreground">Уровень</p><p className="font-display text-sm">{level(state)}</p></div>
            </div>
            <div className="mt-6 grid grid-cols-4 gap-x-2 gap-y-5">
              {apps.map((a, i) => (
                <button key={a.id} onClick={() => setOpen(a.id)} style={{ animationDelay: `${i * 25}ms` }} className="anim-icon-pop flex flex-col items-center gap-1.5 transition-transform active:scale-90">
                  <span className={`icon ${a.color} relative flex h-14 w-14 items-center justify-center rounded-2xl`}>
                    <a.icon className="h-7 w-7" />
                    {(badges[a.id] ?? 0) > 0 && (
                      <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                        {badges[a.id]}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate text-[11px] font-medium">{a.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto pt-6 text-center text-xs text-muted-foreground">
              <Building2 className="mr-1 inline h-3 w-3" />Бизнесов: {state.businesses.length} · Машин: {state.garage.length}
            </div>
          </main>
        ) : (
          <div key={app.id} className="anim-app-in flex flex-1 flex-col bg-background">
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-3">
              <button onClick={() => setOpen(null)} aria-label="Назад" className="rounded-full p-1 hover:bg-muted">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <span className={`icon ${app.color} flex h-8 w-8 items-center justify-center rounded-lg`}>
                <app.icon className="h-4 w-4" />
              </span>
              <h1 className="flex-1 font-display text-base font-semibold">{app.name}</h1>
              <span className="text-sm text-muted-foreground">{fmt(state.money)}</span>
            </header>
            <div className="no-scrollbar flex-1 overflow-y-auto p-4">
              <app.C />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
