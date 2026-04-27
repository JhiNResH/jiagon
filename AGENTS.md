<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:jiagon-secure-ship-workflow -->
# Jiagon Secure Ship Workflow

For every contract-facing, proof-facing, credential-facing, or security-sensitive change, follow [`docs/workflows/secure-ship.md`](docs/workflows/secure-ship.md).

This includes changes to:

- Solidity contracts or deployment scripts.
- Receipt credential schemas.
- `/api/receipts/*`, `/api/etherfi/*`, or agent proof APIs.
- Mint, attest, verify, scan, or proof-level logic.
- Auth/session ownership checks around receipts or credentials.

Required gates before finalizing:

1. Add or update unit tests and fuzz tests where contracts are touched.
2. Run `forge test -vvv` for contract changes.
3. Run `pnpm build` for app/API changes.
4. Run the Pashov Solidity audit skill for in-scope Solidity changes.
5. Fix or explicitly document every credible audit finding.
6. Ask another agent for code review before commit.
7. Fix or explicitly document every credible review finding.
8. Make an atomic commit.
9. Push and open a PR.
10. Merge only after explicit user approval.

Never mark mock, prepared, simulated, or locally generated credentials as real onchain mints. UI and API copy must distinguish `prepared` from `minted`.
<!-- END:jiagon-secure-ship-workflow -->
