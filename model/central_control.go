package model

import (
	"time"
)

// UserRateLimitConfig 用户限速配置表
type UserRateLimitConfig struct {
	Id                 int64     `json:"id" gorm:"primaryKey;autoIncrement;comment:主键ID"`
	SiteName           string    `json:"site_name" gorm:"type:varchar(100);not null;comment:站点名"`
	Username           string    `json:"username" gorm:"type:varchar(100);not null;comment:用户名"`
	UserId             int64     `json:"user_id" gorm:"not null;comment:用户ID"`
	GroupName          string    `json:"group_name" gorm:"type:varchar(100);not null;comment:分组名"`
	GroupId            int64     `json:"group_id" gorm:"not null;comment:分组ID"`
	ModelName          string    `json:"model_name" gorm:"type:varchar(100);not null;comment:模型名"`
	SuggestedRateLimit int       `json:"suggested_rate_limit" gorm:"not null;default:60;comment:建议限速大小(rpm)"`
	IsRateLimitEnabled bool      `json:"is_rate_limit_enabled" gorm:"not null;default:false;comment:是否启用限速(1:启用, 0:禁用)"`
	CurrentRateLimit   int       `json:"current_rate_limit" gorm:"not null;default:60;comment:当前限速(rpm)"`
	CreatedAt          time.Time `json:"created_at" gorm:"autoCreateTime;comment:创建时间"`
	UpdatedAt          time.Time `json:"updated_at" gorm:"autoUpdateTime;comment:更新时间"`
}

// TableName 指定表名
func (UserRateLimitConfig) TableName() string {
	return "user_rate_limit_config"
}

// GetUserRateLimitConfig 获取用户限速配置
func GetUserRateLimitConfig(username, groupName, modelName string) (*UserRateLimitConfig, error) {
	var config UserRateLimitConfig
	err := CENTRAL_DB.Where("site_name = ? AND username = ? AND group_name = ? AND model_name = ?", "newapi-prod-center", username, groupName, modelName).First(&config).Error
	if err != nil {
		return nil, err
	}
	return &config, nil
}
