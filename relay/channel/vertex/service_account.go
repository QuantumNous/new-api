package vertex

import (
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"

	"github.com/bytedance/gopkg/cache/asynccache"
	"github.com/golang-jwt/jwt/v5"
)

type Credentials struct {
	ProjectID    string `json:"project_id"`
	PrivateKeyID string `json:"private_key_id"`
	PrivateKey   string `json:"private_key"`
	ClientEmail  string `json:"client_email"`
	ClientID     string `json:"client_id"`
}

var Cache = asynccache.NewAsyncCache(asynccache.Options{
	RefreshDuration: time.Minute * 35,
	EnableExpire:    true,
	ExpireDuration:  time.Minute * 30,
	Fetcher: func(key string) (interface{}, error) {
		return nil, errors.New("not found")
	},
})

type CachedAccessTokenRequest struct {
	ChannelID            int
	ChannelIsMultiKey    bool
	ChannelMultiKeyIndex int
	Credentials          Credentials
	Proxy                string
}

func AcquireCachedAccessToken(input CachedAccessTokenRequest) (string, error) {
	return acquireCachedAccessToken(input, func(signedJWT string) (string, error) {
		return exchangeJwtForAccessTokenWithProxy(signedJWT, input.Proxy)
	})
}

func acquireCachedAccessToken(input CachedAccessTokenRequest, exchange func(string) (string, error)) (string, error) {
	cacheKey := fmt.Sprintf("access-token-%d", input.ChannelID)
	if input.ChannelIsMultiKey {
		cacheKey = fmt.Sprintf("access-token-%d-%d", input.ChannelID, input.ChannelMultiKeyIndex)
	}
	if value, err := Cache.Get(cacheKey); err == nil {
		if token, ok := value.(string); ok && token != "" {
			return token, nil
		}
	}

	signedJWT, err := createSignedJWT(input.Credentials.ClientEmail, input.Credentials.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("failed to create signed JWT: %w", err)
	}
	newToken, err := exchange(signedJWT)
	if err != nil {
		return "", fmt.Errorf("failed to exchange JWT for access token: %w", err)
	}
	value := Cache.GetOrSet(cacheKey, newToken)
	if token, ok := value.(string); ok && token != "" {
		return token, nil
	}
	return newToken, nil
}

func getAccessToken(a *Adaptor, info *relaycommon.RelayInfo) (string, error) {
	input := CachedAccessTokenRequest{
		ChannelID:            info.ChannelId,
		ChannelIsMultiKey:    info.ChannelIsMultiKey,
		ChannelMultiKeyIndex: info.ChannelMultiKeyIndex,
		Credentials:          a.AccountCredentials,
		Proxy:                info.ChannelSetting.Proxy,
	}
	return acquireCachedAccessToken(input, func(signedJWT string) (string, error) {
		return exchangeJwtForAccessToken(signedJWT, info)
	})
}

func createSignedJWT(email, privateKeyPEM string) (string, error) {

	privateKeyPEM = strings.ReplaceAll(privateKeyPEM, "-----BEGIN PRIVATE KEY-----", "")
	privateKeyPEM = strings.ReplaceAll(privateKeyPEM, "-----END PRIVATE KEY-----", "")
	privateKeyPEM = strings.ReplaceAll(privateKeyPEM, "\r", "")
	privateKeyPEM = strings.ReplaceAll(privateKeyPEM, "\n", "")
	privateKeyPEM = strings.ReplaceAll(privateKeyPEM, "\\n", "")

	block, _ := pem.Decode([]byte("-----BEGIN PRIVATE KEY-----\n" + privateKeyPEM + "\n-----END PRIVATE KEY-----"))
	if block == nil {
		return "", fmt.Errorf("failed to parse PEM block containing the private key")
	}

	privateKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		return "", err
	}

	rsaPrivateKey, ok := privateKey.(*rsa.PrivateKey)
	if !ok {
		return "", fmt.Errorf("not an RSA private key")
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss":   email,
		"scope": "https://www.googleapis.com/auth/cloud-platform",
		"aud":   "https://www.googleapis.com/oauth2/v4/token",
		"exp":   now.Add(time.Minute * 35).Unix(),
		"iat":   now.Unix(),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	signedToken, err := token.SignedString(rsaPrivateKey)
	if err != nil {
		return "", err
	}

	return signedToken, nil
}

func exchangeJwtForAccessToken(signedJWT string, info *relaycommon.RelayInfo) (string, error) {

	authURL := "https://www.googleapis.com/oauth2/v4/token"
	data := url.Values{}
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	data.Set("assertion", signedJWT)

	client, err := service.GetHttpClientWithProxySettings(info.ChannelSetting.Proxy, info.ChannelSetting)
	if err != nil {
		return "", fmt.Errorf("new proxy http client failed: %w", err)
	}

	resp, err := client.PostForm(authURL, data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return "", err
	}

	if accessToken, ok := result["access_token"].(string); ok {
		return accessToken, nil
	}

	return "", fmt.Errorf("failed to get access token: %v", result)
}

func AcquireAccessToken(creds Credentials, proxy string) (string, error) {
	signedJWT, err := createSignedJWT(creds.ClientEmail, creds.PrivateKey)
	if err != nil {
		return "", fmt.Errorf("failed to create signed JWT: %w", err)
	}
	return exchangeJwtForAccessTokenWithProxy(signedJWT, proxy)
}

func exchangeJwtForAccessTokenWithProxy(signedJWT string, proxy string) (string, error) {
	authURL := "https://www.googleapis.com/oauth2/v4/token"
	data := url.Values{}
	data.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	data.Set("assertion", signedJWT)

	var client *http.Client
	var err error
	if proxy != "" {
		client, err = service.GetHttpClientWithProxy(proxy)
		if err != nil {
			return "", fmt.Errorf("new proxy http client failed: %w", err)
		}
	} else {
		client = service.GetHttpClient()
	}

	resp, err := client.PostForm(authURL, data)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	if err := common.DecodeJson(resp.Body, &result); err != nil {
		return "", err
	}

	if accessToken, ok := result["access_token"].(string); ok {
		return accessToken, nil
	}
	return "", fmt.Errorf("failed to get access token: %v", result)
}
