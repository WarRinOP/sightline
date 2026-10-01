# Logs

How we keep records (rules in `AGENTS.md` §5 and `CLAUDE.md` §3):

- **Dev 1** (team lead): `docs/progress/PROGRESS.md` (status and session log), `REMAINING.md` (backlog), `DECISIONS.md` (decisions).
- **Dev 2:** [DEV2_LOG.md](DEV2_LOG.md). **Dev 3:** [DEV3_LOG.md](DEV3_LOG.md). Each log is append-only (newest on top), edited only by its owner, and updated in the same pull request as the work.
- Devs 2 and 3 never edit PROGRESS, REMAINING or DECISIONS. Dev 1 reads the two logs at the start of each session and folds the results into those three files, so nobody edits the same file.
