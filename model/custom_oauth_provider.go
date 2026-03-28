package model

import (
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	CustomOAuthProviderKindOAuthCode     = "oauth_code"
	CustomOAuthProviderKindJWTDirect     = "jwt_direct"
	CustomOAuthProviderKindTrustedHeader = "trusted_header"
)

const (
	CustomJWTSourceQuery    = "query"
	CustomJWTSourceFragment = "fragment"
	CustomJWTSourceBody     = "body"
)

const (
	CustomOAuthMappingModeExplicitOnly = "explicit_only"
	CustomOAuthMappingModeMappingFirst = "mapping_first"
)

const (
	CustomJWTAcquireModeDirectToken    = "direct_token"
	CustomJWTAcquireModeTicketExchange = "ticket_exchange"
	CustomJWTAcquireModeTicketValidate = "ticket_validate"
)

const (
	CustomJWTIdentityModeClaims   = "claims"
	CustomJWTIdentityModeUserInfo = "userinfo"
)

const (
	CustomTicketExchangeMethodGET  = "GET"
	CustomTicketExchangeMethodPOST = "POST"
)

const (
	CustomTicketExchangePayloadModeQuery     = "query"
	CustomTicketExchangePayloadModeForm      = "form"
	CustomTicketExchangePayloadModeJSON      = "json"
	CustomTicketExchangePayloadModeMultipart = "multipart"
)

type accessPolicyPayload struct {
	Logic      string                `json:"logic"`
	Conditions []accessConditionItem `json:"conditions"`
	Groups     []accessPolicyPayload `json:"groups"`
}

type accessConditionItem struct {
	Field string `json:"field"`
	Op    string `json:"op"`
	Value any    `json:"value"`
}

var supportedAccessPolicyOps = map[string]struct{}{
	"eq":           {},
	"ne":           {},
	"gt":           {},
	"gte":          {},
	"lt":           {},
	"lte":          {},
	"in":           {},
	"not_in":       {},
	"contains":     {},
	"not_contains": {},
	"exists":       {},
	"not_exists":   {},
}

