package oauth

import (
	"crypto/rand"
	"crypto/rsa"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"one-api/common"
	"one-api/logger"
	"one-api/model"
	"one-api/setting/system_setting"

	"crypto/x509"
	"encoding/pem"
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	jwt "github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
	"os"
	"strconv"
)

var (
	signingKeys   = map[string]*rsa.PrivateKey{}
	currentKeyID  string
	simpleJWKSSet jwk.Set
	keyMeta       = map[string]int64{} // kid -> created_at (unix)
)

// InitOAuthServer 简化版OAuth2服务器初始化
func InitOAuthServer() error {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		common.SysLog("OAuth2 server is disabled")
		return nil
	}

	// 生成RSA私钥，并设置当前 kid
	var err error
	if settings.JWTKeyID == "" {
		settings.JWTKeyID = "oauth2-key-1"
	}
	currentKeyID = settings.JWTKeyID
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return fmt.Errorf("failed to generate RSA key: %w", err)
	}
	signingKeys[currentKeyID] = key
	keyMeta[currentKeyID] = time.Now().Unix()

	// 创建JWKS，加入当前公钥
	simpleJWKSSet, err = createSimpleJWKS(key, currentKeyID)
	if err != nil {
		return fmt.Errorf("failed to create JWKS: %w", err)
	}

	common.SysLog("OAuth2 server initialized successfully (simple mode)")
	return nil
}

// EnsureInitialized lazily initializes signing keys and JWKS if OAuth2 is enabled but not yet ready
func EnsureInitialized() error {
	settings := system_setting.GetOAuth2Settings()
	if !settings.Enabled {
		return nil
	}
	if len(signingKeys) > 0 && simpleJWKSSet != nil && currentKeyID != "" {
		return nil
	}
	// generate one key and JWKS on demand
	if settings.JWTKeyID == "" {
		settings.JWTKeyID = fmt.Sprintf("oauth2-key-%d", time.Now().Unix())
	}
	currentKeyID = settings.JWTKeyID
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return err
	}
	signingKeys[currentKeyID] = key
	keyMeta[currentKeyID] = time.Now().Unix()
	jwks, err := createSimpleJWKS(key, currentKeyID)
	if err != nil {
		return err
	}
	simpleJWKSSet = jwks
	common.SysLog("OAuth2 lazy-initialized: signing key and JWKS ready")
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

// GetRSAPublicKey 返回当前用于签发的RSA公钥
func GetRSAPublicKey() *rsa.PublicKey {
	if k, ok := signingKeys[currentKeyID]; ok && k != nil {
		return &k.PublicKey
	}
	return nil
}

// GetPublicKeyByKid returns public key by kid if exists
func GetPublicKeyByKid(kid string) *rsa.PublicKey {
	if k, ok := signingKeys[kid]; ok && k != nil {
		return &k.PublicKey
	}
	return nil
}

// RotateSigningKey generates a new RSA key, updates current kid, and adds to JWKS
func RotateSigningKey(newKid string) (string, error) {
	if newKid == "" {
		newKid = fmt.Sprintf("oauth2-key-%d", time.Now().Unix())
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", err
	}
	signingKeys[newKid] = key
	keyMeta[newKid] = time.Now().Unix()
    // add to jwks set (handle first-time init when JWKS is nil)
    pubJWK, err := jwk.FromRaw(&key.PublicKey)
    if err == nil {
        _ = pubJWK.Set(jwk.KeyIDKey, newKid)
        _ = pubJWK.Set(jwk.AlgorithmKey, "RS256")
        _ = pubJWK.Set(jwk.KeyUsageKey, "sig")
        if simpleJWKSSet == nil {
            jwks := jwk.NewSet()
            _ = jwks.AddKey(pubJWK)
            simpleJWKSSet = jwks
        } else {
            _ = simpleJWKSSet.AddKey(pubJWK)
        }
    }
	currentKeyID = newKid
	enforceKeyRetention()
	return newKid, nil
}

