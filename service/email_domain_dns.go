package service

import (
	"context"
	"errors"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// emailDomainDNSCheck captures the DNS / web fingerprint of an email domain.
// Every field defaults to false; callers decide which signals to reject on.
type emailDomainDNSCheck struct {
	MXRecord         bool   // at least one MX record exists (domain can receive mail)
	MXHost           string // first MX host, lowercase, trailing dot trimmed
	ARecord          bool   // at least one A/AAAA record resolves
	PrivateARecord   bool   // resolved A points to loopback/private/link-local (parked placeholder)
	WebsiteReachable bool   // an HTTP(S) server answered on port 80/443
	MajorProviderMX  bool   // MX host belongs to a mainstream mail provider (gmail/outlook/qq/...)
	DisposableMX     bool   // MX host matches known disposable/temp-mail infrastructure
}

type emailDomainDNSCheckerFunc func(domain string) emailDomainDNSCheck

// registrationEmailDNSChecker is a test seam: unit tests swap in a stub so the
// pure policy logic never depends on live DNS. Production uses checkEmailDomainDNS.
var registrationEmailDNSChecker emailDomainDNSCheckerFunc = checkEmailDomainDNS

const (
	emailDomainDNSLookupTimeout   = 3 * time.Second
	emailDomainDNSCacheTTL        = 6 * time.Hour
	emailDomainDNSMaxConcurrency  = 64
	emailDomainDNSSemWaitTimeout  = time.Second
)

type emailDomainDNSCacheEntry struct {
	at    time.Time
	check emailDomainDNSCheck
}

var emailDomainDNSCache sync.Map // domain (lowercase) -> emailDomainDNSCacheEntry

// emailDomainDNSSem caps how many DNS probes may run concurrently. A flood of
// registrations with fresh (uncached) domains would otherwise pile up blocked
// goroutines and outbound sockets; hitting the cap fails open (skip the probe)
// rather than queueing, since the probe is best-effort.
var emailDomainDNSSem = make(chan struct{}, emailDomainDNSMaxConcurrency)

// checkEmailDomainDNS inspects a normalized, lowercase email domain. It is
// fail-open by design: on any resolver/network error, or when the concurrency
// cap is reached, it returns a "pass-everything" result and logs, so a DNS
// outage or a probe flood can never lock out legitimate registrations.
// Deterministic results (including NXDOMAIN / no-website) are cached per node
// for emailDomainDNSCacheTTL; transient failures are not cached so they are
// re-probed on the next attempt (multi-node safe: read-only, per-node cache).
func checkEmailDomainDNS(domain string) emailDomainDNSCheck {
	domain = strings.ToLower(strings.TrimSpace(domain))
	if domain == "" {
		return emailDomainDNSCheck{MXRecord: true, ARecord: true, WebsiteReachable: true}
	}
	if v, ok := emailDomainDNSCache.Load(domain); ok {
		entry := v.(emailDomainDNSCacheEntry)
		if time.Since(entry.at) < emailDomainDNSCacheTTL {
			return entry.check
		}
	}
	// Concurrency cap: briefly wait for a probe slot instead of failing open
	// immediately, so a flood of fresh-domain registrations cannot push the
	// system past the cap and make every subsequent request skip validation.
	// Only after the short wait times out do we degrade to fail-open.
	waitCtx, waitCancel := context.WithTimeout(context.Background(), emailDomainDNSSemWaitTimeout)
	defer waitCancel()
	select {
	case emailDomainDNSSem <- struct{}{}:
		defer func() { <-emailDomainDNSSem }()
	case <-waitCtx.Done():
		common.SysLog("registration dns check: concurrency limit reached, skipping probe for " + domain)
		return emailDomainDNSCheck{MXRecord: true, ARecord: true, WebsiteReachable: true}
	}
	check, cacheable := probeEmailDomainDNS(domain)
	if cacheable {
		emailDomainDNSCache.Store(domain, emailDomainDNSCacheEntry{at: time.Now(), check: check})
	}
	return check
}

func probeEmailDomainDNS(domain string) (emailDomainDNSCheck, bool) {
	check := emailDomainDNSCheck{}
	ctx, cancel := context.WithTimeout(context.Background(), emailDomainDNSLookupTimeout)
	defer cancel()

	// MX: primary signal — without MX, verification mail cannot be delivered.
	mx, mxErr := net.DefaultResolver.LookupMX(ctx, domain)
	if mxErr != nil {
		if isDNSNotFound(mxErr) {
			// NXDOMAIN / no MX records: report "no MX" and keep probing A and
			// website below so the caller sees the full domain picture. This is
			// NOT fail-open — RejectEmailDomainWithoutMX must catch these.
			common.SysLog("registration dns check: no MX records for " + domain + ": " + mxErr.Error())
		} else {
			// Transient resolver/network failure (timeout, SERVFAIL, ...):
			// fail open so a DNS hiccup never locks out legitimate registration.
			// Not cached — a transient failure must be re-probed next time.
			common.SysLog("registration dns check: transient LookupMX failure for " + domain + ": " + mxErr.Error())
			return emailDomainDNSCheck{MXRecord: true, ARecord: true, WebsiteReachable: true}, false
		}
	} else {
		check.MXRecord = len(mx) > 0 && strings.TrimSpace(mx[0].Host) != ""
		if check.MXRecord {
			check.MXHost = strings.ToLower(strings.TrimSuffix(strings.TrimSpace(mx[0].Host), "."))
			check.MajorProviderMX = majorMailProviderMX(check.MXHost)
			check.DisposableMX = disposableMailInfraMX(check.MXHost)
		}
	}

	// A/AAAA: parked placeholder domains often resolve to loopback/private ranges.
	ips, aErr := net.DefaultResolver.LookupHost(ctx, domain)
	if aErr != nil {
		common.SysLog("registration dns check: LookupHost failed for " + domain + ": " + aErr.Error())
	} else {
		check.ARecord = len(ips) > 0
		for _, ipStr := range ips {
			ip := net.ParseIP(ipStr)
			if ip == nil {
				continue
			}
			if isPlaceholderIP(ip) {
				check.PrivateARecord = true
				break
			}
		}
	}

	// Website reachability: most bulk temp-mail domains never serve a website,
	// while every mainstream provider does. Pure best-effort signal; the probe
	// itself is SSRF-hardened (see safeEmailDomainDialContext).
	check.WebsiteReachable = emailDomainWebsiteReachable(domain)
	return check, true
}

// isDNSNotFound reports whether the error is a definitive "no such host / no
// such record" DNS answer (NXDOMAIN or NOERROR-with-no-records), as opposed to
// a transient resolver failure.
func isDNSNotFound(err error) bool {
	var dnsErr *net.DNSError
	return errors.As(err, &dnsErr) && dnsErr.IsNotFound
}

// cgnatNet is the 100.64.0.0/10 Carrier-Grade NAT range; Go's IsPrivate covers
// it since 1.17, but we check it explicitly so the behavior is version-proof
// and self-documenting.
var cgnatNet = func() *net.IPNet {
	_, network, err := net.ParseCIDR("100.64.0.0/10")
	if err != nil {
		panic("invalid hardcoded CGNAT CIDR: " + err.Error())
	}
	return network
}()

// isPlaceholderIP reports whether an A record points at a loopback/private/
// link-local/CGNAT/unspecified address — a classic parked or placeholder
// domain pattern.
func isPlaceholderIP(ip net.IP) bool {
	if ip == nil {
		return false
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsLinkLocalUnicast() ||
		ip.IsLinkLocalMulticast() || ip.IsUnspecified() {
		return true
	}
	return cgnatNet.Contains(ip)
}

// majorMailProviderMX reports whether the MX host belongs to a mainstream mail
// provider. Used to exempt otherwise-legit email-only domains (no public website)
// that are nevertheless real mailboxes (corporate Google/Outlook/etc.).
func majorMailProviderMX(mxHost string) bool {
	mxHost = strings.ToLower(strings.TrimSuffix(mxHost, "."))
	for _, suffix := range majorMailProviderMXSuffixes {
		if mxHost == suffix || strings.HasSuffix(mxHost, "."+suffix) {
			return true
		}
	}
	return false
}

var majorMailProviderMXSuffixes = []string{
	"google.com", "googlemail.com",
	"outlook.com", "microsoft.com", "office365.com", "hotmail.com", "live.com",
	"protection.outlook.com",
	"qq.com", "163.com", "126.com", "yeah.net",
	"icloud.com", "yahoo.com", "yahoodns.net", "aol.com",
	"protonmail.com", "protonmail.ch", "zoho.com", "fastmail.fm", "fastmail.com",
	"messagingengine.com", "yandex.com", "yandex.net", "gmx.com", "gmx.net", "gmx.de",
	"mail.ru", "mxhichina.com", "aliyun.com",
}

// disposableMailInfraMX reports whether the MX host is served by known
// disposable/temp-mail infrastructure (substring match on the MX hostname).
func disposableMailInfraMX(mxHost string) bool {
	mxHost = strings.ToLower(strings.TrimSuffix(mxHost, "."))
	for _, fragment := range disposableMailInfraMXFragments {
		if strings.Contains(mxHost, fragment) {
			return true
		}
	}
	return false
}

var disposableMailInfraMXFragments = []string{
	"mail.tm", "fex.plus", "oneb.net", "in.mail.gw", "icodetensor",
	"guerrillamail", "mailinator", "yopmail", "10mail", "mailto.plus", "mailpwr",
	"fexbox", "fexpost", "fextemp", "merepost", "emltmp", "emlpro", "emlhub",
	"trashmail", "sharklasers", "dropmail", "getnada", "tempmail", "mailsac",
	"maildrop", "spam4", "mailnesia", "dispostable", "moakt", "emailondeck",
}

var emailDomainHTTPClient = &http.Client{
	Transport: &http.Transport{
		// SSRF hardening: the target host is fully attacker-controlled, so every
		// connection is dialed through a filter that resolves the name itself and
		// refuses loopback/private/link-local/CGNAT/metadata addresses. This also
		// protects the metadata endpoint (169.254.169.254, link-local).
		DialContext: safeEmailDomainDialContext,
	},
	Timeout: 3 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		return http.ErrUseLastResponse // do not follow redirects; one hop is enough
	},
}

// safeEmailDomainDialContext resolves the target host itself and only dials
// public addresses. It is used for the registration website probe so a
// malicious email domain cannot make the server connect to internal/metadata
// networks. No request body or sensitive headers are ever sent.
func safeEmailDomainDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	var dialer net.Dialer
	var lastErr error
	for _, ipa := range ips {
		if isPlaceholderIP(ipa.IP) {
			continue
		}
		conn, err := dialer.DialContext(ctx, network, net.JoinHostPort(ipa.IP.String(), port))
		if err == nil {
			return conn, nil
		}
		lastErr = err
	}
	if lastErr != nil {
		return nil, lastErr
	}
	return nil, errors.New("email domain resolves only to private/link-local addresses")
}

// emailDomainWebsiteReachable returns true if an HTTP(S) server answers on the
// domain (any status code counts — a real site exists). TLS failure falls back
// to plain HTTP. Connections are restricted to public IPs (SSRF hardening).
func emailDomainWebsiteReachable(domain string) bool {
	for _, scheme := range []string{"https", "http"} {
		ctx, cancel := context.WithTimeout(context.Background(), 2500*time.Millisecond)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, scheme+"://"+domain+"/", nil)
		if err != nil {
			cancel()
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; FlatkeyDomainCheck/1.0)")
		resp, err := emailDomainHTTPClient.Do(req)
		cancel()
		if err == nil {
			resp.Body.Close()
			return true
		}
	}
	return false
}
