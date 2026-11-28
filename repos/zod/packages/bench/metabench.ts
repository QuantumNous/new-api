import Benchmark from "benchmark";
import chalk from "chalk";
import { Table } from "console-table-printer";
import * as mitata from "mitata";
import { Bench } from "tinybench";

// import { assertNever } from "../packages/zod-core/src/index.js";
import { formatNumber } from "./benchUtil.js";

type BENCH = "tinybench" | "benchmarkjs" | "mitata";
const BENCH: BENCH = (process.env.BENCH as BENCH) || "mitata";

type Benchmarks<T = unknown> = { [k: string]: (d: T) => any };
export function metabench<D>(name: string, benchmarks?: Benchmarks<D>): Metabench {
  let bench: Metabench;
  if (BENCH === "tinybench") {
    bench = new Tinybench(name, benchmarks || {});
  } else if (BENCH === "benchmarkjs") {
    bench = new BenchmarkJS(name, benchmarks || {});
  } else if (BENCH === "mitata") {
    bench = new Mitata(name, benchmarks || {});
  } else {
    throw new Error(`Unknown benchmark runner: ${BENCH}`);
  }
  // console.log(`running benchmark with ${BENCH}...`);
  return bench;
}

interface BenchWithDataParams<D> {
  name: string;
  data: () => D;
  batch?: number | null;
  benchmarks?: Benchmarks<D>;
}

export function benchWithData<D>(params: BenchWithDataParams<D> & ThisType<{ data: D }>): Metabench<D> {
  const bench = metabench(params.name);
  // console.log(`Batch size: ${params.batch}`);

  if (params.batch === null) {
    const DATA = params.data();
    for (const key in params.benchmarks) {
      const _bench = params.benchmarks[key].bind({
        data: DATA,
      }) as any;
      bench.add(key, _bench);
    }
  } else {
    const DATA = Array.from({ length: params.batch || 1000 }, params.data);
    for (const key in params.benchmarks) {
      const _bench = params.benchmarks[key].bind({
        data: DATA,
      }) as any;
      bench.add(key, () => {
        for (const d of DATA) {
          _bench(d);
        }
      });
    }
  }

  return bench;
}

abstract class Metabench<D = any> {
  abstract run(): void | Promise<void>;

  constructor(
    public name: string,
    public benchmarks: Benchmarks<D>
    //  params?: Omit<MetabenchParams<D>, "name" | "benchmarks">
  ) {}

  add(name: string, fn: (val: D) => any): this {
    this.benchmarks![name] = fn;
    return this;
  }
}

class Tinybench extends Metabench {
  runner = "tinybench";
  async run() {
    const bench = new Bench({ time: 1500 });
    for (const [name, fn] of Object.entries(this.benchmarks)) {
      bench.add(name, fn as any);
    }
    // await runBench(this.name, bench);
    console.log();
    console.log(`   benchmarking ${chalk.bold.white(this.name)} with ${chalk.bold.white(this.runner)}`);

    bench.addEventListener("cycle", (e) => {
      const task = e.task?.result;
      if (!task) throw new Error("Task has no result");

      console.log(
        chalk.dim("   ") +
          chalk.white.dim(`→ `) +
          chalk.white(e.task.name) +
          chalk.white.dim(" ") +
          chalk.cyan(formatNumber(task.hz)) +
          chalk.cyan(` ops/sec`) +
          chalk.dim(` (${e.task.result?.totalTime.toFixed(2)}ms)`)
      );
    });

    await bench.warmup();
    await bench.run();

    const sorted = bench.tasks.sort((a, b) => {
      if (!a.result || !b.result) throw new Error("Task has no result");
      return a.result?.mean - b.result?.mean;
    });
    // const fastest = sorted[0];
    const slowest = sorted[sorted.length - 1];

    const table = new Table({
      columns: [
        { name: "name", color: "white" },
        { name: "summary", alignment: "left" },
        { name: "ops/sec", color: "cyan" },
        { name: "time/op", color: "magenta" },
        { name: "margin", color: "magenta" },
        { name: "samples", color: "magenta" },
      ],
    });

    for (const task of sorted) {
      const result = task.result;
      if (!result) throw new Error("Task has no result");
      if (!slowest.result) throw new Error("Task has no result");
      table.addRow({
        name: task.name,
        summary:
          task === slowest ? "slowest" : `${(result.hz / slowest.result.hz).toFixed(3)}x faster than ${slowest.name}`,
        "ops/sec": `${formatNumber(result.hz)} ops/sec`,
        "time/op": `${formatNumber(result.mean / 1000)}s`,
        margin: `±${result.rme.toFixed(2)}%`,
        samples: result.samples.length,
      });
    }
    const rendered = `   ${table.render().split("\n").join("\n   ")}`;
    console.log();
    console.log(rendered);
    console.log();
  }
}

class BenchmarkJS extends Metabench {
  runner = "benchmarkjs";
  async run() {
    const suite = new Benchmark.Suite();
    console.log(`  benchmarking ${chalk.white(this.name)} with ${this.runner}`);
    for (const name in this.benchmarks) {
      const fn = this.benchmarks[name];
      suite.add(name, fn);
    }
    suite.on("cycle", (event: Benchmark.Event) => {
      // const target = event.target;
      // console.log(target.name, target.hz, target.stats!.mean);
      console.log(chalk.white.dim(`  → ${String(event.target)}`));
      // print summary
    });
    suite.on("complete", (event: Benchmark.Event) => {
      // print summary
      const suite = event.currentTarget as Benchmark.Suite;

      // for(const benchmark of suite){}
      const results: {
        name: string;
        hz: number;
        mean: number;
        rme: number;
        samples: number;
      }[] = suite.map((benchmark: Benchmark) => ({
        name: benchmark.name,
        hz: benchmark.hz,
        mean: benchmark.stats.mean,
        rme: benchmark.stats.rme,
        samples: benchmark.stats.sample.length,
      }));

      results.sort((a, b) => a.hz - b.hz).reverse();
      const slowest = results[results.length - 1];

      const table = new Table({
        columns: [
          { name: "name", color: "white" },
          { name: "summary", alignment: "left" },
          { name: "ops/sec", color: "cyan" },
          { name: "time/op", color: "magenta" },
          { name: "margin", color: "magenta" },
          { name: "samples", color: "magenta" },
        ],
      });
      for (const result of results) {
        table.addRow({
          name: result.name,
          summary:
            result === slowest ? "slowest" : `${(result.hz / slowest.hz).toFixed(3)}x faster than ${slowest.name}`,
          "ops/sec": `${formatNumber(result.hz)} ops/sec`,
          "time/op": `${formatNumber(1 / result.hz)}s`,
          margin: `±${result.rme.toFixed(2)}%`,
          samples: result.samples,
        });
      }

      const rendered = `  ${table.render().split("\n").join("\n  ")}`;
      console.log();
      console.log(rendered);
      console.log();
    });
    await suite.run();
  }
}

class Mitata extends Metabench {
  runner = "mitata";
  async run() {
    mitata.group(this.name, () => {
      for (const [name, fn] of Object.entries(this.benchmarks)) {
        mitata.bench(name, fn as any);
      }
    });

    mitata.run();
  }
}
