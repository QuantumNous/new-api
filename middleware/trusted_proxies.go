package middleware

import (
	"log"
	"os"

	"github.com/QuantumNous/new-api/common"
	"github.com/gin-gonic/gin"
)

func ConfigureTrustedProxies(engine *gin.Engine) error {
	trustedProxies, usedDefaults, err := common.ResolveTrustedProxies(os.Getenv("TRUSTED_PROXIES"))
	if err != nil {
		return err
	}
	if usedDefaults {
		log.Print(common.LogText("WARNING: TRUSTED_PROXIES is unset, so client IPs are read from the TCP peer and forwarded headers are ignored. Behind a reverse proxy or load balancer, set TRUSTED_PROXIES to its IPs/CIDRs (for example 127.0.0.0/8,10.0.0.0/8) so client IPs, rate limits, and audit logs stay correct."))
	}
	return common.ConfigureTrustedProxies(engine, trustedProxies)
}
