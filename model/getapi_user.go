package model

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"os"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/gorm/logger"
)

var (
	ErrGetAPIInvalidRequest        = errors.New("GETAPI_INVALID_REQUEST")
	ErrGetAPICapabilityDenied      = errors.New("GETAPI_CAPABILITY_DENIED")
	ErrGetAPIAccountNotFound       = errors.New("GETAPI_ACCOUNT_NOT_FOUND")
	ErrGetAPICreateConflict        = errors.New("GETAPI_CREATE_CONFLICT")
	ErrGetAPIBindingConflict       = errors.New("GETAPI_BINDING_CONFLICT")
	ErrGetAPIPATMissing            = errors.New("GETAPI_PAT_MISSING")
	ErrGetAPICredentialUnavailable = errors.New("GETAPI_CREDENTIAL_UNAVAILABLE")
)

type GetAPIUserBinding struct {
	ID                  int    `gorm:"primaryKey"`
	BindingKey          string `gorm:"type:char(64);not null;uniqueIndex"`
	IntegrationID       string `gorm:"type:varchar(128);not null"`
	ExternalAccountID   string `gorm:"type:varchar(128);not null"`
	UserID              *int   `gorm:"uniqueIndex"`
	OriginalUsername    string `gorm:"type:varchar(128);not null"`
	OriginalDisplayName string `gorm:"type:varchar(128);not null"`
	PasswordFingerprint string `gorm:"type:char(64);not null"`
}

type GetAPICreateUserRequest struct {
	ExternalAccountID string `json:"external_account_id"`
	Username          string `json:"username"`
	Password          string `json:"password"`
	DisplayName       string `json:"display_name"`
}

type GetAPICredential struct {
	ExternalAccountID string  `json:"external_account_id"`
	UserID            int     `json:"user_id"`
	State             string  `json:"state"`
	AccessToken       *string `json:"access_token"`
}

func getAPIBindingKey(integration, external string) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(integration+"\x00"+external)))
}

func ProvisionGetAPIUser(integration string, principalRole int, request GetAPICreateUserRequest) (*GetAPICredential, bool, error) {
	key := os.Getenv("GETAPI_FINGERPRINT_KEY")
	if len(key) < 32 {
		return nil, false, ErrGetAPICredentialUnavailable
	}
	mac := hmac.New(sha256.New, []byte(key))
	mac.Write([]byte(request.Password))
	binding := GetAPIUserBinding{BindingKey: getAPIBindingKey(integration, request.ExternalAccountID), IntegrationID: integration, ExternalAccountID: request.ExternalAccountID, OriginalUsername: request.Username, OriginalDisplayName: request.DisplayName, PasswordFingerprint: fmt.Sprintf("%x", mac.Sum(nil))}
	var credential *GetAPICredential
	created := false
	err := DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).Transaction(func(tx *gorm.DB) error {
		if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&binding).Error; err != nil {
			return err
		}
		var stored GetAPIUserBinding
		if err := lockForUpdate(tx).Where("binding_key = ?", binding.BindingKey).First(&stored).Error; err != nil {
			return err
		}
		if stored.IntegrationID != integration || stored.ExternalAccountID != request.ExternalAccountID {
			return ErrGetAPIBindingConflict
		}
		if stored.OriginalUsername != request.Username || stored.OriginalDisplayName != request.DisplayName || !hmac.Equal([]byte(stored.PasswordFingerprint), []byte(binding.PasswordFingerprint)) {
			return ErrGetAPICreateConflict
		}
		if stored.UserID == nil {
			user := User{Username: strings.TrimSpace(request.Username), Password: request.Password, DisplayName: request.DisplayName, Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
			if user.DisplayName == "" {
				user.DisplayName = user.Username
			}
			if err := EnsureUsernameAvailableWithTx(tx, user.Username, 0); err != nil {
				return err
			}
			token, err := common.GenerateRandomKey(32)
			if err != nil {
				return err
			}
			now := common.GetTimestamp()
			user.AccessToken = &token
			user.AccessTokenCreatedAt = &now
			setting := user.GetSetting()
			setting.SidebarModules = generateDefaultSidebarConfigForRole(user.Role)
			user.SetSetting(setting)
			if err := user.InsertWithTx(tx, 0); err != nil {
				return err
			}
			if user.Id <= 0 {
				return ErrGetAPICredentialUnavailable
			}
			if err := tx.Model(&stored).Update("user_id", user.Id).Error; err != nil {
				return err
			}
			stored.UserID = &user.Id
			created = true
		}
		var err error
		credential, err = getAPICredentialWithTx(tx, stored, principalRole)
		return err
	})
	if errors.Is(err, ErrUsernameAlreadyTaken) {
		err = ErrGetAPIBindingConflict
	}
	if err != nil && !errors.Is(err, ErrGetAPICreateConflict) && !errors.Is(err, ErrGetAPIPATMissing) {
		var occupied User
		lookup := DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).Unscoped().Select("id").Where("username = ?", strings.TrimSpace(request.Username)).First(&occupied)
		if lookup.Error == nil {
			var owned int64
			lookup = DB.Model(&GetAPIUserBinding{}).Where("binding_key = ? AND user_id = ?", binding.BindingKey, occupied.Id).Count(&owned)
			if lookup.Error == nil && owned == 0 {
				err = ErrGetAPIBindingConflict
			}
		}
	}
	if err != nil {
		return nil, false, err
	}
	return credential, created, nil
}

