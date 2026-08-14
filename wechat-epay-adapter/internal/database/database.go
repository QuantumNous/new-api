package database

import (
	"fmt"

	"github.com/QuantumNous/new-api/wechat-epay-adapter/internal/config"
	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Open(config config.Config) (*gorm.DB, error) {
	var dialector gorm.Dialector
	switch config.DatabaseType {
	case "sqlite":
		dialector = sqlite.Open(config.DatabaseDSN)
	case "mysql":
		dialector = mysql.Open(config.DatabaseDSN)
	case "postgres":
		dialector = postgres.Open(config.DatabaseDSN)
	default:
		return nil, fmt.Errorf("unsupported database type: %s", config.DatabaseType)
	}
	return gorm.Open(dialector, &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
}
