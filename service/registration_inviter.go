package service

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

// ResolveRegistrationInviter preserves the existing explicit-affiliate
// behavior, then supplies an active custom-domain owner only when no explicit
// aff was submitted. The domain and owner are read at creation time rather
// than trusting a possibly stale request context or OAuth state.
func ResolveRegistrationInviter(explicitAff string, domainID int64) (int, error) {
	if explicitAff != "" {
		inviterID, _ := model.GetUserIdByAffCode(explicitAff)
		return inviterID, nil
	}
	if domainID <= 0 {
		return 0, nil
	}
	domain, err := model.GetCustomDomainByID(domainID)
	if err != nil {
		if errors.Is(err, model.ErrCustomDomainNotFound) {
			return 0, nil
		}
		return 0, err
	}
	if !domain.Enabled {
		return 0, nil
	}
	owner, err := model.GetUserById(domain.OwnerUserID, false)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return 0, nil
		}
		return 0, err
	}
	if owner.Status != common.UserStatusEnabled {
		return 0, nil
	}
	return owner.Id, nil
}
