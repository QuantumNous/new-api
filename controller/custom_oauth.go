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
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/oauth"
	"github.com/gin-gonic/gin"
)

// CustomOAuthProviderResponse is the response structure for custom OAuth providers
// It excludes sensitive fields like client_secret
type CustomOAuthProviderResponse struct {
	Id                         int    `json:"id"`
	Name                       string `json:"name"`
	Slug                       string `json:"slug"`
	Icon                       string `json:"icon"`
	Kind                       string `json:"kind"`
	Enabled                    bool   `json:"enabled"`
	ClientId                   string `json:"client_id"`
	AuthorizationEndpoint      string `json:"authorization_endpoint"`
	TokenEndpoint              string `json:"token_endpoint"`
	UserInfoEndpoint           string `json:"user_info_endpoint"`
	Scopes                     string `json:"scopes"`
	Issuer                     string `json:"issuer"`
	Audience                   string `json:"audience"`
	JwksURL                    string `json:"jwks_url"`
	PublicKey                  string `json:"public_key"`
	JWTSource                  string `json:"jwt_source"`
	JWTHeader                  string `json:"jwt_header"`
	JWTIdentityMode            string `json:"jwt_identity_mode"`
	JWTAcquireMode             string `json:"jwt_acquire_mode"`
	AuthorizationServiceField  string `json:"authorization_service_field"`
	TicketExchangeURL          string `json:"ticket_exchange_url"`
	TicketExchangeMethod       string `json:"ticket_exchange_method"`
	TicketExchangePayloadMode  string `json:"ticket_exchange_payload_mode"`
	TicketExchangeTicketField  string `json:"ticket_exchange_ticket_field"`
	TicketExchangeTokenField   string `json:"ticket_exchange_token_field"`
	TicketExchangeServiceField string `json:"ticket_exchange_service_field"`
	UserIdField                string `json:"user_id_field"`
	UsernameField              string `json:"username_field"`
	DisplayNameField           string `json:"display_name_field"`
	EmailField                 string `json:"email_field"`
	GroupField                 string `json:"group_field"`
	RoleField                  string `json:"role_field"`
	GroupMapping               string `json:"group_mapping"`
	RoleMapping                string `json:"role_mapping"`
	AutoRegister               bool   `json:"auto_register"`
	AutoMergeByEmail           bool   `json:"auto_merge_by_email"`
	SyncGroupOnLogin           bool   `json:"sync_group_on_login"`
	SyncRoleOnLogin            bool   `json:"sync_role_on_login"`
	GroupMappingMode           string `json:"group_mapping_mode"`
	RoleMappingMode            string `json:"role_mapping_mode"`
	WellKnown                  string `json:"well_known"`
	AuthStyle                  int    `json:"auth_style"`
	AccessPolicy               string `json:"access_policy"`
	AccessDeniedMessage        string `json:"access_denied_message"`
}

type UserOAuthBindingResponse struct {
	ProviderId     int    `json:"provider_id"`
	ProviderName   string `json:"provider_name"`
	ProviderSlug   string `json:"provider_slug"`
	ProviderIcon   string `json:"provider_icon"`
	ProviderUserId string `json:"provider_user_id"`
}

