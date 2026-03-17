package controller

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/go-fuego/fuego"
)

func toCustomOAuthProviderResponse(p *model.CustomOAuthProvider) *dto.CustomOAuthProviderResponse {
	return &dto.CustomOAuthProviderResponse{
		Id:                    p.Id,
		Name:                  p.Name,
		Slug:                  p.Slug,
		Icon:                  p.Icon,
		Enabled:               p.Enabled,
		ClientId:              p.ClientId,
		AuthorizationEndpoint: p.AuthorizationEndpoint,
		TokenEndpoint:         p.TokenEndpoint,
		UserInfoEndpoint:      p.UserInfoEndpoint,
		Scopes:                p.Scopes,
		UserIdField:           p.UserIdField,
		UsernameField:         p.UsernameField,
		DisplayNameField:      p.DisplayNameField,
		EmailField:            p.EmailField,
		WellKnown:             p.WellKnown,
		AuthStyle:             p.AuthStyle,
		AccessPolicy:          p.AccessPolicy,
		AccessDeniedMessage:   p.AccessDeniedMessage,
	}
}

// GetCustomOAuthProviders returns all custom OAuth providers
func GetCustomOAuthProviders(c fuego.ContextNoBody) (*dto.Response[[]*dto.CustomOAuthProviderResponse], error) {
	providers, err := model.GetAllCustomOAuthProviders()
	if err != nil {
		return dto.Fail[[]*dto.CustomOAuthProviderResponse](err.Error())
	}

	response := make([]*dto.CustomOAuthProviderResponse, len(providers))
	for i, p := range providers {
		response[i] = toCustomOAuthProviderResponse(p)
	}

	return dto.Ok(response)
}

// GetCustomOAuthProvider returns a single custom OAuth provider by ID
func GetCustomOAuthProvider(c fuego.ContextNoBody) (*dto.Response[dto.CustomOAuthProviderResponse], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("无效的 ID")
	}

	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("未找到该 OAuth 提供商")
	}

	return dto.Ok(*toCustomOAuthProviderResponse(provider))
}

// FetchCustomOAuthDiscovery fetches OIDC discovery document via backend (root-only route)
func FetchCustomOAuthDiscovery(c fuego.ContextWithBody[dto.FetchCustomOAuthDiscoveryRequest]) (*dto.Response[dto.FetchDiscoveryData], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.FetchDiscoveryData]("无效的请求参数: " + err.Error())
	}

	wellKnownURL := strings.TrimSpace(req.WellKnownURL)
	issuerURL := strings.TrimSpace(req.IssuerURL)

	if wellKnownURL == "" && issuerURL == "" {
		return dto.Fail[dto.FetchDiscoveryData]("请先填写 Discovery URL 或 Issuer URL")
	}

	targetURL := wellKnownURL
	if targetURL == "" {
		targetURL = strings.TrimRight(issuerURL, "/") + "/.well-known/openid-configuration"
	}
	targetURL = strings.TrimSpace(targetURL)

	parsedURL, err := url.Parse(targetURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		return dto.Fail[dto.FetchDiscoveryData]("Discovery URL 无效，仅支持 http/https")
	}

	ctx, cancel := context.WithTimeout(dto.GinCtx(c).Request.Context(), 20*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return dto.Fail[dto.FetchDiscoveryData]("创建 Discovery 请求失败: " + err.Error())
	}
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return dto.Fail[dto.FetchDiscoveryData]("获取 Discovery 配置失败: " + err.Error())
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = resp.Status
		}
		return dto.Fail[dto.FetchDiscoveryData]("获取 Discovery 配置失败: " + message)
	}

	var discovery map[string]any
	if err = common.DecodeJson(resp.Body, &discovery); err != nil {
		return dto.Fail[dto.FetchDiscoveryData]("解析 Discovery 配置失败: " + err.Error())
	}

	return dto.Ok(dto.FetchDiscoveryData{
		WellKnownURL: targetURL,
		Discovery:    discovery,
	})
}

