package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// Machine-facing endpoints of the desktop device authorization flow answer in
// the OAuth 2.0 device grant shape (RFC 8628) so the desktop client can treat
// them with a standard polling loop.
const (
	deviceErrorAuthorizationPending = "authorization_pending"
	deviceErrorSlowDown             = "slow_down"
	deviceErrorExpiredToken         = "expired_token"
	deviceErrorAccessDenied         = "access_denied"
	deviceErrorInvalidRequest       = "invalid_request"
	deviceErrorInvalidGrant         = "invalid_grant"
	deviceErrorServerError          = "server_error"
)

func deviceAuthError(c *gin.Context, status int, code string, description string) {
	c.JSON(status, gin.H{
		"error":             code,
		"error_description": description,
	})
}

func desktopBaseURL() string {
	return strings.TrimSuffix(strings.TrimSpace(system_setting.ServerAddress), "/")
}

// RequestDeviceAuthCode starts a desktop sign-in and returns the pair of codes:
// the secret device code the app polls with, and the short code the user reads
// out into the browser.
func RequestDeviceAuthCode(c *gin.Context) {
	if !system_setting.GetDesktopSettings().Enabled {
		deviceAuthError(c, http.StatusForbidden, deviceErrorInvalidRequest, common.TranslateMessage(c, i18n.MsgDeviceAuthDisabled))
		return
	}
	var req struct {
		ClientName string `json:"client_name"`
	}
	_ = c.ShouldBindJSON(&req)
	clientName := strings.TrimSpace(req.ClientName)
	if clientName == "" {
		clientName = system_setting.GetDesktopSettings().TokenName
	}
	if len(clientName) > 50 {
		clientName = clientName[:50]
	}

	request, err := service.NewDeviceAuthRequest(clientName, c.ClientIP())
	if err != nil {
		common.SysError("failed to create device authorization request: " + err.Error())
		deviceAuthError(c, http.StatusInternalServerError, deviceErrorServerError, "failed to create device authorization request")
		return
	}

	base := desktopBaseURL()
	formatted := service.FormatUserCode(request.UserCode)
	c.JSON(http.StatusOK, gin.H{
		"device_code":               request.DeviceCode,
		"user_code":                 formatted,
		"verification_uri":          base + "/device",
		"verification_uri_complete": base + "/device?code=" + formatted,
		"interval":                  int(service.DeviceAuthPollInterval.Seconds()),
		"expires_in":                int(service.DeviceAuthLifetime.Seconds()),
	})
}

