package oauth

import (
	"crypto/rand"
	"crypto/rsa"
	"fmt"
	"one-api/common"
	"one-api/setting/system_setting"

	"github.com/gin-gonic/gin"
	"github.com/lestrrat-go/jwx/v2/jwk"
)

var (
	simplePrivateKey *rsa.PrivateKey
	simpleJWKSSet    jwk.Set
)

// InitOAuthServer 简化版OAuth2服务器初始化
func InitOAuthServer() error {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		common.SysLog("OAuth2 server is disabled")
		return nil
	}

	// 生成RSA私钥（简化版本）
	var err error
	simplePrivateKey, err = rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("failed to generate RSA key: %w", err)
	}

	// 创建JWKS
	simpleJWKSSet, err = createSimpleJWKS(simplePrivateKey, settings.JWTKeyID)
	if err != nil {
		return fmt.Errorf("failed to create JWKS: %w", err)
	}

	common.SysLog("OAuth2 server initialized successfully (simple mode)")
	return nil
}

// createSimpleJWKS 创建简单的JWKS
func createSimpleJWKS(privateKey *rsa.PrivateKey, keyID string) (jwk.Set, error) {
	pubJWK, err := jwk.FromRaw(&privateKey.PublicKey)
	if err != nil {
		return nil, err
	}

	_ = pubJWK.Set(jwk.KeyIDKey, keyID)
	_ = pubJWK.Set(jwk.AlgorithmKey, "RS256")
	_ = pubJWK.Set(jwk.KeyUsageKey, "sig")

	jwks := jwk.NewSet()
	_ = jwks.AddKey(pubJWK)

	return jwks, nil
}

// GetJWKS 获取JWKS（简化版本）
func GetJWKS() jwk.Set {
	return simpleJWKSSet
}

// HandleTokenRequest 简化的令牌处理（临时实现）
func HandleTokenRequest(c *gin.Context) {
	c.JSON(501, map[string]string{
		"error":             "not_implemented",
		"error_description": "OAuth2 token endpoint not fully implemented yet",
	})
}

// HandleAuthorizeRequest 简化的授权处理（临时实现）
func HandleAuthorizeRequest(c *gin.Context) {
	c.JSON(501, map[string]string{
		"error":             "not_implemented",
		"error_description": "OAuth2 authorize endpoint not fully implemented yet",
	})
}
