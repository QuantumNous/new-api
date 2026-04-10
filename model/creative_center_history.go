package model

import (
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type CreativeCenterHistoryPayload string

func (CreativeCenterHistoryPayload) GormDataType() string {
	return "text"
}

func (CreativeCenterHistoryPayload) GormDBDataType(db *gorm.DB, _ *schema.Field) string {
	switch db.Dialector.Name() {
	case "mysql":
		return "MEDIUMTEXT"
	default:
		return "TEXT"
	}
}

type CreativeCenterHistory struct {
	ID        int64                        `json:"id" gorm:"primaryKey;autoIncrement"`
	CreatedAt int64                        `json:"created_at" gorm:"bigint;index"`
	UpdatedAt int64                        `json:"updated_at" gorm:"bigint;index"`
	UserId    int                          `json:"user_id" gorm:"uniqueIndex:idx_creative_center_user_tab;index"`
	Tab       string                       `json:"tab" gorm:"type:varchar(20);uniqueIndex:idx_creative_center_user_tab;index"`
	ModelName string                       `json:"model_name" gorm:"type:varchar(191);default:''"`
	Group     string                       `json:"group" gorm:"type:varchar(50);default:''"`
	Prompt    string                       `json:"prompt" gorm:"type:text"`
	Payload   CreativeCenterHistoryPayload `json:"payload"`
}

var creativeCenterAllowedTabs = map[string]struct{}{
	"chat":  {},
	"image": {},
	"video": {},
}

func ValidateCreativeCenterTab(tab string) error {
	if _, ok := creativeCenterAllowedTabs[tab]; ok {
		return nil
	}
	return fmt.Errorf("invalid creative center tab: %s", tab)
}

func UpsertCreativeCenterHistory(userId int, tab string, modelName string, group string, prompt string, payload any) (*CreativeCenterHistory, error) {
	if err := ValidateCreativeCenterTab(tab); err != nil {
		return nil, err
	}

	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, err
	}

	now := common.GetTimestamp()
	history := &CreativeCenterHistory{}
	err = DB.Where("user_id = ? AND tab = ?", userId, tab).First(history).Error
	if err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		history = &CreativeCenterHistory{
			UserId:    userId,
			Tab:       tab,
			ModelName: modelName,
			Group:     group,
			Prompt:    prompt,
			Payload:   CreativeCenterHistoryPayload(string(payloadBytes)),
			CreatedAt: now,
			UpdatedAt: now,
		}
		if err = DB.Create(history).Error; err != nil {
			return nil, err
		}
		return history, nil
	}

	history.ModelName = modelName
	history.Group = group
	history.Prompt = prompt
	history.Payload = CreativeCenterHistoryPayload(string(payloadBytes))
	history.UpdatedAt = now
	if err = DB.Save(history).Error; err != nil {
		return nil, err
	}
	return history, nil
}

func ListCreativeCenterHistoriesByUser(userId int) ([]*CreativeCenterHistory, error) {
	var histories []*CreativeCenterHistory
	err := DB.Where("user_id = ?", userId).Order("updated_at desc").Find(&histories).Error
	return histories, err
}

func DeleteCreativeCenterHistory(userId int, tab string) error {
	if err := ValidateCreativeCenterTab(tab); err != nil {
		return err
	}
	return DB.Where("user_id = ? AND tab = ?", userId, tab).Delete(&CreativeCenterHistory{}).Error
}
