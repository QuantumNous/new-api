package chatgpt_web

import (
	"crypto/md5"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

// WebKey 是 ChatGPT 网页逆向渠道的凭证。
//
// 用户填法（两种都支持，越省事越好）：
//  1. 直接粘贴原始 access_token（最常见）——account_id 自动从 JWT 解析，device_id 自动派生；
//  2. 填 JSON：{"access_token":"...","account_id":"...","device_id":"..."} 用于显式覆盖。
//
// 关键约束（见记忆 chatgpt-web-reverse-feasible）：该账号已被风控，token 无法刷新，
// 过期需用户手动从浏览器重新抠 access_token 更新本渠道 Key。
type WebKey struct {
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`
	AccountID    string `json:"account_id,omitempty"`
	DeviceID     string `json:"device_id,omitempty"`
}

// JWT 自定义 claim 路径，chatgpt_account_id 藏在这里面。
const jwtAuthClaimPath = "https://api.openai.com/auth"

func ParseWebKey(raw string) (*WebKey, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, errors.New("chatgpt-web channel: empty key")
	}
	key := &WebKey{}
	if strings.HasPrefix(raw, "{") {
		if err := common.Unmarshal([]byte(raw), key); err != nil {
			return nil, errors.New("chatgpt-web channel: invalid key json")
		}
	} else {
		key.AccessToken = raw
	}

	key.AccessToken = strings.TrimSpace(strings.TrimPrefix(key.AccessToken, "Bearer "))
	if key.AccessToken == "" {
		return nil, errors.New("chatgpt-web channel: access_token is required")
	}

	if strings.TrimSpace(key.AccountID) == "" {
		if id, ok := extractAccountIDFromJWT(key.AccessToken); ok {
			key.AccountID = id
		}
	}
	if strings.TrimSpace(key.AccountID) == "" {
		return nil, errors.New("chatgpt-web channel: account_id missing and not found in access_token JWT")
	}

	if strings.TrimSpace(key.DeviceID) == "" {
		key.DeviceID = deriveDeviceID(key.AccountID)
	}
	return key, nil
}

// extractAccountIDFromJWT 解码 access_token 的 payload，取 chatgpt_account_id。
func extractAccountIDFromJWT(token string) (string, bool) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return "", false
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return "", false
	}
	var claims map[string]any
	if err := common.Unmarshal(payload, &claims); err != nil {
		return "", false
	}
	auth, ok := claims[jwtAuthClaimPath].(map[string]any)
	if !ok {
		return "", false
	}
	id, ok := auth["chatgpt_account_id"].(string)
	if !ok {
		return "", false
	}
	id = strings.TrimSpace(id)
	return id, id != ""
}

// deriveDeviceID 从 account_id 确定性派生一个 UUID 形态的稳定 device id。
// 同一账号每次请求得到相同 device id（风控更友好，避免每次都是“新设备”）。
func deriveDeviceID(accountID string) string {
	sum := md5.Sum([]byte("newapi-chatgpt-web-device:" + accountID))
	h := hex.EncodeToString(sum[:])
	return fmt.Sprintf("%s-%s-%s-%s-%s", h[0:8], h[8:12], h[12:16], h[16:20], h[20:32])
}
