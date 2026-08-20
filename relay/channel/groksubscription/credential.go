package groksubscription

import (
	"encoding/json"
	"errors"
	"strings"
)

// CredentialType 是版本化凭证 JSON 的 type 判别值，必须精确匹配。
const CredentialType = "grok_subscription"

// CredentialVersion 是当前唯一受支持的凭证版本；未知版本 fail closed。
const CredentialVersion = 1

// Credential 是持久化在 Channel.Key 里的版本化 OAuth 凭证。
// 只有 access_token / refresh_token 是账号秘密；不含 email / 密码 / SSO / verifier。
type Credential struct {
	Version      int    `json:"version"`
	Type         string `json:"type"`
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token,omitempty"`
	TokenType    string `json:"token_type"`
	ExpiresAt    int64  `json:"expires_at"`
}

// ParseCredential 解析并严格校验版本化凭证 JSON。
func ParseCredential(raw string) (Credential, error) {
	var c Credential
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return c, errors.New("grok credential: empty")
	}
	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&c); err != nil {
		return Credential{}, errors.New("grok credential: invalid JSON")
	}
	if dec.More() {
		return Credential{}, errors.New("grok credential: trailing data")
	}
	if c.Version != CredentialVersion {
		return Credential{}, errors.New("grok credential: unsupported version")
	}
	if c.Type != CredentialType {
		return Credential{}, errors.New("grok credential: unexpected type")
	}
	if strings.TrimSpace(c.AccessToken) == "" {
		return Credential{}, errors.New("grok credential: access_token required")
	}
	if strings.TrimSpace(c.TokenType) == "" {
		return Credential{}, errors.New("grok credential: token_type required")
	}
	if c.ExpiresAt <= 0 {
		return Credential{}, errors.New("grok credential: expires_at required")
	}
	return c, nil
}

// Serialize 输出规范化的版本化 JSON。
func (c Credential) Serialize() (string, error) {
	c.Version = CredentialVersion
	c.Type = CredentialType
	b, err := json.Marshal(c)
	if err != nil {
		return "", errors.New("grok credential: serialize failed")
	}
	return string(b), nil
}

// IsRefreshable 表示凭证是否带有可用于刷新的 refresh token。
func (c Credential) IsRefreshable() bool {
	return strings.TrimSpace(c.RefreshToken) != ""
}
