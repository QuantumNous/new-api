package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

type desktopBootstrapCapabilities struct {
	DeviceAuthorization bool `json:"device_authorization"`
	AccountRead         bool `json:"account_read"`
	UsageRead           bool `json:"usage_read"`
	ModelsRead          bool `json:"models_read"`
	PricingRead         bool `json:"pricing_read"`
	ToolKeysManage      bool `json:"tool_keys_manage"`
}

type desktopBootstrapData struct {
	SchemaVersion        int                          `json:"schema_version"`
	Service              string                       `json:"service"`
	ContractID           string                       `json:"contract_id"`
	MinimumClientVersion string                       `json:"minimum_client_version"`
	Capabilities         desktopBootstrapCapabilities `json:"capabilities"`
}

type desktopBootstrapResponse struct {
	Success bool                 `json:"success"`
	Data    desktopBootstrapData `json:"data"`
}

// GetDesktopBootstrap exposes format compatibility only. Capability activation
// requires a separately versioned and governed desktop contract.
func GetDesktopBootstrap(c *gin.Context) {
	c.JSON(http.StatusOK, desktopBootstrapResponse{
		Success: true,
		Data: desktopBootstrapData{
			SchemaVersion:        1,
			Service:              "yeschoy-desktop",
			ContractID:           "desktop-bootstrap-v1",
			MinimumClientVersion: "0.1.0",
			Capabilities:         desktopBootstrapCapabilities{},
		},
	})
}

type desktopV2BootstrapData struct {
	SchemaVersion                int     `json:"schema_version"`
	Service                      string  `json:"service"`
	ContractID                   string  `json:"contract_id"`
	MinimumClientVersion         string  `json:"minimum_client_version"`
	DeviceAuthorizationAvailable bool    `json:"device_authorization_available"`
	AccountRead                  bool    `json:"account_read"`
	UsageRead                    bool    `json:"usage_read"`
	ModelsRead                   bool    `json:"models_read"`
	PricingRead                  bool    `json:"pricing_read"`
	ToolKeysManage               bool    `json:"tool_keys_manage"`
	OfficialUSDCNYRate           float64 `json:"official_usd_cny_rate"`
	AuthorizationStartPath       string  `json:"authorization_start_path"`
	AuthorizationTokenPath       string  `json:"authorization_token_path"`
	SessionRefreshPath           string  `json:"session_refresh_path"`
	SessionLogoutPath            string  `json:"session_logout_path"`
	AccountPath                  string  `json:"account_path"`
	UsageSummaryPath             string  `json:"usage_summary_path"`
	UsageRecordsPath             string  `json:"usage_records_path"`
	ModelsPath                   string  `json:"models_path"`
	PricingPath                  string  `json:"pricing_path"`
	ToolKeysPath                 string  `json:"tool_keys_path"`
	WalletURL                    string  `json:"wallet_url"`
}

type desktopDeviceAuthorizationCreateRequest struct {
	ClientName string `json:"client_name"`
}

type desktopDeviceAuthorizationDecisionRequest struct {
	UserCode string `json:"user_code"`
	Decision string `json:"decision"`
}

type desktopDeviceAuthorizationTokenRequest struct {
	DeviceCode string `json:"device_code"`
}

type desktopSessionRefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
	SessionID    string `json:"session_id"`
}

func GetDesktopBootstrapV2(c *gin.Context) {
	serverAddress := strings.TrimRight(strings.TrimSpace(system_setting.ServerAddress), "/")
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": desktopV2BootstrapData{
			SchemaVersion:                2,
			Service:                      "yeschoy-desktop",
			ContractID:                   "desktop-integration-v2",
			MinimumClientVersion:         "0.2.0",
			DeviceAuthorizationAvailable: service.DesktopDeviceAuthorizationAvailable(),
			AccountRead:                  true,
			UsageRead:                    true,
			ModelsRead:                   true,
			PricingRead:                  true,
			ToolKeysManage:               true,
			OfficialUSDCNYRate:           6.75,
			AuthorizationStartPath:       "/api/desktop/v2/device-authorizations",
			AuthorizationTokenPath:       "/api/desktop/v2/device-authorizations/token",
			SessionRefreshPath:           "/api/desktop/v2/sessions/refresh",
			SessionLogoutPath:            "/api/desktop/v2/sessions/current",
			AccountPath:                  "/api/user/self",
			UsageSummaryPath:             "/api/log/self/stat",
			UsageRecordsPath:             "/api/log/self",
			ModelsPath:                   "/api/user/models",
			PricingPath:                  "/api/pricing",
			ToolKeysPath:                 "/api/token/",
			WalletURL:                    serverAddress + "/wallet/",
		},
	})
}

