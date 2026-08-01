# CI and releasing

Four workflows. Only one of them you trigger by hand.

| Workflow         | File                                                     | Runs when                         | Does                                                                                                       |
| ---------------- | -------------------------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| CI               | [`ci.yml`](.github/workflows/ci.yml)                     | every push to `main`, every PR    | lint, typecheck, prettier, build, unit tests on React 18 **and** 19, Playwright on Windows / macOS / Linux |
| Publish to npm   | [`npm-publish.yml`](.github/workflows/npm-publish.yml)   | a GitHub **Release** is published | re-runs the checks, then `npm publish` over OIDC                                                           |
| Deploy Storybook | [`pages.yml`](.github/workflows/pages.yml)               | every push to `main`              | builds Storybook, deploys to GitHub Pages                                                                  |
| Record demo GIFs | [`record-demos.yml`](.github/workflows/record-demos.yml) | manual only                       | re-records `docs/*.gif` and commits them                                                                   |

---

## Publishing a new version

Three commands. **Do not run `npm publish` locally** — the release workflow does
it, and it is the only path that produces a provenance attestation.

```bash
# 1. Bump the version. Commits and tags in one step.
npm version patch          # or minor / major

# 2. Push the commit and its tag.
git push --follow-tags

# 3. Create the Release. This is what triggers the publish.
gh release create "v$(node -p "require('./package.json').version")" --generate-notes
```

That last step can equally be done from the GitHub UI: **Releases → Draft a new
release → pick the tag you just pushed → Publish release**.

Watch it land:

```bash
gh run watch
```

The workflow re-runs lint, typecheck, tests and build before publishing, so a
broken release fails at the gate rather than on npm.

### Which bump?

|                     | When                                            |
| ------------------- | ----------------------------------------------- |
| `npm version patch` | bug fixes, docs, internals — no API change      |
| `npm version minor` | new props, new exports, anything additive       |
| `npm version major` | changed or removed public API, changed defaults |

Changing a default counts as breaking. The `inputMode` default going from
`decimal` to `text` is the kind of change that warrants a major once the package
is past `0.x`.

### Pre-releases

```bash
npm version prerelease --preid=beta     # 0.2.0 -> 0.2.1-beta.0
git push --follow-tags
gh release create v0.2.1-beta.0 --generate-notes --prerelease
```

Marking the GitHub Release as a pre-release is what keeps it off `latest`, so
`npm install react-financial-input` stays on the stable version.

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
The version in `package.json` already exists on npm. Bump it — npm versions are
immutable.

**Publish workflow did not run**
It triggers on a _published Release_, not on a pushed tag. Pushing a tag alone
does nothing. Check **Releases**, not just tags.

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
