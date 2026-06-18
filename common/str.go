package common

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unsafe"

	"github.com/samber/lo"
)

var (
	maskURLPattern    = regexp.MustCompile(`(http|https)://[^\s/$.?#].[^\s]*`)
	maskDomainPattern = regexp.MustCompile(`\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b`)
	maskIPPattern     = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	// maskApiKeyPattern matches patterns like 'api_key:xxx' or "api_key:xxx" to mask the API key value
	maskApiKeyPattern = regexp.MustCompile(`(['"]?)api_key:([^\s'"]+)(['"]?)`)
)

// knownTLDs is an allowlist of top-level domains used to tell a real host
// (api.openai.com, blockrun.ai) apart from a dotted code/field path
// (thinking.type, messages.0.content.source.base64) when masking plain domains.
// The maskDomainPattern matches any "word.word" token, so without this gate it
// corrupts legitimate error messages that reference nested fields. Masking is
// defense-in-depth (full URLs and IPs are masked by their own patterns), so an
// occasional obscure TLD slipping through is acceptable; over-masking field
// paths is the real defect this prevents.
//
// DELIBERATELY EXCLUDED: TLDs that are also common English-word field-name
// suffixes — id, in, to, us, me, it, at, be, no, so, cc, tv, info, dev, app,
// run, pro, live, link, etc. — because "user.id" / "payment.id" / "request.in"
// would otherwise be mangled to "***.id" / "***.in". AI providers do not use
// these TLDs, so dropping them costs no real masking coverage. The kept 2-char
// TLDs (io/ai/co) are heavily used by providers (x.ai, modal.io); a field path
// ending in exactly those is rare and an accepted residual.
var knownTLDs = map[string]struct{}{
	// gTLDs that essentially never end a JSON field name
	"com": {}, "net": {}, "org": {}, "io": {}, "ai": {}, "co": {},
	"cloud": {}, "biz": {}, "xyz": {}, "gov": {}, "edu": {},
	// country-code TLDs that are not common English words
	"uk": {}, "cn": {}, "jp": {}, "kr": {}, "eu": {}, "de": {}, "fr": {},
	"ru": {}, "ca": {}, "au": {}, "br": {}, "es": {}, "nl": {}, "se": {},
	"fi": {}, "pl": {}, "cz": {}, "tr": {}, "sa": {}, "ae": {}, "sg": {},
	"hk": {}, "tw": {}, "my": {}, "th": {}, "vn": {}, "ph": {}, "mx": {},
	"ar": {}, "cl": {}, "za": {}, "ng": {}, "ke": {}, "il": {}, "ir": {},
	"ua": {}, "ro": {}, "hu": {}, "gr": {}, "pt": {}, "dk": {}, "ch": {}, "ie": {},
}

// isLikelyPlainDomain reports whether a bare "a.b[.c]" token is a real hostname
// (its last label is a known TLD) rather than a dotted code/field path.
//
// This is a deliberately conservative heuristic. It is impossible to perfectly
// tell a 2-label host from a field path by structure alone (e.g. "tenant.id"
// the host vs "user.id" the field are identical), so we accept a known
// trade-off: bare hostnames on field-word TLDs (.dev/.app/.info/.id/...) are
// NOT masked here. That is acceptable because the real leak vectors are still
// covered — full URLs (maskURLPattern), IPs (maskIPPattern), and, on whitelabel
// channels, provider brand keywords (taskcommon.ContainsBrandKeyword) — whereas
// mangling a customer-facing field path is frequent and user-visible.
func isLikelyPlainDomain(s string) bool {
	parts := strings.Split(s, ".")
	if len(parts) < 2 {
		return false
	}
	// Structural guard: real DNS hostnames have no all-numeric labels (those are
	// array indices like messages.0.content) and no underscores (snake_case
	// fields). Either marker means it is a code/field path, not a host.
	for _, p := range parts {
		if p == "" || strings.ContainsRune(p, '_') || isAllDigits(p) {
			return false
		}
	}
	last := strings.ToLower(parts[len(parts)-1])
	_, ok := knownTLDs[last]
	return ok
}

