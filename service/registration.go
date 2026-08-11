package service

import (
	"errors"
	"fmt"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"

	"gorm.io/gorm"
)

var (
	// ErrInvitationCodeRejected deliberately hides whether a code was missing,
	// unknown, expired, disabled, or already used.
	ErrInvitationCodeRejected             = errors.New("a valid invitation code is required")
	ErrRegistrationTemporarilyUnavailable = errors.New("registration is temporarily unavailable")
	ErrDefaultTokenCreation               = errors.New("failed to create default token")
	ErrDefaultTokenMethod                 = errors.New("default token generation is only allowed for password registration")
)

type NewUserRegistration struct {
	User                 *model.User
	InviterID            int
	Method               string
	InvitationCode       string
	GenerateDefaultToken bool
	CreateRelated        func(tx *gorm.DB, user *model.User) error
}

// RegisterNewUser atomically creates a public user and all records required for
// that registration method. Post-commit rewards and sidebar initialization are
// deliberately kept outside the transaction because they are existing
// best-effort side effects.
func RegisterNewUser(registration NewUserRegistration) error {
	if registration.User == nil {
		return errors.New("registration user is required")
	}
	registration.Method = strings.ToLower(strings.TrimSpace(registration.Method))
	if !common.IsValidInvitationRegistrationMethod(registration.Method) {
		return errors.New("unsupported registration method")
	}
	if registration.GenerateDefaultToken && registration.Method != common.InvitationRegistrationMethodPassword {
		return ErrDefaultTokenMethod
	}

	baseUser := *registration.User
	attemptUser := baseUser
	err := model.WithInvitationCodeSettingsTransaction(func(tx *gorm.DB, settings common.InvitationCodeSettings) error {
		attemptUser.InviterId = registration.InviterID
		if err := attemptUser.InsertWithTx(tx, registration.InviterID); err != nil {
			return err
		}

		if settings.Requires(registration.Method) {
			if _, err := model.ConsumeInvitationCodeWithTx(tx, registration.InvitationCode, attemptUser.Id); err != nil {
				if isRejectedInvitationCodeError(err) {
					return ErrInvitationCodeRejected
				}
				return err
			}
		}

		if registration.CreateRelated != nil {
			if err := registration.CreateRelated(tx, &attemptUser); err != nil {
				return err
			}
		}

		if registration.GenerateDefaultToken {
			if err := createDefaultTokenWithTx(tx, &attemptUser); err != nil {
				return fmt.Errorf("%w: %w", ErrDefaultTokenCreation, err)
			}
		}
		return nil
	})
	if err != nil {
		if model.IsSQLiteBusyError(err) || errors.Is(err, model.ErrInvitationCodeSettingsUnavailable) {
			return fmt.Errorf("%w: %v", ErrRegistrationTemporarilyUnavailable, err)
		}
		return err
	}

	*registration.User = attemptUser
	registration.User.FinishInsert(registration.InviterID)
	return nil
}

func isRejectedInvitationCodeError(err error) bool {
	return errors.Is(err, model.ErrInvitationCodeNotProvided) ||
		errors.Is(err, model.ErrInvitationCodeInvalid) ||
		errors.Is(err, model.ErrInvitationCodeUsed) ||
		errors.Is(err, model.ErrInvitationCodeExpired) ||
		errors.Is(err, model.ErrInvitationCodeDisabled)
}

func createDefaultTokenWithTx(tx *gorm.DB, user *model.User) error {
	key, err := common.GenerateKey()
	if err != nil {
		return err
	}
	now := common.GetTimestamp()
	token := &model.Token{
		UserId:             user.Id,
		Name:               user.Username + "的初始令牌",
		Key:                key,
		CreatedTime:        now,
		AccessedTime:       now,
		ExpiredTime:        -1,
		RemainQuota:        500000,
		UnlimitedQuota:     true,
		ModelLimitsEnabled: false,
	}
	if setting.DefaultUseAutoGroup {
		token.Group = "auto"
	}
	return tx.Create(token).Error
}
