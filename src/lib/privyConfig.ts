import { type PrivyClientConfig } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

export const jiagonPrivyConfig: PrivyClientConfig = {
  loginMethods: ["wallet", "email", "google"],
  appearance: {
    theme: "light",
    accentColor: "#A9573D",
    showWalletLoginFirst: true,
    walletChainType: "solana-only",
    walletList: [
      "phantom",
      "solflare",
      "backpack",
      "jupiter",
      "detected_solana_wallets",
      "wallet_connect_qr_solana",
    ],
  },
  embeddedWallets: {
    solana: { createOnLogin: "off" },
    showWalletUIs: false,
  },
  externalWallets: {
    solana: { connectors: toSolanaWalletConnectors({ shouldAutoConnect: false }) },
  },
};
