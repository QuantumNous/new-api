package middleware

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

func SeedanceRequestConvert() func(c *gin.Context) {
	return func(c *gin.Context) {
		c.Set(common.KeySeedanceOfficialAPI, true)

		if c.Request.Method == http.MethodPost {
			c.Request.URL.Path = "/v1/video/generations"
			c.Set("relay_mode", relayconstant.RelayModeVideoSubmit)
		}

		c.Next()
	}
}
