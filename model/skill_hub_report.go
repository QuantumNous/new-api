package model

import (
	"errors"
	"regexp"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	SkillHubReportNotificationPending  = "pending"
	SkillHubReportNotificationSending  = "sending"
	SkillHubReportNotificationNotified = "notified"
	SkillHubReportNotificationFailed   = "failed"
	SkillHubReportStatusPending        = "pending"
	SkillHubReportStatusResolved       = "resolved"
	SkillHubReportStatusDismissed      = "dismissed"
)

var skillHubReportRequestIDPattern = regexp.MustCompile(`^[A-Za-z0-9._-]{8,128}$`)

var (
	ErrSkillHubReportNotFound = errors.New("skill report not found")
	ErrSkillHubReportConflict = errors.New("skill report was updated by another administrator")
)

type SkillHubReport struct {
	Id                 int    `json:"id" gorm:"primaryKey"`
	RequestID          string `json:"-" gorm:"column:request_id;size:128;not null;uniqueIndex:uk_skill_hub_report_user_request,priority:2"`
	UserID             int    `json:"-" gorm:"column:user_id;not null;uniqueIndex:uk_skill_hub_report_user_request,priority:1;index"`
	SkillInternalID    int    `json:"-" gorm:"column:skill_internal_id;not null;index"`
	SkillID            string `json:"skillId" gorm:"column:skill_id;size:128;not null;index"`
	SkillName          string `json:"skillName" gorm:"size:160;not null"`
	SkillVersion       string `json:"skillVersion" gorm:"size:64"`
	Description        string `json:"description" gorm:"type:text;not null"`
	Status             string `json:"status" gorm:"size:32;not null;default:'pending';index"`
	AdminNote          string `json:"adminNote" gorm:"type:text"`
	HandledBy          int    `json:"handledBy" gorm:"index"`
	HandledTime        int64  `json:"handledTime" gorm:"bigint"`
	Revision           int    `json:"revision" gorm:"not null;default:1"`
	NotificationStatus string `json:"notificationStatus" gorm:"size:32;not null;index"`
	NotificationError  string `json:"-" gorm:"type:text"`
	CreatedTime        int64  `json:"createdTime" gorm:"bigint;index"`
	UpdatedTime        int64  `json:"updatedTime" gorm:"bigint"`
}

func (r *SkillHubReport) BeforeCreate(tx *gorm.DB) error {
	r.RequestID = strings.TrimSpace(r.RequestID)
	r.SkillID = strings.TrimSpace(r.SkillID)
	r.SkillName = strings.TrimSpace(r.SkillName)
	r.SkillVersion = strings.TrimSpace(r.SkillVersion)
	r.Description = strings.TrimSpace(r.Description)
	if !skillHubReportRequestIDPattern.MatchString(r.RequestID) {
		return errors.New("invalid skill report request id")
	}
	if r.UserID <= 0 || r.SkillInternalID <= 0 || r.SkillID == "" || r.SkillName == "" {
		return errors.New("invalid skill report target")
	}
	if r.Description == "" {
		return errors.New("skill report description is required")
	}
	if len([]rune(r.Description)) > 1000 {
		return errors.New("skill report description must be 1000 characters or fewer")
	}
	if r.NotificationStatus == "" {
		r.NotificationStatus = SkillHubReportNotificationPending
	}
	if r.Status == "" {
		r.Status = SkillHubReportStatusPending
	}
	if r.Revision <= 0 {
		r.Revision = 1
	}
	now := common.GetTimestamp()
	if r.CreatedTime == 0 {
		r.CreatedTime = now
	}
	r.UpdatedTime = now
	return nil
}

