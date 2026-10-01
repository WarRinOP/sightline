# AGENTS.md — `packages/engine/src/windows/` (Dev 3: Fuad Hasan)

The only folder inside Dev 1's `packages/engine` that you own. The root `AGENTS.md` rules also apply. Everything else in `packages/engine` is off limits. Pull requests touching this folder get the **strictest review** (level L1), because these functions produce numbers users act on.

## What you build

Pure TypeScript functions that find and rank **landing windows**. No DOM, no React, no fetching, no randomness (unless a seed is passed in).

- **Input:** the per-step states that the engine produces for a site (typed arrays; the types come from `packages/contracts`, frozen) and the lander profile (battery hours, minimum continuous sunlight, minimum Earth-contact share, maximum slope).

- **Step 1: run-length encoding** of the per-step states into runs (lit, dark, Earth visible, both).

- **Step 2: constraint search:** keep only windows where the longest dark run is at most the battery hours, the longest continuous sunlight is at least the requirement, and the Earth-contact share over the window meets the minimum.

- **Step 3: scoring** with documented weights, and **Pareto ranking** (a window is Pareto-optimal if no other window is better on every criterion). Mark Pareto windows.

- **Output:** a ranked list of windows (start and end epoch, the stats behind them, a score, a Pareto flag), matching the `WindowResult` type in the contracts.

## Rules specific to this folder

- **Tests first.** Use `vitest` and `fast-check` (property tests): for example "every returned window satisfies every constraint", "no returned window is dominated if flagged Pareto", "results do not change when the input is shuffled in time-irrelevant ways", "an empty or all-dark input returns an empty list without throwing".

- Do not round or smooth numbers: return exact values; the UI formats them.

- Document each formula in a comment with its meaning, in plain words.

- No new packages. Only `vitest` and `fast-check` for tests.

- Until Dev 1 publishes the contracts (target Oct 2), write against small local test fixtures in this folder, then switch to the contract types.

## Done means

All tests pass, nothing outside this folder changed, your log updated, and the pull request shows the test output.
