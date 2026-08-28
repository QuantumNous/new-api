package controller

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

// OAuthProviderAuthorize handles GET /oauth/authorize — shows consent page or redirects to login
func OAuthProviderAuthorize(c *gin.Context) {
	common.SysLog("OAuthProviderAuthorize called!")
	clientId := c.Query("client_id")
	redirectUri := c.Query("redirect_uri")
	responseType := c.Query("response_type")
	scope := c.DefaultQuery("scope", "openid profile email")
	state := c.Query("state")

	if responseType != "code" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_response_type", "error_description": "Only 'code' is supported"})
		return
	}
	if clientId == "" || redirectUri == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "client_id and redirect_uri are required"})
		return
	}

	// Validate client
	client, err := model.GetOAuthClientByClientId(clientId)
	if err != nil || !client.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_client", "error_description": "Unknown or disabled client_id"})
		return
	}
	// Validate redirect_uri (must match registered URI)
	if client.RedirectUri != redirectUri {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "redirect_uri not registered for this client"})
		return
	}

	// Check user session
	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		// Redirect to login, then back here
		loginUrl := fmt.Sprintf("%s/sign-in?next=%s",
			system_setting.ServerAddress,
			url.QueryEscape(c.Request.URL.RequestURI()))
		c.Redirect(http.StatusFound, loginUrl)
		return
	}

	// Get user info for consent page
	user, err := model.GetUserById(identity.UserID, true)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "error_description": "User not found"})
		return
	}
	if user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusForbidden, gin.H{"error": "access_denied", "error_description": "User account is disabled"})
		return
	}

	// Show consent page
	showProviderConsent(c, user, client, redirectUri, scope, state)
}

// OAuthProviderAuthorizePost handles POST /oauth/authorize — processes consent form submission
func OAuthProviderAuthorizePost(c *gin.Context) {
	clientId := c.Query("client_id")
	redirectUri := c.Query("redirect_uri")
	scope := c.DefaultQuery("scope", "openid profile email")
	state := c.Query("state")

	if clientId == "" || redirectUri == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request"})
		return
	}
	client, err := model.GetOAuthClientByClientId(clientId)
	if err != nil || !client.Enabled || client.RedirectUri != redirectUri {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_client"})
		return
	}

	identity, ok := middleware.GetSessionAuthIdentity(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized", "error_description": "User not authenticated"})
		return
	}

	// Parse form body
	body, _ := io.ReadAll(io.LimitReader(c.Request.Body, 64*1024))
	form, _ := url.ParseQuery(string(body))
	authorized := form.Get("authorized") == "true"

	if !authorized {
		redirectTo, _ := url.Parse(redirectUri)
		redirectTo.Query().Set("error", "access_denied")
		redirectTo.Query().Set("error_description", "User denied the authorization request")
		if state != "" {
			redirectTo.Query().Set("state", state)
		}
		c.Redirect(http.StatusFound, redirectTo.String())
		return
	}

	// Generate authorization code
	code := generateAuthCode()
	storeProviderAuthCode(code, clientId, identity.UserID, scope, redirectUri, 10*time.Minute)

	// Redirect with code
	redirectTo, _ := url.Parse(redirectUri)
	redirectTo.Query().Set("code", code)
	if state != "" {
		redirectTo.Query().Set("state", state)
	}
	c.Redirect(http.StatusFound, redirectTo.String())
}

// OAuthProviderToken handles POST /oauth/token — exchanges code for access token
func OAuthProviderToken(c *gin.Context) {
	contentType := c.Request.Header.Get("Content-Type")

	var clientId, clientSecret, code, redirectUri string
	var grantType string

	if strings.Contains(contentType, "application/x-www-form-urlencoded") {
		body, _ := io.ReadAll(io.LimitReader(c.Request.Body, 64*1024))
		form, _ := url.ParseQuery(string(body))
		grantType = form.Get("grant_type")
		code = form.Get("code")
		clientId = form.Get("client_id")
		clientSecret = form.Get("client_secret")
		redirectUri = form.Get("redirect_uri")
	} else {
		var body struct {
			GrantType    string `json:"grant_type"`
			Code         string `json:"code"`
			ClientId     string `json:"client_id"`
			ClientSecret string `json:"client_secret"`
			RedirectUri  string `json:"redirect_uri"`
		}
		if err := common.DecodeJson(c.Request.Body, &body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "Unable to parse request body"})
			return
		}
		grantType = body.GrantType
		code = body.Code
		clientId = body.ClientId
		clientSecret = body.ClientSecret
		redirectUri = body.RedirectUri
	}

	if grantType != "authorization_code" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_grant_type", "error_description": "Only 'authorization_code' is supported"})
		return
	}
	if code == "" || clientId == "" || clientSecret == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "Missing required parameters"})
		return
	}

	// Validate client credentials
	client, err := model.GetOAuthClientByClientId(clientId)
	if err != nil || !client.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_client", "error_description": "Unknown client_id"})
		return
	}
	if client.ClientSecret != clientSecret {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_client", "error_description": "Invalid client_secret"})
		return
	}

	// Consume and validate code
	entry := consumeProviderAuthCode(code)
	if entry == nil || entry.clientId != clientId || entry.redirectUri != redirectUri {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_grant", "error_description": "Invalid or expired authorization code"})
		return
	}

	// Generate access token
	token := "pat_" + generateSecureToken(36)
	expiresIn := 3600
	storeProviderAccessToken(token, entry.userId, entry.scope, time.Now().Add(time.Duration(expiresIn)*time.Second))

	c.JSON(http.StatusOK, gin.H{
		"access_token": token,
		"token_type":  "Bearer",
		"expires_in":  expiresIn,
		"scope":       entry.scope,
	})
}

