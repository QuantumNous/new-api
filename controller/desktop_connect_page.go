package controller

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

// ServeDesktopConnectSPA serves the TanStack SPA shell for /desktop/connect.
// The standalone connect.html page was retired; clients keep the same URL while
// the UI shares the dashboard auth session (no separate /connect.js mini-auth).
func ServeDesktopConnectSPA(c *gin.Context, indexPage []byte) {
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", indexPage)
}
