package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

func configureTrustedProxies(engine *gin.Engine) error {
	raw := strings.TrimSpace(os.Getenv("TRUSTED_PROXY_CIDRS"))
	if raw == "" {
		return engine.SetTrustedProxies(nil)
	}

	items := strings.Split(raw, ",")
	trustedProxies := make([]string, 0, len(items))
	for _, item := range items {
		proxy := strings.TrimSpace(item)
		if proxy == "" {
			return fmt.Errorf("TRUSTED_PROXY_CIDRS contains an empty entry")
		}
		trustedProxies = append(trustedProxies, proxy)
	}
	return engine.SetTrustedProxies(trustedProxies)
}
