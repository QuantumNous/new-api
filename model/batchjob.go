package model

import "time"

/*
	{
	  "access_key": "YOUR_ACCESS_KEY",
	  "secret_key": "YOUR_SECRET_KEY",
	  "endpoint": "tos-cn-beijing.volces.com",
	  "internal_endpoint": "tos-cn-beijing.ivolces.com",
	  "region": "tos-cn-beijing",
	  "expires":259200,
	  "project_name":"jiang",
	  "bucket_name": "batch-job-jiang"
	}
*/
type BatchJob struct {
	ID               int       `json:"id" gorm:"primaryKey;autoIncrement"`
	JobID            string    `json:"job_id" gorm:"uniqueIndex;not null;comment:作业ID"`
	JobName          string    `json:"job_name" gorm:"not null;comment:作业名称"`
	JobDescription   string    `json:"job_description" gorm:"type:text;comment:作业描述"`
	ProjectName      string    `json:"project_name" gorm:"comment:项目名称"`
	ModelName        string    `json:"model_name" gorm:"comment:模型名称"`
	ModelVersion     string    `json:"model_version" gorm:"comment:模型版本"`
	BucketName       string    `json:"bucket_name" gorm:"comment:存储桶名称"`
	Region           string    `json:"region" gorm:"comment:区域"`
	Endpoint         string    `json:"endpoint" gorm:"comment:终端节点"`
	InternalEndpoint string    `json:"internal_endpoint" gorm:"comment:内部终端节点"`
	InputPath        string    `json:"input_path" gorm:"comment:输入路径"`
	OutputPath       string    `json:"output_path" gorm:"comment:输出路径"`
	CompletionWindow string    `json:"completion_window" gorm:"comment:完成窗口"`
	Tags             string    `json:"tags" gorm:"type:text;comment:标签"`
	DryRun           bool      `json:"dry_run" gorm:"default:false;comment:是否为试运行"`
	Status           string    `json:"status" gorm:"default:'pending';comment:状态：registered, pending, running, completed, failed, cancelled"`
	CreatedAt        time.Time `json:"created_at" gorm:"autoCreateTime;comment:创建时间"`
	UpdatedAt        time.Time `json:"updated_at" gorm:"autoUpdateTime;comment:更新时间"`
	UserID           int       `json:"user_id" gorm:"not null;index;comment:用户ID"`
	TokenID          int       `json:"token_id" gorm:"comment:令牌ID"`
	Model            string    `json:"model" gorm:"comment:模型"`
	ChannelID        int       `json:"channel_id" gorm:"comment:渠道ID"`
	ObjectKey        string    `json:"object_key" gorm:"comment:对象键"`
	Other            string    `json:"other" gorm:"type:text;comment:其他信息"`
}

// Update 更新批处理作业
func (job *BatchJob) Update() error {
	return DB.Save(job).Error
}