// CreateCustomOAuthProvider creates a new custom OAuth provider
func CreateCustomOAuthProvider(c fuego.ContextWithBody[dto.CreateCustomOAuthProviderRequest]) (*dto.Response[dto.CustomOAuthProviderResponse], error) {
	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("无效的请求参数: " + err.Error())
	}

	// Check if slug is already taken
	if model.IsSlugTaken(req.Slug, 0) {
		return dto.Fail[dto.CustomOAuthProviderResponse]("该 Slug 已被使用")
	}

	// Check if slug conflicts with built-in providers
	if oauth.IsProviderRegistered(req.Slug) && !oauth.IsCustomProvider(req.Slug) {
		return dto.Fail[dto.CustomOAuthProviderResponse]("该 Slug 与内置 OAuth 提供商冲突")
	}

	provider := &model.CustomOAuthProvider{
		Name:                  req.Name,
		Slug:                  req.Slug,
		Icon:                  req.Icon,
		Enabled:               req.Enabled,
		ClientId:              req.ClientId,
		ClientSecret:          req.ClientSecret,
		AuthorizationEndpoint: req.AuthorizationEndpoint,
		TokenEndpoint:         req.TokenEndpoint,
		UserInfoEndpoint:      req.UserInfoEndpoint,
		Scopes:                req.Scopes,
		UserIdField:           req.UserIdField,
		UsernameField:         req.UsernameField,
		DisplayNameField:      req.DisplayNameField,
		EmailField:            req.EmailField,
		WellKnown:             req.WellKnown,
		AuthStyle:             req.AuthStyle,
		AccessPolicy:          req.AccessPolicy,
		AccessDeniedMessage:   req.AccessDeniedMessage,
	}

	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse](err.Error())
	}

	// Register the provider in the OAuth registry
	oauth.RegisterOrUpdateCustomProvider(provider)

	return dto.OkMsg("创建成功", *toCustomOAuthProviderResponse(provider))
}

// UpdateCustomOAuthProvider updates an existing custom OAuth provider
func UpdateCustomOAuthProvider(c fuego.ContextWithBody[dto.UpdateCustomOAuthProviderRequest]) (*dto.Response[dto.CustomOAuthProviderResponse], error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("无效的 ID")
	}

	req, err := c.Body()
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("无效的请求参数: " + err.Error())
	}

	// Get existing provider
	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse]("未找到该 OAuth 提供商")
	}

	oldSlug := provider.Slug

	// Check if new slug is taken by another provider
	if req.Slug != "" && req.Slug != provider.Slug {
		if model.IsSlugTaken(req.Slug, id) {
			return dto.Fail[dto.CustomOAuthProviderResponse]("该 Slug 已被使用")
		}
		// Check if slug conflicts with built-in providers
		if oauth.IsProviderRegistered(req.Slug) && !oauth.IsCustomProvider(req.Slug) {
			return dto.Fail[dto.CustomOAuthProviderResponse]("该 Slug 与内置 OAuth 提供商冲突")
		}
	}

	// Update fields
	if req.Name != "" {
		provider.Name = req.Name
	}
	if req.Slug != "" {
		provider.Slug = req.Slug
	}
	if req.Icon != nil {
		provider.Icon = *req.Icon
	}
	if req.Enabled != nil {
		provider.Enabled = *req.Enabled
	}
	if req.ClientId != "" {
		provider.ClientId = req.ClientId
	}
	if req.ClientSecret != "" {
		provider.ClientSecret = req.ClientSecret
	}
	if req.AuthorizationEndpoint != "" {
		provider.AuthorizationEndpoint = req.AuthorizationEndpoint
	}
	if req.TokenEndpoint != "" {
		provider.TokenEndpoint = req.TokenEndpoint
	}
	if req.UserInfoEndpoint != "" {
		provider.UserInfoEndpoint = req.UserInfoEndpoint
	}
	if req.Scopes != "" {
		provider.Scopes = req.Scopes
	}
	if req.UserIdField != "" {
		provider.UserIdField = req.UserIdField
	}
	if req.UsernameField != "" {
		provider.UsernameField = req.UsernameField
	}
	if req.DisplayNameField != "" {
		provider.DisplayNameField = req.DisplayNameField
	}
	if req.EmailField != "" {
		provider.EmailField = req.EmailField
	}
	if req.WellKnown != nil {
		provider.WellKnown = *req.WellKnown
	}
	if req.AuthStyle != nil {
		provider.AuthStyle = *req.AuthStyle
	}
	if req.AccessPolicy != nil {
		provider.AccessPolicy = *req.AccessPolicy
	}
	if req.AccessDeniedMessage != nil {
		provider.AccessDeniedMessage = *req.AccessDeniedMessage
	}

	if err := model.UpdateCustomOAuthProvider(provider); err != nil {
		return dto.Fail[dto.CustomOAuthProviderResponse](err.Error())
	}

	// Update the provider in the OAuth registry
	if oldSlug != provider.Slug {
		oauth.UnregisterCustomProvider(oldSlug)
	}
	oauth.RegisterOrUpdateCustomProvider(provider)

	return dto.OkMsg("更新成功", *toCustomOAuthProviderResponse(provider))
}

