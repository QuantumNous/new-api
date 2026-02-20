package oauth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

// AuthStyle defines how to send client credentials
const (
	AuthStyleAutoDetect = 0 // Auto-detect based on server response
	AuthStyleInParams   = 1 // Send client_id and client_secret as POST parameters
	AuthStyleInHeader   = 2 // Send as Basic Auth header
)

// GenericOAuthProvider implements OAuth for custom/generic OAuth providers
type GenericOAuthProvider struct {
	config *model.CustomOAuthProvider
}

// NewGenericOAuthProvider creates a new generic OAuth provider from config
func NewGenericOAuthProvider(config *model.CustomOAuthProvider) *GenericOAuthProvider {
	return &GenericOAuthProvider{config: config}
}

func (p *GenericOAuthProvider) GetName() string {
	return p.config.Name
}

func (p *GenericOAuthProvider) IsEnabled() bool {
	return p.config.Enabled
}

func (p *GenericOAuthProvider) GetConfig() *model.CustomOAuthProvider {
	return p.config
}

func (p *GenericOAuthProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-Generic-%s] ExchangeToken: code=%s...", p.config.Slug, code[:min(len(code), 10)])

	redirectUri := fmt.Sprintf("%s/oauth/%s", system_setting.ServerAddress, p.config.Slug)
	values := url.Values{}
	values.Set("grant_type", "authorization_code")
	values.Set("code", code)
	values.Set("redirect_uri", redirectUri)

	// Determine auth style
	authStyle := p.config.AuthStyle
	if authStyle == AuthStyleAutoDetect {
		// Default to params style for most OAuth servers
		authStyle = AuthStyleInParams
	}

	var req *http.Request
	var err error

	if authStyle == AuthStyleInParams {
		values.Set("client_id", p.config.ClientId)
		values.Set("client_secret", p.config.ClientSecret)
	}

	req, err = http.NewRequestWithContext(ctx, "POST", p.config.TokenEndpoint, strings.NewReader(values.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("Accept", "application/json")

	if authStyle == AuthStyleInHeader {
		// Basic Auth
		credentials := base64.StdEncoding.EncodeToString([]byte(p.config.ClientId + ":" + p.config.ClientSecret))
		req.Header.Set("Authorization", "Basic "+credentials)
	}

	logger.LogDebug(ctx, "[OAuth-Generic-%s] ExchangeToken: token_endpoint=%s, redirect_uri=%s, auth_style=%d",
		p.config.Slug, p.config.TokenEndpoint, redirectUri, authStyle)

	client := http.Client{
		Timeout: 20 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] ExchangeToken error: %s", p.config.Slug, err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Generic-%s] ExchangeToken response status: %d", p.config.Slug, res.StatusCode)

	body, err := io.ReadAll(res.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] ExchangeToken read body error: %s", p.config.Slug, err.Error()))
		return nil, err
	}

	bodyStr := string(body)
	logger.LogDebug(ctx, "[OAuth-Generic-%s] ExchangeToken response body: %s", p.config.Slug, bodyStr[:min(len(bodyStr), 500)])

	// Try to parse as JSON first
	var tokenResponse struct {
		AccessToken  string `json:"access_token"`
		TokenType    string `json:"token_type"`
		RefreshToken string `json:"refresh_token"`
		ExpiresIn    int    `json:"expires_in"`
		Scope        string `json:"scope"`
		IDToken      string `json:"id_token"`
		Error        string `json:"error"`
		ErrorDesc    string `json:"error_description"`
	}

	if err := json.Unmarshal(body, &tokenResponse); err != nil {
		// Try to parse as URL-encoded (some OAuth servers like GitHub return this format)
		parsedValues, parseErr := url.ParseQuery(bodyStr)
		if parseErr != nil {
			logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] ExchangeToken parse error: %s", p.config.Slug, err.Error()))
			return nil, err
		}
		tokenResponse.AccessToken = parsedValues.Get("access_token")
		tokenResponse.TokenType = parsedValues.Get("token_type")
		tokenResponse.Scope = parsedValues.Get("scope")
	}

	if tokenResponse.Error != "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] ExchangeToken OAuth error: %s - %s",
			p.config.Slug, tokenResponse.Error, tokenResponse.ErrorDesc))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name}, tokenResponse.ErrorDesc)
	}

	if tokenResponse.AccessToken == "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] ExchangeToken failed: empty access token", p.config.Slug))
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": p.config.Name})
	}

	logger.LogDebug(ctx, "[OAuth-Generic-%s] ExchangeToken success: scope=%s", p.config.Slug, tokenResponse.Scope)

	return &OAuthToken{
		AccessToken:  tokenResponse.AccessToken,
		TokenType:    tokenResponse.TokenType,
		RefreshToken: tokenResponse.RefreshToken,
		ExpiresIn:    tokenResponse.ExpiresIn,
		Scope:        tokenResponse.Scope,
		IDToken:      tokenResponse.IDToken,
	}, nil
}

