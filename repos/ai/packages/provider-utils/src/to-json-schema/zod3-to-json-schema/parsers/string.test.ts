import { describe, it, expect } from 'vitest';
import type { JSONSchema7 } from '@ai-sdk/provider';
import { z } from 'zod/v3';
import { getRefs } from '../refs';
import { parseStringDef, zodPatterns } from './string';

describe('string', () => {
  it('should be possible to describe minimum length of a string', () => {
    const parsedSchema = parseStringDef(z.string().min(5)._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      minLength: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe maximum length of a string', () => {
    const parsedSchema = parseStringDef(z.string().max(5)._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      maxLength: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to describe both minimum and maximum length of a string', () => {
    const parsedSchema = parseStringDef(
      z.string().min(5).max(5)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      minLength: 5,
      maxLength: 5,
    } satisfies JSONSchema7);
  });

  it('should be possible to use email constraint', () => {
    const parsedSchema = parseStringDef(z.string().email()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'email',
    } satisfies JSONSchema7);
  });

  it('should be possible to use uuid constraint', () => {
    const parsedSchema = parseStringDef(z.string().uuid()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'uuid',
    } satisfies JSONSchema7);
  });
  it('should be possible to use url constraint', () => {
    const parsedSchema = parseStringDef(z.string().url()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'uri',
    } satisfies JSONSchema7);
  });

  it('should be possible to use regex constraint', () => {
    const parsedSchema = parseStringDef(
      z.string().regex(/[A-C]/)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      pattern: '[A-C]',
    } satisfies JSONSchema7);
  });

  it('should be possible to use CUID constraint', () => {
    const parsedSchema = parseStringDef(z.string().cuid()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      pattern: '^[cC][^\\s-]{8,}$',
    } satisfies JSONSchema7);
  });

  it('should be possible to use Cuid2 constraint', () => {
    const parsedSchema = parseStringDef(z.string().cuid2()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      pattern: '^[0-9a-z]+$',
    } satisfies JSONSchema7);
  });

  it('should be possible to use datetime constraint', () => {
    const parsedSchema = parseStringDef(z.string().datetime()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'date-time',
    } satisfies JSONSchema7);
  });

  it('should be possible to use date constraint', () => {
    const parsedSchema = parseStringDef(z.string().date()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'date',
    } satisfies JSONSchema7);
  });

  it('should be possible to use time constraint', () => {
    const parsedSchema = parseStringDef(z.string().time()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'time',
    } satisfies JSONSchema7);
  });

  it('should be possible to use duration constraint', () => {
    const parsedSchema = parseStringDef(z.string().duration()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      format: 'duration',
    } satisfies JSONSchema7);
  });

  it('should be possible to use length constraint', () => {
    const parsedSchema = parseStringDef(z.string().length(15)._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      minLength: 15,
      maxLength: 15,
    } satisfies JSONSchema7);
  });

  it('should be possible to use length with min and max constraints', () => {
    const parsedSchema = parseStringDef(
      z.string().min(20).max(25).length(15)._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
      minLength: 20,
      maxLength: 15,
    } satisfies JSONSchema7);
  });

  it('should gracefully ignore the .trim() "check"', () => {
    const parsedSchema = parseStringDef(z.string().trim()._def, getRefs());

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });

  it('should gracefully ignore the .toLowerCase() "check"', () => {
    const parsedSchema = parseStringDef(
      z.string().toLowerCase()._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });

  it('should gracefully ignore the .toUpperCase() "check"', () => {
    const parsedSchema = parseStringDef(
      z.string().toUpperCase()._def,
      getRefs(),
    );

    expect(parsedSchema).toStrictEqual({
      type: 'string',
    } satisfies JSONSchema7);
  });

  it('should work with the startsWith check', () => {
    expect(
      parseStringDef(z.string().startsWith('aBcD123{}[]')._def, getRefs()),
    ).toStrictEqual({
      type: 'string',
      pattern: '^aBcD123\\{\\}\\[\\]',
    } satisfies JSONSchema7);
  });

  it('should work with the endsWith check', () => {
    expect(
      parseStringDef(z.string().endsWith('aBcD123{}[]')._def, getRefs()),
    ).toStrictEqual({
      type: 'string',
      pattern: 'aBcD123\\{\\}\\[\\]$',
    } satisfies JSONSchema7);
  });

  it('should work with the includes check', () => {
    expect(
      parseStringDef(z.string().includes('aBcD123{}[]')._def, getRefs()),
    ).toStrictEqual({
      type: 'string',
      pattern: 'aBcD123\\{\\}\\[\\]',
    } satisfies JSONSchema7);
  });

  it('should work with the preserve patternStrategy', () => {
    expect(
      parseStringDef(
        z.string().includes('aBcD123{}[]')._def,
        getRefs({
          patternStrategy: 'preserve',
        }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: 'aBcD123{}[]',
    } satisfies JSONSchema7);
  });

  it('should bundle multiple pattern type checks in an allOf container', () => {
    expect(
      parseStringDef(
        z.string().startsWith('alpha').endsWith('omega')._def,
        getRefs(),
      ),
    ).toStrictEqual({
      type: 'string',
      allOf: [
        {
          pattern: '^alpha',
        },
        {
          pattern: 'omega$',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should pick correct value if multiple min/max are present', () => {
    expect(
      parseStringDef(z.string().min(1).min(2).max(3).max(4)._def, getRefs()),
    ).toStrictEqual({
      type: 'string',
      maxLength: 3,
      minLength: 2,
    } satisfies JSONSchema7);
  });

  it('should bundle multiple formats into anyOf', () => {
    const zodSchema = z.string().ip().email();
    const jsonParsedSchema = parseStringDef(zodSchema._def, getRefs());

    expect(jsonParsedSchema).toStrictEqual({
      type: 'string',
      anyOf: [
        {
          format: 'ipv4',
        },
        {
          format: 'ipv6',
        },
        {
          format: 'email',
        },
      ],
    } satisfies JSONSchema7);
  });

  it('should default to contentEncoding for base64, but format and pattern should also work', () => {
    const def = z.string().base64()._def;

    expect(parseStringDef(def, getRefs())).toStrictEqual({
      type: 'string',
      contentEncoding: 'base64',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        def,
        getRefs({ base64Strategy: 'contentEncoding:base64' }),
      ),
    ).toStrictEqual({
      type: 'string',
      contentEncoding: 'base64',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(def, getRefs({ base64Strategy: 'format:binary' })),
    ).toStrictEqual({
      type: 'string',
      format: 'binary',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(def, getRefs({ base64Strategy: 'pattern:zod' })),
    ).toStrictEqual({
      type: 'string',
      pattern: zodPatterns.base64.source,
    } satisfies JSONSchema7);
  });

  it('should be possible to use nanoid constraint', () => {
    const def = z.string().nanoid()._def;

    expect(parseStringDef(def, getRefs())).toStrictEqual({
      type: 'string',
      pattern: '^[a-zA-Z0-9_-]{21}$',
    } satisfies JSONSchema7);
  });

  it('should be possible to use ulid constraint', () => {
    const def = z.string().ulid()._def;

    expect(parseStringDef(def, getRefs())).toStrictEqual({
      type: 'string',
      pattern: '^[0-9A-HJKMNP-TV-Z]{26}$',
    } satisfies JSONSchema7);
  });

  it('should be possible to pick format:email, format:idn-email or pattern:zod', () => {
    expect(parseStringDef(z.string().email()._def, getRefs())).toStrictEqual({
      type: 'string',
      format: 'email',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().email()._def,
        getRefs({ emailStrategy: 'format:email' }),
      ),
    ).toStrictEqual({
      type: 'string',
      format: 'email',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().email()._def,
        getRefs({ emailStrategy: 'format:idn-email' }),
      ),
    ).toStrictEqual({
      type: 'string',
      format: 'idn-email',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().email()._def,
        getRefs({ emailStrategy: 'pattern:zod' }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: zodPatterns.email.source,
    } satisfies JSONSchema7);
  });

  it('should correctly handle reasonable non-contrived regexes with flags', () => {
    expect(
      parseStringDef(
        z.string().regex(/(^|\^foo)Ba[r-z]+./)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: '(^|\\^foo)Ba[r-z]+.',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().regex(/(^|\^foo)Ba[r-z]+./i)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: '(^|\\^[fF][oO][oO])[bB][aA][r-zR-Z]+.',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().regex(/(^|\^foo)Ba[r-z]+./ms)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: '((^|(?<=[\r\n]))|\\^foo)Ba[r-z]+[.\r\n]',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().regex(/(^|\^foo)Ba[r-z]+./ims)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: '((^|(?<=[\r\n]))|\\^[fF][oO][oO])[bB][aA][r-zR-Z]+[.\r\n]',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().regex(/foo.+$/m)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: 'foo.+($|(?=[\r\n]))',
    } satisfies JSONSchema7);

    expect(
      parseStringDef(
        z.string().regex(/foo.+[amz]/i)._def,
        getRefs({ applyRegexFlags: true }),
      ),
    ).toStrictEqual({
      type: 'string',
      pattern: '[fF][oO][oO].+[aAmMzZ]',
    } satisfies JSONSchema7);
  });

  it('Unescape forward slashes', () => {
    const zodSchema = z.string().regex(/^\/$/);

    const jsonSchema = parseStringDef(zodSchema._def, getRefs());

    const pattern = jsonSchema.pattern!;
    const patternJson = JSON.stringify(pattern);
    const patternJsonParsed = JSON.parse(patternJson);

    const regexp = new RegExp(patternJsonParsed);
    expect(regexp.test('')).toBe(false);
    expect(regexp.test('/')).toBe(true);
    expect(regexp.test('//')).toBe(false);
  });
});
