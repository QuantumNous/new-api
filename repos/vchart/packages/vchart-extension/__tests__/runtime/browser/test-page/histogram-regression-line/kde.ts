import { registerRegressionLine } from '../../../../../src/components/regression-line/regression-line';
import { appendHistogramRegressionLineConfig } from './../../../../../src/components/histogram-regression-line';
import { default as VChart } from '@visactor/vchart';

// expose vchart on window for debugging in tests
declare global {
  interface Window {
    vchart?: unknown;
  }
}

// --- gaussian generators (reproducible) ---
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMullerRandom(rng: () => number) {
  let u = 0;
  let v = 0;
  while (u === 0) {
    u = rng();
  }
  while (v === 0) {
    v = rng();
  }
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function generateGaussian(count: number, mean = 0, sd = 1, seed?: number) {
  const rng = seed === undefined ? Math.random : mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    out.push(mean + boxMullerRandom(rng) * sd);
  }
  return out;
}

function generateMixtureGaussianSamples() {
  const a = generateGaussian(160, 5, 4, 1); // cluster A
  // const b = generateGaussian(80, 2.3, 0.08, 2); // cluster B
  // const c = generateGaussian(140, 9.3, 0.35, 3); // cluster C
  const outliers = [5.0, 6.2, 3.5, 12.0, 0.5];
  const arr = [...a, ...outliers];
  return arr.map(v => ({ value: v }));
}

const spec = {
  data: [
    {
      name: 'data1',
      transforms: [
        {
          type: 'bin',
          options: {
            bins: 5,
            step: 2,
            field: 'value'
          }
        }
      ],
      values: generateMixtureGaussianSamples()
    }
  ],
  type: 'histogram',
  xField: 'x0',
  x2Field: 'x1',
  yField: 'count',
  bar: {
    style: {
      stroke: 'white',
      lineWidth: 1
    }
  },
  title: {
    text: 'Arrival Time Histogram',
    textStyle: {
      height: 50,
      lineWidth: 3,
      fill: '#333',
      fontSize: 25,
      fontFamily: 'Times New Roman'
    }
  },
  tooltip: {
    visible: true,
    mark: {
      title: {
        key: 'title',
        value: 'count'
      },
      content: [
        {
          key: (datum: Record<string, unknown>) =>
            String(datum['x0'] as unknown) + '～' + String(datum['x1'] as unknown),
          value: (datum: Record<string, unknown>) => Number(datum['count'] as unknown)
        }
      ]
    }
  }
};

const run = () => {
  registerRegressionLine();
  appendHistogramRegressionLineConfig(spec, {
    type: 'kde',
    line: {
      style: {
        stroke: 'red',
        lineWidth: 2
      }
    }
  });

  const cs = new VChart(spec, {
    dom: document.getElementById('chart') as HTMLElement,
    //theme: 'dark',
    onError: (err: unknown) => {
      // eslint-disable-next-line no-console
      console.error(err);
    }
  });

  cs.renderSync();

  // expose for debugging in tests
  window.vchart = cs;
};
run();
