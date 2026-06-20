package skillmodel

import (
	"os"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// dropUESTables drops user_enabled_skills then skills in dependency order.
// Must run before MigrateSkills/MigrateUserEnabledSkills to guarantee a clean slate.
func dropUESTables(t *testing.T, db *gorm.DB) {
	t.Helper()
	require.NoError(t, db.Exec("DROP TABLE IF EXISTS user_enabled_skills").Error)
	require.NoError(t, db.Exec("DROP TABLE IF EXISTS skills").Error)
}

func openPGTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DR42_PG_DSN")
	if dsn == "" {
		t.Skip("DR42_PG_DSN not set")
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	dropUESTables(t, db)
	require.NoError(t, MigrateSkills(db))
	require.NoError(t, MigrateUserEnabledSkills(db))
	return db
}

func openMySQLTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("DR42_MYSQL_DSN")
	if dsn == "" {
		t.Skip("DR42_MYSQL_DSN not set")
	}
	db, err := gorm.Open(mysql.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	dropUESTables(t, db)
	require.NoError(t, MigrateSkills(db))
	require.NoError(t, MigrateUserEnabledSkills(db))
	return db
}

// ── PG tests ─────────────────────────────────────────────────────────────────

func TestMigrateUserEnabledSkills_PG_SucceedsFromEmptyDB(t *testing.T) {
	openPGTestDB(t) // dropUESTables + full migrate inside helper
}

func TestMigrateUserEnabledSkills_PG_Idempotent(t *testing.T) {
	db := openPGTestDB(t)
	require.NoError(t, MigrateUserEnabledSkills(db), "second call must be idempotent")
}

func TestFKConstraint_PG_Enforced(t *testing.T) {
	db := openPGTestDB(t)
	now := time.Now().UTC()
	err := db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, source, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		1, 1, uuid.New().String(), true, now, "marketplace", now, now,
	).Error
	assert.Error(t, err, "FK violation: inserting non-existent skill_id must be rejected on PG")
}

func TestUESTimestampDefaults_PG(t *testing.T) {
	db := openPGTestDB(t)

	type colDefault struct {
		Name    string  `gorm:"column:column_name"`
		Default *string `gorm:"column:column_default"`
	}
	var cols []colDefault
	require.NoError(t, db.Raw(`
		SELECT column_name, column_default
		FROM information_schema.columns
		WHERE table_schema = current_schema()
		  AND table_name = 'user_enabled_skills'
		  AND column_name IN ('enabled_at', 'created_at', 'updated_at')
	`).Scan(&cols).Error)

	require.Len(t, cols, 3, "must find 3 timestamp columns in information_schema")
	for _, c := range cols {
		assert.NotNil(t, c.Default, "column %s must have a DB-level default on PG", c.Name)
	}
}

func TestIndexes_PG(t *testing.T) {
	db := openPGTestDB(t)

	type idxRow struct {
		IndexName string `gorm:"column:indexname"`
	}
	var rows []idxRow
	require.NoError(t, db.Raw(`
		SELECT indexname FROM pg_indexes
		WHERE tablename = 'user_enabled_skills'
	`).Scan(&rows).Error)

	names := make(map[string]bool)
	for _, r := range rows {
		names[r.IndexName] = true
	}
	assert.True(t, names["idx_user_enabled_by_user"], "idx_user_enabled_by_user must exist on PG")
	assert.True(t, names["idx_user_enabled_by_skill"], "idx_user_enabled_by_skill must exist on PG")
}

// TestEnableSkillForUser_ConcurrentEnable_PG is a CI blocking gate.
// 50 goroutines race to Enable the same (user, tenant, skill) row; exactly 1 row must exist.
func TestEnableSkillForUser_ConcurrentEnable_PG(t *testing.T) {
	db := openPGTestDB(t)
	skillID := seedSkillForTest(t, db)

	const goroutines = 50
	var wg sync.WaitGroup
	errs := make([]error, goroutines)
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = EnableSkillForUser(db, 1, 1, skillID, "marketplace")
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		require.NoError(t, err, "goroutine %d returned error", i)
	}

	var count int64
	db.Model(&UserEnabledSkill{}).
		Where("user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).
		Count(&count)
	assert.Equal(t, int64(1), count, "concurrent Enable must produce exactly 1 row")
}

// ── MySQL tests ───────────────────────────────────────────────────────────────

func TestMigrateUserEnabledSkills_MySQL_SucceedsFromEmptyDB(t *testing.T) {
	openMySQLTestDB(t)
}