// GenerateAndPersistKey generates a new RSA key, writes to a server file, and rotates current kid
func GenerateAndPersistKey(path string, kid string, overwrite bool) (string, error) {
	if kid == "" {
		kid = fmt.Sprintf("oauth2-key-%d", time.Now().Unix())
	}
	if _, err := os.Stat(path); err == nil && !overwrite {
		return "", fmt.Errorf("file exists")
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return "", err
	}
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", err
	}
	// write PKCS1 PEM with 0600 perms
	der := x509.MarshalPKCS1PrivateKey(key)
	blk := &pem.Block{Type: "RSA PRIVATE KEY", Bytes: der}
	pemBytes := pem.EncodeToMemory(blk)
	if err := os.WriteFile(path, pemBytes, 0600); err != nil {
		return "", err
	}
	// rotate in memory
	signingKeys[kid] = key
	keyMeta[kid] = time.Now().Unix()
    // add to jwks (handle first-time init when JWKS is nil)
    pubJWK, err := jwk.FromRaw(&key.PublicKey)
    if err == nil {
        _ = pubJWK.Set(jwk.KeyIDKey, kid)
        _ = pubJWK.Set(jwk.AlgorithmKey, "RS256")
        _ = pubJWK.Set(jwk.KeyUsageKey, "sig")
        if simpleJWKSSet == nil {
            jwks := jwk.NewSet()
            _ = jwks.AddKey(pubJWK)
            simpleJWKSSet = jwks
        } else {
            _ = simpleJWKSSet.AddKey(pubJWK)
        }
    }
	currentKeyID = kid
	enforceKeyRetention()
	return kid, nil
}

// ListSigningKeys returns metadata of keys
type KeyInfo struct {
	Kid       string `json:"kid"`
	CreatedAt int64  `json:"created_at"`
	Current   bool   `json:"current"`
}

func ListSigningKeys() []KeyInfo {
	out := make([]KeyInfo, 0, len(signingKeys))
	for kid := range signingKeys {
		out = append(out, KeyInfo{Kid: kid, CreatedAt: keyMeta[kid], Current: kid == currentKeyID})
	}
	// sort by CreatedAt asc
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt < out[j].CreatedAt })
	return out
}

// DeleteSigningKey removes a non-current key
func DeleteSigningKey(kid string) error {
	if kid == "" {
		return fmt.Errorf("kid required")
	}
	if kid == currentKeyID {
		return fmt.Errorf("cannot delete current signing key")
	}
	if _, ok := signingKeys[kid]; !ok {
		return fmt.Errorf("unknown kid")
	}
	delete(signingKeys, kid)
	delete(keyMeta, kid)
	rebuildJWKS()
	return nil
}

func rebuildJWKS() {
	jwks := jwk.NewSet()
	for kid, k := range signingKeys {
		pub, err := jwk.FromRaw(&k.PublicKey)
		if err == nil {
			_ = pub.Set(jwk.KeyIDKey, kid)
			_ = pub.Set(jwk.AlgorithmKey, "RS256")
			_ = pub.Set(jwk.KeyUsageKey, "sig")
			_ = jwks.AddKey(pub)
		}
	}
	simpleJWKSSet = jwks
}

func enforceKeyRetention() {
	max := system_setting.GetOAuth2Settings().MaxJWKSKeys
	if max <= 0 {
		max = 1
	}
	// retain max most recent keys
	infos := ListSigningKeys()
	if len(infos) <= max {
		return
	}
	// delete oldest first, skipping current
	toDelete := len(infos) - max
	for _, ki := range infos {
		if toDelete == 0 {
			break
		}
		if ki.Kid == currentKeyID {
			continue
		}
		_ = DeleteSigningKey(ki.Kid)
		toDelete--
	}
}