func (p *GenericOAuthProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	logger.LogDebug(ctx, "[OAuth-Generic-%s] GetUserInfo: fetching user info from %s", p.config.Slug, p.config.UserInfoEndpoint)

	req, err := http.NewRequestWithContext(ctx, "GET", p.config.UserInfoEndpoint, nil)
	if err != nil {
		return nil, err
	}

	// Set authorization header
	tokenType := token.TokenType
	if tokenType == "" {
		tokenType = "Bearer"
	}
	req.Header.Set("Authorization", fmt.Sprintf("%s %s", tokenType, token.AccessToken))
	req.Header.Set("Accept", "application/json")

	client := http.Client{
		Timeout: 20 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] GetUserInfo error: %s", p.config.Slug, err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": p.config.Name}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Generic-%s] GetUserInfo response status: %d", p.config.Slug, res.StatusCode)

	if res.StatusCode != http.StatusOK {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] GetUserInfo failed: status=%d", p.config.Slug, res.StatusCode))
		return nil, NewOAuthError(i18n.MsgOAuthGetUserErr, nil)
	}

	body, err := io.ReadAll(res.Body)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] GetUserInfo read body error: %s", p.config.Slug, err.Error()))
		return nil, err
	}

	bodyStr := string(body)
	logger.LogDebug(ctx, "[OAuth-Generic-%s] GetUserInfo response body: %s", p.config.Slug, bodyStr[:min(len(bodyStr), 500)])

	// Extract fields using gjson (supports JSONPath-like syntax)
	userId := gjson.Get(bodyStr, p.config.UserIdField).String()
	username := gjson.Get(bodyStr, p.config.UsernameField).String()
	displayName := gjson.Get(bodyStr, p.config.DisplayNameField).String()
	email := gjson.Get(bodyStr, p.config.EmailField).String()

	// If user ID field returns a number, convert it
	if userId == "" {
		// Try to get as number
		userIdNum := gjson.Get(bodyStr, p.config.UserIdField)
		if userIdNum.Exists() {
			userId = userIdNum.Raw
			// Remove quotes if present
			userId = strings.Trim(userId, "\"")
		}
	}

	if userId == "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Generic-%s] GetUserInfo failed: empty user ID (field: %s)", p.config.Slug, p.config.UserIdField))
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": p.config.Name})
	}

	logger.LogDebug(ctx, "[OAuth-Generic-%s] GetUserInfo success: id=%s, username=%s, name=%s, email=%s",
		p.config.Slug, userId, username, displayName, email)

	return &OAuthUser{
		ProviderUserID: userId,
		Username:       username,
		DisplayName:    displayName,
		Email:          email,
	}, nil
}

func (p *GenericOAuthProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsProviderUserIdTaken(p.config.Id, providerUserID)
}

func (p *GenericOAuthProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	foundUser, err := model.GetUserByOAuthBinding(p.config.Id, providerUserID)
	if err != nil {
		return err
	}
	*user = *foundUser
	return nil
}

func (p *GenericOAuthProvider) SetProviderUserID(user *model.User, providerUserID string) {
	// For generic providers, we store the binding in user_oauth_bindings table
	// This is handled separately in the OAuth controller
}

func (p *GenericOAuthProvider) GetProviderPrefix() string {
	return p.config.Slug + "_"
}

// GetProviderId returns the provider ID for binding purposes
func (p *GenericOAuthProvider) GetProviderId() int {
	return p.config.Id
}

// IsGenericProvider returns true for generic providers
func (p *GenericOAuthProvider) IsGenericProvider() bool {
	return true
}
