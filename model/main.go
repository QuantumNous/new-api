package model

import (
	"fmt"
	"log"
	"one-api/common"
	"one-api/constant"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/glebarez/sqlite"
	"gorm.io/driver/clickhouse"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

var commonGroupCol string
var commonKeyCol string
var commonTrueVal string
var commonFalseVal string

var logKeyCol string
var logGroupCol string

func initCol() {
	// init common column names
	if common.UsingPostgreSQL {
		commonGroupCol = `"group"`
		commonKeyCol = `"key"`
		commonTrueVal = "true"
		commonFalseVal = "false"
	} else {
		commonGroupCol = "`group`"
		commonKeyCol = "`key`"
		commonTrueVal = "1"
		commonFalseVal = "0"
	}
	if os.Getenv("LOG_SQL_DSN") != "" {
		switch common.LogSqlType {
		case common.DatabaseTypePostgreSQL:
			logGroupCol = `"group"`
			logKeyCol = `"key"`
		case common.DatabaseTypeClickHouse:
			logGroupCol = "`group`"
			logKeyCol = "`key`"
		default:
			logGroupCol = commonGroupCol
			logKeyCol = commonKeyCol
		}
	} else {
		// LOG_SQL_DSN 为空时，日志数据库与主数据库相同
		if common.UsingPostgreSQL {
			logGroupCol = `"group"`
			logKeyCol = `"key"`
		} else {
			logGroupCol = commonGroupCol
			logKeyCol = commonKeyCol
		}
	}
	// log sql type and database type
	//common.SysLog("Using Log SQL Type: " + common.LogSqlType)
}

var DB *gorm.DB

var LOG_DB *gorm.DB

// dropIndexIfExists drops a MySQL index only if it exists to avoid noisy 1091 errors
func dropIndexIfExists(tableName string, indexName string) {
	if !common.UsingMySQL {
		return
	}
	var count int64
	// Check index existence via information_schema
	err := DB.Raw(
		"SELECT COUNT(1) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?",
		tableName, indexName,
	).Scan(&count).Error
	if err == nil && count > 0 {
		_ = DB.Exec("ALTER TABLE " + tableName + " DROP INDEX " + indexName + ";").Error
	}
}

func createRootAccountIfNeed() error {
	var user User
	//if user.Status != common.UserStatusEnabled {
	if err := DB.First(&user).Error; err != nil {
		common.SysLog("no user exists, create a root user for you: username is root, password is 123456")
		hashedPassword, err := common.Password2Hash("123456")
		if err != nil {
			return err
		}
		rootUser := User{
			Username:    "root",
			Password:    hashedPassword,
			Role:        common.RoleRootUser,
			Status:      common.UserStatusEnabled,
			DisplayName: "Root User",
			AccessToken: nil,
			Quota:       100000000,
		}
		DB.Create(&rootUser)
	}
	return nil
}

func CheckSetup() {
	setup := GetSetup()
	if setup == nil {
		// No setup record exists, check if we have a root user
		if RootUserExists() {
			common.SysLog("system is not initialized, but root user exists")
			// Create setup record
			newSetup := Setup{
				Version:       common.Version,
				InitializedAt: time.Now().Unix(),
			}
			err := DB.Create(&newSetup).Error
			if err != nil {
				common.SysLog("failed to create setup record: " + err.Error())
			}
			constant.Setup = true
		} else {
			common.SysLog("system is not initialized and no root user exists")
			constant.Setup = false
		}
	} else {
		// Setup record exists, system is initialized
		common.SysLog("system is already initialized at: " + time.Unix(setup.InitializedAt, 0).String())
		constant.Setup = true
	}
}

func chooseDB(envName string, isLog bool) (*gorm.DB, error) {
	defer func() {
		initCol()
	}()
	dsn := os.Getenv(envName)
	if dsn != "" {
		if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
			// Use PostgreSQL
			common.SysLog("using PostgreSQL as database")
			if !isLog {
				common.UsingPostgreSQL = true
			} else {
				common.LogSqlType = common.DatabaseTypePostgreSQL
			}
			return gorm.Open(postgres.New(postgres.Config{
				DSN:                  dsn,
				PreferSimpleProtocol: true, // disables implicit prepared statement usage
			}), &gorm.Config{
				PrepareStmt: true, // precompile SQL
			})
		}
		if strings.HasPrefix(dsn, "clickhouse://") {
			// Use ClickHouse
			common.SysLog("using ClickHouse as database")
			if !isLog {
				// ClickHouse is primarily for log database
				panic("ClickHouse is not recommended for main database, please use PostgreSQL or MySQL instead")
			} else {
				common.LogSqlType = common.DatabaseTypeClickHouse
				common.UsingClickHouse = true
			}
			return gorm.Open(clickhouse.Open(dsn), &gorm.Config{
				PrepareStmt:                              false, // ClickHouse doesn't support prepared statements well
				DisableForeignKeyConstraintWhenMigrating: true,  // ClickHouse doesn't support foreign keys
			})
		}
		if strings.HasPrefix(dsn, "local") {
			common.SysLog("SQL_DSN not set, using SQLite as database")
			if !isLog {
				common.UsingSQLite = true
			} else {
				common.LogSqlType = common.DatabaseTypeSQLite
			}
			return gorm.Open(sqlite.Open(common.SQLitePath), &gorm.Config{
				PrepareStmt: true, // precompile SQL
			})
		}
		// Use MySQL
		common.SysLog("using MySQL as database")
		// check parseTime
		if !strings.Contains(dsn, "parseTime") {
			if strings.Contains(dsn, "?") {
				dsn += "&parseTime=true"
			} else {
				dsn += "?parseTime=true"
			}
		}
		if !isLog {
			common.UsingMySQL = true
		} else {
			common.LogSqlType = common.DatabaseTypeMySQL
		}
		return gorm.Open(mysql.Open(dsn), &gorm.Config{
			PrepareStmt: true, // precompile SQL
			// For Gorm NewVersion:	DisableForeignKeyConstraintWhenMigrating: true,  Disable FK constraints during migration
		})
	}
	// Use SQLite
	common.SysLog("SQL_DSN not set, using SQLite as database")
	common.UsingSQLite = true
	return gorm.Open(sqlite.Open(common.SQLitePath), &gorm.Config{
		PrepareStmt: true, // precompile SQL
	})
}

