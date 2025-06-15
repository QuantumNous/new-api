package router

import (
	"embed"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"net/url"
	"one-api/common"
	"os"
	"strings"
)

func SetRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	SetApiRouter(router)
	SetDashboardRouter(router)
	SetRelayRouter(router)
	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, buildFS, indexPage)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			if frontendURL, err := url.Parse(frontendBaseUrl); err == nil {
				if frontendURL.Host == c.Request.Host {
					common.LogWarn(c, "Misconfiguration detected: FRONTEND_BASE_URL is set to the address of the slave node itself, which would cause a redirect loop. Please set FRONTEND_BASE_URL to the address of the master node.")
					c.JSON(http.StatusInternalServerError, gin.H{
						"success": false,
						"message": "The service is temporarily unavailable due to a configuration issue. Please contact the administrator.",
					})
					return
				}
			}
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
