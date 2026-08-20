package model

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func setupRegistrationDomainRiskTest(t *testing.T) {
	t.Helper()
	originalDB := DB
	originalLogDB := LOG_DB
	originalRedis := common.RedisEnabled
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/registration-risk.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	require.NoError(t, db.AutoMigrate(
		&User{},
		&Option{},
		&RegistrationDomainState{},
		&RegistrationDomainBlock{},
		&RegistrationDomainBlockUser{},
		&RecallLifecycleEvent{},
		&QuotaLifecycleState{},
	))
	t.Cleanup(func() {
		sqlDB, _ := db.DB()
		_ = sqlDB.Close()
		DB = originalDB
		LOG_DB = originalLogDB
		common.RedisEnabled = originalRedis
	})
}

type registrationDomainSQLRecorder struct {
	entries []string
}

func (r *registrationDomainSQLRecorder) Printf(format string, args ...any) {
	r.entries = append(r.entries, fmt.Sprintf(format, args...))
}

func TestReleaseRegistrationDomainBlockWithTrustedDomainQuotesOptionKeyForMySQL(t *testing.T) {
	const optionKey = "registration_security.trusted_email_domains"

	originalDB := DB
	originalRedis := common.RedisEnabled
	originalKeyCol := commonKeyCol
	originalConfig := config.GlobalConfig.ExportAllConfigs()
	savedRegistrationConfig := make(map[string]string)
	for key, value := range originalConfig {
		if strings.HasPrefix(key, "registration_security.") {
			savedRegistrationConfig[key] = value
		}
	}
	common.OptionMapRWMutex.Lock()
	optionMapWasNil := common.OptionMap == nil
	if optionMapWasNil {
		common.OptionMap = make(map[string]string)
	}
	originalOptionValue, hadOriginalOptionValue := common.OptionMap[optionKey]
	common.OptionMapRWMutex.Unlock()

	sqliteDB, err := gorm.Open(sqlite.Open(t.TempDir()+"/registration-risk-mysql-dry-run.db"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := sqliteDB.DB()
	require.NoError(t, err)
	recorder := &registrationDomainSQLRecorder{}
	mysqlDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      sqlDB,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		DryRun:               true,
		DisableAutomaticPing: true,
		Logger: logger.New(recorder, logger.Config{
			LogLevel: logger.Info,
		}),
	})
	require.NoError(t, err)

	DB = mysqlDB
	common.RedisEnabled = false
	commonKeyCol = "`key`"
	t.Cleanup(func() {
		DB = originalDB
		common.RedisEnabled = originalRedis
		commonKeyCol = originalKeyCol
		require.NoError(t, config.GlobalConfig.LoadFromDB(savedRegistrationConfig))
		common.OptionMapRWMutex.Lock()
		if optionMapWasNil {
			common.OptionMap = nil
		} else if hadOriginalOptionValue {
			common.OptionMap[optionKey] = originalOptionValue
		} else {
			delete(common.OptionMap, optionKey)
		}
		common.OptionMapRWMutex.Unlock()
		require.NoError(t, sqlDB.Close())
	})
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"registration_security.domain_risk_window_hours": "24",
		"registration_security.domain_risk_threshold":    "10",
		optionKey: "[]",
	}))

	_, err = ReleaseRegistrationDomainBlockWithTrustedDomain(1, 99, true, time.Now().Unix(), "dry-run.example")
	require.NoError(t, err)
	var optionLockQuery string
	for _, query := range recorder.entries {
		if strings.Contains(query, "FROM `options`") && strings.Contains(query, "FOR UPDATE") {
			optionLockQuery = query
			break
		}
	}
	require.NotEmpty(t, optionLockQuery)
	require.Contains(t, optionLockQuery, "WHERE `key` =")
	require.NotContains(t, optionLockQuery, "WHERE key =")
}

