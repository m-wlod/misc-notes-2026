# End-to-end tests

Playwright specs, run against the production build on desktop and mobile viewports. `pnpm test:e2e`.

## Visual regression (Phase 20b)

`visual.spec.ts` compares full-page screenshots of key pages (both themes, desktop and phone) with the baselines in `e2e/__screenshots__/`. Baselines are Linux screenshots, so the spec runs only in CI's `visual` job (`VISUAL=1`); locally it is skipped.

- **New page in the spec:** the job writes the missing baseline, uploads it as the `visual-baselines` artifact and fails. Review the images, then commit them: `gh run download <run-id> -n visual-baselines -D e2e/__screenshots__`.
- **Intended visual change:** run the CI workflow from the Actions tab with "Re-take all visual baselines" (workflow_dispatch on your branch), download the artifact the same way and commit it.
