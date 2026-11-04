#!/usr/bin/env node
// Eenmalige verhuizing van onze eigen vertaalsleutels naar `web/src/i18n/hw/`.
//
// Bron  : onze taalbestanden op een basiscommit (standaard origin/main).
// Doel  : per taal de sleutels die upstream niet heeft of anders vertaalt naar
//         web/src/i18n/hw/<taal>.json, en het upstream-taalbestand byte-voor-byte
//         terug naar de upstream-tag. De hw-overlay wint bij het laden, dus de
//         bezoeker ziet exact dezelfde teksten als voor de verhuizing.
//
// Ook na een upstream-sync bruikbaar: dan is er niets te verhuizen, want de
// basis heeft dan al de upstream-bestanden. Leeg verhuizen overschrijft nooit
// een bestaande overlay (tenzij --force).
//
// Gebruik:
//   node .hw/verhuis-i18n.mjs [--basis origin/main] [--upstream v1.0.0-rc.48] [--controleer]
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const WORTEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOCALES = 'web/src/i18n/locales'
const HW = 'web/src/i18n/hw'
const ONTVANGST = 'web/src/i18n/__tests__/__fixtures__/oude-bundel.json'

// Alleen talen die upstream ook heeft. `tr` bestaat upstream niet en is dus
// altijd ons eigen bestand: dat blijft staan waar het staat.
const TALEN = ['en', 'zh', 'zh-TW', 'fr', 'ru', 'ja', 'vi']

const argumenten = process.argv.slice(2)
const optie = (naam, standaard) => {
  const i = argumenten.indexOf(`--${naam}`)
  return i === -1 ? standaard : argumenten[i + 1]
}
const BASIS = optie('basis', 'origin/main')
const UPSTREAM = optie('upstream', 'v1.0.0-rc.48')
const CONTROLEER = argumenten.includes('--controleer')
const FORCE = argumenten.includes('--force')

const git = (...args) =>
  execFileSync('git', args, { cwd: WORTEL, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })

function leesBlob(ref, pad) {
  try {
    return git('show', `${ref}:${pad}`)
  } catch {
    return null
  }
}

const sorteer = (object) =>
  Object.fromEntries(Object.entries(object).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

function schrijfJson(pad, data) {
  mkdirSync(dirname(join(WORTEL, pad)), { recursive: true })
  writeFileSync(join(WORTEL, pad), `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

// Onze sleutels: alles wat upstream niet heeft of anders vertaalt.
function eigenSleutels(onze, upstream) {
  const verschil = {}
  for (const [sleutel, waarde] of Object.entries(onze)) {
    if (!Object.hasOwn(upstream, sleutel) || upstream[sleutel] !== waarde) {
      verschil[sleutel] = waarde
    }
  }
  return sorteer(verschil)
}

const ontvangst = {}
const verslag = []

for (const taal of TALEN) {
  const pad = `${LOCALES}/${taal}.json`
  const onzeTekst = leesBlob(BASIS, pad)
  const upstreamTekst = leesBlob(UPSTREAM, pad)
  if (!onzeTekst || !upstreamTekst) {
    verslag.push(`${taal}: overgeslagen (bestand ontbreekt in ${onzeTekst ? UPSTREAM : BASIS})`)
    continue
  }
  const onze = JSON.parse(onzeTekst).translation ?? {}
  const upstream = JSON.parse(upstreamTekst).translation ?? {}
  const verschil = eigenSleutels(onze, upstream)
  const hwPad = `${HW}/${taal}.json`
  const aantal = Object.keys(verschil).length

  if (aantal === 0) {
    verslag.push(`${taal}: niets te verhuizen`)
    if (existsSync(join(WORTEL, hwPad)) && !FORCE) {
      verslag.push(`  ${hwPad} blijft staan (leeg verhuizen zou hem wissen)`)
    }
    continue
  }

  const overschreven = Object.keys(verschil).filter((s) => Object.hasOwn(upstream, s)).length
  const toegevoegd = aantal - overschreven
  verslag.push(`${taal}: ${aantal} eigen sleutels (${toegevoegd} nieuw, ${overschreven} overschreven) -> ${hwPad}`)
  verslag.push(`  ${pad} terug naar ${UPSTREAM}`)
  ontvangst[taal] = verschil

  if (!CONTROLEER) {
    schrijfJson(hwPad, verschil)
    writeFileSync(join(WORTEL, pad), upstreamTekst, 'utf8')
  }
}

if (Object.keys(ontvangst).length > 0 && !CONTROLEER) {
  // Bewijsstuk voor de toets: de oude waarden per taal, zodat de samengevoegde
  // bundel na de verhuizing tegen origin/main te vergelijken blijft.
  schrijfJson(ONTVANGST, ontvangst)
  verslag.push(`bewijs: ${ONTVANGST}`)
}

// tr: ons eigen bestand, upstream heeft het niet.
const kontroleerTr = leesBlob(BASIS, `${LOCALES}/tr.json`)
if (kontroleerTr && !leesBlob(UPSTREAM, `${LOCALES}/tr.json`)) {
  verslag.push('tr: blijft in locales/ (bestaat niet upstream)')
}

console.log(verslag.join('\n'))
console.log(CONTROLEER ? '\ncontroleermodus: niets geschreven' : '\nklaar')
