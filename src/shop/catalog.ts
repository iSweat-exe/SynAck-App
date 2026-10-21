/** What the shop sells. For now it is a window on the future: nothing can be bought yet. */

export type ShopCategory = "themes" | "bonus" | "profile";

/** The drawing of an item, in `components/ShopArt.tsx`. */
export type ShopArtId =
  | "double-xp"
  | "double-coins"
  | "freeze"
  | "hint"
  | "theme-mint"
  | "theme-ocean"
  | "theme-sun"
  | "frame"
  | "title";

export interface ShopItem {
  id: string;
  category: ShopCategory;
  art: ShopArtId;
  name: string;
  description: string;
  /** In coins. */
  price: number;
}

export const CATEGORY_LABEL: Record<ShopCategory, string> = {
  themes: "Thèmes de l'application",
  bonus: "Bonus",
  profile: "Profil",
};

/** The order the shelves are shown in. */
export const CATEGORIES: readonly ShopCategory[] = ["themes", "bonus", "profile"];

export const ITEMS: readonly ShopItem[] = [
  {
    id: "theme-mint",
    category: "themes",
    art: "theme-mint",
    name: "Thème Menthe",
    description: "Une version fraîche de l'application, aux verts doux.",
    price: 200,
  },
  {
    id: "theme-ocean",
    category: "themes",
    art: "theme-ocean",
    name: "Thème Océan",
    description: "Des bleus profonds, pour coder à la tombée de la nuit.",
    price: 200,
  },
  {
    id: "theme-sun",
    category: "themes",
    art: "theme-sun",
    name: "Thème Soleil",
    description: "Des jaunes chauds, comme un après-midi d'été.",
    price: 200,
  },
  {
    id: "double-xp",
    category: "bonus",
    art: "double-xp",
    name: "Double XP",
    description: "Deux fois plus d'XP à chaque réussite, pendant 24 heures.",
    price: 80,
  },
  {
    id: "double-coins",
    category: "bonus",
    art: "double-coins",
    name: "Double pièces",
    description: "Deux fois plus de pièces à chaque réussite, pendant 24 heures.",
    price: 100,
  },
  {
    id: "freeze",
    category: "bonus",
    art: "freeze",
    name: "Gel de série",
    description: "Protège ta série de jours si tu rates une journée.",
    price: 50,
  },
  {
    id: "hint",
    category: "bonus",
    art: "hint",
    name: "Indice",
    description: "Un coup de pouce sur un exercice qui te résiste.",
    price: 30,
  },
  {
    id: "frame",
    category: "profile",
    art: "frame",
    name: "Cadre doré",
    description: "Un cadre doré autour de ton avatar.",
    price: 150,
  },
  {
    id: "title",
    category: "profile",
    art: "title",
    name: "Titre de profil",
    description: "Un titre sous ton nom : Curieux, Acharné, Explorateur…",
    price: 120,
  },
];

/** The coins still missing to buy an item, or 0 when the balance is enough. */
export function missingCoins(item: ShopItem, balance: number): number {
  return Math.max(0, item.price - balance);
}
