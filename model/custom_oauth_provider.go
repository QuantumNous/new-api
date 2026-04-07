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
	CustomOAuthProviderKindCAS           = "cas"
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
	Kind                       string `json:"kind" gorm:"type:varchar(32);default:'oauth_code'"`                     // oauth_code / cas / jwt_direct / trusted_header
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
	CASServerURL               string `json:"cas_server_url" gorm:"type:varchar(512)"`                               // CAS server base URL
	ServiceURL                 string `json:"service_url" gorm:"type:varchar(512)"`                                  // Optional browser callback URL override
	ValidateURL                string `json:"validate_url" gorm:"type:varchar(512)"`                                 // Optional CAS validation URL override
	Renew                      bool   `json:"renew" gorm:"default:false"`                                            // Force primary credentials for login
	Gateway                    bool   `json:"gateway" gorm:"default:false"`                                          // Request passive login when supported
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

func (p *CustomOAuthProvider) IsCAS() bool {
	return p.GetKind() == CustomOAuthProviderKindCAS
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
	if p.IsCAS() {
		return isValidAbsoluteHTTPURL(p.CASServerURL)
	}
	return false
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
		provider.Kind != CustomOAuthProviderKindCAS &&
		provider.Kind != CustomOAuthProviderKindJWTDirect &&
		provider.Kind != CustomOAuthProviderKindTrustedHeader {
		return errors.New("provider kind is invalid")
	}
	normalizeCustomOAuthProviderForKind(provider)

	if provider.IsOAuthCode() {
		provider.ClientId = strings.TrimSpace(provider.ClientId)
		provider.AuthorizationEndpoint = strings.TrimSpace(provider.AuthorizationEndpoint)
		provider.TokenEndpoint = strings.TrimSpace(provider.TokenEndpoint)
		provider.UserInfoEndpoint = strings.TrimSpace(provider.UserInfoEndpoint)
		if provider.ClientId == "" {
			return errors.New("client ID is required")
		}
		if provider.AuthorizationEndpoint == "" {
			return errors.New("authorization endpoint is required")
		}
		if !isValidAbsoluteHTTPURL(provider.AuthorizationEndpoint) {
			return errors.New("authorization endpoint must be a valid absolute http or https URL")
		}
		if provider.TokenEndpoint == "" {
			return errors.New("token endpoint is required")
		}
		if !isValidAbsoluteHTTPURL(provider.TokenEndpoint) {
			return errors.New("token endpoint must be a valid absolute http or https URL")
		}
		if provider.UserInfoEndpoint == "" {
			return errors.New("user info endpoint is required")
		}
		if !isValidAbsoluteHTTPURL(provider.UserInfoEndpoint) {
			return errors.New("user info endpoint must be a valid absolute http or https URL")
		}
	} else if provider.IsCAS() {
		if err := validateCASProvider(provider); err != nil {
			return err
		}
	}

	if provider.IsOAuthCode() || provider.IsJWTDirect() || provider.IsCAS() {
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
	if provider.IsCAS() {
		if provider.UserIdField == "sub" {
			provider.UserIdField = "authenticationSuccess.user"
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
