package router

import (
	"errors"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

type Plane string

const (
	PlaneAll        Plane = "all"
	PlaneRelay      Plane = "relay"
	PlaneManagement Plane = "management"
)

func ParsePlane(value string) (Plane, error) {
	switch Plane(strings.ToLower(strings.TrimSpace(value))) {
	case "", PlaneAll:
		return PlaneAll, nil
	case PlaneRelay:
		return PlaneRelay, nil
	case PlaneManagement:
		return PlaneManagement, nil
	default:
		return "", errors.New("APP_PLANE must be one of: all, relay, management")
	}
}

func SetRouter(router *gin.Engine, assets ThemeAssets) {
	_ = SetRouterForPlane(router, assets, PlaneAll)
}

func SetRouterForPlane(engine *gin.Engine, assets ThemeAssets, plane Plane) error {
	if _, err := ParsePlane(string(plane)); err != nil {
		return err
	}
	engine.Use(middleware.CORS())
	engine.GET("/healthz", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "plane": plane})
	})

	if plane == PlaneAll || plane == PlaneManagement {
		SetApiRouter(engine)
		SetDashboardRouter(engine)
	}
	if plane == PlaneAll || plane == PlaneRelay {
		SetRelayRouter(engine)
		SetVideoRouter(engine)
	}
	if plane == PlaneRelay {
		return nil
	}
	setFrontendRouter(engine, assets)
	return nil
}

func setFrontendRouter(router *gin.Engine, assets ThemeAssets) {
	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, assets)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