// CustomOAuthProvider stores configuration for custom OAuth providers
type CustomOAuthProvider struct {
	Id                         int    `json:"id" gorm:"primaryKey"`
	Name                       string `json:"name" gorm:"type:varchar(64);not null"`                                 // Display name, e.g., "GitHub Enterprise"
	Slug                       string `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`                     // URL identifier, e.g., "github-enterprise"
	Icon                       string `json:"icon" gorm:"type:varchar(128);default:''"`                              // Icon name from @lobehub/icons
	Kind                       string `json:"kind" gorm:"type:varchar(32);default:'oauth_code'"`                     // oauth_code / jwt_direct
	Enabled                    bool   `json:"enabled" gorm:"default:false"`                                          // Whether this provider is enabled
	ClientId                   string `json:"client_id" gorm:"type:varchar(256)"`                                    // OAuth client ID
	ClientSecret               string `json:"-" gorm:"type:varchar(512)"`                                            // OAuth client secret (not returned to frontend)
	AuthorizationEndpoint      string `json:"authorization_endpoint" gorm:"type:varchar(512)"`                       // Authorization URL
	TokenEndpoint              string `json:"token_endpoint" gorm:"type:varchar(512)"`                               // Token exchange URL
	UserInfoEndpoint           string `json:"user_info_endpoint" gorm:"type:varchar(512)"`                           // User info URL
	Scopes                     string `json:"scopes" gorm:"type:varchar(256);default:'openid profile email'"`        // OAuth scopes
	Issuer                     string `json:"issuer" gorm:"type:varchar(512)"`                                       // JWT issuer
	Audience                   string `json:"audience" gorm:"type:varchar(256)"`                                     // JWT audience
	JwksURL                    string `json:"jwks_url" gorm:"type:varchar(512)"`                                     // JWKS endpoint URL
	PublicKey                  string `json:"public_key" gorm:"type:text"`                                           // PEM public key
	JWTSource                  string `json:"jwt_source" gorm:"type:varchar(32);default:'query'"`                    // query / fragment / body
	JWTHeader                  string `json:"jwt_header" gorm:"type:varchar(128);default:'Authorization'"`           // token header for userinfo mode
	JWTIdentityMode            string `json:"jwt_identity_mode" gorm:"type:varchar(32);default:'claims'"`            // claims / userinfo
	JWTAcquireMode             string `json:"jwt_acquire_mode" gorm:"type:varchar(32);default:'direct_token'"`       // direct_token / ticket_exchange / ticket_validate
	TrustedProxyCIDRs          string `json:"trusted_proxy_cidrs" gorm:"type:text"`                                  // JSON array of trusted proxy CIDRs or IPs
	ExternalIDHeader           string `json:"external_id_header" gorm:"type:varchar(128)"`                           // Header carrying stable external identity
	UsernameHeader             string `json:"username_header" gorm:"type:varchar(128)"`                              // Optional username header
	DisplayNameHeader          string `json:"display_name_header" gorm:"type:varchar(128)"`                          // Optional display name header
	EmailHeader                string `json:"email_header" gorm:"type:varchar(128)"`                                 // Optional email header
	GroupHeader                string `json:"group_header" gorm:"type:varchar(128)"`                                 // Optional group header
	RoleHeader                 string `json:"role_header" gorm:"type:varchar(128)"`                                  // Optional role header
	AuthorizationServiceField  string `json:"authorization_service_field" gorm:"type:varchar(64);default:'service'"` // browser login callback param for ticket exchange
	TicketExchangeURL          string `json:"ticket_exchange_url" gorm:"type:varchar(512)"`                          // ticket processing endpoint URL
	TicketExchangeMethod       string `json:"ticket_exchange_method" gorm:"type:varchar(16);default:'GET'"`          // GET / POST
	TicketExchangePayloadMode  string `json:"ticket_exchange_payload_mode" gorm:"type:varchar(16);default:'query'"`  // query / form / json / multipart
	TicketExchangeTicketField  string `json:"ticket_exchange_ticket_field" gorm:"type:varchar(64);default:'ticket'"` // ticket field name
	TicketExchangeTokenField   string `json:"ticket_exchange_token_field" gorm:"type:varchar(128)"`                  // response token field path (exchange mode)
	TicketExchangeServiceField string `json:"ticket_exchange_service_field" gorm:"type:varchar(64)"`                 // optional service field name
	TicketExchangeExtraParams  string `json:"ticket_exchange_extra_params" gorm:"type:text"`                         // JSON object for exchange params
	TicketExchangeHeaders      string `json:"ticket_exchange_headers" gorm:"type:text"`                              // JSON object for exchange headers

	// Field mapping configuration (supports JSONPath via gjson)
	UserIdField            string `json:"user_id_field" gorm:"type:varchar(128);default:'sub'"`                 // User ID field path, e.g., "sub", "id", "data.user.id"
	UsernameField          string `json:"username_field" gorm:"type:varchar(128);default:'preferred_username'"` // Username field path
	DisplayNameField       string `json:"display_name_field" gorm:"type:varchar(128);default:'name'"`           // Display name field path
	EmailField             string `json:"email_field" gorm:"type:varchar(128);default:'email'"`                 // Email field path
	GroupField             string `json:"group_field" gorm:"type:varchar(128)"`                                 // Group field path
	RoleField              string `json:"role_field" gorm:"type:varchar(128)"`                                  // Role field path
	GroupMapping           string `json:"group_mapping" gorm:"type:text"`                                       // JSON object for external->internal group mapping
	RoleMapping            string `json:"role_mapping" gorm:"type:text"`                                        // JSON object for external->internal role mapping
	AutoRegister           bool   `json:"auto_register" gorm:"default:false"`                                   // Auto create local user on first login
	AutoMergeByEmail       bool   `json:"auto_merge_by_email" gorm:"default:false"`                             // Merge to existing user by email when no binding exists
	SyncUsernameOnLogin    bool   `json:"sync_username_on_login" gorm:"default:false"`                          // Sync username for existing users on external login
	SyncDisplayNameOnLogin bool   `json:"sync_display_name_on_login" gorm:"default:false"`                      // Sync display name for existing users on external login
	SyncEmailOnLogin       bool   `json:"sync_email_on_login" gorm:"default:false"`                             // Sync email for existing users on external login
	SyncGroupOnLogin       bool   `json:"sync_group_on_login" gorm:"default:false"`                             // Sync group for existing users on external login
	SyncRoleOnLogin        bool   `json:"sync_role_on_login" gorm:"default:false"`                              // Sync role for existing users on external login
	GroupMappingMode       string `json:"group_mapping_mode" gorm:"type:varchar(32);default:'explicit_only'"`   // explicit_only / mapping_first
	RoleMappingMode        string `json:"role_mapping_mode" gorm:"type:varchar(32);default:'explicit_only'"`    // explicit_only / mapping_first

	// Advanced options
	WellKnown           string `json:"well_known" gorm:"type:varchar(512)"`            // OIDC discovery endpoint (optional)
	AuthStyle           int    `json:"auth_style" gorm:"default:0"`                    // 0=auto, 1=params, 2=header (Basic Auth)
	AccessPolicy        string `json:"access_policy" gorm:"type:text"`                 // JSON policy for access control based on user info
	AccessDeniedMessage string `json:"access_denied_message" gorm:"type:varchar(512)"` // Custom error message template when access is denied

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (CustomOAuthProvider) TableName() string {
	return "custom_oauth_providers"
}

func (p *CustomOAuthProvider) GetKind() string {
	kind := strings.TrimSpace(p.Kind)
	if kind == "" {
		return CustomOAuthProviderKindOAuthCode
	}
	return kind
}

func (p *CustomOAuthProvider) IsJWTDirect() bool {
	return p.GetKind() == CustomOAuthProviderKindJWTDirect
}

func (p *CustomOAuthProvider) IsTrustedHeader() bool {
	return p.GetKind() == CustomOAuthProviderKindTrustedHeader
}

func (p *CustomOAuthProvider) IsOAuthCode() bool {
	return p.GetKind() == CustomOAuthProviderKindOAuthCode
}

func (p *CustomOAuthProvider) GetJWTAcquireMode() string {
	mode := normalizeCustomJWTAcquireMode(p.JWTAcquireMode)
	if mode == "" {
		return CustomJWTAcquireModeDirectToken
	}
	return mode
}

func (p *CustomOAuthProvider) GetJWTIdentityMode() string {
	mode := normalizeCustomJWTIdentityMode(p.JWTIdentityMode)
	if mode == "" {
		return CustomJWTIdentityModeClaims
	}
	return mode
}

func (p *CustomOAuthProvider) SupportsBrowserLogin() bool {
	if !p.Enabled {
		return false
	}
	if p.IsOAuthCode() {
		return isValidAbsoluteHTTPURL(p.AuthorizationEndpoint) && strings.TrimSpace(p.ClientId) != ""
	}
	if p.IsJWTDirect() {
		if p.GetJWTIdentityMode() == CustomJWTIdentityModeUserInfo && !p.RequiresTicketAcquire() {
			return false
		}
		if p.RequiresTicketAcquire() {
			return isValidAbsoluteHTTPURL(p.AuthorizationEndpoint)
		}
		return isValidAbsoluteHTTPURL(p.AuthorizationEndpoint) &&
			strings.TrimSpace(p.ClientId) != "" &&
			p.JWTSource != CustomJWTSourceBody
	}
	if p.IsTrustedHeader() {
		return strings.TrimSpace(p.ExternalIDHeader) != "" && len(p.GetTrustedProxyCIDRs()) > 0
	}
	return false
}

func (p *CustomOAuthProvider) RequiresTicketAcquire() bool {
	switch p.GetJWTAcquireMode() {
	case CustomJWTAcquireModeTicketExchange, CustomJWTAcquireModeTicketValidate:
		return true
	default:
		return false
	}
}

// GetAllCustomOAuthProviders returns all custom OAuth providers
func GetAllCustomOAuthProviders() ([]*CustomOAuthProvider, error) {
	var providers []*CustomOAuthProvider
	err := DB.Order("id asc").Find(&providers).Error
	return providers, err
}

// GetEnabledCustomOAuthProviders returns all enabled custom OAuth providers
func GetEnabledCustomOAuthProviders() ([]*CustomOAuthProvider, error) {
	var providers []*CustomOAuthProvider
	err := DB.Where("enabled = ?", true).Order("id asc").Find(&providers).Error
	return providers, err
}

// GetCustomOAuthProviderById returns a custom OAuth provider by ID
func GetCustomOAuthProviderById(id int) (*CustomOAuthProvider, error) {
	var provider CustomOAuthProvider
	err := DB.First(&provider, id).Error
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

// GetCustomOAuthProviderBySlug returns a custom OAuth provider by slug
func GetCustomOAuthProviderBySlug(slug string) (*CustomOAuthProvider, error) {
	var provider CustomOAuthProvider
	err := DB.Where("slug = ?", slug).First(&provider).Error
	if err != nil {
		return nil, err
	}
	return &provider, nil
}

// CreateCustomOAuthProvider creates a new custom OAuth provider
func CreateCustomOAuthProvider(provider *CustomOAuthProvider) error {
	if err := validateCustomOAuthProvider(provider); err != nil {
		return err
	}
	return DB.Select("*").Create(provider).Error
}

// UpdateCustomOAuthProvider updates an existing custom OAuth provider
func UpdateCustomOAuthProvider(provider *CustomOAuthProvider) error {
	if err := validateCustomOAuthProvider(provider); err != nil {
		return err
	}
	return DB.Save(provider).Error
}

// DeleteCustomOAuthProvider deletes a custom OAuth provider by ID
func DeleteCustomOAuthProvider(id int) error {
	// First, delete all user bindings for this provider
	if err := DB.Where("provider_id = ?", id).Delete(&UserOAuthBinding{}).Error; err != nil {
		return err
	}
	return DB.Delete(&CustomOAuthProvider{}, id).Error
}

// IsSlugTaken checks if a slug is already taken by another provider
// Returns true on DB errors (fail-closed) to prevent slug conflicts
func IsSlugTaken(slug string, excludeId int) bool {
	var count int64
	query := DB.Model(&CustomOAuthProvider{}).Where("slug = ?", slug)
	if excludeId > 0 {
		query = query.Where("id != ?", excludeId)
	}
	res := query.Count(&count)
	if res.Error != nil {
		// Fail-closed: treat DB errors as slug being taken to prevent conflicts
		return true
	}
	return count > 0
}

// validateCustomOAuthProvider validates a custom OAuth provider configuration
func validateCustomOAuthProvider(provider *CustomOAuthProvider) error {
	if provider.Name == "" {
		return errors.New("provider name is required")
	}
	if provider.Slug == "" {
		return errors.New("provider slug is required")
	}
	// Slug must be lowercase and contain only alphanumeric characters and hyphens
	slug := strings.ToLower(provider.Slug)
	for _, c := range slug {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
			return errors.New("provider slug must contain only lowercase letters, numbers, and hyphens")
		}
	}
	provider.Slug = slug
	provider.Kind = strings.TrimSpace(provider.Kind)
	if provider.Kind == "" {
		provider.Kind = CustomOAuthProviderKindOAuthCode
	}
	if provider.Kind != CustomOAuthProviderKindOAuthCode &&
		provider.Kind != CustomOAuthProviderKindJWTDirect &&
		provider.Kind != CustomOAuthProviderKindTrustedHeader {
		return errors.New("provider kind is invalid")
	}
	normalizeCustomOAuthProviderForKind(provider)

	if provider.IsOAuthCode() {
		if provider.ClientId == "" {
			return errors.New("client ID is required")
		}
		if provider.AuthorizationEndpoint == "" {
			return errors.New("authorization endpoint is required")
		}
		if provider.TokenEndpoint == "" {
			return errors.New("token endpoint is required")
		}
		if provider.UserInfoEndpoint == "" {
			return errors.New("user info endpoint is required")
		}
	} else if provider.IsJWTDirect() {
		acquireMode := normalizeCustomJWTAcquireMode(provider.JWTAcquireMode)
		if acquireMode == "" {
			return errors.New("jwt_acquire_mode is invalid")
		}
		provider.JWTAcquireMode = acquireMode
		identityMode := normalizeCustomJWTIdentityMode(provider.JWTIdentityMode)
		if identityMode == "" {
			return errors.New("jwt_identity_mode is invalid")
		}
		provider.JWTIdentityMode = identityMode
		switch provider.JWTIdentityMode {
		case CustomJWTIdentityModeClaims:
			if provider.JWTAcquireMode != CustomJWTAcquireModeTicketValidate {
				if strings.TrimSpace(provider.Issuer) == "" {
					return errors.New("issuer is required for jwt_direct providers using claims mode")
				}
				if strings.TrimSpace(provider.JwksURL) == "" && strings.TrimSpace(provider.PublicKey) == "" {
					return errors.New("jwks_url or public_key is required for jwt_direct providers using claims mode")
				}
			}
		case CustomJWTIdentityModeUserInfo:
			if provider.JWTAcquireMode == CustomJWTAcquireModeTicketValidate {
				return errors.New("jwt_direct providers using ticket_validate mode only support claims identity mode")
			}
			if !isValidAbsoluteHTTPURL(provider.UserInfoEndpoint) {
				return errors.New("user_info_endpoint is required and must be a valid http/https url for jwt_direct providers using userinfo mode")
			}
		}
	} else {
		if err := validateTrustedHeaderProvider(provider); err != nil {
			return err
		}
	}

	if provider.IsOAuthCode() || provider.IsJWTDirect() {
		if provider.UserIdField == "" {
			provider.UserIdField = "sub"
		}
		if provider.UsernameField == "" {
			provider.UsernameField = "preferred_username"
		}
		if provider.DisplayNameField == "" {
			provider.DisplayNameField = "name"
		}
		if provider.EmailField == "" {
			provider.EmailField = "email"
		}
		if provider.Scopes == "" {
			provider.Scopes = "openid profile email"
		}
	}
	if provider.IsJWTDirect() {
		if provider.JWTSource == "" {
			provider.JWTSource = CustomJWTSourceQuery
		}
		switch provider.JWTSource {
		case CustomJWTSourceQuery, CustomJWTSourceFragment, CustomJWTSourceBody:
		default:
			return errors.New("jwt_source is invalid")
		}
		if strings.TrimSpace(provider.JWTHeader) == "" {
			provider.JWTHeader = "Authorization"
		}
		if strings.TrimSpace(provider.AuthorizationServiceField) == "" {
			provider.AuthorizationServiceField = "service"
		}
		provider.TicketExchangeMethod = normalizeTicketExchangeMethod(provider.TicketExchangeMethod)
		if provider.TicketExchangeMethod == "" {
			return errors.New("ticket_exchange_method is invalid")
		}
		provider.TicketExchangePayloadMode = normalizeTicketExchangePayloadMode(provider.TicketExchangePayloadMode)
		if provider.TicketExchangePayloadMode == "" {
			return errors.New("ticket_exchange_payload_mode is invalid")
		}
		if strings.TrimSpace(provider.TicketExchangeTicketField) == "" {
			provider.TicketExchangeTicketField = "ticket"
		}
		if provider.RequiresTicketAcquire() {
			if strings.TrimSpace(provider.TicketExchangeURL) == "" {
				return errors.New("ticket_exchange_url is required for ticket-based acquire mode")
			}
			if !isValidAbsoluteHTTPURL(provider.TicketExchangeURL) {
				return errors.New("ticket_exchange_url must be a valid http/https url")
			}
			if strings.TrimSpace(provider.TicketExchangeExtraParams) != "" {
				if err := validateJSONStringObject(provider.TicketExchangeExtraParams); err != nil {
					return fmt.Errorf("ticket_exchange_extra_params is invalid: %w", err)
				}
			}
			if strings.TrimSpace(provider.TicketExchangeHeaders) != "" {
				if err := validateJSONStringObject(provider.TicketExchangeHeaders); err != nil {
					return fmt.Errorf("ticket_exchange_headers is invalid: %w", err)
				}
			}
		}
	}
	groupMappingMode := normalizeCustomOAuthMappingMode(provider.GroupMappingMode)
	if groupMappingMode == "" {
		return errors.New("group_mapping_mode is invalid")
	}
	provider.GroupMappingMode = groupMappingMode

	roleMappingMode := normalizeCustomOAuthMappingMode(provider.RoleMappingMode)
	if roleMappingMode == "" {
		return errors.New("role_mapping_mode is invalid")
	}
	provider.RoleMappingMode = roleMappingMode
	if strings.TrimSpace(provider.GroupMapping) != "" {
		if err := validateJSONStringObject(provider.GroupMapping); err != nil {
			return fmt.Errorf("group_mapping is invalid: %w", err)
		}
	}
	if strings.TrimSpace(provider.RoleMapping) != "" {
		if err := validateJSONStringObject(provider.RoleMapping); err != nil {
			return fmt.Errorf("role_mapping is invalid: %w", err)
		}
		if err := validateRoleMappingTargets(provider.RoleMapping); err != nil {
			return fmt.Errorf("role_mapping is invalid: %w", err)
		}
	}
	if strings.TrimSpace(provider.AccessPolicy) != "" {
		var policy accessPolicyPayload
		if err := common.UnmarshalJsonStr(provider.AccessPolicy, &policy); err != nil {
			return errors.New("access_policy must be valid JSON")
		}
		if err := validateAccessPolicyPayload(&policy); err != nil {
			return fmt.Errorf("access_policy is invalid: %w", err)
		}
	}

	return nil
}

func isValidAbsoluteHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed == nil {
		return false
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return false
	}
	return strings.TrimSpace(parsed.Host) != ""
}