func isAllDigits(s string) bool {
	if s == "" {
		return false
	}
	for _, r := range s {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

const LocalLogContentLimit = 2048

// LocalLogPreview limits log-only content unless debug logging is enabled.
func LocalLogPreview(content string) string {
	if DebugEnabled || len(content) <= LocalLogContentLimit {
		return content
	}
	return fmt.Sprintf("%s... [truncated, original_length=%d, limit=%d]", content[:LocalLogContentLimit], len(content), LocalLogContentLimit)
}

func GetStringIfEmpty(str string, defaultValue string) string {
	if str == "" {
		return defaultValue
	}
	return str
}

func GetRandomString(length int) string {
	if length <= 0 {
		return ""
	}
	return lo.RandomString(length, lo.AlphanumericCharset)
}

func MapToJsonStr(m map[string]interface{}) string {
	bytes, err := json.Marshal(m)
	if err != nil {
		return ""
	}
	return string(bytes)
}

func StrToMap(str string) (map[string]interface{}, error) {
	m := make(map[string]interface{})
	err := Unmarshal([]byte(str), &m)
	if err != nil {
		return nil, err
	}
	return m, nil
}

func StrToJsonArray(str string) ([]interface{}, error) {
	var js []interface{}
	err := json.Unmarshal([]byte(str), &js)
	if err != nil {
		return nil, err
	}
	return js, nil
}

func IsJsonArray(str string) bool {
	var js []interface{}
	return json.Unmarshal([]byte(str), &js) == nil
}

func IsJsonObject(str string) bool {
	var js map[string]interface{}
	return json.Unmarshal([]byte(str), &js) == nil
}

func String2Int(str string) int {
	num, err := strconv.Atoi(str)
	if err != nil {
		return 0
	}
	return num
}

func StringsContains(strs []string, str string) bool {
	for _, s := range strs {
		if s == str {
			return true
		}
	}
	return false
}

// StringToByteSlice []byte only read, panic on append
func StringToByteSlice(s string) []byte {
	tmp1 := (*[2]uintptr)(unsafe.Pointer(&s))
	tmp2 := [3]uintptr{tmp1[0], tmp1[1], tmp1[1]}
	return *(*[]byte)(unsafe.Pointer(&tmp2))
}

func EncodeBase64(str string) string {
	return base64.StdEncoding.EncodeToString([]byte(str))
}

func GetJsonString(data any) string {
	if data == nil {
		return ""
	}
	b, _ := json.Marshal(data)
	return string(b)
}

// NormalizeBillingPreference clamps the billing preference to valid values.
func NormalizeBillingPreference(pref string) string {
	switch strings.TrimSpace(pref) {
	case "subscription_first", "wallet_first", "subscription_only", "wallet_only":
		return strings.TrimSpace(pref)
	default:
		return "subscription_first"
	}
}

// MaskEmail masks a user email to prevent PII leakage in logs
// Returns "***masked***" if email is empty, otherwise shows only the domain part
func MaskEmail(email string) string {
	if email == "" {
		return "***masked***"
	}

	// Find the @ symbol
	atIndex := strings.Index(email, "@")
	if atIndex == -1 {
		// No @ symbol found, return masked
		return "***masked***"
	}

	// Return only the domain part with @ symbol
	return "***@" + email[atIndex+1:]
}

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
	numStars := len(parts) - len(tail)
	if numStars < 1 {
		numStars = 1
	}
	stars := strings.TrimSuffix(strings.Repeat("***.", numStars), ".")
	return stars + "." + strings.Join(tail, ".")
}

// MaskSensitiveInfo masks sensitive information like URLs, IPs, and domain names in a string
// Example:
// http://example.com -> http://***.com
// https://api.test.org/v1/users/123?key=secret -> https://***.org/***/***/?key=***
// https://sub.domain.co.uk/path/to/resource -> https://***.co.uk/***/***
// 192.168.1.1 -> ***.***.***.***
// openai.com -> ***.com
// www.openai.com -> ***.***.com
// api.openai.com -> ***.***.com
func MaskSensitiveInfo(str string) string {
	// Mask URLs
	str = maskURLPattern.ReplaceAllStringFunc(str, func(urlStr string) string {
		u, err := url.Parse(urlStr)
		if err != nil {
			return urlStr
		}

		host := u.Host
		if host == "" {
			return urlStr
		}

		// Mask host with unified logic
		maskedHost := maskHostForURL(host)

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

		// Mask query parameters
		if u.RawQuery != "" {
			values, err := url.ParseQuery(u.RawQuery)
			if err != nil {
				// If can't parse query, just mask the whole query string
				result += "?***"
			} else {
				maskedParams := make([]string, 0, len(values))
				for key := range values {
					maskedParams = append(maskedParams, key+"=***")
				}
				if len(maskedParams) > 0 {
					result += "?" + strings.Join(maskedParams, "&")
				}
			}
		}

		return result
	})

	// Mask domain names without protocol (like openai.com, www.openai.com).
	// Skip dotted tokens that are not real hosts (e.g. the field path
	// thinking.type or messages.0.content.source.base64) so legitimate error
	// messages are not corrupted into ***.type.
	str = maskDomainPattern.ReplaceAllStringFunc(str, func(domain string) string {
		if !isLikelyPlainDomain(domain) {
			return domain
		}
		return maskHostForPlainDomain(domain)
	})

	// Mask IP addresses
	str = maskIPPattern.ReplaceAllString(str, "***.***.***.***")

	// Mask API keys (e.g., "api_key:AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70" -> "api_key:***")
	str = maskApiKeyPattern.ReplaceAllString(str, "${1}api_key:***${3}")

	return str
}
