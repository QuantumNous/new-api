#!/usr/bin/env bash
# Eén vaste stap: nieuwe upstream-tag, proefmerge, PR of issue. Geen model, geen lus.
# Draait in CI (.github/workflows/upstream-sync.yml) en lokaal met dezelfde env.
# env: UPSTREAM_REPO (QuantumNous/new-api), BASIS (origin/main), TAGS (v1.0.0-rc.*)
set -euo pipefail

UPSTREAM_REPO=${UPSTREAM_REPO:-QuantumNous/new-api}
BASIS=${BASIS:-origin/main}
TAG_PATROON=${TAG_PATROON:-v1.0.0-rc.*}
SYNC_TAK_PREFIX=${SYNC_TAK_PREFIX:-sync/upstream-}
UITLEG='De proefmerge gaf een conflict. Los dit op in een worktree op een tak vanaf `'"$BASIS"'`, push die tak en open zelf de PR; de workflow doet dat niet opnieuw voor dezelfde tag. `git rerere` herhaalt een eerder opgeloste oplossing, het recept staat in `.hw/conflicten.md`.'

git config user.name 'hisarweb-sync'
git config user.email 'sync@hisarweb.be'
git config rerere.enabled true
git config rerere.autoupdate true
# merge=ours alleen voor gegenereerde bestanden, en alleen in deze run: het bestand wordt
# hieronder opnieuw gemaakt met bun install en bun run build. Nooit in .gitattributes,
# want een verkeerde ours laat upstreamwerk stil verdwijnen.
git config merge.ours.driver true
printf 'web/bun.lock merge=ours\nweb/src/routeTree.gen.ts merge=ours\n' >> "$(git rev-parse --git-path info/attributes)"

