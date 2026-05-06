package model

import (
	"database/sql/driver"
	"encoding/json"
	"math"
	"time"
)

const (
	SubmissionStatusPending = 0
	SubmissionStatusPassed  = 1
	SubmissionStatusFailed  = 2
)

type ScreenshotsJSON []string

func (s ScreenshotsJSON) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *ScreenshotsJSON) Scan(value interface{}) error {
	switch v := value.(type) {
	case nil:
		*s = nil
		return nil
	case []byte:
		return json.Unmarshal(v, s)
	case string:
		return json.Unmarshal([]byte(v), s)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			return err
		}
		return json.Unmarshal(b, s)
	}
}

func (s ScreenshotsJSON) MarshalJSON() ([]byte, error) {
	if s == nil {
		return []byte("null"), nil
	}
	return json.Marshal([]string(s))
}

type AssessmentSubmission struct {
	Id           int             `json:"id" gorm:"primaryKey;autoIncrement"`
	AssessmentId int             `json:"assessment_id" gorm:"index;not null"`
	UserId       int             `json:"user_id" gorm:"index;not null"`
	Content      string          `json:"content" gorm:"type:text"`
	Screenshots  ScreenshotsJSON `json:"screenshots" gorm:"type:text"`
	Status       int             `json:"status" gorm:"default:0;not null"`
	Score        *float64        `json:"score" gorm:"default:null"`
	Comment      string          `json:"comment" gorm:"type:text"`
	ReviewedBy   int             `json:"reviewed_by" gorm:"default:0"`
	SubmittedAt  int64           `json:"submitted_at" gorm:"bigint"`
	ReviewedAt   int64           `json:"reviewed_at" gorm:"bigint"`
}

func (AssessmentSubmission) TableName() string {
	return "assessment_submissions"
}

func (s *AssessmentSubmission) Insert() error {
	s.SubmittedAt = time.Now().Unix()
	return DB.Create(s).Error
}

func (s *AssessmentSubmission) Update() error {
	return DB.Save(s).Error
}

func GetSubmissionByID(id int) (*AssessmentSubmission, error) {
	var s AssessmentSubmission
	err := DB.First(&s, id).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func GetUserSubmissions(userId int) ([]AssessmentSubmission, error) {
	var list []AssessmentSubmission
	err := DB.Where("user_id = ?", userId).
		Order("submitted_at DESC").Find(&list).Error
	return list, err
}

func GetSubmissionsByAssessment(assessmentId int) ([]AssessmentSubmission, error) {
	var list []AssessmentSubmission
	err := DB.Where("assessment_id = ?", assessmentId).
		Order("submitted_at DESC").Find(&list).Error
	return list, err
}

func GetUserSubmissionByAssessment(userId, assessmentId int) (*AssessmentSubmission, error) {
	var s AssessmentSubmission
	err := DB.Where("user_id = ? AND assessment_id = ?", userId, assessmentId).
		First(&s).Error
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func ReviewSubmission(id int, status int, score float64, comment string, reviewedBy int) error {
	now := time.Now().Unix()
	return DB.Model(&AssessmentSubmission{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":      status,
		"score":       score,
		"comment":     comment,
		"reviewed_by": reviewedBy,
		"reviewed_at": now,
	}).Error
}

func GetAssessmentSubmissionStats(assessmentId int) (map[string]interface{}, error) {
	var total int64
	var pending int64
	var passed int64
	var failed int64
	var totalScore float64

	DB.Model(&AssessmentSubmission{}).
		Where("assessment_id = ?", assessmentId).Count(&total)
	DB.Model(&AssessmentSubmission{}).
		Where("assessment_id = ? AND status = ?", assessmentId, SubmissionStatusPending).Count(&pending)
	DB.Model(&AssessmentSubmission{}).
		Where("assessment_id = ? AND status = ?", assessmentId, SubmissionStatusPassed).Count(&passed)
	DB.Model(&AssessmentSubmission{}).
		Where("assessment_id = ? AND status = ?", assessmentId, SubmissionStatusFailed).Count(&failed)

	row := DB.Model(&AssessmentSubmission{}).
		Where("assessment_id = ? AND status != ?", assessmentId, SubmissionStatusPending).
		Select("COALESCE(AVG(score), 0)").Row()
	if err := row.Scan(&totalScore); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"total":         total,
		"pending":       pending,
		"passed":        passed,
		"failed":        failed,
		"average_score": math.Round(totalScore*100) / 100,
	}, nil
}
