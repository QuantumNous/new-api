import { expect } from 'vitest';
import { getFilter } from './filter';

describe('getFilter', () => {
  it('caches different Intl.Locale objects separately', () => {
    const filter1 = getFilter({ locale: new Intl.Locale('fr-FR') });
    const filter2 = getFilter({ locale: new Intl.Locale('en-US') });

    expect(filter1).not.toBe(filter2);
  });
});