func toCustomOAuthProviderResponse(p *model.CustomOAuthProvider) *CustomOAuthProviderResponse {
	jwtSource := p.JWTSource
	if strings.TrimSpace(jwtSource) == "" {
		jwtSource = model.CustomJWTSourceQuery
	}
	authorizationServiceField := p.AuthorizationServiceField
	if strings.TrimSpace(authorizationServiceField) == "" {
		authorizationServiceField = "service"
	}
	ticketExchangeMethod := p.TicketExchangeMethod
	if strings.TrimSpace(ticketExchangeMethod) == "" {
		ticketExchangeMethod = model.CustomTicketExchangeMethodGET
	}
	ticketExchangePayloadMode := p.TicketExchangePayloadMode
	if strings.TrimSpace(ticketExchangePayloadMode) == "" {
		ticketExchangePayloadMode = model.CustomTicketExchangePayloadModeQuery
	}
	ticketExchangeTicketField := p.TicketExchangeTicketField
	if strings.TrimSpace(ticketExchangeTicketField) == "" {
		ticketExchangeTicketField = "ticket"
	}
	return &CustomOAuthProviderResponse{
		Id:                         p.Id,
		Name:                       p.Name,
		Slug:                       p.Slug,
		Icon:                       p.Icon,
		Kind:                       p.GetKind(),
		Enabled:                    p.Enabled,
		ClientId:                   p.ClientId,
		AuthorizationEndpoint:      p.AuthorizationEndpoint,
		TokenEndpoint:              p.TokenEndpoint,
		UserInfoEndpoint:           p.UserInfoEndpoint,
		Scopes:                     p.Scopes,
		Issuer:                     p.Issuer,
		Audience:                   p.Audience,
		JwksURL:                    p.JwksURL,
		PublicKey:                  p.PublicKey,
		JWTSource:                  jwtSource,
		JWTHeader:                  p.JWTHeader,
		JWTIdentityMode:            p.GetJWTIdentityMode(),
		JWTAcquireMode:             p.GetJWTAcquireMode(),
		AuthorizationServiceField:  authorizationServiceField,
		TicketExchangeURL:          p.TicketExchangeURL,
		TicketExchangeMethod:       ticketExchangeMethod,
		TicketExchangePayloadMode:  ticketExchangePayloadMode,
		TicketExchangeTicketField:  ticketExchangeTicketField,
		TicketExchangeTokenField:   p.TicketExchangeTokenField,
		TicketExchangeServiceField: p.TicketExchangeServiceField,
		UserIdField:                p.UserIdField,
		UsernameField:              p.UsernameField,
		DisplayNameField:           p.DisplayNameField,
		EmailField:                 p.EmailField,
		GroupField:                 p.GroupField,
		RoleField:                  p.RoleField,
		GroupMapping:               p.GroupMapping,
		RoleMapping:                p.RoleMapping,
		AutoRegister:               p.AutoRegister,
		AutoMergeByEmail:           p.AutoMergeByEmail,
		SyncGroupOnLogin:           p.SyncGroupOnLogin,
		SyncRoleOnLogin:            p.SyncRoleOnLogin,
		GroupMappingMode:           p.GroupMappingMode,
		RoleMappingMode:            p.RoleMappingMode,
		WellKnown:                  p.WellKnown,
		AuthStyle:                  p.AuthStyle,
		AccessPolicy:               p.AccessPolicy,
		AccessDeniedMessage:        p.AccessDeniedMessage,
	}
}

// GetCustomOAuthProviders returns all custom OAuth providers
func GetCustomOAuthProviders(c *gin.Context) {
	providers, err := model.GetAllCustomOAuthProviders()
	if err != nil {
		common.ApiError(c, err)
		return
	}

	response := make([]*CustomOAuthProviderResponse, len(providers))
	for i, p := range providers {
		response[i] = toCustomOAuthProviderResponse(p)
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    response,
	})
}

// GetCustomOAuthProvider returns a single custom OAuth provider by ID
func GetCustomOAuthProvider(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}

	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "未找到该 OAuth 提供商")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    toCustomOAuthProviderResponse(provider),
	})
}

