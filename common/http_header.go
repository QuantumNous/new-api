package common

import "strings"

// IsSensitiveHeaderName reports whether a header name conventionally carries
// credentials or proof derived from credentials. It is intentionally broader
// than a fixed denylist because integrations commonly invent X-* credential
// names (for example X-Auth-Token or CF-Access-Client-Secret).
func IsSensitiveHeaderName(name string) bool {
	normalized := strings.ToLower(strings.TrimSpace(name))
	normalized = strings.ReplaceAll(normalized, "_", "-")
	if normalized == "" {
		return false
	}

	compact := strings.ReplaceAll(normalized, "-", "")
	for _, marker := range []string{
		"authorization", "authentication", "apikey", "accesskey", "privatekey",
		"clientsecret", "authtoken", "accesstoken", "refreshtoken",
	} {
		if strings.Contains(compact, marker) {
			return true
		}
	}

	for _, part := range strings.FieldsFunc(normalized, func(r rune) bool {
		return r == '-' || r == '.'
	}) {
		switch part {
		case "auth", "cookie", "credential", "key", "password", "secret", "signature", "token":
			return true
		}
	}
	return false
}
