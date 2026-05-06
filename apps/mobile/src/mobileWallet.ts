import "react-native-get-random-values";
import type { AuthorizationResult } from "@solana-mobile/mobile-wallet-adapter-protocol";
import { transact } from "@solana-mobile/mobile-wallet-adapter-protocol-web3js";

const APP_IDENTITY = {
  name: "Jiagon",
  uri: "https://jiagon.vercel.app",
  icon: "favicon.ico",
};

export type MobileWalletSession = {
  address: string;
  authToken: string;
  walletLabel: string;
};

function addressFromAuthResult(result: AuthorizationResult) {
  const account = result.accounts[0];
  if (!account) throw new Error("No Solana account returned by wallet.");
  return account.address.toString();
}

export async function connectMobileWallet(): Promise<MobileWalletSession> {
  return transact(async (wallet) => {
    const auth = await wallet.authorize({
      chain: "solana:devnet",
      identity: APP_IDENTITY,
    });

    return {
      address: addressFromAuthResult(auth),
      authToken: auth.auth_token,
      walletLabel: auth.wallet_uri_base || "Solana wallet",
    };
  });
}
