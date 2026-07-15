package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"

	"gorm.io/gorm"
)

const ChatModelAutoKey = "global"

type ChatModelOption struct {
	Id               int     `json:"id"`
	ModelName        string  `json:"model" gorm:"size:255;not null;uniqueIndex"`
	DisplayName      string  `json:"name" gorm:"size:255"`
	ApiFormat        string  `json:"api" gorm:"size:32"`
	InputTypes       string  `json:"-" gorm:"type:text"`
	ContextWindow    int     `json:"contextWindow"`
	ContextTokens    int     `json:"contextTokens"`
	MaxTokens        int     `json:"maxTokens"`
	Reasoning        bool    `json:"reasoning"`
	ThinkingLevels   string  `json:"-" gorm:"type:text"`
	ThinkingDefault  string  `json:"thinkingDefault" gorm:"size:64"`
	SupportsFastMode bool    `json:"supportsFastMode" gorm:"not null;default:false"`
	Enabled          bool    `json:"enabled" gorm:"index"`
	IsAuto           bool    `json:"is_auto" gorm:"index"`
	AutoKey          *string `json:"-" gorm:"size:32;uniqueIndex"`
	Sort             int     `json:"sort" gorm:"index"`
	CreatedTime      int64   `json:"created_time" gorm:"bigint"`
	UpdatedTime      int64   `json:"updated_time" gorm:"bigint"`
}

type ChatModelOptionUpdates struct {
	ModelName        *string
	DisplayName      *string
	ApiFormat        *string
	InputTypes       *string
	ContextWindow    *int
	ContextTokens    *int
	MaxTokens        *int
	Reasoning        *bool
	ThinkingLevels   *string
	ThinkingDefault  *string
	SupportsFastMode *bool
	Enabled          *bool
	IsAuto           *bool
	Sort             *int
}

func CreateChatModelOption(option *ChatModelOption) error {
	now := common.GetTimestamp()
	option.CreatedTime = now
	option.UpdatedTime = now

	shouldSetAuto := option.IsAuto
	option.IsAuto = false
	option.AutoKey = nil

	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(option).Error; err != nil {
			return err
		}
		if shouldSetAuto {
			if err := setChatModelAutoTx(tx, option.Id, true); err != nil {
				return err
			}
			return tx.First(option, option.Id).Error
		}
		return nil
	})
}

func UpdateChatModelOption(id int, updates ChatModelOptionUpdates) (*ChatModelOption, error) {
	var option ChatModelOption
	err := DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.First(&option, id).Error; err != nil {
			return err
		}

		updateFields := map[string]interface{}{}
		if updates.ModelName != nil {
			updateFields["model_name"] = *updates.ModelName
		}
		if updates.DisplayName != nil {
			updateFields["display_name"] = *updates.DisplayName
		}
		if updates.ApiFormat != nil {
			updateFields["api_format"] = *updates.ApiFormat
		}
		if updates.InputTypes != nil {
			updateFields["input_types"] = *updates.InputTypes
		}
		if updates.ContextWindow != nil {
			updateFields["context_window"] = *updates.ContextWindow
		}
		if updates.ContextTokens != nil {
			updateFields["context_tokens"] = *updates.ContextTokens
		}
		if updates.MaxTokens != nil {
			updateFields["max_tokens"] = *updates.MaxTokens
		}
		if updates.Reasoning != nil {
			updateFields["reasoning"] = *updates.Reasoning
		}
		if updates.ThinkingLevels != nil {
			updateFields["thinking_levels"] = *updates.ThinkingLevels
		}
		if updates.ThinkingDefault != nil {
			updateFields["thinking_default"] = *updates.ThinkingDefault
		}
		if updates.SupportsFastMode != nil {
			updateFields["supports_fast_mode"] = *updates.SupportsFastMode
		}
		if updates.Enabled != nil {
			updateFields["enabled"] = *updates.Enabled
		}
		if updates.Sort != nil {
			updateFields["sort"] = *updates.Sort
		}
		if len(updateFields) > 0 {
			updateFields["updated_time"] = common.GetTimestamp()
			if err := tx.Model(&ChatModelOption{}).Where("id = ?", id).Updates(updateFields).Error; err != nil {
				return err
			}
		}
		if updates.IsAuto != nil {
			if err := setChatModelAutoTx(tx, id, *updates.IsAuto); err != nil {
				return err
			}
		}
		return tx.First(&option, id).Error
	})
	if err != nil {
		return nil, err
	}
	return &option, nil
}

func DeleteChatModelOption(id int) error {
	return DB.Delete(&ChatModelOption{}, id).Error
}

func GetChatModelOptionByID(id int) (*ChatModelOption, error) {
	var option ChatModelOption
	if err := DB.First(&option, id).Error; err != nil {
		return nil, err
	}
	return &option, nil
}

func GetEnabledChatModelOptions() ([]ChatModelOption, error) {
	var options []ChatModelOption
	err := DB.Where("enabled = ?", true).Order("sort ASC").Order("id ASC").Find(&options).Error
	return options, err
}

func GetAllChatModelOptions(keyword string, enabled *bool) ([]ChatModelOption, error) {
	var options []ChatModelOption
	query := DB.Model(&ChatModelOption{})
	keyword = strings.TrimSpace(keyword)
	if keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("model_name LIKE ? OR display_name LIKE ?", like, like)
	}
	if enabled != nil {
		query = query.Where("enabled = ?", *enabled)
	}
	err := query.Order("sort ASC").Order("id ASC").Find(&options).Error
	return options, err
}

func GetChatModelOptionModelMap() (map[string]ChatModelOption, error) {
	var options []ChatModelOption
	if err := DB.Find(&options).Error; err != nil {
		return nil, err
	}
	result := make(map[string]ChatModelOption, len(options))
	for _, option := range options {
		result[option.ModelName] = option
	}
	return result, nil
}

func IsChatModelOptionDuplicated(id int, name string) (bool, error) {
	if strings.TrimSpace(name) == "" {
		return false, nil
	}
	var count int64
	err := DB.Model(&ChatModelOption{}).Where("model_name = ? AND id <> ?", name, id).Count(&count).Error
	return count > 0, err
}

func setChatModelAutoTx(tx *gorm.DB, id int, isAuto bool) error {
	now := common.GetTimestamp()
	if !isAuto {
		return tx.Model(&ChatModelOption{}).Where("id = ?", id).Updates(map[string]interface{}{
			"is_auto":      false,
			"auto_key":     nil,
			"updated_time": now,
		}).Error
	}

	if err := tx.Model(&ChatModelOption{}).Where("is_auto = ?", true).Updates(map[string]interface{}{
		"is_auto":      false,
		"auto_key":     nil,
		"updated_time": now,
	}).Error; err != nil {
		return err
	}

	autoKey := ChatModelAutoKey
	return tx.Model(&ChatModelOption{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_auto":      true,
		"auto_key":     &autoKey,
		"updated_time": now,
	}).Error
}
