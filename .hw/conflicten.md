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
(`gh secret list` gaf op 4 november 2026 een lege lijst), dus de sync-PR komt binnen zonder
checks. De workflow zet daarom alleen auto-merge aan als er echt checks op de PR staan; zonder
checks blijft de PR open voor een mens.

Twee routes, een besluit van de moeder:

1. Een fijnmazige PAT of GitHub App met `contents: write`, `pull-requests: write` en
   `workflows: write` als secret `SYNC_TOKEN`, en de workflow die in plaats van
   `GITHUB_TOKEN` gebruiken. Dan start CI wel op de PR.
2. Zo laten: de PR komt binnen, iemand start de checks met een lege commit of een re-run, en
   de PR gaat daarna door de normale route.

Tot dat besluit valt er niets te automatiseren aan de checks; de PR zelf werkt wel.

## Afwijking van het ontwerp (§4.1)

Het ontwerp laat de workflow geen auto-merge doen vanwege de keuringspoort (`KEURING:
aanvaard`). Die poort bestaat in deze repo niet: geen branch protection, geen rulesets, geen
`ci-en-samenvoegen.sh`. De opdracht van de moeder vraagt om auto-merge, dus de workflow zet
`gh pr merge --auto --merge` aan zodra er checks zijn. `allow_auto_merge` staat op dit moment
uit in de repo-instellingen; de opdracht faalt dan met een melding en de PR blijft open.
Zodra de instelling aan staat, werkt de auto-merge zonder codewijziging. Wie de keuringspoort
later instelt, zet deze stap uit in `.hw/sync-upstream.sh`.

## Eerdere conflicten

Nog geen. De eerste run na rc.48 meldt "niets te doen", want rc.48 zit al in `main`.
