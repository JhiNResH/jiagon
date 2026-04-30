# CodeRabbit Follow-up Workflow

Use this workflow after opening or updating a PR. The goal is simple: do not merge while CodeRabbit has unresolved actionable feedback, pending review state, failing checks, or unresolved review threads.

## Trigger

Run this workflow whenever:

- A PR is opened.
- A PR receives a new CodeRabbit comment or review.
- New commits are pushed after CodeRabbit already reviewed the PR.
- A check named `CodeRabbit` is pending, failed, or changed state.

## Required Inputs

- PR number.
- Repo name, normally `JhiNResH/jiagon`.
- Local branch for the PR.

## Triage

1. Confirm the local branch is clean:
   ```bash
   git status --short --branch
   ```
2. Fetch PR checks:
   ```bash
   gh pr checks <PR_NUMBER>
   gh pr view <PR_NUMBER> --json url,state,isDraft,mergeable,reviewDecision,statusCheckRollup,headRefOid
   ```
3. Fetch CodeRabbit comments and review threads:
   ```bash
   gh pr view <PR_NUMBER> --comments
   ```
4. If using the GitHub app connector, also inspect inline review threads and treat every unresolved non-outdated CodeRabbit thread as actionable until proven otherwise.

## Fix Loop

Repeat this loop until the PR is fully clean.

1. Classify each CodeRabbit item:
   - **Fix now:** security, correctness, data integrity, user-blocking UX, build/test, merge blocker.
   - **Verify first:** likely false positive or already fixed in a newer commit.
   - **Document only:** accepted residual risk or intentionally deferred behavior. This requires explicit rationale in the PR.
2. For every **Fix now** item:
   - Reproduce or inspect the relevant code path.
   - Make the smallest coherent change.
   - Do not silence the finding with copy-only changes unless the issue is actually copy-only.
3. For every **Verify first** item:
   - Check current code, not only the diff that CodeRabbit quoted.
   - If already fixed, leave it alone and let CodeRabbit mark it resolved on the next run.
   - If still true, fix it.
4. Run focused verification:
   - `pnpm build` for app/API/UI changes.
   - `NO_DNA=1 anchor build` for Solana program/client changes.
   - `forge test` for Solidity/contracts.
   - `git diff --check` before committing.
5. Commit the fixes:
   ```bash
   git add <changed files>
   git commit -m "Resolve CodeRabbit review"
   git push origin <BRANCH>
   ```
6. Wait for checks:
   ```bash
   gh pr checks <PR_NUMBER> --watch --interval 10
   ```
7. Re-fetch review threads and comments.
8. Continue the loop if CodeRabbit posts new actionable items.

## Exit Criteria

The PR is ready to merge only when all are true:

- `gh pr view` reports `mergeable: MERGEABLE`.
- CodeRabbit check is `SUCCESS` or absent with no active review in progress.
- Vercel and other required checks pass.
- Every CodeRabbit review thread is resolved or outdated.
- There are no unresolved actionable issue comments.
- Local branch is clean and pushed.
- Required local verification passed and is listed in the PR or final status.

## Merge Policy

- Prefer squash merge for PR branches with multiple fix commits.
- Do not merge while CodeRabbit says `Review in progress`, even if Vercel passed.
- Do not merge if a CodeRabbit comment is only partially addressed.
- After merge, confirm:
  ```bash
  gh pr view <PR_NUMBER> --json state,mergedAt,mergeCommit,url
  git status --short --branch
  ```

## Standard Status Message

Use this summary format when reporting back:

```text
CodeRabbit follow-up complete.

Fixed:
- <short list>

Verification:
- pnpm build: pass
- NO_DNA=1 anchor build: pass, if applicable
- forge test: pass, if applicable
- git diff --check: pass

PR:
- CodeRabbit: pass
- Vercel: pass
- Review threads: resolved
- Mergeable: MERGEABLE
```

## Non-goals

- Do not automatically accept CodeRabbit suggestions without checking current code.
- Do not expand scope beyond the review finding unless it is necessary to fix the issue safely.
- Do not mix unrelated product changes into a CodeRabbit follow-up commit.
