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
    return { ...profile, menu: [...profile.menu] };
  }
  return {
    id: merchantId,
    name: titleFromSlug(merchantId),
    location: "Local",
    category: "Merchant",
    purpose: "merchant_receipt",
    menu: [...fallbackMenu],
  };
}

export function knownMerchantProfileForId(merchantId: string): MerchantProfile | null {
  const profile = merchantProfiles[merchantId];
  return profile ? { ...profile, menu: [...profile.menu] } : null;
}
