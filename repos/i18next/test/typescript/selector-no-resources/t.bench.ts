import { bench } from '@arktype/attest';
import {} from './i18next';
import type { TFunction } from 'i18next';

declare const t: TFunction;

bench('selector usage benchmark', () => {
  t(($) => $.a.b.c.d.e.f);
}).types([438, 'instantiations']);
