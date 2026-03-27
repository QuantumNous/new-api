package model

import (
	"errors"
	"fmt"
	"net/http"
	"net/netip"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

func validateTrustedHeaderProvider(provider *CustomOAuthProvider) error {
	if strings.TrimSpace(provider.TrustedProxyCIDRs) == "" {
		return errors.New("trusted_proxy_cidrs is required for trusted_header providers")
	}
	cidrs, err := parseTrustedProxyCIDRs(provider.TrustedProxyCIDRs)
	if err != nil {
		return fmt.Errorf("trusted_proxy_cidrs is invalid: %w", err)
	}
	if len(cidrs) == 0 {
		return errors.New("trusted_proxy_cidrs must contain at least one entry")
	}
	if strings.TrimSpace(provider.ExternalIDHeader) == "" {
		return errors.New("external_id_header is required for trusted_header providers")
	}

	headers := []struct {
		label string
		value string
	}{
		{label: "external_id_header", value: provider.ExternalIDHeader},
		{label: "username_header", value: provider.UsernameHeader},
		{label: "display_name_header", value: provider.DisplayNameHeader},
		{label: "email_header", value: provider.EmailHeader},
		{label: "group_header", value: provider.GroupHeader},
		{label: "role_header", value: provider.RoleHeader},
	}
	for _, header := range headers {
		if strings.TrimSpace(header.value) == "" {
			continue
		}
		if !isValidHTTPHeaderName(header.value) {
			return fmt.Errorf("%s is invalid", header.label)
		}
	}
	return nil
}

func parseTrustedProxyCIDRs(raw string) ([]string, error) {
	var values []string
	if err := common.UnmarshalJsonStr(raw, &values); err != nil {
		return nil, errors.New("must be a valid JSON array")
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		if prefix, err := netip.ParsePrefix(trimmed); err == nil {
			if prefix.Bits() == 0 {
				return nil, fmt.Errorf("CIDR %q is too broad", trimmed)
			}
		} else {
			if _, addrErr := netip.ParseAddr(trimmed); addrErr != nil {
				return nil, fmt.Errorf("invalid CIDR or IP %q", trimmed)
			}
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result, nil
}

func (p *CustomOAuthProvider) GetTrustedProxyCIDRs() []string {
	values, err := parseTrustedProxyCIDRs(p.TrustedProxyCIDRs)
	if err != nil {
		return nil
	}
	return values
}

func isValidHTTPHeaderName(raw string) bool {
	name := strings.TrimSpace(raw)
	if name == "" || http.CanonicalHeaderKey(name) == "" {
		return false
	}
	for _, ch := range name {
		if ch == '!' || ch == '#' || ch == '$' || ch == '%' || ch == '&' || ch == '\'' ||
			ch == '*' || ch == '+' || ch == '-' || ch == '.' || ch == '^' || ch == '_' ||
			ch == '`' || ch == '|' || ch == '~' ||
			(ch >= '0' && ch <= '9') ||
			(ch >= 'A' && ch <= 'Z') ||
			(ch >= 'a' && ch <= 'z') {
			continue
		}
		return false
	}
	return true
}
