# Required CI and `main` protection

The workflow in `.github/workflows/ci.yml` exposes one stable check named:

```text
required-ci
```

It runs for pull requests, merge-queue groups, and pushes to `main`. The job
covers Web lint/build/tests, Chromium E2E, real PostgreSQL migrations, Redis
queue persistence, dependency audits, Compose validation, the runner image
build, the full Docker verdict matrix, and the hidden-manifest isolation
regression. CodeQL runs independently on pull requests, pushes to `main`, and
weekly.

## Repository ruleset

Configure a branch ruleset for the default branch with these settings:

1. Target branch: `main`.
2. Require a pull request before merging.
3. Require status checks to pass.
4. Required check: `required-ci`.
5. Require branches to be up to date before merging.
6. Block force pushes and branch deletion.
7. Apply the rule to repository administrators unless an emergency bypass actor
   is intentionally configured.

GitHub only offers the `required-ci` check after the workflow has completed at
least once on the repository. Do not rename the job without updating the
ruleset, because required-check names are repository settings rather than files
stored in Git.

## Local parity

```bash
npm ci
npm run lint
npm test
npx playwright install chromium
npm run test:e2e
npm --prefix services/api ci
npm --prefix services/api test
npm --prefix judge ci
npm --prefix judge test
docker compose --env-file .env.windows.example --profile all config --quiet
docker build -f judge/Dockerfile.runner -t algoquest-runner:cpp14 judge
JUDGE_DOCKER_TEST=1 npm --prefix judge test
```
