package operation_setting

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
)

const SystemTaskRetentionDaysOptionKey = "system_task_setting.retention_days"

// SystemTaskSetting controls the history of system tasks.
type SystemTaskSetting struct {
	// RetentionDays is how long finished tasks are kept; a daily task deletes
	// older ones.
	RetentionDays int `json:"retention_days"`
}

var systemTaskSetting = SystemTaskSetting{
	RetentionDays: 30,
}

func init() {
	config.GlobalConfig.Register("system_task_setting", &systemTaskSetting)
}

func GetSystemTaskSetting() *SystemTaskSetting {
	return &systemTaskSetting
}

func ValidateSystemTaskRetentionDays(value string) error {
	days, err := strconv.Atoi(value)
	if err != nil || days < 1 {
		return common.NewMessage("System task history must be kept for at least 1 day")
	}
	return nil
}
