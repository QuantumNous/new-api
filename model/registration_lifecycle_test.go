package model

import (
	"errors"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationLifecycleTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalLogDB := LOG_DB
	originalRedis := common.RedisEnabled
	originalQuotaForNewUser := common.QuotaForNewUser
	originalQuotaRemindThreshold := common.QuotaRemindThreshold

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/registration-lifecycle.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	DB = db
	LOG_DB = db
	common.RedisEnabled = false
	common.QuotaForNewUser = 3200
	common.QuotaRemindThreshold = 1000

	require.NoError(t, db.AutoMigrate(
		&User{},
		&Token{},
		&Option{},
		&Log{},
		&NewUserBonusClaim{},
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
		common.QuotaForNewUser = originalQuotaForNewUser
		common.QuotaRemindThreshold = originalQuotaRemindThreshold
	})
}

func newRegistrationLifecycleUser(name string) User {
	return User{
		Username: fmt.Sprintf("reg-life-%s", name),
		Password: "password123",
		Email:    fmt.Sprintf("%s@example.com", name),
		Role:     common.RoleCommonUser,
		Status:   common.UserStatusEnabled,
	}
}

func registerLifecycleUser(t *testing.T, user *User, afterCreate func(*gorm.DB) error) {
	t.Helper()
	_, err := RegisterUserWithDomainRisk(user, 0, "203.0.113.44", RegistrationDomainRiskPolicy{
		Enabled:   true,
		Window:    24 * time.Hour,
		Threshold: 10,
		Now:       1_800_000_000,
	}, afterCreate)
	require.NoError(t, err)
	require.NotZero(t, user.Id)
}

func registrationLifecycleEventsForUser(t *testing.T, userID int) []RecallLifecycleEvent {
	t.Helper()
	var events []RecallLifecycleEvent
	require.NoError(t, DB.Where("user_id = ?", userID).Order("event_type ASC").Find(&events).Error)
	return events
}

func requireRegistrationLifecycleEvents(t *testing.T, user User) map[string]RecallLifecycleEvent {
	t.Helper()

	events := registrationLifecycleEventsForUser(t, user.Id)
	require.Len(t, events, 2)
	byType := make(map[string]RecallLifecycleEvent, len(events))
	for _, event := range events {
		byType[event.EventType] = event
		require.Equal(t, QuotaLifecycleScopeUser, event.ScopeType)
		require.Equal(t, strconv.Itoa(user.Id), event.ScopeId)
		require.Equal(t, user.Id, event.UserId)
		require.Equal(t, user.CreatedAt, event.OccurredAt)
		require.Equal(t, RecallLifecycleEventPending, event.Disposition)
		require.Equal(t, 1, event.SchemaVersion)
		require.NotContains(t, strings.ToLower(event.EventData), "password")
		require.NotContains(t, strings.ToLower(event.EventData), "verification")
		require.NotContains(t, strings.ToLower(event.EventData), "token")
		if user.Email != "" {
			require.NotContains(t, event.EventData, user.Email)
			require.NotContains(t, event.BusinessKey, user.Email)
		}
	}

	registered, ok := byType[RecallLifecycleTriggerUserRegistered]
	require.True(t, ok)
	registeredOccurrence, err := NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerUserRegistered, user.Id)
	require.NoError(t, err)
	require.Equal(t, registeredOccurrence.Hash, registered.OccurrenceKeyHash)
	require.Equal(t, registeredOccurrence.Canonical, registered.BusinessKey)
	require.Equal(t, user.CreatedAt, registered.AvailableAt)
	require.JSONEq(t, fmt.Sprintf(`{"user_id":%d}`, user.Id), registered.EventData)

	unused, ok := byType[RecallLifecycleTriggerRegistrationUnused]
	require.True(t, ok)
	unusedOccurrence, err := NewRecallLifecycleUserOccurrence(RecallLifecycleTriggerRegistrationUnused, user.Id)
	require.NoError(t, err)
	require.Equal(t, unusedOccurrence.Hash, unused.OccurrenceKeyHash)
	require.Equal(t, unusedOccurrence.Canonical, unused.BusinessKey)
	require.EqualValues(t, user.CreatedAt+604800, unused.AvailableAt)
	require.JSONEq(t, fmt.Sprintf(`{"user_id":%d}`, user.Id), unused.EventData)

	return byType
}

func TestRegistrationLifecyclePasswordRegistrationCreatesEventsAndWalletStateInSameTransaction(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("password")

	registerLifecycleUser(t, &user, nil)

	requireRegistrationLifecycleEvents(t, user)
	var state QuotaLifecycleState
	require.NoError(t, DB.First(&state, "scope_type = ? AND scope_id = ?", QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).Error)
	require.Equal(t, user.Id, state.UserId)
	require.Equal(t, "registration:"+strconv.Itoa(user.Id), state.Cycle)
	require.EqualValues(t, user.Quota, state.Balance)
	require.EqualValues(t, common.QuotaRemindThreshold, state.Threshold)
	require.Equal(t, "registration:"+strconv.Itoa(user.Id), state.Source)
	require.EqualValues(t, 1, state.StateVersion)
	require.JSONEq(t, fmt.Sprintf(`{"user_id":%d,"cycle_key":"registration:%d"}`, user.Id, user.Id), state.SourceData)
}

