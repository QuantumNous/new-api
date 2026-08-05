package main

import (
	"errors"
	"fmt"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// PromptAuditLog is one audited relay request.
//
// Column types stay within what SQLite, MySQL and PostgreSQL all understand so
// AutoMigrate works identically on every supported database.
type PromptAuditLog struct {
	Id int64 `gorm:"primaryKey" json:"id"`
	// CreatedAt is a unix timestamp in seconds, matching new-api's logs table.
	CreatedAt int64 `gorm:"bigint;index:idx_pal_created_at" json:"created_at"`

	// RequestId is new-api's own request id, read back from the upstream
	// X-Oneapi-Request-Id response header. It is what joins this row to
	// new-api's logs.request_id.
	RequestId string `gorm:"type:varchar(64);index:idx_pal_request_id" json:"request_id"`

	Method   string `gorm:"type:varchar(8)" json:"method"`
	Path     string `gorm:"type:varchar(256)" json:"path"`
	Model    string `gorm:"type:varchar(128);index:idx_pal_model" json:"model"`
	IsStream bool   `json:"is_stream"`

	UserId     int    `gorm:"index:idx_pal_user_id" json:"user_id"`
	Username   string `gorm:"type:varchar(64)" json:"username"`
	TokenId    int    `json:"token_id"`
	TokenName  string `gorm:"type:varchar(128)" json:"token_name"`
	TokenGroup string `gorm:"type:varchar(64)" json:"token_group"`
	ClientIp   string `gorm:"type:varchar(64)" json:"client_ip"`

	PromptText string `gorm:"type:text" json:"prompt_text"`
	RawBody    string `gorm:"type:text" json:"raw_body"`
	// Truncated marks records whose body exceeded capture.max_body_bytes, so the
	// captured content is a prefix and prompt extraction may have failed.
	Truncated bool  `json:"truncated"`
	BodyBytes int64 `json:"body_bytes"`

	StatusCode int    `json:"status_code"`
	LatencyMs  int64  `json:"latency_ms"`
	Node       string `gorm:"type:varchar(64)" json:"node"`
}

func (PromptAuditLog) TableName() string {
	return "prompt_audit_logs"
}

func openDatabase(cfg DatabaseConfig) (*gorm.DB, error) {
	var dialector gorm.Dialector
	switch cfg.Driver {
	case "mysql":
		dialector = mysql.Open(cfg.DSN)
	case "postgres":
		dialector = postgres.Open(cfg.DSN)
	case "sqlite":
		dialector = sqlite.Open(cfg.DSN)
	default:
		return nil, fmt.Errorf("unsupported database driver %q", cfg.Driver)
	}

	db, err := gorm.Open(dialector, &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		return nil, fmt.Errorf("open %s database: %w", cfg.Driver, err)
	}

	pool, err := db.DB()
	if err != nil {
		return nil, fmt.Errorf("access %s connection pool: %w", cfg.Driver, err)
	}
	pool.SetMaxOpenConns(16)
	pool.SetMaxIdleConns(4)
	pool.SetConnMaxLifetime(time.Hour)

	if cfg.autoMigrate() {
		if err := db.AutoMigrate(&PromptAuditLog{}); err != nil {
			return nil, fmt.Errorf("migrate prompt_audit_logs: %w", err)
		}
		return db, nil
	}

	// With auto_migrate off the proxy holds no DDL privileges, so the table has to
	// exist already. Failing here — loudly, at startup — beats discovering it once
	// per insert after traffic has started flowing.
	if !db.Migrator().HasTable(&PromptAuditLog{}) {
		return nil, ErrSchemaMissing
	}
	return db, nil
}

// ErrSchemaMissing reports that the audit table has to be created before the proxy
// can run.
//
// It is deliberately distinguishable from a database outage: fail_open must NOT
// downgrade it to a warning. A deployment that forgot to create the table would
// otherwise look healthy while spooling every single record to disk, until the
// disk filled up.
var ErrSchemaMissing = errors.New("table prompt_audit_logs does not exist and database.auto_migrate is false; " +
	"create it with the DDL in proxy/schema/ first")