// PollDeviceAuthToken is the desktop app's polling endpoint. A successful poll
// consumes the request, so the credentials are handed out exactly once.
func PollDeviceAuthToken(c *gin.Context) {
	var req struct {
		DeviceCode string `json:"device_code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.DeviceCode) == "" {
		deviceAuthError(c, http.StatusBadRequest, deviceErrorInvalidRequest, "device_code is required")
		return
	}

	// The poll consumes an approved request in the same atomic step it reads it,
	// so racing polls cannot both walk away with the credentials.
	request, tooSoon, err := service.PollDeviceAuthRequest(req.DeviceCode)
	if err != nil {
		deviceAuthError(c, http.StatusBadRequest, deviceErrorExpiredToken, "device code is unknown or expired")
		return
	}
	if request.Expired() {
		deviceAuthError(c, http.StatusBadRequest, deviceErrorExpiredToken, "device code has expired")
		return
	}
	if request.Status == service.DeviceAuthStatusDenied {
		deviceAuthError(c, http.StatusBadRequest, deviceErrorAccessDenied, "the user denied this request")
		return
	}
	if request.Status != service.DeviceAuthStatusApproved {
		if tooSoon {
			deviceAuthError(c, http.StatusBadRequest, deviceErrorSlowDown, "polling too frequently")
			return
		}
		deviceAuthError(c, http.StatusBadRequest, deviceErrorAuthorizationPending, "waiting for the user to approve")
		return
	}

	// From here the request is already consumed, so any failure has to take the
	// relay token with it rather than leave an unlimited key nobody can reach.
	user, err := model.GetUserById(request.UserId, false)
	if err != nil || user.Status != common.UserStatusEnabled {
		revokeDesktopRelayToken(request)
		deviceAuthError(c, http.StatusBadRequest, deviceErrorAccessDenied, "user is unavailable")
		return
	}

	accessToken, refreshToken, expiresIn, err := service.IssueDesktopSession(user, request.RelayTokenId)
	if err != nil {
		common.SysError("failed to issue desktop session: " + err.Error())
		revokeDesktopRelayToken(request)
		deviceAuthError(c, http.StatusInternalServerError, deviceErrorServerError, "failed to issue desktop session")
		return
	}
	apiKey := request.ApiKey

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
		"expires_in":    expiresIn,
		"user_id":       user.Id,
		"username":      user.Username,
		"api_key":       "sk-" + apiKey,
		"base_url":      desktopBaseURL() + "/v1",
	})
}

// RefreshDeviceAuthToken swaps a refresh token for a new access token. The
// session dies with its relay API key, so revoking that key in the console
// logs the desktop app out.
func RefreshDeviceAuthToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || strings.TrimSpace(req.RefreshToken) == "" {
		deviceAuthError(c, http.StatusBadRequest, deviceErrorInvalidRequest, "refresh_token is required")
		return
	}
	claims, err := service.ParseDesktopToken(req.RefreshToken, service.DesktopTokenTypeRefresh)
	if err != nil {
		deviceAuthError(c, http.StatusUnauthorized, deviceErrorInvalidGrant, "refresh token is invalid or expired")
		return
	}
	userId, err := strconv.Atoi(claims.Subject)
	if err != nil {
		deviceAuthError(c, http.StatusUnauthorized, deviceErrorInvalidGrant, "refresh token subject is invalid")
		return
	}
	user, err := model.GetUserById(userId, false)
	if err != nil || user.Status != common.UserStatusEnabled {
		deviceAuthError(c, http.StatusUnauthorized, deviceErrorInvalidGrant, "user is unavailable")
		return
	}
	relayToken, err := model.GetTokenByIds(claims.RelayTokenId, userId)
	if err != nil || relayToken.Status != common.TokenStatusEnabled {
		deviceAuthError(c, http.StatusUnauthorized, deviceErrorInvalidGrant, "the desktop API key has been revoked")
		return
	}

	accessToken, refreshToken, expiresIn, err := service.IssueDesktopSession(user, claims.RelayTokenId)
	if err != nil {
		common.SysError("failed to refresh desktop session: " + err.Error())
		deviceAuthError(c, http.StatusInternalServerError, deviceErrorServerError, "failed to refresh desktop session")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"token_type":    "Bearer",
		"expires_in":    expiresIn,
		"user_id":       user.Id,
		"base_url":      desktopBaseURL() + "/v1",
	})
}

// GetDeviceAuthInfo backs the browser approval page: it resolves the code the
// user typed so the page can show what is about to be authorized.
func GetDeviceAuthInfo(c *gin.Context) {
	request, err := service.GetDeviceAuthByUserCode(c.Query("user_code"))
	if err != nil {
		if errors.Is(err, service.ErrDeviceAuthNotFound) {
			common.ApiErrorI18n(c, i18n.MsgDeviceAuthNotFound)
			return
		}
		common.ApiError(c, err)
		return
	}
	if request.Expired() {
		service.DeleteDeviceAuthRequest(request)
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthExpired)
		return
	}
	if request.Status != service.DeviceAuthStatusPending {
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthAlreadyUsed)
		return
	}
	common.ApiSuccess(c, gin.H{
		"user_code":   service.FormatUserCode(request.UserCode),
		"client_name": request.ClientName,
		"client_ip":   request.ClientIP,
		"created_at":  request.CreatedAt,
		"expires_at":  request.CreatedAt + int64(service.DeviceAuthLifetime.Seconds()),
	})
}

// ApproveDeviceAuth records the user's decision. Approving also mints the relay
// API key the desktop app will use for model traffic, so the app never asks the
// user to paste a key.
func ApproveDeviceAuth(c *gin.Context) {
	var req struct {
		UserCode string `json:"user_code"`
		Approve  bool   `json:"approve"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	if !req.Approve {
		if err := service.DenyDeviceAuthRequest(req.UserCode, userId); err != nil {
			deviceAuthDecisionError(c, err)
			return
		}
		common.ApiSuccess(c, gin.H{"status": service.DeviceAuthStatusDenied})
		return
	}

	// Claiming first means a double-submitted approval cannot mint two unlimited
	// desktop keys for the same request.
	request, err := service.ClaimDeviceAuthForApproval(req.UserCode, userId)
	if err != nil {
		deviceAuthDecisionError(c, err)
		return
	}

	count, err := model.CountUserTokens(userId)
	if err != nil {
		service.AbandonDeviceAuthApproval(request.DeviceCode)
		common.ApiError(c, err)
		return
	}
	if int(count) >= operation_setting.GetMaxUserTokens() {
		service.AbandonDeviceAuthApproval(request.DeviceCode)
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthTokenLimit)
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.SysError("failed to generate desktop token key: " + err.Error())
		service.AbandonDeviceAuthApproval(request.DeviceCode)
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthCreateFailed)
		return
	}
	relayToken := model.Token{
		UserId:         userId,
		Name:           request.ClientName,
		Key:            key,
		CreatedTime:    common.GetTimestamp(),
		AccessedTime:   common.GetTimestamp(),
		ExpiredTime:    -1,
		UnlimitedQuota: true,
	}
	if err := relayToken.Insert(); err != nil {
		service.AbandonDeviceAuthApproval(request.DeviceCode)
		common.ApiError(c, err)
		return
	}

	if err := service.CompleteDeviceAuthApproval(request.DeviceCode, relayToken.Id, key); err != nil {
		// The key exists but the desktop will never be told about it.
		if delErr := model.DeleteTokenById(relayToken.Id, userId); delErr != nil {
			common.SysError("failed to revoke unreachable desktop token: " + delErr.Error())
		}
		service.AbandonDeviceAuthApproval(request.DeviceCode)
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"status":     service.DeviceAuthStatusApproved,
		"token_name": relayToken.Name,
	})
}

func deviceAuthDecisionError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrDeviceAuthNotFound):
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthNotFound)
	case errors.Is(err, service.ErrDeviceAuthExpired):
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthExpired)
	case errors.Is(err, service.ErrDeviceAuthAlreadyUsed):
		common.ApiErrorI18n(c, i18n.MsgDeviceAuthAlreadyUsed)
	default:
		common.ApiError(c, err)
	}
}

// revokeDesktopRelayToken drops the unlimited key created for an approval whose
// handoff could not be completed.
func revokeDesktopRelayToken(request *service.DeviceAuthRequest) {
	if request.RelayTokenId == 0 {
		return
	}
	if err := model.DeleteTokenById(request.RelayTokenId, request.UserId); err != nil {
		common.SysError("failed to revoke undelivered desktop token: " + err.Error())
	}
}

// GetDesktopJWKS publishes the desktop token signing key so the connector
// broker can verify sessions at the edge.
func GetDesktopJWKS(c *gin.Context) {
	keys, err := service.DesktopJWKS()
	if err != nil {
		common.SysError("failed to build desktop JWKS: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"keys": []any{}})
		return
	}
	c.JSON(http.StatusOK, keys)
}
