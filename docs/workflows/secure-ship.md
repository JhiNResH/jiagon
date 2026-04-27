# Secure Ship Workflow

Use this workflow for every contract-facing Jiagon change.

## Required order

1. Create a scoped `codex/*` branch.
2. Implement one atomic change.
3. Add unit tests and fuzz tests.
4. Run local verification:
   - `pnpm build`
   - `forge test`
5. Run Pashov Solidity audit skill on in-scope contracts.
6. Fix or document every credible audit finding.
7. Ask another agent for code review.
8. Fix or document every credible review finding.
9. Create one atomic commit.
10. Push branch and open a PR.
11. Merge only after explicit approval.

## Contract checklist

- No plaintext private keys.
- Constructor accepts admin owner instead of assuming deployer.
- Access control is explicit and tested.
- Minter role is trusted infrastructure only; do not grant it permissionlessly.
- Ownership transfer intentionally rotates the owner-minter role; other explicitly granted minters remain unchanged.
- Duplicate receipt minting is prevented.
- Source transaction hash and data hash cannot be zero.
- MVP source receipt hashes must include source chain, provider, transaction hash, and log/event identity.
- Public hashes and storage pointers must be privacy-preserving commitments; never publish raw receipt metadata onchain.
- Sensitive receipt details stay offchain; chain stores hash/pointer.
- Mainnet deployment requires audit before use.
