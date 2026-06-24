package skillmodel

import (
	"path/filepath"
	"testing"
	"time"

	enums "github.com/QuantumNous/new-api/internal/skill/enums"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// openTestDB opens a file-based SQLite DB with FK enforcement enabled via DSN pragma.
// The DSN pragma applies foreign_keys=ON to every connection the pool creates (pool-safe).
// Runs MigrateSkills (DR-40) before MigrateUserEnabledSkills (DR-42) to satisfy the FK.
func openTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dir := t.TempDir()
	// DSN pragma: connection-pool safe; applies to every connection the pool creates.
	dbPath := filepath.Join(dir, "test_ues.db") + "?_pragma=foreign_keys(1)"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Silent),
	})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	require.NoError(t, MigrateSkills(db))            // DR-40: skills table must exist first
	require.NoError(t, MigrateUserEnabledSkills(db)) // DR-42: migrateUESSQLite creates table with FK
	return db
}

// seedSkillForTest inserts a fully populated Skill row and returns its unique ID.
// All NOT NULL columns are provided; uuid.New() ensures uniqueness per call.
func seedSkillForTest(t *testing.T, db *gorm.DB) string {
	t.Helper()
	skillID := uuid.New().String()
	skill := Skill{
		ID:                   skillID,
		Slug:                 "test-skill-" + skillID[:8],
		Status:               enums.SkillStatusPublished,
		Category:             "productivity",
		DefaultLocale:        "en",
		Name:                 "Test Skill",
		ShortDescription:     "A test skill for DR-42 tests.",
		Description:          "A test skill used in DR-42 integration test setup.",
		RequiredPlan:         enums.RequiredPlanFree,
		MonetizationType:     enums.MonetizationTypeFree,
		PriceMarkup:          0,
		TimeoutSeconds:       45,
		TimeoutRisk:          false,
		IsKidsSafe:           false,
		IsKidsExclusive:      false,
		KidsApprovalStatus:   enums.KidsApprovalStatusNotRequired,
		AIDisclosureRequired: true,
		FeaturedFlag:         false,
		CreatedBy:            1,
	}
	require.NoError(t, db.Create(&skill).Error)
	return skillID
}

// ── Phase 4: unit test (no DB) ───────────────────────────────────────────────

func TestUESTableName(t *testing.T) {
	got := UserEnabledSkill{}.TableName()
	if got != "user_enabled_skills" {
		t.Errorf("TableName() = %q, want %q", got, "user_enabled_skills")
	}
}

// ── Phase 5: SQLite functional integration tests ─────────────────────────────

func TestMigrateUserEnabledSkills_SQLite_SucceedsFromEmptyDB(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "migrate_test.db") + "?_pragma=foreign_keys(1)"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	require.NoError(t, MigrateSkills(db))
	require.NoError(t, MigrateUserEnabledSkills(db))
}

func TestMigrateUserEnabledSkills_SQLite_Idempotent(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "idempotent_test.db") + "?_pragma=foreign_keys(1)"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	require.NoError(t, MigrateSkills(db))
	require.NoError(t, MigrateUserEnabledSkills(db))
	require.NoError(t, MigrateUserEnabledSkills(db), "second call must be idempotent")
}

func TestFKConstraint_SQLite_Declared(t *testing.T) {
	db := openTestDB(t)

	type fkInfo struct {
		Table string `gorm:"column:table"`
		From  string `gorm:"column:from"`
		To    string `gorm:"column:to"`
	}
	var fks []fkInfo
	require.NoError(t, db.Raw(
		`SELECT "table", "from", "to" FROM pragma_foreign_key_list('user_enabled_skills')`,
	).Scan(&fks).Error)

	found := false
	for _, fk := range fks {
		if fk.Table == "skills" && fk.From == "skill_id" && fk.To == "id" {
			found = true
		}
	}
	assert.True(t, found, "user_enabled_skills must have FK skill_id → skills(id)")
}

