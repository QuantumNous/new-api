package model

import (
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
	"gorm.io/gorm/clause"
	"gorm.io/gorm/schema"
)

func testModerationUniqueMigrationNonPostgreSQL(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.AutoMigrate(
		&ModerationTokenState{},
		&ModerationAccountState{},
		&ModerationUserRecord{},
	))

	state := ModerationTokenState{UserID: 7, TokenID: 11, PreviousStatus: 1, CreatedAt: 1}
	require.NoError(t, db.Create(&state).Error)

	for range 2 {
		require.NoError(t, migrateModerationUniqueConstraints(db))
		require.NoError(t, db.AutoMigrate(&ModerationTokenState{}))
	}

	var preserved ModerationTokenState
	require.NoError(t, db.Where("id = ?", state.ID).First(&preserved).Error)
	assert.Equal(t, 11, preserved.TokenID)
	assert.Equal(t, 7, preserved.UserID)
}

func TestMigrateModerationUniqueConstraintsSQLite(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	testModerationUniqueMigrationNonPostgreSQL(t, db)
}

func TestMigrateModerationUniqueConstraintsMySQL(t *testing.T) {
	dsn := strings.TrimSpace(os.Getenv("TEST_MYSQL_DSN"))
	if dsn == "" {
		t.Skip("TEST_MYSQL_DSN is not configured")
	}

	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{
			TablePrefix: fmt.Sprintf("moderation_test_%d_", time.Now().UnixNano()),
		},
	})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	t.Cleanup(func() { _ = sqlDB.Close() })
	t.Cleanup(func() {
		assert.NoError(t, db.Migrator().DropTable(&ModerationTokenState{}, &ModerationAccountState{}, &ModerationUserRecord{}))
	})
	testModerationUniqueMigrationNonPostgreSQL(t, db)
}

func TestMigrateModerationUniqueConstraintsPostgreSQL(t *testing.T) {
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
	t.Cleanup(func() { _ = sqlDB.Close() })

	tests := []struct {
		name       string
		prepareOld func(*testing.T, *gorm.DB)
	}{
		{name: "fresh"},
		{
			name: "postgres_default_constraint_moderation_token_states",
			prepareOld: func(t *testing.T, tx *gorm.DB) {
				t.Helper()
				_ = tx.Migrator().DropIndex(&ModerationTokenState{}, "idx_moderation_token_states_token_id")
				require.NoError(t, tx.Exec(
					"ALTER TABLE ? ADD CONSTRAINT ? UNIQUE (?)",
					clause.Table{Name: "moderation_token_states"},
					clause.Column{Name: "moderation_token_states_token_id_key"},
					clause.Column{Name: "token_id"},
				).Error)
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tx := db.Begin()
			require.NoError(t, tx.Error)
			t.Cleanup(func() { _ = tx.Rollback().Error })

			schemaName := fmt.Sprintf("moderation_migration_%d", time.Now().UnixNano())
			require.NoError(t, tx.Exec("CREATE SCHEMA ?", clause.Table{Name: schemaName}).Error)
			require.NoError(t, tx.Exec("SET LOCAL search_path TO ?", clause.Table{Name: schemaName}).Error)

			require.NoError(t, migrateModerationUniqueConstraints(tx))
			require.NoError(t, tx.AutoMigrate(
				&ModerationTokenState{},
				&ModerationAccountState{},
				&ModerationUserRecord{},
			))

			state := ModerationTokenState{UserID: 9, TokenID: 21, PreviousStatus: 1, CreatedAt: 1}
			require.NoError(t, tx.Create(&state).Error)
			if tt.prepareOld != nil {
				tt.prepareOld(t, tx)
			}

			for range 2 {
				require.NoError(t, migrateModerationUniqueConstraints(tx))
				require.NoError(t, tx.AutoMigrate(
					&ModerationTokenState{},
					&ModerationAccountState{},
					&ModerationUserRecord{},
				))
			}

			var preserved ModerationTokenState
			require.NoError(t, tx.Where("id = ?", state.ID).First(&preserved).Error)
			assert.Equal(t, 21, preserved.TokenID)
		})
	}
}

func TestDropLegacyModerationTables(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	for _, table := range legacyModerationTables {
		require.NoError(t, db.Exec(fmt.Sprintf("CREATE TABLE %s (id INTEGER PRIMARY KEY)", table)).Error)
		require.True(t, db.Migrator().HasTable(table))
	}
	require.NoError(t, DropLegacyModerationTables(db))
	for _, table := range legacyModerationTables {
		assert.False(t, db.Migrator().HasTable(table))
	}
	require.NoError(t, DropLegacyModerationTables(db))
}

func TestMigrateModerationUserRecordOverrideAt(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&ModerationUserRecord{}))
	record := ModerationUserRecord{
		UserID:         3,
		OverrideActive: true,
		OverrideAt:     0,
		CreatedAt:      1,
		UpdatedAt:      1,
	}
	require.NoError(t, db.Create(&record).Error)
	require.NoError(t, migrateModerationUserRecordOverrideAt(db))
	var stored ModerationUserRecord
	require.NoError(t, db.First(&stored, record.ID).Error)
	assert.Greater(t, stored.OverrideAt, int64(0))
}
