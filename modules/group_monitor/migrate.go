package group_monitor

import (
	"github.com/QuantumNous/new-api/model"
)

// Migrate 执行分组监控模块的数据库迁移
func Migrate() error {
	return model.DB.AutoMigrate(&GroupMonitorLog{}, &GroupMonitorConfig{})
}
