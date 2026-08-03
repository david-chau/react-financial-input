# CI and releasing

Four workflows. Releasing is automated — you never run `npm publish`, and you
never bump a version by hand.

| Workflow         | File                                                     | Runs when                      | Does                                                                                                       |
| ---------------- | -------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| CI               | [`ci.yml`](.github/workflows/ci.yml)                     | every push to `main`, every PR | lint, typecheck, prettier, build, unit tests on React 18 **and** 19, Playwright on Windows / macOS / Linux |
| Publish to npm   | [`npm-publish.yml`](.github/workflows/npm-publish.yml)   | every push to `main`           | maintains the release PR; on merging it, tags, releases and publishes over OIDC                            |
| Deploy Storybook | [`pages.yml`](.github/workflows/pages.yml)               | every push to `main`           | builds Storybook, deploys to GitHub Pages                                                                  |
| Record demo GIFs | [`record-demos.yml`](.github/workflows/record-demos.yml) | manual only                    | re-records `docs/*.gif` and commits them                                                                   |

---

## Releasing

Merge your work to `main` as normal. A bot keeps an open pull request titled
**`chore(main): release x.y.z`**, updating it as commits land:

```
merge  fix: keep the merged ref stable      ->  release PR now says 0.2.1
merge  feat: handle paste and drop          ->  release PR now says 0.3.0
```

**Merging that PR is the release.** It bumps `package.json`, writes
`CHANGELOG.md`, tags, creates the GitHub Release, and publishes to npm — all in
[`npm-publish.yml`](.github/workflows/npm-publish.yml).

So: merge features whenever you like, and ship when you want to by merging the
release PR. Nothing publishes until you do.

```bash
gh pr list                                  # the release PR is in here
gh run watch                                # watch the publish
npm view react-financial-input version      # confirm
```

### Approve the workflows first, then merge

The release PR is opened by `github-actions[bot]`, and the repository's Actions
approval policy was `first_time_contributors` — which counts the bot as one. So
the release PR arrives with **1 workflow awaiting approval** and six required
checks stuck on "Expected — Waiting for status to be reported". In that order:

1. **Approve workflows to run.** The checks cannot report until the run starts.
2. **Squash and merge.** The button stays grey until they are green.

Not the red _Merge without waiting for requirements (bypass rules)_ checkbox.
It is there for an emergency, and it ships a release nothing verified.

> **Approving a workflow run is not approving a pull request.** They are
> different permissions that happen to share a word. A solo committer cannot
> review-approve their own PR — which is exactly why branch protection here
> requires status checks rather than a review — but the workflow button is an
> Actions maintainer action with no such restriction. Click it on your own PRs.

The policy has since been relaxed so step 1 should stop appearing:

```bash
gh api repos/david-chau/react-financial-input/actions/permissions/fork-pr-contributor-approval
# {"approval_policy":"first_time_contributors_new_to_github"}
```

Fork PRs from accounts new to GitHub still need approval. Changing the policy
does **not** release a run that is already pending — approve that one by hand.

### A release pull request goes stale the moment anything else merges

The release pull request is a snapshot. It says "0.6.2" because of what was
pending **when the bot last wrote it** — and merging anything else afterwards
does not retitle it. Merge the two out of order and the tag lands on top of
commits the release does not describe:

```
#20 docs:  merged   ->  bot opens "release 0.6.2"   (patch, docs only)
#22 feat:  merged   ->  bot has not re-run yet
#21        merged   ->  v0.6.2 tagged ON TOP of the feat
                        the feature ships in a patch, absent from the changelog
```

Worse, it is not self-correcting. Everything up to `v0.6.2` now counts as
released, so the bot will never revisit that feature — the next release starts
from the tag.

**Before merging a release pull request, check its title still matches what is
on `main`.** If commits have landed since, wait for the bot's push to update it:

```bash
gh pr view <release-pr> --json title,updatedAt
git log --oneline v$(gh pr view <release-pr> --json title -q .title | grep -oE '[0-9]+\.[0-9]+\.[0-9]+')..origin/main
```

An empty second command is what you want. Anything listed is a commit the
release will swallow without describing.

This happened once, to 0.6.2. Since npm versions are immutable, the fix was to
write the missing entries into `CHANGELOG.md` by hand rather than republish.

### The version comes from your commit messages