type SkillHubAdminReport struct {
	Id                 int    `json:"id"`
	ReporterUserID     int    `json:"reporterUserId"`
	ReporterUsername   string `json:"reporterUsername"`
	ReporterEmail      string `json:"reporterEmail"`
	SkillInternalID    int    `json:"skillInternalId"`
	SkillID            string `json:"skillId"`
	SkillName          string `json:"skillName"`
	SkillVersion       string `json:"skillVersion"`
	Description        string `json:"description"`
	Status             string `json:"status"`
	AdminNote          string `json:"adminNote"`
	HandledBy          int    `json:"handledBy"`
	HandledTime        int64  `json:"handledTime"`
	Revision           int    `json:"revision"`
	NotificationStatus string `json:"notificationStatus"`
	CreatedTime        int64  `json:"createdTime"`
	UpdatedTime        int64  `json:"updatedTime"`
}

type SkillHubAdminReportList struct {
	Items []*SkillHubAdminReport `json:"items"`
	Total int64                  `json:"total"`
}

func CreateOrGetSkillHubReport(userID int, requestID string, skill *SkillHubSkill, description string) (*SkillHubReport, bool, error) {
	if skill == nil {
		return nil, false, errors.New("skill is required")
	}
	report := &SkillHubReport{
		RequestID:          requestID,
		UserID:             userID,
		SkillInternalID:    skill.Id,
		SkillID:            skill.SkillID,
		SkillName:          skill.Name,
		SkillVersion:       skill.Version,
		Description:        description,
		NotificationStatus: SkillHubReportNotificationPending,
	}
	result := DB.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "request_id"}},
		DoNothing: true,
	}).Create(report)
	if result.Error != nil {
		return nil, false, result.Error
	}
	if result.RowsAffected > 0 {
		return report, true, nil
	}
	var existing SkillHubReport
	err := DB.Where("user_id = ? AND request_id = ?", userID, strings.TrimSpace(requestID)).First(&existing).Error
	if err != nil {
		return nil, false, err
	}
	return &existing, false, nil
}

func ClaimSkillHubReportNotification(reportID int) (bool, error) {
	if reportID <= 0 {
		return false, errors.New("invalid skill report")
	}
	now := common.GetTimestamp()
	result := DB.Model(&SkillHubReport{}).
		Where(
			"id = ? AND (notification_status IN ? OR (notification_status = ? AND updated_time < ?))",
			reportID,
			[]string{SkillHubReportNotificationPending, SkillHubReportNotificationFailed},
			SkillHubReportNotificationSending,
			now-600,
		).
		Updates(map[string]any{
			"notification_status": SkillHubReportNotificationSending,
			"updated_time":        now,
		})
	return result.RowsAffected == 1, result.Error
}

func FinishSkillHubReportNotification(reportID int, status string, notificationError string) error {
	if reportID <= 0 {
		return errors.New("invalid skill report")
	}
	if status != SkillHubReportNotificationNotified && status != SkillHubReportNotificationFailed {
		return errors.New("invalid skill report notification status")
	}
	if len(notificationError) > 4000 {
		notificationError = notificationError[:4000]
	}
	return DB.Model(&SkillHubReport{}).
		Where("id = ? AND notification_status = ?", reportID, SkillHubReportNotificationSending).
		Updates(map[string]any{
			"notification_status": status,
			"notification_error":  notificationError,
			"updated_time":        common.GetTimestamp(),
		}).Error
}

func SearchSkillHubReports(keyword string, status string, startIdx int, num int) ([]*SkillHubAdminReport, int64, error) {
	if startIdx < 0 || num < 1 || num > 100 {
		return nil, 0, errors.New("invalid skill report pagination")
	}
	query := DB.Table("skill_hub_reports AS reports").
		Joins("LEFT JOIN users AS reporter ON reporter.id = reports.user_id")
	if status != "" {
		if !isSkillHubReportStatus(status) {
			return nil, 0, errors.New("invalid skill report status")
		}
		query = query.Where("reports.status = ?", status)
	}
	if strings.TrimSpace(keyword) != "" {
		pattern, err := skillHubContainsLikePattern(keyword)
		if err != nil {
			return nil, 0, err
		}
		query = query.Where(
			"(reports.skill_id LIKE ? ESCAPE '!' OR reports.skill_name LIKE ? ESCAPE '!' OR reports.description LIKE ? ESCAPE '!' OR reporter.username LIKE ? ESCAPE '!' OR reporter.email LIKE ? ESCAPE '!')",
			pattern,
			pattern,
			pattern,
			pattern,
			pattern,
		)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*SkillHubAdminReport, 0)
	err := query.
		Select(`reports.id,
reports.user_id AS reporter_user_id,
reporter.username AS reporter_username,
reporter.email AS reporter_email,
reports.skill_internal_id,
reports.skill_id,
reports.skill_name,
reports.skill_version,
reports.description,
reports.status,
reports.admin_note,
reports.handled_by,
reports.handled_time,
reports.revision,
reports.notification_status,
reports.created_time,
reports.updated_time`).
		Order("reports.created_time DESC, reports.id DESC").
		Limit(num).
		Offset(startIdx).
		Scan(&items).Error
	return items, total, err
}

