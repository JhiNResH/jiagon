export type MenuItem = {
  id: string;
  name: string;
  amountUsd: string;
  prepMinutes?: number;
  inventory?: number;
  attributes?: Record<string, string | boolean>;
};

export type MerchantProfile = {
  id: string;
  name: string;
  location: string;
  category: string;
  purpose: string;
  fulfillment?: "pickup" | "shipping" | "pickup_or_shipping";
  defaultPrepMinutes?: number;
  defaultShippingDays?: number;
  menu: MenuItem[];
};

export const fallbackMenu: MenuItem[] = [
  { id: "coffee", name: "Coffee", amountUsd: "5.00" },
  { id: "deposit", name: "Reservation deposit", amountUsd: "20.00" },
];

export const merchantProfiles: Record<string, MerchantProfile> = {
  "raposa-coffee": {
    id: "raposa-coffee",
    name: "Raposa Coffee",
    location: "Miami Beach",
    category: "Cafe",
    purpose: "cafe_purchase",
    fulfillment: "pickup",
    defaultPrepMinutes: 8,
    menu: [
      { id: "espresso", name: "Espresso", amountUsd: "4.50", prepMinutes: 4 },
      { id: "iced-latte", name: "Iced latte", amountUsd: "6.50", prepMinutes: 7 },
      { id: "croissant", name: "Butter croissant", amountUsd: "5.25", prepMinutes: 3 },
    ],
  },
  "raposa-shop": {
    id: "raposa-shop",
    name: "Raposa Shop",
    location: "Online",
    category: "Coffee ecommerce",
    purpose: "commerce_purchase",
    fulfillment: "shipping",
    defaultShippingDays: 5,
    menu: [
      {
        id: "rogueai-caramel-latte",
        name: "RogueAI Caramel Latte - Limited Edition",
        amountUsd: "16.00",
        inventory: 24,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "rogueai-caramel-latte-limited-edition",
          type: "ready-to-drink",
          collection: "Nitro",
          flavor: "caramel latte",
          limitedEdition: true,
        },
      },
      {
        id: "matcha-powder-100g",
        name: "Organic Ceremonial Grade Matcha Powder - 100g",
        amountUsd: "32.50",
        inventory: 10,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "organic-ceremonial-grade-matcha-copy",
          type: "matcha",
          format: "powder",
          size: "100g",
        },
      },
      {
        id: "nitro-starter-pack",
        name: "Nitro Cold Brew: Starter Pack (8 Cans)",
        amountUsd: "24.95",
        inventory: 18,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-starter-pack-7-cans",
          format: "8 cans",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          nitro: true,
          varietyPack: true,
        },
      },
      {
        id: "nitro-caramel-latte",
        name: "Nitro Cold Brew: Caramel Latte (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-caramel-latte",
          format: "250ml",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          flavor: "caramel latte",
          nitro: true,
        },
      },
      {
        id: "nitro-cafe-latte",
        name: "Nitro Cold Brew: Cafe Latte (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-cafe-latte",
          format: "250ml",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          flavor: "cafe latte",
          nitro: true,
        },
      },
      {
        id: "nitro-extra-kick",
        name: "Nitro Cold Brew: Extra Kick (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "copy-of-nitro-cold-brew-extra-kick",
          format: "250ml",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          flavor: "extra kick",
          nitro: true,
        },
      },
      {
        id: "nitro-dark-roast",
        name: "Nitro Cold Brew: Classic Dark Roast (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-dark-roast",
          format: "250ml",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          flavor: "classic dark roast",
          roast: "dark roast",
          nitro: true,
        },
      },
      {
        id: "nitro-peach-tea",
        name: "Nitro Cold Brew: Peach Iced Tea (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-peach-iced-tea",
          format: "250ml",
          type: "nitro iced tea",
          flavor: "peach iced tea",
          nitro: true,
        },
      },
      {
        id: "nitro-hibiscus-tea",
        name: "Nitro Cold Brew: Hibiscus Iced Tea (250ml) Caffeine-Free",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-hibiscus-iced-tea-250ml-caffeine-free",
          format: "250ml",
          type: "nitro iced tea",
          flavor: "hibiscus iced tea",
          caffeineFree: true,
          nitro: true,
        },
      },
      {
        id: "nitro-tonic",
        name: "Nitro Cold Brew + Tonic (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-tonic-250ml",
          format: "250ml",
          type: "nitro cold brew",
          flavor: "tonic",
          nitro: true,
        },
      },
      {
        id: "nitro-flat-white",
        name: "Nitro Cold Brew: Flat White (250ml)",
        amountUsd: "17.95",
        inventory: 14,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "nitro-cold-brew-flat-white",
          format: "250ml",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          flavor: "flat white",
          nitro: true,
        },
      },
      {
        id: "ethiopia-yirgacheffe",
        name: "Ethiopia Yirgacheffe Light Roast Specialty Coffee",
        amountUsd: "15.95",
        inventory: 12,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "ethiopia-250g",
          origin: "ethiopia",
          region: "yirgacheffe",
          format: "whole bean",
          type: "beans",
          roast: "light roast",
        },
      },
      {
        id: "sunrise-blend",
        name: "Sunrise Blend Medium-Dark Roast Specialty Coffee",
        amountUsd: "15.95",
        inventory: 12,
        attributes: {
          source: "raposacoffee.com/products.json",
          storefrontHandle: "espresso-blend-dark-roast",
          format: "whole bean",
          type: "beans",
          roast: "medium-dark roast",
          blend: "sunrise",
        },
      },
    ],
  },
  "solyd-cases": {
    id: "solyd-cases",
    name: "Solyd",
    location: "Online",
    category: "Phone accessories",
    purpose: "commerce_purchase",
    fulfillment: "shipping",
    defaultShippingDays: 4,
    menu: [
      {
        id: "iphone-16-black-magsafe",
        name: "Black MagSafe iPhone 16 case",
        amountUsd: "79.00",
        inventory: 12,
        attributes: { color: "black", model: "iphone-16", magsafe: true },
      },
      {
        id: "iphone-16-clear-magsafe",
        name: "Clear MagSafe iPhone 16 case",
        amountUsd: "74.00",
        inventory: 8,
        attributes: { color: "clear", model: "iphone-16", magsafe: true },
      },
      {
        id: "iphone-15-black-case",
        name: "Black iPhone 15 case",
        amountUsd: "59.00",
        inventory: 5,
        attributes: { color: "black", model: "iphone-15", magsafe: false },
      },
    ],
  },
  "theme-park-cafe": {
    id: "theme-park-cafe",
    name: "Theme Park Cafe",
    location: "Theme Park Demo",
    category: "Venue pickup",
    purpose: "venue_pickup_purchase",
    fulfillment: "pickup",
    defaultPrepMinutes: 7,
    menu: [
      { id: "orbit-iced-coffee", name: "Orbit iced coffee", amountUsd: "7.50", prepMinutes: 6 },
      { id: "starport-pretzel", name: "Starport pretzel", amountUsd: "8.00", prepMinutes: 4 },
      { id: "park-snack-combo", name: "Park snack combo", amountUsd: "14.00", prepMinutes: 9 },
    ],
  },
  "mume-taipei": {
    id: "mume-taipei",
    name: "MUME Taipei",
    location: "Taipei",
    category: "Dining",
    purpose: "premium_restaurant_deposit",
    fulfillment: "pickup",
    menu: [
      { id: "deposit", name: "Reservation deposit", amountUsd: "25.00" },
      { id: "sparkling-water", name: "Sparkling water", amountUsd: "8.00" },
      { id: "dessert", name: "Dessert add-on", amountUsd: "14.00" },
    ],
  },
};

export const supportedMerchantIds = Object.freeze(Object.keys(merchantProfiles));

function cloneMenuItem(item: MenuItem): MenuItem {
  return {
    ...item,
    attributes: item.attributes ? { ...item.attributes } : undefined,
  };
}

function cloneMenu(menu: MenuItem[]) {
  return menu.map(cloneMenuItem);
}

function cloneMerchantProfile(profile: MerchantProfile): MerchantProfile {
  return {
    ...profile,
    menu: cloneMenu(profile.menu),
  };
}

export function titleFromSlug(slug: string) {
  const title = slug
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
  return title.trim() || "Untitled Merchant";
}

export function merchantProfileForId(merchantId: string): MerchantProfile {
  const profile = merchantProfiles[merchantId];
  if (profile) {
    return cloneMerchantProfile(profile);
  }
  return {
    id: merchantId,
    name: titleFromSlug(merchantId),
    location: "Local",
    category: "Merchant",
    purpose: "merchant_receipt",
    menu: cloneMenu(fallbackMenu),
  };
}

export function knownMerchantProfileForId(merchantId: string): MerchantProfile | null {
  const profile = merchantProfiles[merchantId];
  return profile ? cloneMerchantProfile(profile) : null;
}
