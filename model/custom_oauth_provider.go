package model

import (
	"github.com/QuantumNous/new-api/i18n"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
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
	Enabled               bool   `json:"enabled" gorm:"default:false"`                                   // Whether this provider is enabled
	ClientId              string `json:"client_id" gorm:"type:varchar(256)"`                             // OAuth client ID
	ClientSecret          string `json:"-" gorm:"type:varchar(512)"`                                     // OAuth client secret (not returned to frontend)
	AuthorizationEndpoint string `json:"authorization_endpoint" gorm:"type:varchar(512)"`                // Authorization URL
	TokenEndpoint         string `json:"token_endpoint" gorm:"type:varchar(512)"`                        // Token exchange URL
	UserInfoEndpoint      string `json:"user_info_endpoint" gorm:"type:varchar(512)"`                    // User info URL
	Scopes                string `json:"scopes" gorm:"type:varchar(256);default:'openid profile email'"` // OAuth scopes

	// Field mapping configuration (supports JSONPath via gjson)
	UserIdField      string `json:"user_id_field" gorm:"type:varchar(128);default:'sub'"`                 // User ID field path, e.g., "sub", "id", "data.user.id"
	UsernameField    string `json:"username_field" gorm:"type:varchar(128);default:'preferred_username'"` // Username field path
	DisplayNameField string `json:"display_name_field" gorm:"type:varchar(128);default:'name'"`           // Display name field path
	EmailField       string `json:"email_field" gorm:"type:varchar(128);default:'email'"`                 // Email field path

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
		return errors.New(i18n.Translate("model.provider_name_is_required"))
	}
	if provider.Slug == "" {
		return errors.New(i18n.Translate("model.provider_slug_is_required"))
	}
	// Slug must be lowercase and contain only alphanumeric characters and hyphens
	slug := strings.ToLower(provider.Slug)
	for _, c := range slug {
		if !((c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '-') {
			return errors.New(i18n.Translate("model.provider_slug_must_contain_only_lowercase_letters_numbers"))
		}
	}
	provider.Slug = slug

	if provider.ClientId == "" {
		return errors.New(i18n.Translate("model.client_id_is_required"))
	}
	if provider.AuthorizationEndpoint == "" {
		return errors.New(i18n.Translate("model.authorization_endpoint_is_required"))
	}
	if provider.TokenEndpoint == "" {
		return errors.New(i18n.Translate("model.token_endpoint_is_required"))
	}
	if provider.UserInfoEndpoint == "" {
		return errors.New(i18n.Translate("model.user_info_endpoint_is_required"))
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
	if strings.TrimSpace(provider.AccessPolicy) != "" {
		var policy accessPolicyPayload
		if err := common.UnmarshalJsonStr(provider.AccessPolicy, &policy); err != nil {
			return errors.New(i18n.Translate("model.access_policy_must_be_valid_json"))
		}
		if err := validateAccessPolicyPayload(&policy); err != nil {
			return fmt.Errorf(i18n.Translate("model.access_policy_is_invalid"), err)
		}
	}

	return nil
}

func validateAccessPolicyPayload(policy *accessPolicyPayload) error {
	if policy == nil {
		return errors.New(i18n.Translate("model.policy_is_nil"))
	}

	logic := strings.ToLower(strings.TrimSpace(policy.Logic))
	if logic == "" {
		logic = "and"
	}
	if logic != "and" && logic != "or" {
		return fmt.Errorf(i18n.Translate("model.unsupported_logic"), logic)
	}

	if len(policy.Conditions) == 0 && len(policy.Groups) == 0 {
		return errors.New(i18n.Translate("model.policy_requires_at_least_one_condition_or_group"))
	}

	for index, condition := range policy.Conditions {
		field := strings.TrimSpace(condition.Field)
		if field == "" {
			return fmt.Errorf(i18n.Translate("model.condition_field_is_required"), index)
		}
		op := strings.ToLower(strings.TrimSpace(condition.Op))
		if _, ok := supportedAccessPolicyOps[op]; !ok {
			return fmt.Errorf(i18n.Translate("model.condition_op_is_unsupported"), index, op)
		}
		if op == "in" || op == "not_in" {
			if _, ok := condition.Value.([]any); !ok {
				return fmt.Errorf(i18n.Translate("model.condition_value_must_be_an_array_for_op"), index, op)
			}
		}
	}

	for index := range policy.Groups {
		if err := validateAccessPolicyPayload(&policy.Groups[index]); err != nil {
			return fmt.Errorf(i18n.Translate("model.group"), index, err)
		}
	}

	return nil
}
