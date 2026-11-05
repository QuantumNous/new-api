#!/usr/bin/env node
// Haaklijst-toets: faalt als een wijziging eigen regels toevoegt in een
// upstreambestand buiten de haaklijst, of meer regels dan het maximum daar.
// Gebruik: node .hw/toets-haaklijst.mjs <basis> <kop>   (bijv. origin/main HEAD)
// Geen afhankelijkheden, geen netwerk.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HAAKLIJST = fileURLToPath(new URL('./haaklijst.txt', import.meta.url))

// Elke regel: pad, dan het maximum aantal eigen regels. Commentaar met #.
export function leesHaaklijst(tekst) {
  const limieten = new Map()
  for (const regel of tekst.split('\n')) {
    const schoon = regel.replace(/#.*$/, '').trim()
    if (!schoon) continue
    const [pad, ...rest] = schoon.split(/\s+/)
    if (Number.isNaN(Number(rest[0] ?? 0))) continue
    limieten.set(pad, Number(rest[0] ?? 0))
  }
  return limieten
}

// numstat-regels ("toegevoegd<TAB>verwijderd<TAB>pad") tegen de limieten.
// bestaatInBasis(pad) vertelt of het pad al in de basis bestond; zo ja, dan is
// elke eigen regel erin een haak en moet het pad op de lijst staan.
export function beoordeel(numstat, limieten, bestaatInBasis) {
  const fouten = []
  for (const regel of numstat.split('\n').filter(Boolean)) {
    const [toegevoegd, verwijderd, pad] = regel.split('\t')
    if (!pad || pad.includes('=>') || toegevoegd === '-') continue // hernoemd of binair
    const eigen = Number(toegevoegd) - Number(verwijderd)
    if (eigen <= 0) continue
    const max = limieten.get(pad)
    if (max === undefined) {
      if (bestaatInBasis(pad)) fouten.push({ pad, eigen, max: null })
      continue
    }
    if (eigen > max) fouten.push({ pad, eigen, max })
  }
  return fouten
}

// Een pad van deze fork: een paddeel dat met "hw" begint (.hw/, hw_*, hw-*,
// hw/, pkg/hwperf/). De upstream-tag kent geen enkel zulk pad (0 van 2669 op
// v1.0.0-rc.48), dus zo'n bestand is van ons en een eigen regel erin is geen
// haak. Nodig omdat onze eigen bestanden in de basisbranch staan: zodra de
// upstream-tag onbereikbaar is (ondiepe kloon), is de basis de maat en zou
// anders elk eigen bestand als upstreambestand gelden.
export function isEigenPad(pad) {
  return pad.split('/').some((deel) => deel.replace(/^\.+/, '').toLowerCase().startsWith('hw'))
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' })

// Eerste toegevoegde regel aan de kop-kant, voor de melding (bestand:regel).
function eersteRegel(basis, kop, pad) {
  const diff = git('diff', '--unified=0', '--no-color', `${basis}...${kop}`, '--', pad)
  const treffer = diff.match(/^@@ -\S+ \+(\d+)/m)
  return treffer ? Number(treffer[1]) : 0
}

export function main([basis, kop] = process.argv.slice(2)) {
  if (!basis || !kop) {
    console.error('gebruik: node .hw/toets-haaklijst.mjs <basis> <kop>')
    return 2
  }
  const limieten = leesHaaklijst(readFileSync(HAAKLIJST, 'utf8'))
  // Een upstreambestand is een bestand uit de laatste upstream-tag op de basis.
  // De basis zelf bevat ook onze eigen bestanden, en een wijziging daarin is
  // geen haak. Zonder tag (ondiepe checkout) blijft de basis de maat.
  const upstream =
    git('tag', '--list', 'v*', '--merged', basis, '--sort=-v:refname').split('\n')[0].trim() || basis
  const bestaatInBasis = (pad) => {
    if (isEigenPad(pad)) return false
    try {
      execFileSync('git', ['cat-file', '-e', `${upstream}:${pad}`], { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  const fouten = beoordeel(git('diff', '--numstat', `${basis}...${kop}`), limieten, bestaatInBasis)
  if (fouten.length) {
    for (const fout of fouten) {
      const reden = fout.max === null
        ? 'staat niet op de haaklijst'
        : `maximum op de haaklijst is ${fout.max}`
      console.error(`${fout.pad}:${eersteRegel(basis, kop, fout.pad)}: +${fout.eigen} eigen regels, ${reden}`)
    }
    console.error('Verplaats de code naar een eigen bestand, of zet een bewuste nieuwe haak op .hw/haaklijst.txt.')
    return 1
  }
  console.log(`haaklijst ok (${basis}...${kop})`)
  return 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
