package requestaudit

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/gorm"
)

var logDB *gorm.DB

func Init(db *gorm.DB) error {
	logDB = db
	if db == nil {
		return nil
	}
	if err := db.AutoMigrate(&RelayAuditRecord{}); err != nil {
		return fmt.Errorf("requestaudit: auto migrate: %w", err)
	}
	cfg := loadConfig()
	if cfg.Enabled {
		common.SysLog(fmt.Sprintf("requestaudit: enabled (max_body_kb=%d, sample_rate=%d%%)", cfg.MaxBodyKB, cfg.SampleRate))
	}
	return nil
}