func TestMigrateUserEnabledSkills_MySQL_Idempotent(t *testing.T) {
	db := openMySQLTestDB(t)
	require.NoError(t, MigrateUserEnabledSkills(db), "second call must be idempotent")
}

func TestFKConstraint_MySQL_Enforced(t *testing.T) {
	db := openMySQLTestDB(t)
	now := time.Now().UTC()
	err := db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		1, 1, uuid.New().String(), true, now, "marketplace", now, now,
	).Error
	assert.Error(t, err, "FK violation: inserting non-existent skill_id must be rejected on MySQL")
}

func TestUESTimestampDefaults_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)

	type colDefault struct {
		Name    string  `gorm:"column:COLUMN_NAME"`
		Default *string `gorm:"column:COLUMN_DEFAULT"`
	}
	var cols []colDefault
	require.NoError(t, db.Raw(`
		SELECT COLUMN_NAME, COLUMN_DEFAULT
		FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = 'user_enabled_skills'
		  AND COLUMN_NAME IN ('enabled_at', 'created_at', 'updated_at')
	`).Scan(&cols).Error)

	require.Len(t, cols, 3, "must find 3 timestamp columns in information_schema")
	for _, c := range cols {
		assert.NotNil(t, c.Default, "column %s must have a DB-level default on MySQL", c.Name)
	}

	// Verify DB default auto-fills timestamps when raw INSERT omits them.
	skillID := seedSkillForTest(t, db)
	err := db.Exec(`
		INSERT INTO user_enabled_skills (user_id, tenant_id, skill_id, enabled, source)
		VALUES (?, ?, ?, 1, 'marketplace')`,
		99, 99, skillID,
	).Error
	assert.NoError(t, err, "raw INSERT omitting timestamp cols must succeed via DB default")

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 99, 99, skillID).Error)
	assert.False(t, row.EnabledAt.IsZero(), "enabled_at must be auto-filled by DB default")
	assert.False(t, row.CreatedAt.IsZero(), "created_at must be auto-filled by DB default")
	assert.False(t, row.UpdatedAt.IsZero(), "updated_at must be auto-filled by DB default")
}

func TestUESTimestampDefaults_MySQL_RepairsOnUpdateWhenDefaultPresent(t *testing.T) {
	db := openMySQLTestDB(t)

	// Simulate: remove ON UPDATE clause from updated_at, keep DEFAULT.
	require.NoError(t, db.Exec(
		"ALTER TABLE user_enabled_skills MODIFY COLUMN updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)",
	).Error)

	// Verify ON UPDATE is missing before re-run.
	var extra string
	require.NoError(t, db.Raw(`
		SELECT EXTRA FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = 'user_enabled_skills' AND COLUMN_NAME = 'updated_at'
	`).Scan(&extra).Error)
	assert.NotContains(t, extra, "on update", "setup: ON UPDATE must be absent before repair")

	// Re-run migrateUESTimestampDefaults — must restore ON UPDATE.
	require.NoError(t, migrateUESTimestampDefaults(db))

	require.NoError(t, db.Raw(`
		SELECT EXTRA FROM information_schema.columns
		WHERE table_schema = DATABASE()
		  AND table_name = 'user_enabled_skills' AND COLUMN_NAME = 'updated_at'
	`).Scan(&extra).Error)
	assert.Contains(t, extra, "on update", "updated_at ON UPDATE must be restored after repair")
}

func TestIndexes_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)

	type idxRow struct {
		IndexName string `gorm:"column:INDEX_NAME"`
	}
	var rows []idxRow
	require.NoError(t, db.Raw(`
		SELECT DISTINCT INDEX_NAME
		FROM information_schema.statistics
		WHERE table_schema = DATABASE()
		  AND table_name = 'user_enabled_skills'
	`).Scan(&rows).Error)

	names := make(map[string]bool)
	for _, r := range rows {
		names[r.IndexName] = true
	}
	assert.True(t, names["idx_user_enabled_by_user"], "idx_user_enabled_by_user must exist on MySQL")
	assert.True(t, names["idx_user_enabled_by_skill"], "idx_user_enabled_by_skill must exist on MySQL")
}