// DeleteCustomOAuthProvider deletes a custom OAuth provider
func DeleteCustomOAuthProvider(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	id, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg("无效的 ID")
	}

	// Get existing provider to get slug
	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		return dto.FailMsg("未找到该 OAuth 提供商")
	}

	// Check if there are any user bindings
	count, err := model.GetBindingCountByProviderId(id)
	if err != nil {
		common.SysError("Failed to get binding count for provider " + strconv.Itoa(id) + ": " + err.Error())
		return dto.FailMsg("检查用户绑定时发生错误，请稍后重试")
	}
	if count > 0 {
		return dto.FailMsg("该 OAuth 提供商还有用户绑定，无法删除。请先解除所有用户绑定。")
	}

	if err := model.DeleteCustomOAuthProvider(id); err != nil {
		return dto.FailMsg(err.Error())
	}

	// Unregister the provider from the OAuth registry
	oauth.UnregisterCustomProvider(provider.Slug)

	return dto.Msg("删除成功")
}

func buildUserOAuthBindingsResponse(userId int) ([]dto.UserOAuthBindingResponse, error) {
	bindings, err := model.GetUserOAuthBindingsByUserId(userId)
	if err != nil {
		return nil, err
	}

	response := make([]dto.UserOAuthBindingResponse, 0, len(bindings))
	for _, binding := range bindings {
		provider, err := model.GetCustomOAuthProviderById(binding.ProviderId)
		if err != nil {
			continue
		}
		response = append(response, dto.UserOAuthBindingResponse{
			ProviderId:     binding.ProviderId,
			ProviderName:   provider.Name,
			ProviderSlug:   provider.Slug,
			ProviderIcon:   provider.Icon,
			ProviderUserId: binding.ProviderUserId,
		})
	}

	return response, nil
}

// GetUserOAuthBindings returns all OAuth bindings for the current user
func GetUserOAuthBindings(c fuego.ContextNoBody) (*dto.Response[[]dto.UserOAuthBindingResponse], error) {
	userId := dto.UserID(c)
	if userId == 0 {
		return dto.Fail[[]dto.UserOAuthBindingResponse]("未登录")
	}

	response, err := buildUserOAuthBindingsResponse(userId)
	if err != nil {
		return dto.Fail[[]dto.UserOAuthBindingResponse](err.Error())
	}

	return dto.Ok(response)
}

func GetUserOAuthBindingsByAdmin(c fuego.ContextNoBody) (*dto.Response[[]dto.UserOAuthBindingResponse], error) {
	userId, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.Fail[[]dto.UserOAuthBindingResponse]("invalid user id")
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		return dto.Fail[[]dto.UserOAuthBindingResponse](err.Error())
	}

	myRole := dto.UserRole(c)
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		return dto.Fail[[]dto.UserOAuthBindingResponse]("no permission")
	}

	response, err := buildUserOAuthBindingsResponse(userId)
	if err != nil {
		return dto.Fail[[]dto.UserOAuthBindingResponse](err.Error())
	}

	return dto.Ok(response)
}

// UnbindCustomOAuth unbinds a custom OAuth provider from the current user
func UnbindCustomOAuth(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	userId := dto.UserID(c)
	if userId == 0 {
		return dto.FailMsg("未登录")
	}

	providerId, err := c.PathParamIntErr("provider_id")
	if err != nil {
		return dto.FailMsg("无效的提供商 ID")
	}

	if err := model.DeleteUserOAuthBinding(userId, providerId); err != nil {
		return dto.FailMsg(err.Error())
	}

	return dto.Msg("解绑成功")
}

func UnbindCustomOAuthByAdmin(c fuego.ContextNoBody) (dto.MessageResponse, error) {
	userId, err := c.PathParamIntErr("id")
	if err != nil {
		return dto.FailMsg("invalid user id")
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		return dto.FailMsg(err.Error())
	}

	myRole := dto.UserRole(c)
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		return dto.FailMsg("no permission")
	}

	providerId, err := c.PathParamIntErr("provider_id")
	if err != nil {
		return dto.FailMsg("invalid provider id")
	}

	if err := model.DeleteUserOAuthBinding(userId, providerId); err != nil {
		return dto.FailMsg(err.Error())
	}

	return dto.Msg("success")
}
