Automatische sync van upstream `{{TAG}}` in `{{BASIS}}`, gemaakt door `.hw/sync-upstream.sh` (workflow `upstream-sync`).

De merge, de lockfile en de routetree zijn in dezelfde run gemaakt: `bun install` en `bun run build` draaiden op de samengevoegde `web/package.json`, en de haaklijst-toets is groen. Conflicten worden niet met een model opgelost; die komen als concept-PR en in de run-samenvatting binnen, met de conflictlijst.

Samenvoegen mag pas als de verplichte checks op deze PR groen zijn. Deze PR is geopend met `GITHUB_TOKEN`, dus GitHub start er zelf geen CI op; de workflow start `CI` en `Security` daarom zelf op deze tak met `workflow_dispatch`, en die runs verschijnen als checks op deze PR. De verplichte set staat in de ruleset op `main`; zie `.hw/conflicten.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
