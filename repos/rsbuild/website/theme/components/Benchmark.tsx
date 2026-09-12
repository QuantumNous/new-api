import { useI18n } from '@rspress/core/runtime';
import { Benchmark as BaseBenchmark, type BenchmarkData } from '@rstack-dev/doc-ui/benchmark';
import {
  containerStyle,
  descStyle,
  innerContainerStyle,
  titleAndDescStyle,
  titleStyle,
} from '@rstack-dev/doc-ui/section-style';

// Benchmark data for different cases
// Unit: second
// From: https://github.com/rstackjs/build-tools-performance
const BENCHMARK_DATA: BenchmarkData = {
  rspack: {
    label: 'Rsbuild',
    metrics: [
      {
        time: 1.36,
        desc: 'dev',
      },
      {
        time: 3.35,
        desc: 'build',
      },
      {
        time: 0.16,
        desc: 'hmr',
      },
    ],
  },
  vite: {
    label: 'Vite',
    metrics: [
      {
        time: 6.5,
        desc: 'dev',
      },
      {
        time: 1.98,
        desc: 'build',
      },
      {
        time: 0.13,
        desc: 'hmr',
      },
    ],
  },
  webpack: {
    label: 'webpack',
    metrics: [
      {
        time: 21.4,
        desc: 'dev',
      },
      {
        time: 28.1,
        desc: 'build',
      },
      {
        time: 2.78,
        desc: 'hmr',
      },
    ],
  },
};

export function BenchmarkGraph() {
  return <BaseBenchmark data={BENCHMARK_DATA} />;
}

export function Benchmark() {
  const t = useI18n<typeof import('i18n')>();
  return (
    <section className={containerStyle}>
      <div className={innerContainerStyle}>
        <div className={titleAndDescStyle}>
          <h1 className={titleStyle}>{t('benchmarkTitle')}</h1>
          <p className={descStyle}>{t('benchmarkDesc')}</p>
        </div>
        <BenchmarkGraph />
      </div>
    </section>
  );
}
