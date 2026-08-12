package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha512"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
)

type DogPayTokenCache struct {
	AccessToken     string    `json:"access_token"`
	ExpiresAt       time.Time `json:"expires_at"`
	ConfigSignature string    `json:"-"`
}

var (
	dogPayTokenCache *DogPayTokenCache
	dogPayTokenLock  sync.RWMutex
	dogPayHTTPClient = &http.Client{Timeout: 15 * time.Second}
)

func dogPayConfigSignature() string {
	return setting.DogPayBaseUrl + "\x00" + setting.DogPayAppId + "\x00" + setting.DogPaySecret
}

func VerifyDogPayWebhookSignature(apiKey string, payload []byte, providedSignature string) bool {
	if apiKey == "" || providedSignature == "" {
		return false
	}

	hasher := hmac.New(sha512.New, []byte(apiKey))
	_, _ = hasher.Write(payload)
	expectedSignature := hex.EncodeToString(hasher.Sum(nil))
	return hmac.Equal([]byte(expectedSignature), []byte(providedSignature))
}

func GetDogPayAccessToken() (string, error) {
	configSignature := dogPayConfigSignature()
	dogPayTokenLock.RLock()
	if dogPayTokenCache != nil && dogPayTokenCache.ConfigSignature == configSignature && time.Now().Add(1*time.Minute).Before(dogPayTokenCache.ExpiresAt) {
		token := dogPayTokenCache.AccessToken
		dogPayTokenLock.RUnlock()
		return token, nil
	}
	dogPayTokenLock.RUnlock()

	dogPayTokenLock.Lock()
	defer dogPayTokenLock.Unlock()

	if dogPayTokenCache != nil && dogPayTokenCache.ConfigSignature == configSignature && time.Now().Add(1*time.Minute).Before(dogPayTokenCache.ExpiresAt) {
		return dogPayTokenCache.AccessToken, nil
	}

	payload := map[string]string{
		"grant_type": "client_credential",
		"appid":      setting.DogPayAppId,
		"secret":     setting.DogPaySecret,
	}
	body, err := common.Marshal(payload)
	if err != nil {
		return "", err
	}

	resp, err := dogPayHTTPClient.Post(setting.DogPayBaseUrl+"/open-api/v1/auth/access_token", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result struct {
		Code int `json:"code"`
		Data struct {
			AccessToken string `json:"access_token"`
			ExpiresIn   int    `json:"expires_in"`
		} `json:"data"`
	}
	if err = common.DecodeJson(resp.Body, &result); err != nil {
		return "", err
	}

	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return "", fmt.Errorf("dogpay auth failed with HTTP status: %d", resp.StatusCode)
	}
	if result.Code != 0 {
		return "", fmt.Errorf("dogpay auth failed with code: %d", result.Code)
	}
	if strings.TrimSpace(result.Data.AccessToken) == "" || result.Data.ExpiresIn <= 0 {
		return "", fmt.Errorf("dogpay auth returned an invalid access token")
	}

	dogPayTokenCache = &DogPayTokenCache{
		AccessToken:     result.Data.AccessToken,
		ExpiresAt:       time.Now().Add(time.Duration(result.Data.ExpiresIn) * time.Second),
		ConfigSignature: configSignature,
	}
	return dogPayTokenCache.AccessToken, nil
}

func DogPayRequest(method string, path string, data interface{}) ([]byte, error) {
	token, err := GetDogPayAccessToken()
	if err != nil {
		return nil, err
	}

	var body io.Reader
	if data != nil {
		b, err := common.Marshal(data)
		if err != nil {
			return nil, err
		}
		body = bytes.NewBuffer(b)
	}

	req, err := http.NewRequest(method, setting.DogPayBaseUrl+path, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := dogPayHTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("dogpay request failed with HTTP status: %d", resp.StatusCode)
	}
	return responseBody, nil
}
