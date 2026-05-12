package common

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/url"
	"regexp"
	"sort"
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
	maskApiKeyPattern                  = regexp.MustCompile(`(['"]?)api_key:([^\s'"]+)(['"]?)`)
	maskAuthorizationPattern           = regexp.MustCompile(`(?i)(["']?\bauthorization\b["']?\s*[:=]\s*)(?:bearer\s+)?("[^"]*"|'[^']*'|[^\s,;}\]]+)`)
	maskSecretAssignmentPattern        = regexp.MustCompile(`(?i)(["']?\b(?:authorization|api[-_ ]?key|x-api-key|x-goog-api-key|access[-_ ]?token|refresh[-_ ]?token|bearer[-_ ]?token|secret|token|key)\b["']?\s*[:=]\s*)("[^"]*"|'[^']*'|[^\s,;}\]]+)`)
	maskBearerTokenPattern             = regexp.MustCompile(`(?i)\bbearer\s+([a-z0-9._~+/=-]{6,})`)
	maskSkTokenPattern                 = regexp.MustCompile(`(?i)\bsk-[a-z0-9_-]{6,}`)
	maskPipeSeparatedSecretPattern     = regexp.MustCompile(`\b[A-Za-z0-9][A-Za-z0-9._~+/=-]{5,}\|[A-Za-z0-9][A-Za-z0-9._~+/=-]{5,}(?:\|[A-Za-z0-9][A-Za-z0-9._~+/=-]{2,})?\b`)
	userVisibleSensitiveContentPattern = regexp.MustCompile(`(?i)\b(?:authorization|api[-_ ]?key|x-api-key|x-goog-api-key|access[-_ ]?token|refresh[-_ ]?token|bearer|secret|token|key|channel|upstream|relay|retry|key[-_ ]?hint|key[-_ ]?fp|multi[-_ ]?key|use[-_ ]?channel|prompt|messages|input|content|image[-_ ]?url|image|images|file[-_ ]?data|file|files|audio|request[-_ ]?header|headers?)\b|sk-|渠道|上游|重试|密钥|令牌|多密钥`)
)

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

	// Mask domain names without protocol (like openai.com, www.openai.com)
	str = maskDomainPattern.ReplaceAllStringFunc(str, func(domain string) string {
		return maskHostForPlainDomain(domain)
	})

	// Mask IP addresses
	str = maskIPPattern.ReplaceAllString(str, "***.***.***.***")

	// Mask API keys (e.g., "api_key:AIzaSyAAAaUooTUni8AdaOkSRMda30n_Q4vrV70" -> "api_key:***")
	str = maskApiKeyPattern.ReplaceAllString(str, "${1}api_key:***${3}")

	str = maskSecretLiterals(str)

	return str
}

func MaskSecretsForLog(str string, secrets ...string) string {
	if str == "" {
		return ""
	}
	str = maskExactSecrets(str, secrets...)
	return MaskSensitiveInfo(str)
}

func SanitizeUserVisibleError(message string, statusCode int, errorCode any, secrets ...string) string {
	message = strings.TrimSpace(MaskSecretsForLog(message, secrets...))
	if message == "" || ContainsUserVisibleSensitiveTerm(message) {
		return userVisibleErrorFallback(statusCode, errorCode, secrets...)
	}
	return message
}

func SanitizeUserVisibleErrorCode(errorCode any, secrets ...string) string {
	code := strings.TrimSpace(fmt.Sprintf("%v", errorCode))
	if code == "" || code == "<nil>" {
		return ""
	}
	code = strings.TrimSpace(MaskSecretsForLog(code, secrets...))
	if code == "" {
		return ""
	}
	if ContainsUserVisibleSensitiveTerm(code) {
		return "request_error"
	}
	return code
}

func SanitizeUserVisibleErrorType(errorType any, secrets ...string) string {
	typ := strings.TrimSpace(fmt.Sprintf("%v", errorType))
	if typ == "" || typ == "<nil>" {
		return "new_api_error"
	}
	typ = strings.TrimSpace(MaskSecretsForLog(typ, secrets...))
	if typ == "" || ContainsUserVisibleSensitiveTerm(typ) {
		return "new_api_error"
	}
	return typ
}