func validateJSONStringObject(raw string) error {
	var payload map[string]any
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		return errors.New("must be valid JSON object")
	}
	if payload == nil {
		return errors.New("must be a JSON object")
	}
	return nil
}

func normalizeCustomOAuthMappingMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", CustomOAuthMappingModeExplicitOnly:
		return CustomOAuthMappingModeExplicitOnly
	case CustomOAuthMappingModeMappingFirst:
		return CustomOAuthMappingModeMappingFirst
	default:
		return ""
	}
}

func normalizeCustomJWTAcquireMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", CustomJWTAcquireModeDirectToken:
		return CustomJWTAcquireModeDirectToken
	case CustomJWTAcquireModeTicketExchange:
		return CustomJWTAcquireModeTicketExchange
	case CustomJWTAcquireModeTicketValidate:
		return CustomJWTAcquireModeTicketValidate
	default:
		return ""
	}
}

func normalizeCustomJWTIdentityMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", CustomJWTIdentityModeClaims:
		return CustomJWTIdentityModeClaims
	case CustomJWTIdentityModeUserInfo:
		return CustomJWTIdentityModeUserInfo
	default:
		return ""
	}
}

func normalizeTicketExchangeMethod(raw string) string {
	switch strings.ToUpper(strings.TrimSpace(raw)) {
	case "", CustomTicketExchangeMethodGET:
		return CustomTicketExchangeMethodGET
	case CustomTicketExchangeMethodPOST:
		return CustomTicketExchangeMethodPOST
	default:
		return ""
	}
}

