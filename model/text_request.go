package model

import (
	"fmt"
	"one-api/common"
	"os"
	"sync/atomic"
	"time"

	"gorm.io/gorm"
)

var (
	// RequestPersistenceEnabled 是否启用请求持久化存储
	RequestPersistenceEnabled = false
	// RequestPersistenceDB 请求持久化存储的数据库连接
	RequestPersistenceDB *gorm.DB
)

var (
	textRequestTableName atomic.Value
)

// TextRequest 记录文本请求的输入输出
type TextRequest struct {
	Id              int64     `json:"id" gorm:"primaryKey;type:bigint;autoIncrement"`
	UserId          int       `json:"user_id" gorm:"index;type:int"`
	RequestId       string    `json:"request_id" gorm:"index;type:varchar(100)"`
	CreatedAt       time.Time `json:"created_at" gorm:"index;type:datetime"` // 格式：2024-03-21 14:30:45
	Model           string    `json:"model" gorm:"type:varchar(100);index"`
	RequestHeaders  string    `json:"request_headers" gorm:"type:text"`   // 通常不会太大
	RequestBody     string    `json:"request_body" gorm:"type:longtext"`  // 可能包含大量数据
	ResponseHeaders string    `json:"response_headers" gorm:"type:text"`  // 通常不会太大
	ResponseBody    string    `json:"response_body" gorm:"type:longtext"` // 可能包含大量数据
}

// InitRequestPersistence 初始化请求持久化存储
func InitRequestPersistence() error {
	if !RequestPersistenceEnabled {
		return nil
	}

	// 使用 REQUEST_PERSISTENCE_ENABLED_SQL_DSN 初始化数据库连接
	dsn := os.Getenv("REQUEST_PERSISTENCE_ENABLED_SQL_DSN")
	if dsn == "" {
		// 如果没有指定专门的数据库连接，使用主数据库
		RequestPersistenceDB = DB
	} else {
		// 使用指定的数据库连接
		db, err := chooseDB("REQUEST_PERSISTENCE_ENABLED_SQL_DSN")
		if err != nil {
			return fmt.Errorf("failed to initialize request persistence database: %v", err)
		}
		if common.DebugEnabled {
			db = db.Debug()
		}
		RequestPersistenceDB = db
		sqlDB, err := RequestPersistenceDB.DB()
		if err != nil {
			return err
		}
		sqlDB.SetMaxIdleConns(common.GetEnvOrDefault("SQL_MAX_IDLE_CONNS", 100))
		sqlDB.SetMaxOpenConns(common.GetEnvOrDefault("SQL_MAX_OPEN_CONNS", 1000))
		sqlDB.SetConnMaxLifetime(time.Second * time.Duration(common.GetEnvOrDefault("SQL_MAX_LIFETIME", 60)))
	}

	// 创建未来一周的表
	return createTablesForNextWeek()
}

// createTablesForNextWeek 创建未来一周的表
func createTablesForNextWeek() error {
	now := time.Now()
	// 设置当前表名，使用正确的日期格式
	textRequestTableName.Store(fmt.Sprintf("text_requests_%s", now.Format("20060102")))

	// 创建未来一周的表
	for i := 0; i < 7; i++ {
		date := now.AddDate(0, 0, i)
		// 使用正确的日期格式 YYYYMMDD
		tableName := fmt.Sprintf("text_requests_%s", date.Format("20060102"))

		// 检查表是否存在
		var count int64
		err := RequestPersistenceDB.Raw("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?", tableName).Count(&count).Error
		if err != nil {
			return fmt.Errorf("failed to check if table %s exists: %v", tableName, err)
		}

		// 如果表不存在，则创建
		if count == 0 {
			if err := RequestPersistenceDB.Table(tableName).Set("gorm:table_options", "ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci").AutoMigrate(&TextRequest{}); err != nil {
				return fmt.Errorf("failed to create table %s: %v", tableName, err)
			}
			common.SysLog(fmt.Sprintf("created table %s", tableName))
		}
	}
	return nil
}

// StartTableCheckRoutine 启动定时检查表的协程
func StartTableCheckRoutine() {
	go func() {
		for {
			// 计算下一个12点的时间
			now := time.Now()
			next := time.Date(now.Year(), now.Month(), now.Day(), 12, 0, 0, 0, now.Location())
			if now.After(next) {
				next = next.AddDate(0, 0, 1)
			}
			// 等待到下一个12点
			time.Sleep(next.Sub(now))

			// 创建未来一周的表
			if err := createTablesForNextWeek(); err != nil {
				common.SysError("failed to create tables for next week: " + err.Error())
			}
		}
	}()
}
