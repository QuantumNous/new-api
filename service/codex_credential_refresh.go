package service

import (
	"github.com/QuantumNous/new-api/i18n"
	"context"
	"errors"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

type CodexCredentialRefreshOptions struct {
	ResetCaches bool
}

type CodexOAuthKey struct {
	IDToken      string `json:"id_token,omitempty"`
	AccessToken  string `json:"access_token,omitempty"`
	RefreshToken string `json:"refresh_token,omitempty"`

	AccountID   string `json:"account_id,omitempty"`
	LastRefresh string `json:"last_refresh,omitempty"`
	Email       string `json:"email,omitempty"`
	Type        string `json:"type,omitempty"`
	Expired     string `json:"expired,omitempty"`
}

func parseCodexOAuthKey(raw string) (*CodexOAuthKey, error) {
	if strings.TrimSpace(raw) == "" {
		return nil, errors.New(i18n.Translate("svc.codex_channel_empty_oauth_key"))
	}
	var key CodexOAuthKey
	if err := common.Unmarshal([]byte(raw), &key); err != nil {
		return nil, errors.New(i18n.Translate("svc.codex_channel_invalid_oauth_key_json"))
	}
	return &key, nil
}

func RefreshCodexChannelCredential(ctx context.Context, channelID int, opts CodexCredentialRefreshOptions) (*CodexOAuthKey, *model.Channel, error) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return nil, nil, err
	}
	if ch == nil {
		return nil, nil, errors.New(i18n.Translate("model.channel_not_found"))
	}
	if ch.Type != constant.ChannelTypeCodex {
		return nil, nil, errors.New(i18n.Translate("svc.channel_type_is_not_codex"))
	}

	oauthKey, err := parseCodexOAuthKey(strings.TrimSpace(ch.Key))
	if err != nil {
		return nil, nil, err
	}
	if strings.TrimSpace(oauthKey.RefreshToken) == "" {
		return nil, nil, errors.New(i18n.Translate("svc.codex_channel_refresh_token_is_required_to_refresh"))
	}

	refreshCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	res, err := RefreshCodexOAuthTokenWithProxy(refreshCtx, oauthKey.RefreshToken, ch.GetSetting().Proxy)
	if err != nil {
		return nil, nil, err
	}

	oauthKey.AccessToken = res.AccessToken
	oauthKey.RefreshToken = res.RefreshToken
	oauthKey.LastRefresh = time.Now().Format(time.RFC3339)
	oauthKey.Expired = res.ExpiresAt.Format(time.RFC3339)
	if strings.TrimSpace(oauthKey.Type) == "" {
		oauthKey.Type = "codex"
	}

	if strings.TrimSpace(oauthKey.AccountID) == "" {
		if accountID, ok := ExtractCodexAccountIDFromJWT(oauthKey.AccessToken); ok {
			oauthKey.AccountID = accountID
		}
	}
	if strings.TrimSpace(oauthKey.Email) == "" {
		if email, ok := ExtractEmailFromJWT(oauthKey.AccessToken); ok {
			oauthKey.Email = email
		}
	}

	encoded, err := common.Marshal(oauthKey)
	if err != nil {
		return nil, nil, err
	}

	if err := model.DB.Model(&model.Channel{}).Where("id = ?", ch.Id).Update("key", string(encoded)).Error; err != nil {
		return nil, nil, err
	}

	if opts.ResetCaches {
		model.InitChannelCache()
		ResetProxyClientCache()
	}

	return oauthKey, ch, nil
}
