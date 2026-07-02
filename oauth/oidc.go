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
	Register("oidc", &OIDCProvider{})
}

// OIDCProvider implements OAuth for OIDC
type OIDCProvider struct{}

type oidcOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	IDToken      string `json:"id_token"`
	RefreshToken string `json:"refresh_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
}

type oidcUser struct {
	OpenID            string `json:"sub"`
	Email             string `json:"email"`
	Name              string `json:"name"`
	PreferredUsername string `json:"preferred_username"`
	Picture           string `json:"picture"`
}

func (p *OIDCProvider) GetName() string {
	return "OIDC"
}

func (p *OIDCProvider) IsEnabled() bool {
	return system_setting.GetOIDCSettings().Enabled
}

func (p *OIDCProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError("oauth.invalid_code", nil)
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_exchangetoken_code"), code[:min(len(code), 10)])

	settings := system_setting.GetOIDCSettings()
	redirectUri := fmt.Sprintf("%s/oauth/oidc", system_setting.ServerAddress)
	values := url.Values{}
	values.Set("client_id", settings.ClientId)
	values.Set("client_secret", settings.ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", redirectUri)

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_exchangetoken_token_endpoint_redirect_uri"), settings.TokenEndpoint, redirectUri)

	req, err := http.NewRequestWithContext(ctx, "POST", settings.TokenEndpoint, strings.NewReader(values.Encode()))
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
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_exchangetoken_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "OIDC"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_exchangetoken_response_status"), res.StatusCode)

	var oidcResponse oidcOAuthResponse
	err = json.NewDecoder(res.Body).Decode(&oidcResponse)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_exchangetoken_decode_error"), err.Error()))
		return nil, err
	}

	if oidcResponse.AccessToken == "" {
		logger.LogError(ctx, i18n.Translate("oauth.oauth_oidc_exchangetoken_failed_empty_access_token"))
		return nil, NewOAuthError("oauth.token_failed", map[string]any{"Provider": "OIDC"})
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_exchangetoken_success_scope"), oidcResponse.Scope)

	return &OAuthToken{
		AccessToken:  oidcResponse.AccessToken,
		TokenType:    oidcResponse.TokenType,
		RefreshToken: oidcResponse.RefreshToken,
		ExpiresIn:    oidcResponse.ExpiresIn,
		Scope:        oidcResponse.Scope,
		IDToken:      oidcResponse.IDToken,
	}, nil
}

func (p *OIDCProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	settings := system_setting.GetOIDCSettings()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_getuserinfo_userinfo_endpoint"), settings.UserInfoEndpoint)

	req, err := http.NewRequestWithContext(ctx, "GET", settings.UserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.Client{
		Timeout: 5 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_getuserinfo_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "OIDC"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_getuserinfo_response_status"), res.StatusCode)

	if res.StatusCode != http.StatusOK {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_getuserinfo_failed_status"), res.StatusCode))
		return nil, NewOAuthError("oauth.get_user_error", nil)
	}

	var oidcUser oidcUser
	err = json.NewDecoder(res.Body).Decode(&oidcUser)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_getuserinfo_decode_error"), err.Error()))
		return nil, err
	}

	if oidcUser.OpenID == "" || oidcUser.Email == "" {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_oidc_getuserinfo_failed_empty_fields_sub"), oidcUser.OpenID, oidcUser.Email))
		return nil, NewOAuthError("oauth.user_info_empty", map[string]any{"Provider": "OIDC"})
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_oidc_getuserinfo_success_sub_username_name_email"), oidcUser.OpenID, oidcUser.PreferredUsername, oidcUser.Name, oidcUser.Email)

	return &OAuthUser{
		ProviderUserID: oidcUser.OpenID,
		Username:       oidcUser.PreferredUsername,
		DisplayName:    oidcUser.Name,
		Email:          oidcUser.Email,
	}, nil
}

func (p *OIDCProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsOidcIdAlreadyTaken(providerUserID)
}

func (p *OIDCProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.OidcId = providerUserID
	return user.FillUserByOidcId()
}

func (p *OIDCProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.OidcId = providerUserID
}

func (p *OIDCProvider) GetProviderPrefix() string {
	return "oidc_"
}
