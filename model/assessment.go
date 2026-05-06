package model

import (
	"math"
	"time"
)

const (
	AssessmentStatusPending  = 0
	AssessmentStatusActive   = 1
	AssessmentStatusClosed   = 2
)

type Assessment struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	Title       string `json:"title" gorm:"size:255;not null"`
	Description string `json:"description" gorm:"type:text"`
	StartTime   int64  `json:"start_time" gorm:"bigint;not null"`
	EndTime     int64  `json:"end_time" gorm:"bigint;not null"`
	Status      int    `json:"status" gorm:"default:0;not null"`
	MaxScore    int    `json:"max_score" gorm:"default:100;not null"`
	CreatedBy   int    `json:"created_by" gorm:"not null"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (Assessment) TableName() string {
	return "assessments"
}

func (a *Assessment) Insert() error {
	now := time.Now().Unix()
	a.CreatedAt = now
	a.UpdatedAt = now
	return DB.Create(a).Error
}

func (a *Assessment) Update() error {
	a.UpdatedAt = time.Now().Unix()
	return DB.Save(a).Error
}

func DeleteAssessmentByID(id int) error {
	return DB.Delete(&Assessment{}, id).Error
}

func GetAssessmentByID(id int) (*Assessment, error) {
	var a Assessment
	err := DB.First(&a, id).Error
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func GetAllAssessments() ([]Assessment, error) {
	var list []Assessment
	err := DB.Order("created_at DESC").Find(&list).Error
	return list, err
}

func GetActiveAssessments() ([]Assessment, error) {
	now := time.Now().Unix()
	var list []Assessment
	err := DB.Where("status = ? AND start_time <= ? AND end_time >= ?",
		AssessmentStatusActive, now, now).
		Order("created_at DESC").Find(&list).Error
	return list, err
}

func UpdateAssessmentStatus() {
	now := time.Now().Unix()
	DB.Model(&Assessment{}).Where("status = ? AND start_time <= ? AND end_time >= ?",
		AssessmentStatusPending, now, now).
		Update("status", AssessmentStatusActive)
	DB.Model(&Assessment{}).Where("status = ? AND end_time < ?",
		AssessmentStatusActive, now).
		Update("status", AssessmentStatusClosed)
}

func HasAssessmentActive() (bool, error) {
	now := time.Now().Unix()
	var count int64
	err := DB.Model(&Assessment{}).
		Where("status = ? AND start_time <= ? AND end_time >= ?",
			AssessmentStatusActive, now, now).
		Count(&count).Error
	return count > 0, err
}

func GetUserAssessmentStats(userId int) (map[string]interface{}, error) {
	var total int64
	var passed int64
	var totalScore float64
	DB.Model(&AssessmentSubmission{}).
		Where("user_id = ?", userId).Count(&total)
	DB.Model(&AssessmentSubmission{}).
		Where("user_id = ? AND status = ?", userId, SubmissionStatusPassed).Count(&passed)
	row := DB.Model(&AssessmentSubmission{}).
		Where("user_id = ?", userId).
		Select("COALESCE(SUM(score), 0)").Row()
	if err := row.Scan(&totalScore); err != nil {
		return nil, err
	}

	var avgScore float64
	if total > 0 {
		avgScore = totalScore / float64(total)
	}
	return map[string]interface{}{
		"total_submissions": total,
		"passed":            passed,
		"average_score":     math.Round(avgScore*100) / 100,
	}, nil
}