func InitDB() (err error) {
	db, err := chooseDB("SQL_DSN", false)
	if err == nil {
		if common.DebugEnabled {
			db = db.Debug()
		}
		DB = db
		sqlDB, err := DB.DB()
		if err != nil {
			return err
		}
		sqlDB.SetMaxIdleConns(common.GetEnvOrDefault("SQL_MAX_IDLE_CONNS", 100))
		sqlDB.SetMaxOpenConns(common.GetEnvOrDefault("SQL_MAX_OPEN_CONNS", 1000))
		sqlDB.SetConnMaxLifetime(time.Second * time.Duration(common.GetEnvOrDefault("SQL_MAX_LIFETIME", 60)))

		if !common.IsMasterNode {
			return nil
		}
		if common.UsingMySQL {
			//_, _ = sqlDB.Exec("ALTER TABLE channels MODIFY model_mapping TEXT;") // TODO: delete this line when most users have upgraded
		}
		common.SysLog("database migration started")
		err = migrateDB()
		return err
	} else {
		common.FatalLog(err)
	}
	return err
}

func InitLogDB() (err error) {
	if os.Getenv("LOG_SQL_DSN") == "" {
		LOG_DB = DB
		return
	}
	db, err := chooseDB("LOG_SQL_DSN", true)
	if err == nil {
		if common.DebugEnabled {
			db = db.Debug()
		}
		LOG_DB = db
		sqlDB, err := LOG_DB.DB()
		if err != nil {
			return err
		}
		sqlDB.SetMaxIdleConns(common.GetEnvOrDefault("SQL_MAX_IDLE_CONNS", 100))
		sqlDB.SetMaxOpenConns(common.GetEnvOrDefault("SQL_MAX_OPEN_CONNS", 1000))
		sqlDB.SetConnMaxLifetime(time.Second * time.Duration(common.GetEnvOrDefault("SQL_MAX_LIFETIME", 60)))

		if !common.IsMasterNode {
			return nil
		}
		common.SysLog("database migration started")
		err = migrateLOGDB()
		return err
	} else {
		common.FatalLog(err)
	}
	return err
}

func migrateDB() error {
	// 修复旧版本留下的唯一索引，允许软删除后重新插入同名记录
	// 删除单列唯一索引（列级 UNIQUE）及早期命名方式，防止与新复合唯一索引 (model_name, deleted_at) 冲突
	dropIndexIfExists("models", "uk_model_name") // 新版复合索引名称（若已存在）
	dropIndexIfExists("models", "model_name")    // 旧版列级唯一索引名称

	dropIndexIfExists("vendors", "uk_vendor_name") // 新版复合索引名称（若已存在）
	dropIndexIfExists("vendors", "name")           // 旧版列级唯一索引名称
	if !common.UsingPostgreSQL {
		return migrateDBFast()
	}
	err := DB.AutoMigrate(
		&Channel{},
		&Token{},
		&User{},
		&Option{},
		&Redemption{},
		&Ability{},
		&Log{},
		&Midjourney{},
		&TopUp{},
		&QuotaData{},
		&Task{},
		&Model{},
		&Vendor{},
		&PrefillGroup{},
		&Setup{},
		&TwoFA{},
		&TwoFABackupCode{},
	)
	if err != nil {
		return err
	}
	return nil
}

