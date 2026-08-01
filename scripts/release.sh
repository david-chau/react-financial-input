#!/usr/bin/env bash
#
# Ships a new version: bump, push, create the GitHub Release.
#
# Publishing itself happens in CI — the Release event triggers
# .github/workflows/npm-publish.yml, which publishes over OIDC with provenance.
# This script never runs `npm publish`.
#
#   ./scripts/release.sh              # patch
#   ./scripts/release.sh minor
#   ./scripts/release.sh major
#   ./scripts/release.sh prerelease beta
#   ./scripts/release.sh patch --dry-run
#
set -euo pipefail

cd "$(dirname "$0")/.."

BUMP="patch"
PREID="beta"
DRY_RUN=false
ASSUME_YES=false
RELEASE_BRANCH="${RELEASE_BRANCH:-main}"

for arg in "$@"; do
  case "$arg" in
    patch | minor | major | prerelease) BUMP="$arg" ;;
    --dry-run) DRY_RUN=true ;;
    -y | --yes) ASSUME_YES=true ;;
    --*) echo "Unknown flag: $arg" >&2; exit 1 ;;
    *) PREID="$arg" ;;
  esac
done

step() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }
fail() { printf '\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }

# ----------------------------------------------------------------- preflight

step "Preflight"

command -v gh >/dev/null 2>&1 || fail "gh is not installed. brew install gh"
gh auth status >/dev/null 2>&1 || fail "gh is not authenticated. Run: gh auth login"

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "$RELEASE_BRANCH" ] ||
  fail "On '$BRANCH'. Releases are cut from '$RELEASE_BRANCH'."

[ -z "$(git status --porcelain)" ] ||
  fail "Working tree is dirty. Commit or stash first."

if git ls-remote --exit-code --heads origin "$RELEASE_BRANCH" >/dev/null 2>&1; then
  git fetch --quiet origin "$RELEASE_BRANCH"
  [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$RELEASE_BRANCH")" ] ||
    fail "Local '$RELEASE_BRANCH' differs from origin. Pull or push first."
  echo "  branch     $BRANCH, in sync with origin"
else
  echo "  branch     $BRANCH (no origin/$RELEASE_BRANCH yet)"
fi

echo "  tree       clean"

# --------------------------------------------------------------------- checks

step "Checks"

# Fail here rather than after the tag exists — CI runs these again before it
# publishes, so a break found now saves an unpublishable tag.
npm run lint
npm run typecheck
npm run prettier:check
npm test
npm run build

# ----------------------------------------------------------------------- plan

CURRENT="$(node -p "require('./package.json').version")"
NEXT="$(
  node -e "
    const [core] = process.argv[1].split('-');
    let [maj, min, pat] = core.split('.').map(Number);
    const bump = process.argv[2];
    if (bump === 'major') { maj += 1; min = 0; pat = 0; }
    else if (bump === 'minor') { min += 1; pat = 0; }
    else if (bump === 'patch') { pat += 1; }
    else { console.log('(computed by npm)'); process.exit(0); }
    console.log(\`\${maj}.\${min}.\${pat}\`);
  " "$CURRENT" "$BUMP"
)"

step "Plan"
echo "  bump       $BUMP${BUMP:+}$([ "$BUMP" = prerelease ] && echo " (preid: $PREID)")"
echo "  version    $CURRENT  ->  $NEXT"
echo "  tag        pushed to origin"
echo "  release    created, which triggers npm-publish.yml"

if [ "$DRY_RUN" = true ]; then
  printf '\n\033[33mDry run — stopping before anything is changed.\033[0m\n'
  exit 0
fi

if [ "$ASSUME_YES" != true ]; then
  printf '\nPublishing is not reversible: npm versions are immutable.\n'
  read -r -p "Continue? [y/N] " reply
  case "$reply" in [yY] | [yY][eE][sS]) ;; *) echo "Aborted."; exit 1 ;; esac
fi

# ---------------------------------------------------------------------- ship

step "Bumping version"

if [ "$BUMP" = "prerelease" ]; then
  npm version prerelease --preid="$PREID"
else
  npm version "$BUMP"
fi

VERSION="$(node -p "require('./package.json').version")"
TAG="v$VERSION"

step "Pushing $TAG"

# If this fails the tag exists only locally, so say how to undo it.
if ! git push --follow-tags; then
  fail "Push failed. Undo the local bump with:
    git tag -d $TAG && git reset --hard HEAD~1"
fi

step "Creating release $TAG"

RELEASE_FLAGS=(--generate-notes)
[ "$BUMP" = "prerelease" ] && RELEASE_FLAGS+=(--prerelease)

gh release create "$TAG" "${RELEASE_FLAGS[@]}"

step "Done"
echo "  $TAG released. npm-publish.yml is now publishing."
echo
echo "  Watch it:   gh run watch"
echo "  Verify:     npm view react-financial-input version"
