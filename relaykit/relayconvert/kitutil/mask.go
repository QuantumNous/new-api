package kitutil

import (
	"net/url"
	"regexp"
	"strings"
)

var (
	maskURLPattern    = regexp.MustCompile(`(http|https)://[^\s/$.?#].[^\s]*`)
	maskDomainPattern = regexp.MustCompile(`\b(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b`)
	maskIPPattern     = regexp.MustCompile(`\b(?:\d{1,3}\.){3}\d{1,3}\b`)
	// maskApiKeyPattern matches patterns like 'api_key:xxx' or "api_key:xxx" to mask the API key value
	maskApiKeyPattern = regexp.MustCompile(`(['"]?)api_key:([^\s'"]+)(['"]?)`)

	// maskBareKeyPattern masks bare upstream API key formats that providers may
	// echo in error messages (sk-..., gsk_..., hf_..., xai-..., AIza...).
	maskBareKeyPattern = regexp.MustCompile(`(?i)(\bsk-[A-Za-z0-9_\-]{8,}|\bgsk_[A-Za-z0-9_\-]{8,}|\bhf_[A-Za-z0-9_\-]{8,}|\bxai-[A-Za-z0-9_\-]{8,}|\bAIza[A-Za-z0-9_\-]{8,})`)

	// maskMoreKeyPrefixPattern covers additional provider key prefixes that
	// F-13's bare pattern missed (Perplexity, NVIDIA NIM, Replicate, personal
	// access tokens, GitHub tokens, GitLab tokens).
	maskMoreKeyPrefixPattern = regexp.MustCompile(`(?i)(\bpplx-[A-Za-z0-9_\-]{8,}|\bnvapi-[A-Za-z0-9_\-]{8,}|\br8_[A-Za-z0-9_\-]{8,}|\bpat_[A-Za-z0-9_\-]{8,}|\brt_[A-Za-z0-9_\-]{8,}|\bghp_[A-Za-z0-9_\-]{8,}|\bgho_[A-Za-z0-9_\-]{8,}|\bgithub_pat_[A-Za-z0-9_\-]{8,}|\bglpat-[A-Za-z0-9_\-]{8,})`)

	// maskJwtPattern masks JWT-shaped credentials (header.payload.signature).
	maskJwtPattern = regexp.MustCompile(`(?i)\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+`)

	// maskKeyValuePattern masks prefix-less long values adjacent to credential
	// field names (api_key:/token:/secret:/authorization:/password:/credential:),
	// which covers providers that issue prefix-less keys (Cohere, Cloudflare...).
	maskKeyValuePattern = regexp.MustCompile(`(?i)((?:\\?["'])?\b(?:api[_-]?key|key|token|secret|authorization|password|credential)(?:\\?["'])?\s*[:=]\s*(?:\\?["'])?)([A-Za-z0-9_\-\.]{12,})(?:\\?["'])?`)

	// maskBearerPattern masks "Bearer <credential>" tokens.
	maskBearerPattern = regexp.MustCompile(`(?i)(\bbearer\s+)([A-Za-z0-9_\-\.]{12,})`)

	// maskInvalidKeyPattern masks prefix-less values after "invalid/bad/wrong/
	// unauthorized/incorrect key <value>" phrasing (no colon).
	maskInvalidKeyPattern = regexp.MustCompile(`(?i)\b(invalid|bad|wrong|unauthorized|incorrect|missing)\s+key\s+([A-Za-z0-9_\-\.]{12,})`)

	// maskPemBlockPattern masks PEM private key blocks, including the
	// JSON-escaped form (\\n) used when a service-account key JSON is echoed
	// back inside a string. Covers RSA/EC/Ed25519/OPENSSH/ENCRYPTED keys.
	maskPemBlockPattern = regexp.MustCompile(`(?s)-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----`)

	// maskServiceAccountFieldPattern masks prefix-less long values adjacent to
	// service-account credential fields (private_key, client_secret, client_id)
	// and handles JSON-escaped quotes (\"field\":\"value\") inside nested
	// strings — the base key-value pattern misses both.
	maskServiceAccountFieldPattern = regexp.MustCompile(`(?i)((?:\\?["'])?\b(?:private[_-]?key|client[_-]?secret|client[_-]?id)(?:\\?["'])?\s*[:=]\s*(?:\\?["'])?)([A-Za-z0-9_\-\.]{12,})(?:\\?["'])?`)
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

	// Mask bare key formats (defense in depth; upstreams may echo the gateway's
	// Authorization value verbatim in error messages — F-13 layer B).
	str = maskBareKeyPattern.ReplaceAllStringFunc(str, func(k string) string {
		if len(k) > 6 {
			return k[:4] + "***"
		}
		return k
	})

	// F-43: additional prefixed formats, JWTs, and key-word-adjacent values.
	str = maskMoreKeyPrefixPattern.ReplaceAllStringFunc(str, func(k string) string {
		if len(k) > 6 {
			return k[:4] + "***"
		}
		return k
	})
	str = maskJwtPattern.ReplaceAllString(str, "eyJ***")
	str = maskKeyValuePattern.ReplaceAllString(str, "${1}***${3}")
	str = maskBearerPattern.ReplaceAllString(str, "${1}***")
	str = maskInvalidKeyPattern.ReplaceAllString(str, "${1} key ***")
	str = maskServiceAccountFieldPattern.ReplaceAllString(str, "${1}***")
	// F-67: PEM private key blocks (Vertex service-account keys and similar
	// channel credentials) must never be echoed to clients even when the
	// surrounding JSON field names were masked.
	str = maskPemBlockPattern.ReplaceAllStringFunc(str, func(block string) string {
		if len(block) > 30 {
			return block[:20] + "***[REDACTED PEM]***"
		}
		return "***[REDACTED PEM]***"
	})

	return str
}

// MaskSensitiveKeys masks only credential-shaped values (API keys, tokens,
// JWTs, "key:/token:" values) without URL/domain/IP rewriting, so enum-like
// fields (type/code/param in SSE events) are never mangled (F-20 regression).
func MaskSensitiveKeys(str string) string {
	str = maskApiKeyPattern.ReplaceAllString(str, "${1}api_key:***${3}")
	str = maskBareKeyPattern.ReplaceAllStringFunc(str, func(k string) string {
		if len(k) > 6 {
			return k[:4] + "***"
		}
		return k
	})
	str = maskMoreKeyPrefixPattern.ReplaceAllStringFunc(str, func(k string) string {
		if len(k) > 6 {
			return k[:4] + "***"
		}
		return k
	})
	str = maskJwtPattern.ReplaceAllString(str, "eyJ***")
	str = maskKeyValuePattern.ReplaceAllString(str, "${1}***${3}")
	str = maskBearerPattern.ReplaceAllString(str, "${1}***")
	str = maskInvalidKeyPattern.ReplaceAllString(str, "${1} key ***")
	str = maskServiceAccountFieldPattern.ReplaceAllString(str, "${1}***")
	// F-67: PEM private key blocks (Vertex service-account keys and similar
	// channel credentials) must never be echoed to clients even when the
	// surrounding JSON field names were masked.
	str = maskPemBlockPattern.ReplaceAllStringFunc(str, func(block string) string {
		if len(block) > 30 {
			return block[:20] + "***[REDACTED PEM]***"
		}
		return "***[REDACTED PEM]***"
	})
	return str
}
