import { describe, it, expect } from 'vitest';
import i18next from '../../src/i18next.js';
import Logger from '../../src/logger.js';

// Security tests for fixes shipped in 26.0.6.
// See CHANGELOG for the associated GHSA advisory.

describe('security: warning for risky nesting-options pattern with escapeValue:false', () => {
  const makeSink = () => {
    const calls = [];
    return {
      calls,
      sink: {
        type: 'logger',
        log() {},
        warn(args) {
          calls.push(args);
        },
        error() {},
      },
    };
  };

  it('emits a warn when interpolated vars land inside a $t() options block with escapeValue:false', async () => {
    const { calls, sink } = makeSink();
    const instance = i18next.createInstance();
    instance.use(sink);
    await instance.init({
      lng: 'en',
      debug: true,
      interpolation: { escapeValue: false },
      resources: {
        en: {
          translation: {
            welcomeTitle: '$t(welcome, { "name": "{{userName}}" })',
            welcome: 'Hi {{name}}',
          },
        },
      },
    });
    instance.t('welcomeTitle', { userName: 'World' });
    const joined = calls
      .flat()
      .filter((x) => typeof x === 'string')
      .join(' ');
    expect(joined).toMatch(/nesting options string contains interpolated variables/);
    expect(joined).toMatch(/escapeValue: false/);
  });

  it('does NOT warn with escapeValue:true (default) — the pattern is safe there', async () => {
    const { calls, sink } = makeSink();
    const instance = i18next.createInstance();
    instance.use(sink);
    await instance.init({
      lng: 'en',
      debug: true,
      resources: {
        en: {
          translation: {
            welcomeTitle: '$t(welcome, { "name": "{{userName}}" })',
            welcome: 'Hi {{name}}',
          },
        },
      },
    });
    instance.t('welcomeTitle', { userName: 'World' });
    const joined = calls
      .flat()
      .filter((x) => typeof x === 'string')
      .join(' ');
    expect(joined).not.toMatch(/nesting options string contains interpolated variables/);
  });
});

describe('security: regexEscape on unescapePrefix/unescapeSuffix', () => {
  it('does not ReDoS when unescapePrefix contains regex metachars', async () => {
    const instance = i18next.createInstance();
    await instance.init({
      lng: 'en',
      interpolation: {
        escapeValue: false,
        // Intentionally pathological: a classic catastrophic-backtracking pattern
        unescapePrefix: '(a+)+',
      },
      resources: {
        en: {
          translation: {
            // A string that would historically trigger backtracking against
            // the un-escaped regex. Must evaluate in well under a second.
            safe: 'aaaaaaaaaaaaaaaaaaaaaaaaX',
          },
        },
      },
    });
    const start = Date.now();
    const out = instance.t('safe');
    const elapsed = Date.now() - start;
    expect(out).to.equal('aaaaaaaaaaaaaaaaaaaaaaaaX');
    expect(elapsed).toBeLessThan(100);
  });
});

describe('security: log injection control-character stripping', () => {
  it('strips CR, LF, NUL and other control characters from string log args', () => {
    const seen = [];
    const sink = {
      type: 'logger',
      log(args) {
        seen.push(['log', args]);
      },
      warn(args) {
        seen.push(['warn', args]);
      },
      error(args) {
        seen.push(['error', args]);
      },
    };
    Logger.init(sink, { debug: true });
    Logger.warn('missed key', 'en\r\n2026-04-18 admin login successful', 'lng\u0000');
    const args = seen[0][1];
    // prefix-augmented first arg must be joined, no CR/LF survive anywhere
    for (const arg of args) {
      if (typeof arg === 'string') {
        expect(arg).not.to.match(/[\r\n]/);
        expect(arg).not.to.include('\u0000');
      }
    }
    // non-string args pass through (logger is pluggable and structured args are legitimate)
  });

  it('does not mangle normal log content', () => {
    const seen = [];
    Logger.init(
      {
        type: 'logger',
        log(args) {
          seen.push(args);
        },
        warn(args) {
          seen.push(args);
        },
        error(args) {
          seen.push(args);
        },
      },
      { debug: true },
    );
    Logger.warn('normal message with {variables} and "quotes"');
    expect(seen[0][0]).to.include('normal message with {variables} and "quotes"');
  });
});
