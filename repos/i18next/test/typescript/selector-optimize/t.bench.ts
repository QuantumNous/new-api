import { bench } from '@arktype/attest';
import {} from './i18next';
import type { TFunction } from 'i18next';

declare const t: TFunction;

bench('selector usage benchmark', () => {
  t(($) => $.z2_mA5z$.D1_N9I.C.HvalueOf.A2$R$.Ais.CY3.Z3DV$2$$_1.CA_len);
}).types([459, 'instantiations']);
