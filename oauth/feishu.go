package oauth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("feishu", &FeishuProvider{})
}

// FeishuProvider implements OAuth for Feishu (Lark).
//
// Feishu's OAuth flow differs from standard OAuth 2.0: the backend must first
// exchange app credentials for an app access token, then use that to exchange
// the user authorization code for a user access token.
type FeishuProvider struct{}

type feishuAppTokenRequest struct {
	AppId     string `json:"app_id"`
	AppSecret string `json:"app_secret"`
}

type feishuAppTokenResponse struct {
	Code           int    `json:"code"`
	Msg            string `json:"msg"`
	AppAccessToken string `json:"app_access_token"`
	Expire         int    `json:"expire"`
}

type feishuUserTokenRequest struct {
	GrantType string `json:"grant_type"`
	Code      string `json:"code"`
}

type feishuUserTokenResponse struct {
	Code        int    `json:"code"`
	Msg         string `json:"msg"`
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
}

type feishuUserInfo struct {
	Code   int    `json:"code"`
	Msg    string `json:"msg"`
	OpenId string `json:"open_id"`
	Name   string `json:"name"`
	EnName string `json:"en_name"`
	Email  string `json:"email"`
}

func (p *FeishuProvider) GetName() string {
	return "Feishu"
}

func (p *FeishuProvider) IsEnabled() bool {
	return system_setting.GetFeishuSettings().Enabled
}

func (p *FeishuProvider) ExchangeToken(ctx context.Context, code string, _ *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-Feishu] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	settings := system_setting.GetFeishuSettings()

	// Step 1: get app access token
	appToken, err := p.getAppAccessToken(ctx, settings.AppId, settings.AppSecret)
	if err != nil {
		return nil, err
	}

	// Step 2: exchange user code for user access token
	userToken, err := p.getUserAccessToken(ctx, appToken, code)
	if err != nil {
		return nil, err
	}

	return &OAuthToken{
		AccessToken: userToken,
		TokenType:   "Bearer",
	}, nil
}

func (p *FeishuProvider) getAppAccessToken(ctx context.Context, appId, appSecret string) (string, error) {
	body, err := json.Marshal(feishuAppTokenRequest{AppId: appId, AppSecret: appSecret})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
		bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] getAppAccessToken error: %s", err.Error()))
		return "", NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Feishu"}, err.Error())
	}
	defer res.Body.Close()

	var resp feishuAppTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return "", err
	}
	if resp.Code != 0 || resp.AppAccessToken == "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] getAppAccessToken failed: code=%d msg=%s", resp.Code, resp.Msg))
		return "", NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Feishu"})
	}

	return resp.AppAccessToken, nil
}

func (p *FeishuProvider) getUserAccessToken(ctx context.Context, appToken, userCode string) (string, error) {
	body, err := json.Marshal(feishuUserTokenRequest{GrantType: "authorization_code", Code: userCode})
	if err != nil {
		return "", err
	}

	req, err := http.NewRequestWithContext(ctx, "POST",
		"https://open.feishu.cn/open-apis/authen/v1/oidc/access_token",
		bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+appToken)

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] getUserAccessToken error: %s", err.Error()))
		return "", NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Feishu"}, err.Error())
	}
	defer res.Body.Close()

	var resp feishuUserTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&resp); err != nil {
		return "", err
	}
	if resp.Code != 0 || resp.AccessToken == "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] getUserAccessToken failed: code=%d msg=%s", resp.Code, resp.Msg))
		return "", NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Feishu"})
	}

	return resp.AccessToken, nil
}

func (p *FeishuProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	logger.LogDebug(ctx, "[OAuth-Feishu] GetUserInfo: fetching user info")

	req, err := http.NewRequestWithContext(ctx, "GET",
		"https://open.feishu.cn/open-apis/authen/v1/user_info", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token.AccessToken)

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Feishu"}, err.Error())
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo failed: status=%d body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "Feishu"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	var user feishuUserInfo
	if err := json.NewDecoder(res.Body).Decode(&user); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	if user.Code != 0 || user.OpenId == "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo failed: code=%d openId=%s", user.Code, user.OpenId))
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "Feishu"})
	}

	name := user.Name
	if name == "" {
		name = user.EnName
	}

	logger.LogDebug(ctx, "[OAuth-Feishu] GetUserInfo success: openId=%s name=%s", user.OpenId, name)

	return &OAuthUser{
		ProviderUserID: user.OpenId,
		Username:       name,
		DisplayName:    name,
		Email:          user.Email,
	}, nil
}

func (p *FeishuProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsFeishuIdAlreadyTaken(providerUserID)
}

func (p *FeishuProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.FeishuId = providerUserID
	return user.FillUserByFeishuId()
}

func (p *FeishuProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.FeishuId = providerUserID
}

func (p *FeishuProvider) GetProviderPrefix() string {
	return "feishu_"
}
