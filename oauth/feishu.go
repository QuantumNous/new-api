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

type FeishuProvider struct{}

type feishuTokenResponse struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int    `json:"expires_in"`
	Scope       string `json:"scope,omitempty"`
}

type feishuTokenError struct {
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

type feishuUserInfoResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		OpenID    string `json:"open_id"`
		UnionID   string `json:"union_id"`
		Name      string `json:"name"`
		AvatarURL string `json:"avatar_url"`
		Email     string `json:"email"`
		UserID    string `json:"user_id"`
		Mobile    string `json:"mobile"`
	} `json:"data"`
}

func (p *FeishuProvider) GetName() string {
	return "Feishu"
}

func (p *FeishuProvider) IsEnabled() bool {
	return system_setting.GetFeishuSettings().Enabled
}

func (p *FeishuProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-Feishu] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	settings := system_setting.GetFeishuSettings()
	if settings.AppID == "" || settings.AppSecret == "" {
		return nil, NewOAuthError(i18n.MsgOAuthNotEnabled, map[string]any{"Provider": "Feishu"})
	}

	payload := map[string]string{
		"grant_type":    "authorization_code",
		"client_id":     settings.AppID,
		"client_secret": settings.AppSecret,
		"code":          code,
		"redirect_uri":  fmt.Sprintf("%s/oauth/feishu", system_setting.ServerAddress),
	}
	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequestWithContext(ctx, "POST", "https://open.feishu.cn/open-apis/authen/v2/oauth/token", bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")

	client := http.Client{
		Timeout: 20 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Feishu"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Feishu] ExchangeToken response status: %d", res.StatusCode)

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	bodyStr := string(body)
	if len(bodyStr) > 500 {
		bodyStr = bodyStr[:500] + "..."
	}
	logger.LogDebug(ctx, "[OAuth-Feishu] ExchangeToken response body: %s", bodyStr)

	var tokenErr feishuTokenError
	if err := json.Unmarshal(body, &tokenErr); err == nil && tokenErr.Error != "" {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] ExchangeToken failed: error=%s, desc=%s", tokenErr.Error, tokenErr.ErrorDescription))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Feishu"}, tokenErr.ErrorDescription)
	}

	var rawRes struct {
		Code        int    `json:"code"`
		AccessToken string `json:"access_token"`
		TokenType   string `json:"token_type"`
		ExpiresIn   int    `json:"expires_in"`
		Scope       string `json:"scope"`
		Error       string `json:"error"`
		ErrorDesc   string `json:"error_description"`
	}
	if err := json.Unmarshal(body, &rawRes); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if rawRes.Code != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] ExchangeToken failed: code=%d, error=%s, desc=%s", rawRes.Code, rawRes.Error, rawRes.ErrorDesc))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Feishu"}, fmt.Sprintf("code=%d, %s", rawRes.Code, rawRes.ErrorDesc))
	}

	if rawRes.AccessToken == "" {
		logger.LogError(ctx, "[OAuth-Feishu] ExchangeToken failed: empty access token")
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "Feishu"})
	}

	logger.LogDebug(ctx, "[OAuth-Feishu] ExchangeToken success")

	return &OAuthToken{
		AccessToken: rawRes.AccessToken,
		TokenType:   rawRes.TokenType,
		ExpiresIn:   rawRes.ExpiresIn,
		Scope:       rawRes.Scope,
	}, nil
}

func (p *FeishuProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	logger.LogDebug(ctx, "[OAuth-Feishu] GetUserInfo: fetching user info")

	req, err := http.NewRequestWithContext(ctx, "GET", "https://open.feishu.cn/open-apis/authen/v1/user_info", nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", token.AccessToken))

	client := http.Client{
		Timeout: 20 * time.Second,
	}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "Feishu"}, err.Error())
	}
	defer res.Body.Close()

	logger.LogDebug(ctx, "[OAuth-Feishu] GetUserInfo response status: %d", res.StatusCode)

	body, err := io.ReadAll(res.Body)
	if err != nil {
		return nil, err
	}

	if res.StatusCode != http.StatusOK {
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "Feishu"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	var userInfoRes feishuUserInfoResponse
	if err := json.Unmarshal(body, &userInfoRes); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	if userInfoRes.Code != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-Feishu] GetUserInfo API error: code=%d, msg=%s", userInfoRes.Code, userInfoRes.Msg))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "Feishu"}, userInfoRes.Msg)
	}

	data := userInfoRes.Data
	if data.OpenID == "" {
		logger.LogError(ctx, "[OAuth-Feishu] GetUserInfo failed: empty open_id")
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "Feishu"})
	}

	logger.LogDebug(ctx, "[OAuth-Feishu] GetUserInfo success: open_id=%s, union_id=%s, name=%s, email=%s",
		data.OpenID, data.UnionID, data.Name, data.Email)

	return &OAuthUser{
		ProviderUserID: data.OpenID,
		Username:       data.Name,
		DisplayName:    data.Name,
		Email:          data.Email,
		Extra: map[string]any{
			"union_id":   data.UnionID,
			"avatar_url": data.AvatarURL,
			"user_id":    data.UserID,
			"mobile":     data.Mobile,
		},
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

func GetFeishuDefaultGroup() string {
	return system_setting.GetFeishuSettings().DefaultGroup
}

func GetFeishuAuthPolicy() string {
	return system_setting.GetFeishuSettings().AuthPolicy
}

func IsFeishuOnly() bool {
	return system_setting.GetFeishuSettings().AuthPolicy == "feishu_only"
}
