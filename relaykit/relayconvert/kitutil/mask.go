package kitutil

import (
	"maps"
	"net"
	"net/url"
	"regexp"
	"slices"
	"strings"
)

var (
	// maskURLPattern stops at characters a URL cannot contain unescaped, such
	// as double quotes and angle or curly brackets, so a URL quoted in an error
	// keeps its delimiters. Apostrophes and parentheses are valid inside a URL;
	// the caller trims them, like other punctuation, only when they trail it.
	maskURLPattern = regexp.MustCompile(`(?:https?|wss?)://[^\s"<>{}]+`)
	maskIPPattern  = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	// maskBracketedIPv6Pattern matches the bracketed form Go network errors use
	// for IPv6 addresses, as in "dial tcp [2001:db8::1]:443", with an optional
	// zone; the caller confirms the content parses as an IP.
	maskBracketedIPv6Pattern = regexp.MustCompile(`\[([0-9A-Fa-f:.]*:[0-9A-Fa-f:.]*)(%[^\]\s]*)?\]`)
	// maskApiKeyPattern matches patterns like 'api_key:xxx' or "api_key:xxx" to mask the API key value
	maskApiKeyPattern = regexp.MustCompile(`(['"]?)api_key:([^\s'"]+)(['"]?)`)
)

// maskHostTail returns the tail parts of a domain/host that should be preserved.
// It keeps 2 parts for likely country-code TLDs (e.g., co.uk, com.cn), otherwise keeps only the TLD.
func maskHostTail(parts []string) []string {
	if len(parts) < 2 {
		return parts
	}
	lastPart := parts[len(parts)-1]
	secondLastPart := parts[len(parts)-2]
	if len(lastPart) == 2 && len(secondLastPart) <= 3 {
		// Likely country code TLD like co.uk, com.cn
		return []string{secondLastPart, lastPart}
	}
	return []string{lastPart}
}

// maskHostForURL collapses subdomains and keeps only masked prefix + preserved tail.
// Example: api.openai.com -> ***.com, sub.domain.co.uk -> ***.co.uk
func maskHostForURL(host string) string {
	parts := strings.Split(host, ".")
	if len(parts) < 2 {
		return "***"
	}
	tail := maskHostTail(parts)
	return "***." + strings.Join(tail, ".")
}

// maskHostForPlainDomain masks a plain domain and reflects subdomain depth with multiple ***.
// Example: openai.com -> ***.com, api.openai.com -> ***.***.com, sub.domain.co.uk -> ***.***.co.uk
func maskHostForPlainDomain(domain string) string {
	parts := strings.Split(domain, ".")
	if len(parts) < 2 {
		return domain
	}
	tail := maskHostTail(parts)
	numStars := max(len(parts)-len(tail), 1)
	stars := strings.TrimSuffix(strings.Repeat("***.", numStars), ".")
	return stars + "." + strings.Join(tail, ".")
}

// maskURLQuery keeps the parameter names of a raw query and masks the values.
// Example: key=secret&alt=sse -> ?alt=***&key=***
func maskURLQuery(rawQuery string) string {
	if rawQuery == "" {
		return ""
	}
	values, err := url.ParseQuery(rawQuery)
	if err != nil {
		// If can't parse query, just mask the whole query string
		return "?***"
	}
	if len(values) == 0 {
		return ""
	}
	maskedParams := make([]string, 0, len(values))
	for _, key := range slices.Sorted(maps.Keys(values)) {
		maskedParams = append(maskedParams, key+"=***")
	}
	return "?" + strings.Join(maskedParams, "&")
}

