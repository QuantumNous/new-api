import { bench } from '@arktype/attest';
import {} from './i18next';
import type { TFunction } from 'i18next';

declare const t: TFunction;

bench('t() return type resolution', () => {
  t('bar');
}).types([1, 'instantiations']);

bench('fallback t() return type resolution', () => {
  t('fallbackKey');
}).types([1, 'instantiations']);

bench('fallback2 t() return type resolution', () => {
  t('anotherFallbackKey');
}).types([1, 'instantiations']);