// CreateCustomOAuthProviderRequest is the request structure for creating a custom OAuth provider
type CreateCustomOAuthProviderRequest struct {
	Name                       string `json:"name" binding:"required"`
	Slug                       string `json:"slug" binding:"required"`
	Icon                       string `json:"icon"`
	Kind                       string `json:"kind"`
	Enabled                    bool   `json:"enabled"`
	ClientId                   string `json:"client_id"`
	ClientSecret               string `json:"client_secret"`
	AuthorizationEndpoint      string `json:"authorization_endpoint"`
	TokenEndpoint              string `json:"token_endpoint"`
	UserInfoEndpoint           string `json:"user_info_endpoint"`
	Scopes                     string `json:"scopes"`
	Issuer                     string `json:"issuer"`
	Audience                   string `json:"audience"`
	JwksURL                    string `json:"jwks_url"`
	PublicKey                  string `json:"public_key"`
	JWTSource                  string `json:"jwt_source"`
	JWTHeader                  string `json:"jwt_header"`
	JWTIdentityMode            string `json:"jwt_identity_mode"`
	JWTAcquireMode             string `json:"jwt_acquire_mode"`
	AuthorizationServiceField  string `json:"authorization_service_field"`
	TicketExchangeURL          string `json:"ticket_exchange_url"`
	TicketExchangeMethod       string `json:"ticket_exchange_method"`
	TicketExchangePayloadMode  string `json:"ticket_exchange_payload_mode"`
	TicketExchangeTicketField  string `json:"ticket_exchange_ticket_field"`
	TicketExchangeTokenField   string `json:"ticket_exchange_token_field"`
	TicketExchangeServiceField string `json:"ticket_exchange_service_field"`
	TicketExchangeExtraParams  string `json:"ticket_exchange_extra_params"`
	TicketExchangeHeaders      string `json:"ticket_exchange_headers"`
	UserIdField                string `json:"user_id_field"`
	UsernameField              string `json:"username_field"`
	DisplayNameField           string `json:"display_name_field"`
	EmailField                 string `json:"email_field"`
	GroupField                 string `json:"group_field"`
	RoleField                  string `json:"role_field"`
	GroupMapping               string `json:"group_mapping"`
	RoleMapping                string `json:"role_mapping"`
	AutoRegister               bool   `json:"auto_register"`
	AutoMergeByEmail           bool   `json:"auto_merge_by_email"`
	SyncGroupOnLogin           bool   `json:"sync_group_on_login"`
	SyncRoleOnLogin            bool   `json:"sync_role_on_login"`
	GroupMappingMode           string `json:"group_mapping_mode"`
	RoleMappingMode            string `json:"role_mapping_mode"`
	WellKnown                  string `json:"well_known"`
	AuthStyle                  int    `json:"auth_style"`
	AccessPolicy               string `json:"access_policy"`
	AccessDeniedMessage        string `json:"access_denied_message"`
}

type FetchCustomOAuthDiscoveryRequest struct {
	WellKnownURL string `json:"well_known_url"`
	IssuerURL    string `json:"issuer_url"`
}

// FetchCustomOAuthDiscovery fetches OIDC discovery document via backend (root-only route)
func FetchCustomOAuthDiscovery(c *gin.Context) {
	var req FetchCustomOAuthDiscoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}

	wellKnownURL := strings.TrimSpace(req.WellKnownURL)
	issuerURL := strings.TrimSpace(req.IssuerURL)

	if wellKnownURL == "" && issuerURL == "" {
		common.ApiErrorMsg(c, "请先填写 Discovery URL 或 Issuer URL")
		return
	}

	targetURL := wellKnownURL
	if targetURL == "" {
		targetURL = strings.TrimRight(issuerURL, "/") + "/.well-known/openid-configuration"
	}
	targetURL = strings.TrimSpace(targetURL)

	parsedURL, err := url.Parse(targetURL)
	if err != nil || parsedURL.Host == "" || (parsedURL.Scheme != "http" && parsedURL.Scheme != "https") {
		common.ApiErrorMsg(c, "Discovery URL 无效，仅支持 http/https")
		return
	}

	ctx, cancel := context.WithTimeout(c.Request.Context(), 20*time.Second)
	defer cancel()

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		common.ApiErrorMsg(c, "创建 Discovery 请求失败: "+err.Error())
		return
	}
	httpReq.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: 20 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		common.ApiErrorMsg(c, "获取 Discovery 配置失败: "+err.Error())
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		message := strings.TrimSpace(string(body))
		if message == "" {
			message = resp.Status
		}
		common.ApiErrorMsg(c, "获取 Discovery 配置失败: "+message)
		return
	}

	var discovery map[string]any
	if err = common.DecodeJson(resp.Body, &discovery); err != nil {
		common.ApiErrorMsg(c, "解析 Discovery 配置失败: "+err.Error())
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"well_known_url": targetURL,
			"discovery":      discovery,
		},
	})
}

