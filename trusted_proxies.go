package main

import (
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func configureTrustedProxies(engine *gin.Engine) error {
	rawTrustedProxies := os.Getenv("TRUSTED_PROXIES")
	if strings.TrimSpace(rawTrustedProxies) == "" {
		// Gin trusts all proxies by default. An explicit nil default prevents a
		// direct client from spoofing X-Forwarded-For to evade IP rate limits.
		return engine.SetTrustedProxies(nil)
	}

	parts := strings.Split(rawTrustedProxies, ",")
	trustedProxies := make([]string, 0, len(parts))
	for _, part := range parts {
		trustedProxy := strings.TrimSpace(part)
		if trustedProxy != "" {
			trustedProxies = append(trustedProxies, trustedProxy)
		}
	}
	if len(trustedProxies) == 0 {
		return errors.New("TRUSTED_PROXIES does not contain an IP address or CIDR")
	}
	if err := engine.SetTrustedProxies(trustedProxies); err != nil {
		return fmt.Errorf("invalid TRUSTED_PROXIES: %w", err)
	}
	return nil
}
