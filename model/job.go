package model

import (
	"time"
)

// Job 作业模型
type Job struct {
	ID               int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	JobID            string    `json:"job_id" gorm:"uniqueIndex;not null;comment:作业ID"`
	JobName          string    `json:"job_name" gorm:"not null;comment:作业名称"`
	JobDescription   string    `json:"job_description" gorm:"type:text;comment:作业描述"`
	ProjectName      string    `json:"project_name" gorm:"comment:项目名称"`
	ModelName        string    `json:"model_name" gorm:"comment:模型名称"`
	ModelVersion     string    `json:"model_version" gorm:"comment:模型版本"`
	BucketName       string    `json:"bucket_name" gorm:"comment:存储桶名称"`
	InputPath        string    `json:"input_path" gorm:"comment:输入路径"`
	InputObjectKey   string    `json:"input_object_key" gorm:"comment:输入对象键"`
	OutputPath       string    `json:"output_path" gorm:"comment:输出路径"`
	CompletionWindow string    `json:"completion_window" gorm:"comment:完成窗口"`
	Tags             string    `json:"tags" gorm:"type:text;comment:标签"`
	DryRun           bool      `json:"dry_run" gorm:"default:false;comment:是否为试运行"`
	Status           string    `json:"status" gorm:"default:pending;comment:状态"`
	CreatedAt        time.Time `json:"created_at" gorm:"autoCreateTime;comment:创建时间"`
	UpdatedAt        time.Time `json:"updated_at" gorm:"autoUpdateTime;comment:更新时间"`
	UserID           int64     `json:"user_id" gorm:"not null;comment:用户ID"`
	TokenID          int64     `json:"token_id" gorm:"comment:令牌ID"`
	Model            string    `json:"model" gorm:"comment:模型"`
	ChannelID        int64     `json:"channel_id" gorm:"comment:渠道ID"`
	ObjectKey        string    `json:"object_key" gorm:"comment:对象键"`
	Other            string    `json:"other" gorm:"type:text;comment:其他信息"`
}

// TableName 指定表名
func (Job) TableName() string {
	return "jobs"
}

// JobStatus 作业状态常量
const (
	JobStatusPending   = "pending"   // 待处理
	JobStatusRunning   = "running"   // 运行中
	JobStatusCompleted = "completed" // 已完成
	JobStatusFailed    = "failed"    // 失败
	JobStatusCancelled = "cancelled" // 已取消
)

// IsValidStatus 检查状态是否有效
func IsValidStatus(status string) bool {
	validStatuses := []string{
		JobStatusPending,
		JobStatusRunning,
		JobStatusCompleted,
		JobStatusFailed,
		JobStatusCancelled,
	}

	for _, validStatus := range validStatuses {
		if status == validStatus {
			return true
		}
	}
	return false
}