// OAuthProviderUserInfo handles GET /oauth/userinfo — returns user profile
func OAuthProviderUserInfo(c *gin.Context) {
	authHeader := c.Request.Header.Get("Authorization")
	if !strings.HasPrefix(authHeader, "Bearer ") {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token", "error_description": "Missing or invalid Authorization header"})
		return
	}
	token := strings.TrimPrefix(authHeader, "Bearer ")
	entry := getProviderAccessToken(token)
	if entry == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token", "error_description": "Invalid or expired access token"})
		return
	}

	// Get user info
	user, err := model.GetUserById(entry.userId, true)
	if err != nil || user.Status != common.UserStatusEnabled {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token", "error_description": "User not found or inactive"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"sub":                fmt.Sprintf("%d", user.Id),
		"name":               user.DisplayName,
		"preferred_username": user.Username,
		"email":              user.Email,
		"email_verified":     false,
		"is_admin":           user.Role == 1,
		"created_at":         time.Unix(user.CreatedAt, 0).Format(time.RFC3339),
	})
}

// OAuthProviderWellKnown handles GET /.well-known/openid-configuration — OIDC discovery
func OAuthProviderWellKnown(c *gin.Context) {
	common.SysLog("OAuthProviderWellKnown called!")
	baseURL := strings.TrimSuffix(system_setting.ServerAddress, "/")
	c.JSON(http.StatusOK, gin.H{
		"issuer":                               baseURL,
		"authorization_endpoint":                baseURL + "/oauth/authorize",
		"token_endpoint":                        baseURL + "/oauth/token",
		"userinfo_endpoint":                    baseURL + "/oauth/userinfo",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"none"},
		"scopes_supported":                     []string{"openid", "profile", "email"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_post", "client_secret_basic"},
		"claims_supported":                     []string{"sub", "name", "preferred_username", "email", "email_verified", "is_admin", "created_at"},
	})
}

// ─── Internal helpers ────────────────────────────────────────────────────────────