func TestFKConstraint_SQLite_Enforced(t *testing.T) {
	db := openTestDB(t)

	// Deliberately use a non-existent skill_id — do NOT seed a skill here.
	now := time.Now().UTC()
	err := db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		1, 1, "00000000-0000-0000-0000-000000000000", true, now, "marketplace", now, now,
	).Error
	assert.Error(t, err, "FK violation: inserting non-existent skill_id must be rejected when FK enforcement is on")
}

func TestEnableSkillForUser_Insert(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "enabled must be true after Enable")
	assert.Nil(t, row.DisabledAt, "disabled_at must be nil after Enable")
	assert.Equal(t, "marketplace", row.Source, "source must default to marketplace")
	assert.False(t, row.EnabledAt.IsZero(), "enabled_at must be non-zero")
}

func TestEnableSkillForUser_Reenable(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var beforeRenable UserEnabledSkill
	require.NoError(t, db.First(&beforeRenable, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	createdAt := beforeRenable.CreatedAt

	time.Sleep(20 * time.Millisecond)
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "enabled must be true after re-enable")
	assert.Nil(t, row.DisabledAt, "disabled_at must be cleared on re-enable")
	assert.True(t, row.EnabledAt.After(beforeRenable.EnabledAt),
		"enabled_at must advance on re-enable (strict After, not Equal)")
	assert.Equal(t, createdAt.UTC().Truncate(time.Second), row.CreatedAt.UTC().Truncate(time.Second),
		"created_at must not change on re-enable")

	var count int64
	db.Model(&UserEnabledSkill{}).Where("user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Count(&count)
	assert.Equal(t, int64(1), count, "must remain exactly 1 row after re-enable")
}

func TestEnableSkillForUser_ReaddAfterRemoveClearsRemovedAt(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, RemoveSkillFromMySkills(db, 1, 1, skillID))

	var removed UserEnabledSkill
	require.NoError(t, db.First(&removed, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	require.NotNil(t, removed.RemovedAt, "removed_at must be set after Remove")

	time.Sleep(20 * time.Millisecond)
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "enabled must stay true after re-add")
	assert.Nil(t, row.RemovedAt, "removed_at must be cleared when the package is downloaded again")
	assert.True(t, row.EnabledAt.After(removed.EnabledAt), "enabled_at must advance on re-add")
}

func TestEnableSkillForUser_AlreadyEnabled(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	var first UserEnabledSkill
	require.NoError(t, db.First(&first, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)

	time.Sleep(20 * time.Millisecond)
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))

	var second UserEnabledSkill
	require.NoError(t, db.First(&second, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, second.EnabledAt.After(first.EnabledAt),
		"enabled_at must advance on repeated Enable (strict After, not Equal)")

	var count int64
	db.Model(&UserEnabledSkill{}).Where("user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Count(&count)
	assert.Equal(t, int64(1), count, "must remain exactly 1 row after second Enable")
}

func TestEnableSkillForUser_SetsEnabledAtViaBeforeCreate(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	// Direct db.Create with zero EnabledAt — BeforeCreate hook must fill it.
	row := UserEnabledSkill{
		UserID:    1,
		TenantID:  1,
		SkillID:   skillID,
		Enabled:   true,
		EnabledAt: time.Time{}, // explicitly zero
		Source:    "marketplace",
	}
	require.NoError(t, db.Create(&row).Error)
	assert.False(t, row.EnabledAt.IsZero(), "BeforeCreate must fill zero EnabledAt")

	var stored UserEnabledSkill
	require.NoError(t, db.First(&stored, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, stored.EnabledAt.IsZero(), "stored enabled_at must be non-zero")
}

func TestDisableSkillForUser(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, row.Enabled, "enabled must be false after Disable")
	assert.NotNil(t, row.DisabledAt, "disabled_at must be non-NULL after Disable")
}

func TestDisableSkillForUser_Idempotent(t *testing.T) {
	db := openTestDB(t)

	// Disable a row that does not exist — must return nil, no row created.
	err := DisableSkillForUser(db, 999, 999, uuid.New().String())
	require.NoError(t, err, "Disable on non-existent row must return nil")

	var count int64
	db.Model(&UserEnabledSkill{}).Where("user_id = ?", 999).Count(&count)
	assert.Equal(t, int64(0), count, "no row must be created")
}

func TestDisableSkillForUser_AlreadyDisabled(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var after1 UserEnabledSkill
	require.NoError(t, db.First(&after1, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)

	time.Sleep(5 * time.Millisecond)

	// Second Disable must be a strict no-op: disabled_at, enabled, updated_at must not change.
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var after2 UserEnabledSkill
	require.NoError(t, db.First(&after2, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.Equal(t, after1.DisabledAt, after2.DisabledAt, "disabled_at must not change on second Disable")
	assert.Equal(t, after1.Enabled, after2.Enabled, "enabled must not change on second Disable")
	assert.Equal(t, after1.UpdatedAt.UTC().Truncate(time.Millisecond),
		after2.UpdatedAt.UTC().Truncate(time.Millisecond),
		"updated_at must not change on no-op Disable")
}

func TestDisableSkillForUser_RepairsMissingDisabledAtWhenEnabledFalse(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	// Insert a half-bad row: enabled=false but disabled_at=NULL.
	now := time.Now().UTC()
	require.NoError(t, db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, disabled_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?)`,
		1, 1, skillID, false, now, "marketplace", now, now,
	).Error)

	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, row.Enabled, "enabled must remain false")
	assert.NotNil(t, row.DisabledAt, "disabled_at must be repaired (non-NULL)")
}

func TestRemoveSkillFromMySkills_PreservesEnabled(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, RemoveSkillFromMySkills(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "remove from My Skills must not disable runtime enabled-state")
	assert.NotNil(t, row.RemovedAt, "removed_at must be set")
	assert.Nil(t, row.DisabledAt, "disabled_at must remain untouched")
}

func TestRemoveSkillFromMySkills_Idempotent(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, RemoveSkillFromMySkills(db, 1, 1, skillID))

	var afterFirst UserEnabledSkill
	require.NoError(t, db.First(&afterFirst, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)

	time.Sleep(5 * time.Millisecond)
	require.NoError(t, RemoveSkillFromMySkills(db, 1, 1, skillID))

	var afterSecond UserEnabledSkill
	require.NoError(t, db.First(&afterSecond, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.Equal(t, afterFirst.RemovedAt, afterSecond.RemovedAt, "removed_at must not change on repeated Remove")
	assert.Equal(t, afterFirst.UpdatedAt.UTC().Truncate(time.Millisecond),
		afterSecond.UpdatedAt.UTC().Truncate(time.Millisecond),
		"updated_at must not change on repeated Remove")
	assert.True(t, afterSecond.Enabled)
}

func TestEnableSkillForUser_EnabledAtNotClearedOnDisable(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	var afterEnable UserEnabledSkill
	require.NoError(t, db.First(&afterEnable, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	enabledAt := afterEnable.EnabledAt

	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))
	var afterDisable UserEnabledSkill
	require.NoError(t, db.First(&afterDisable, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.Equal(t, enabledAt.UTC().Truncate(time.Millisecond),
		afterDisable.EnabledAt.UTC().Truncate(time.Millisecond),
		"enabled_at must not change after Disable")
}

func TestUpdateSkillLastUsedAt(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))
	require.NoError(t, UpdateLastUsedAt(db, 1, 1, skillID))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.NotNil(t, row.LastUsedAt, "last_used_at must be non-NULL after UpdateLastUsedAt")
	assert.False(t, row.LastUsedAt.IsZero(), "last_used_at must be non-zero")
}

func TestPrimaryKey_CompositeUnique(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)
	now := time.Now().UTC()

	insertSQL := `INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled, enabled_at, source, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	require.NoError(t, db.Exec(insertSQL, 1, 1, skillID, true, now, "marketplace", now, now).Error)
	err := db.Exec(insertSQL, 1, 1, skillID, true, now, "marketplace", now, now).Error
	assert.Error(t, err, "duplicate composite PK (user_id, tenant_id, skill_id) must be rejected")
}

func TestIndexes_Exist_SQLite(t *testing.T) {
	db := openTestDB(t)

	for _, name := range []string{"idx_user_enabled_by_user", "idx_user_enabled_by_skill"} {
		if !db.Migrator().HasIndex(&UserEnabledSkill{}, name) {
			t.Errorf("index %s must exist after MigrateUserEnabledSkills", name)
		}
	}
}

func TestTimestampDefaults_SQLite_ApprovedDeviation(t *testing.T) {
	db := openTestDB(t)

	// Verify no DB-level defaults for timestamp columns (approved deviation).
	type colInfo struct {
		Name    string  `gorm:"column:name"`
		DfltVal *string `gorm:"column:dflt_value"`
	}
	var cols []colInfo
	require.NoError(t, db.Raw(
		`SELECT name, dflt_value FROM pragma_table_info('user_enabled_skills')
		 WHERE name IN ('enabled_at', 'created_at', 'updated_at')`,
	).Scan(&cols).Error)

	for _, c := range cols {
		assert.Nil(t, c.DfltVal,
			"column %s must have no DB-level default on SQLite (approved deviation)", c.Name)
	}

	// Verify EnableSkillForUser fills all timestamps.
	skillID := seedSkillForTest(t, db)
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, ""))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.False(t, row.EnabledAt.IsZero(), "enabled_at must be non-zero after EnableSkillForUser")
	assert.False(t, row.CreatedAt.IsZero(), "created_at must be non-zero after insert")
	assert.False(t, row.UpdatedAt.IsZero(), "updated_at must be non-zero after insert")
}

func TestColumnDefaults_SQLite_EnabledAndSource(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)
	now := time.Now().UTC()

	// Raw INSERT omitting enabled and source — SQLite DDL DEFAULT 1 / DEFAULT 'marketplace' must fill them.
	require.NoError(t, db.Exec(`
		INSERT INTO user_enabled_skills
		  (user_id, tenant_id, skill_id, enabled_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?)`,
		1, 1, skillID, now, now, now,
	).Error)

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.True(t, row.Enabled, "enabled must default to true from SQLite DDL DEFAULT 1")
	assert.Equal(t, "marketplace", row.Source, "source must default to 'marketplace' from SQLite DDL DEFAULT")
}

func TestMigrateUserEnabledSkills_SQLite_AddsRemovedAtToExistingTable(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "removed_at_upgrade.db") + "?_pragma=foreign_keys(1)"
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{Logger: logger.Default.LogMode(logger.Silent)})
	require.NoError(t, err)
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			sqlDB.Close()
		}
	})
	require.NoError(t, MigrateSkills(db))
	require.NoError(t, db.Exec(`
		CREATE TABLE user_enabled_skills (
			user_id INTEGER NOT NULL,
			tenant_id INTEGER NOT NULL,
			skill_id TEXT(36) NOT NULL,
			enabled NUMERIC NOT NULL DEFAULT 1,
			enabled_at DATETIME NOT NULL,
			disabled_at DATETIME NULL,
			source TEXT NOT NULL DEFAULT 'marketplace',
			last_used_at DATETIME NULL,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL,
			PRIMARY KEY (user_id, tenant_id, skill_id)
		)`).Error)

	require.NoError(t, MigrateUserEnabledSkills(db))

	assert.True(t, db.Migrator().HasColumn(&UserEnabledSkill{}, "removed_at"),
		"SQLite upgrade must add removed_at to pre-DR-56 tables")
}

func TestEnableSkillForUser_Reenable_PreservesOriginalSource(t *testing.T) {
	db := openTestDB(t)
	skillID := seedSkillForTest(t, db)

	// First Enable with a non-default source.
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, "admin"))
	require.NoError(t, DisableSkillForUser(db, 1, 1, skillID))
	// Re-enable with a different source — original source must NOT be overwritten.
	require.NoError(t, EnableSkillForUser(db, 1, 1, skillID, "marketplace"))

	var row UserEnabledSkill
	require.NoError(t, db.First(&row, "user_id = ? AND tenant_id = ? AND skill_id = ?", 1, 1, skillID).Error)
	assert.Equal(t, "admin", row.Source,
		"ON CONFLICT DO UPDATE must not include source; original source must be preserved on re-enable")
}
