# BNB Testnet Receipt Registry Deploy

Jiagon's MVP keeps ether.fi Cash payment verification on Optimism and writes receipt credentials to BNB Smart Chain testnet.

## Admin

The BNB testnet development admin wallet is:

```text
0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
```

This address becomes the registry `owner` and the initial minter. Do not commit private keys, RPC secrets, or wallet seed material.

## Deploy

```bash
export BNB_TESTNET_RPC_URL="https://data-seed-prebsc-1-s1.bnbchain.org:8545"
export BNB_TESTNET_ADMIN="0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9"
export DEPLOYER_PRIVATE_KEY="<local-testnet-deployer-private-key>"

forge script script/DeployReceiptCredentialRegistry.s.sol:DeployReceiptCredentialRegistry \
  --rpc-url "$BNB_TESTNET_RPC_URL" \
  --private-key "$DEPLOYER_PRIVATE_KEY" \
  --broadcast
```

The deployer key only pays gas. The configured admin address owns the deployed registry.

## Configure App

After deployment, add the registry address to `.env.local`:

```bash
BNB_TESTNET_ADMIN=0x046aB9D6aC4EA10C42501ad89D9a741115A76Fa9
BNB_RECEIPT_CONTRACT_ADDRESS=0x...
```

The receipt API still returns `prepared` until server-side broadcast signing is integrated. Only mark a credential `minted` after a real BNB testnet transaction is broadcast and confirmed.
