package model

import (
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

type Feedback struct {
	Id          int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	Username    string         `json:"username" gorm:"size:64;not null;index"`
	Email       string         `json:"email" gorm:"size:255;not null;index"`
	Category    string         `json:"category" gorm:"size:32;not null;index"`
	Content     string         `json:"content" gorm:"type:text;not null"`
	CreatedTime int64          `json:"created_time" gorm:"index"`
	UpdatedTime int64          `json:"updated_time"`
	DeletedAt   gorm.DeletedAt `json:"-" gorm:"index"`
}

func (f *Feedback) Insert() error {
	return DB.Create(f).Error
}

func GetAllFeedbacks(category string, keyword string, startIdx int, num int) ([]*Feedback, int64, error) {
	var feedbacks []*Feedback
	var total int64

	tx := DB.Model(&Feedback{})
	if category != "" {
		tx = tx.Where("category = ?", category)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		likeKeyword := "%" + keyword + "%"
		tx = tx.Where("username LIKE ? OR email LIKE ? OR content LIKE ?", likeKeyword, likeKeyword, likeKeyword)
	}

	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := tx.Order("id desc").Limit(num).Offset(startIdx).Find(&feedbacks).Error; err != nil {
		return nil, 0, err
	}

	return feedbacks, total, nil
}

func SeedFeedbackForTest(username string, email string, category string, content string) *Feedback {
	return &Feedback{
		Username:    username,
		Email:       email,
		Category:    category,
		Content:     content,
		CreatedTime: common.GetTimestamp(),
		UpdatedTime: common.GetTimestamp(),
	}
}