// CreateCustomOAuthProvider creates a new custom OAuth provider
func CreateCustomOAuthProvider(c *gin.Context) {
	var req CreateCustomOAuthProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}

	// Check if slug is already taken
	if model.IsSlugTaken(req.Slug, 0) {
		common.ApiErrorMsg(c, "该 Slug 已被使用")
		return
	}

	// Check if slug conflicts with built-in providers
	if oauth.IsProviderRegistered(req.Slug) && !oauth.IsCustomProvider(req.Slug) {
		common.ApiErrorMsg(c, "该 Slug 与内置 OAuth 提供商冲突")
		return
	}

	provider := &model.CustomOAuthProvider{
		Name:                       req.Name,
		Slug:                       req.Slug,
		Icon:                       req.Icon,
		Kind:                       req.Kind,
		Enabled:                    req.Enabled,
		ClientId:                   req.ClientId,
		ClientSecret:               req.ClientSecret,
		AuthorizationEndpoint:      req.AuthorizationEndpoint,
		TokenEndpoint:              req.TokenEndpoint,
		UserInfoEndpoint:           req.UserInfoEndpoint,
		Scopes:                     req.Scopes,
		Issuer:                     req.Issuer,
		Audience:                   req.Audience,
		JwksURL:                    req.JwksURL,
		PublicKey:                  req.PublicKey,
		JWTSource:                  req.JWTSource,
		JWTHeader:                  req.JWTHeader,
		JWTIdentityMode:            req.JWTIdentityMode,
		JWTAcquireMode:             req.JWTAcquireMode,
		AuthorizationServiceField:  req.AuthorizationServiceField,
		TicketExchangeURL:          req.TicketExchangeURL,
		TicketExchangeMethod:       req.TicketExchangeMethod,
		TicketExchangePayloadMode:  req.TicketExchangePayloadMode,
		TicketExchangeTicketField:  req.TicketExchangeTicketField,
		TicketExchangeTokenField:   req.TicketExchangeTokenField,
		TicketExchangeServiceField: req.TicketExchangeServiceField,
		TicketExchangeExtraParams:  req.TicketExchangeExtraParams,
		TicketExchangeHeaders:      req.TicketExchangeHeaders,
		UserIdField:                req.UserIdField,
		UsernameField:              req.UsernameField,
		DisplayNameField:           req.DisplayNameField,
		EmailField:                 req.EmailField,
		GroupField:                 req.GroupField,
		RoleField:                  req.RoleField,
		GroupMapping:               req.GroupMapping,
		RoleMapping:                req.RoleMapping,
		AutoRegister:               req.AutoRegister,
		AutoMergeByEmail:           req.AutoMergeByEmail,
		SyncGroupOnLogin:           req.SyncGroupOnLogin,
		SyncRoleOnLogin:            req.SyncRoleOnLogin,
		GroupMappingMode:           req.GroupMappingMode,
		RoleMappingMode:            req.RoleMappingMode,
		WellKnown:                  req.WellKnown,
		AuthStyle:                  req.AuthStyle,
		AccessPolicy:               req.AccessPolicy,
		AccessDeniedMessage:        req.AccessDeniedMessage,
	}

	if err := model.CreateCustomOAuthProvider(provider); err != nil {
		common.ApiError(c, err)
		return
	}

	// Register the provider in the OAuth registry
	oauth.RegisterOrUpdateCustomProvider(provider)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "创建成功",
		"data":    toCustomOAuthProviderResponse(provider),
	})
}

