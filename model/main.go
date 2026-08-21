package model

import (
	"context"
	"errors"
	"fmt"
	"log"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"

	"github.com/glebarez/sqlite"
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

var taskIDMigrationPageSize = 500

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
			Username:     "root",
			Password:     hashedPassword,
			Role:         common.RoleRootUser,
			Status:       common.UserStatusEnabled,
			DisplayName:  "Root User",
			Group:        defaultUserGroup,
			AccessToken:  nil,
			Quota:        100000000,
			IsEnterprise: true, // deprecated compatibility field; group controls PLG behavior
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
		dsn = ensureMySQLDSNDefaults(dsn)
		if !isLog {
			common.UsingMySQL = true
		} else {
			common.LogSqlType = common.DatabaseTypeMySQL
		}
		return gorm.Open(mysql.Open(dsn), &gorm.Config{
			PrepareStmt: true, // precompile SQL
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
		// MySQL charset/collation startup check: ensure Chinese-capable charset
		if common.UsingMySQL {
			if err := checkMySQLChineseSupport(DB); err != nil {
				panic(err)
			}
		}
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
		if err != nil {
			return err
		}
		return nil
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
		// If log DB is MySQL, also ensure Chinese-capable charset
		if common.LogSqlType == common.DatabaseTypeMySQL {
			if err := checkMySQLChineseSupport(LOG_DB); err != nil {
				panic(err)
			}
		}
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
	if common.UsingSQLite {
		return migrateDBFast()
	}
	if err := migrateRecallRecipientIdentity(); err != nil {
		return err
	}
	if err := backfillTaskIDsBeforeUniqueIndex(); err != nil {
		return err
	}
	// Migrate price_amount column from float/double to decimal for existing tables
	migrateSubscriptionPlanPriceAmount()
	// Migrate model_limits column from varchar to text for existing tables
	if err := migrateTokenModelLimitsToText(); err != nil {
		return err
	}
	// Widen lifecycle keys before the regular model migration so existing
	// MySQL/PostgreSQL databases can persist the full lifecycle key contract.
	if err := migrateQuotaLifecycleStateCycleColumns(); err != nil {
		return err
	}
	// Provider binding scopes include a version prefix plus a SHA-256 digest.
	// Widen legacy schemas before workers try to persist those full identities.
	if err := migrateAssetBindingScopeColumns(); err != nil {
		return err
	}

	err := DB.AutoMigrate(migrationModelValues(orderedMigrationModels())...)
	if err != nil {
		return err
	}
	go func() {
		if err := BackfillRegistrationCountries(); err != nil {
			common.SysError("registration country backfill failed: " + err.Error())
		}
	}()
	if err := migrateAssetBindingScopeIndex(); err != nil {
		return err
	}
	if err := MigrateLegacyBytePlusAssets(); err != nil {
		return err
	}
	if err := migrateRecallTranslationTaskSnapshotsToLongText(); err != nil {
		return err
	}
	if err := migrateRecallCampaignTypes(); err != nil {
		return err
	}
	if err := migrateRecallCampaignLifecycleDefaults(); err != nil {
		return err
	}
	if err := SeedRecallContinuousTriggerSlotsWithContext(context.Background()); err != nil {
		return err
	}
	if common.UsingSQLite {
		if err := ensureSubscriptionPlanTableSQLite(); err != nil {
			return err
		}
	} else {
		if err := DB.AutoMigrate(&SubscriptionPlan{}); err != nil {
			return err
		}
	}
	if err := BackfillCodexFingerprintSeeds(); err != nil {
		return err
	}
	return migrateStartupInvitationValue()
}

type migrationModel struct {
	model interface{}
	name  string
}

func orderedMigrationModels() []migrationModel {
	return []migrationModel{
		{&Channel{}, "Channel"},
		{&Token{}, "Token"},
		{&CliDeviceAuthorization{}, "CliDeviceAuthorization"},
		{&User{}, "User"},
		{&RecallCampaign{}, "RecallCampaign"},
		{&RecallRecipient{}, "RecallRecipient"},
		{&RecallMessage{}, "RecallMessage"},
		{&RecallExclusionBatch{}, "RecallExclusionBatch"},
		{&RecallCampaignExclusion{}, "RecallCampaignExclusion"},
		{&RecallTranslationTask{}, "RecallTranslationTask"},
		{&RecallEmailQuotaWindow{}, "RecallEmailQuotaWindow"},
		{&RecallEmailPacingState{}, "RecallEmailPacingState"},
		{&RecallEvent{}, "RecallEvent"},
		{&RecallLifecycleEvent{}, "RecallLifecycleEvent"},
		{&RecallContinuousTriggerSlot{}, "RecallContinuousTriggerSlot"},
		{&QuotaLifecycleState{}, "QuotaLifecycleState"},
		{&RegistrationDomainState{}, "RegistrationDomainState"},
		{&RegistrationDomainBlock{}, "RegistrationDomainBlock"},
		{&RegistrationDomainBlockUser{}, "RegistrationDomainBlockUser"},
		{&NewUserBonusClaim{}, "NewUserBonusClaim"},
		{&InviteRewardEvent{}, "InviteRewardEvent"},
		{&InviteSubscriptionReward{}, "InviteSubscriptionReward"},
		{&SubscriptionDiscountAccount{}, "SubscriptionDiscountAccount"},
		{&SubscriptionDiscountEntry{}, "SubscriptionDiscountEntry"},
		{&PasskeyCredential{}, "PasskeyCredential"},
		{&Option{}, "Option"},
		{&Redemption{}, "Redemption"},
		{&Ability{}, "Ability"},
		{&Log{}, "Log"},
		{&CompanyLogSchema{}, "CompanyLogSchema"},
		{&LogRequestSample{}, "LogRequestSample"},
		{&Midjourney{}, "Midjourney"},
		{&TopUp{}, "TopUp"},
		{&AdsAttributionOutbox{}, "AdsAttributionOutbox"},
		{&PaymentAnalyticsOutbox{}, "PaymentAnalyticsOutbox"},
		{&PaymentAnalyticsEventReceipt{}, "PaymentAnalyticsEventReceipt"},
		{&StripeBonusClaim{}, "StripeBonusClaim"},
		{&TopUpBonusClaim{}, "TopUpBonusClaim"},
		{&UserInvoiceProfile{}, "UserInvoiceProfile"},
		{&PaymentInvoice{}, "PaymentInvoice"},
		{&QuotaData{}, "QuotaData"},
		{&QuotaDataToken{}, "QuotaDataToken"},
		{&Task{}, "Task"},
		{&TaskAcceptedAccountingLedger{}, "TaskAcceptedAccountingLedger"},
		{&TaskAcceptedAccountingLogLedger{}, "TaskAcceptedAccountingLogLedger"},
		{&Asset{}, "Asset"},
		{&AssetBinding{}, "AssetBinding"},
		{&AssetUpload{}, "AssetUpload"},
		{&AssetModelCoverageTarget{}, "AssetModelCoverageTarget"},
		{&AssetModelReadiness{}, "AssetModelReadiness"},
		{&Model{}, "Model"},
		{&Vendor{}, "Vendor"},
		{&WebsiteFeaturedModel{}, "WebsiteFeaturedModel"},
		{&PrefillGroup{}, "PrefillGroup"},
		{&Setup{}, "Setup"},
		{&TwoFA{}, "TwoFA"},
		{&TwoFABackupCode{}, "TwoFABackupCode"},
		{&Checkin{}, "Checkin"},
		{&SubscriptionOrder{}, "SubscriptionOrder"},
		{&UserSubscription{}, "UserSubscription"},
		{&SubscriptionProviderBinding{}, "SubscriptionProviderBinding"},
		{&PaymentWebhookEvent{}, "PaymentWebhookEvent"},
		{&SubscriptionPreConsumeRecord{}, "SubscriptionPreConsumeRecord"},
		{&FreePlanGrant{}, "FreePlanGrant"},
		{&UserSubscriptionContract{}, "UserSubscriptionContract"},
		{&SubscriptionChangeIntent{}, "SubscriptionChangeIntent"},
		{&SubscriptionTierRankReservation{}, "SubscriptionTierRankReservation"},
		{&SubscriptionTermSegment{}, "SubscriptionTermSegment"},
		{&WalletLedgerEntry{}, "WalletLedgerEntry"},
		{&CustomOAuthProvider{}, "CustomOAuthProvider"},
		{&UserOAuthBinding{}, "UserOAuthBinding"},
		{&PerfMetric{}, "PerfMetric"},
		{&DingTalkAlertCooldownRecord{}, "DingTalkAlertCooldownRecord"},
		{&ModelAvailabilityState{}, "ModelAvailabilityState"},
		{&CodexModelGovernanceRecord{}, "CodexModelGovernanceRecord"},
		{&CodexModelGovernanceProbeState{}, "CodexModelGovernanceProbeState"},
		{&CodexModelGovernanceAlertCooldownRecord{}, "CodexModelGovernanceAlertCooldownRecord"},
		{&TemporaryChannelModelSpend{}, "TemporaryChannelModelSpend"},
		{&ComputeNode{}, "ComputeNode"},
		{&DataToolCall{}, "DataToolCall"},
		{&BytePlusAssetGroup{}, "BytePlusAssetGroup"},
		{&BytePlusRealPersonProfile{}, "BytePlusRealPersonProfile"},
		{&BytePlusVisualValidationSession{}, "BytePlusVisualValidationSession"},
		{&APIIdempotencyRecord{}, "APIIdempotencyRecord"},
		{&BytePlusAssetTempObject{}, "BytePlusAssetTempObject"},
		{&BytePlusAsset{}, "BytePlusAsset"},
		{&AdsSpendDaily{}, "AdsSpendDaily"},
		{&AdsDailyKeyword{}, "AdsDailyKeyword"},
		{&AdsDailyCreative{}, "AdsDailyCreative"},
		{&AdsDailyLanding{}, "AdsDailyLanding"},
		{&AdsPilotCampaignDaily{}, "AdsPilotCampaignDaily"},
		{&AdsPilotInsight{}, "AdsPilotInsight"},
		{&AdsPilotAction{}, "AdsPilotAction"},
		{&AdsPilotProposal{}, "AdsPilotProposal"},
		{&AdsPilotMeta{}, "AdsPilotMeta"},
		{&PromptLibraryItem{}, "PromptLibraryItem"},
		{&GrokAuthFlow{}, "GrokAuthFlow"},
		{&GrokChannelState{}, "GrokChannelState"},
	}
}

func migrationModelValues(models []migrationModel) []interface{} {
	values := make([]interface{}, 0, len(models))
	for _, m := range models {
		values = append(values, m.model)
	}
	return values
}

func migrateDBFast() error {
	if err := migrateRecallRecipientIdentity(); err != nil {
		return err
	}
	if err := backfillTaskIDsBeforeUniqueIndex(); err != nil {
		return err
	}

	migrations := orderedMigrationModels()
	// GORM also migrates associations, so parallel AutoMigrate calls can race
	// when related models share a table dependency.
	for _, m := range migrations {
		var err error
		if common.UsingSQLite && sqliteModelNeedsColumnOnlyMigration(m.model) {
			err = ensureSQLiteModelColumnsAndIndexes(m.model)
		} else {
			err = DB.AutoMigrate(m.model)
		}
		if err != nil {
			return fmt.Errorf("failed to migrate %s: %v", m.name, err)
		}
	}
	go func() {
		if err := BackfillRegistrationCountries(); err != nil {
			common.SysError("registration country backfill failed: " + err.Error())
		}
	}()
	// SQLite's AutoMigrate normally widens this table, but keep the explicit
	// compatibility migration on the startup path for legacy databases whose
	// schema metadata still reports the old varchar(64) columns.
	if err := migrateQuotaLifecycleStateCycleColumns(); err != nil {
		return err
	}
	if err := migrateAssetBindingScopeIndex(); err != nil {
		return err
	}
	if err := MigrateLegacyBytePlusAssets(); err != nil {
		return err
	}
	if err := migrateRecallTranslationTaskSnapshotsToLongText(); err != nil {
		return err
	}
	if err := migrateRecallCampaignTypes(); err != nil {
		return err
	}
	if err := migrateRecallCampaignLifecycleDefaults(); err != nil {
		return err
	}
	if err := SeedRecallContinuousTriggerSlotsWithContext(context.Background()); err != nil {
		return err
	}
	if common.UsingSQLite {
		if err := ensureSubscriptionPlanTableSQLite(); err != nil {
			return err
		}
	} else {
		if err := DB.AutoMigrate(&SubscriptionPlan{}); err != nil {
			return err
		}
	}
	if err := BackfillCodexFingerprintSeeds(); err != nil {
		return err
	}
	if err := migrateStartupInvitationValue(); err != nil {
		return err
	}
	common.SysLog("database migrated")
	return nil
}

func sqliteModelNeedsColumnOnlyMigration(model interface{}) bool {
	switch model.(type) {
	case *SubscriptionOrder, *SubscriptionTermSegment, *WalletLedgerEntry:
		return true
	default:
		return false
	}
}

func ensureSQLiteModelColumnsAndIndexes(model interface{}) error {
	stmt := &gorm.Statement{DB: DB}
	if err := stmt.Parse(model); err != nil {
		return err
	}
	if !DB.Migrator().HasTable(model) {
		return DB.Migrator().CreateTable(model)
	}
	for _, dbName := range stmt.Schema.DBNames {
		field := stmt.Schema.FieldsByDBName[dbName]
		if field == nil || field.IgnoreMigration {
			continue
		}
		if !DB.Migrator().HasColumn(model, dbName) {
			if err := DB.Migrator().AddColumn(model, dbName); err != nil {
				return err
			}
		}
	}
	for _, idx := range stmt.Schema.ParseIndexes() {
		if !DB.Migrator().HasIndex(model, idx.Name) {
			if err := DB.Migrator().CreateIndex(model, idx.Name); err != nil {
				return err
			}
		}
	}
	return nil
}

func backfillTaskIDsBeforeUniqueIndex() error {
	if DB == nil || !DB.Migrator().HasTable(&Task{}) || !DB.Migrator().HasColumn(&Task{}, "task_id") {
		return nil
	}

	hasPrivateData := DB.Migrator().HasColumn(&Task{}, "private_data")
	selectColumns := []string{"id", "task_id"}
	if hasPrivateData {
		selectColumns = append(selectColumns, "private_data")
	}

	type taskIDMigrationRow struct {
		ID          int64
		TaskID      string
		PrivateData TaskPrivateData `gorm:"column:private_data"`
	}

	for lastID := int64(0); ; {
		var rows []taskIDMigrationRow
		if err := DB.Table("tasks").
			Select(selectColumns).
			Where("task_id = ? AND id > ?", "", lastID).
			Order("id ASC").
			Limit(taskIDMigrationPageSize).
			Find(&rows).Error; err != nil {
			return fmt.Errorf("failed to load empty task_id page for backfill: %w", err)
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			newTaskID, err := generateUniqueTaskIDForMigration()
			if err != nil {
				return err
			}
			if err := DB.Table("tasks").Where("id = ? AND task_id = ?", row.ID, "").Update("task_id", newTaskID).Error; err != nil {
				return fmt.Errorf("failed to backfill empty task_id for task %d: %w", row.ID, err)
			}
			lastID = row.ID
		}
	}

	type taskIDDuplicateGroup struct {
		TaskID   string `gorm:"column:task_id"`
		MinID    int64  `gorm:"column:min_id"`
		RowCount int64  `gorm:"column:row_count"`
	}

	for lastTaskID := ""; ; {
		var groups []taskIDDuplicateGroup
		if err := DB.Table("tasks").
			Select("task_id, MIN(id) AS min_id, COUNT(*) AS row_count").
			Where("task_id <> ? AND task_id > ?", "", lastTaskID).
			Group("task_id").
			Having("COUNT(*) > 1").
			Order("task_id ASC").
			Limit(taskIDMigrationPageSize).
			Scan(&groups).Error; err != nil {
			return fmt.Errorf("failed to load duplicate task_id groups for backfill: %w", err)
		}
		if len(groups) == 0 {
			break
		}
		for _, group := range groups {
			if err := backfillDuplicateTaskIDGroup(group.TaskID, group.MinID, hasPrivateData, selectColumns); err != nil {
				return err
			}
			lastTaskID = group.TaskID
		}
	}
	return nil
}

func backfillDuplicateTaskIDGroup(taskID string, keepID int64, hasPrivateData bool, selectColumns []string) error {
	type taskIDMigrationRow struct {
		ID          int64
		TaskID      string
		PrivateData TaskPrivateData `gorm:"column:private_data"`
	}

	for lastID := keepID; ; {
		var rows []taskIDMigrationRow
		if err := DB.Table("tasks").
			Select(selectColumns).
			Where("task_id = ? AND id > ?", taskID, lastID).
			Order("id ASC").
			Limit(taskIDMigrationPageSize).
			Find(&rows).Error; err != nil {
			return fmt.Errorf("failed to load duplicate task_id rows for %q: %w", taskID, err)
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			newTaskID, err := generateUniqueTaskIDForMigration()
			if err != nil {
				return err
			}

			updates := map[string]any{"task_id": newTaskID}
			if hasPrivateData && row.PrivateData.UpstreamTaskID == "" {
				row.PrivateData.UpstreamTaskID = taskID
				updates["private_data"] = row.PrivateData
			}

			if err := DB.Table("tasks").Where("id = ? AND task_id = ?", row.ID, taskID).Updates(updates).Error; err != nil {
				return fmt.Errorf("failed to backfill duplicate task_id for task %d: %w", row.ID, err)
			}
			lastID = row.ID
		}
	}
	return nil
}

func generateUniqueTaskIDForMigration() (string, error) {
	for {
		taskID := GenerateTaskID()
		exists, err := taskIDExistsForMigration(taskID)
		if err != nil {
			return "", err
		}
		if !exists {
			return taskID, nil
		}
	}
}

func taskIDExistsForMigration(taskID string) (bool, error) {
	var row struct {
		ID int64
	}
	err := DB.Table("tasks").Select("id").Where("task_id = ?", taskID).Limit(1).Take(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, fmt.Errorf("failed to check generated task_id collision: %w", err)
	}
	return true, nil
}

func migrateStartupInvitationValue() error {
	subscriptionMode, err := storedInviteRewardSubscriptionModeEnabled()
	if err != nil {
		return err
	}
	if subscriptionMode {
		return MigrateLegacyInvitationValueToSubscriptionDiscount()
	}
	return MigrateLegacyAffQuotaToQuota()
}

func storedInviteRewardSubscriptionModeEnabled() (bool, error) {
	if DB == nil || !DB.Migrator().HasTable(&Option{}) {
		return false, nil
	}
	var option Option
	err := DB.Where(&Option{Key: "InviteRewardSubscriptionModeEnabled"}).First(&option).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	enabled, err := strconv.ParseBool(strings.TrimSpace(option.Value))
	if err != nil {
		return false, fmt.Errorf("invalid InviteRewardSubscriptionModeEnabled option %q: %w", option.Value, err)
	}
	return enabled, nil
}

var recallTranslationTaskSnapshotColumns = []string{"source_snapshot", "result_snapshot"}

func migrateRecallTranslationTaskSnapshotsToLongText() error {
	if !common.UsingMySQL {
		return nil
	}

	tableName := "recall_translation_tasks"
	if DB == nil || !DB.Migrator().HasTable(tableName) {
		return nil
	}

	for _, columnName := range recallTranslationTaskSnapshotColumns {
		if !DB.Migrator().HasColumn(&RecallTranslationTask{}, columnName) {
			continue
		}

		var columnType string
		if err := DB.Raw(`SELECT COLUMN_TYPE FROM information_schema.columns
				WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			tableName, columnName).Scan(&columnType).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to query metadata for %s.%s: %v", tableName, columnName, err))
		} else if strings.EqualFold(columnType, "longtext") {
			continue
		}

		if err := DB.Exec(recallTranslationTaskSnapshotLongTextSQL(columnName)).Error; err != nil {
			return fmt.Errorf("failed to migrate %s.%s to longtext: %w", tableName, columnName, err)
		}
		common.SysLog(fmt.Sprintf("Successfully migrated %s.%s to longtext", tableName, columnName))
	}
	return nil
}

func recallTranslationTaskSnapshotLongTextSQL(columnName string) string {
	return fmt.Sprintf("ALTER TABLE `recall_translation_tasks` MODIFY COLUMN `%s` LONGTEXT", columnName)
}

const recallRecipientIdentityMigrationBatchSize = 500

func migrateRecallRecipientIdentity() error {
	if DB == nil || !DB.Migrator().HasTable(&RecallRecipient{}) {
		return nil
	}
	if recallRecipientIdentitySchemaSwapPending() {
		if err := requireRecallCampaignsDisabledForIdentityMigration(); err != nil {
			return err
		}
	}
	if !DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity") {
		if err := DB.Migrator().AddColumn(&RecallRecipient{}, "RecipientIdentity"); err != nil {
			return fmt.Errorf("failed to add recall recipient identity column: %w", err)
		}
	}

	type recipientIdentityRow struct {
		Id                int64
		UserId            int
		EmailSnapshot     string
		RecipientIdentity string
	}
	lastID := int64(0)
	for {
		var rows []recipientIdentityRow
		if err := DB.Table("recall_recipients").
			Select("id", "user_id", "email_snapshot", "recipient_identity").
			Where("id > ? AND (recipient_identity = '' OR recipient_identity IS NULL)", lastID).
			Order("id ASC").
			Limit(recallRecipientIdentityMigrationBatchSize).
			Find(&rows).Error; err != nil {
			return fmt.Errorf("failed to load recall recipients for identity backfill: %w", err)
		}
		if len(rows) == 0 {
			break
		}
		for _, row := range rows {
			identity := RecallRecipientIdentityForUser(row.UserId)
			if identity == "" {
				email, ok := normalizeRecallRecipientEmail(row.EmailSnapshot)
				if !ok {
					return fmt.Errorf("recall recipient %d cannot derive recipient identity", row.Id)
				}
				identity = RecallRecipientIdentityForEmail(email)
			}
			if err := DB.Table("recall_recipients").
				Where("id = ? AND (recipient_identity = '' OR recipient_identity IS NULL)", row.Id).
				Update("recipient_identity", identity).Error; err != nil {
				return fmt.Errorf("failed to backfill recall recipient %d identity: %w", row.Id, err)
			}
			lastID = row.Id
		}
	}

	if !DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity") {
		if err := DB.Migrator().CreateIndex(&RecallRecipient{}, "idx_recall_campaign_identity"); err != nil {
			return fmt.Errorf("failed to create recall campaign identity index: %w", err)
		}
	}
	if DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user") {
		if err := DB.Migrator().DropIndex(&RecallRecipient{}, "idx_recall_campaign_user"); err != nil {
			return fmt.Errorf("failed to drop legacy recall campaign user index: %w", err)
		}
	}
	return nil
}

func migrateRecallCampaignTypes() error {
	if DB == nil || !DB.Migrator().HasTable(&RecallCampaign{}) {
		return nil
	}
	if !DB.Migrator().HasColumn(&RecallCampaign{}, "campaign_type") {
		if err := DB.Migrator().AddColumn(&RecallCampaign{}, "CampaignType"); err != nil {
			return fmt.Errorf("failed to add recall campaign type column: %w", err)
		}
	}
	return DB.Model(&RecallCampaign{}).
		Where("campaign_type IS NULL OR TRIM(campaign_type) = ''").
		Update("campaign_type", RecallCampaignTypePromotion).Error
}

func migrateRecallCampaignLifecycleDefaults() error {
	if DB == nil || !DB.Migrator().HasTable(&RecallCampaign{}) {
		return nil
	}
	if !DB.Migrator().HasColumn(&RecallCampaign{}, "delivery_policy") {
		if err := DB.Migrator().AddColumn(&RecallCampaign{}, "DeliveryPolicy"); err != nil {
			return fmt.Errorf("failed to add recall campaign delivery policy column: %w", err)
		}
	}
	return DB.Model(&RecallCampaign{}).
		Where("delivery_policy IS NULL OR TRIM(delivery_policy) = ''").
		Update("delivery_policy", RecallDeliveryPolicyEngagement).Error
}

func recallRecipientIdentitySchemaSwapPending() bool {
	return !DB.Migrator().HasColumn(&RecallRecipient{}, "recipient_identity") ||
		!DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_identity") ||
		DB.Migrator().HasIndex(&RecallRecipient{}, "idx_recall_campaign_user")
}

func requireRecallCampaignsDisabledForIdentityMigration() error {
	if !DB.Migrator().HasTable(&Option{}) {
		return nil
	}

	var option Option
	err := DB.Model(&Option{}).
		Where(&Option{Key: "recall_campaign_setting.enabled"}).
		First(&option).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("failed to check recall campaign migration guard: %w", err)
	}

	enabled, err := strconv.ParseBool(strings.TrimSpace(option.Value))
	if err != nil {
		return fmt.Errorf("recall recipient identity migration requires recall_campaign_setting.enabled=false before schema swap; invalid stored value %q", option.Value)
	}
	if enabled {
		// This migration is not compatible with mixed-version Recall writers:
		// disable Recall and drain active recipient/message leases first.
		return fmt.Errorf("recall recipient identity migration requires recall_campaign_setting.enabled=false and drain/empty active recall recipient/message leases before schema swap")
	}
	hasActiveLeases, err := hasActiveRecallMigrationLeases(time.Now().Unix())
	if err != nil {
		return err
	}
	if hasActiveLeases {
		return fmt.Errorf("recall recipient identity migration requires recall_campaign_setting.enabled=false and drain/empty active recall recipient/message leases before schema swap")
	}
	return nil
}

func hasActiveRecallMigrationLeases(nowUnix int64) (bool, error) {
	for _, table := range []struct {
		model interface{}
		name  string
	}{
		{model: &RecallRecipient{}, name: "recall_recipients"},
		{model: &RecallMessage{}, name: "recall_messages"},
	} {
		if !DB.Migrator().HasTable(table.model) ||
			!DB.Migrator().HasColumn(table.model, "lease_owner") ||
			!DB.Migrator().HasColumn(table.model, "lease_expires_at") {
			continue
		}
		var activeLeases int64
		if err := DB.Model(table.model).
			Where("lease_owner <> ? AND lease_expires_at > ?", "", nowUnix).
			Count(&activeLeases).Error; err != nil {
			return false, fmt.Errorf("failed to check active %s leases for recall recipient identity migration: %w", table.name, err)
		}
		if activeLeases > 0 {
			return true, nil
		}
	}
	return false, nil
}

func migrateLOGDB() error {
	var err error
	if err = LOG_DB.AutoMigrate(&Log{}, &CompanyLogSchema{}, &LogRequestSample{}, &TaskAcceptedAccountingLogLedger{}); err != nil {
		return err
	}
	return nil
}

type sqliteColumnDef struct {
	Name string
	DDL  string
}

func ensureSubscriptionPlanTableSQLite() error {
	if !common.UsingSQLite {
		return nil
	}
	tableName := "subscription_plans"
	if !DB.Migrator().HasTable(tableName) {
		createSQL := `CREATE TABLE ` + "`" + tableName + "`" + ` (
` + "`id`" + ` integer,
` + "`title`" + ` varchar(128) NOT NULL,
` + "`subtitle`" + ` varchar(255) DEFAULT '',
` + "`price_amount`" + ` decimal(10,6) NOT NULL,
` + "`currency`" + ` varchar(8) NOT NULL DEFAULT 'USD',
` + "`pix_price_brl`" + ` decimal(10,6),
` + "`upi_price_inr`" + ` decimal(10,6),
` + "`duration_unit`" + ` varchar(16) NOT NULL DEFAULT 'month',
` + "`duration_value`" + ` integer NOT NULL DEFAULT 1,
` + "`custom_seconds`" + ` bigint NOT NULL DEFAULT 0,
` + "`enabled`" + ` numeric DEFAULT 1,
` + "`sort_order`" + ` integer DEFAULT 0,
` + "`tier_rank`" + ` integer,
` + "`allow_balance_pay`" + ` numeric DEFAULT 1,
` + "`stripe_price_id`" + ` varchar(128) DEFAULT '',
` + "`creem_product_id`" + ` varchar(128) DEFAULT '',
` + "`waffo_pancake_product_id`" + ` varchar(128) DEFAULT '',
` + "`max_purchase_per_user`" + ` integer DEFAULT 0,
` + "`upgrade_group`" + ` varchar(64) DEFAULT '',
` + "`total_amount`" + ` bigint NOT NULL DEFAULT 0,
` + "`window_5h_amount`" + ` bigint NOT NULL DEFAULT 0,
` + "`window_week_amount`" + ` bigint NOT NULL DEFAULT 0,
` + "`media_credits_monthly`" + ` bigint NOT NULL DEFAULT 0,
` + "`quota_reset_period`" + ` varchar(16) DEFAULT 'never',
` + "`quota_reset_custom_seconds`" + ` bigint DEFAULT 0,
` + "`model_count`" + ` integer NOT NULL DEFAULT 0,
` + "`rpm`" + ` integer NOT NULL DEFAULT 0,
` + "`concurrency`" + ` integer NOT NULL DEFAULT 0,
` + "`feature_lines`" + ` text DEFAULT '',
` + "`created_at`" + ` bigint,
` + "`updated_at`" + ` bigint,
` + "`seed_key`" + ` varchar(32),
PRIMARY KEY (` + "`id`" + `)
)`
		if err := DB.Exec(createSQL).Error; err != nil {
			return err
		}
		return DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS `idx_subscription_plans_seed_key` ON `" + tableName + "`(`seed_key`)").Error
	}
	var cols []struct {
		Name string `gorm:"column:name"`
	}
	if err := DB.Raw("PRAGMA table_info(`" + tableName + "`)").Scan(&cols).Error; err != nil {
		return err
	}
	existing := make(map[string]struct{}, len(cols))
	for _, c := range cols {
		existing[c.Name] = struct{}{}
	}
	required := []sqliteColumnDef{
		{Name: "title", DDL: "`title` varchar(128) NOT NULL"},
		{Name: "subtitle", DDL: "`subtitle` varchar(255) DEFAULT ''"},
		{Name: "price_amount", DDL: "`price_amount` decimal(10,6) NOT NULL"},
		{Name: "currency", DDL: "`currency` varchar(8) NOT NULL DEFAULT 'USD'"},
		{Name: "pix_price_brl", DDL: "`pix_price_brl` decimal(10,6)"},
		{Name: "upi_price_inr", DDL: "`upi_price_inr` decimal(10,6)"},
		{Name: "duration_unit", DDL: "`duration_unit` varchar(16) NOT NULL DEFAULT 'month'"},
		{Name: "duration_value", DDL: "`duration_value` integer NOT NULL DEFAULT 1"},
		{Name: "custom_seconds", DDL: "`custom_seconds` bigint NOT NULL DEFAULT 0"},
		{Name: "enabled", DDL: "`enabled` numeric DEFAULT 1"},
		{Name: "sort_order", DDL: "`sort_order` integer DEFAULT 0"},
		{Name: "tier_rank", DDL: "`tier_rank` integer"},
		{Name: "allow_balance_pay", DDL: "`allow_balance_pay` numeric DEFAULT 1"},
		{Name: "stripe_price_id", DDL: "`stripe_price_id` varchar(128) DEFAULT ''"},
		{Name: "creem_product_id", DDL: "`creem_product_id` varchar(128) DEFAULT ''"},
		{Name: "waffo_pancake_product_id", DDL: "`waffo_pancake_product_id` varchar(128) DEFAULT ''"},
		{Name: "max_purchase_per_user", DDL: "`max_purchase_per_user` integer DEFAULT 0"},
		{Name: "upgrade_group", DDL: "`upgrade_group` varchar(64) DEFAULT ''"},
		{Name: "total_amount", DDL: "`total_amount` bigint NOT NULL DEFAULT 0"},
		{Name: "window_5h_amount", DDL: "`window_5h_amount` bigint NOT NULL DEFAULT 0"},
		{Name: "window_week_amount", DDL: "`window_week_amount` bigint NOT NULL DEFAULT 0"},
		{Name: "media_credits_monthly", DDL: "`media_credits_monthly` bigint NOT NULL DEFAULT 0"},
		{Name: "quota_reset_period", DDL: "`quota_reset_period` varchar(16) DEFAULT 'never'"},
		{Name: "quota_reset_custom_seconds", DDL: "`quota_reset_custom_seconds` bigint DEFAULT 0"},
		{Name: "model_count", DDL: "`model_count` integer NOT NULL DEFAULT 0"},
		{Name: "rpm", DDL: "`rpm` integer NOT NULL DEFAULT 0"},
		{Name: "concurrency", DDL: "`concurrency` integer NOT NULL DEFAULT 0"},
		{Name: "feature_lines", DDL: "`feature_lines` text DEFAULT ''"},
		{Name: "created_at", DDL: "`created_at` bigint"},
		{Name: "updated_at", DDL: "`updated_at` bigint"},
		{Name: "seed_key", DDL: "`seed_key` varchar(32)"},
	}
	for _, col := range required {
		if _, ok := existing[col.Name]; ok {
			continue
		}
		if err := DB.Exec("ALTER TABLE `" + tableName + "` ADD COLUMN " + col.DDL).Error; err != nil {
			return err
		}
	}
	return DB.Exec("CREATE UNIQUE INDEX IF NOT EXISTS `idx_subscription_plans_seed_key` ON `" + tableName + "`(`seed_key`)").Error
}

// migrateTokenModelLimitsToText migrates model_limits column from varchar(1024) to text
// This is safe to run multiple times - it checks the column type first
func migrateTokenModelLimitsToText() error {
	// SQLite uses type affinity, so TEXT and VARCHAR are effectively the same — no migration needed
	if common.UsingSQLite {
		return nil
	}

	tableName := "tokens"
	columnName := "model_limits"

	if !DB.Migrator().HasTable(tableName) {
		return nil
	}

	if !DB.Migrator().HasColumn(&Token{}, columnName) {
		return nil
	}

	var alterSQL string
	if common.UsingPostgreSQL {
		var dataType string
		if err := DB.Raw(`SELECT data_type FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
			tableName, columnName).Scan(&dataType).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to query metadata for %s.%s: %v", tableName, columnName, err))
		} else if dataType == "text" {
			return nil
		}
		alterSQL = fmt.Sprintf(`ALTER TABLE %s ALTER COLUMN %s TYPE text`, tableName, columnName)
	} else if common.UsingMySQL {
		var columnType string
		if err := DB.Raw(`SELECT COLUMN_TYPE FROM information_schema.columns
				WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			tableName, columnName).Scan(&columnType).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to query metadata for %s.%s: %v", tableName, columnName, err))
		} else if strings.ToLower(columnType) == "text" {
			return nil
		}
		alterSQL = fmt.Sprintf("ALTER TABLE %s MODIFY COLUMN %s text", tableName, columnName)
	} else {
		return nil
	}

	if alterSQL != "" {
		if err := DB.Exec(alterSQL).Error; err != nil {
			return fmt.Errorf("failed to migrate %s.%s to text: %w", tableName, columnName, err)
		}
		common.SysLog(fmt.Sprintf("Successfully migrated %s.%s to text", tableName, columnName))
	}
	return nil
}

// migrateQuotaLifecycleStateCycleColumns widens the lifecycle key columns for
// existing databases. SQLite's regular AutoMigrate path normally handles the
// change, while this explicit call covers legacy schema metadata that remains
// narrow. The migration is idempotent and never narrows a column reported as
// already-wide text or character-varying data.
func migrateQuotaLifecycleStateCycleColumns() error {
	if DB == nil || !DB.Migrator().HasTable(&QuotaLifecycleState{}) {
		return nil
	}

	columnTypes, err := DB.Migrator().ColumnTypes(&QuotaLifecycleState{})
	if err != nil {
		return fmt.Errorf("failed to inspect quota lifecycle state columns: %w", err)
	}

	for _, fieldName := range []string{"Cycle", "Source"} {
		columnName := strings.ToLower(fieldName)
		var current gorm.ColumnType
		for _, columnType := range columnTypes {
			if strings.EqualFold(columnType.Name(), columnName) {
				current = columnType
				break
			}
		}
		if current == nil || quotaLifecycleStateColumnIsWideEnough(current) {
			continue
		}
		if err := DB.Migrator().AlterColumn(&QuotaLifecycleState{}, fieldName); err != nil {
			return fmt.Errorf("failed to widen quota_lifecycle_states.%s to varchar(255): %w", columnName, err)
		}
	}
	return nil
}

func quotaLifecycleStateColumnIsWideEnough(columnType gorm.ColumnType) bool {
	if declaredType, ok := columnType.ColumnType(); ok {
		declaredType = strings.ToLower(strings.TrimSpace(declaredType))
		if length, ok := quotaLifecycleColumnTypeLength(declaredType); ok {
			return length < 0 || length >= 255
		}
		switch declaredType {
		case "text", "tinytext", "mediumtext", "longtext", "clob":
			return true
		case "varchar", "character varying":
			if length, ok := columnType.Length(); ok {
				return length < 0 || length >= 255
			}
			return false
		}
	}

	databaseType := strings.ToLower(strings.TrimSpace(columnType.DatabaseTypeName()))
	if length, ok := columnType.Length(); ok {
		if length < 0 || length >= 255 {
			return true
		}
	}
	switch databaseType {
	case "text", "tinytext", "mediumtext", "longtext", "clob":
		return true
	}
	if databaseType == "varchar" || databaseType == "character varying" {
		// A driver may omit the declared length (for example, MySQL's
		// database/sql driver), so be conservative and widen it.
		return false
	}
	normalizedType := strings.ReplaceAll(databaseType, " ", "")
	return normalizedType == "varchar(255)" || normalizedType == "charactervarying(255)"
}

func quotaLifecycleColumnTypeLength(columnType string) (int64, bool) {
	open := strings.IndexByte(columnType, '(')
	if open < 0 {
		return 0, false
	}
	close := strings.IndexByte(columnType[open+1:], ')')
	if close < 0 {
		return 0, false
	}
	length, err := strconv.ParseInt(strings.TrimSpace(columnType[open+1:open+1+close]), 10, 64)
	if err != nil {
		return 0, false
	}
	return length, true
}

func migrateAssetBindingScopeColumns() error {
	if DB == nil {
		return nil
	}

	targets := []struct {
		model     any
		tableName string
	}{
		{model: &AssetBinding{}, tableName: "asset_bindings"},
		{model: &AssetModelCoverageTarget{}, tableName: "asset_model_coverage_targets"},
		{model: &AssetModelReadiness{}, tableName: "asset_model_readinesses"},
	}
	for _, target := range targets {
		if !DB.Migrator().HasTable(target.model) || !DB.Migrator().HasColumn(target.model, "binding_scope") {
			continue
		}

		columnTypes, err := DB.Migrator().ColumnTypes(target.model)
		if err != nil {
			return fmt.Errorf("failed to inspect %s.binding_scope: %w", target.tableName, err)
		}
		var current gorm.ColumnType
		for _, columnType := range columnTypes {
			if strings.EqualFold(columnType.Name(), "binding_scope") {
				current = columnType
				break
			}
		}
		if current == nil || assetBindingScopeColumnIsWideEnough(current) {
			continue
		}
		if err := DB.Migrator().AlterColumn(target.model, "BindingScope"); err != nil {
			return fmt.Errorf("failed to widen %s.binding_scope to varchar(%d): %w", target.tableName, AssetBindingScopeMaxLength, err)
		}
	}
	return nil
}

func assetBindingScopeColumnIsWideEnough(columnType gorm.ColumnType) bool {
	if declaredType, ok := columnType.ColumnType(); ok {
		declaredType = strings.ToLower(strings.TrimSpace(declaredType))
		if length, ok := quotaLifecycleColumnTypeLength(declaredType); ok {
			return length < 0 || length >= AssetBindingScopeMaxLength
		}
		switch declaredType {
		case "text", "tinytext", "mediumtext", "longtext", "clob":
			return true
		case "varchar", "character varying":
			if length, ok := columnType.Length(); ok {
				return length < 0 || length >= AssetBindingScopeMaxLength
			}
			return false
		}
	}

	databaseType := strings.ToLower(strings.TrimSpace(columnType.DatabaseTypeName()))
	if length, ok := quotaLifecycleColumnTypeLength(databaseType); ok {
		return length < 0 || length >= AssetBindingScopeMaxLength
	}
	switch databaseType {
	case "text", "tinytext", "mediumtext", "longtext", "clob":
		return true
	case "varchar", "character varying":
		if length, ok := columnType.Length(); ok {
			return length < 0 || length >= AssetBindingScopeMaxLength
		}
		return false
	default:
		// Unknown non-character metadata is not safe to rewrite automatically.
		return true
	}
}

// migrateSubscriptionPlanPriceAmount migrates price_amount column from float/double to decimal(10,6)
// This is safe to run multiple times - it checks the column type first
func migrateSubscriptionPlanPriceAmount() {
	// SQLite doesn't support ALTER COLUMN, and its type affinity handles this automatically
	// Skip early to avoid GORM parsing the existing table DDL which may cause issues
	if common.UsingSQLite {
		return
	}

	tableName := "subscription_plans"
	columnName := "price_amount"

	// Check if table exists first
	if !DB.Migrator().HasTable(tableName) {
		return
	}

	// Check if column exists
	if !DB.Migrator().HasColumn(&SubscriptionPlan{}, columnName) {
		return
	}

	var alterSQL string
	if common.UsingPostgreSQL {
		// PostgreSQL: Check if already decimal/numeric
		var dataType string
		if err := DB.Raw(`SELECT data_type FROM information_schema.columns
			WHERE table_schema = current_schema() AND table_name = ? AND column_name = ?`,
			tableName, columnName).Scan(&dataType).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to query metadata for %s.%s: %v", tableName, columnName, err))
		} else if dataType == "numeric" {
			return // Already decimal/numeric
		}
		alterSQL = fmt.Sprintf(`ALTER TABLE %s ALTER COLUMN %s TYPE decimal(10,6) USING %s::decimal(10,6)`,
			tableName, columnName, columnName)
	} else if common.UsingMySQL {
		// MySQL: Check if already decimal
		var columnType string
		if err := DB.Raw(`SELECT COLUMN_TYPE FROM information_schema.columns
				WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
			tableName, columnName).Scan(&columnType).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to query metadata for %s.%s: %v", tableName, columnName, err))
		} else if strings.HasPrefix(strings.ToLower(columnType), "decimal") {
			return // Already decimal
		}
		alterSQL = fmt.Sprintf("ALTER TABLE %s MODIFY COLUMN %s decimal(10,6) NOT NULL DEFAULT 0",
			tableName, columnName)
	} else {
		return
	}

	if alterSQL != "" {
		if err := DB.Exec(alterSQL).Error; err != nil {
			common.SysLog(fmt.Sprintf("Warning: failed to migrate %s.%s to decimal: %v", tableName, columnName, err))
		} else {
			common.SysLog(fmt.Sprintf("Successfully migrated %s.%s to decimal(10,6)", tableName, columnName))
		}
	}
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

// checkMySQLChineseSupport ensures the MySQL connection and current schema
// default charset/collation can store Chinese characters. It allows common
// Chinese-capable charsets (utf8mb4, utf8, gbk, big5, gb18030) and panics otherwise.
func checkMySQLChineseSupport(db *gorm.DB) error {
	// 仅检测：当前库默认字符集/排序规则 + 各表的排序规则（隐含字符集）

	// Read current schema defaults
	var schemaCharset, schemaCollation string
	err := db.Raw("SELECT DEFAULT_CHARACTER_SET_NAME, DEFAULT_COLLATION_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = DATABASE()").Row().Scan(&schemaCharset, &schemaCollation)
	if err != nil {
		return fmt.Errorf("读取当前库默认字符集/排序规则失败 / Failed to read schema default charset/collation: %v", err)
	}

	toLower := func(s string) string { return strings.ToLower(s) }
	// Allowed charsets that can store Chinese text
	allowedCharsets := map[string]string{
		"utf8mb4": "utf8mb4_",
		"utf8":    "utf8_",
		"gbk":     "gbk_",
		"big5":    "big5_",
		"gb18030": "gb18030_",
	}
	isChineseCapable := func(cs, cl string) bool {
		csLower := toLower(cs)
		clLower := toLower(cl)
		if prefix, ok := allowedCharsets[csLower]; ok {
			if clLower == "" {
				return true
			}
			return strings.HasPrefix(clLower, prefix)
		}
		// 如果仅提供了排序规则，尝试按排序规则前缀判断
		for _, prefix := range allowedCharsets {
			if strings.HasPrefix(clLower, prefix) {
				return true
			}
		}
		return false
	}

	// 1) 当前库默认值必须支持中文
	if !isChineseCapable(schemaCharset, schemaCollation) {
		return fmt.Errorf("当前库默认字符集/排序规则不支持中文：schema(%s/%s)。请将库设置为 utf8mb4/utf8/gbk/big5/gb18030 / Schema default charset/collation is not Chinese-capable: schema(%s/%s). Please set to utf8mb4/utf8/gbk/big5/gb18030",
			schemaCharset, schemaCollation, schemaCharset, schemaCollation)
	}

	// 2) 所有物理表的排序规则（隐含字符集）必须支持中文
	type tableInfo struct {
		Name      string
		Collation *string
	}
	var tables []tableInfo
	if err := db.Raw("SELECT TABLE_NAME, TABLE_COLLATION FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'").Scan(&tables).Error; err != nil {
		return fmt.Errorf("读取表排序规则失败 / Failed to read table collations: %v", err)
	}

	var badTables []string
	for _, t := range tables {
		// NULL 或空表示继承库默认设置，已在上面校验库默认，视为通过
		if t.Collation == nil || *t.Collation == "" {
			continue
		}
		cl := *t.Collation
		// 仅凭排序规则判断是否中文可用
		ok := false
		lower := strings.ToLower(cl)
		for _, prefix := range allowedCharsets {
			if strings.HasPrefix(lower, prefix) {
				ok = true
				break
			}
		}
		if !ok {
			badTables = append(badTables, fmt.Sprintf("%s(%s)", t.Name, cl))
		}
	}

	if len(badTables) > 0 {
		// 限制输出数量以避免日志过长
		maxShow := 20
		shown := badTables
		if len(shown) > maxShow {
			shown = shown[:maxShow]
		}
		return fmt.Errorf(
			"存在不支持中文的表，请修复其排序规则/字符集。示例（最多展示 %d 项）：%v / Found tables not Chinese-capable. Please fix their collation/charset. Examples (showing up to %d): %v",
			maxShow, shown, maxShow, shown,
		)
	}
	return nil
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
