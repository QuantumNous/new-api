package oauth

import (
	"context"
	"crypto/rsa"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/golang-jwt/jwt/v5"
)

const (
	jwksCacheTTL     = 15 * time.Minute
	jwksFetchTimeout = 10 * time.Second
	maxJWKSBodyBytes = 1 << 20
)

type oidcIDTokenClaims struct {
	jwt.RegisteredClaims
	AuthorizedParty string `json:"azp"`
}

type jwksDocument struct {
	Keys []jwksKey `json:"keys"`
}

type jwksKey struct {
	KeyID     string `json:"kid"`
	KeyType   string `json:"kty"`
	Use       string `json:"use"`
	Algorithm string `json:"alg"`
	Modulus   string `json:"n"`
	Exponent  string `json:"e"`
}

type cachedJWKS struct {
	keys      map[string]*rsa.PublicKey
	expiresAt time.Time
}

var idTokenJWKSCache = struct {
	sync.Mutex
	entries map[string]cachedJWKS
}{entries: make(map[string]cachedJWKS)}

func verifyCustomOAuthIDToken(ctx context.Context, config *model.CustomOAuthProvider, rawToken string) ([]byte, error) {
	if config == nil {
		return nil, errors.New("missing provider configuration")
	}
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, errors.New("missing id token")
	}

	claims := &oidcIDTokenClaims{}
	token, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (any, error) {
		if token.Method.Alg() != jwt.SigningMethodRS256.Alg() {
			return nil, errors.New("unexpected signing method")
		}
		kid, ok := token.Header["kid"].(string)
		if !ok || strings.TrimSpace(kid) == "" {
			return nil, errors.New("missing key id")
		}
		key, err := customOAuthJWKSKey(ctx, config.JWKSURI, kid)
		if err != nil {
			return nil, err
		}
		return key, nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodRS256.Alg()}), jwt.WithIssuer(config.Issuer), jwt.WithAudience(config.ClientId), jwt.WithExpirationRequired(), jwt.WithIssuedAt(), jwt.WithLeeway(30*time.Second))
	if err != nil || token == nil || !token.Valid {
		if err == nil {
			err = errors.New("invalid id token")
		}
		return nil, err
	}
	if claims.Subject == "" {
		return nil, errors.New("missing subject")
	}
	if claims.IssuedAt == nil {
		return nil, errors.New("missing issued at")
	}
	if len(claims.Audience) > 1 && claims.AuthorizedParty != config.ClientId {
		return nil, errors.New("invalid authorized party")
	}

	return common.Marshal(token.Claims)
}

func customOAuthJWKSKey(ctx context.Context, jwksURI, kid string) (*rsa.PublicKey, error) {
	keys, err := customOAuthJWKSKeys(ctx, jwksURI, false)
	if err != nil {
		return nil, err
	}
	if key := keys[kid]; key != nil {
		return key, nil
	}

	keys, err = customOAuthJWKSKeys(ctx, jwksURI, true)
	if err != nil {
		return nil, err
	}
	key := keys[kid]
	if key == nil {
		return nil, errors.New("signing key not found")
	}
	return key, nil
}

func customOAuthJWKSKeys(ctx context.Context, jwksURI string, refresh bool) (map[string]*rsa.PublicKey, error) {
	idTokenJWKSCache.Lock()
	cached, ok := idTokenJWKSCache.entries[jwksURI]
	idTokenJWKSCache.Unlock()
	if !refresh && ok && time.Now().Before(cached.expiresAt) {
		return cached.keys, nil
	}

	requestContext, cancel := context.WithTimeout(ctx, jwksFetchTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(requestContext, http.MethodGet, jwksURI, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	client := &http.Client{
		Timeout: jwksFetchTimeout,
		CheckRedirect: func(_ *http.Request, _ []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("jwks endpoint returned status %d", resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxJWKSBodyBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > maxJWKSBodyBytes {
		return nil, errors.New("jwks response exceeds size limit")
	}
	var document jwksDocument
	if err := common.Unmarshal(body, &document); err != nil {
		return nil, err
	}

	keys := make(map[string]*rsa.PublicKey, len(document.Keys))
	for _, entry := range document.Keys {
		if entry.KeyID == "" || entry.KeyType != "RSA" || (entry.Use != "" && entry.Use != "sig") || (entry.Algorithm != "" && entry.Algorithm != jwt.SigningMethodRS256.Alg()) {
			continue
		}
		if _, exists := keys[entry.KeyID]; exists {
			return nil, errors.New("duplicate signing key id")
		}
		modulus, err := base64.RawURLEncoding.DecodeString(entry.Modulus)
		if err != nil || len(modulus) == 0 {
			continue
		}
		exponent, err := base64.RawURLEncoding.DecodeString(entry.Exponent)
		if err != nil || len(exponent) == 0 || len(exponent) > 8 {
			continue
		}
		e := 0
		for _, b := range exponent {
			e = e<<8 | int(b)
		}
		if e < 3 || e%2 == 0 {
			continue
		}
		keys[entry.KeyID] = &rsa.PublicKey{N: new(big.Int).SetBytes(modulus), E: e}
	}
	if len(keys) == 0 {
		return nil, errors.New("jwks contains no valid RS256 keys")
	}

	idTokenJWKSCache.Lock()
	idTokenJWKSCache.entries[jwksURI] = cachedJWKS{keys: keys, expiresAt: time.Now().Add(jwksCacheTTL)}
	idTokenJWKSCache.Unlock()
	return keys, nil
}