func ReadGetAPICredential(integration, external string, principalRole int) (*GetAPICredential, error) {
	var credential *GetAPICredential
	err := DB.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).Transaction(func(tx *gorm.DB) error {
		var binding GetAPIUserBinding
		if err := tx.Where("binding_key = ?", getAPIBindingKey(integration, external)).First(&binding).Error; err != nil {
			return err
		}
		if binding.IntegrationID != integration || binding.ExternalAccountID != external {
			return ErrGetAPIAccountNotFound
		}
		var err error
		credential, err = getAPICredentialWithTx(tx, binding, principalRole)
		return err
	})
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = ErrGetAPIAccountNotFound
	}
	return credential, err
}

func getAPICredentialWithTx(tx *gorm.DB, binding GetAPIUserBinding, principalRole int) (*GetAPICredential, error) {
	if binding.UserID == nil || *binding.UserID <= 0 {
		return nil, ErrGetAPIAccountNotFound
	}
	var user User
	if err := tx.First(&user, *binding.UserID).Error; err != nil {
		return nil, err
	}
	if user.Id != *binding.UserID {
		return nil, ErrGetAPIBindingConflict
	}
	if user.Role != common.RoleCommonUser || user.Role >= principalRole {
		return nil, ErrGetAPICapabilityDenied
	}
	credential := &GetAPICredential{ExternalAccountID: binding.ExternalAccountID, UserID: user.Id, State: "blocked"}
	if user.Status == common.UserStatusDisabled {
		return credential, nil
	}
	if user.Status != common.UserStatusEnabled {
		return nil, ErrGetAPICredentialUnavailable
	}
	token := strings.TrimRight(user.GetAccessToken(), " ")
	if token == "" {
		return nil, ErrGetAPIPATMissing
	}
	credential.State = "active"
	credential.AccessToken = &token
	return credential, nil
}

func updateGetAPIManagedStatusWithTx(tx *gorm.DB, current User, status int) error {
	if status == 0 {
		return nil
	}
	var count int64
	if err := tx.Model(&GetAPIUserBinding{}).Where("user_id = ?", current.Id).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return nil
	}
	updates := map[string]interface{}{}
	switch {
	case status == common.UserStatusDisabled:
		updates["access_token"] = nil
		updates["access_token_created_at"] = nil
	case status == common.UserStatusEnabled && current.Status == common.UserStatusDisabled:
		token, err := common.GenerateRandomKey(32)
		if err != nil {
			return err
		}
		updates["access_token"] = token
		updates["access_token_created_at"] = common.GetTimestamp()
	default:
		return nil
	}
	return tx.Session(&gorm.Session{Logger: logger.Default.LogMode(logger.Silent)}).Model(&User{}).Where("id = ?", current.Id).Updates(updates).Error
}
