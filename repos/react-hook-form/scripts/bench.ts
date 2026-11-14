// @ts-nocheck
/* eslint-disable */
/**
 * Microbenchmark for react-hook-form hot paths.
 *
 * Run standalone:   pnpm bench
 * Compare branches: pnpm bench:compare <branchA> <branchB>
 *
 * Pass --json to emit a machine-readable JSON array (used by bench-compare.ts).
 */

import { Bench } from 'tinybench';
import cloneObject from '../src/utils/cloneObject';
import { createFormControl } from '../src/logic/createFormControl';

const FIELDS = 50;
const JSON_MODE = process.argv.includes('--json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDefaults(n: number): Record<string, string> {
  const v: Record<string, string> = {};
  for (let i = 0; i < n; i++) v[`f${i}`] = '';
  return v;
}

function makeEvent(name: string, value: string) {
  // target.type is omitted → onChange uses getEventValue(event) instead of
  // getFieldValue(field._f), which avoids needing a real DOM element.
  return { type: 'change', target: { name, value } } as unknown as Event;
}

// ---------------------------------------------------------------------------
// Bench setup
// ---------------------------------------------------------------------------

const bench = new Bench({ time: 3000, warmupTime: 500 });

// ── 1. cloneObject baseline ─────────────────────────────────────────────────
// Shows the raw cost being saved by the _valuesSubscriberCount guard.
{
  const obj = makeDefaults(FIELDS);
  bench.add(`cloneObject  (${FIELDS} fields) — baseline cost`, () => {
    cloneObject(obj);
  });
}

// ── 2. setValue — no subscriber ─────────────────────────────────────────────
// Branch: state.next emits no `values` key  →  no clone, no extra alloc.
// Master: state.next always spreads `values: _formValues`.
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  let i = 0;
  bench.add(`setValue     (${FIELDS} fields, no subscriber)`, () => {
    form.setValue('f0', `v${i++}`);
  });
}

// ── 3. setValue — with subscriber ───────────────────────────────────────────
// Both branches include `values: _formValues` in the notification.
// Should show no regression vs scenario 2.
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  form.watch(() => {});
  let i = 0;
  bench.add(`setValue     (${FIELDS} fields, watch subscriber)`, () => {
    form.setValue('f0', `v${i++}`);
  });
}

// ── 4. onChange — no subscriber ─────────────────────────────────────────────
// Master: cloneObject(_formValues) on every DOM event (50-field form = expensive).
// Branch: skips clone entirely when _valuesSubscriberCount === 0.
{
  const form = createFormControl({
    defaultValues: makeDefaults(FIELDS),
    mode: 'onSubmit', // avoid per-keystroke validation overhead
  });
  form.register('f0');
  const { onChange } = form.register('f0');
  let i = 0;
  bench.add(`onChange     (${FIELDS} fields, no subscriber)`, async () => {
    await onChange(makeEvent('f0', `v${i++}`));
  });
}

// ── 5. onChange — with subscriber ───────────────────────────────────────────
// Both branches clone; validates no regression vs scenario 4.
{
  const form = createFormControl({
    defaultValues: makeDefaults(FIELDS),
    mode: 'onSubmit',
  });
  form.register('f0');
  const { onChange } = form.register('f0');
  form.watch(() => {});
  let i = 0;
  bench.add(`onChange     (${FIELDS} fields, watch subscriber)`, async () => {
    await onChange(makeEvent('f0', `v${i++}`));
  });
}

// ── 6. setValues — no subscriber ────────────────────────────────────────────
// setValues runs deepEqual then calls _setValue for every mounted field.
// Registers all FIELDS so the inner loop is exercised.
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  for (let i = 0; i < FIELDS; i++) form.register(`f${i}`);
  const scratch = makeDefaults(FIELDS);
  let i = 0;
  bench.add(`setValues    (${FIELDS} fields, no subscriber)`, () => {
    scratch['f0'] = String(i++); // ensure deepEqual never short-circuits
    form.setValues(scratch);
  });
}

// ── 7. setValues — with subscriber ──────────────────────────────────────────
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  for (let i = 0; i < FIELDS; i++) form.register(`f${i}`);
  form.watch(() => {});
  const scratch = makeDefaults(FIELDS);
  let i = 0;
  bench.add(`setValues    (${FIELDS} fields, watch subscriber)`, () => {
    scratch['f0'] = String(i++);
    form.setValues(scratch);
  });
}

// ── 8. reset — no subscriber ─────────────────────────────────────────────────
// reset always clones the values object and flushes form state.
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  const resetValues = makeDefaults(FIELDS);
  bench.add(`reset        (${FIELDS} fields, no subscriber)`, () => {
    form.reset(resetValues);
  });
}

// ── 9. reset — with subscriber ───────────────────────────────────────────────
{
  const form = createFormControl({ defaultValues: makeDefaults(FIELDS) });
  form.watch(() => {});
  const resetValues = makeDefaults(FIELDS);
  bench.add(`reset        (${FIELDS} fields, watch subscriber)`, () => {
    form.reset(resetValues);
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

export type BenchRow = {
  name: string;
  opsPerSec: number;
  avgUs: number;
  p99Us: number;
};

async function main() {
  if (!JSON_MODE)
    process.stderr.write(`Running ${bench.tasks.length} scenarios…\n`);

  await bench.run();

  const rows: BenchRow[] = bench.tasks.map((t) => {
    const r = (t as any).result;
    return {
      name: t.name,
      opsPerSec: r?.throughput ? Math.round(r.throughput.mean) : 0,
      avgUs: r?.latency ? r.latency.mean * 1000 : 0,
      p99Us: r?.latency ? r.latency.p99 * 1000 : 0,
    };
  });

  if (JSON_MODE) {
    process.stdout.write(JSON.stringify(rows) + '\n');
    return;
  }

  const tableRows = rows.map((r) => ({
    Scenario: r.name,
    'ops/sec': r.opsPerSec ? r.opsPerSec.toLocaleString() : 'ERROR',
    'avg µs': r.avgUs.toFixed(2),
    'p99 µs': r.p99Us.toFixed(2),
  }));

  console.log(`\n📊  react-hook-form — ${FIELDS}-field form benchmark\n`);
  console.table(tableRows);

  const noSub = rows.find(
    (r) => r.name.includes('onChange') && r.name.includes('no sub'),
  );
  const withSub = rows.find(
    (r) => r.name.includes('onChange') && r.name.includes('watch'),
  );
  if (noSub?.opsPerSec && withSub?.opsPerSec) {
    const ratio = noSub.opsPerSec / withSub.opsPerSec;
    console.log(
      `\nonChange no-subscriber is ${ratio.toFixed(1)}× faster than with-subscriber`,
      '(subscriber forces cloneObject)',
    );
  }
}

main();
