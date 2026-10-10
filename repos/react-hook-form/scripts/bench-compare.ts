// @ts-nocheck
/* eslint-disable */
/**
 * Branch-vs-branch benchmark comparison.
 * Usage: pnpm bench:compare <branchA> <branchB>
 * Example: pnpm bench:compare master perf-improve-onChange
 */

import { execSync, spawnSync } from 'child_process';
import { copyFileSync, existsSync, mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import type { BenchRow } from './bench';

const [branchA, branchB] = process.argv.slice(2);
if (!branchA || !branchB) {
  console.error('Usage: pnpm bench:compare <branchA> <branchB>');
  process.exit(1);
}

const TSX = './node_modules/.bin/tsx';
const BENCH_SCRIPT = 'scripts/bench.ts';
const TMP_BENCH = join(tmpdir(), 'rhf-bench.ts');

// ---------------------------------------------------------------------------
// Git helpers
// ---------------------------------------------------------------------------

function git(cmd: string, opts: { silent?: boolean } = {}) {
  return execSync(`git ${cmd}`, {
    encoding: 'utf8',
    stdio: opts.silent
      ? ['ignore', 'pipe', 'ignore']
      : ['ignore', 'pipe', 'inherit'],
  }).trim();
}

function currentBranch() {
  return git('rev-parse --abbrev-ref HEAD', { silent: true });
}

// Only stash unstaged tracked changes — keeps staged new files (e.g. bench.ts) in place.
function hasUnstagedTrackedChanges() {
  return git('diff --name-only', { silent: true }).length > 0;
}

// ---------------------------------------------------------------------------
// Ensure bench.ts is available after a checkout
// ---------------------------------------------------------------------------

function saveBenchTs() {
  copyFileSync(BENCH_SCRIPT, TMP_BENCH);
}

function ensureBenchTs() {
  if (!existsSync(BENCH_SCRIPT)) {
    mkdirSync('scripts', { recursive: true });
    copyFileSync(TMP_BENCH, BENCH_SCRIPT);
  }
}

function removeBenchTsIfInjected() {
  if (!existsSync(BENCH_SCRIPT)) return;
  try {
    git('ls-files --error-unmatch scripts/bench.ts', { silent: true });
    // committed on this branch — leave it alone
  } catch {
    // we injected it — remove so stash pop doesn't conflict
    unlinkSync(BENCH_SCRIPT);
  }
}

// ---------------------------------------------------------------------------
// Run bench on a branch, return parsed rows
// ---------------------------------------------------------------------------

function runOnBranch(branch: string): BenchRow[] {
  process.stderr.write(`\n⏱  Checking out ${branch}…\n`);
  execSync(`git checkout ${branch}`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  ensureBenchTs();

  process.stderr.write(`   Running benchmarks on ${branch}…\n`);
  const result = spawnSync(TSX, [BENCH_SCRIPT, '--json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });

  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(`bench.ts exited with code ${result.status}`);

  return JSON.parse(result.stdout) as BenchRow[];
}

// ---------------------------------------------------------------------------
// Comparison table
// ---------------------------------------------------------------------------

function speedup(a: number, b: number): string {
  if (!a || !b) return '  n/a';
  const delta = (b - a) / a;
  if (Math.abs(delta) < 0.03) return ' ~same';
  const sign = delta > 0 ? '+' : '';
  const flag = delta >= 0.1 ? ' 🚀' : delta <= -0.1 ? ' ⚠️' : '';
  return `${sign}${(delta * 100).toFixed(0)}%${flag}`;
}

function printTable(rowsA: BenchRow[], rowsB: BenchRow[]) {
  const labelA = branchA.slice(0, 16).padStart(16);
  const labelB = branchB.slice(0, 16).padStart(16);
  const COL = 48;

  const header = `${'Scenario'.padEnd(COL)} ${labelA} ${labelB}  speedup`;
  console.log(`\n📊  react-hook-form — ${branchA} vs ${branchB}\n`);
  console.log(header);
  console.log('─'.repeat(header.length + 2));

  for (let i = 0; i < rowsA.length; i++) {
    const a = rowsA[i],
      b = rowsB[i];
    const fmtA = a.opsPerSec
      ? (a.opsPerSec.toLocaleString() + '/s').padStart(16)
      : '   ERROR'.padStart(16);
    const fmtB = b.opsPerSec
      ? (b.opsPerSec.toLocaleString() + '/s').padStart(16)
      : '   ERROR'.padStart(16);
    console.log(
      `${a.name.padEnd(COL)} ${fmtA} ${fmtB}  ${speedup(a.opsPerSec, b.opsPerSec)}`,
    );
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const origin = currentBranch();

// Save bench.ts to tmp before any git operations — it may not be committed
// to the target branches and git stash would remove it from the working tree.
saveBenchTs();

const needsStash = hasUnstagedTrackedChanges();
if (needsStash) {
  process.stderr.write('Stashing unstaged tracked changes…\n');
  // --keep-index: keeps staged files (bench.ts) in place; only stashes unstaged.
  execSync('git stash --keep-index', { stdio: 'inherit' });
}

let rowsA: BenchRow[] | undefined;
let rowsB: BenchRow[] | undefined;

try {
  rowsA = runOnBranch(branchA);
  rowsB = runOnBranch(branchB);
} finally {
  // Before restoring original branch, remove any bench.ts we injected (if not committed)
  // so that git checkout / stash pop doesn't hit a conflict.
  removeBenchTsIfInjected();

  process.stderr.write(`\nRestoring ${origin}…\n`);
  execSync(`git checkout ${origin}`, {
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  if (needsStash) execSync('git stash pop', { stdio: 'inherit' });

  // Ensure bench.ts is present on the restored branch (may have been stashed).
  ensureBenchTs();

  try {
    unlinkSync(TMP_BENCH);
  } catch {
    /* ignore */
  }
}

if (rowsA && rowsB) printTable(rowsA, rowsB);
