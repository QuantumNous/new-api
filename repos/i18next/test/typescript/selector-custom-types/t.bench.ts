import { bench } from '@arktype/attest';
import {} from './i18next';
import type { TFunction } from 'i18next';

declare const t: TFunction;

bench('selector usage benchmark', () => {
  t(($) => $.baz.bing);
}).types([3392, 'instantiations']);
