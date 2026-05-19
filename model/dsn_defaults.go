package model

import (
	"time"

	"github.com/QuantumNous/new-api/common"
	mysqldrv "github.com/go-sql-driver/mysql"
)

func ensureMySQLDSNDefaults(dsn string) string {
	cfg, err := mysqldrv.ParseDSN(dsn)
	if err != nil {
		common.SysError("failed to parse MySQL DSN, keeping raw: " + err.Error())
		return dsn
	}
	cfg.ParseTime = true
	if cfg.Timeout == 0 {
		cfg.Timeout = time.Duration(common.GetEnvOrDefault("SQL_DIAL_TIMEOUT", 10)) * time.Second
	}
	if cfg.ReadTimeout == 0 {
		cfg.ReadTimeout = time.Duration(common.GetEnvOrDefault("SQL_READ_TIMEOUT", 30)) * time.Second
	}
	if cfg.WriteTimeout == 0 {
		cfg.WriteTimeout = time.Duration(common.GetEnvOrDefault("SQL_WRITE_TIMEOUT", 10)) * time.Second
	}
	return cfg.FormatDSN()
}
