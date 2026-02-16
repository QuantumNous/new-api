package codex

import (
	"github.com/QuantumNous/new-api/i18n"
	"errors"

	"github.com/QuantumNous/new-api/common"
)

type OAuthKey struct {
	IDToken      string `json:"id_token,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`

	AccountID   string `json:"account_id,omitempty"`
	LastRefresh string `json:"last_refresh,omitempty"`
	Email       string `json:"email,omitempty"`
	Type        string `json:"type,omitempty"`
	Expired     string `json:"expired,omitempty"`
}

func ParseOAuthKey(raw string) (*OAuthKey, error) {
	if raw == "" {
		return nil, errors.New(i18n.Translate("svc.codex_channel_empty_oauth_key"))
	}
	var key OAuthKey
	if err := common.Unmarshal([]byte(raw), &key); err != nil {
		return nil, errors.New(i18n.Translate("svc.codex_channel_invalid_oauth_key_json"))
	}
	return &key, nil
}
