package service

import (
	"crypto/sha256"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

type SMSSendLogInput struct {
	Phone           string
	PhoneMasked     string
	Scene           string
	Provider        string
	TemplateVersion string
	ProviderCode    string
	DurationMs      int64
}

type UserPhoneBindingInput struct {
	UserID     int
	Phone      string
	Provider   string
	VerifiedAt int64
}

func RecordSMSSendLog(db *gorm.DB, input SMSSendLogInput) (*model.SMSSendLog, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	phoneMasked := strings.TrimSpace(input.PhoneMasked)
	if phoneMasked == "" {
		phoneMasked = common.MaskPhone(input.Phone)
	}
	if phoneMasked == "" {
		return nil, errors.New("invalid sms phone")
	}
	durationMs := input.DurationMs
	if durationMs < 0 {
		durationMs = 0
	}
	log := &model.SMSSendLog{
		PhoneMasked:     phoneMasked,
		Scene:           strings.TrimSpace(input.Scene),
		Provider:        strings.TrimSpace(input.Provider),
		TemplateVersion: strings.TrimSpace(input.TemplateVersion),
		ProviderCode:    strings.TrimSpace(input.ProviderCode),
		DurationMs:      durationMs,
	}
	if err := db.Create(log).Error; err != nil {
		return nil, err
	}
	return log, nil
}

func BindUserPhone(db *gorm.DB, input UserPhoneBindingInput) (*model.UserPhoneBinding, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	if input.UserID <= 0 {
		return nil, errors.New("invalid user id")
	}
	phone, err := common.NormalizePhone(input.Phone)
	if err != nil {
		return nil, err
	}
	phoneHash := HashPhoneForBinding(phone)
	phoneMasked := common.MaskPhone(phone)
	if phoneHash == "" || phoneMasked == "" {
		return nil, errors.New("invalid phone")
	}
	now := time.Now().Unix()
	verifiedAt := input.VerifiedAt
	if verifiedAt <= 0 {
		verifiedAt = now
	}

	var created *model.UserPhoneBinding
	err = db.Transaction(func(tx *gorm.DB) error {
		var existingPhone model.UserPhoneBinding
		err := tx.
			Where("phone_hash = ? AND status = ?", phoneHash, model.UserPhoneBindingStatusActive).
			First(&existingPhone).Error
		if err == nil {
			if existingPhone.UserId != input.UserID {
				return errors.New("phone already bound")
			}
			created = &existingPhone
			return nil
		}
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}

		if err := tx.Model(&model.UserPhoneBinding{}).
			Where("user_id = ? AND status = ?", input.UserID, model.UserPhoneBindingStatusActive).
			Updates(map[string]any{
				"status":     model.UserPhoneBindingStatusReplaced,
				"unbound_at": now,
			}).Error; err != nil {
			return err
		}

		binding := &model.UserPhoneBinding{
			UserId:      input.UserID,
			PhoneHash:   phoneHash,
			PhoneMasked: phoneMasked,
			Status:      model.UserPhoneBindingStatusActive,
			Provider:    strings.TrimSpace(input.Provider),
			VerifiedAt:  verifiedAt,
			BoundAt:     now,
		}
		if err := tx.Create(binding).Error; err != nil {
			return err
		}
		created = binding
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

func FindUserByActivePhoneBinding(db *gorm.DB, phone string) (*model.User, error) {
	if db == nil {
		return nil, errors.New("nil db")
	}
	phoneHash := HashPhoneForBinding(phone)
	if phoneHash == "" {
		return nil, errors.New("invalid phone")
	}

	var binding model.UserPhoneBinding
	err := db.
		Where("phone_hash = ? AND status = ?", phoneHash, model.UserPhoneBindingStatusActive).
		First(&binding).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("phone is not bound")
	}
	if err != nil {
		return nil, err
	}

	var user model.User
	err = db.
		Where("id = ? AND status = ?", binding.UserId, common.UserStatusEnabled).
		First(&user).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, errors.New("phone is not bound")
	}
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func HashPhoneForBinding(phone string) string {
	normalized, err := common.NormalizePhone(phone)
	if err != nil {
		return ""
	}
	digest := sha256.Sum256([]byte("user_phone_binding:" + normalized))
	return fmt.Sprintf("%x", digest)
}
