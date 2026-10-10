import { describe, expect, it } from 'vitest';
import { getMCPAppAllowAttribute, getMCPAppCSP } from './sandbox';

describe('getMCPAppCSP', () => {
  it('returns undefined when no csp is provided', () => {
    expect(getMCPAppCSP()).toBeUndefined();
  });

  it('includes valid domains in their directives', () => {
    const csp = getMCPAppCSP({
      connectDomains: ['https://api.example.com'],
      resourceDomains: ['https://cdn.example.com'],
      frameDomains: ['https://frame.example.com'],
    });

    expect(csp).toContain("connect-src 'self' https://api.example.com");
    expect(csp).toContain("img-src 'self' data: https://cdn.example.com");
    expect(csp).toContain("frame-src 'self' https://frame.example.com");
  });

  it("locks down base-uri and form-action to 'none'", () => {
    const csp = getMCPAppCSP({});

    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'none'");
  });

  it('preserves wildcard subdomains and explicit ports', () => {
    const csp = getMCPAppCSP({
      connectDomains: ['https://*.example.com', 'https://api.example.com:8443'],
    });

    expect(csp).toContain(
      "connect-src 'self' https://*.example.com https://api.example.com:8443",
    );
  });

  it('drops domains that would break out of their directive', () => {
    const csp = getMCPAppCSP({
      connectDomains: [
        'https://api.example.test; script-src-elem https://attacker.example',
      ],
      resourceDomains: ['https://ok.example.com'],
      frameDomains: ['https://frame.example, https://evil.example'],
    });

    expect(csp).not.toContain('attacker.example');
    expect(csp).not.toContain('evil.example');
    expect(csp).not.toContain('script-src-elem');
    // policy still has exactly its nine intended directives
    expect(csp!.split(';')).toHaveLength(9);
    // untainted values are unaffected
    expect(csp).toContain('https://ok.example.com');
  });

  it('drops encoded separators that decode into a directive break', () => {
    const csp = getMCPAppCSP({
      // "%3B" would decode to ";" and split the directive if left encoded.
      connectDomains: ['https://a%3Bb.example.com'],
      resourceDomains: ['https://a%2Cb.example.com'],
    });

    expect(csp).not.toContain('%3B');
    expect(csp).not.toContain('%2C');
    expect(csp).not.toContain(';b.example.com');
    expect(csp).toContain("connect-src 'self';");
    expect(csp!.split(';')).toHaveLength(9);
  });

  it('drops match-all wildcards and quote characters', () => {
    const csp = getMCPAppCSP({
      connectDomains: [
        'https://*',
        'https://a"b.example.com',
        "https://a'b.example.com",
      ],
      resourceDomains: ['https://ok.example.com'],
    });

    // every connect source is rejected, leaving only 'self'
    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain('"');
    expect(csp).not.toContain('https://*');
    // an untainted value is still allowed
    expect(csp).toContain('https://ok.example.com');
  });

  it('drops non-https/wss schemes and bare keyword sources', () => {
    const csp = getMCPAppCSP({
      connectDomains: [
        'http://insecure.example.com',
        'javascript:alert(1)',
        'data:text/html,x',
        '*',
        "'unsafe-inline'",
      ],
    });

    expect(csp).toContain("connect-src 'self';");
    expect(csp).not.toContain('insecure.example.com');
    expect(csp).not.toContain('javascript:');
  });
});

describe('getMCPAppAllowAttribute', () => {
  it('denies all server-requested permissions without a host allowlist', () => {
    expect(
      getMCPAppAllowAttribute({
        camera: {},
        microphone: {},
        geolocation: {},
        clipboardWrite: {},
      }),
    ).toBeUndefined();
  });

  it('grants only the intersection of server-requested and host-allowed', () => {
    expect(
      getMCPAppAllowAttribute({ microphone: {}, camera: {} }, [
        'microphone',
        'geolocation',
      ]),
    ).toBe('microphone');
  });

  it('maps clipboardWrite to the clipboard-write feature', () => {
    expect(
      getMCPAppAllowAttribute({ clipboardWrite: {} }, ['clipboardWrite']),
    ).toBe('clipboard-write');
  });

  it('returns undefined when nothing is both requested and allowed', () => {
    expect(
      getMCPAppAllowAttribute({ camera: {} }, ['microphone']),
    ).toBeUndefined();
  });

  it('returns undefined when the server requests no permissions', () => {
    expect(getMCPAppAllowAttribute(undefined, ['camera'])).toBeUndefined();
  });
});
