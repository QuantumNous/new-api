import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const version = process.argv[2];

if (!version) {
  console.error('Usage: node --experimental-network-imports common/scripts/bytepack-smoke-test.mjs <version>');
  process.exit(1);
}

const attempts = Number(process.env.BYTEPACK_SMOKE_ATTEMPTS || 10);
const delayMs = Number(process.env.BYTEPACK_SMOKE_DELAY_MS || 30000);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const requireFromVChart = createRequire(path.join(repoRoot, 'packages/vchart/package.json'));
const Canvas = requireFromVChart('canvas');

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

async function runSmoke() {
  const vchartModule = await import(`https://bytepack.bytedance.net/@visactor/vchart@${version}`);
  const extensionModule = await import(
    `https://bytepack.bytedance.net/@visactor/vchart-extension@${version}/esm/charts/pie-3d/chart.js`
  );

  extensionModule.registerPie3dChart();

  const VChart = vchartModule.default ?? vchartModule.VChart;
  if (!VChart) {
    throw new Error('Unable to resolve VChart constructor from BytePack module.');
  }

  const chart = new VChart(
    {
      type: 'pie3d',
      width: 240,
      height: 240,
      data: [
        {
          id: 'data',
          values: [
            { category: 'A', value: 12 },
            { category: 'B', value: 18 }
          ]
        }
      ],
      categoryField: 'category',
      valueField: 'value',
      outerRadius: 0.72
    },
    {
      mode: 'node',
      modeParams: Canvas,
      animation: false,
      options3d: {
        enable: true
      }
    }
  );

  chart.renderSync();
  chart.release();
}

let lastError;
for (let attempt = 1; attempt <= attempts; attempt++) {
  try {
    console.log(`BytePack smoke test for @visactor/vchart@${version}, attempt ${attempt}/${attempts}`);
    await runSmoke();
    console.log(`BytePack smoke test passed for @visactor/vchart@${version}`);
    process.exit(0);
  } catch (err) {
    lastError = err;
    console.error(`BytePack smoke test failed on attempt ${attempt}/${attempts}:`);
    console.error(err && err.stack ? err.stack : err);

    if (attempt < attempts) {
      await wait(delayMs);
    }
  }
}

console.error(`BytePack smoke test failed after ${attempts} attempts.`);
if (lastError) {
  console.error(lastError && lastError.stack ? lastError.stack : lastError);
}
process.exit(1);
