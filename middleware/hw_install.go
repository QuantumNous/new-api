package middleware

import (
	"sync"

	"github.com/gin-gonic/gin"
)

// HwInstall wires the HisarWeb middleware into the server. The security headers
// come first so every answer carries them, including the panic handler's and
// the 404 of an unregistered route.
//
// The Content-Security-Policy hashes the inline scripts of the page we serve.
// main.go installs this before it injects the optional analytics snippets, so
// the hashes are computed once, at the first request, when indexPage is final.
func HwInstall(server *gin.Engine, indexPage *[]byte) {
	var (
		once sync.Once
		next = HwSecurityHeaders()
	)
	server.Use(func(c *gin.Context) {
		once.Do(func() {
			if indexPage != nil {
				HwSetIndexPageScriptHashes(HwIndexPageScriptHashes(*indexPage))
			}
		})
		next(c)
	})
}
