package model

import (
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Personal prompt templates are durable account data, not expiring images.
type DrawingTemplate struct {
	ID        string `json:"id" gorm:"type:varchar(36);primaryKey"`
	UserID    int    `json:"-" gorm:"index"`
	Name      string `json:"name" gorm:"type:varchar(80)"`
	Prompt    string `json:"prompt" gorm:"type:text"`
	UpdatedAt int64  `json:"updated_at"`
}

var ErrDrawingTemplateLimit = errors.New("You can save up to 20 prompt templates")
var ErrInvalidDrawingTemplate = errors.New("Enter a template name and prompt within the allowed length")

func ListDrawingTemplates(userID int) ([]DrawingTemplate, error) {
	items := []DrawingTemplate{}
	err := DB.Where("user_id = ?", userID).Order("updated_at DESC, id ASC").Find(&items).Error
	return items, err
}

func SaveDrawingTemplate(userID int, id, name, prompt string) (*DrawingTemplate, error) {
	name = strings.TrimSpace(name)
	if name == "" || utf8.RuneCountInString(name) > 80 || strings.TrimSpace(prompt) == "" || len(prompt) > 16000 {
		return nil, ErrInvalidDrawingTemplate
	}
	item := &DrawingTemplate{ID: id, UserID: userID, Name: name, Prompt: prompt, UpdatedAt: time.Now().Unix()}
	err := drawingQueueTransaction(func(tx *gorm.DB) error {
		if id != "" {
			var existing DrawingTemplate
			if err := tx.Where("id = ? AND user_id = ?", id, userID).First(&existing).Error; err != nil {
				return err
			}
			return tx.Model(&existing).Updates(map[string]any{"name": name, "prompt": prompt, "updated_at": item.UpdatedAt}).Error
		}
		var count int64
		if err := tx.Model(&DrawingTemplate{}).Where("user_id = ?", userID).Count(&count).Error; err != nil {
			return err
		}
		if count >= 20 {
			return ErrDrawingTemplateLimit
		}
		item.ID = uuid.NewString()
		return tx.Create(item).Error
	})
	return item, err
}

func DeleteDrawingTemplate(userID int, id string) error {
	result := DB.Where("id = ? AND user_id = ?", id, userID).Delete(&DrawingTemplate{})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}
