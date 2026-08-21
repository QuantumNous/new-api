package codex

import (
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

	// Tokens carries the same credentials nested under "tokens", which is the
	// layout Codex CLI uses in ~/.codex/auth.json. ParseOAuthKey flattens it
	// into the fields above, so it is never re-marshaled.
	Tokens *OAuthKey `json:"tokens,omitempty"`
}

func ParseOAuthKey(raw string) (*OAuthKey, error) {
	if raw == "" {
		return nil, errors.New("codex channel: empty oauth key")
	}
	var key OAuthKey
	if err := common.Unmarshal([]byte(raw), &key); err != nil {
		return nil, errors.New("codex channel: invalid oauth key json")
	}
	key.flattenTokens()
	return &key, nil
}

// flattenTokens promotes credentials nested under "tokens" (the Codex CLI
// auth.json layout) to the top level, keeping any values already set there.
func (k *OAuthKey) flattenTokens() {
	nested := k.Tokens
	if nested == nil {
		return
	}
	k.Tokens = nil
	if k.IDToken == "" {
		k.IDToken = nested.IDToken
	}
	if k.AccessToken == "" {
		k.AccessToken = nested.AccessToken
	}
	if k.RefreshToken == "" {
		k.RefreshToken = nested.RefreshToken
	}
	if k.AccountID == "" {
		k.AccountID = nested.AccountID
	}
}
