package controller

import (
	"encoding/json"
	"net/http"
	"one-api/model"
	"one-api/setting/system_setting"
	"one-api/src/oauth"
	"time"

	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v5"
	"one-api/middleware"
	"strconv"
	"strings"
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

	// lazy init if needed
	_ = oauth.EnsureInitialized()

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
	if contentType == "" || !strings.Contains(strings.ToLower(contentType), "application/x-www-form-urlencoded") {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "Content-Type must be application/x-www-form-urlencoded",
		})
		return
	}

	// lazy init
	if err := oauth.EnsureInitialized(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "error_description": err.Error()})
		return
	}
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

	if err := oauth.EnsureInitialized(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error", "error_description": err.Error()})
		return
	}
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
	issuer := settings.Issuer
	if issuer == "" {
		scheme := "https"
		if c.Request.TLS == nil {
			if hdr := c.Request.Header.Get("X-Forwarded-Proto"); hdr != "" {
				scheme = hdr
			} else {
				scheme = "http"
			}
		}
		issuer = scheme + "://" + c.Request.Host
	}

	base := issuer + "/api"
	c.JSON(http.StatusOK, gin.H{
		"issuer":                                issuer,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"jwks_uri":                              base + "/.well-known/jwks.json",
		"grant_types_supported":                 settings.AllowedGrantTypes,
		"response_types_supported":              []string{"code", "token"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
		"code_challenge_methods_supported":      []string{"S256"},
		"scopes_supported":                      []string{"openid", "profile", "email", "api:read", "api:write", "admin"},
		"default_private_key_path":              settings.DefaultPrivateKeyPath,
	})
}

// OAuthOIDCConfiguration OIDC discovery document
func OAuthOIDCConfiguration(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 server is disabled"})
		return
	}
	issuer := settings.Issuer
	if issuer == "" {
		scheme := "https"
		if c.Request.TLS == nil {
			if hdr := c.Request.Header.Get("X-Forwarded-Proto"); hdr != "" {
				scheme = hdr
			} else {
				scheme = "http"
			}
		}
		issuer = scheme + "://" + c.Request.Host
	}
	base := issuer + "/api"
	c.JSON(http.StatusOK, gin.H{
		"issuer":                                issuer,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"userinfo_endpoint":                     base + "/oauth/userinfo",
		"jwks_uri":                              base + "/.well-known/jwks.json",
		"response_types_supported":              []string{"code", "token"},
		"grant_types_supported":                 settings.AllowedGrantTypes,
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"RS256"},
		"scopes_supported":                      []string{"openid", "profile", "email", "api:read", "api:write", "admin"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_basic", "client_secret_post"},
		"code_challenge_methods_supported":      []string{"S256"},
		"default_private_key_path":              settings.DefaultPrivateKeyPath,
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

	tokenString := token

	// 验证并解析JWT
	parsed, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		pub := oauth.GetPublicKeyByKid(func() string {
			if v, ok := token.Header["kid"].(string); ok {
				return v
			}
			return ""
		}())
		if pub == nil {
			return nil, jwt.ErrTokenUnverifiable
		}
		return pub, nil
	})
	if err != nil || !parsed.Valid {
		c.JSON(http.StatusOK, gin.H{"active": false})
		return
	}

	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		c.JSON(http.StatusOK, gin.H{"active": false})
		return
	}

	// 检查撤销
	if jti, ok := claims["jti"].(string); ok && jti != "" {
		if revoked, _ := model.IsTokenRevoked(jti); revoked {
			c.JSON(http.StatusOK, gin.H{"active": false})
			return
		}
	}

	// 有效
	resp := gin.H{"active": true}
	for k, v := range claims {
		resp[k] = v
	}
	resp["token_type"] = "Bearer"
	c.JSON(http.StatusOK, resp)
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

	token = c.PostForm("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":             "invalid_request",
			"error_description": "Missing token parameter",
		})
		return
	}

	// 尝试解析JWT，若成功则记录jti到撤销表
	parsed, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, jwt.ErrTokenSignatureInvalid
		}
		pub := oauth.GetRSAPublicKey()
		if pub == nil {
			return nil, jwt.ErrTokenUnverifiable
		}
		return pub, nil
	})
	if err == nil && parsed != nil && parsed.Valid {
		if claims, ok := parsed.Claims.(jwt.MapClaims); ok {
			var jti string
			var exp int64
			if v, ok := claims["jti"].(string); ok {
				jti = v
			}
			if v, ok := claims["exp"].(float64); ok {
				exp = int64(v)
			} else if v, ok := claims["exp"].(int64); ok {
				exp = v
			}
			if jti != "" {
				// 如果没有exp，默认撤销至当前+TTL 10分钟
				if exp == 0 {
					exp = time.Now().Add(10 * time.Minute).Unix()
				}
				_ = model.RevokeToken(jti, exp)
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// OAuthUserInfo returns OIDC userinfo based on access token
func OAuthUserInfo(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		c.JSON(http.StatusNotFound, gin.H{"error": "OAuth2 server is disabled"})
		return
	}
	// 需要 OAuthJWTAuth 中间件注入 claims
	claims, ok := middleware.GetOAuthClaims(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid_token"})
		return
	}
	// scope 校验：必须包含 openid
	scope, _ := claims["scope"].(string)
	if !strings.Contains(" "+scope+" ", " openid ") {
		c.JSON(http.StatusForbidden, gin.H{"error": "insufficient_scope"})
		return
	}
	sub, _ := claims["sub"].(string)
	resp := gin.H{"sub": sub}
	// 若包含 profile/email scope，补充返回
	if strings.Contains(" "+scope+" ", " profile ") || strings.Contains(" "+scope+" ", " email ") {
		if uid, err := strconv.Atoi(sub); err == nil {
			if user, err2 := model.GetUserById(uid, false); err2 == nil && user != nil {
				if strings.Contains(" "+scope+" ", " profile ") {
					resp["name"] = user.DisplayName
					resp["preferred_username"] = user.Username
				}
				if strings.Contains(" "+scope+" ", " email ") {
					resp["email"] = user.Email
					resp["email_verified"] = true
				}
			}
		}
	}
	c.JSON(http.StatusOK, resp)
}