// ImportPEMKey imports an RSA private key from PEM text and rotates current kid
func ImportPEMKey(pemText string, kid string) (string, error) {
	if kid == "" {
		kid = fmt.Sprintf("oauth2-key-%d", time.Now().Unix())
	}
	// decode PEM
	var block *pem.Block
	var rest = []byte(pemText)
	for {
		block, rest = pem.Decode(rest)
		if block == nil {
			break
		}
		if block.Type == "RSA PRIVATE KEY" || strings.Contains(block.Type, "PRIVATE KEY") {
			var key *rsa.PrivateKey
			var err error
			if block.Type == "RSA PRIVATE KEY" {
				key, err = x509.ParsePKCS1PrivateKey(block.Bytes)
			} else {
				// try PKCS#8
				priv, err2 := x509.ParsePKCS8PrivateKey(block.Bytes)
				if err2 != nil {
					return "", err2
				}
				var ok bool
				key, ok = priv.(*rsa.PrivateKey)
				if !ok {
					return "", fmt.Errorf("not an RSA private key")
				}
			}
			if err != nil {
				return "", err
			}
			signingKeys[kid] = key
			keyMeta[kid] = time.Now().Unix()
            pubJWK, err := jwk.FromRaw(&key.PublicKey)
            if err == nil {
                _ = pubJWK.Set(jwk.KeyIDKey, kid)
                _ = pubJWK.Set(jwk.AlgorithmKey, "RS256")
                _ = pubJWK.Set(jwk.KeyUsageKey, "sig")
                if simpleJWKSSet == nil {
                    jwks := jwk.NewSet()
                    _ = jwks.AddKey(pubJWK)
                    simpleJWKSSet = jwks
                } else {
                    _ = simpleJWKSSet.AddKey(pubJWK)
                }
            }
			currentKeyID = kid
			enforceKeyRetention()
			return kid, nil
		}
		if len(rest) == 0 {
			break
		}
	}
	return "", fmt.Errorf("no private key found in PEM")
}

// HandleTokenRequest 实现最小可用的令牌签发（client_credentials）
func HandleTokenRequest(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()

	grantType := strings.TrimSpace(c.PostForm("grant_type"))
	if grantType == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "missing grant_type")
		return
	}
	if !settings.ValidateGrantType(grantType) {
		writeOAuthError(c, http.StatusBadRequest, "unsupported_grant_type", "grant_type not allowed")
		return
	}

	switch grantType {
	case "client_credentials":
		handleClientCredentials(c, settings)
	case "refresh_token":
		handleRefreshToken(c, settings)
	case "authorization_code":
		handleAuthorizationCodeExchange(c, settings)
	default:
		writeOAuthError(c, http.StatusBadRequest, "unsupported_grant_type", "unsupported grant_type")
	}
}

func handleClientCredentials(c *gin.Context, settings *system_setting.OAuth2Settings) {
	clientID, clientSecret := getFormOrBasicAuth(c)
	if clientID == "" || clientSecret == "" {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "missing client credentials")
		return
	}

	client, err := model.GetOAuthClientByID(clientID)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "unknown client")
		return
	}
	if client.Secret != clientSecret {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "invalid client secret")
		return
	}
	// client type can be confidential or public; client_credentials only for confidential
	if client.ClientType == "public" {
		writeOAuthError(c, http.StatusBadRequest, "unauthorized_client", "public client cannot use client_credentials")
		return
	}
	if !client.ValidateGrantType("client_credentials") {
		writeOAuthError(c, http.StatusBadRequest, "unauthorized_client", "grant_type not enabled for client")
		return
	}

	scope := strings.TrimSpace(c.PostForm("scope"))
	if scope == "" {
		// default to client's first scope or api:read
		allowed := client.GetScopes()
		if len(allowed) == 0 {
			scope = "api:read"
		} else {
			scope = strings.Join(allowed, " ")
		}
	}
	if !client.ValidateScope(scope) {
		writeOAuthError(c, http.StatusBadRequest, "invalid_scope", "requested scope not allowed")
		return
	}

	// issue JWT access token
	accessTTL := time.Duration(settings.AccessTokenTTL) * time.Minute
	tokenStr, exp, jti, err := signAccessToken(settings, clientID, "", scope, "client_credentials", accessTTL, c)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to issue token")
		return
	}

	// update client usage
	_ = client.UpdateLastUsedTime()

	c.JSON(http.StatusOK, gin.H{
		"access_token": tokenStr,
		"token_type":   "Bearer",
		"expires_in":   int64(exp.Sub(time.Now()).Seconds()),
		"scope":        scope,
		"jti":          jti,
	})
}