func TestRegistrationLifecycleOAuthSharedTransactionSeamCreatesLifecycleRows(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("oauth")
	user.Password = ""
	user.GitHubId = "github-oauth-registration-lifecycle"
	var callbackSawRows bool

	registerLifecycleUser(t, &user, func(tx *gorm.DB) error {
		var eventCount int64
		if err := tx.Model(&RecallLifecycleEvent{}).Where("user_id = ?", user.Id).Count(&eventCount).Error; err != nil {
			return err
		}
		var stateCount int64
		if err := tx.Model(&QuotaLifecycleState{}).Where("user_id = ?", user.Id).Count(&stateCount).Error; err != nil {
			return err
		}
		callbackSawRows = eventCount == 2 && stateCount == 1
		return nil
	})

	require.True(t, callbackSawRows)
	requireRegistrationLifecycleEvents(t, user)
}

func TestRegistrationLifecycleMissingEmailStillCreatesEvents(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("missing-email")
	user.Email = ""

	registerLifecycleUser(t, &user, nil)

	requireRegistrationLifecycleEvents(t, user)
}

func TestRegistrationLifecycleUnusedDueTimeIgnoresTokenAndRequestActivity(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("unused-definition")
	user.RequestCount = 9

	registerLifecycleUser(t, &user, nil)
	require.NoError(t, DB.Create(&Token{
		UserId:       user.Id,
		Key:          "secret-api-key",
		Status:       common.TokenStatusEnabled,
		AccessedTime: user.CreatedAt + 99,
		ExpiredTime:  -1,
	}).Error)

	events := requireRegistrationLifecycleEvents(t, user)
	require.EqualValues(t, user.CreatedAt+604800, events[RecallLifecycleTriggerRegistrationUnused].AvailableAt)
}

func TestRegistrationLifecycleUsesValidUserThresholdAndFallsBackToGlobal(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	common.QuotaRemindThreshold = 222
	valid := newRegistrationLifecycleUser("valid-threshold")
	valid.SetSetting(dto.UserSetting{QuotaWarningThreshold: 1234})
	invalid := newRegistrationLifecycleUser("invalid-threshold")
	invalid.SetSetting(dto.UserSetting{QuotaWarningThreshold: -1})

	registerLifecycleUser(t, &valid, nil)
	registerLifecycleUser(t, &invalid, nil)

	var states []QuotaLifecycleState
	require.NoError(t, DB.Order("user_id ASC").Find(&states).Error)
	require.Len(t, states, 2)
	sort.Slice(states, func(i, j int) bool { return states[i].UserId < states[j].UserId })
	require.EqualValues(t, 1234, states[0].Threshold)
	require.EqualValues(t, 222, states[1].Threshold)
}

func TestRegistrationLifecycleDuplicateHelperInvocationIsNoop(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("duplicate")

	registerLifecycleUser(t, &user, func(tx *gorm.DB) error {
		require.NoError(t, CreateRegistrationLifecycleEventsTx(tx, &user))
		require.NoError(t, CreateRegistrationLifecycleEventsTx(tx, &user))
		return nil
	})

	requireRegistrationLifecycleEvents(t, user)
	var eventCount int64
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).Where("user_id = ?", user.Id).Count(&eventCount).Error)
	require.EqualValues(t, 2, eventCount)
	var stateCount int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Where("user_id = ?", user.Id).Count(&stateCount).Error)
	require.EqualValues(t, 1, stateCount)
}

func TestRegistrationLifecycleDoesNotOverwriteExistingLaterCycle(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("later-cycle")

	registerLifecycleUser(t, &user, nil)
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).
		Where("scope_type = ? AND scope_id = ?", QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).
		Updates(map[string]any{
			"cycle":   "manual:later",
			"balance": int64(99),
			"source":  "quota_scan",
		}).Error)

	require.NoError(t, DB.Transaction(func(tx *gorm.DB) error {
		return CreateRegistrationLifecycleEventsTx(tx, &user)
	}))

	var state QuotaLifecycleState
	require.NoError(t, DB.First(&state, "scope_type = ? AND scope_id = ?", QuotaLifecycleScopeWallet, strconv.Itoa(user.Id)).Error)
	require.Equal(t, "manual:later", state.Cycle)
	require.EqualValues(t, 99, state.Balance)
	require.Equal(t, "quota_scan", state.Source)
}

func TestRegistrationLifecycleRollbackIsAtomicWithUserCreation(t *testing.T) {
	setupRegistrationLifecycleTestDB(t)
	user := newRegistrationLifecycleUser("rollback")
	injected := errors.New("rollback after lifecycle rows")

	_, err := RegisterUserWithDomainRisk(&user, 0, "203.0.113.44", RegistrationDomainRiskPolicy{
		Enabled:   true,
		Window:    24 * time.Hour,
		Threshold: 10,
		Now:       1_800_000_000,
	}, func(tx *gorm.DB) error {
		var eventCount int64
		require.NoError(t, tx.Model(&RecallLifecycleEvent{}).Where("user_id = ?", user.Id).Count(&eventCount).Error)
		require.EqualValues(t, 2, eventCount)
		return injected
	})

	require.ErrorIs(t, err, injected)
	var userCount int64
	require.NoError(t, DB.Model(&User{}).Where("username = ?", user.Username).Count(&userCount).Error)
	require.Zero(t, userCount)
	var eventCount int64
	require.NoError(t, DB.Model(&RecallLifecycleEvent{}).Count(&eventCount).Error)
	require.Zero(t, eventCount)
	var stateCount int64
	require.NoError(t, DB.Model(&QuotaLifecycleState{}).Count(&stateCount).Error)
	require.Zero(t, stateCount)
}
