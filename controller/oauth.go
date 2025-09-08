package controller

import (
	"encoding/json"
	"net/http"
	"one-api/setting/system_setting"
	"one-api/src/oauth"

	"github.com/gin-gonic/gin"
)

// GetJWKS 获取JWKS公钥集
func GetJWKS(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "OAuth2 server is disabled",
		})
		return
	}

	jwks := oauth.GetJWKS()
	if jwks == nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "JWKS not available",
		})
		return
	}

	// 设置CORS headers
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET")
	c.Header("Access-Control-Allow-Headers", "Content-Type")
	c.Header("Cache-Control", "public, max-age=3600") // 缓存1小时

	// 返回JWKS
	c.Header("Content-Type", "application/json")

	// 将JWKS转换为JSON字符串
	jsonData, err := json.Marshal(jwks)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Failed to marshal JWKS",
		})
		return
	}

	c.String(http.StatusOK, string(jsonData))
}

// OAuthTokenEndpoint OAuth2 令牌端点
func OAuthTokenEndpoint(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error":             "unsupported_grant_type",
			"error_description": "OAuth2 server is disabled",
		})
		return
	}

	// 只允许POST请求
	if c.Request.Method != "POST" {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error":             "invalid_request",
			"error_description": "Only POST method is allowed",
		})
		return
	}

	// 只允许application/x-www-form-urlencoded内容类型
	contentType := c.GetHeader("Content-Type")
	if contentType != "application/x-www-form-urlencoded" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "Content-Type must be application/x-www-form-urlencoded",
		})
		return
	}

	// 委托给OAuth2服务器处理
	oauth.HandleTokenRequest(c)
}

// OAuthAuthorizeEndpoint OAuth2 授权端点
func OAuthAuthorizeEndpoint(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error":             "server_error",
			"error_description": "OAuth2 server is disabled",
		})
		return
	}

	// 委托给OAuth2服务器处理
	oauth.HandleAuthorizeRequest(c)
}

// OAuthServerInfo 获取OAuth2服务器信息
func OAuthServerInfo(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "OAuth2 server is disabled",
		})
		return
	}

	// 返回OAuth2服务器的基本信息（类似OpenID Connect Discovery）
	c.JSON(http.StatusOK, gin.H{
		"issuer":                                settings.Issuer,
		"authorization_endpoint":                settings.Issuer + "/oauth/authorize",
		"token_endpoint":                        settings.Issuer + "/oauth/token",
		"jwks_uri":                              settings.Issuer + "/.well-known/jwks.json",
		"grant_types_supported":                 settings.AllowedGrantTypes,
		"response_types_supported":              []string{"code"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
		"code_challenge_methods_supported":      []string{"S256"},
		"scopes_supported": []string{
			"api:read",
			"api:write",
			"admin",
		},
	})
}

// OAuthIntrospect 令牌内省端点（RFC 7662）
func OAuthIntrospect(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "OAuth2 server is disabled",
		})
		return
	}

	// 只允许POST请求
	if c.Request.Method != "POST" {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error":             "invalid_request",
			"error_description": "Only POST method is allowed",
		})
		return
	}

	token := c.PostForm("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"active": false,
		})
		return
	}

	// TODO: 实现令牌内省逻辑
	// 1. 验证调用者的认证信息
	// 2. 解析和验证JWT令牌
	// 3. 返回令牌的元信息

	c.JSON(http.StatusOK, gin.H{
		"active": false, // 临时返回，需要实现实际的内省逻辑
	})
}

// OAuthRevoke 令牌撤销端点（RFC 7009）
func OAuthRevoke(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "OAuth2 server is disabled",
		})
		return
	}

	// 只允许POST请求
	if c.Request.Method != "POST" {
		c.JSON(http.StatusMethodNotAllowed, gin.H{
			"error":             "invalid_request",
			"error_description": "Only POST method is allowed",
		})
		return
	}

	token := c.PostForm("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "Missing token parameter",
		})
		return
	}

	// TODO: 实现令牌撤销逻辑
	// 1. 验证调用者的认证信息
	// 2. 撤销指定的令牌（加入黑名单或从存储中删除）

	c.JSON(http.StatusOK, gin.H{
		"success": true,
	})
}
