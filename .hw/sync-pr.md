Automatische sync van upstream `{{TAG}}` in `{{BASIS}}`, gemaakt door `.hw/sync-upstream.sh` (workflow `upstream-sync`).

De merge, de lockfile en de routetree zijn in dezelfde run gemaakt: `bun install` en `bun run build` draaiden op de samengevoegde `web/package.json`, en de haaklijst-toets is groen. Conflicten worden niet met een model opgelost; die komen als issue binnen met de conflictlijst.

Samenvoegen mag pas als de verplichte checks op deze PR groen zijn. Let op: deze PR is geopend met `GITHUB_TOKEN`, dus GitHub start daar standaard geen CI op. Zie `.hw/conflicten.md` voor de twee routes daarvoor.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
