package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	CustomOAuthProviderKindOAuthCode = "oauth_code"
	CustomOAuthProviderKindJWTDirect = "jwt_direct"
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
	Id                    int    `json:"id" gorm:"primaryKey"`
	Name                  string `json:"name" gorm:"type:varchar(64);not null"`                          // Display name, e.g., "GitHub Enterprise"
	Slug                  string `json:"slug" gorm:"type:varchar(64);uniqueIndex;not null"`              // URL identifier, e.g., "github-enterprise"
	Icon                  string `json:"icon" gorm:"type:varchar(128);default:''"`                       // Icon name from @lobehub/icons
	Kind                  string `json:"kind" gorm:"type:varchar(32);default:'oauth_code'"`              // oauth_code / jwt_direct
	Enabled               bool   `json:"enabled" gorm:"default:false"`                                   // Whether this provider is enabled
	ClientId              string `json:"client_id" gorm:"type:varchar(256)"`                             // OAuth client ID
	ClientSecret          string `json:"-" gorm:"type:varchar(512)"`                                     // OAuth client secret (not returned to frontend)
	AuthorizationEndpoint string `json:"authorization_endpoint" gorm:"type:varchar(512)"`                // Authorization URL
	TokenEndpoint         string `json:"token_endpoint" gorm:"type:varchar(512)"`                        // Token exchange URL
	UserInfoEndpoint      string `json:"user_info_endpoint" gorm:"type:varchar(512)"`                    // User info URL
	Scopes                string `json:"scopes" gorm:"type:varchar(256);default:'openid profile email'"` // OAuth scopes
	Issuer                string `json:"issuer" gorm:"type:varchar(512)"`                                // JWT issuer
	Audience              string `json:"audience" gorm:"type:varchar(256)"`                              // JWT audience
	JwksURL               string `json:"jwks_url" gorm:"type:varchar(512)"`                              // JWKS endpoint URL
	PublicKey             string `json:"public_key" gorm:"type:text"`                                    // PEM public key
	JWTSource             string `json:"jwt_source" gorm:"type:varchar(32);default:'query'"`             // query / fragment / body
	JWTHeader             string `json:"jwt_header" gorm:"type:varchar(128);default:'Authorization'"`    // reserved for future header mode

	// Field mapping configuration (supports JSONPath via gjson)
	UserIdField      string `json:"user_id_field" gorm:"type:varchar(128);default:'sub'"`                 // User ID field path, e.g., "sub", "id", "data.user.id"
	UsernameField    string `json:"username_field" gorm:"type:varchar(128);default:'preferred_username'"` // Username field path
	DisplayNameField string `json:"display_name_field" gorm:"type:varchar(128);default:'name'"`           // Display name field path
	EmailField       string `json:"email_field" gorm:"type:varchar(128);default:'email'"`                 // Email field path
	GroupField       string `json:"group_field" gorm:"type:varchar(128)"`                                 // Group field path
	RoleField        string `json:"role_field" gorm:"type:varchar(128)"`                                  // Role field path
	GroupMapping     string `json:"group_mapping" gorm:"type:text"`                                       // JSON object for external->internal group mapping
	RoleMapping      string `json:"role_mapping" gorm:"type:text"`                                        // JSON object for external->internal role mapping
	AutoRegister     bool   `json:"auto_register" gorm:"default:false"`                                   // Auto create local user on first login
	AutoMergeByEmail bool   `json:"auto_merge_by_email" gorm:"default:false"`                             // Merge to existing user by email when no binding exists
	SyncGroupOnLogin bool   `json:"sync_group_on_login" gorm:"default:false"`                             // Sync group for existing users on external login
	SyncRoleOnLogin  bool   `json:"sync_role_on_login" gorm:"default:false"`                              // Sync role for existing users on external login
	GroupMappingMode string `json:"group_mapping_mode" gorm:"type:varchar(32);default:'explicit_only'"`   // explicit_only / mapping_first
	RoleMappingMode  string `json:"role_mapping_mode" gorm:"type:varchar(32);default:'explicit_only'"`    // explicit_only / mapping_first

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

func (p *CustomOAuthProvider) IsOAuthCode() bool {
	return p.GetKind() == CustomOAuthProviderKindOAuthCode
}

func (p *CustomOAuthProvider) SupportsBrowserLogin() bool {
	if !p.Enabled {
		return false
	}
	if p.IsOAuthCode() {
		return strings.TrimSpace(p.AuthorizationEndpoint) != "" && strings.TrimSpace(p.ClientId) != ""
	}
	if p.IsJWTDirect() {
		return strings.TrimSpace(p.AuthorizationEndpoint) != "" &&
			strings.TrimSpace(p.ClientId) != "" &&
			p.JWTSource != CustomJWTSourceBody
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
	return DB.Create(provider).Error
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
	if provider.Kind != CustomOAuthProviderKindOAuthCode && provider.Kind != CustomOAuthProviderKindJWTDirect {
		return errors.New("provider kind is invalid")
	}

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
	} else {
		if strings.TrimSpace(provider.Issuer) == "" {
			return errors.New("issuer is required for jwt_direct providers")
		}
		if strings.TrimSpace(provider.JwksURL) == "" && strings.TrimSpace(provider.PublicKey) == "" {
			return errors.New("jwks_url or public_key is required for jwt_direct providers")
		}
	}

	// Set defaults for field mappings if empty
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
