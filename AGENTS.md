# Schtart

SvelteKit 3 + Svelte 5 + TypeScript web app on Node 26 and pnpm, `adapter-node`, shipped as one Docker container. Domain language: `GLOSSARY.md`; decisions: `docs/adr/` (both created on demand).

## Workflow (mandatory)

- Every change, however small, follows the process; no naked implementation.
- Before any edit, read `docs/agents/workflow.md`, `docs/agents/issue-tracker.md`, `docs/agents/domain.md`, and the relevant `GLOSSARY.md` terms and ADRs.
- Route through the skills named in `workflow.md`; load each with the skill tool. Work happens under a tracked issue; a ready ticket runs through `implement`.
- A user request ("fix X") selects the work, not the route. Settled work skips planning ceremony only; it keeps its ticket and `implement`.
- If the issue is not `ready-for-agent`, or a required skill will not load: stop and tell the user.
- Record decisions in the issue, spec, ADR or `GLOSSARY.md`, not chat only.

## Commands

Run from the repo root.

- `pnpm dev`: dev server
- `pnpm check`: svelte-check + types
- `pnpm test`: Vitest, single run (`pnpm test:unit` watches)
- `pnpm build` / `pnpm preview`: production build / serve it
- `docker build -t schtart . && docker run -p 3000:3000 schtart`

## Architecture

- API: `src/routes/api/**/+server.ts`. Page data: `+page.server.ts` `load`. Shared code: `src/lib`.
- Tests sit beside the code as `*.spec.ts`.

## Constraints

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect`); `runes: true` is enforced in `vite.config.ts`.
- Config lives in `vite.config.ts`; SvelteKit 3 has no `svelte.config.js`.
- Add dependencies only when the task needs them.

## Agent implementation guidance

- Prefer maintained packages to minimize app-owned code. Keep app code focused on domain behavior and thin integration glue; avoid redundant wrappers, speculative abstractions, and recreating package capabilities. Add dependencies when they meaningfully reduce implementation and maintenance burden.

## Delivery

- Mainline flow. `main` is protected; never commit or push to it.
- Branch from `origin/main`: `feature/<topic>`, `fix/<topic>`; spec children use `ticket/<issue-number>`, landed on the spec's `feature/<topic>`.
- Commits carry `Refs #N`; the completing commit carries `Closes #N`. A parent closes with its last child.
- The agent opens the PR (`pr` skill, `gh pr create --base main`) after checks and review; humans review and merge.
- The `initial` branch preserves the blank repository baseline; new work follows the flow above.

## GPG signing

- Keep GPG signing enabled for every commit and push. During agentic work, make the first normal signed attempt without prior confirmation; it may succeed if the user's key is already unlocked.
- If signing waits for the user's key unlock or times out, preserve the changes and pause. Retry only after the user confirms the key is unlocked.

## Verification

- Run the smallest meaningful check for changed behavior; prefer focused tests and checks for affected boundaries.
- Add regression coverage for meaningful runtime behavior changes. Pure styling, copy, and documentation edits generally need no new behavioral tests; use existing contrast or accessibility checks when they protect a touched invariant.
- Run `pnpm check` for Svelte/TypeScript changes and `pnpm build` for production, adapter, or bundling changes. Run integration, browser, database, and Docker suites only when their boundaries change or the issue requires them.
- Run aggregate suites at coherent behavior or dependency checkpoints, not after every edit or push. Before handoff, run affected coverage and relevant type/build checks; don't rerun unchanged passing suites unless diagnosing a failure or filling missing evidence.
- Treat configured GitHub Actions as the aggregate gate; local pushes alone don't justify rerunning the full CI suite.

## Agent skills

### Issue tracker

Issues live in GitHub Issues (jonstelly/schtart) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-label vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `GLOSSARY.md` and `docs/adr/`. See `docs/agents/domain.md`.
