import { bench } from '@arktype/attest';
import {} from './i18next';
import type { TFunction } from 'i18next';

declare const t: TFunction;

bench('selector usage benchmark', () => {
  t('coffee.bar.espresso|cappuccino');
}).types([24147, 'instantiations']);
