package service

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"math/big"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/golang-jwt/jwt/v5"
)

const (
	desktopSigningKeyOption = "DesktopSigningPrivateKey"

	DesktopTokenTypeAccess  = "access"
	DesktopTokenTypeRefresh = "refresh"
)

// DesktopClaims is the token payload consumed by the desktop app and by the
// connector broker, which verifies signatures through the public JWKS endpoint.
type DesktopClaims struct {
	jwt.RegisteredClaims
	Email     string `json:"email,omitempty"`
	Username  string `json:"username,omitempty"`
	TokenType string `json:"typ"`
	// RelayTokenId ties the session to the relay API key issued alongside it,
	// so deleting that key in the console also kills the desktop session.
	RelayTokenId int `json:"tid"`
}

type desktopSigningKey struct {
	private *rsa.PrivateKey
	kid     string
}

var (
	desktopKeyOnce  sync.Mutex
	desktopKeyCache *desktopSigningKey
)

func loadDesktopSigningKey() (*desktopSigningKey, error) {
	desktopKeyOnce.Lock()
	defer desktopKeyOnce.Unlock()
	if desktopKeyCache != nil {
		return desktopKeyCache, nil
	}
	stored, err := model.GetOrCreatePrivateOption(desktopSigningKeyOption, generateDesktopSigningKeyPEM)
	if err != nil {
		return nil, err
	}
	if stored == "" {
		return nil, errors.New("desktop signing key is unavailable")
	}
	block, _ := pem.Decode([]byte(stored))
	if block == nil {
		return nil, errors.New("desktop signing key is not valid PEM")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return nil, err
	}
	private, ok := parsed.(*rsa.PrivateKey)
	if !ok {
		return nil, errors.New("desktop signing key is not an RSA key")
	}
	kid, err := desktopKeyID(&private.PublicKey)
	if err != nil {
		return nil, err
	}
	desktopKeyCache = &desktopSigningKey{private: private, kid: kid}
	return desktopKeyCache, nil
}

func generateDesktopSigningKeyPEM() (string, error) {
	private, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return "", err
	}
	der, err := x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		return "", err
	}
	return string(pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})), nil
}

func desktopKeyID(public *rsa.PublicKey) (string, error) {
	der, err := x509.MarshalPKIXPublicKey(public)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(der)
	return base64.RawURLEncoding.EncodeToString(sum[:])[:16], nil
}

func desktopIssuer() string {
	addr := strings.TrimSpace(system_setting.ServerAddress)
	if addr == "" {
		return "boxai"
	}
	return strings.TrimSuffix(addr, "/")
}

func issueDesktopToken(user *model.User, relayTokenId int, tokenType string, ttl time.Duration) (string, error) {
	key, err := loadDesktopSigningKey()
	if err != nil {
		return "", err
	}
	desktop := system_setting.GetDesktopSettings()
	now := time.Now()
	claims := DesktopClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    desktopIssuer(),
			Subject:   strconv.Itoa(user.Id),
			Audience:  jwt.ClaimStrings{desktop.BrokerAudience},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(ttl)),
		},
		Email:        user.Email,
		Username:     user.Username,
		TokenType:    tokenType,
		RelayTokenId: relayTokenId,
	}
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	token.Header["kid"] = key.kid
	return token.SignedString(key.private)
}

// IssueDesktopSession mints the access/refresh pair handed to the desktop app
// after the user approves a device authorization request.
func IssueDesktopSession(user *model.User, relayTokenId int) (accessToken string, refreshToken string, expiresIn int, err error) {
	desktop := system_setting.GetDesktopSettings()
	accessTTL := time.Duration(desktop.AccessTokenMinutes) * time.Minute
	refreshTTL := time.Duration(desktop.RefreshTokenDays) * 24 * time.Hour

	accessToken, err = issueDesktopToken(user, relayTokenId, DesktopTokenTypeAccess, accessTTL)
	if err != nil {
		return "", "", 0, err
	}
	refreshToken, err = issueDesktopToken(user, relayTokenId, DesktopTokenTypeRefresh, refreshTTL)
	if err != nil {
		return "", "", 0, err
	}
	return accessToken, refreshToken, int(accessTTL.Seconds()), nil
}

func ParseDesktopToken(tokenString string, expectedType string) (*DesktopClaims, error) {
	key, err := loadDesktopSigningKey()
	if err != nil {
		return nil, err
	}
	claims := &DesktopClaims{}
	parsed, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}
		return &key.private.PublicKey, nil
	}, jwt.WithIssuer(desktopIssuer()), jwt.WithAudience(system_setting.GetDesktopSettings().BrokerAudience))
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, errors.New("token is not valid")
	}
	if claims.TokenType != expectedType {
		return nil, errors.New("token type mismatch")
	}
	return claims, nil
}

type jsonWebKey struct {
	Kty string `json:"kty"`
	Use string `json:"use"`
	Alg string `json:"alg"`
	Kid string `json:"kid"`
	N   string `json:"n"`
	E   string `json:"e"`
}

type jsonWebKeySet struct {
	Keys []jsonWebKey `json:"keys"`
}

// DesktopJWKS exposes the public half of the signing key so the connector
// broker can verify desktop tokens at the edge without calling back here.
func DesktopJWKS() (any, error) {
	key, err := loadDesktopSigningKey()
	if err != nil {
		return nil, err
	}
	public := key.private.PublicKey
	return jsonWebKeySet{Keys: []jsonWebKey{{
		Kty: "RSA",
		Use: "sig",
		Alg: "RS256",
		Kid: key.kid,
		N:   base64.RawURLEncoding.EncodeToString(public.N.Bytes()),
		E:   base64.RawURLEncoding.EncodeToString(big.NewInt(int64(public.E)).Bytes()),
	}}}, nil
}
