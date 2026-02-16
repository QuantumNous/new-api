package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("discord", &DiscordProvider{})
}

// DiscordProvider implements OAuth for Discord
type DiscordProvider struct{}

type discordOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type discordUser struct {
	UID  string `json:"id"`
	ID   string `json:"username"`
	Name string `json:"global_name"`
}

func (p *DiscordProvider) GetName() string {
	return "Discord"
}

func (p *DiscordProvider) IsEnabled() bool {
	return system_setting.GetDiscordSettings().Enabled
}

func (p *DiscordProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError("oauth.invalid_code", nil)
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_exchangetoken_code"), code[:min(len(code), 10)])

	settings := system_setting.GetDiscordSettings()
	redirectUri := fmt.Sprintf("%s/oauth/discord", system_setting.ServerAddress)
	values := url.Values{}
	values.Set("client_id", settings.ClientId)
	values.Set("client_secret", settings.ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", redirectUri)

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_exchangetoken_redirect_uri"), redirectUri)

	req, err := http.NewRequestWithContext(ctx, "POST", "https://discord.com/api/v10/oauth2/token", strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_discord_exchangetoken_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "Discord"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_exchangetoken_response_status"), res.StatusCode)

	var discordResponse discordOAuthResponse
	err = json.NewDecoder(res.Body).Decode(&discordResponse)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_discord_exchangetoken_decode_error"), err.Error()))
		return nil, err
	}

	if discordResponse.AccessToken == "" {
		logger.LogError(ctx, i18n.Translate("oauth.oauth_discord_exchangetoken_failed_empty_access_token"))
		return nil, NewOAuthError("oauth.token_failed", map[string]any{"Provider": "Discord"})
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_exchangetoken_success_scope"), discordResponse.Scope)

	return &OAuthToken{
		AccessToken:  discordResponse.AccessToken,
		TokenType:    discordResponse.TokenType,
		RefreshToken: discordResponse.RefreshToken,
		ExpiresIn:    discordResponse.ExpiresIn,
		Scope:        discordResponse.Scope,
		IDToken:      discordResponse.IDToken,
	}, nil
}

func (p *DiscordProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_getuserinfo_fetching_user_info"))

	req, err := http.NewRequestWithContext(ctx, "GET", "https://discord.com/api/v10/users/@me", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_discord_getuserinfo_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "Discord"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_getuserinfo_response_status"), res.StatusCode)

	if res.StatusCode != http.StatusOK {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_discord_getuserinfo_failed_status"), res.StatusCode))
		return nil, NewOAuthError("oauth.get_user_error", nil)
	}

	var discordUser discordUser
	err = json.NewDecoder(res.Body).Decode(&discordUser)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_discord_getuserinfo_decode_error"), err.Error()))
		return nil, err
	}

	if discordUser.UID == "" || discordUser.ID == "" {
		logger.LogError(ctx, i18n.Translate("oauth.oauth_discord_getuserinfo_failed_empty_user_fields"))
		return nil, NewOAuthError("oauth.user_info_empty", map[string]any{"Provider": "Discord"})
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_discord_getuserinfo_success_uid_username_name"), discordUser.UID, discordUser.ID, discordUser.Name)

	return &OAuthUser{
		ProviderUserID: discordUser.UID,
		Username:       discordUser.ID,
		DisplayName:    discordUser.Name,
	}, nil
}

func (p *DiscordProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsDiscordIdAlreadyTaken(providerUserID)
}

func (p *DiscordProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.DiscordId = providerUserID
	return user.FillUserByDiscordId()
}

func (p *DiscordProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.DiscordId = providerUserID
}

func (p *DiscordProvider) GetProviderPrefix() string {
	return "discord_"
}