func CreateDesktopDeviceAuthorization(c *gin.Context) {
	setAuthNoStore(c)
	request := desktopDeviceAuthorizationCreateRequest{}
	if c.Request.ContentLength != 0 {
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			writeDesktopAuthorizationError(c, &service.DesktopDeviceAuthorizationError{Code: "invalid_request"})
			return
		}
	}
	view, err := service.CreateDesktopDeviceAuthorization(request.ClientName, system_setting.ServerAddress)
	if err != nil {
		writeDesktopAuthorizationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": view})
}

func DecideDesktopDeviceAuthorization(c *gin.Context) {
	setAuthNoStore(c)
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "code": "browser_session_required", "message": "a live browser session is required"})
		return
	}
	request := desktopDeviceAuthorizationDecisionRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		writeDesktopAuthorizationError(c, &service.DesktopDeviceAuthorizationError{Code: "invalid_request"})
		return
	}
	status, _, err := service.DecideDesktopDeviceAuthorization(request.UserCode, request.Decision, identity.UserID, identity.UserAuthVersion)
	if err != nil {
		writeDesktopAuthorizationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"status": status}})
}

func ExchangeDesktopDeviceAuthorization(c *gin.Context) {
	setAuthNoStore(c)
	request := desktopDeviceAuthorizationTokenRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		writeDesktopAuthorizationError(c, &service.DesktopDeviceAuthorizationError{Code: "invalid_request"})
		return
	}
	bundle, err := service.ExchangeDesktopDeviceAuthorization(request.DeviceCode, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		writeDesktopAuthorizationError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": desktopAuthBundleData(bundle)})
}

func RefreshDesktopSession(c *gin.Context) {
	setAuthNoStore(c)
	request := desktopSessionRefreshRequest{}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || strings.TrimSpace(request.RefreshToken) == "" || strings.TrimSpace(request.SessionID) == "" {
		writeDesktopAuthorizationError(c, &service.DesktopDeviceAuthorizationError{Code: "invalid_request"})
		return
	}
	bundle, _, err := service.RefreshLoginSession(request.RefreshToken, request.SessionID, c.ClientIP(), c.Request.UserAgent())
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": desktopAuthBundleData(bundle)})
}

func RevokeCurrentDesktopSession(c *gin.Context) {
	setAuthNoStore(c)
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "code": "desktop_session_required", "message": "a desktop session is required"})
		return
	}
	revoked, err := model.RevokeUserSession(identity.UserID, identity.SessionID, "desktop_logout")
	if err != nil {
		writeAuthSessionError(c, err)
		return
	}
	if !revoked {
		c.JSON(http.StatusUnauthorized, gin.H{"success": false, "code": "AUTH_SESSION_REVOKED", "message": "session is not active"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "data": gin.H{"revoked_sid": identity.SessionID}})
}

func desktopAuthBundleData(bundle *service.AuthBundle) gin.H {
	return gin.H{
		"access_token":       bundle.AccessToken,
		"token_type":         bundle.TokenType,
		"access_expires_at":  bundle.AccessExpiresAt,
		"refresh_token":      bundle.RefreshToken,
		"refresh_expires_at": bundle.Session.ExpiresAt,
		"session_id":         bundle.Session.SID,
	}
}

func writeDesktopAuthorizationError(c *gin.Context, err error) {
	var flowErr *service.DesktopDeviceAuthorizationError
	if !errors.As(err, &flowErr) {
		flowErr = &service.DesktopDeviceAuthorizationError{Code: "server_error", Cause: err}
	}
	status := http.StatusBadRequest
	switch flowErr.Code {
	case "authorization_pending":
		status = http.StatusBadRequest
	case "slow_down":
		status = http.StatusTooManyRequests
	case "access_denied":
		status = http.StatusForbidden
	case "already_used", "decision_conflict":
		status = http.StatusConflict
	case "temporarily_unavailable", "server_error":
		status = http.StatusServiceUnavailable
	}
	response := gin.H{"success": false, "code": flowErr.Code, "message": http.StatusText(status)}
	if flowErr.RetryAfter > 0 {
		response["retry_after"] = flowErr.RetryAfter
		c.Header("Retry-After", strconv.Itoa(flowErr.RetryAfter))
	}
	c.JSON(status, response)
}
