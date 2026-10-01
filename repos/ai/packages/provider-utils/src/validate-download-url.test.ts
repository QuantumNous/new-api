import { describe, it, expect } from 'vitest';
import { validateDownloadUrl } from './validate-download-url';
import { DownloadError } from './download-error';

describe('validateDownloadUrl', () => {
  describe('allowed URLs', () => {
    it('should allow https URLs', () => {
      expect(() =>
        validateDownloadUrl('https://example.com/image.png'),
      ).not.toThrow();
    });

    it('should allow http URLs', () => {
      expect(() =>
        validateDownloadUrl('http://example.com/image.png'),
      ).not.toThrow();
    });

    it('should allow public IP addresses', () => {
      // 8.8.8.8 — a genuinely public, globally-routable address. The TEST-NET
      // documentation ranges (192.0.2/24, 198.51.100/24, 203.0.113/24) are
      // blocked.
      expect(() => validateDownloadUrl('https://8.8.8.8/file')).not.toThrow();
    });

    it('should allow URLs with ports', () => {
      expect(() =>
        validateDownloadUrl('https://example.com:8080/file'),
      ).not.toThrow();
    });

    it('should allow data URLs', () => {
      expect(() =>
        validateDownloadUrl('data:text/plain;base64,aGVsbG8='),
      ).not.toThrow();
    });
  });

  describe('blocked protocols', () => {
    it('should block file:// URLs', () => {
      expect(() => validateDownloadUrl('file:///etc/passwd')).toThrow(
        DownloadError,
      );
    });

    it('should block ftp:// URLs', () => {
      expect(() => validateDownloadUrl('ftp://example.com/file')).toThrow(
        DownloadError,
      );
    });

    it('should block javascript: URLs', () => {
      expect(() => validateDownloadUrl('javascript:alert(1)')).toThrow(
        DownloadError,
      );
    });
  });

  describe('malformed URLs', () => {
    it('should block invalid URLs', () => {
      expect(() => validateDownloadUrl('not-a-url')).toThrow(DownloadError);
    });
  });

  describe('blocked hostnames', () => {
    it('should block localhost', () => {
      expect(() => validateDownloadUrl('http://localhost/file')).toThrow(
        DownloadError,
      );
    });

    it('should block localhost with port', () => {
      expect(() => validateDownloadUrl('http://localhost:3000/file')).toThrow(
        DownloadError,
      );
    });

    it('should block .local domains', () => {
      expect(() => validateDownloadUrl('http://myhost.local/file')).toThrow(
        DownloadError,
      );
    });

    it('should block .localhost domains', () => {
      expect(() => validateDownloadUrl('http://app.localhost/file')).toThrow(
        DownloadError,
      );
    });
  });

  describe('blocked IPv4 addresses', () => {
    it('should block 127.0.0.1 (loopback)', () => {
      expect(() => validateDownloadUrl('http://127.0.0.1/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 127.x.x.x range', () => {
      expect(() => validateDownloadUrl('http://127.255.0.1/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 10.x.x.x (private)', () => {
      expect(() => validateDownloadUrl('http://10.0.0.1/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 172.16.x.x - 172.31.x.x (private)', () => {
      expect(() => validateDownloadUrl('http://172.16.0.1/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://172.31.255.255/file')).toThrow(
        DownloadError,
      );
    });

    it('should allow 172.15.x.x and 172.32.x.x (public)', () => {
      expect(() => validateDownloadUrl('http://172.15.0.1/file')).not.toThrow();
      expect(() => validateDownloadUrl('http://172.32.0.1/file')).not.toThrow();
    });

    it('should block 192.168.x.x (private)', () => {
      expect(() => validateDownloadUrl('http://192.168.1.1/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 169.254.x.x (link-local / cloud metadata)', () => {
      expect(() =>
        validateDownloadUrl('http://169.254.169.254/latest/meta-data/'),
      ).toThrow(DownloadError);
    });

    it('should block 0.0.0.0', () => {
      expect(() => validateDownloadUrl('http://0.0.0.0/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 224.0.0.0/4 (multicast)', () => {
      expect(() => validateDownloadUrl('http://224.0.0.1/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://239.255.255.250/file')).toThrow(
        DownloadError,
      );
    });

    it('should block the TEST-NET documentation ranges', () => {
      // TEST-NET-1 (192.0.2.0/24)
      expect(() => validateDownloadUrl('http://192.0.2.1/file')).toThrow(
        DownloadError,
      );
      // TEST-NET-2 (198.51.100.0/24)
      expect(() => validateDownloadUrl('http://198.51.100.1/file')).toThrow(
        DownloadError,
      );
      // TEST-NET-3 (203.0.113.0/24)
      expect(() => validateDownloadUrl('http://203.0.113.1/file')).toThrow(
        DownloadError,
      );
      // Neighboring public /24s stay allowed.
      expect(() => validateDownloadUrl('http://192.0.3.1/file')).not.toThrow();
      expect(() =>
        validateDownloadUrl('http://198.51.101.1/file'),
      ).not.toThrow();
      expect(() =>
        validateDownloadUrl('http://203.0.114.1/file'),
      ).not.toThrow();
    });
  });

  describe('blocked IPv6 addresses', () => {
    it('should block ::1 (loopback)', () => {
      expect(() => validateDownloadUrl('http://[::1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block :: (unspecified)', () => {
      expect(() => validateDownloadUrl('http://[::]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block fc00::/7 (unique local)', () => {
      expect(() => validateDownloadUrl('http://[fc00::1]/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://[fd12::1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block fe80::/10 (link-local)', () => {
      expect(() => validateDownloadUrl('http://[fe80::1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 2001:db8::/32 (documentation)', () => {
      expect(() => validateDownloadUrl('http://[2001:db8::1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 3fff::/20 (documentation, RFC 9637)', () => {
      expect(() => validateDownloadUrl('http://[3fff::1]/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://[3fff:fff::1]/file')).toThrow(
        DownloadError,
      );
      // 3fff:1000::/20 is outside the documentation range.
      expect(() =>
        validateDownloadUrl('http://[3fff:1000::1]/file'),
      ).not.toThrow();
    });
  });

  describe('IPv4-mapped IPv6 addresses', () => {
    it('should block ::ffff:127.0.0.1', () => {
      expect(() =>
        validateDownloadUrl('http://[::ffff:127.0.0.1]/file'),
      ).toThrow(DownloadError);
    });

    it('should block ::ffff:10.0.0.1', () => {
      expect(() =>
        validateDownloadUrl('http://[::ffff:10.0.0.1]/file'),
      ).toThrow(DownloadError);
    });

    it('should block ::ffff:169.254.169.254', () => {
      expect(() =>
        validateDownloadUrl('http://[::ffff:169.254.169.254]/file'),
      ).toThrow(DownloadError);
    });

    it('should allow ::ffff: with public IP', () => {
      expect(() =>
        validateDownloadUrl('http://[::ffff:8.8.8.8]/file'),
      ).not.toThrow();
    });
  });

  // Regression: a fully-qualified name with a trailing dot resolves the same as
  // the bare name, so it must not bypass the hostname blocklist.
  describe('trailing-dot hostnames', () => {
    it('should block localhost. (trailing dot)', () => {
      expect(() => validateDownloadUrl('http://localhost./file')).toThrow(
        DownloadError,
      );
    });

    it('should block .local. (trailing dot)', () => {
      expect(() => validateDownloadUrl('http://myhost.local./file')).toThrow(
        DownloadError,
      );
    });

    it('should block .localhost. (trailing dot)', () => {
      expect(() => validateDownloadUrl('http://app.localhost./file')).toThrow(
        DownloadError,
      );
    });

    it('should still allow public hosts with a trailing dot', () => {
      expect(() =>
        validateDownloadUrl('https://example.com./image.png'),
      ).not.toThrow();
    });
  });

  // Regression: numeric IPv4 in non-dotted notation is normalized to dotted
  // form by the URL parser, so the IPv4 private checks must still apply.
  describe('non-dotted IPv4 notations', () => {
    it('should block decimal 2130706433 (127.0.0.1)', () => {
      expect(() => validateDownloadUrl('http://2130706433/file')).toThrow(
        DownloadError,
      );
    });

    it('should block hex 0x7f000001 (127.0.0.1)', () => {
      expect(() => validateDownloadUrl('http://0x7f000001/file')).toThrow(
        DownloadError,
      );
    });

    it('should block octal 0177.0.0.1 (127.0.0.1)', () => {
      expect(() => validateDownloadUrl('http://0177.0.0.1/file')).toThrow(
        DownloadError,
      );
    });
  });

  // Regression: IPv6 forms that embed an IPv4 address in their last 32 bits
  // must be decoded and checked against the IPv4 private ranges.
  describe('IPv6 with embedded IPv4', () => {
    it('should block IPv4-compatible ::127.0.0.1', () => {
      expect(() => validateDownloadUrl('http://[::127.0.0.1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block IPv4-translated ::ffff:0:127.0.0.1', () => {
      expect(() =>
        validateDownloadUrl('http://[::ffff:0:127.0.0.1]/file'),
      ).toThrow(DownloadError);
    });

    it('should block NAT64 64:ff9b::127.0.0.1', () => {
      expect(() =>
        validateDownloadUrl('http://[64:ff9b::127.0.0.1]/file'),
      ).toThrow(DownloadError);
    });

    it('should block NAT64 64:ff9b::169.254.169.254 (metadata)', () => {
      expect(() =>
        validateDownloadUrl('http://[64:ff9b::169.254.169.254]/file'),
      ).toThrow(DownloadError);
    });

    it('should block NAT64 local-use 64:ff9b:1::169.254.169.254', () => {
      expect(() =>
        validateDownloadUrl('http://[64:ff9b:1::169.254.169.254]/file'),
      ).toThrow(DownloadError);
    });

    it('should allow NAT64 with a public embedded IPv4', () => {
      expect(() =>
        validateDownloadUrl('http://[64:ff9b::8.8.8.8]/file'),
      ).not.toThrow();
    });

    it('should allow a regular public IPv6 address', () => {
      // 2606:4700::/32 (Cloudflare) — a genuinely public, globally-routable
      // address. `2001:db8::/32` is the documentation range and is blocked.
      expect(() =>
        validateDownloadUrl('http://[2606:4700::1]/file'),
      ).not.toThrow();
    });
  });

  // Additional reserved/internal IPv4 ranges that must not be reachable.
  describe('additional reserved IPv4 ranges', () => {
    it('should block 100.64.0.0/10 (CGNAT)', () => {
      expect(() => validateDownloadUrl('http://100.64.0.1/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://100.127.255.255/file')).toThrow(
        DownloadError,
      );
    });

    it('should allow 100.63.x.x and 100.128.x.x (public)', () => {
      expect(() => validateDownloadUrl('http://100.63.0.1/file')).not.toThrow();
      expect(() =>
        validateDownloadUrl('http://100.128.0.1/file'),
      ).not.toThrow();
    });

    it('should block 198.18.0.0/15 (benchmarking)', () => {
      expect(() => validateDownloadUrl('http://198.18.0.1/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://198.19.255.255/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 192.0.0.0/24 (IETF protocol assignments)', () => {
      expect(() => validateDownloadUrl('http://192.0.0.1/file')).toThrow(
        DownloadError,
      );
    });

    it('should block 240.0.0.0/4 (reserved) and the broadcast address', () => {
      expect(() => validateDownloadUrl('http://240.0.0.1/file')).toThrow(
        DownloadError,
      );
      expect(() => validateDownloadUrl('http://255.255.255.255/file')).toThrow(
        DownloadError,
      );
    });
  });

  // Additional internal IPv6 ranges.
  describe('additional reserved IPv6 ranges', () => {
    it('should block fec0::/10 (site-local)', () => {
      expect(() => validateDownloadUrl('http://[fec0::1]/file')).toThrow(
        DownloadError,
      );
    });

    it('should block ff00::/8 (multicast)', () => {
      expect(() => validateDownloadUrl('http://[ff02::1]/file')).toThrow(
        DownloadError,
      );
    });
  });
});
