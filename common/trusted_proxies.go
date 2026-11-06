package common

import (
	"errors"
	"fmt"
	"strings"

	"github.com/gin-gonic/gin"
)

// ResolveTrustedProxies parses TRUSTED_PROXIES without applying it to an
// engine. The returned slice can be reused by the outer and plugin engines.
//
// An unset or blank value trusts no proxies at all: believing forwarded headers
// by default lets any direct client spoof X-Forwarded-For and defeat IP-based
// rate limits and audit logs. Deployments behind a reverse proxy must list that
// proxy explicitly. usedDefaults reports the unset case so the caller can warn.
func ResolveTrustedProxies(raw string) (trustedProxies []string, usedDefaults bool, err error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true, nil
	}
	if strings.EqualFold(raw, "none") {
		return nil, false, nil
	}

	parts := strings.Split(raw, ",")
	trustedProxies = make([]string, 0, len(parts))
	for _, part := range parts {
		trustedProxy := strings.TrimSpace(part)
		if trustedProxy == "" {
			continue
		}
		if strings.EqualFold(trustedProxy, "none") {
			return nil, false, errors.New("TRUSTED_PROXIES=none must be used alone")
		}
		trustedProxies = append(trustedProxies, trustedProxy)
	}
	if len(trustedProxies) == 0 {
		return nil, false, errors.New("TRUSTED_PROXIES does not contain an IP address or CIDR")
	}
	return trustedProxies, false, nil
}

func ConfigureTrustedProxies(engine *gin.Engine, trustedProxies []string) error {
	if err := engine.SetTrustedProxies(trustedProxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	return nil
}
