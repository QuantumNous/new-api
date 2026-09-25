import { expect } from 'vitest';
import { stringifyLocale } from './stringifyLocale';

describe('stringifyLocale', () => {
  it('stringifies Intl locale arguments for cache keys', () => {
    expect(stringifyLocale()).toBe('');
    expect(stringifyLocale('en-US')).toBe('en-US');
    expect(stringifyLocale(new Intl.Locale('fr-FR'))).toBe('fr-FR');
    expect(stringifyLocale(['fr-FR', new Intl.Locale('en-US')])).toBe('fr-FR,en-US');
  });
});
