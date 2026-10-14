package model

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type legacyBatchTask struct {
	ID        int64      `gorm:"primaryKey"`
	TaskID    string     `gorm:"type:varchar(191);index"`
	Status    TaskStatus `gorm:"type:varchar(20);index"`
	Progress  string     `gorm:"type:varchar(20);index"`
	CreatedAt int64
	UpdatedAt int64
}

func testBatchSchemaMigration(t *testing.T, db *gorm.DB) {
	t.Helper()
	suffix := fmt.Sprintf("%d", time.Now().UnixNano())
	taskTable := "batch_migration_tasks_" + suffix
	fileTable := "batch_migration_files_" + suffix
	batchTable := "batch_migration_batches_" + suffix
	itemTable := "batch_migration_items_" + suffix
	t.Cleanup(func() {
		_ = db.Migrator().DropTable(itemTable)
		_ = db.Migrator().DropTable(batchTable)
		_ = db.Migrator().DropTable(fileTable)
		_ = db.Migrator().DropTable(taskTable)
	})

	require.NoError(t, db.Table(taskTable).AutoMigrate(&legacyBatchTask{}))
	legacy := legacyBatchTask{
		TaskID:    "task-preserved",
		Status:    TaskStatusNotStart,
		Progress:  "0%",
		CreatedAt: 1,
		UpdatedAt: 1,
	}
	require.NoError(t, db.Table(taskTable).Create(&legacy).Error)

	for range 2 {
		require.NoError(t, db.Table(taskTable).AutoMigrate(&Task{}))
		require.NoError(t, db.Table(fileTable).AutoMigrate(&APIFile{}))
		require.NoError(t, db.Table(batchTable).AutoMigrate(&Batch{}))
		require.NoError(t, db.Table(itemTable).AutoMigrate(&BatchItem{}))
	}

	var upgraded Task
	require.NoError(t, db.Table(taskTable).First(&upgraded, legacy.ID).Error)
	assert.Equal(t, legacy.TaskID, upgraded.TaskID)
	assert.True(t, db.Table(taskTable).Migrator().HasColumn(&Task{}, "dispatch_status"))
	assert.True(t, db.Table(taskTable).Migrator().HasColumn(&Task{}, "dispatch_lock_until"))
	assert.True(t, db.Table(taskTable).Migrator().HasColumn(&Task{}, "dispatch_started_at"))
	assert.True(t, db.Table(taskTable).Migrator().HasColumn(&Task{}, "dispatch_protocol_version"))
	assert.Zero(t, upgraded.DispatchProtocolVersion)

	scope := "user:token:key"
	batch := Batch{
		BatchID:          "batch-schema",
		UserID:           7,
		TokenID:          11,
		InputFileID:      "file-input",
		Endpoint:         "/v1/responses",
		IdempotencyScope: &scope,
		RequestHash:      "request-hash",
	}
	require.NoError(t, db.Table(batchTable).Create(&batch).Error)
	require.NoError(t, db.Table(itemTable).Create(&BatchItem{
		BatchRecordID: batch.ID,
		LineNumber:    1,
		CustomID:      "custom-one",
		Method:        "POST",
		URL:           "/v1/responses",
		Body:          json.RawMessage(`{"model":"gpt-test"}`),
	}).Error)
	duplicate := BatchItem{
		BatchRecordID: batch.ID,
		LineNumber:    2,
		CustomID:      "custom-one",
		Method:        "POST",
		URL:           "/v1/responses",
		Body:          json.RawMessage(`{"model":"gpt-test"}`),
	}
	assert.Error(t, db.Table(itemTable).Create(&duplicate).Error)

	file := APIFile{
		FileID:     "file-schema",
		UserID:     7,
		TokenID:    11,
		Purpose:    APIFilePurposeBatch,
		Filename:   "input.jsonl",
		Bytes:      10,
		SHA256:     strings.Repeat("a", 64),
		StorageKey: "7/storage-key",
	}
	require.NoError(t, db.Table(fileTable).Create(&file).Error)
	var storedFile APIFile
	require.NoError(t, db.Table(fileTable).Where("file_id = ?", file.FileID).First(&storedFile).Error)
	assert.Equal(t, file.StorageKey, storedFile.StorageKey)
}

func TestBatchSchemaMigrationSQLite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	testBatchSchemaMigration(t, db)
}

func TestBatchSchemaMigrationMySQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN is not configured")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	testBatchSchemaMigration(t, db)
}

func TestBatchSchemaMigrationPostgreSQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_POSTGRES_DSN"))
	if dsn == "" {
		t.Skip("TEST_POSTGRES_DSN is not configured")
	}
	db, err := gorm.Open(postgres.New(postgres.Config{
		DSN:                  dsn,
		PreferSimpleProtocol: true,
	}), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { require.NoError(t, sqlDB.Close()) })
	testBatchSchemaMigration(t, db)
}