func ContainsUserVisibleSensitiveTerm(content string) bool {
	if userVisibleSensitiveContentPattern.MatchString(content) {
		return true
	}
	normalized := strings.ToLower(content)
	for _, term := range []string{
		"authorization",
		"api_key",
		"api-key",
		"apikey",
		"x-api-key",
		"x-goog-api-key",
		"access_token",
		"access-token",
		"refresh_token",
		"refresh-token",
		"bearer",
		"secret",
		"token",
		"key",
		"sk-",
		"channel",
		"upstream",
		"relay",
		"retry",
		"key_hint",
		"key-hint",
		"key_fp",
		"key-fp",
		"multi_key",
		"multi-key",
		"prompt",
		"messages",
		"image_url",
		"image-url",
		"file_data",
		"file-data",
		"request_header",
		"request-header",
		"header",
		"渠道",
		"上游",
		"重试",
		"密钥",
		"令牌",
		"多密钥",
	} {
		if strings.Contains(normalized, term) {
			return true
		}
	}
	return false
}

func maskExactSecrets(text string, secrets ...string) string {
	candidates := make([]string, 0, len(secrets)*3)
	seen := make(map[string]bool)
	for _, secret := range secrets {
		for _, candidate := range secretCandidates(secret) {
			if seen[candidate] {
				continue
			}
			seen[candidate] = true
			candidates = append(candidates, candidate)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		return len(candidates[i]) > len(candidates[j])
	})
	for _, candidate := range candidates {
		text = strings.ReplaceAll(text, candidate, "***")
	}
	return text
}

func secretCandidates(secret string) []string {
	secret = strings.TrimSpace(secret)
	if len(secret) < 4 {
		return nil
	}
	candidates := []string{secret}
	if strings.HasPrefix(strings.ToLower(secret), "bearer ") {
		trimmed := strings.TrimSpace(secret[7:])
		if len(trimmed) >= 4 {
			candidates = append(candidates, trimmed)
		}
	}
	if strings.HasPrefix(secret, "sk-") && len(secret) > 3 {
		trimmed := strings.TrimPrefix(secret, "sk-")
		if len(trimmed) >= 4 {
			candidates = append(candidates, trimmed)
		}
	}
	for _, part := range strings.Split(secret, "|") {
		part = strings.TrimSpace(part)
		if len(part) >= 8 {
			candidates = append(candidates, part)
		}
	}
	return candidates
}

func maskSecretLiterals(text string) string {
	text = maskAuthorizationPattern.ReplaceAllStringFunc(text, maskSecretAssignmentMatch)
	text = maskSecretAssignmentPattern.ReplaceAllStringFunc(text, func(match string) string {
		return maskSecretAssignmentMatch(match)
	})
	text = maskBearerTokenPattern.ReplaceAllString(text, "Bearer ***")
	text = maskSkTokenPattern.ReplaceAllString(text, "sk-***")
	text = maskPipeSeparatedSecretPattern.ReplaceAllString(text, "***|***")
	return text
}

func maskSecretAssignmentMatch(match string) string {
	idx := strings.IndexAny(match, ":=")
	if idx < 0 {
		return "***"
	}
	key := strings.TrimSpace(match[:idx])
	return key + match[idx:idx+1] + "***"
}

func userVisibleErrorFallback(statusCode int, errorCode any, secrets ...string) string {
	code := SanitizeUserVisibleErrorCode(errorCode, secrets...)
	if statusCode > 0 && code != "" {
		return fmt.Sprintf("status_code=%d, error_code=%s", statusCode, code)
	}
	if statusCode > 0 {
		return fmt.Sprintf("status_code=%d", statusCode)
	}
	if code != "" {
		return fmt.Sprintf("error_code=%s", code)
	}
	return "request failed"
}