func seedDomainRiskUsers(t *testing.T, domain string, enabled int, disabled int, createdAt int64) []User {
	t.Helper()
	users := make([]User, 0, enabled+disabled)
	for i := 0; i < enabled+disabled; i++ {
		status := common.UserStatusEnabled
		if i >= enabled {
			status = common.UserStatusDisabled
		}
		user := User{
			Username:    fmt.Sprintf("risk-user-%d-%d", createdAt, i),
			AffCode:     fmt.Sprintf("%s-%d-r%03d", domain, createdAt, i),
			Password:    "hashed",
			Email:       fmt.Sprintf("user-%d-%d@%s", createdAt, i, domain),
			EmailDomain: domain,
			Status:      status,
			Role:        common.RoleCommonUser,
			CreatedAt:   createdAt,
		}
		require.NoError(t, DB.Create(&user).Error)
		users = append(users, user)
	}
	return users
}

func TestRegisterUserWithDomainRiskThresholdBlocksAndDisables(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	seedDomainRiskUsers(t, "farm.example", 9, 0, now-60)
	candidate := User{Username: "trigger", Password: "password123", Email: "trigger@farm.example", EmailDomain: "farm.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	result, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.10", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 10, Now: now,
	}, nil)

	require.ErrorIs(t, err, ErrRegistrationDomainBlocked)
	require.True(t, result.Triggered)
	require.Zero(t, candidate.Id)
	var enabledCount int64
	require.NoError(t, DB.Model(&User{}).Where("email_domain = ? AND status = ?", "farm.example", common.UserStatusEnabled).Count(&enabledCount).Error)
	require.Zero(t, enabledCount)
	var block RegistrationDomainBlock
	require.NoError(t, DB.Where("domain = ?", "farm.example").First(&block).Error)
	require.Equal(t, 10, block.ObservedCount)
	var affected int64
	require.NoError(t, DB.Model(&RegistrationDomainBlockUser{}).Where("block_id = ?", block.Id).Count(&affected).Error)
	require.EqualValues(t, 9, affected)
}

func TestConcurrentRegistrationDomainThresholdAndRelease(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	sqlDB, err := DB.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	now := time.Now().Unix()
	const attempts = 8
	start := make(chan struct{})
	results := make(chan error, attempts)
	var wg sync.WaitGroup
	for i := 0; i < attempts; i++ {
		wg.Add(1)
		go func(index int) {
			defer wg.Done()
			<-start
			candidate := User{
				Username: fmt.Sprintf("concurrent-%d", index),
				Password: "password123",
				Email:    fmt.Sprintf("user-%d@burst.example", index),
				Role:     common.RoleCommonUser,
				Status:   common.UserStatusEnabled,
			}
			_, registerErr := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.30", RegistrationDomainRiskPolicy{
				Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: now,
			}, nil)
			results <- registerErr
		}(i)
	}
	close(start)
	wg.Wait()
	close(results)

	successes := 0
	for registerErr := range results {
		if registerErr == nil {
			successes++
			continue
		}
		require.True(t, errors.Is(registerErr, ErrRegistrationDomainBlocked), registerErr)
	}
	require.Equal(t, 2, successes)
	var users []User
	require.NoError(t, DB.Where("email_domain = ?", "burst.example").Find(&users).Error)
	require.Len(t, users, 2)
	for _, user := range users {
		require.Equal(t, common.UserStatusDisabled, user.Status)
	}
	var block RegistrationDomainBlock
	require.NoError(t, DB.Where("domain = ?", "burst.example").First(&block).Error)
	var affected int64
	require.NoError(t, DB.Model(&RegistrationDomainBlockUser{}).Where("block_id = ?", block.Id).Count(&affected).Error)
	require.EqualValues(t, 2, affected)

	releaseAt := now + 1
	_, err = ReleaseRegistrationDomainBlock(block.Id, 99, false, releaseAt)
	require.NoError(t, err)
	afterRelease := User{Username: "after-release", Password: "password123", Email: "new@burst.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	result, err := RegisterUserWithDomainRisk(&afterRelease, 0, "203.0.113.31", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: releaseAt + 1,
	}, nil)
	require.NoError(t, err)
	require.False(t, result.Triggered)
	require.NotZero(t, afterRelease.Id)
}

