# CLAUDE.md

See also `AGENTS.md` for project rules (ownership, Forge restrictions, demo fixtures).

## Git workflow

- After every change, commit and push directly to the current branch (`feat/product-experience`) without asking for confirmation.
- Before pushing, run the frontend build, unit tests and browser tests (per `AGENTS.md`); push only if they pass, otherwise report the failure.
- Pull first if the remote branch has moved ahead.