# UPSTREAM_URL mag lokaal naar een kloon wijzen; in CI leeg en dus de publieke repo.
UPSTREAM_URL=${UPSTREAM_URL:-https://github.com/${UPSTREAM_REPO}.git}
git remote get-url upstream >/dev/null 2>&1 \
  && git remote set-url upstream "$UPSTREAM_URL" \
  || git remote add upstream "$UPSTREAM_URL"
# Alleen rc-tags: upstream publiceert ook alpha- en nightly-tags die wij niet volgen.
git fetch --no-tags --no-prune upstream "+refs/tags/${TAG_PATROON}:refs/tags/${TAG_PATROON}"
git fetch --no-tags origin "+refs/heads/*:refs/remotes/origin/*"

TAG=$(git tag --list "$TAG_PATROON" | sort -V | tail -1)
if [ -z "$TAG" ]; then
  echo "FOUT: geen tag gevonden die op ${TAG_PATROON} past"
  exit 1
fi
echo "nieuwste upstream-tag: $TAG"

if git merge-base --is-ancestor "$TAG" "$BASIS"; then
  echo "niets te doen: $TAG zit al in $BASIS"
  exit 0
fi

TAK="${SYNC_TAK_PREFIX}${TAG}"

# Al een open PR of een openstaand issue voor deze tag? Dan niets doen: geen dubbele
# PR's en geen dubbele issues, en geen tweede poging voor dezelfde tag.
BESTAANDE_PR=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$TAK" --state open --json number --jq '.[0].number // empty')
if [ -n "$BESTAANDE_PR" ]; then
  echo "niets te doen: PR #$BESTAANDE_PR voor $TAG staat al open"
  exit 0
fi
# Issues staan in deze repo uit; dan is er niets om te zoeken of te openen en gaat
# de conflictlijst naar de run-samenvatting.
ISSUES_AAN=$(gh api "repos/$GITHUB_REPOSITORY" --jq '.has_issues')
if [ "$ISSUES_AAN" = 'true' ]; then
  BESTAAND_ISSUE=$(gh issue list --repo "$GITHUB_REPOSITORY" --search "upstream-sync-conflict-$TAG in:title" --state open --json number --jq '.[0].number // empty')
  if [ -n "$BESTAAND_ISSUE" ]; then
    echo "niets te doen: issue #$BESTAAND_ISSUE voor het conflict in $TAG staat al open"
    exit 0
  fi
fi

# Proefmerge op een verse tak vanaf de basis.
git switch --force-create "$TAK" "$BASIS"
if ! git merge --no-ff --no-commit "$TAG"; then
  CONFLICTEN=$(git diff --name-only --diff-filter=U | sort)
  git merge --abort || true
  MELDING=$(mktemp)
  {
    echo "De proefmerge van \`$TAG\` in \`$BASIS\` gaf een conflict."
    echo
    echo "Conflicten:"
    while IFS= read -r pad; do
      [ -n "$pad" ] || continue
      HAAK=$(grep -E "^${pad//./\\.}[[:space:]]" .hw/haaklijst.txt | head -1 || true)
      echo "- \`$pad\`${HAAK:+ (haakbestand, budget: \`$HAAK\`)}"
    done <<< "$CONFLICTEN"
    echo
    echo "$UITLEG"
    echo
    echo "<!-- upstream-sync-conflict-$TAG -->"
  } > "$MELDING"
  if [ "$ISSUES_AAN" = 'true' ]; then
    gh issue create --repo "$GITHUB_REPOSITORY" \
      --title "Upstream-sync conflict: $TAG" \
      --body-file "$MELDING" \
      --label upstream-sync 2>/dev/null \
      || gh issue create --repo "$GITHUB_REPOSITORY" \
           --title "Upstream-sync conflict: $TAG" \
           --body-file "$MELDING"
    echo "conflict gemeld als issue"
  else
    # Geen issues in deze repo: de conflictlijst gaat naar de run-samenvatting.
    echo "LET OP: issues staan uit voor $GITHUB_REPOSITORY; conflict gaat naar de run-samenvatting"
    cat "$MELDING" >> "${GITHUB_STEP_SUMMARY:-/dev/null}"
    echo "conflict: zie de run-samenvatting"
  fi
  rm -f "$MELDING"
  exit 0
fi

git commit -q -m "chore(upstream): merge $TAG"

# Gegenereerde bestanden opnieuw maken; nooit met de hand samenvoegen.
(cd web && bun install && bun run build)
git add web/bun.lock web/src/routeTree.gen.ts
git diff --cached --quiet || git commit -q -m "chore: regenerate lockfile and route tree"

node .hw/toets-haaklijst.mjs "$BASIS" HEAD

if git ls-remote --exit-code --heads origin "$TAK" >/dev/null 2>&1; then
  git fetch --no-tags origin "$TAK"
  git push --force-with-lease="refs/heads/${TAK}:$(git rev-parse FETCH_HEAD)" origin "HEAD:refs/heads/$TAK"
else
  git push origin "HEAD:refs/heads/$TAK"
fi

PR=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$TAK" --state open --json number --jq '.[0].number // empty')
if [ -z "$PR" ]; then
  MELDING=$(mktemp)
  if [ -f .hw/sync-pr.md ]; then
    # De PR-tekst staat als sjabloon in de repo, zodat hij meeleest in de review.
    sed -e "s/{{TAG}}/$TAG/g" -e "s#{{BASIS}}#$BASIS#g" .hw/sync-pr.md > "$MELDING"
  else
    {
      echo "Automatische sync naar upstream \`$TAG\` (\`$BASIS\`), gemaakt door \`.hw/sync-upstream.sh\`."
      echo
      echo "🤖 Generated with [Claude Code](https://claude.com/claude-code)"
    } > "$MELDING"
  fi
  # De URL die gh teruggeeft is het PR-nummer; dat scheelt een tweede zoekactie
  # en werkt ook als de zoekindex nog niet bij is.
  PR=$(gh pr create --repo "$GITHUB_REPOSITORY" --base "${BASIS#origin/}" --head "$TAK" \
    --title "Upstream $TAG" --body-file "$MELDING" | grep -oE '[0-9]+$')
  rm -f "$MELDING"
  if [ -z "$PR" ]; then
    PR=$(gh pr list --repo "$GITHUB_REPOSITORY" --head "$TAK" --state open --json number --jq '.[0].number // empty')
  fi
fi
if [ -z "$PR" ]; then
  echo "FOUT: de tak $TAK is gepusht maar er is geen PR gevonden; open er zelf een"
  exit 1
fi
echo "PR #$PR voor $TAG"

# Auto-merge alleen als dat veilig kan: de instelling moet aan staan, er moeten
# checks op de PR staan en de basisbranch moet die checks verplicht stellen.
# Anders voegt --auto direct samen, ook als een check later rood wordt.
if [ "$(gh api "repos/$GITHUB_REPOSITORY" --jq '.allow_auto_merge')" != 'true' ]; then
  echo "LET OP: auto-merge staat uit voor $GITHUB_REPOSITORY; PR #$PR blijft open voor een mens"
  exit 0
fi
VERPLICHT=$(gh api "repos/$GITHUB_REPOSITORY/branches/${BASIS#origin/}/protection" --jq '.required_status_checks.contexts // []' 2>/dev/null || true)
if [ -z "$VERPLICHT" ] || [ "$VERPLICHT" = '[]' ] || [ "$VERPLICHT" = 'null' ]; then
  echo "LET OP: ${BASIS#origin/} heeft geen verplichte checks, dus auto-merge zou zonder keuring samenvoegen; PR #$PR blijft open voor een mens"
  exit 0
fi
CHECKS=''
for poging in 1 2 3 4 5 6; do
  CHECKS=$(gh pr checks "$PR" --repo "$GITHUB_REPOSITORY" 2>/dev/null | head -1 || true)
  [ -n "$CHECKS" ] && break
  [ "$poging" = 6 ] && break
  sleep 20
done
if [ -z "$CHECKS" ]; then
  echo "LET OP: geen checks gestart op PR #$PR (GITHUB_TOKEN-PR start geen CI); PR blijft open voor een mens"
  exit 0
fi
gh pr merge "$PR" --repo "$GITHUB_REPOSITORY" --auto --merge --delete-branch
echo "auto-merge aan voor PR #$PR"
