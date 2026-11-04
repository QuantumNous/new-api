# Conflicten bij de upstream-sync, met het recept per blijvend conflict

De workflow `.github/workflows/upstream-sync.yml` draait `.hw/sync-upstream.sh` een keer per
dag. Hij doet een proefmerge van de nieuwste `v1.0.0-rc.*`-tag in `origin/main` en opent bij
succes een PR. Bij een conflict opent hij een issue met de conflictlijst en de betrokken
haakbestanden, en doet daarna niets meer voor die tag.

`git rerere` staat in de run aan en de cache (`.git/rr-cache`) gaat via `actions/cache` mee
naar de volgende run. Een conflict dat een keer is opgelost, herhaalt zich daarmee vanzelf.
Een blijvend conflict krijgt hieronder een regel, zodat een mens of agent hetzelfde besluit
neemt als de vorige keer.

## Gegenereerde bestanden: nooit met de hand samenvoegen

| Bestand | regel in de run | wat de workflow daarna doet |
|---|---|---|
| `web/bun.lock` | `merge=ours` via `.git/info/attributes` | `bun install` in `web/`, daarna committen |
| `web/src/routeTree.gen.ts` | `merge=ours` via `.git/info/attributes` | `bun run build` regenereert hem (de router-plugin schrijft hem) |

`merge=ours` staat bewust niet in `.gitattributes`: een verkeerde `ours` laat upstreamwerk
stil verdwijnen, en de driver moet per kloon of per run aan staan. De workflow zet hem in
`.git/info/attributes` van die run en regenereert de bestanden in dezelfde run.

## Openstaand besluit: geen PAT, dus geen CI op de sync-PR

GitHub start geen workflows op een PR die door `GITHUB_TOKEN` is geopend. Dat is bewust zo:
een run die zijn eigen PR laat keuren, keurt zichzelf. De repo heeft geen PAT-secret
(`gh secret list` gaf op 4 november 2026 een lege lijst).

Opgelost op 4 november 2026 zonder PAT: `pull_request` start niet, maar `workflow_dispatch`
wel. Na het openen van de PR start de sync daarom zelf `ci.yml` en `security.yml` met
`gh workflow run <werkstroom> --ref sync/upstream-<tag>` (permissions `actions: write` in
`.github/workflows/upstream-sync.yml`). Die run landt op dezelfde commit als de PR-kop en
verschijnt dus als check op de PR. Beide workflows hebben daarvoor `workflow_dispatch:` en
gebruiken buiten een `pull_request`-run de standaardbranch als vergelijkingspunt voor de
haaklijst-toets, want `github.base_ref` is dan leeg.

Eén grens blijft: de checks zijn gestart door de workflow die ook de PR maakte, dus een groene
uitslag bewijst dat de code bouwt en toetst, niet dat iemand ernaar keek. De PR-beschrijving en
de run-samenvatting zijn de leesbare kant; de merge gaat pas door als de verplichte checks op
`main` groen zijn.

## Verplichte checks op main

Sinds 4 november 2026 staat er een ruleset (id `26563396`, "main: de checks die elke PR haalt")
met de vier checks die op elke PR draaien, zonder paths-filter:

- `Backend vet, build, and test`
- `Frontend typecheck and test`
- `Production image build`
- `Secret scan over full history`

Bewust niet verplicht: `Go vulnerability scan` en `Frontend dependency audit` (draaien wel op
elke PR, maar een nieuwe advies-database zou dan een PR blokkeren die niets met de melding te
maken heeft) en `MySQL and PostgreSQL tests` (paths-filter op `model/` en `controller/`). Wie
die twee toch verplicht wil, voegt ze toe aan dezelfde ruleset; twee workflows met dezelfde
checknaam mogen er nooit in.

De rol `hisarweb-be` (RepositoryRole admin, actor 5) is bypass-actor met `always`, zodat de
bestaande werkwijze blijft werken: eigen PR samenvoegen zodra CI groen is. Zonder bypass kan
alleen GitHub zelf nog samenvoegen na de checks; dat is de noodrem als een check blijft hangen.

## Conflict zonder issues

Issues staan uit voor `hisarweb-be/hisarweb-ai`; dat blijft zo. Bij een conflict gaat de
conflictlijst naar de run-samenvatting én naar een concept-PR op dezelfde `sync/upstream-<tag>`
-tak, met de merge afgebroken en een lege commit erop. Zo zien Altuner en de CTO het op één
plek in plaats van in een runlog. De concept-PR wordt nooit samengevoegd: hij is het
werkbewijs voor de handmatige oplossing.

## Afwijking van het ontwerp (§4.1)

Het ontwerp laat de workflow geen auto-merge doen vanwege de keuringspoort (`KEURING:
aanvaard`). Die poort bestaat in deze repo niet: geen `ci-en-samenvoegen.sh`. De opdracht van
de moeder vraagt om auto-merge, dus de workflow zet `gh pr merge --auto --merge` aan zodra de
verplichte checks er staan. `allow_auto_merge` staat aan sinds 4 november 2026 en de ruleset
hierboven maakt de checks verplicht; zonder verplichte checks zet de workflow geen auto-merge
aan, want dan zou `--auto` meteen samenvoegen. Wie de keuringspoort later instelt, zet deze
stap uit in `.hw/sync-upstream.sh`.

## Eerdere conflicten

Nog geen. De eerste run na rc.48 meldt "niets te doen", want rc.48 zit al in `main`.
