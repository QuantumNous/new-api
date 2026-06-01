package oauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("linuxdo", &LinuxDOProvider{})
}

// LinuxDOProvider implements OAuth for Linux DO
type LinuxDOProvider struct{}

type linuxdoUser struct {
	Id         int    `json:"id"`
	Username   string `json:"username"`
	Name       string `json:"name"`
	Active     bool   `json:"active"`
	TrustLevel int    `json:"trust_level"`
	Silenced   bool   `json:"silenced"`
}

func (p *LinuxDOProvider) GetName() string {
	return "Linux DO"
}

func (p *LinuxDOProvider) IsEnabled() bool {
	return common.LinuxDOOAuthEnabled
}

func (p *LinuxDOProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError("oauth.invalid_code", nil)
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_exchangetoken_code"), code[:min(len(code), 10)])

	// Get access token using Basic auth
	tokenEndpoint := common.GetEnvOrDefaultString("LINUX_DO_TOKEN_ENDPOINT", "https://connect.linux.do/oauth2/token")
	credentials := common.LinuxDOClientId + ":" + common.LinuxDOClientSecret
	basicAuth := "Basic " + base64.StdEncoding.EncodeToString([]byte(credentials))

	// Get redirect URI from request
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	redirectURI := fmt.Sprintf("%s://%s/api/oauth/linuxdo", scheme, c.Request.Host)

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_exchangetoken_token_endpoint_redirect_uri"), tokenEndpoint, redirectURI)

	data := url.Values{}
	data.Set("grant_type", "authorization_code")
	data.Set("code", code)
	data.Set("redirect_uri", redirectURI)

	req, err := http.NewRequestWithContext(ctx, "POST", tokenEndpoint, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", basicAuth)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_exchangetoken_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "Linux DO"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_exchangetoken_response_status"), res.StatusCode)

	var tokenRes struct {
		AccessToken string `json:"access_token"`
		Message     string `json:"message"`
	}
	if err := json.NewDecoder(res.Body).Decode(&tokenRes); err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_exchangetoken_decode_error"), err.Error()))
		return nil, err
	}

	if tokenRes.AccessToken == "" {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_exchangetoken_failed"), tokenRes.Message))
		return nil, NewOAuthErrorWithRaw("oauth.token_failed", map[string]any{"Provider": "Linux DO"}, tokenRes.Message)
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_exchangetoken_success"))

	return &OAuthToken{
		AccessToken: tokenRes.AccessToken,
	}, nil
}

func (p *LinuxDOProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	userEndpoint := common.GetEnvOrDefaultString("LINUX_DO_USER_ENDPOINT", "https://connect.linux.do/api/user")

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_getuserinfo_user_endpoint"), userEndpoint)

	req, err := http.NewRequestWithContext(ctx, "GET", userEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 5 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_getuserinfo_error"), err.Error()))
		return nil, NewOAuthErrorWithRaw("oauth.connect_failed", map[string]any{"Provider": "Linux DO"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_getuserinfo_response_status"), res.StatusCode)

	var linuxdoUser linuxdoUser
	if err := json.NewDecoder(res.Body).Decode(&linuxdoUser); err != nil {
		logger.LogError(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_getuserinfo_decode_error"), err.Error()))
		return nil, err
	}

	if linuxdoUser.Id == 0 {
		logger.LogError(ctx, i18n.Translate("oauth.oauth_linuxdo_getuserinfo_failed_invalid_user_id"))
		return nil, NewOAuthError("oauth.user_info_empty", map[string]any{"Provider": "Linux DO"})
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_getuserinfo_id_username_name_trust_level"),
		linuxdoUser.Id, linuxdoUser.Username, linuxdoUser.Name, linuxdoUser.TrustLevel, linuxdoUser.Active, linuxdoUser.Silenced)

	// Check trust level
	if linuxdoUser.TrustLevel < common.LinuxDOMinimumTrustLevel {
		logger.LogWarn(ctx, fmt.Sprintf(i18n.Translate("oauth.oauth_linuxdo_getuserinfo_trust_level_too_low"),
			common.LinuxDOMinimumTrustLevel, linuxdoUser.TrustLevel))
		return nil, &TrustLevelError{
			Required: common.LinuxDOMinimumTrustLevel,
			Current:  linuxdoUser.TrustLevel,
		}
	}

	logger.LogDebug(ctx, i18n.Translate("oauth.oauth_linuxdo_getuserinfo_success_id_username"), linuxdoUser.Id, linuxdoUser.Username)

	return &OAuthUser{
		ProviderUserID: strconv.Itoa(linuxdoUser.Id),
		Username:       linuxdoUser.Username,
		DisplayName:    linuxdoUser.Name,
		Extra: map[string]any{
			"trust_level": linuxdoUser.TrustLevel,
			"active":      linuxdoUser.Active,
			"silenced":    linuxdoUser.Silenced,
		},
	}, nil
}

func (p *LinuxDOProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsLinuxDOIdAlreadyTaken(providerUserID)
}

func (p *LinuxDOProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.LinuxDOId = providerUserID
	return user.FillUserByLinuxDOId()
}

func (p *LinuxDOProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.LinuxDOId = providerUserID
}

func (p *LinuxDOProvider) GetProviderPrefix() string {
	return "linuxdo_"
}

// TrustLevelError indicates the user's trust level is too low
type TrustLevelError struct {
	Required int
	Current  int
}

func (e *TrustLevelError) Error() string {
	return "trust level too low"
}
