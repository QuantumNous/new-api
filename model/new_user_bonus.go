package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const maxNewUserBonusClaimsPerRegistrationIP = 2

type NewUserBonusClaim struct {
	Id             int    `json:"id"`
	RegistrationIP string `json:"registration_ip" gorm:"type:varchar(64);uniqueIndex:idx_new_user_bonus_ip_slot;index"`
	Slot           int    `json:"slot" gorm:"uniqueIndex:idx_new_user_bonus_ip_slot"`
	UserId         int    `json:"user_id" gorm:"uniqueIndex"`
	CreatedAt      int64  `json:"created_at" gorm:"autoCreateTime;index"`
}

func normalizeRegistrationIP(registrationIP string) string {
	return strings.TrimSpace(registrationIP)
}

func prepareLegacyNewUserBonus(user *User) {
	if common.QuotaForNewUser <= 0 {
		user.Quota = 0
		user.NewUserBonusGiven = false
		return
	}
	user.Quota = common.QuotaForNewUser
	user.NewUserBonusGiven = true
}

func claimRegistrationIPNewUserBonusInTx(tx *gorm.DB, user *User) error {
	if common.QuotaForNewUser <= 0 || user == nil || user.Id == 0 || user.RegistrationIP == "" {
		return nil
	}
	for slot := 1; slot <= maxNewUserBonusClaimsPerRegistrationIP; slot++ {
		claim := NewUserBonusClaim{
			RegistrationIP: user.RegistrationIP,
			Slot:           slot,
			UserId:         user.Id,
		}
		insert := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&claim)
		if insert.Error != nil {
			return insert.Error
		}
		if insert.RowsAffected == 0 {
			continue
		}
		user.Quota = common.QuotaForNewUser
		user.NewUserBonusGiven = true
		return tx.Model(&User{}).
			Where("id = ?", user.Id).
			Updates(map[string]any{
				"quota":                user.Quota,
				"new_user_bonus_given": user.NewUserBonusGiven,
			}).Error
	}
	return nil
}