The bump is derived from [Conventional Commits](https://www.conventionalcommits.org):

| Commit prefix                           | Bump                                       |
| --------------------------------------- | ------------------------------------------ |
| `fix:`                                  | patch — `0.2.0` → `0.2.1`                  |
| `feat:`                                 | minor — `0.2.0` → `0.3.0`                  |
| `feat!:` or a `BREAKING CHANGE:` footer | minor while `0.x`, major once past `1.0.0` |
| `docs:` `chore:` `test:` `ci:`          | no release on their own                    |

> **Squash merges use the pull request title as the commit message.** A PR
> titled "Chore/release script" produces a commit the bot cannot parse and no
> version bump. Title PRs the same way you would a commit: `fix: …`, `feat: …`.

### Publishing is not on `on: release`

It would be the obvious place, but a Release created with `GITHUB_TOKEN`
[does not trigger further workflows](https://github.com/orgs/community/discussions/25281).
That is why `npm-publish.yml` both creates the release and publishes, gated on
release-please's `release_created` output. The alternative is a personal access
token, which would put a long-lived secret back in the repo.

The publish job checks out the **tag**, not the commit that triggered the run —
the version bump is a commit the bot pushes, so the triggering commit still has
the old version in `package.json`.

---

## Why there is no `NPM_TOKEN`

Publishing uses **npm Trusted Publishing (OIDC)**. The workflow proves its
identity to npm directly, so there is no long-lived secret in the repository to
leak, and npm attaches a provenance attestation showing which commit and workflow
produced the tarball.

This is already configured. The one-time setup, for reference:

1. The package had to exist first — trusted publishers are configured on a
   package's settings page, so `0.1.0` was published manually. This is a
   [known npm bootstrap limitation](https://github.com/npm/cli/issues/8544).
2. On npmjs.com → the package → **Settings → Trusted Publisher → GitHub Actions**:

   | Field                | Value                   |
   | -------------------- | ----------------------- |
   | Organization or user | `david-chau`            |
   | Repository           | `react-financial-input` |
   | Workflow filename    | `npm-publish.yml`       |
   | Environment          | _(blank)_               |

Requirements the workflow already satisfies: `permissions: id-token: write`,
npm ≥ 11.5.1 (it installs the latest), and Node ≥ 22.14.0. If Node is ever pinned
lower, OIDC silently falls back to token auth and the publish fails.

### Optional hardening

npm has a **Disallow tokens** setting per package. Turning it on means OIDC from
this workflow is the _only_ way to publish, so a leaked token cannot republish.
It does not affect trusted publishers.

---

## Troubleshooting

**`403 Forbidden … Two-factor authentication or granular access token`**
You are publishing locally with a token in `~/.npmrc`. Granular access tokens
[can no longer publish](https://github.blog/changelog/2026-07-31-restricting-npm-bypass-2fa-granular-access-tokens/)
under 2FA, and npm cannot prompt for an OTP when authenticating with a token. Let
the Release workflow publish instead. If you genuinely must publish by hand,
remove the `_authToken` line from `~/.npmrc`, then `npm login --auth-type=web`,
which creates a session that _can_ prompt for an OTP.

**`403 … cannot publish over previously published version`**
The version in `package.json` already exists on npm. Normally impossible now,
since release-please owns the bump — it means something published by hand.

**No release PR appeared after merging**
Nothing on `main` since the last release parsed as a releasable Conventional
Commit. `docs:`, `chore:`, `test:` and `ci:` do not trigger a release on their
own. Most often the culprit is a squash merge whose PR title was not
conventional, so check the merge commit message on `main`.

**Release PR merged but nothing published**
Look at the `publish` job in the run. It is skipped unless release-please
reports `release_created`, and it checks out the tag rather than the triggering
commit — if the checkout ref is wrong, the tarball carries the previous version.

**`.release-please-manifest.json` drifts from `package.json`**
The manifest is the bot's record of the last released version. If someone
publishes by hand, update the manifest to match or the next release PR proposes
a version that already exists.

**Storybook deployed but assets 404**
Pages serves a project site from `/react-financial-input/`. `pages.yml` passes
`STORYBOOK_BASE_PATH` from `actions/configure-pages` for exactly this reason. If
it breaks, that is the wire to check.

**Pages deploy fails on `configure-pages`**
Repo → **Settings → Pages → Source** must be **GitHub Actions**.

**`record-demos` fails to push**
Repo → **Settings → Actions → General → Workflow permissions** must be
**Read and write permissions**.

**Windows or macOS e2e fails but local passes**
That is the matrix doing its job — modifier keys and engine behaviour genuinely
differ. Download the `playwright-report-<os>` artifact from the run to see the
trace.
