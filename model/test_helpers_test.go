package model

import (
	"os"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"gorm.io/driver/mysql"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

// setupTestDB initializes a test database connection from TEST_SQL_DSN environment variable.
// Supports MySQL and PostgreSQL. Each test cleans up data via t.Cleanup.
func setupTestDB(t *testing.T) {
	t.Helper()

	dsn := os.Getenv("TEST_SQL_DSN")
	if dsn == "" {
		t.Skip("TEST_SQL_DSN not set, skipping database test")
	}

	common.RedisEnabled = false

	var db *gorm.DB
	var err error

	if strings.HasPrefix(dsn, "postgres://") || strings.HasPrefix(dsn, "postgresql://") {
		common.UsingPostgreSQL = true
		common.UsingMySQL = false
		common.UsingSQLite = false
		db, err = gorm.Open(postgres.New(postgres.Config{
			DSN:                  dsn,
			PreferSimpleProtocol: true,
		}), &gorm.Config{})
	} else {
		common.UsingPostgreSQL = false
		common.UsingMySQL = true
		common.UsingSQLite = false
		if !strings.Contains(dsn, "parseTime") {
			if strings.Contains(dsn, "?") {
				dsn += "&parseTime=true"
			} else {
				dsn += "?parseTime=true"
			}
		}
		db, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	}
	if err != nil {
		t.Fatalf("failed to open test db: %v", err)
	}

	DB = db
	LOG_DB = db

	initCol()

	// migrate tables needed for tests
	err = DB.AutoMigrate(&User{}, &UserSubscription{}, &Redemption{}, &Log{}, &SubscriptionPlan{})
	if err != nil {
		t.Fatalf("failed to migrate test db: %v", err)
	}

	// Invalidate subscription plan cache to avoid stale data from previous tests
	for i := 1; i <= 100; i++ {
		InvalidateSubscriptionPlanCache(i)
	}

	// Clean test data before each test
	cleanTestData(t)

	t.Cleanup(func() {
		cleanTestData(t)
	})
}

// cleanTestData removes all test data from tables
func cleanTestData(t *testing.T) {
	t.Helper()
	// Use Unscoped to also delete soft-deleted records
	DB.Exec("DELETE FROM user_subscriptions")
	DB.Exec("DELETE FROM redemptions")
	DB.Exec("DELETE FROM logs")
	DB.Exec("DELETE FROM subscription_plans")
	DB.Exec("DELETE FROM users")
}

// createTestUser creates a user with given group and baseLevel, returns user ID
func createTestUser(t *testing.T, group string, baseLevel string) int {
	t.Helper()
	user := &User{
		Username: "testuser_" + common.GetRandomString(6),
		Password: "testpassword",
		Group:    group,
		Status:   common.UserStatusEnabled,
		Role:     common.RoleCommonUser,
	}
	err := DB.Create(user).Error
	if err != nil {
		t.Fatalf("failed to create test user: %v", err)
	}
	// update base_level separately since GORM may not handle it in Create if field is new
	err = DB.Model(&User{}).Where("id = ?", user.Id).Update("base_level", baseLevel).Error
	if err != nil {
		t.Fatalf("failed to set base_level: %v", err)
	}
	return user.Id
}

// createTestPlan creates a subscription plan, returns plan ID
func createTestPlan(t *testing.T, title string, upgradeGroup string, durationDays int) int {
	t.Helper()
	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:         title,
		PriceAmount:   0,
		Currency:      "USD",
		DurationUnit:  SubscriptionDurationDay,
		DurationValue: durationDays,
		Enabled:       true,
		UpgradeGroup:  upgradeGroup,
		TotalAmount:   0,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
	err := DB.Create(plan).Error
	if err != nil {
		t.Fatalf("failed to create test plan: %v", err)
	}
	return plan.Id
}

// getUserGroup reads the current group from DB
func getUserGroup(t *testing.T, userId int) string {
	t.Helper()
	var group string
	err := DB.Model(&User{}).Where("id = ?", userId).Select(commonGroupCol).Find(&group).Error
	if err != nil {
		t.Fatalf("failed to get user group: %v", err)
	}
	return group
}

// getUserBaseLevel reads the current base_level from DB
func getUserBaseLevel(t *testing.T, userId int) string {
	t.Helper()
	var baseLevel string
	err := DB.Model(&User{}).Where("id = ?", userId).Select("base_level").Find(&baseLevel).Error
	if err != nil {
		t.Fatalf("failed to get user base_level: %v", err)
	}
	return baseLevel
}

func TestMain(m *testing.M) {
	os.Exit(m.Run())
}

// createTestRedemption creates a redemption with all fields properly saved (including false booleans)
func createTestRedemption(t *testing.T, r *Redemption) {
	t.Helper()
	err := DB.Select("user_id", "key", "status", "name", "quota", "created_time", "type",
		"subscription_plan_id", "upgrade_group", "upgrade_group_rollback", "expired_time").
		Create(r).Error
	if err != nil {
		t.Fatalf("failed to create test redemption: %v", err)
	}
}
