package model

import (
	"errors"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type CCSwitchImportLog struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"index"`
	TokenId     int    `json:"token_id" gorm:"index"`
	Target      string `json:"target" gorm:"type:varchar(64)"`
	Model       string `json:"model" gorm:"type:varchar(255)"`
	HaikuModel  string `json:"haiku_model,omitempty" gorm:"type:varchar(255)"`
	SonnetModel string `json:"sonnet_model,omitempty" gorm:"type:varchar(255)"`
	OpusModel   string `json:"opus_model,omitempty" gorm:"type:varchar(255)"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint;index"`
	Ip          string `json:"ip" gorm:"type:varchar(64)"`
	UserAgent   string `json:"user_agent" gorm:"type:varchar(512)"`
}

func (CCSwitchImportLog) TableName() string {
	return "ccswitch_import_logs"
}

type UserCCSwitchPreference struct {
	Id              int    `json:"id"`
	UserId          int    `json:"user_id" gorm:"uniqueIndex"`
	LastTarget      string `json:"last_target" gorm:"type:varchar(64)"`
	LastModel       string `json:"last_model" gorm:"type:varchar(255)"`
	LastHaikuModel  string `json:"last_haiku_model,omitempty" gorm:"type:varchar(255)"`
	LastSonnetModel string `json:"last_sonnet_model,omitempty" gorm:"type:varchar(255)"`
	LastOpusModel   string `json:"last_opus_model,omitempty" gorm:"type:varchar(255)"`
	UpdatedAt       int64  `json:"updated_at" gorm:"bigint"`
}

func (UserCCSwitchPreference) TableName() string {
	return "user_ccswitch_preferences"
}

func CreateCCSwitchImportLog(log *CCSwitchImportLog) error {
	return DB.Create(log).Error
}

func GetUserCCSwitchPreference(userId int) (*UserCCSwitchPreference, error) {
	var preference UserCCSwitchPreference
	err := DB.Where("user_id = ?", userId).First(&preference).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &preference, nil
}

func UpsertUserCCSwitchPreference(preference *UserCCSwitchPreference) error {
	return DB.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}},
		DoUpdates: clause.Assignments(map[string]interface{}{
			"last_target":       preference.LastTarget,
			"last_model":        preference.LastModel,
			"last_haiku_model":  preference.LastHaikuModel,
			"last_sonnet_model": preference.LastSonnetModel,
			"last_opus_model":   preference.LastOpusModel,
			"updated_at":        preference.UpdatedAt,
		}),
	}).Create(preference).Error
}
