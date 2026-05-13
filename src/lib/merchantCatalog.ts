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
        id: "accelerate-blend-250g",
        name: "Accelerate Blend 250g",
        amountUsd: "18.00",
        inventory: 18,
        attributes: {
          format: "whole bean",
          type: "beans",
          roast: "medium roast",
          blend: "accelerate",
          size: "250g",
        },
      },
      {
        id: "sunrise-blend-250g",
        name: "Sunrise Blend 250g",
        amountUsd: "19.00",
        inventory: 14,
        attributes: {
          format: "whole bean",
          type: "beans",
          roast: "medium roast",
          blend: "sunrise",
          size: "250g",
        },
      },
      {
        id: "ethiopia-yirgacheffe-250g",
        name: "Ethiopia Yirgacheffe 250g",
        amountUsd: "22.00",
        inventory: 9,
        attributes: {
          origin: "ethiopia",
          region: "yirgacheffe",
          format: "whole bean",
          type: "beans",
          roast: "medium roast",
          size: "250g",
        },
      },
      {
        id: "nitro-cold-brew-starter-pack",
        name: "Nitro Cold Brew Starter Pack",
        amountUsd: "32.00",
        inventory: 6,
        attributes: {
          format: "starter pack",
          type: "nitro cold brew",
          coffeeStyle: "cold brew",
          nitro: true,
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