// UpdateCustomOAuthProviderRequest is the request structure for updating a custom OAuth provider
type UpdateCustomOAuthProviderRequest struct {
	Name                       *string `json:"name"`
	Slug                       *string `json:"slug"`
	Icon                       *string `json:"icon"`    // Optional: if nil, keep existing
	Enabled                    *bool   `json:"enabled"` // Optional: if nil, keep existing
	Kind                       *string `json:"kind"`
	ClientId                   *string `json:"client_id"`
	ClientSecret               *string `json:"client_secret"`
	AuthorizationEndpoint      *string `json:"authorization_endpoint"`
	TokenEndpoint              *string `json:"token_endpoint"`
	UserInfoEndpoint           *string `json:"user_info_endpoint"`
	Scopes                     *string `json:"scopes"`
	Issuer                     *string `json:"issuer"`
	Audience                   *string `json:"audience"`
	JwksURL                    *string `json:"jwks_url"`
	PublicKey                  *string `json:"public_key"`
	JWTSource                  *string `json:"jwt_source"`
	JWTHeader                  *string `json:"jwt_header"`
	JWTIdentityMode            *string `json:"jwt_identity_mode"`
	JWTAcquireMode             *string `json:"jwt_acquire_mode"`
	AuthorizationServiceField  *string `json:"authorization_service_field"`
	TicketExchangeURL          *string `json:"ticket_exchange_url"`
	TicketExchangeMethod       *string `json:"ticket_exchange_method"`
	TicketExchangePayloadMode  *string `json:"ticket_exchange_payload_mode"`
	TicketExchangeTicketField  *string `json:"ticket_exchange_ticket_field"`
	TicketExchangeTokenField   *string `json:"ticket_exchange_token_field"`
	TicketExchangeServiceField *string `json:"ticket_exchange_service_field"`
	TicketExchangeExtraParams  *string `json:"ticket_exchange_extra_params"`
	TicketExchangeHeaders      *string `json:"ticket_exchange_headers"`
	UserIdField                *string `json:"user_id_field"`
	UsernameField              *string `json:"username_field"`
	DisplayNameField           *string `json:"display_name_field"`
	EmailField                 *string `json:"email_field"`
	GroupField                 *string `json:"group_field"`
	RoleField                  *string `json:"role_field"`
	GroupMapping               *string `json:"group_mapping"`
	RoleMapping                *string `json:"role_mapping"`
	AutoRegister               *bool   `json:"auto_register"`
	AutoMergeByEmail           *bool   `json:"auto_merge_by_email"`
	SyncGroupOnLogin           *bool   `json:"sync_group_on_login"`
	SyncRoleOnLogin            *bool   `json:"sync_role_on_login"`
	GroupMappingMode           *string `json:"group_mapping_mode"`
	RoleMappingMode            *string `json:"role_mapping_mode"`
	WellKnown                  *string `json:"well_known"`            // Optional: if nil, keep existing
	AuthStyle                  *int    `json:"auth_style"`            // Optional: if nil, keep existing
	AccessPolicy               *string `json:"access_policy"`         // Optional: if nil, keep existing
	AccessDeniedMessage        *string `json:"access_denied_message"` // Optional: if nil, keep existing
}

