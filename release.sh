#!/usr/bin/env bash
# Automate a New API release: pick a version, tag it, and push the tag to
# trigger the GitHub Actions workflows that build the Docker image (to the
# private registry) and publish the GitHub Release with a changelog.
#
# Usage:
#   ./release.sh v1.0.1            # explicit version
#   ./release.sh patch             # bump patch from the latest tag (also: minor, major)
#   ./release.sh release           # promote the latest pre-release to a stable release
#   ./release.sh rc                # next pre-release (e.g. v1.0.0-rc.27)
#   ./release.sh                   # interactive menu of suggestions
#
# Options:
#   -y, --yes    do not ask for confirmation
#   -h, --help   show this help and exit
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE="origin"
ASSUME_YES=0
VERSION_ARG=""

usage() { awk 'NR==1{next} /^#/{sub(/^# ?/,""); print; next} {exit}' "${BASH_SOURCE[0]}"; }

die() { echo "error: $*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    -y|--yes) ASSUME_YES=1 ;;
    -h|--help) usage; exit 0 ;;
    -*) die "unknown option: $arg" ;;
    *) [ -n "$VERSION_ARG" ] && die "unexpected extra argument: $arg"; VERSION_ARG="$arg" ;;
  esac
done

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || die "not inside a git repository"

# Working tree must be clean so the tag points at a well-defined commit.
if ! git diff --quiet || ! git diff --cached --quiet; then
  die "working tree is not clean; commit or stash changes first"
fi

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "$CURRENT_BRANCH" != "main" ]; then
  echo "warning: current branch is '$CURRENT_BRANCH', not 'main'."
fi

echo "Fetching tags from $REMOTE ..."
git fetch --tags --quiet "$REMOTE"

VERSION_RE='^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.]+)?$'

# Parse the latest tag into base (X.Y.Z) + prerelease (e.g. rc.26) and compute
# the suggested next versions following semantic versioning.
LATEST_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
core="${LATEST_TAG#v}"
base="${core%%-*}"
if [ "$core" = "$base" ]; then pre=""; else pre="${core#*-}"; fi
if ! printf '%s' "$base" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+$'; then
  base="0.0.0"; pre=""
fi
IFS='.' read -r MA MI PA <<< "$base"

NEXT_PATCH="v${MA}.${MI}.$((PA + 1))"
NEXT_MINOR="v${MA}.$((MI + 1)).0"
NEXT_MAJOR="v$((MA + 1)).0.0"
RELEASE="v${base}" # drop any prerelease suffix

# Next pre-release: bump the trailing number of the current prerelease, or start
# an rc series on the next patch when the latest tag is already a stable release.
if [ -n "$pre" ] && [[ "$pre" =~ ^([0-9A-Za-z]+)\.([0-9]+)$ ]]; then
  NEXT_PRE="v${base}-${BASH_REMATCH[1]}.$((BASH_REMATCH[2] + 1))"
elif [ -n "$pre" ]; then
  NEXT_PRE="v${base}-${pre}.1"
else
  NEXT_PRE="${NEXT_PATCH}-rc.1"
fi

resolve_keyword() {
  case "$1" in
    patch) printf '%s' "$NEXT_PATCH" ;;
    minor) printf '%s' "$NEXT_MINOR" ;;
    major) printf '%s' "$NEXT_MAJOR" ;;
    release) printf '%s' "$RELEASE" ;;
    rc | pre | prerelease) printf '%s' "$NEXT_PRE" ;;
    *) return 1 ;;
  esac
}

if [ -n "$VERSION_ARG" ]; then
  NEW_VERSION="$(resolve_keyword "$VERSION_ARG")" || NEW_VERSION="$VERSION_ARG"
else
  # Interactive menu of suggestions derived from the latest tag.
  echo "Latest tag: ${LATEST_TAG:-(none)}"
  MENU_V=(); MENU_L=()
  if [ -n "$pre" ]; then
    MENU_V+=("$NEXT_PRE");   MENU_L+=("next pre-release")
    MENU_V+=("$RELEASE");    MENU_L+=("promote to release")
    MENU_V+=("$NEXT_PATCH"); MENU_L+=("patch")
    MENU_V+=("$NEXT_MINOR"); MENU_L+=("minor")
    MENU_V+=("$NEXT_MAJOR"); MENU_L+=("major")
  else
    MENU_V+=("$NEXT_PATCH"); MENU_L+=("patch")
    MENU_V+=("$NEXT_MINOR"); MENU_L+=("minor")
    MENU_V+=("$NEXT_MAJOR"); MENU_L+=("major")
    MENU_V+=("$NEXT_PRE");   MENU_L+=("pre-release (rc.1)")
  fi
  echo "Select the new version:"
  n=${#MENU_V[@]}
  for i in "${!MENU_V[@]}"; do
    printf '  %d) %-18s %s\n' "$((i + 1))" "${MENU_V[$i]}" "${MENU_L[$i]}"
  done
  printf '  %d) custom (enter manually)\n' "$((n + 1))"
  read -r -p "Choice [1-$((n + 1))]: " choice
  if [ "$choice" = "$((n + 1))" ]; then
    read -r -p "New version (e.g. v1.0.1): " NEW_VERSION
  elif printf '%s' "$choice" | grep -qE '^[0-9]+$' && [ "$choice" -ge 1 ] && [ "$choice" -le "$n" ]; then
    NEW_VERSION="${MENU_V[$((choice - 1))]}"
  else
    die "invalid choice: $choice"
  fi
fi

[[ "$NEW_VERSION" =~ $VERSION_RE ]] || die "invalid version '$NEW_VERSION' (expected vX.Y.Z or vX.Y.Z-suffix)"

if git rev-parse "refs/tags/$NEW_VERSION" >/dev/null 2>&1; then
  die "tag $NEW_VERSION already exists locally"
fi
if git ls-remote --exit-code --tags "$REMOTE" "refs/tags/$NEW_VERSION" >/dev/null 2>&1; then
  die "tag $NEW_VERSION already exists on $REMOTE"
fi

PREV_TAG="$(git describe --tags --abbrev=0 2>/dev/null || true)"
echo
echo "==================== Changelog preview ===================="
bash "$SCRIPT_DIR/scripts/gen-changelog.sh" HEAD "$PREV_TAG" || true
echo "==========================================================="
echo
echo "About to tag $CURRENT_BRANCH @ $(git rev-parse --short HEAD) as $NEW_VERSION and push to $REMOTE."
case "$NEW_VERSION" in
  *-alpha*) echo "note: -alpha tag builds the Docker image only (no GitHub Release)." ;;
esac

if [ "$ASSUME_YES" -ne 1 ]; then
  read -r -p "Proceed? [y/N] " reply
  case "$reply" in
    y|Y|yes|YES) ;;
    *) echo "aborted."; exit 1 ;;
  esac
fi

git tag -a "$NEW_VERSION" -m "Release $NEW_VERSION"
git push "$REMOTE" "$NEW_VERSION"

REPO_URL="$(git config --get "remote.${REMOTE}.url" || true)"
REPO_SLUG="$(printf '%s' "$REPO_URL" | sed -E 's#(git@github.com:|https://github.com/)##; s#\.git$##')"
echo
echo "Pushed tag $NEW_VERSION."
if [ -n "$REPO_SLUG" ]; then
  echo "Track the build: https://github.com/$REPO_SLUG/actions"
  echo "Release will appear at: https://github.com/$REPO_SLUG/releases/tag/$NEW_VERSION"
fi
