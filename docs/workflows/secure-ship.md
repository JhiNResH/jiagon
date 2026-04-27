# Secure Ship Workflow

Use this workflow for every Jiagon change that touches contracts, proofs, credentials, receipt verification, minting, attestations, or security-sensitive API/auth logic.

## Trigger

Run this workflow when changing any of:

- Solidity contracts, tests, deployment scripts, or Foundry config.
- Receipt credential schema or proof-level semantics.
- `/api/receipts/*`, `/api/etherfi/*`, or agent proof APIs.
- OP spend scan, BNB credential, Greenfield pointer, mint/prepare/attest flows.
- Ownership, auth, session, wallet, or safe-binding logic.
- UI copy that states whether a receipt is prepared, minted, verified, or onchain.

## Required order

1. Create a scoped `codex/*` branch.
2. Implement one logical change per PR.
3. Add unit tests and fuzz tests when contracts are touched.
4. Run local verification:
   - `pnpm build`
   - `forge test -vvv`
5. Run Pashov Solidity audit skill on in-scope contracts.
6. Fix or document every credible audit finding.
7. Ask another agent for code review.
8. Fix or document every credible review finding.
9. Keep branch commits understandable; WIP/fix commits are acceptable during iteration.
10. Push branch and open a PR.
11. Merge with squash so `main` receives one commit per PR.
12. Merge only after explicit approval.

## Commit and PR policy

- Prefer **one PR = one logical change**.
- Prefer **one squash commit on `main` per PR**.
- Branch history may contain multiple commits while implementing, fixing audit findings, fixing code review, or updating docs.
- Do not force every PR branch to contain exactly one commit if doing so hides useful review context.
- Before merge, the PR must be coherent enough that a single squash commit message accurately describes the entire change.
- If two changes cannot share one accurate squash commit message, split them into separate PRs.
- Reverting should be possible by reverting the PR's squash commit from `main`.

## Pass criteria

- `pnpm build` passes for app/API changes.
- `forge test -vvv` passes for contract changes.
- Pashov audit has no unresolved credible findings.
- Independent code review has no unresolved blocking findings.
- `git diff --check` passes.
- PR contains one logical change and is intended to be squash-merged.
- PR body lists verification and any residual risks.

## Fail criteria

Do not commit or open a PR if any of these remain unresolved:

- UI or API claims a mock/prepared credential is a real onchain mint.
- API trusts client-supplied proof ownership without server-side verification.
- A credential can be created without a verified source proof.
- Contract duplicate-prevention does not match the app's receipt identity.
- Private keys, RPC secrets, auth tokens, or sensitive receipt metadata are committed.
- A credible audit or review finding is left unfixed without explicit documentation.

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

## Current receipt credential assumptions

- `prepared` means OP spend proof was verified and BNB/Greenfield payloads are ready.
- `minted` means a real BNB testnet or mainnet transaction was broadcast and confirmed.
- Until a real registry write is integrated, UI and API must say `prepared`, not `minted`.
- Current proof level for prepare-only credentials is at most `C` unless ownership is authenticated server-side.
- Source receipt identity is `source chain + provider + tx hash + log/event identity`, not tx hash alone.