// UpdateCustomOAuthProvider updates an existing custom OAuth provider
func UpdateCustomOAuthProvider(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}

	var req UpdateCustomOAuthProviderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "无效的请求参数: "+err.Error())
		return
	}

	// Get existing provider
	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "未找到该 OAuth 提供商")
		return
	}

	oldSlug := provider.Slug

	// Check if new slug is taken by another provider
	if req.Slug != nil && *req.Slug != provider.Slug {
		if model.IsSlugTaken(*req.Slug, id) {
			common.ApiErrorMsg(c, "该 Slug 已被使用")
			return
		}
		// Check if slug conflicts with built-in providers
		if oauth.IsProviderRegistered(*req.Slug) && !oauth.IsCustomProvider(*req.Slug) {
			common.ApiErrorMsg(c, "该 Slug 与内置 OAuth 提供商冲突")
			return
		}
	}

	// Update fields
	if req.Name != nil {
		provider.Name = *req.Name
	}
	if req.Slug != nil {
		provider.Slug = *req.Slug
	}
	if req.Icon != nil {
		provider.Icon = *req.Icon
	}
	if req.Enabled != nil {
		provider.Enabled = *req.Enabled
	}
	if req.Kind != nil {
		provider.Kind = *req.Kind
	}
	if req.ClientId != nil {
		provider.ClientId = *req.ClientId
	}
	if req.ClientSecret != nil {
		provider.ClientSecret = *req.ClientSecret
	}
	if req.AuthorizationEndpoint != nil {
		provider.AuthorizationEndpoint = *req.AuthorizationEndpoint
	}
	if req.TokenEndpoint != nil {
		provider.TokenEndpoint = *req.TokenEndpoint
	}
	if req.UserInfoEndpoint != nil {
		provider.UserInfoEndpoint = *req.UserInfoEndpoint
	}
	if req.Scopes != nil {
		provider.Scopes = *req.Scopes
	}
	if req.Issuer != nil {
		provider.Issuer = *req.Issuer
	}
	if req.Audience != nil {
		provider.Audience = *req.Audience
	}
	if req.JwksURL != nil {
		provider.JwksURL = *req.JwksURL
	}
	if req.PublicKey != nil {
		provider.PublicKey = *req.PublicKey
	}
	if req.JWTSource != nil {
		provider.JWTSource = *req.JWTSource
	}
	if req.JWTHeader != nil {
		provider.JWTHeader = *req.JWTHeader
	}
	if req.JWTIdentityMode != nil {
		provider.JWTIdentityMode = *req.JWTIdentityMode
	}
	if req.JWTAcquireMode != nil {
		provider.JWTAcquireMode = *req.JWTAcquireMode
	}
	if req.AuthorizationServiceField != nil {
		provider.AuthorizationServiceField = *req.AuthorizationServiceField
	}
	if req.TicketExchangeURL != nil {
		provider.TicketExchangeURL = *req.TicketExchangeURL
	}
	if req.TicketExchangeMethod != nil {
		provider.TicketExchangeMethod = *req.TicketExchangeMethod
	}
	if req.TicketExchangePayloadMode != nil {
		provider.TicketExchangePayloadMode = *req.TicketExchangePayloadMode
	}
	if req.TicketExchangeTicketField != nil {
		provider.TicketExchangeTicketField = *req.TicketExchangeTicketField
	}
	if req.TicketExchangeTokenField != nil {
		provider.TicketExchangeTokenField = *req.TicketExchangeTokenField
	}
	if req.TicketExchangeServiceField != nil {
		provider.TicketExchangeServiceField = *req.TicketExchangeServiceField
	}
	if req.TicketExchangeExtraParams != nil {
		provider.TicketExchangeExtraParams = *req.TicketExchangeExtraParams
	}
	if req.TicketExchangeHeaders != nil {
		provider.TicketExchangeHeaders = *req.TicketExchangeHeaders
	}
	if req.UserIdField != nil {
		provider.UserIdField = *req.UserIdField
	}
	if req.UsernameField != nil {
		provider.UsernameField = *req.UsernameField
	}
	if req.DisplayNameField != nil {
		provider.DisplayNameField = *req.DisplayNameField
	}
	if req.EmailField != nil {
		provider.EmailField = *req.EmailField
	}
	if req.GroupField != nil {
		provider.GroupField = *req.GroupField
	}
	if req.RoleField != nil {
		provider.RoleField = *req.RoleField
	}
	if req.GroupMapping != nil {
		provider.GroupMapping = *req.GroupMapping
	}
	if req.RoleMapping != nil {
		provider.RoleMapping = *req.RoleMapping
	}
	if req.AutoRegister != nil {
		provider.AutoRegister = *req.AutoRegister
	}
	if req.AutoMergeByEmail != nil {
		provider.AutoMergeByEmail = *req.AutoMergeByEmail
	}
	if req.SyncGroupOnLogin != nil {
		provider.SyncGroupOnLogin = *req.SyncGroupOnLogin
	}
	if req.SyncRoleOnLogin != nil {
		provider.SyncRoleOnLogin = *req.SyncRoleOnLogin
	}
	if req.GroupMappingMode != nil {
		provider.GroupMappingMode = *req.GroupMappingMode
	}
	if req.RoleMappingMode != nil {
		provider.RoleMappingMode = *req.RoleMappingMode
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
		common.ApiError(c, err)
		return
	}

	// Update the provider in the OAuth registry
	if oldSlug != provider.Slug {
		oauth.UnregisterCustomProvider(oldSlug)
	}
	oauth.RegisterOrUpdateCustomProvider(provider)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "更新成功",
		"data":    toCustomOAuthProviderResponse(provider),
	})
}

