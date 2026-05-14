package agent

import (
	"context"

	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func IsToolEnabled(ctx context.Context, name string) bool {
	var setting model.AgentToolSetting
	err := model.DB.WithContext(ctx).Where("tool_name = ?", name).First(&setting).Error
	if err == nil {
		return setting.Enabled
	}
	return err == gorm.ErrRecordNotFound
}