func migrateDBFast() error {
	// 修复旧版本留下的唯一索引，允许软删除后重新插入同名记录
	// 删除单列唯一索引（列级 UNIQUE）及早期命名方式，防止与新复合唯一索引冲突
	dropIndexIfExists("models", "uk_model_name")
	dropIndexIfExists("models", "model_name")

	dropIndexIfExists("vendors", "uk_vendor_name")
	dropIndexIfExists("vendors", "name")

	var wg sync.WaitGroup

	migrations := []struct {
		model interface{}
		name  string
	}{
		{&Channel{}, "Channel"},
		{&Token{}, "Token"},
		{&User{}, "User"},
		{&Option{}, "Option"},
		{&Redemption{}, "Redemption"},
		{&Ability{}, "Ability"},
		{&Log{}, "Log"},
		{&Midjourney{}, "Midjourney"},
		{&TopUp{}, "TopUp"},
		{&QuotaData{}, "QuotaData"},
		{&Task{}, "Task"},
		{&Model{}, "Model"},
		{&Vendor{}, "Vendor"},
		{&PrefillGroup{}, "PrefillGroup"},
		{&Setup{}, "Setup"},
		{&TwoFA{}, "TwoFA"},
		{&TwoFABackupCode{}, "TwoFABackupCode"},
	}
	// 动态计算migration数量，确保errChan缓冲区足够大
	errChan := make(chan error, len(migrations))

	for _, m := range migrations {
		wg.Add(1)
		go func(model interface{}, name string) {
			defer wg.Done()
			if err := DB.AutoMigrate(model); err != nil {
				errChan <- fmt.Errorf("failed to migrate %s: %v", name, err)
			}
		}(m.model, m.name)
	}

	// Wait for all migrations to complete
	wg.Wait()
	close(errChan)

	// Check for any errors
	for err := range errChan {
		if err != nil {
			return err
		}
	}
	common.SysLog("database migrated")
	return nil
}

func migrateLOGDB() error {
	var err error
	if common.LogSqlType == common.DatabaseTypeClickHouse {
		// Get log retention days from environment variable, default to 365 days (12 months)
		retentionDays := common.GetEnvOrDefault("LOG_RETENTION_DAYS", 365)

		// ClickHouse specific table options for optimal log storage with compression and TTL
		tableOptions := fmt.Sprintf(`ENGINE=MergeTree() 
ORDER BY (toYYYYMM(toDateTime(created_at)), user_id, created_at, id)
PARTITION BY toYYYYMM(toDateTime(created_at))
TTL toDateTime(created_at) + INTERVAL %d DAY
SETTINGS index_granularity = 8192, 
         compress_primary_key = 1,
         vertical_merge_algorithm_min_rows_to_activate = 16,
         vertical_merge_algorithm_min_columns_to_activate = 11`, retentionDays)

		err = LOG_DB.Set("gorm:table_options", tableOptions).AutoMigrate(&Log{})
		if err != nil {
			return err
		}

		// Create additional indices for flexible query patterns
		indices := []string{
			"CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at) TYPE minmax",
			"CREATE INDEX IF NOT EXISTS idx_logs_created_user ON logs (created_at, user_id) TYPE minmax",
			"CREATE INDEX IF NOT EXISTS idx_logs_created_model ON logs (created_at, model_name) TYPE minmax",
		}

		for _, index := range indices {
			if err = LOG_DB.Exec(index).Error; err != nil {
				common.SysLog(fmt.Sprintf("Warning: Failed to create index: %s, error: %v", index, err))
			}
		}

		common.SysLog(fmt.Sprintf("ClickHouse log database migrated with optimized MergeTree engine, compression, %d days TTL, and indices", retentionDays))
	} else {
		if err = LOG_DB.AutoMigrate(&Log{}); err != nil {
			return err
		}
	}
	return nil
}

func closeDB(db *gorm.DB) error {
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	err = sqlDB.Close()
	return err
}

func CloseDB() error {
	if LOG_DB != DB {
		err := closeDB(LOG_DB)
		if err != nil {
			return err
		}
	}
	return closeDB(DB)
}

var (
	lastPingTime time.Time
	pingMutex    sync.Mutex
)

func PingDB() error {
	pingMutex.Lock()
	defer pingMutex.Unlock()

	if time.Since(lastPingTime) < time.Second*10 {
		return nil
	}

	sqlDB, err := DB.DB()
	if err != nil {
		log.Printf("Error getting sql.DB from GORM: %v", err)
		return err
	}

	err = sqlDB.Ping()
	if err != nil {
		log.Printf("Error pinging DB: %v", err)
		return err
	}

	lastPingTime = time.Now()
	common.SysLog("Database pinged successfully")
	return nil
}