// DeleteCustomOAuthProvider deletes a custom OAuth provider
func DeleteCustomOAuthProvider(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的 ID")
		return
	}

	// Get existing provider to get slug
	provider, err := model.GetCustomOAuthProviderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "未找到该 OAuth 提供商")
		return
	}

	// Check if there are any user bindings
	count, err := model.GetBindingCountByProviderId(id)
	if err != nil {
		common.SysError("Failed to get binding count for provider " + strconv.Itoa(id) + ": " + err.Error())
		common.ApiErrorMsg(c, "检查用户绑定时发生错误，请稍后重试")
		return
	}
	if count > 0 {
		common.ApiErrorMsg(c, "该 OAuth 提供商还有用户绑定，无法删除。请先解除所有用户绑定。")
		return
	}

	if err := model.DeleteCustomOAuthProvider(id); err != nil {
		common.ApiError(c, err)
		return
	}

	// Unregister the provider from the OAuth registry
	oauth.UnregisterCustomProvider(provider.Slug)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "删除成功",
	})
}

func buildUserOAuthBindingsResponse(userId int) ([]UserOAuthBindingResponse, error) {
	bindings, err := model.GetUserOAuthBindingsByUserId(userId)
	if err != nil {
		return nil, err
	}

	response := make([]UserOAuthBindingResponse, 0, len(bindings))
	for _, binding := range bindings {
		provider, err := model.GetCustomOAuthProviderById(binding.ProviderId)
		if err != nil {
			continue
		}
		response = append(response, UserOAuthBindingResponse{
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
func GetUserOAuthBindings(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	response, err := buildUserOAuthBindingsResponse(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    response,
	})
}

func GetUserOAuthBindingsByAdmin(c *gin.Context) {
	userIdStr := c.Param("id")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	response, err := buildUserOAuthBindingsResponse(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    response,
	})
}

// UnbindCustomOAuth unbinds a custom OAuth provider from the current user
func UnbindCustomOAuth(c *gin.Context) {
	userId := c.GetInt("id")
	if userId == 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	providerIdStr := c.Param("provider_id")
	providerId, err := strconv.Atoi(providerIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "无效的提供商 ID")
		return
	}

	if err := model.DeleteUserOAuthBinding(userId, providerId); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "解绑成功",
	})
}

func UnbindCustomOAuthByAdmin(c *gin.Context) {
	userIdStr := c.Param("id")
	userId, err := strconv.Atoi(userIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid user id")
		return
	}

	targetUser, err := model.GetUserById(userId, false)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	myRole := c.GetInt("role")
	if myRole <= targetUser.Role && myRole != common.RoleRootUser {
		common.ApiErrorMsg(c, "no permission")
		return
	}

	providerIdStr := c.Param("provider_id")
	providerId, err := strconv.Atoi(providerIdStr)
	if err != nil {
		common.ApiErrorMsg(c, "invalid provider id")
		return
	}

	if err := model.DeleteUserOAuthBinding(userId, providerId); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "success",
	})
}