// handleAuthorizationCodeExchange 处理授权码换取令牌
func handleAuthorizationCodeExchange(c *gin.Context, settings *system_setting.OAuth2Settings) {
	// Redis not required; fallback to in-memory store
	clientID, clientSecret := getFormOrBasicAuth(c)
	code := strings.TrimSpace(c.PostForm("code"))
	redirectURI := strings.TrimSpace(c.PostForm("redirect_uri"))
	codeVerifier := strings.TrimSpace(c.PostForm("code_verifier"))

	if clientID == "" {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "missing client_id")
		return
	}
	client, err := model.GetOAuthClientByID(clientID)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "unknown client")
		return
	}
	if client.ClientType == "confidential" {
		if clientSecret == "" || client.Secret != clientSecret {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "invalid client secret")
			return
		}
	}
	if !client.ValidateGrantType("authorization_code") {
		writeOAuthError(c, http.StatusBadRequest, "unauthorized_client", "authorization_code not enabled for client")
		return
	}
	if redirectURI == "" || !client.ValidateRedirectURI(redirectURI) {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "redirect_uri mismatch or missing")
		return
	}
	if code == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "missing code")
		return
	}

	// 从Redis获取授权码数据
	key := fmt.Sprintf("oauth:code:%s", code)
	raw, ok := storeGet(key)
	if !ok || raw == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "invalid or expired code")
		return
	}

	// 解析：clientID|redirectURI|scope|userID|codeChallenge|codeChallengeMethod|exp[|nonce]
	parts := strings.Split(raw, "|")
	if len(parts) < 7 {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "malformed code payload")
		return
	}
	payloadClientID := parts[0]
	payloadRedirectURI := parts[1]
	payloadScope := parts[2]
	payloadUserIDStr := parts[3]
	payloadCodeChallenge := parts[4]
	payloadCodeChallengeMethod := parts[5]
	// parts[6] = exp (unused here)
	var payloadNonce string
	if len(parts) >= 8 {
		payloadNonce = parts[7]
	}
	// 单次使用：删除授权码
	_ = storeDel(key)

	if payloadClientID != clientID {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}
	if payloadRedirectURI != redirectURI {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "redirect_uri mismatch")
		return
	}
	// PKCE 校验
	requirePKCE := settings.RequirePKCE || client.RequirePKCE
	if requirePKCE || payloadCodeChallenge != "" {
		if codeVerifier == "" {
			writeOAuthError(c, http.StatusBadRequest, "invalid_request", "missing code_verifier")
			return
		}
		method := strings.ToUpper(payloadCodeChallengeMethod)
		if method == "" {
			method = "S256"
		}
		switch method {
		case "S256":
			if s256Base64URL(codeVerifier) != payloadCodeChallenge {
				writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "code_verifier mismatch")
				return
			}
		default:
			writeOAuthError(c, http.StatusBadRequest, "invalid_request", "unsupported code_challenge_method")
			return
		}
	}

	// 颁发令牌
	scope := payloadScope
	userIDStr := payloadUserIDStr
	accessTTL := time.Duration(settings.AccessTokenTTL) * time.Minute
	tokenStr, exp, jti, err := signAccessToken(settings, clientID, userIDStr, scope, "authorization_code", accessTTL, c)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to issue token")
		return
	}

	// 可选：签发刷新令牌（仅当允许）
	resp := gin.H{
		"access_token": tokenStr,
		"token_type":   "Bearer",
		"expires_in":   int64(exp.Sub(time.Now()).Seconds()),
		"scope":        scope,
		"jti":          jti,
	}
	// OIDC: 当 scope 包含 openid 时，签发 id_token
	if strings.Contains(" "+scope+" ", " openid ") {
		idt, err := signIDToken(settings, clientID, payloadUserIDStr, payloadNonce, c)
		if err == nil {
			resp["id_token"] = idt
		}
	}
	if settings.ValidateGrantType("refresh_token") && client.ValidateGrantType("refresh_token") {
		rt, err := genCode(32)
		if err == nil {
			ttl := time.Duration(settings.RefreshTokenTTL) * time.Minute
			rtKey := fmt.Sprintf("oauth:rt:%s", rt)
			// 存储 clientID|userID|scope|nonce（便于刷新时维持 openid/nonce）
			val := fmt.Sprintf("%s|%s|%s|%s", clientID, userIDStr, scope, payloadNonce)
			_ = storeSet(rtKey, val, ttl)
			resp["refresh_token"] = rt
		}
	}

	_ = client.UpdateLastUsedTime()
	writeNoStore(c)
	c.JSON(http.StatusOK, resp)
}