func normalizeTicketExchangePayloadMode(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "", CustomTicketExchangePayloadModeQuery:
		return CustomTicketExchangePayloadModeQuery
	case CustomTicketExchangePayloadModeForm:
		return CustomTicketExchangePayloadModeForm
	case CustomTicketExchangePayloadModeJSON:
		return CustomTicketExchangePayloadModeJSON
	case CustomTicketExchangePayloadModeMultipart:
		return CustomTicketExchangePayloadModeMultipart
	default:
		return ""
	}
}

func validateRoleMappingTargets(raw string) error {
	var payload map[string]any
	if err := common.UnmarshalJsonStr(raw, &payload); err != nil {
		return errors.New("must be valid JSON object")
	}
	for key, value := range payload {
		target := strings.ToLower(strings.TrimSpace(fmt.Sprint(value)))
		switch target {
		case "common", "user", "member", "1", "admin", "administrator", "10":
		default:
			return fmt.Errorf("unsupported role target for key %q", key)
		}
	}
	return nil
}

func validateAccessPolicyPayload(policy *accessPolicyPayload) error {
	if policy == nil {
		return errors.New("policy is nil")
	}

	logic := strings.ToLower(strings.TrimSpace(policy.Logic))
	if logic == "" {
		logic = "and"
	}
	if logic != "and" && logic != "or" {
		return fmt.Errorf("unsupported logic: %s", logic)
	}

	if len(policy.Conditions) == 0 && len(policy.Groups) == 0 {
		return errors.New("policy requires at least one condition or group")
	}

	for index, condition := range policy.Conditions {
		field := strings.TrimSpace(condition.Field)
		if field == "" {
			return fmt.Errorf("condition[%d].field is required", index)
		}
		op := strings.ToLower(strings.TrimSpace(condition.Op))
		if _, ok := supportedAccessPolicyOps[op]; !ok {
			return fmt.Errorf("condition[%d].op is unsupported: %s", index, op)
		}
		if op == "in" || op == "not_in" {
			if _, ok := condition.Value.([]any); !ok {
				return fmt.Errorf("condition[%d].value must be an array for op %s", index, op)
			}
		}
	}

	for index := range policy.Groups {
		if err := validateAccessPolicyPayload(&policy.Groups[index]); err != nil {
			return fmt.Errorf("group[%d]: %w", index, err)
		}
	}

	return nil
}
