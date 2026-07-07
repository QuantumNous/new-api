package model

import (
	"errors"
	"strings"
	"time"

	"gorm.io/gorm"
)

const (
	AutoGroupConfidenceHigh   = "high"
	AutoGroupConfidenceMedium = "medium"
	AutoGroupConfidenceLow    = "low"

	AutoGroupActionAutoApply       = "auto_apply"
	AutoGroupActionConfirmRequired = "confirm_required"
	AutoGroupActionSkip            = "skip"

	AutoGroupSuggestionPending = "pending"
	AutoGroupSuggestionApplied = "applied"
	AutoGroupSuggestionSkipped = "skipped"
)

type AutoGroupSuggestion struct {
	Id             int    `json:"id" gorm:"primaryKey"`
	UserId         int    `json:"user_id" gorm:"index"`
	Username       string `json:"username" gorm:"type:varchar(64)"`
	DisplayName    string `json:"display_name" gorm:"type:varchar(255)"`
	Email          string `json:"email" gorm:"type:varchar(255)"`
	CurrentGroup   string `json:"current_group" gorm:"type:varchar(64);index"`
	SuggestedGroup string `json:"suggested_group" gorm:"type:varchar(64);index"`
	Confidence     string `json:"confidence" gorm:"type:varchar(32);index"`
	Action         string `json:"action" gorm:"type:varchar(32);index"`
	Reason         string `json:"reason" gorm:"type:varchar(512)"`
	Source         string `json:"source" gorm:"type:varchar(64);index"`
	Status         string `json:"status" gorm:"type:varchar(32);index"`
	JobTitle       string `json:"job_title" gorm:"type:varchar(255);index"`
	OrgLevel1Name  string `json:"org_level1_name" gorm:"type:varchar(255);index"`
	OrgLevel2Name  string `json:"org_level2_name" gorm:"type:varchar(255);index"`
	DepartmentName string `json:"department_name" gorm:"type:varchar(255);index"`
	ParentDeptName string `json:"parent_department_name" gorm:"type:varchar(255);index"`
	OrgPath        string `json:"org_path" gorm:"type:text"`
	SnapshotJson   string `json:"snapshot_json" gorm:"type:text"`
	CreatedAt      int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt      int64  `json:"updated_at" gorm:"bigint"`
}

func (AutoGroupSuggestion) TableName() string {
	return "auto_group_suggestions"
}

type AutoGroupConfirmation struct {
	Id                   int    `json:"id" gorm:"primaryKey"`
	UserId               int    `json:"user_id" gorm:"index"`
	JobTitle             string `json:"job_title" gorm:"type:varchar(255);index"`
	OrgLevel1Name        string `json:"org_level1_name" gorm:"type:varchar(255);index"`
	OrgLevel2Name        string `json:"org_level2_name" gorm:"type:varchar(255);index"`
	ParentDepartmentName string `json:"parent_department_name" gorm:"type:varchar(255);index"`
	DepartmentName       string `json:"department_name" gorm:"type:varchar(255);index"`
	OrgPath              string `json:"org_path" gorm:"type:text"`
	FromGroup            string `json:"from_group" gorm:"type:varchar(64);index"`
	ConfirmedGroup       string `json:"confirmed_group" gorm:"type:varchar(64);index"`
	OperatorId           int    `json:"operator_id" gorm:"index"`
	CreatedAt            int64  `json:"created_at" gorm:"bigint"`
}

func (AutoGroupConfirmation) TableName() string {
	return "auto_group_confirmations"
}

type AutoGroupLearnedRule struct {
	Id                      int    `json:"id" gorm:"primaryKey"`
	TargetGroup             string `json:"target_group" gorm:"type:varchar(64);index"`
	JobTitleKeyword         string `json:"job_title_keyword" gorm:"type:varchar(255);index"`
	DepartmentKeyword       string `json:"department_keyword" gorm:"type:varchar(255);index"`
	ParentDepartmentKeyword string `json:"parent_department_keyword" gorm:"type:varchar(255);index"`
	OrgLevel1Keyword        string `json:"org_level1_keyword" gorm:"type:varchar(255);index"`
	Confidence              string `json:"confidence" gorm:"type:varchar(32)"`
	Enabled                 bool   `json:"enabled" gorm:"index"`
	SampleCount             int    `json:"sample_count"`
	Remark                  string `json:"remark" gorm:"type:varchar(256)"`
	CreatedAt               int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt               int64  `json:"updated_at" gorm:"bigint"`
}

func (AutoGroupLearnedRule) TableName() string {
	return "auto_group_learned_rules"
}

func ListUsersForAutoGroupReplay() ([]User, error) {
	var users []User
	err := DB.Find(&users).Error
	return users, err
}

func ReplaceAutoGroupPendingSuggestions(suggestions []AutoGroupSuggestion) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("status = ?", AutoGroupSuggestionPending).Delete(&AutoGroupSuggestion{}).Error; err != nil {
			return err
		}
		if len(suggestions) == 0 {
			return nil
		}
		now := time.Now().Unix()
		for i := range suggestions {
			suggestions[i].CreatedAt = now
			suggestions[i].UpdatedAt = now
			if suggestions[i].Status == "" {
				suggestions[i].Status = AutoGroupSuggestionPending
			}
		}
		return tx.Create(&suggestions).Error
	})
}

func ListAutoGroupSuggestions(status string) ([]AutoGroupSuggestion, error) {
	var suggestions []AutoGroupSuggestion
	query := DB.Model(&AutoGroupSuggestion{})
	if strings.TrimSpace(status) != "" {
		query = query.Where("status = ?", strings.TrimSpace(status))
	}
	err := query.Order("action asc, confidence asc, id asc").Find(&suggestions).Error
	return suggestions, err
}

func GetAutoGroupSuggestionById(id int) (*AutoGroupSuggestion, error) {
	if id <= 0 {
		return nil, errors.New("invalid suggestion id")
	}
	var suggestion AutoGroupSuggestion
	err := DB.First(&suggestion, id).Error
	if err != nil {
		return nil, err
	}
	return &suggestion, nil
}

func UpdateAutoGroupSuggestionStatus(id int, status string) error {
	if id <= 0 {
		return errors.New("invalid suggestion id")
	}
	return DB.Model(&AutoGroupSuggestion{}).Where("id = ?", id).Updates(map[string]any{
		"status":     status,
		"updated_at": time.Now().Unix(),
	}).Error
}

func CreateAutoGroupConfirmation(confirmation *AutoGroupConfirmation) error {
	if confirmation == nil {
		return errors.New("confirmation is nil")
	}
	confirmation.CreatedAt = time.Now().Unix()
	return DB.Create(confirmation).Error
}

func CountAutoGroupSuggestionsByStatus(status string) (map[string]int64, error) {
	result := map[string]int64{}
	types := []string{AutoGroupActionAutoApply, AutoGroupActionConfirmRequired, AutoGroupActionSkip}
	for _, action := range types {
		var count int64
		query := DB.Model(&AutoGroupSuggestion{}).Where("action = ?", action)
		if status != "" {
			query = query.Where("status = ?", status)
		}
		if err := query.Count(&count).Error; err != nil {
			return nil, err
		}
		result[action] = count
	}
	return result, nil
}