// MaskSensitiveInfo masks the upstream addresses in str and leaves every other
// URL and domain readable. upstreamURLs are the channel base URL and the URL
// the gateway actually requested, which differs for routes such as absolute
// Advanced Custom paths; empty entries are skipped. Credentials and IPv4
// addresses are masked regardless of the upstream: API key values, the query
// values and userinfo of every URL, which carry secrets such as client_secret
// or key on provider endpoints, and IPs, which in network errors include the
// gateway's own address.
// Example with upstream https://api.upstream.example.com:
// https://api.upstream.example.com/v1/chat?key=secret -> https://***.com/***/***?key=***
// lookup api.upstream.example.com -> lookup ***.***.***.com
// dial tcp 192.168.1.1:443 -> dial tcp ***.***.***.***:443
// https://docs.example.org/errors -> unchanged
// https://auth.example.org/token?client_secret=s -> https://auth.example.org/token?client_secret=***
func MaskSensitiveInfo(str string, upstreamURLs ...string) string {
	// Mask API keys (e.g., "api_key:AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70" -> "api_key:***")
	str = maskApiKeyPattern.ReplaceAllString(str, "${1}api_key:***${3}")

	upstreamHosts := make([]string, 0, len(upstreamURLs))
	for _, upstreamURL := range upstreamURLs {
		upstreamURL = strings.TrimSpace(upstreamURL)
		if upstreamURL == "" {
			continue
		}
		if !strings.Contains(upstreamURL, "://") {
			// A base URL saved without a scheme would otherwise parse as a path.
			upstreamURL = "//" + upstreamURL
		}
		parsed, err := url.Parse(upstreamURL)
		if err != nil {
			continue
		}
		// A fully qualified host keeps its trailing root dot; errors may omit it.
		if host := strings.TrimSuffix(parsed.Hostname(), "."); host != "" {
			upstreamHosts = append(upstreamHosts, host)
		}
	}
	// Mask URLs on an upstream host, and the query values of every other URL
	str = maskURLPattern.ReplaceAllStringFunc(str, func(match string) string {
		urlStr := match
		for urlStr != "" {
			last := urlStr[len(urlStr)-1]
			if strings.IndexByte(".,;:!?'", last) < 0 && (last != ')' || strings.Count(urlStr, "(") >= strings.Count(urlStr, ")")) {
				break
			}
			urlStr = urlStr[:len(urlStr)-1]
		}
		suffix := match[len(urlStr):]
		u, err := url.Parse(urlStr)
		if err != nil {
			return match
		}
		host := strings.TrimSuffix(u.Hostname(), ".")
		if !slices.ContainsFunc(upstreamHosts, func(upstreamHost string) bool { return strings.EqualFold(upstreamHost, host) }) {
			if u.RawQuery == "" && u.User == nil {
				return match
			}
			// Userinfo is a credential wherever the URL points.
			if u.User != nil {
				scheme, afterScheme, _ := strings.Cut(urlStr, "://")
				authorityEnd := strings.IndexAny(afterScheme, "/?#")
				if authorityEnd < 0 {
					authorityEnd = len(afterScheme)
				}
				urlStr = scheme + "://***@" + afterScheme[strings.LastIndex(afterScheme[:authorityEnd], "@")+1:]
			}
			if u.RawQuery == "" {
				return urlStr + suffix
			}
			beforeQuery, _, _ := strings.Cut(urlStr, "?")
			fragment := ""
			if u.Fragment != "" {
				fragment = "#" + u.EscapedFragment()
			}
			return beforeQuery + maskURLQuery(u.RawQuery) + fragment + suffix
		}

		maskedHost := maskHostForURL(host)
		if ip := net.ParseIP(host); ip != nil && ip.To4() != nil {
			maskedHost = "***.***.***.***"
		}
		if port := u.Port(); port != "" {
			maskedHost += ":" + port
		}

		result := u.Scheme + "://" + maskedHost

		// Mask path
		if u.Path != "" && u.Path != "/" {
			pathParts := strings.Split(strings.Trim(u.Path, "/"), "/")
			maskedPathParts := make([]string, len(pathParts))
			for i := range pathParts {
				if pathParts[i] != "" {
					maskedPathParts[i] = "***"
				}
			}
			if len(maskedPathParts) > 0 {
				result += "/" + strings.Join(maskedPathParts, "/")
			}
		} else if u.Path == "/" {
			result += "/"
		}

		return result + maskURLQuery(u.RawQuery) + suffix
	})

	// Mask IP addresses: in network errors they are the resolved upstream
	// address or the gateway's own, so they are masked even without an
	// upstream address, and an IP upstream host is covered too. IPv6 goes
	// first so an embedded IPv4 such as [::ffff:10.0.0.1] still parses.
	str = maskBracketedIPv6Pattern.ReplaceAllStringFunc(str, func(match string) string {
		if net.ParseIP(maskBracketedIPv6Pattern.FindStringSubmatch(match)[1]) == nil {
			return match
		}
		return "[***]"
	})
	str = maskIPPattern.ReplaceAllString(str, "***.***.***.***")
	if len(upstreamHosts) == 0 {
		return str
	}

	// Mask an upstream host where it appears without a scheme, as in
	// "dial tcp: lookup api.example.com: no such host". Longer hosts go first
	// so a subdomain upstream is masked whole before its parent base host.
	slices.SortFunc(upstreamHosts, func(a, b string) int { return len(b) - len(a) })
	for _, host := range upstreamHosts {
		if net.ParseIP(host) != nil {
			continue
		}
		hostPattern := regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(host) + `\b`)
		str = hostPattern.ReplaceAllStringFunc(str, maskHostForPlainDomain)
	}

	return str
}
