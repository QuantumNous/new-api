import { spawn } from 'child_process';
import { appendFileSync } from 'fs';
import { run } from '../lib/run';

const moduleName = process.argv[2];

if (!moduleName) {
  console.error(
    'Please provide a module name as an argument, e.g., "@ai-sdk/anthropic"',
  );
  process.exit(1);
}

async function runInSeparateProcess(): Promise<number> {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [
      '--input-type=module',
      '--eval',
      `
const t0 = performance.now();
await import('${moduleName}');
const t1 = performance.now();
console.log(t1 - t0);
      `.trim(),
    ]);

    let output = '';
    child.stdout.on('data', data => {
      output += data.toString();
    });

    child.stderr.on('data', data => {
      console.error('Error:', data.toString());
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Child process exited with code ${code}`));
      } else {
        resolve(parseFloat(output.trim()));
      }
    });
  });
}

run(async () => {
  const times: number[] = [];
  const iterations = 50;

  console.log(`Running import benchmark 10 times for ${moduleName}...\n`);

  for (let i = 0; i < iterations; i++) {
    const time = await runInSeparateProcess();
    console.log(`Run ${i + 1}: ${time.toFixed(1)} ms`);
    times.push(time);
  }

  const average = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);

  console.log(`\n--- Statistics ---`);

  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median =
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];

  console.log(`Median: ${median.toFixed(1)} ms`);
  console.log(`Average: ${average.toFixed(1)} ms`);
  console.log(`Min: ${min.toFixed(1)} ms`);
  console.log(`Max: ${max.toFixed(1)} ms`);
  console.log(`Range: ${(max - min).toFixed(1)} ms`);

  // Write to GitHub Actions output if running in CI
  if (process.env.GITHUB_OUTPUT) {
    // remove "@ai-sdk/" prefix if present
    const outputKey = moduleName.replace(/^@ai-sdk\//, '');
    const outputValue = median.toFixed(1);

    try {
      appendFileSync(
        process.env.GITHUB_OUTPUT,
        `${outputKey}=${outputValue}\n`,
      );
      console.log(
        `\n✅ Written to GitHub Actions output: ${outputKey}=${outputValue}`,
      );
    } catch (error) {
      console.error('Failed to write to GitHub Actions output:', error);
    }
  }
});
