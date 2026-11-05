# Contributing

## Workflow

1. Branch from `main`: `feature/<short-name>`, `fix/<short-name>` or `chore/<short-name>`.
2. Make the change. Keep a pull request to one concern.
3. Run `npm run verify`. It must pass.
4. Open a pull request against `main` and fill in the template. CI must be green.
5. Merge after review. Don't push directly to `main`.

## Commit messages

[Conventional Commits](https://www.conventionalcommits.org/):

```
feat(calling): open the outcome sheet when a call ends
fix(leads): keep the selected tab after refresh
docs: describe the activity-form payload
chore(deps): update expo to 56.0.13
```

Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`. Scope is optional: `auth`,
`leads`, `calling`, `native`, `api`.

## Code standards

- TypeScript strict. No `any` without a comment explaining why.
- Logic with rules (dates, numbers, call states, mapping API data) goes in a pure function with a
  `*.test.ts` next to it.
- Screens use hooks from `src/features/*`, never `fetch` directly.
- Text shown to agents is plain and specific. Errors say what happened and what to do next.
- Native changes in `modules/sim-dialer` keep the Kotlin, Swift and `index.ts` contracts identical.
- No new Android permissions without discussion in the PR. `READ_CALL_LOG` is not allowed.
- Never commit secrets, `.env`, keystores or provisioning files.
- Never paste real customer names or phone numbers into issues, PRs, tests or logs.

## Documentation

Update the matching file in `docs/` with the change, and add a line under _Unreleased_ in
`CHANGELOG.md`. A decision that changes direction gets a new record in `docs/decisions/`.

## Backend changes

This repo is the mobile app only. If a change needs something new from Compass, open an issue
describing the endpoint and coordinate it with the Compass backend owners. Don't work around a
missing endpoint in the app.
