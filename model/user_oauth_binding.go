package model

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

// UserOAuthBinding describes the legacy custom OAuth table and remains the API
// projection returned to callers. AuthIdentity is the sole runtime authority.
type UserOAuthBinding struct {
	Id                     int        `json:"id" gorm:"primaryKey"`
	UserId                 int        `json:"user_id" gorm:"not null;uniqueIndex:ux_user_provider"`
	ProviderId             int        `json:"provider_id" gorm:"not null;uniqueIndex:ux_user_provider;uniqueIndex:ux_provider_userid"`
	ProviderUserId         string     `json:"provider_user_id" gorm:"type:varchar(256);not null;uniqueIndex:ux_provider_userid"`
	CreatedAt              time.Time  `json:"created_at"`
	AuthIdentityMigratedAt *time.Time `json:"-" gorm:"column:auth_identity_migrated_at"`
}

func (UserOAuthBinding) TableName() string {
	return "user_oauth_bindings"
}

// GetUserOAuthBindingsByUserId returns all OAuth bindings for a user
func GetUserOAuthBindingsByUserId(userId int) ([]*UserOAuthBinding, error) {
	if userId <= 0 {
		return nil, errors.New("user ID is required")
	}
	var identities []AuthIdentity
	if err := DB.Where("user_id = ?", userId).Order("id ASC").Find(&identities).Error; err != nil {
		return nil, err
	}
	bindings := make([]*UserOAuthBinding, 0, len(identities))
	for i := range identities {
		binding, ok, err := userOAuthBindingFromAuthIdentity(&identities[i])
		if err != nil {
			return nil, err
		}
		if ok {
			bindings = append(bindings, binding)
		}
	}
	return bindings, nil
}

// GetUserOAuthBinding returns a specific binding for a user and provider
func GetUserOAuthBinding(userId, providerId int) (*UserOAuthBinding, error) {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil {
		return nil, err
	}
	var identity AuthIdentity
	if err := DB.Where("user_id = ? AND provider_key = ?", userId, providerKey).First(&identity).Error; err != nil {
		return nil, err
	}
	binding, _, err := userOAuthBindingFromAuthIdentity(&identity)
	return binding, err
}

// GetUserByOAuthBinding finds a user by provider ID and provider user ID
func GetUserByOAuthBinding(providerId int, providerUserId string) (*User, error) {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil {
		return nil, err
	}
	return GetUserByAuthIdentity(providerKey, providerUserId)
}

// IsProviderUserIdTaken checks if a provider user ID is already bound to any user
func IsProviderUserIdTaken(providerId int, providerUserId string) bool {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil || strings.TrimSpace(providerUserId) == "" {
		return true
	}
	var count int64
	if err := DB.Model(&AuthIdentity{}).
		Where("provider_key = ? AND provider_subject = ?", providerKey, hashAuthIdentitySubject(providerUserId)).
		Count(&count).Error; err != nil {
		return true
	}
	return count > 0
}

// CreateUserOAuthBinding creates a new OAuth binding
func CreateUserOAuthBinding(binding *UserOAuthBinding) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return CreateUserOAuthBindingWithTx(tx, binding)
	})
}

// CreateUserOAuthBindingWithTx creates a new OAuth binding within a transaction
func CreateUserOAuthBindingWithTx(tx *gorm.DB, binding *UserOAuthBinding) error {
	if err := validateUserOAuthBinding(binding); err != nil {
		return err
	}
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(binding.ProviderId)
	if err != nil {
		return err
	}
	if err := CreateAuthIdentityWithTx(tx, binding.UserId, providerKey, binding.ProviderUserId); err != nil {
		return err
	}
	var identity AuthIdentity
	if err := tx.Where("user_id = ? AND provider_key = ?", binding.UserId, providerKey).First(&identity).Error; err != nil {
		return err
	}
	binding.Id = int(identity.Id)
	binding.CreatedAt = identity.CreatedAt
	return nil
}

// UpdateUserOAuthBinding updates an existing OAuth binding (e.g., rebind to different OAuth account)
func UpdateUserOAuthBinding(userId, providerId int, newProviderUserId string) error {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return SetAuthIdentityWithTx(tx, userId, providerKey, newProviderUserId)
	})
}

// DeleteUserOAuthBinding deletes an OAuth binding
func DeleteUserOAuthBinding(userId, providerId int) error {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil {
		return err
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		return DeleteAuthIdentityWithTx(tx, userId, providerKey)
	})
}

// GetBindingCountByProviderId returns the number of bindings for a provider
func GetBindingCountByProviderId(providerId int) (int64, error) {
	providerKey, err := AuthIdentityProviderKeyForCustomOAuth(providerId)
	if err != nil {
		return 0, err
	}
	var count int64
	err = DB.Model(&AuthIdentity{}).Where("provider_key = ?", providerKey).Count(&count).Error
	return count, err
}

func validateUserOAuthBinding(binding *UserOAuthBinding) error {
	if binding == nil {
		return errors.New("OAuth binding is required")
	}
	if binding.UserId <= 0 {
		return errors.New("user ID is required")
	}
	if binding.ProviderId <= 0 {
		return errors.New("provider ID is required")
	}
	if strings.TrimSpace(binding.ProviderUserId) == "" {
		return errors.New("provider user ID is required")
	}
	return nil
}

func userOAuthBindingFromAuthIdentity(identity *AuthIdentity) (*UserOAuthBinding, bool, error) {
	providerId, custom := customOAuthProviderIdFromAuthIdentityKey(identity.ProviderKey)
	if !custom {
		return nil, false, nil
	}
	if identity.ProviderSubject == "" {
		return nil, false, fmt.Errorf("custom OAuth identity %d has no migrated subject value", identity.Id)
	}
	return &UserOAuthBinding{
		Id:             int(identity.Id),
		UserId:         identity.UserId,
		ProviderId:     providerId,
		ProviderUserId: identity.ProviderSubject,
		CreatedAt:      identity.CreatedAt,
	}, true, nil
}