// TestEnableSkillForUser_ConcurrentEnable_MySQL is a CI blocking gate.
// 50 goroutines race to Enable the same (user, tenant, skill) row; exactly 1 row must exist.
func TestEnableSkillForUser_ConcurrentEnable_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)
	skillID := seedSkillForTest(t, db)

	const goroutines = 50
	var wg sync.WaitGroup
	errs := make([]error, goroutines)
	for i := 0; i < goroutines; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			errs[idx] = EnableSkillForUser(db, 1, 1, skillID, "marketplace")
		}(i)
	}
	wg.Wait()

	for i, err := range errs {
		require.NoError(t, err, "goroutine %d returned error", i)
	}

	var count int64
	db.Model(&UserEnabledSkill{}).
		Where("user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).
		Count(&count)
	assert.Equal(t, int64(1), count, "concurrent Enable must produce exactly 1 row")
}

// TestEnableSkillForUser_Reenable_PreservesOriginalSource_MySQL locks in the MySQL-specific
// ON DUPLICATE KEY UPDATE path: source must NOT appear in the UPDATE clause.
func TestEnableSkillForUser_Reenable_PreservesOriginalSource_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, "admin"))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))
	// Re-enable with a different source — MySQL ON DUPLICATE KEY UPDATE must not overwrite source.
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, "marketplace"))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.Equal(t, "admin", row.Source,
		"MySQL ON DUPLICATE KEY UPDATE must not include source; original source must be preserved on re-enable")
}

// TestUESColumnDefaults_PG verifies that raw INSERT omitting enabled and source
// gets DB-level defaults (DEFAULT true / DEFAULT 'marketplace') applied by PG.
func TestUESColumnDefaults_PG(t *testing.T) {
	db := openPGTestDB(t)
	skillID := seedSkillForTest(t, db)
	now := time.Now().UTC()

	// Omit enabled and source — AutoMigrate struct-tag defaults must fill them.
	require.NoError(t, db.Exec(`
		INSERT INTO user_enabled_skills (user_id, tenant_id, skill_id, enabled_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		1, 1, skillID, now, now, now,
	).Error)

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "enabled must default to true from PG DB-level default")
	assert.Equal(t, "marketplace", row.Source, "source must default to 'marketplace' from PG DB-level default")
}

// TestUESColumnDefaults_MySQL verifies that raw INSERT omitting enabled and source
// gets DB-level defaults (DEFAULT 1 / DEFAULT 'marketplace') applied by MySQL.
func TestUESColumnDefaults_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)
	skillID := seedSkillForTest(t, db)
	now := time.Now().UTC()

	// Omit enabled and source — AutoMigrate struct-tag defaults must fill them.
	require.NoError(t, db.Exec(`
		INSERT INTO user_enabled_skills (user_id, tenant_id, skill_id, enabled_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		99, 99, skillID, now, now, now,
	).Error)

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 99, 99, skillID).Error)
	assert.True(t, row.Enabled, "enabled must default to true (1) from MySQL DB-level default")
	assert.Equal(t, "marketplace", row.Source, "source must default to 'marketplace' from MySQL DB-level default")
}

// ── Disable + UpdateLastUsedAt cross-dialect smoke tests ─────────────────────
// These helpers use raw SQL with bool/time parameters whose binding varies by
// dialect. The SQLite test suite covers all edge cases; these smoke tests verify
// the raw SQL runs without error and produces correct column values on PG and MySQL.

func TestDisableSkillForUser_PG(t *testing.T) {
	db := openPGTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, row.Enabled, "enabled must be false after Disable on PG")
	assert.NotNil(t, row.DisabledAt, "disabled_at must be non-NULL after Disable on PG")
}

func TestDisableSkillForUser_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, row.Enabled, "enabled must be false after Disable on MySQL")
	assert.NotNil(t, row.DisabledAt, "disabled_at must be non-NULL after Disable on MySQL")
}

func TestUpdateLastUsedAt_PG(t *testing.T) {
	db := openPGTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, UpdateLastUsedAt(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.NotNil(t, row.LastUsedAt, "last_used_at must be non-NULL after UpdateLastUsedAt on PG")
	assert.False(t, row.LastUsedAt.IsZero(), "last_used_at must be non-zero after UpdateLastUsedAt on PG")
}

func TestUpdateLastUsedAt_MySQL(t *testing.T) {
	db := openMySQLTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, UpdateLastUsedAt(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.NotNil(t, row.LastUsedAt, "last_used_at must be non-NULL after UpdateLastUsedAt on MySQL")
	assert.False(t, row.LastUsedAt.IsZero(), "last_used_at must be non-zero after UpdateLastUsedAt on MySQL")
}
