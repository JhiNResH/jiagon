import Constants from "expo-constants";

type Extra = {
  apiBaseUrl?: string;
  privyAppId?: string;
  privyClientId?: string;
  solanaCluster?: string;
};

const extra = (Constants.expoConfig?.extra || {}) as Extra;

export const jiagonConfig = {
  apiBaseUrl: extra.apiBaseUrl || "https://jiagon.vercel.app",
  privyAppId: extra.privyAppId || "",
  privyClientId: extra.privyClientId || "",
  solanaCluster: extra.solanaCluster || "devnet",
};
