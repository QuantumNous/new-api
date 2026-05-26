package router

import (
	"github.com/QuantumNous/new-api/pkg/requestaudit"
	"github.com/gin-gonic/gin"
)

// RegisterRelayForkMiddleware registers fork-only relay middleware (not in upstream).
func RegisterRelayForkMiddleware(router *gin.Engine) {
	router.Use(requestaudit.Middleware())
}