// handleRefreshToken 刷新令牌
func handleRefreshToken(c *gin.Context, settings *system_setting.OAuth2Settings) {
	// Redis not required; fallback to in-memory store
	clientID, clientSecret := getFormOrBasicAuth(c)
	refreshToken := strings.TrimSpace(c.PostForm("refresh_token"))
	if clientID == "" {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "missing client_id")
		return
	}
	client, err := model.GetOAuthClientByID(clientID)
	if err != nil {
		writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "unknown client")
		return
	}
	if client.ClientType == "confidential" {
		if clientSecret == "" || client.Secret != clientSecret {
			writeOAuthError(c, http.StatusUnauthorized, "invalid_client", "invalid client secret")
			return
		}
	}
	if !client.ValidateGrantType("refresh_token") {
		writeOAuthError(c, http.StatusBadRequest, "unauthorized_client", "refresh_token not enabled for client")
		return
	}
	if refreshToken == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_request", "missing refresh_token")
		return
	}
	key := fmt.Sprintf("oauth:rt:%s", refreshToken)
	raw, ok := storeGet(key)
	if !ok || raw == "" {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "invalid refresh_token")
		return
	}
	// 解析值：clientID|userID|scope|nonce
	parts := strings.Split(raw, "|")
	if len(parts) < 3 {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "malformed refresh token")
		return
	}
	storedClientID := parts[0]
	userIDStr := parts[1]
	scope := parts[2]
	var nonce string
	if len(parts) >= 4 {
		nonce = parts[3]
	}
	if storedClientID != clientID {
		writeOAuthError(c, http.StatusBadRequest, "invalid_grant", "client_id mismatch")
		return
	}

	// 旋转refresh_token：删除旧的，签发新的
	_ = storeDel(key)
	newRT, err := genCode(32)
	if err == nil {
		ttl := time.Duration(settings.RefreshTokenTTL) * time.Minute
		newKey := fmt.Sprintf("oauth:rt:%s", newRT)
		_ = storeSet(newKey, raw, ttl)
	}

	// 颁发新的访问令牌
	accessTTL := time.Duration(settings.AccessTokenTTL) * time.Minute
	tokenStr, exp, jti, err := signAccessToken(settings, clientID, userIDStr, scope, "refresh_token", accessTTL, c)
	if err != nil {
		writeOAuthError(c, http.StatusInternalServerError, "server_error", "failed to issue token")
		return
	}
	resp := gin.H{
		"access_token": tokenStr,
		"token_type":   "Bearer",
		"expires_in":   int64(exp.Sub(time.Now()).Seconds()),
		"scope":        scope,
		"jti":          jti,
	}
	if strings.Contains(" "+scope+" ", " openid ") {
		if idt, err := signIDToken(settings, clientID, userIDStr, nonce, c); err == nil {
			resp["id_token"] = idt
		}
	}
	if newRT != "" {
		resp["refresh_token"] = newRT
	}
	writeNoStore(c)
	c.JSON(http.StatusOK, resp)
}

