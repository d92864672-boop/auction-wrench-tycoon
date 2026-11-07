import bmw5Img from "@/assets/cars/bmw5.jpg";
import camryImg from "@/assets/cars/camry.jpg";
import e63Img from "@/assets/cars/e63.jpg";
import f40Img from "@/assets/cars/f40.jpg";
import g63Img from "@/assets/cars/g63.jpg";
import lc200Img from "@/assets/cars/lc200.jpg";
import mark2Img from "@/assets/cars/mark2.jpg";
import mustangImg from "@/assets/cars/mustang.jpg";
import poloImg from "@/assets/cars/polo.jpg";
import prioraImg from "@/assets/cars/priora.jpg";
import rs6Img from "@/assets/cars/rs6.jpg";
import skylineImg from "@/assets/cars/skyline.jpg";
import solarisImg from "@/assets/cars/solaris.jpg";
import supraImg from "@/assets/cars/supra.jpg";
import teslaImg from "@/assets/cars/tesla.jpg";
import urusImg from "@/assets/cars/urus.jpg";
import vaz2107Img from "@/assets/cars/vaz2107.jpg";
import vestaImg from "@/assets/cars/vesta.jpg";
import wertImg from "@/assets/cars/wert.jpg";
import int_budget from "@/assets/cars/interior-budget.jpg";
import int_mid from "@/assets/cars/interior-mid.jpg";
import int_lux from "@/assets/cars/interior-lux.jpg";
import { modelOf, type Car } from "./engine";

const EXTERIOR: Record<string, string> = {
  bmw5: bmw5Img,
  camry: camryImg,
  e63: e63Img,
  f40: f40Img,
  g63: g63Img,
  lc200: lc200Img,
  mark2: mark2Img,
  mustang: mustangImg,
  polo: poloImg,
  priora: prioraImg,
  rs6: rs6Img,
  skyline: skylineImg,
  solaris: solarisImg,
  supra: supraImg,
  tesla: teslaImg,
  urus: urusImg,
  vaz2107: vaz2107Img,
  vesta: vestaImg,
  wert: wertImg,
};

/** WERTOOS BLACK cars reuse the closest matching photos. */
const BLACK_PHOTO: Record<string, string> = {
  "wb-urus": urusImg,
  "wb-g63": g63Img,
  "wb-rs6": rs6Img,
  "wb-e63": e63Img,
  "wb-tesla": teslaImg,
  "wb-supra": supraImg,
  "wb-lc200": lc200Img,
  "wb-f40": f40Img,
};

/** 1–2 photos per car: exterior, plus an interior shot for most cars (stable per car id). */
export function carPhotos(car: Pick<Car, "id" | "modelId">): string[] {
  const ext = EXTERIOR[car.modelId] ?? BLACK_PHOTO[car.modelId] ?? EXTERIOR["vaz2107"]!;
  const hash = [...car.id].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  if (hash % 5 < 2) return [ext];
  const base = modelOf(car.modelId).base;
  return [ext, base >= 9_000_000 ? int_lux : base >= 1_000_000 ? int_mid : int_budget];
}
