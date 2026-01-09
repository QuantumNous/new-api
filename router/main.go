package router

import (
	"embed"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"

	"github.com/gin-gonic/gin"
)

func SetRouter(router *gin.Engine, buildFS embed.FS, indexPage []byte) {
	// BASE_PATH 支持子路径部署，如 /api-server
	basePath := strings.TrimSuffix(os.Getenv("BASE_PATH"), "/")
	if basePath != "" {
		router.Use(func(c *gin.Context) {
			if strings.HasPrefix(c.Request.URL.Path, basePath) {
				c.Request.URL.Path = strings.TrimPrefix(c.Request.URL.Path, basePath)
				if c.Request.URL.Path == "" {
					c.Request.URL.Path = "/"
				}
			}
			c.Next()
		})
	}

	SetApiRouter(router)
	SetDashboardRouter(router)
	SetRelayRouter(router)
	SetVideoRouter(router)
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
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
