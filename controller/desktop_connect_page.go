package controller

import (
	_ "embed"
	"net/http"

	"github.com/gin-gonic/gin"
)

//go:embed desktoppages/connect.html
var desktopConnectPageHTML []byte

func ServeDesktopConnectPage(c *gin.Context) {
	c.Header("Cache-Control", "no-cache")
	c.Data(http.StatusOK, "text/html; charset=utf-8", desktopConnectPageHTML)
}