func TestRegisterUserWithDomainRiskPersistsNormalizedDomainBelowThreshold(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	candidate := User{Username: "allowed", Password: "password123", Email: "Allowed@Example.COM", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	result, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.11", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 10, Now: now,
	}, nil)

	require.NoError(t, err)
	require.False(t, result.Triggered)
	require.NotZero(t, candidate.Id)
	var stored User
	require.NoError(t, DB.First(&stored, candidate.Id).Error)
	require.Equal(t, "example.com", stored.EmailDomain)
	require.Equal(t, "203.0.113.11", stored.RegistrationIP)
}

func TestRegisterUserWithDomainRiskNormalizesPrepopulatedEmailDomain(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	candidate := User{
		Username: "prepopulated-domain", Password: "password123", Email: "user@mixed.example",
		EmailDomain: " MIXED.Example ", Role: common.RoleCommonUser, Status: common.UserStatusEnabled,
	}

	_, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.18", RegistrationDomainRiskPolicy{Enabled: false}, nil)

	require.NoError(t, err)
	var stored User
	require.NoError(t, DB.First(&stored, candidate.Id).Error)
	require.Equal(t, "mixed.example", stored.EmailDomain)
}

func TestRegisterUserWithDomainRiskAllowsWhenPolicyDisabledEvenWithActiveBlock(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	block := RegistrationDomainBlock{Domain: "trusted.example", WindowHours: 24, Threshold: 10, ObservedCount: 10, BlockedAt: now}
	require.NoError(t, DB.Create(&block).Error)
	require.NoError(t, DB.Create(&RegistrationDomainState{Domain: block.Domain, ActiveBlockID: block.Id}).Error)
	candidate := User{Username: "trusted-but-blocked", Password: "password123", Email: "user@trusted.example", EmailDomain: "trusted.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	result, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.16", RegistrationDomainRiskPolicy{Enabled: false, Now: now}, nil)

	// A disabled policy (trusted domain or globally-off risk) must bypass the
	// active block and create the user, so customers can still register.
	require.NoError(t, err)
	require.Zero(t, result.BlockID)
	require.NotZero(t, candidate.Id)
}

func TestRegisterUserWithDomainRiskBackfillsLegacyEmailDomains(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	legacy := User{
		Username: "legacy-domain-user", AffCode: "legacy-domain-aff", Password: "hashed",
		Email: "Legacy@Backfill.Example", Status: common.UserStatusEnabled,
		Role: common.RoleCommonUser, CreatedAt: now - 60,
	}
	require.NoError(t, DB.Create(&legacy).Error)
	candidate := User{Username: "backfill-allowed", Password: "password123", Email: "new@backfill.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	_, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.14", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: now,
	}, nil)

	require.NoError(t, err)
	require.NoError(t, DB.First(&legacy, legacy.Id).Error)
	require.Equal(t, "backfill.example", legacy.EmailDomain)
}

func TestRegisterUserWithDomainRiskBackfillsNullLegacyEmailDomains(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	legacy := User{
		Username: "legacy-null-domain", AffCode: "legacy-null-domain-aff", Password: "hashed",
		Email: "legacy@null-backfill.example", Status: common.UserStatusEnabled,
		Role: common.RoleCommonUser, CreatedAt: now - 60,
	}
	require.NoError(t, DB.Create(&legacy).Error)
	require.NoError(t, DB.Exec("UPDATE users SET email_domain = NULL WHERE id = ?", legacy.Id).Error)
	candidate := User{Username: "null-backfill-allowed", Password: "password123", Email: "new@null-backfill.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	_, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.17", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: now,
	}, nil)

	require.NoError(t, err)
	var emailDomain *string
	require.NoError(t, DB.Model(&User{}).Select("email_domain").Where("id = ?", legacy.Id).Scan(&emailDomain).Error)
	require.NotNil(t, emailDomain)
	require.Equal(t, "null-backfill.example", *emailDomain)
}

