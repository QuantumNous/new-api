package oauth

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

const (
	googleTokenEndpoint    = "https://oauth2.googleapis.com/token"
	googleUserInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo"
)

func init() {
	Register("google", &GoogleProvider{})
}

// GoogleProvider implements OAuth for Google using standard OIDC endpoints.
type GoogleProvider struct{}

type googleOAuthResponse struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	Scope        string `json:"scope"`
	IDToken      string `json:"id_token"`
}

type googleUser struct {
	Sub   string `json:"sub"`
	Email string `json:"email"`
	// EmailVerified uses dto.BoolValue so it decodes whether Google sends a JSON
	// boolean (the OIDC userinfo endpoint's spec behavior) or the legacy string
	// form ("true"); an absent/false value fails closed as not verified.
	EmailVerified dto.BoolValue `json:"email_verified"`
	Name          string        `json:"name"`
}

func (p *GoogleProvider) GetName() string { return "Google" }

func (p *GoogleProvider) IsEnabled() bool {
	return system_setting.GetGoogleSettings().Enabled
}

func (p *GoogleProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-Google] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	settings := system_setting.GetGoogleSettings()
	redirectUri := fmt.Sprintf("%s/oauth/google", system_setting.ServerAddress)
	values := url.Values{}
	values.Set("client_id", settings.ClientId)
	values.Set("client_secret", settings.ClientSecret)
	values.Set("code", code)
	values.Set("grant_type", "authorization_code")
	values.Set("redirect_uri", redirectUri)

	logger.LogDebug(ctx, "[OAuth-Google] ExchangeToken: redirect_uri=%s", redirectUri)

	req, err := http.NewRequestWithContext(ctx, "POST", googleTokenEndpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Google"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Google] ExchangeToken response status: %d", res.StatusCode)

	// Google returns a JSON error body (e.g. invalid_grant / redirect_uri_mismatch)
	// with a 4xx status. Surface it instead of decoding into an empty token and
	// reporting the generic "check settings" message.
	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] ExchangeToken failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Google"}, fmt.Sprintf("status %d: %s", res.StatusCode, bodyStr))
	}

	var tokenResp googleOAuthResponse
	if err := common.DecodeJson(res.Body, &tokenResp); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if tokenResp.AccessToken == "" {
		logger.LogError(ctx, "[OAuth-Google] ExchangeToken failed: empty access token")
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Google"})
	}

	return &OAuthToken{
		AccessToken:  tokenResp.AccessToken,
		TokenType:    tokenResp.TokenType,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresIn:    tokenResp.ExpiresIn,
		Scope:        tokenResp.Scope,
		IDToken:      tokenResp.IDToken,
	}, nil
}

func (p *GoogleProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	req, err := http.NewRequestWithContext(ctx, "GET", googleUserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.Client{Timeout: 10 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Google"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Google] GetUserInfo response status: %d", res.StatusCode)

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] GetUserInfo failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "Google"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	user, err := parseGoogleUserInfo(body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Google] GetUserInfo parse error: %s", err.Error()))
		return nil, err
	}

	logger.LogDebug(ctx, "[OAuth-Google] GetUserInfo success: sub=%s, name=%s, email=%s",
		user.ProviderUserID, user.DisplayName, user.Email)
	return user, nil
}

// parseGoogleUserInfo parses a Google userinfo response and enforces that the
// email is verified. Extracted as a pure function so it can be unit-tested
// without performing real HTTP requests.
func parseGoogleUserInfo(body []byte) (*OAuthUser, error) {
	var gu googleUser
	if err := common.Unmarshal(body, &gu); err != nil {
		return nil, err
	}

	if gu.Sub == "" || gu.Email == "" {
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "Google"})
	}
	if !bool(gu.EmailVerified) {
		return nil, NewOAuthError(i18n.MsgOAuthEmailNotVerified, map[string]any{"Provider": "Google"})
	}

	return &OAuthUser{
		ProviderUserID: gu.Sub,
		DisplayName:    gu.Name,
		Email:          gu.Email,
	}, nil
}

func (p *GoogleProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsGoogleIdAlreadyTaken(providerUserID)
}

func (p *GoogleProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.GoogleId = providerUserID
	return user.FillUserByGoogleId()
}

func (p *GoogleProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.GoogleId = providerUserID
}

func (p *GoogleProvider) GetProviderPrefix() string { return "google_" }
