// Real-money shop catalog. Each item is delivered automatically to the player
// once a matching row appears in the item_grants table (written after payment).

export type ShopItem = {
  id: string;
  name: string;
  desc: string;
  priceRub: number; // real price in rubles
  badge?: string;
};

export const SHOP_ITEMS: ShopItem[] = [
  { id: "pack-start", name: "Стартовый пакет", desc: "1 000 000 ₽ на счёт", priceRub: 99 },
  { id: "pack-case", name: "Чемодан денег", desc: "10 000 000 ₽ на счёт", priceRub: 299, badge: "Хит" },
  { id: "pack-safe", name: "Сейф олигарха", desc: "100 000 000 ₽ на счёт", priceRub: 990 },
  { id: "vip-30", name: "VIP на 30 дней", desc: "×2 доход бизнесов и +2 места в гараже", priceRub: 199 },
  { id: "car-wert", name: "Lamborghini WERT Edition", desc: "Эксклюзивное авто в гараж", priceRub: 499, badge: "Эксклюзив" },
  { id: "plate-wert", name: "Номер W777RT", desc: "Именной номер — дорогой актив", priceRub: 149 },
  { id: "wp-gold", name: "Золотые обои", desc: "Премиум обои для телефона", priceRub: 49 },
];

export function findShopItem(id: string) {
  return SHOP_ITEMS.find((i) => i.id === id);
}