// signAccessToken 使用内置RSA私钥签发JWT访问令牌
func signAccessToken(settings *system_setting.OAuth2Settings, clientID string, subject string, scope string, grantType string, ttl time.Duration, c *gin.Context) (string, time.Time, string, error) {
	now := time.Now()
	exp := now.Add(ttl)
	jti := common.GetUUID()
	iss := settings.Issuer
	if iss == "" {
		// derive from requestd
		scheme := "https"
		if c != nil && c.Request != nil {
			if c.Request.TLS == nil {
				if hdr := c.Request.Header.Get("X-Forwarded-Proto"); hdr != "" {
					scheme = hdr
				} else {
					scheme = "http"
				}
			}
			host := c.Request.Host
			if host != "" {
				iss = fmt.Sprintf("%s://%s", scheme, host)
			}
		}
	}

	claims := jwt.MapClaims{
		"iss": iss,
		"sub": func() string {
			if subject != "" {
				return subject
			}
			return clientID
		}(),
		"aud":        "one-api",
		"iat":        now.Unix(),
		"nbf":        now.Unix(),
		"exp":        exp.Unix(),
		"scope":      scope,
		"client_id":  clientID,
		"grant_type": grantType,
		"jti":        jti,
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	// set kid
	kid := currentKeyID
	if kid != "" {
		token.Header["kid"] = kid
	}
	k := signingKeys[kid]
	if k == nil {
		return "", time.Time{}, "", errors.New("signing key missing")
	}
	signed, err := token.SignedString(k)
	if err != nil {
		return "", time.Time{}, "", err
	}
	return signed, exp, jti, nil
}

// signIDToken 生成 OIDC id_token
func signIDToken(settings *system_setting.OAuth2Settings, clientID string, subject string, nonce string, c *gin.Context) (string, error) {
	k := signingKeys[currentKeyID]
	if k == nil {
		return "", errors.New("oauth private key not initialized")
	}
	// derive issuer similar to access token
	iss := settings.Issuer
	if iss == "" && c != nil && c.Request != nil {
		scheme := "https"
		if c.Request.TLS == nil {
			if hdr := c.Request.Header.Get("X-Forwarded-Proto"); hdr != "" {
				scheme = hdr
			} else {
				scheme = "http"
			}
		}
		host := c.Request.Host
		if host != "" {
			iss = fmt.Sprintf("%s://%s", scheme, host)
		}
	}
	now := time.Now()
	exp := now.Add(10 * time.Minute) // id_token 短时有效

	claims := jwt.MapClaims{
		"iss": iss,
		"sub": subject,
		"aud": clientID,
		"iat": now.Unix(),
		"exp": exp.Unix(),
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}

	// 可选：附加 profile / email claims 由上层根据 scope 决定
	if uid, err := strconv.Atoi(subject); err == nil {
		if user, err2 := model.GetUserById(uid, false); err2 == nil && user != nil {
			if user.Username != "" {
				claims["preferred_username"] = user.Username
				claims["name"] = user.DisplayName
			}
			if user.Email != "" {
				claims["email"] = user.Email
				claims["email_verified"] = true
			}
		}
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	if currentKeyID != "" {
		token.Header["kid"] = currentKeyID
	}
	return token.SignedString(k)
}

// HandleAuthorizeRequest 简化的授权处理（临时实现）
func HandleAuthorizeRequest(c *gin.Context) {
	settings := system_setting.GetOAuth2Settings()
	// Redis not required; fallback to in-memory store

	// 解析参数
	responseType := c.Query("response_type")
	clientID := c.Query("client_id")
	redirectURI := c.Query("redirect_uri")
	scope := strings.TrimSpace(c.Query("scope"))
	state := c.Query("state")
	codeChallenge := c.Query("code_challenge")
	codeChallengeMethod := strings.ToUpper(c.Query("code_challenge_method"))
	nonce := c.Query("nonce")

	if responseType == "" {
		responseType = "code"
	}
	if responseType != "code" && responseType != "token" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_response_type"})
		return
	}
	if clientID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "missing client_id"})
		return
	}
	client, err := model.GetOAuthClientByID(clientID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_client"})
		return
	}
	// 对于 implicit (response_type=token)，允许客户端拥有 authorization_code 或 implicit 任一权限
	if responseType == "code" {
		if !client.ValidateGrantType("authorization_code") {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unauthorized_client"})
			return
		}
	} else {
		if !(client.ValidateGrantType("implicit") || client.ValidateGrantType("authorization_code")) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unauthorized_client"})
			return
		}
	}
	// 严格匹配或本地回环地址宽松匹配（忽略端口，遵循 RFC 8252）
	validRedirect := client.ValidateRedirectURI(redirectURI)
	if !validRedirect {
		if isLoopbackRedirectAllowed(redirectURI, client.GetRedirectURIs()) {
			validRedirect = true
		}
	}
	if redirectURI == "" || !validRedirect {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_request", "error_description": "redirect_uri mismatch or missing"})
		return
	}

	// 支持前端预取信息
	mode := c.Query("mode") // mode=prepare 返回JSON供前端展示

	// 校验scope
	if scope == "" {
		scope = strings.Join(client.GetScopes(), " ")
	} else if !client.ValidateScope(scope) {
		writeOAuthRedirectError(c, redirectURI, "invalid_scope", "requested scope not allowed", state)
		return
	}

	// PKCE 要求
	if responseType == "code" && (settings.RequirePKCE || client.RequirePKCE) {
		if codeChallenge == "" {
			writeOAuthRedirectError(c, redirectURI, "invalid_request", "code_challenge required", state)
			return
		}
		if codeChallengeMethod == "" {
			codeChallengeMethod = "S256"
		}
		if codeChallengeMethod != "S256" {
			writeOAuthRedirectError(c, redirectURI, "invalid_request", "unsupported code_challenge_method", state)
			return
		}
	}

	// 检查用户会话（要求已登录）
	sess := sessions.Default(c)
	uidVal := sess.Get("id")
	if uidVal == nil {
		if mode == "prepare" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "login_required"})
			return
		}
		// 重定向到前端登录后回到同意页
		consentPath := "/oauth/consent?" + c.Request.URL.RawQuery
		loginPath := "/login?next=" + url.QueryEscape(consentPath)
		writeNoStore(c)
		c.Redirect(http.StatusFound, loginPath)
		return
	}
	userID, _ := uidVal.(int)
	if userID == 0 {
		// 某些 session 库会将数字解码为 int64
		if v64, ok := uidVal.(int64); ok {
			userID = int(v64)
		}
	}
	if userID == 0 {
		writeOAuthRedirectError(c, redirectURI, "login_required", "user not logged in", state)
		return
	}

	// prepare 模式：返回前端展示信息
	if mode == "prepare" {
		// 解析重定向域名
		rHost := ""
		if u, err := url.Parse(redirectURI); err == nil {
			rHost = u.Hostname()
		}
		verified := false
		if client.Domain != "" && rHost != "" {
			verified = strings.EqualFold(client.Domain, rHost)
		}
		// scope 明细
		scopeNames := strings.Fields(scope)
		type scopeItem struct{ Name, Description string }
		var scopeInfo []scopeItem
		for _, s := range scopeNames {
			d := ""
			switch s {
			case "openid":
				d = "访问你的基础身份 (sub)"
			case "profile":
				d = "读取你的公开资料 (昵称/用户名)"
			case "email":
				d = "读取你的邮箱地址"
			case "api:read":
				d = "读取 API 资源"
			case "api:write":
				d = "写入/修改 API 资源"
			case "admin":
				d = "管理权限 (高危)"
			default:
				d = ""
			}
			scopeInfo = append(scopeInfo, scopeItem{Name: s, Description: d})
		}
		// 当前用户信息（用于展示）
		var userName, userEmail string
		if user, err := model.GetUserById(userID, false); err == nil && user != nil {
			userName = user.DisplayName
			if userName == "" {
				userName = user.Username
			}
			userEmail = user.Email
		}
		c.JSON(http.StatusOK, gin.H{
			"client": gin.H{
				"id":     client.ID,
				"name":   client.Name,
				"type":   client.ClientType,
				"desc":   client.Description,
				"domain": client.Domain,
			},
			"scope":         scope,
			"scope_list":    scopeNames,
			"scope_info":    scopeInfo,
			"redirect_uri":  redirectURI,
			"redirect_host": rHost,
			"verified":      verified,
			"state":         state,
			"response_type": responseType,
			"require_pkce":  (responseType == "code") && (settings.RequirePKCE || client.RequirePKCE),
			"user": gin.H{
				"id":    userID,
				"name":  userName,
				"email": userEmail,
			},
		})
		return
	}

	// 拒绝授权：返回错误给回调地址
	if c.Query("deny") == "1" || strings.EqualFold(c.Query("decision"), "deny") {
		logger.LogInfo(c, fmt.Sprintf("oauth consent denied: user=%v client=%s scope=%s redirect=%s", sess.Get("id"), clientID, scope, redirectURI))
		writeOAuthRedirectError(c, redirectURI, "access_denied", "user denied the request", state)
		return
	}

	// 未明确选择，跳转前端同意页
	if !(c.Query("approve") == "1" || strings.EqualFold(c.Query("decision"), "approve")) {
		consentPath := "/oauth/consent?" + c.Request.URL.RawQuery
		writeNoStore(c)
		c.Redirect(http.StatusFound, consentPath)
		return
	}

	// 根据响应类型返回
	if responseType == "code" {
		// 生成授权码，写入 存储（短TTL）
		code, err := genCode(32)
		if err != nil {
			writeOAuthRedirectError(c, redirectURI, "server_error", "failed to generate code", state)
			return
		}
		ttl := 2 * time.Minute
		exp := time.Now().Add(ttl).Unix()
		// 存储 clientID|redirectURI|scope|userID|codeChallenge|codeChallengeMethod|exp|nonce
		val := fmt.Sprintf("%s|%s|%s|%d|%s|%s|%d|%s", clientID, redirectURI, scope, userID, codeChallenge, codeChallengeMethod, exp, nonce)
		key := fmt.Sprintf("oauth:code:%s", code)
		if err := storeSet(key, val, ttl); err != nil {
			writeOAuthRedirectError(c, redirectURI, "server_error", "failed to store code", state)
			return
		}
		logger.LogInfo(c, fmt.Sprintf("oauth consent approved (code): user=%d client=%s scope=%s redirect=%s", userID, clientID, scope, redirectURI))

		// 成功，重定向（查询参数）
		u, _ := url.Parse(redirectURI)
		q := u.Query()
		q.Set("code", code)
		if state != "" {
			q.Set("state", state)
		}
		u.RawQuery = q.Encode()
		writeNoStore(c)
		c.Redirect(http.StatusFound, u.String())
		return
	}

	// response_type=token (implicit)
	// 直接签发 Access Token（不下发 Refresh Token）
	accessTTL := time.Duration(settings.AccessTokenTTL) * time.Minute
	userIDStr := fmt.Sprintf("%d", userID)
	tokenStr, expTime, jti, err := signAccessToken(settings, clientID, userIDStr, scope, "implicit", accessTTL, c)
	if err != nil {
		writeOAuthRedirectError(c, redirectURI, "server_error", "failed to issue token", state)
		return
	}
	_ = client.UpdateLastUsedTime()
	logger.LogInfo(c, fmt.Sprintf("oauth consent approved (token): user=%d client=%s scope=%s redirect=%s jti=%s", userID, clientID, scope, redirectURI, jti))

	// 使用 fragment 传递（#access_token=...）
	u, _ := url.Parse(redirectURI)
	frag := url.Values{}
	frag.Set("access_token", tokenStr)
	frag.Set("token_type", "Bearer")
	frag.Set("expires_in", fmt.Sprintf("%d", int64(expTime.Sub(time.Now()).Seconds())))
	if scope != "" {
		frag.Set("scope", scope)
	}
	if state != "" {
		frag.Set("state", state)
	}
	u.Fragment = frag.Encode()
	writeNoStore(c)
	c.Redirect(http.StatusFound, u.String())
}