func GetSkillHubAdminReport(reportID int) (*SkillHubAdminReport, error) {
	if reportID <= 0 {
		return nil, ErrSkillHubReportNotFound
	}
	items, _, err := searchSkillHubReportsByID(reportID)
	if err != nil {
		return nil, err
	}
	if len(items) == 0 {
		return nil, ErrSkillHubReportNotFound
	}
	return items[0], nil
}

func searchSkillHubReportsByID(reportID int) ([]*SkillHubAdminReport, int64, error) {
	query := DB.Table("skill_hub_reports AS reports").
		Joins("LEFT JOIN users AS reporter ON reporter.id = reports.user_id").
		Where("reports.id = ?", reportID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	items := make([]*SkillHubAdminReport, 0, 1)
	err := query.
		Select(`reports.id,
reports.user_id AS reporter_user_id,
reporter.username AS reporter_username,
reporter.email AS reporter_email,
reports.skill_internal_id,
reports.skill_id,
reports.skill_name,
reports.skill_version,
reports.description,
reports.status,
reports.admin_note,
reports.handled_by,
reports.handled_time,
reports.revision,
reports.notification_status,
reports.created_time,
reports.updated_time`).
		Limit(1).
		Scan(&items).Error
	return items, total, err
}

func UpdateSkillHubReportResolution(reportID int, expectedRevision int, status string, adminNote string, adminID int) (*SkillHubAdminReport, error) {
	status = strings.TrimSpace(status)
	adminNote = strings.TrimSpace(adminNote)
	if reportID <= 0 || expectedRevision <= 0 || adminID <= 0 {
		return nil, errors.New("invalid skill report update")
	}
	if !isSkillHubReportStatus(status) {
		return nil, errors.New("invalid skill report status")
	}
	if len([]rune(adminNote)) > 2000 {
		return nil, errors.New("skill report admin note must be 2000 characters or fewer")
	}
	now := common.GetTimestamp()
	updates := map[string]any{
		"status":       status,
		"admin_note":   adminNote,
		"revision":     gorm.Expr("revision + 1"),
		"updated_time": now,
	}
	if status == SkillHubReportStatusPending {
		updates["handled_by"] = 0
		updates["handled_time"] = 0
	} else {
		updates["handled_by"] = adminID
		updates["handled_time"] = now
	}
	result := DB.Model(&SkillHubReport{}).
		Where("id = ? AND revision = ?", reportID, expectedRevision).
		Updates(updates)
	if result.Error != nil {
		return nil, result.Error
	}
	if result.RowsAffected != 1 {
		var count int64
		if err := DB.Model(&SkillHubReport{}).Where("id = ?", reportID).Count(&count).Error; err != nil {
			return nil, err
		}
		if count == 0 {
			return nil, ErrSkillHubReportNotFound
		}
		return nil, ErrSkillHubReportConflict
	}
	return GetSkillHubAdminReport(reportID)
}

func isSkillHubReportStatus(status string) bool {
	switch status {
	case SkillHubReportStatusPending, SkillHubReportStatusResolved, SkillHubReportStatusDismissed:
		return true
	default:
		return false
	}
}
