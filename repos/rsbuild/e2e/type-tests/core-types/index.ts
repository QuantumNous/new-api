// This folder checks the preset module declarations from @rsbuild/core/types.
import styles from './style.module.css';
import './style.css';
import cssUrl from './style.css?url';
import inlineCss from './style.css?inline';
import rawCss from './style.css?raw';
import pngUrl from './image.png?url';
import inlinePng from './image.png?inline';
import rawSvg from './logo.svg?raw';
import rawJson from './data.json?raw';
import rawTs from './module.ts?raw';
import QueryWorker from './worker.ts?worker';
import InlineWorker from './worker.ts?worker&inline';
import InlineWorkerReordered from './worker.ts?inline&worker';

const stringResults: string[] = [
  styles.root,
  cssUrl,
  inlineCss,
  rawCss,
  pngUrl,
  inlinePng,
  rawSvg,
  rawJson,
  rawTs,
];

const workerResults: Worker[] = [
  new QueryWorker({ name: 'query-worker' }),
  new InlineWorker({ name: 'inline-worker' }),
  new InlineWorkerReordered({ name: 'inline-worker-reordered' }),
];

export { stringResults, workerResults };
