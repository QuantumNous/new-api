package middleware

import (
	"crypto/rsa"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
	"one-api/setting/system_setting"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

// OAuthJWTAuth OAuth2 JWT认证中间件
func OAuthJWTAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 检查OAuth2是否启用
		settings := system_setting.GetOAuth2Settings()
		if !settings.Enabled {
			c.Next()
			return
		}

		// 获取Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.Next() // 没有Authorization header，继续到下一个中间件
			return
		}

		// 检查是否为Bearer token
		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.Next() // 不是Bearer token，继续到下一个中间件
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")
		if tokenString == "" {
			abortWithOAuthError(c, "invalid_token", "Missing token")
			return
		}

		// 验证JWT token
		claims, err := validateOAuthJWT(tokenString)
		if err != nil {
			abortWithOAuthError(c, "invalid_token", err.Error())
			return
		}

		// 验证token的有效性
		if err := validateOAuthClaims(claims); err != nil {
			abortWithOAuthError(c, "invalid_token", err.Error())
			return
		}

		// 设置上下文信息
		setOAuthContext(c, claims)
		c.Next()
	}
}

// validateOAuthJWT 验证OAuth2 JWT令牌
func validateOAuthJWT(tokenString string) (jwt.MapClaims, error) {
	// 解析JWT而不验证签名（先获取header中的kid）
	token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
		// 检查签名方法
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}

		// 获取kid
		kid, ok := token.Header["kid"].(string)
		if !ok {
			return nil, fmt.Errorf("missing kid in token header")
		}

		// 根据kid获取公钥
		publicKey, err := getPublicKeyByKid(kid)
		if err != nil {
			return nil, fmt.Errorf("failed to get public key: %w", err)
		}

		return publicKey, nil
	})

	if err != nil {
		return nil, fmt.Errorf("failed to parse token: %w", err)
	}

	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}

	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		return nil, fmt.Errorf("invalid token claims")
	}

	return claims, nil
}

// getPublicKeyByKid 根据kid获取公钥
func getPublicKeyByKid(kid string) (*rsa.PublicKey, error) {
	// 这里需要从JWKS获取公钥
	// 在实际实现中，你可能需要从OAuth server获取JWKS
	// 这里先实现一个简单版本

	// TODO: 实现JWKS缓存和刷新机制
	settings := system_setting.GetOAuth2Settings()
	if settings.JWTKeyID == kid {
		// 从OAuth server模块获取公钥
		// 这需要在OAuth server初始化后才能使用
		return nil, fmt.Errorf("JWKS functionality not yet implemented")
	}

	return nil, fmt.Errorf("unknown kid: %s", kid)
}

// validateOAuthClaims 验证OAuth2 claims
func validateOAuthClaims(claims jwt.MapClaims) error {
	settings := system_setting.GetOAuth2Settings()

	// 验证issuer
	if iss, ok := claims["iss"].(string); ok {
		if iss != settings.Issuer {
			return fmt.Errorf("invalid issuer")
		}
	} else {
		return fmt.Errorf("missing issuer claim")
	}

	// 验证audience
	// if aud, ok := claims["aud"].(string); ok {
	// 	// TODO: 验证audience
	// }

	// 验证客户端ID
	if clientID, ok := claims["client_id"].(string); ok {
		// 验证客户端是否存在且有效
		client, err := model.GetOAuthClientByID(clientID)
		if err != nil {
			return fmt.Errorf("invalid client")
		}
		if client.Status != common.UserStatusEnabled {
			return fmt.Errorf("client disabled")
		}
	} else {
		return fmt.Errorf("missing client_id claim")
	}

	return nil
}

// setOAuthContext 设置OAuth上下文信息
func setOAuthContext(c *gin.Context, claims jwt.MapClaims) {
	c.Set("oauth_claims", claims)
	c.Set("oauth_authenticated", true)

	// 提取基本信息
	if clientID, ok := claims["client_id"].(string); ok {
		c.Set("oauth_client_id", clientID)
	}

	if scope, ok := claims["scope"].(string); ok {
		c.Set("oauth_scope", scope)
	}

	if sub, ok := claims["sub"].(string); ok {
		c.Set("oauth_subject", sub)
	}

	// 对于client_credentials流程，subject就是client_id
	// 对于authorization_code流程，subject是用户ID
	if grantType, ok := claims["grant_type"].(string); ok {
		c.Set("oauth_grant_type", grantType)
	}
}

// abortWithOAuthError 返回OAuth错误响应
func abortWithOAuthError(c *gin.Context, errorCode, description string) {
	c.Header("WWW-Authenticate", fmt.Sprintf(`Bearer error="%s", error_description="%s"`, errorCode, description))
	c.JSON(http.StatusUnauthorized, gin.H{
		"error":             errorCode,
		"error_description": description,
	})
	c.Abort()
}

// RequireOAuthScope OAuth2 scope验证中间件
func RequireOAuthScope(requiredScope string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// 检查是否通过OAuth认证
		if !c.GetBool("oauth_authenticated") {
			abortWithOAuthError(c, "insufficient_scope", "OAuth2 authentication required")
			return
		}

		// 获取token的scope
		scope, exists := c.Get("oauth_scope")
		if !exists {
			abortWithOAuthError(c, "insufficient_scope", "No scope in token")
			return
		}

		scopeStr, ok := scope.(string)
		if !ok {
			abortWithOAuthError(c, "insufficient_scope", "Invalid scope format")
			return
		}

		// 检查是否包含所需的scope
		scopes := strings.Split(scopeStr, " ")
		for _, s := range scopes {
			if strings.TrimSpace(s) == requiredScope {
				c.Next()
				return
			}
		}

		abortWithOAuthError(c, "insufficient_scope", fmt.Sprintf("Required scope: %s", requiredScope))
	}
}

// OptionalOAuthAuth 可选的OAuth认证中间件（不会阻止请求）
func OptionalOAuthAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		// 尝试OAuth认证，但不会阻止请求
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			if claims, err := validateOAuthJWT(tokenString); err == nil {
				if validateOAuthClaims(claims) == nil {
					setOAuthContext(c, claims)
				}
			}
		}
		c.Next()
	}
}

// GetOAuthClaims 获取OAuth claims
func GetOAuthClaims(c *gin.Context) (jwt.MapClaims, bool) {
	claims, exists := c.Get("oauth_claims")
	if !exists {
		return nil, false
	}

	mapClaims, ok := claims.(jwt.MapClaims)
	return mapClaims, ok
}

// IsOAuthAuthenticated 检查是否通过OAuth认证
func IsOAuthAuthenticated(c *gin.Context) bool {
	return c.GetBool("oauth_authenticated")
}
