export type SolanaOwnerLinkMessageInput = {
  sourceReceiptHash: string;
  solanaOwner: string;
};

export function buildSolanaOwnerLinkMessage({
  sourceReceiptHash,
  solanaOwner,
}: SolanaOwnerLinkMessageInput) {
  return [
    "Jiagon Solana credit mirror",
    `Source receipt: ${sourceReceiptHash}`,
    `Solana owner: ${solanaOwner}`,
  ].join("\n");
}