func generateAuthCode() string {
	b := make([]byte, 16)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

func generateSecureToken(n int) string {
	b := make([]byte, n)
	rand.Read(b)
	return base64.RawURLEncoding.EncodeToString(b)
}

type providerAuthCode struct {
	clientId    string
	userId      int
	scope       string
	redirectUri string
	expiresAt   time.Time
}

var providerAuthCodes = make(map[string]*providerAuthCode)

func storeProviderAuthCode(code, clientId string, userId int, scope, redirectUri string, ttl time.Duration) {
	providerAuthCodes[code] = &providerAuthCode{
		clientId:    clientId,
		userId:      userId,
		scope:       scope,
		redirectUri: redirectUri,
		expiresAt:   time.Now().Add(ttl),
	}
}

func consumeProviderAuthCode(code string) *providerAuthCode {
	entry := providerAuthCodes[code]
	if entry == nil {
		return nil
	}
	delete(providerAuthCodes, code)
	if time.Now().After(entry.expiresAt) {
		return nil
	}
	return entry
}

type providerAccessToken struct {
	userId    int
	scope     string
	expiresAt time.Time
}

var providerAccessTokens = make(map[string]*providerAccessToken)

func storeProviderAccessToken(token string, userId int, scope string, expiresAt time.Time) {
	providerAccessTokens[token] = &providerAccessToken{
		userId:    userId,
		scope:     scope,
		expiresAt: expiresAt,
	}
	if len(providerAccessTokens) > 10000 {
		now := time.Now()
		for k, v := range providerAccessTokens {
			if now.After(v.expiresAt) {
				delete(providerAccessTokens, k)
			}
		}
	}
}

func getProviderAccessToken(token string) *providerAccessToken {
	entry := providerAccessTokens[token]
	if entry == nil {
		return nil
	}
	if time.Now().After(entry.expiresAt) {
		delete(providerAccessTokens, token)
		return nil
	}
	return entry
}

func showProviderConsent(c *gin.Context, user *model.User, client *model.OAuthClient, redirectUri, scope, state string) {
	baseURL := strings.TrimSuffix(system_setting.ServerAddress, "/")
	action := baseURL + "/oauth/authorize?client_id=" + url.QueryEscape(client.ClientId) +
		"&redirect_uri=" + url.QueryEscape(redirectUri) +
		"&response_type=code&scope=" + url.QueryEscape(scope)
	if state != "" {
		action += "&state=" + url.QueryEscape(state)
	}

	stateInput := ""
	if state != "" {
		stateInput = `<input type="hidden" name="state" value="` + escapeHtml(state) + `">`
	}

	initial := user.DisplayName
	if initial == "" {
		initial = string(user.Username[0])
	}
	if initial != "" {
		initial = string(initial[0])
	}

	html := `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>授权访问 - ChimeraHub</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;min-height:100vh;display:flex;align-items:center;justify-content:center}
.card{background:#fff;border-radius:12px;padding:32px;max-width:440px;width:90%;box-shadow:0 2px 16px rgba(0,0,0,0.1)}
.logo{text-align:center;margin-bottom:24px;font-size:20px;font-weight:600;color:#333}
.client-info{background:#f8f9fa;border-radius:8px;padding:16px;margin-bottom:20px;font-size:14px}
.client-name{font-weight:600;color:#111;margin-bottom:4px}
.client-uri{font-size:12px;color:#666;word-break:break-all}
.warning{background:#fff7e6;border:1px solid #ffd591;border-radius:8px;padding:12px;margin-bottom:20px;font-size:13px;color:#8a6110}
h3{font-size:14px;color:#333;margin-bottom:12px;font-weight:500}
.scopes{list-style:none;margin-bottom:24px;font-size:14px}
.scopes li{padding:8px 0;border-bottom:1px solid #f0f0f0;display:flex;gap:10px}
.scopes li:last-child{border-bottom:none}
.badge{background:#e6f4ff;color:#1677ff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:500;min-width:60px;text-align:center}
.desc{color:#666}
.user-info{display:flex;align-items:center;gap:12px;padding:12px;background:#f0f9ff;border-radius:8px;margin-bottom:24px;font-size:14px}
.avatar{width:36px;height:36px;border-radius:50%;background:#1677ff;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:600;flex-shrink:0}
.actions{display:flex;gap:12px}
.btn{flex:1;padding:12px;border:none;border-radius:8px;font-size:15px;font-weight:500;cursor:pointer}
.btn-allow{background:#1677ff;color:#fff}
.btn-deny{background:#f5f5f5;color:#333}
</style>
</head>
<body>
<div class="card">
  <div class="logo">🔗 授权访问请求</div>
  <div class="client-info">
    <div class="client-name">` + escapeHtml(client.Name) + `</div>
    <div class="client-uri">` + escapeHtml(client.RedirectUri) + `</div>
  </div>
  <div class="warning">此应用将获得以下权限，请确保你信任该应用后再授权。</div>
  <h3>请求的权限</h3>
  <ul class="scopes">
    <li><span class="badge">openid</span><span class="desc">验证身份</span></li>
    <li><span class="badge">profile</span><span class="desc">获取用户名和昵称</span></li>
    <li><span class="badge">email</span><span class="desc">获取邮箱地址</span></li>
  </ul>
  <div class="user-info">
    <div class="avatar">` + escapeHtml(initial) + `</div>
    <div>
      <div style="font-weight:600">` + escapeHtml(user.DisplayName) + `</div>
      <div style="font-size:12px;color:#888">以 ` + escapeHtml(user.Username) + ` 身份授权</div>
    </div>
  </div>
  <form method="POST" action="` + escapeHtml(action) + `">
    <input type="hidden" name="authorized" id="auth-val" value="false">
    ` + stateInput + `
    <div class="actions">
      <button type="submit" class="btn btn-deny" onclick="document.getElementById('auth-val').value='false'">拒绝</button>
      <button type="submit" class="btn btn-allow" onclick="document.getElementById('auth-val').value='true'">授权</button>
    </div>
  </form>
</div>
</body>
</html>`
	c.Header("Content-Type", "text/html; charset=utf-8")
	c.String(http.StatusOK, html)
}

func escapeHtml(s string) string {
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "<", "&lt;")
	s = strings.ReplaceAll(s, ">", "&gt;")
	s = strings.ReplaceAll(s, `"`, "&quot;")
	s = strings.ReplaceAll(s, "'", "&#x27;")
	return s
}

// Make sure service.AuthIdentity is imported (used by middleware)
var _ = service.AuthIdentity{}