func TestRegisterUserWithDomainRiskBoundsLegacyDomainBackfill(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	legacyUsers := make([]User, registrationEmailDomainBackfillBatchSize+1)
	for i := range legacyUsers {
		legacyUsers[i] = User{
			Username: fmt.Sprintf("bounded-legacy-%d", i),
			AffCode:  fmt.Sprintf("bounded-legacy-aff-%d", i),
			Password: "hashed", Email: fmt.Sprintf("user-%d@bounded.example", i),
			Status: common.UserStatusEnabled, Role: common.RoleCommonUser, CreatedAt: now - 60,
		}
	}
	require.NoError(t, DB.Create(&legacyUsers).Error)
	candidate := User{Username: "bounded-backfill-allowed", Password: "password123", Email: "new@bounded.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	_, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.15", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 1000, Now: now,
	}, nil)

	require.NoError(t, err)
	var backfilled int64
	require.NoError(t, DB.Model(&User{}).Where("email_domain = ?", "bounded.example").Count(&backfilled).Error)
	require.EqualValues(t, registrationEmailDomainBackfillBatchSize+1, backfilled)
	var remainingLegacy int64
	require.NoError(t, DB.Model(&User{}).Where("email_domain = '' AND LOWER(email) LIKE ?", "%@bounded.example").Count(&remainingLegacy).Error)
	require.EqualValues(t, 1, remainingLegacy)
}

func TestRegisterUserWithDomainRiskIgnoresFutureRegistrations(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	seedDomainRiskUsers(t, "clock.example", 1, 0, now-60)
	seedDomainRiskUsers(t, "clock.example", 8, 0, now+3600)
	candidate := User{Username: "clock-allowed", Password: "password123", Email: "allowed@clock.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}

	result, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.13", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 3, Now: now,
	}, nil)

	require.NoError(t, err)
	require.False(t, result.Triggered)
	require.NotZero(t, candidate.Id)
}

func TestDisableRegistrationDomainUsersRecordsOnlySuccessfulTransitions(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	users := seedDomainRiskUsers(t, "transition.example", 1, 1, now-60)
	block := RegistrationDomainBlock{Domain: "transition.example", WindowHours: 24, Threshold: 2, ObservedCount: 2, BlockedAt: now}
	require.NoError(t, DB.Create(&block).Error)

	var disabledIDs []int
	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		var err error
		disabledIDs, err = disableRegistrationDomainUsers(tx, block.Id, block.Domain, now)
		return err
	}))

	require.Equal(t, []int{users[0].Id}, disabledIDs)
	var affected []RegistrationDomainBlockUser
	require.NoError(t, DB.Where("block_id = ?", block.Id).Find(&affected).Error)
	require.Len(t, affected, 1)
	require.Equal(t, users[0].Id, affected[0].UserID)
}

func TestGetRegistrationDomainBlockDetailNormalizesNegativeOffset(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	users := seedDomainRiskUsers(t, "detail.example", 2, 0, now-60)
	block := RegistrationDomainBlock{Domain: "detail.example", WindowHours: 24, Threshold: 2, ObservedCount: 2, BlockedAt: now}
	require.NoError(t, DB.Create(&block).Error)
	for _, user := range users {
		require.NoError(t, DB.Create(&RegistrationDomainBlockUser{BlockID: block.Id, UserID: user.Id, DisabledAt: now}).Error)
	}

	detail, err := GetRegistrationDomainBlockDetail(block.Id, -2, 1)

	require.NoError(t, err)
	require.Equal(t, 1, detail.UserPage)
	require.Equal(t, 1, detail.UserPageSize)
	require.Len(t, detail.Users, 1)
	require.Equal(t, users[0].Id, detail.Users[0].UserID)

	detail, err = GetRegistrationDomainBlockDetail(block.Id, 0, 101)
	require.NoError(t, err)
	require.Equal(t, 100, detail.UserPageSize)
}

