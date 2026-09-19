import { $ } from "execa";
import * as gen from "./generate.js";

// detect control c and process.exit()
process.on("SIGINT", () => {
  for (const proc of procs) {
    if (proc.killed) continue;
    console.log(`killing ${proc.pid}`);
    proc.kill();
  }

  throw new Error("Exiting...");
});

/**
 * Target: 300
 * 1, null, 1
 * 1, null, 2
 * 1, null, 4
 * 1, null, 8
 * 1, null, 16
 * 1, null, 32
 * 1, null, 64
 * 1, null, 128
 * 1, null, 256
 * 1, null, 512 (fail)
 * 1, 256, 512
 * 1, 256, 384
 *
 */
const procs: any[] = [];

// bisect
let MAX: number | null = null;
let MIN = 1;
let CURR = MIN;

// regular object: 43478
// regular interface: 33328
// shape interface: 43472

while (!MAX || MAX - MIN > 2) {
  gen.generateExtendChain({
    ...gen.ARKTYPE,
    numSchemas: CURR,
    numKeys: 6,
  });

  console.log(`Attempting tsc compilation...`);
  const _proc = $`pnpm run build:bench`;

  try {
    procs.push(_proc);
    process.on("SIGINT", () => _proc.kill());
    const proc = await _proc;

    // get instantiations
    const time = proc.stdout.match(/total time:\s+(.+)/i)![1];
    const instantiations = proc.stdout.match(/instantiations:\s+(.+)/i)![1];
    const memory = proc.stdout.match(/memory used:\s+(.+)/i)![1];
    console.log(`Compilation succeeded.\n   Time: ${time}\n   Instantiations: ${instantiations}\n   Memory ${memory}`);

    // success
    if (!MAX) {
      CURR = CURR * 2;
    } else {
      MIN = CURR;
      CURR = Math.floor((MAX + MIN) / 2);
    }
  } catch (err: any) {
    // fail
    console.log("tsc compilation failed...");
    console.log(err);
    if (err.isTerminated) process.exit();
    MAX = CURR;
    CURR = Math.floor((MAX + MIN) / 2);
  }

  // console.log({ MIN, MAX, CURR });
  // prettier output
  console.log(`Range: [${MIN}, ${MAX}]\nCurrent: ${CURR}`);
  console.log("--------------------");

  if (MAX) console.log("diff: ", MAX - MIN);
}

console.log("ANSWER: ", MIN);