func writeOAuthError(c *gin.Context, status int, code, description string) {
	c.Header("Cache-Control", "no-store")
	c.Header("Pragma", "no-cache")
	c.JSON(status, gin.H{
		"error":             code,
		"error_description": description,
	})
}

// isLoopback returns true if hostname represents a local loopback host
func isLoopback(host string) bool {
	if host == "" {
		return false
	}
	h := strings.ToLower(host)
	if h == "localhost" || h == "::1" {
		return true
	}
	if strings.HasPrefix(h, "127.") {
		return true
	}
	return false
}

// isLoopbackRedirectAllowed allows redirect URIs on loopback hosts to match ignoring port
// This follows OAuth 2.0 for Native Apps (RFC 8252) guidance to use loopback interface with dynamic port.
func isLoopbackRedirectAllowed(requested string, allowed []string) bool {
	if requested == "" || len(allowed) == 0 {
		return false
	}
	ru, err := url.Parse(requested)
	if err != nil {
		return false
	}
	if !isLoopback(ru.Hostname()) {
		return false
	}
	for _, a := range allowed {
		au, err := url.Parse(a)
		if err != nil {
			continue
		}
		if !isLoopback(au.Hostname()) {
			continue
		}
		// require same scheme and path; ignore port and host variant among loopback
		if strings.EqualFold(ru.Scheme, au.Scheme) && ru.Path == au.Path {
			return true
		}
	}
	return false
}
