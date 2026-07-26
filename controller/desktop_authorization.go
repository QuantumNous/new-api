package controller

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

func desktopNoStore(c *gin.Context) {
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
}
func desktopOAuthError(c *gin.Context, status int, code, description string) {
	desktopNoStore(c)
	c.JSON(status, gin.H{"error": code, "error_description": description})
}

func CreateDesktopAuthorization(c *gin.Context) {
	var r struct {
		ClientID            string `json:"client_id"`
		RedirectURI         string `json:"redirect_uri"`
		CodeChallenge       string `json:"code_challenge"`
		CodeChallengeMethod string `json:"code_challenge_method"`
		State               string `json:"state"`
		ClientName          string `json:"client_name"`
	}
	if c.ShouldBindJSON(&r) != nil {
		desktopOAuthError(c, 400, "invalid_request", "invalid JSON")
		return
	}
	a, err := service.CreateDesktopAuthorization(r.ClientID, r.RedirectURI, r.CodeChallenge, r.CodeChallengeMethod, r.State, r.ClientName)
	if err != nil {
		desktopOAuthError(c, 400, "invalid_request", err.Error())
		return
	}
	desktopNoStore(c)
	c.JSON(201, gin.H{"id": a.ID, "expires_in": 600})
}
func GetDesktopAuthorization(c *gin.Context) {
	a, err := service.GetDesktopAuthorization(c.Param("id"))
	if err != nil {
		desktopOAuthError(c, 404, "invalid_request", "authorization request not found")
		return
	}
	desktopNoStore(c)
	c.JSON(200, gin.H{"id": a.ID, "client_id": a.ClientID, "client_name": a.ClientName, "redirect_uri": a.RedirectURI, "status": a.Status, "expires_at": a.ExpiresAt})
}
func DecideDesktopAuthorization(c *gin.Context) {
	var r struct {
		Approve bool `json:"approve"`
	}
	if c.ShouldBindJSON(&r) != nil {
		desktopOAuthError(c, 400, "invalid_request", "invalid JSON")
		return
	}
	code, a, err := service.DecideDesktopAuthorization(c.Param("id"), c.GetInt("id"), r.Approve)
	if err != nil {
		desktopOAuthError(c, 409, "invalid_request", "request already decided or expired")
		return
	}
	target := a.RedirectURI
	u, _ := url.Parse(target)
	q := u.Query()
	if r.Approve {
		q.Set("code", code)
	} else {
		q.Set("error", "access_denied")
	}
	q.Set("state", a.State)
	u.RawQuery = q.Encode()
	desktopNoStore(c)
	c.JSON(200, gin.H{"status": a.Status, "redirect_uri": u.String()})
}
func ExchangeDesktopToken(c *gin.Context) {
	var r struct {
		GrantType    string `json:"grant_type"`
		Code         string `json:"code"`
		CodeVerifier string `json:"code_verifier"`
		ClientID     string `json:"client_id"`
		RedirectURI  string `json:"redirect_uri"`
	}
	if c.ShouldBindJSON(&r) != nil || r.GrantType != "authorization_code" {
		desktopOAuthError(c, 400, "invalid_request", "authorization_code grant required")
		return
	}
	access, refresh, key, expires, err := service.ExchangeDesktopCode(r.Code, r.CodeVerifier, r.ClientID, r.RedirectURI)
	if err != nil {
		desktopOAuthError(c, 400, "invalid_grant", "code is invalid or expired")
		return
	}
	desktopNoStore(c)
	c.JSON(200, gin.H{"access_token": access, "refresh_token": refresh, "token_type": "Bearer", "expires_in": expires, "api_key": key, "base_url": desktopBaseURL() + "/v1"})
}
func RefreshDesktopToken(c *gin.Context) {
	var r struct {
		GrantType    string `json:"grant_type"`
		RefreshToken string `json:"refresh_token"`
	}
	if c.ShouldBindJSON(&r) != nil || strings.TrimSpace(r.RefreshToken) == "" || (r.GrantType != "" && r.GrantType != "refresh_token") {
		desktopOAuthError(c, 400, "invalid_request", "refresh_token is required")
		return
	}
	access, refresh, expires, err := service.RotateDesktopRefresh(r.RefreshToken)
	if err != nil {
		desktopOAuthError(c, 401, "invalid_grant", "refresh token is invalid or expired")
		return
	}
	desktopNoStore(c)
	c.JSON(200, gin.H{"access_token": access, "refresh_token": refresh, "token_type": "Bearer", "expires_in": expires})
}
func RevokeDesktopToken(c *gin.Context) {
	var r struct {
		RefreshToken string `json:"refresh_token"`
		Token        string `json:"token"`
	}
	if c.ShouldBindJSON(&r) != nil {
		desktopOAuthError(c, 400, "invalid_request", "invalid JSON")
		return
	}
	if r.RefreshToken == "" {
		r.RefreshToken = r.Token
	}
	if err := service.RevokeDesktopRefresh(r.RefreshToken); err != nil {
		desktopOAuthError(c, http.StatusInternalServerError, "server_error", "desktop session could not be revoked")
		return
	}
	desktopNoStore(c)
	c.Status(http.StatusNoContent)
}
func GetDesktopSessionStatus(c *gin.Context) {
	authorization := strings.TrimSpace(c.GetHeader("Authorization"))
	if !strings.HasPrefix(authorization, "Bearer ") {
		desktopOAuthError(c, http.StatusUnauthorized, "invalid_token", "bearer token required")
		return
	}
	session, err := service.GetActiveDesktopSession(strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer ")))
	if err != nil {
		desktopOAuthError(c, http.StatusUnauthorized, "invalid_token", "desktop session is inactive")
		return
	}
	desktopNoStore(c)
	c.JSON(http.StatusOK, gin.H{"active": true, "user_id": session.UserID, "session_id": session.ID})
}
func ListDesktopSessions(c *gin.Context) {
	s, err := service.ListDesktopSessions(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	desktopNoStore(c)
	common.ApiSuccess(c, s)
}
func DeleteDesktopSession(c *gin.Context) {
	if err := service.RevokeDesktopSession(c.GetInt("id"), c.Param("id")); err != nil {
		common.ApiError(c, err)
		return
	}
	desktopNoStore(c)
	common.ApiSuccess(c, nil)
}
