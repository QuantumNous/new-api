import { describe, expect, it, vi } from 'vitest';
import { normalizeOTPValue, removeOTPCharacter, replaceOTPValue, stripOTPWhitespace } from './otp';

describe('otp utils', () => {
  it('removes whitespace from pasted values', () => {
    expect(stripOTPWhitespace(' 12 3\t4\n5 ')).toBe('12345');
  });

  it('returns an empty string when stripping nullish values', () => {
    expect(stripOTPWhitespace(null)).toBe('');
    expect(stripOTPWhitespace(undefined)).toBe('');
  });

  it('normalizes, filters, and clamps numeric values', () => {
    expect(normalizeOTPValue('1a 2b34c56', 4, 'numeric')).toBe('1234');
  });

  it('normalizes alphabetic values', () => {
    expect(normalizeOTPValue('1a 2b3C4', 6, 'alpha')).toBe('abC');
  });

  it('normalizes alphanumeric values', () => {
    expect(normalizeOTPValue('A1-B2 c3!', 6, 'alphanumeric')).toBe('A1B2c3');
  });

  it('returns an empty string for nullish input values', () => {
    expect(normalizeOTPValue(null, 6, 'numeric')).toBe('');
    expect(normalizeOTPValue(undefined, 6, 'alpha')).toBe('');
  });

  it('uses custom normalization when validationType is none', () => {
    expect(
      normalizeOTPValue('ab-12 cd', 6, 'none', (value) =>
        value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase(),
      ),
    ).toBe('AB12CD');
  });

  it('applies custom normalization after built-in validation', () => {
    const normalizeValue = vi.fn((value: string) => value.toUpperCase());

    expect(normalizeOTPValue('ab-12 cd!', 6, 'alphanumeric', normalizeValue)).toBe('AB12CD');
    expect(normalizeValue).toHaveBeenCalledTimes(1);
    expect(normalizeValue).toHaveBeenCalledWith('ab12cd');
  });

  it('filters custom normalization output through built-in validation', () => {
    expect(normalizeOTPValue('12', 6, 'numeric', (value) => `${value}AB`)).toBe('12');
  });

  it('clamps values after custom normalization', () => {
    expect(normalizeOTPValue('123456', 4, 'numeric', (value) => `${value}789`)).toBe('1234');
  });

  it('returns an empty string for negative lengths', () => {
    expect(normalizeOTPValue('1234', -1, 'none')).toBe('');
  });

  it('replaces values from the middle of the OTP', () => {
    expect(replaceOTPValue('123456', 2, '99', 6, 'numeric')).toBe('129956');
  });

  it('replaces values from the first slot', () => {
    expect(replaceOTPValue('123456', 0, '99', 6, 'numeric')).toBe('993456');
  });

  it('replaces values at the last slot', () => {
    expect(replaceOTPValue('123456', 5, '9', 6, 'numeric')).toBe('123459');
  });

  it('applies custom normalization when replacing OTP values', () => {
    const normalizeValue = vi.fn((value: string) => value.toUpperCase());

    expect(replaceOTPValue('123456', 2, 'ab', 6, 'alphanumeric', normalizeValue)).toBe('12AB56');
  });

  it('preserves suffix characters when custom normalization removes part of a middle replacement', () => {
    expect(
      replaceOTPValue('1303', 1, '29', 4, 'numeric', (value) => value.replace(/[^0-3]/g, '')),
    ).toBe('1203');
  });

  it('removes a character from the first slot', () => {
    expect(removeOTPCharacter('1234', 0)).toBe('234');
  });

  it('removes a character from the last slot', () => {
    expect(removeOTPCharacter('1234', 3)).toBe('123');
  });

  it('leaves the value unchanged when removing an out-of-bounds index', () => {
    expect(removeOTPCharacter('1234', 10)).toBe('1234');
  });
});
