// Unittoets voor de haaklijst-toets: kunstmatige diff (moet falen) en de echte stand (moet slagen).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync, cpSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { beoordeel, isEigenPad, leesHaaklijst } from './toets-haaklijst.mjs'

const WORTEL = fileURLToPath(new URL('../', import.meta.url))
const ECHTE_LIJST = join(WORTEL, '.hw', 'haaklijst.txt')

const run = (cwd, ...args) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })

// Verse repo met upstream-achtige bestanden; de toets en de lijst staan er ook in,
// zodat de toets precies zo draait als in CI.
function maakRepo(lijst) {
  const map = mkdtempSync(join(tmpdir(), 'haaklijst-'))
  run(map, 'init', '-q', '-b', 'main')
  run(map, 'config', 'user.name', 'toets')
  run(map, 'config', 'user.email', 'toets@example.invalid')
  run(map, 'config', 'commit.gpgsign', 'false')
  mkdirSync(join(map, 'router'), { recursive: true })
  mkdirSync(join(map, '.hw'), { recursive: true })
  writeFileSync(join(map, 'router', 'relay-router.go'), 'package router\n\nfunc op() {\n}\n')
  writeFileSync(join(map, 'main.go'), 'package main\n\nfunc main() {\n}\n')
  writeFileSync(join(map, 'README.md'), '# upstream\n')
  writeFileSync(join(map, '.hw', 'haaklijst.txt'), lijst ?? readFileSync(ECHTE_LIJST, 'utf8'))
  cpSync(join(WORTEL, '.hw', 'toets-haaklijst.mjs'), join(map, '.hw', 'toets-haaklijst.mjs'))
  run(map, 'add', '.')
  run(map, 'commit', '-qm', 'basis')
  return map
}

const draaiToets = (map, basis, kop) =>
  execFileSync('node', [join(map, '.hw', 'toets-haaklijst.mjs'), basis, kop], {
    cwd: map, encoding: 'utf8', stdio: 'pipe',
  })

const vang = (fn) => {
  try {
    fn()
  } catch (e) {
    return e
  }
  return null
}

test('een nieuwe regel in een upstreambestand buiten de lijst faalt, met bestand:regel', () => {
  const map = maakRepo('# pad max\nmain.go 4\n')
  try {
    writeFileSync(join(map, 'router', 'relay-router.go'), 'package router\n\nfunc op() {\n}\n\nfunc hwExtra() {\n}\n')
    run(map, 'commit', '-qam', 'eigen regel')
    const fout = vang(() => draaiToets(map, 'HEAD~1', 'HEAD'))
    assert.ok(fout, 'de toets had moeten falen')
    assert.equal(fout.status, 1)
    assert.match(fout.stderr, /router\/relay-router\.go:5: \+3 eigen regels, staat niet op de haaklijst/)
  } finally {
    rmSync(map, { recursive: true, force: true })
  }
})

test('een eigen regel boven het maximum op de lijst faalt, met het maximum in de melding', () => {
  const map = maakRepo('# pad max\nmain.go 2\n')
  try {
    writeFileSync(join(map, 'main.go'), 'package main\n\nfunc main() {\n}\n\nfunc hwA() {\n}\n')
    run(map, 'commit', '-qam', 'drie eigen regels in main.go')
    const fout = vang(() => draaiToets(map, 'HEAD~1', 'HEAD'))
    assert.ok(fout, 'de toets had moeten falen')
    assert.match(fout.stderr, /main\.go:5: \+3 eigen regels, maximum op de haaklijst is 2/)
  } finally {
    rmSync(map, { recursive: true, force: true })
  }
})

test('een eigen regel binnen het maximum en een nieuw eigen bestand slagen', () => {
  const map = maakRepo('# pad max\nmain.go 3\nrouter/relay-router.go 0\n')
  try {
    writeFileSync(join(map, 'main.go'), 'package main\n\nfunc main() {\n}\n\nfunc hwA() {\n}\n')
    writeFileSync(join(map, 'hw_nieuw.go'), 'package main\n\nfunc hwNieuw() {\n}\n')
    run(map, 'add', '.')
    run(map, 'commit', '-qm', 'haak binnen maximum plus eigen bestand')
    assert.match(draaiToets(map, 'HEAD~1', 'HEAD'), /haaklijst ok/)
  } finally {
    rmSync(map, { recursive: true, force: true })
  }
})

test('de echte stand main..main slaagt', () => {
  assert.match(draaiToets(WORTEL, 'HEAD', 'HEAD'), /haaklijst ok/)
})

test('de haaklijst op de repo is leesbaar en elk maximum is een getal', () => {
  const limieten = leesHaaklijst(readFileSync(ECHTE_LIJST, 'utf8'))
  assert.ok(limieten.size >= 12)
  for (const [pad, max] of limieten) {
    assert.ok(!pad.startsWith('/'), `${pad} moet een relatief pad zijn`)
    assert.ok(Number.isInteger(max) && max >= 0, `${pad} heeft geen geldig maximum`)
  }
})

test('zonder upstream-tag telt een eigen bestand uit de basis niet als haak', () => {
  // De upstream-tag is onbereikbaar (ondiepe kloon, geen --tags in CI), dus de
  // basis is de maat. Onze eigen bestanden staan in de basis: een regel erbij
  // is dan geen haak, ook al bestaat het pad daar.
  const map = maakRepo('# pad max\n')
  try {
    mkdirSync(join(map, 'service'), { recursive: true })
    writeFileSync(join(map, 'service', 'hw_seed_defaults.go'), 'package service\n\nfunc hwSeed() {\n}\n')
    writeFileSync(join(map, 'router', 'relay-router.go'), 'package router\n\nfunc op() {\n}\n\nfunc hwExtra() {\n}\n')
    run(map, 'add', '.')
    run(map, 'commit', '-qm', 'eigen bestand plus haak in upstreambestand')
    const fout = vang(() => draaiToets(map, 'HEAD~1', 'HEAD'))
    assert.ok(fout, 'de haak in relay-router.go had moeten falen')
    assert.match(fout.stderr, /router\/relay-router\.go:5/)
    assert.doesNotMatch(fout.stderr, /hw_seed_defaults/)
  } finally {
    rmSync(map, { recursive: true, force: true })
  }
})

test('isEigenPad herkent onze paden en laat upstream met rust', () => {
  for (const pad of ['service/hw_seed_defaults.go', '.hw/haaklijst.txt', 'pkg/hwperf/speed.go', 'web/src/features/hw/api.ts']) {
    assert.equal(isEigenPad(pad), true, `${pad} is van ons`)
  }
  for (const pad of ['service/ratio.go', 'model/option.go', 'web/src/i18n/config.ts']) {
    assert.equal(isEigenPad(pad), false, `${pad} is van upstream`)
  }
})

test('beoordeel negeert hernoemde en binaire regels', () => {
  const limieten = new Map([['a.go', 1]])
  const fouten = beoordeel('5\t0\t{oud.go => nieuw.go}\n-\t-\tbeeld.png\n3\t1\ta.go\n', limieten, () => true)
  assert.deepEqual(fouten, [{ pad: 'a.go', eigen: 2, max: 1 }])
})
