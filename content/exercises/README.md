# Exercises

One YAML file per exercise: `<track>/<lesson-id>/<exercise-id>.yaml`. The format and rules are in `docs/CONTENT_GUIDE.md` §5 and `src/features/exercises/schema.ts`. Every numeric or symbolic exercise carries a Python `verify` block that `pnpm content:verify` runs in CI.

Empty on purpose until the site is finished (content is a separate task).