func TestReleaseRegistrationDomainBlockRestoresOnlyAutomatedDisables(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	now := time.Now().Unix()
	users := seedDomainRiskUsers(t, "restore.example", 2, 1, now-60)
	candidate := User{Username: "restore-trigger", Password: "password123", Email: "trigger@restore.example", EmailDomain: "restore.example", Role: common.RoleCommonUser, Status: common.UserStatusEnabled}
	result, err := RegisterUserWithDomainRisk(&candidate, 0, "203.0.113.12", RegistrationDomainRiskPolicy{
		Enabled: true, Window: 24 * time.Hour, Threshold: 4, Now: now,
	}, nil)
	require.ErrorIs(t, err, ErrRegistrationDomainBlocked)

	release, err := ReleaseRegistrationDomainBlock(result.BlockID, 99, true, now+10)
	require.NoError(t, err)
	require.Equal(t, int64(2), release.RestoredUsers)
	var restored []User
	require.NoError(t, DB.Order("id asc").Find(&restored).Error)
	require.Equal(t, common.UserStatusEnabled, restored[0].Status)
	require.Equal(t, common.UserStatusEnabled, restored[1].Status)
	require.Equal(t, common.UserStatusDisabled, restored[2].Status)
	require.Equal(t, users[2].Id, restored[2].Id)

	repeated, err := ReleaseRegistrationDomainBlock(result.BlockID, 99, true, now+20)
	require.NoError(t, err)
	require.Zero(t, repeated.RestoredUsers)
	var state RegistrationDomainState
	require.NoError(t, DB.Where("domain = ?", "restore.example").First(&state).Error)
	require.Zero(t, state.ActiveBlockID)
	require.Equal(t, now+10, state.CountingSince)
}

func TestReleasedRegistrationDomainBlockCannotMutateTrustedDomains(t *testing.T) {
	setupRegistrationDomainRiskTest(t)
	original := config.GlobalConfig.ExportAllConfigs()
	saved := make(map[string]string)
	for key, value := range original {
		if len(key) > len("registration_security.") && key[:len("registration_security.")] == "registration_security." {
			saved[key] = value
		}
	}
	t.Cleanup(func() { require.NoError(t, config.GlobalConfig.LoadFromDB(saved)) })
	require.NoError(t, config.GlobalConfig.LoadFromDB(map[string]string{
		"registration_security.domain_risk_window_hours": "24",
		"registration_security.domain_risk_threshold":    "10",
		"registration_security.trusted_email_domains":    "[]",
	}))
	require.NoError(t, DB.Create(&Option{Key: "registration_security.trusted_email_domains", Value: "[]"}).Error)
	now := time.Now().Unix()
	block := RegistrationDomainBlock{Domain: "historical.example", WindowHours: 24, Threshold: 10, ObservedCount: 10, BlockedAt: now - 60, ReleasedAt: now - 30, ReleasedBy: 7}
	require.NoError(t, DB.Create(&block).Error)

	result, err := ReleaseRegistrationDomainBlockWithTrustedDomain(block.Id, 99, true, now, block.Domain)

	require.NoError(t, err)
	require.Equal(t, now-30, result.Block.ReleasedAt)
	var option Option
	require.NoError(t, DB.First(&option, "key = ?", "registration_security.trusted_email_domains").Error)
	require.JSONEq(t, "[]", option.Value)
	require.False(t, system_setting.GetRegistrationSecuritySettings().IsTrustedDomain(block.Domain))
}
