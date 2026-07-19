package router

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/controller"
	"github.com/QuantumNous/new-api/middleware"

	"github.com/gin-gonic/gin"
)

type Plane string

const (
	PlaneAll        Plane = "all"
	PlaneRelay      Plane = "relay"
	PlaneManagement Plane = "management"
)

type frontendMode string

const (
	frontendModeAuto     frontendMode = "auto"
	frontendModeEmbedded frontendMode = "embedded"
	frontendModeRedirect frontendMode = "redirect"
	frontendModeDisabled frontendMode = "disabled"
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

// parseFrontendMode 解析前端交付模式，空值保持旧版自动选择行为。
func parseFrontendMode(value string) (frontendMode, error) {
	switch frontendMode(strings.ToLower(strings.TrimSpace(value))) {
	case "", frontendModeAuto:
		return frontendModeAuto, nil
	case frontendModeEmbedded:
		return frontendModeEmbedded, nil
	case frontendModeRedirect:
		return frontendModeRedirect, nil
	case frontendModeDisabled:
		return frontendModeDisabled, nil
	default:
		return "", errors.New("FRONTEND_MODE must be one of: auto, embedded, redirect, disabled")
	}
}

func SetRouter(router *gin.Engine, assets ThemeAssets) error {
	return SetRouterForPlane(router, assets, PlaneAll)
}

func SetRouterForPlane(engine *gin.Engine, assets ThemeAssets, plane Plane) error {
	normalizedPlane, err := ParsePlane(string(plane))
	if err != nil {
		return err
	}
	plane = normalizedPlane
	engine.Use(middleware.CORS())
	livenessHandler := func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok", "plane": plane})
	}
	engine.GET("/healthz", livenessHandler)
	engine.GET("/livez", livenessHandler)
	engine.GET("/readyz", controller.GetReadiness)

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
	return setFrontendRouter(engine, assets)
}

// setFrontendRouter 按显式模式注册嵌入页面、外部跳转或纯后端路由。
func setFrontendRouter(router *gin.Engine, assets ThemeAssets) error {
	mode, err := parseFrontendMode(os.Getenv("FRONTEND_MODE"))
	if err != nil {
		return err
	}

	switch mode {
	case frontendModeEmbedded:
		return registerEmbeddedFrontend(router, assets)
	case frontendModeRedirect:
		return registerFrontendRedirect(router, os.Getenv("FRONTEND_BASE_URL"))
	case frontendModeDisabled:
		// 纯后端模式故意不注册 NoRoute，未知路径由 Gin 返回 404。
		return nil
	case frontendModeAuto:
		frontendBaseURL := strings.TrimSpace(os.Getenv("FRONTEND_BASE_URL"))
		if frontendBaseURL != "" && !common.IsMasterNode {
			return registerFrontendRedirect(router, frontendBaseURL)
		}
		if frontendBaseURL != "" {
			common.SysLog("FRONTEND_BASE_URL is ignored on master node in FRONTEND_MODE=auto")
		}
		return registerEmbeddedFrontend(router, assets)
	default:
		return fmt.Errorf("unsupported frontend mode %q", mode)
	}
}

// registerEmbeddedFrontend 校验嵌入资源存在后注册原有双主题静态路由。
func registerEmbeddedFrontend(router *gin.Engine, assets ThemeAssets) error {
	if !assets.Available() {
		return errors.New("embedded frontend assets are unavailable; use FRONTEND_MODE=disabled or redirect for a frontend_external build")
	}
	SetWebRouter(router, assets)
	return nil
}

// registerFrontendRedirect 把非 API 页面永久跳转到独立前端入口。
func registerFrontendRedirect(router *gin.Engine, rawBaseURL string) error {
	frontendBaseURL, err := normalizeFrontendBaseURL(rawBaseURL)
	if err != nil {
		return err
	}
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseURL, c.Request.RequestURI))
	})
	return nil
}

// normalizeFrontendBaseURL 只接受无凭据、无路径、无查询参数的 HTTP(S) 前端源站。
func normalizeFrontendBaseURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", errors.New("FRONTEND_BASE_URL is required when FRONTEND_MODE=redirect")
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("invalid FRONTEND_BASE_URL: %w", err)
	}
	if (parsed.Scheme != "http" && parsed.Scheme != "https") || parsed.Host == "" {
		return "", errors.New("FRONTEND_BASE_URL must be an absolute HTTP(S) origin")
	}
	if parsed.User != nil || parsed.RawQuery != "" || parsed.Fragment != "" || (parsed.Path != "" && parsed.Path != "/") {
		return "", errors.New("FRONTEND_BASE_URL must not contain credentials, a path, a query, or a fragment")
	}
	return parsed.Scheme + "://" + parsed.Host, nil
}
