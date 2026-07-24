package service

import (
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupRegistrationTestDB(t *testing.T) *gorm.DB {
	t.Helper()

	oldDB, oldLogDB := model.DB, model.LOG_DB
	oldRedisEnabled := common.RedisEnabled
	oldQuotaForNewUser := common.QuotaForNewUser
	oldDefaultUseAutoGroup := setting.DefaultUseAutoGroup
	oldInvitationRequired := common.IsInvitationCodeRequired()
	oldInvitationMethods := common.GetInvitationCodeMethods()
	oldMainDatabaseType, oldLogDatabaseType := common.MainDatabaseType(), common.LogDatabaseType()

	databasePath := filepath.Join(t.TempDir(), fmt.Sprintf("registration_%d.db", time.Now().UnixNano()))
	dsn := fmt.Sprintf("file:%s?_pragma=busy_timeout(30000)&_txlock=immediate", filepath.ToSlash(databasePath))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}, &model.Token{}, &model.InvitationCode{}, &model.Option{}))
	model.DB = db
	model.LOG_DB = db
	common.SetDatabaseTypes(common.DatabaseTypeSQLite, common.DatabaseTypeSQLite)
	common.RedisEnabled = false
	common.QuotaForNewUser = 0
	setting.DefaultUseAutoGroup = false
	_, err = model.UpdateInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)

	t.Cleanup(func() {
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
		model.DB, model.LOG_DB = oldDB, oldLogDB
		common.RedisEnabled = oldRedisEnabled
		common.QuotaForNewUser = oldQuotaForNewUser
		setting.DefaultUseAutoGroup = oldDefaultUseAutoGroup
		common.SetDatabaseTypes(oldMainDatabaseType, oldLogDatabaseType)
		common.SetInvitationCodeRequired(oldInvitationRequired)
		require.NoError(t, common.SetInvitationCodeMethods(oldInvitationMethods))
	})
	return db
}

func newRegistrationTestUser(username string) *model.User {
	return &model.User{
		Username:    username,
		Password:    "password1",
		DisplayName: username,
		Role:        common.RoleCommonUser,
		Status:      common.UserStatusEnabled,
	}
}

func setRegistrationInvitationSettings(t *testing.T, required bool, methods []string) {
	t.Helper()
	_, err := model.UpdateInvitationCodeSettings(required, methods)
	require.NoError(t, err)
}

func TestRegisterNewUserConsumesInvitationAndCreatesDefaultTokenAtomically(t *testing.T) {
	db := setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})
	codes, err := model.CreateInvitationCodes("registration", 1, 1, 0)
	require.NoError(t, err)

	user := newRegistrationTestUser("invited-user")
	err = RegisterNewUser(NewUserRegistration{
		User:                 user,
		Method:               " PASSWORD ",
		InvitationCode:       codes[0],
		GenerateDefaultToken: true,
	})
	require.NoError(t, err)
	assert.NotZero(t, user.Id)

	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Where("user_id = ?", user.Id).Count(&tokenCount).Error)
	assert.Equal(t, int64(1), tokenCount)

	var invitation model.InvitationCode
	require.NoError(t, db.Where("code_hash = ?", model.HashInvitationCode(codes[0])).First(&invitation).Error)
	assert.Equal(t, common.InvitationCodeStatusUsed, invitation.Status)
	assert.Equal(t, user.Id, invitation.UsedUserId)
}

func TestRegisterNewUserRejectsInvitationWithoutLeavingUser(t *testing.T) {
	db := setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})

	user := newRegistrationTestUser("missing-code")
	err := RegisterNewUser(NewUserRegistration{
		User:   user,
		Method: common.InvitationRegistrationMethodPassword,
	})
	require.ErrorIs(t, err, ErrInvitationCodeRejected)

	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", user.Username).Count(&userCount).Error)
	assert.Zero(t, userCount)
	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}

func TestRegisterNewUserDoesNotExposeInvitationCodeState(t *testing.T) {
	db := setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})

	usedCodes, err := model.CreateInvitationCodes("used", 1, 1, 0)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.InvitationCode{}).
		Where("code_hash = ?", model.HashInvitationCode(usedCodes[0])).
		Update("status", common.InvitationCodeStatusUsed).Error)
	disabledCodes, err := model.CreateInvitationCodes("disabled", 1, 1, 0)
	require.NoError(t, err)
	require.NoError(t, db.Model(&model.InvitationCode{}).
		Where("code_hash = ?", model.HashInvitationCode(disabledCodes[0])).
		Update("status", common.InvitationCodeStatusDisabled).Error)
	expiredCodes, err := model.CreateInvitationCodes("expired", 1, 1, common.GetTimestamp()-1)
	require.NoError(t, err)

	testCases := []struct {
		name string
		code string
	}{
		{name: "missing", code: ""},
		{name: "unknown", code: "INV-NOT-REAL"},
		{name: "used", code: usedCodes[0]},
		{name: "disabled", code: disabledCodes[0]},
		{name: "expired", code: expiredCodes[0]},
	}
	for index, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			err := RegisterNewUser(NewUserRegistration{
				User:           newRegistrationTestUser(fmt.Sprintf("rejected-%d", index)),
				Method:         common.InvitationRegistrationMethodPassword,
				InvitationCode: testCase.code,
			})
			require.ErrorIs(t, err, ErrInvitationCodeRejected)
			assert.Equal(t, ErrInvitationCodeRejected.Error(), err.Error())
		})
	}
}

func TestRegisterNewUserRollsBackInvitationWhenRelatedRecordFails(t *testing.T) {
	db := setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodLinuxDO})
	codes, err := model.CreateInvitationCodes("oauth", 1, 1, 0)
	require.NoError(t, err)

	relatedErr := errors.New("binding insert failed")
	user := newRegistrationTestUser("oauth-user")
	err = RegisterNewUser(NewUserRegistration{
		User:           user,
		Method:         common.InvitationRegistrationMethodLinuxDO,
		InvitationCode: codes[0],
		CreateRelated: func(_ *gorm.DB, _ *model.User) error {
			return relatedErr
		},
	})
	require.ErrorIs(t, err, relatedErr)

	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", user.Username).Count(&userCount).Error)
	assert.Zero(t, userCount)
	var invitation model.InvitationCode
	require.NoError(t, db.Where("code_hash = ?", model.HashInvitationCode(codes[0])).First(&invitation).Error)
	assert.Equal(t, common.InvitationCodeStatusEnabled, invitation.Status)
	assert.Zero(t, invitation.UsedUserId)
}

func TestRegisterNewUserKeepsExistingBehaviorWhenGateIsDisabled(t *testing.T) {
	setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, false, []string{common.InvitationRegistrationMethodPassword})

	user := newRegistrationTestUser("legacy-registration")
	require.NoError(t, RegisterNewUser(NewUserRegistration{
		User:   user,
		Method: common.InvitationRegistrationMethodPassword,
	}))
	assert.NotZero(t, user.Id)
}

func TestRegisterNewUserOnlyRequiresInvitationForConfiguredMethods(t *testing.T) {
	setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodLinuxDO})

	user := newRegistrationTestUser("github-without-invitation")
	require.NoError(t, RegisterNewUser(NewUserRegistration{
		User:   user,
		Method: common.InvitationRegistrationMethodGitHub,
	}))
	assert.NotZero(t, user.Id)
}

func TestRegisterNewUserRejectsDefaultTokenForNonPasswordMethod(t *testing.T) {
	db := setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, false, []string{common.InvitationRegistrationMethodLinuxDO})

	user := newRegistrationTestUser("oauth-default-token")
	err := RegisterNewUser(NewUserRegistration{
		User:                 user,
		Method:               common.InvitationRegistrationMethodLinuxDO,
		GenerateDefaultToken: true,
	})
	require.ErrorIs(t, err, ErrDefaultTokenMethod)

	var userCount int64
	require.NoError(t, db.Model(&model.User{}).Where("username = ?", user.Username).Count(&userCount).Error)
	assert.Zero(t, userCount)
	var tokenCount int64
	require.NoError(t, db.Model(&model.Token{}).Count(&tokenCount).Error)
	assert.Zero(t, tokenCount)
}

func TestRegisterNewUserUsesDatabaseSettingsWhenMemoryCacheIsStale(t *testing.T) {
	t.Run("database requires code while memory says disabled", func(t *testing.T) {
		db := setupRegistrationTestDB(t)
		setRegistrationInvitationSettings(t, true, []string{common.InvitationRegistrationMethodPassword})
		_, err := common.ApplyInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
		require.NoError(t, err)

		user := newRegistrationTestUser("database-required")
		err = RegisterNewUser(NewUserRegistration{
			User:   user,
			Method: common.InvitationRegistrationMethodPassword,
		})
		require.ErrorIs(t, err, ErrInvitationCodeRejected)
		var count int64
		require.NoError(t, db.Model(&model.User{}).Where("username = ?", user.Username).Count(&count).Error)
		assert.Zero(t, count)
	})

	t.Run("database disables code while memory says required", func(t *testing.T) {
		setupRegistrationTestDB(t)
		setRegistrationInvitationSettings(t, false, []string{common.InvitationRegistrationMethodLinuxDO})
		_, err := common.ApplyInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodPassword})
		require.NoError(t, err)

		user := newRegistrationTestUser("database-disabled")
		require.NoError(t, RegisterNewUser(NewUserRegistration{
			User:   user,
			Method: common.InvitationRegistrationMethodPassword,
		}))
		assert.NotZero(t, user.Id)
	})
}

func TestRegisterNewUserFailsClosedWhenDatabaseSettingsAreUnavailable(t *testing.T) {
	testCases := []struct {
		name   string
		mutate func(t *testing.T, db *gorm.DB)
	}{
		{
			name: "missing methods row",
			mutate: func(t *testing.T, db *gorm.DB) {
				require.NoError(t, db.Delete(&model.Option{}, "key = ?", model.InvitationCodeMethodsOptionKey).Error)
			},
		},
		{
			name: "invalid required value",
			mutate: func(t *testing.T, db *gorm.DB) {
				require.NoError(t, db.Model(&model.Option{}).
					Where("key = ?", model.InvitationCodeRequiredOptionKey).
					Update("value", "not-a-boolean").Error)
			},
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			db := setupRegistrationTestDB(t)
			testCase.mutate(t, db)
			_, err := common.ApplyInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
			require.NoError(t, err)

			user := newRegistrationTestUser("settings-unavailable")
			err = RegisterNewUser(NewUserRegistration{
				User:   user,
				Method: common.InvitationRegistrationMethodPassword,
			})
			require.ErrorIs(t, err, ErrRegistrationTemporarilyUnavailable)
			var count int64
			require.NoError(t, db.Model(&model.User{}).Where("username = ?", user.Username).Count(&count).Error)
			assert.Zero(t, count)
		})
	}
}

func TestInvitationSettingsUpdateWaitsForRegistrationAdmittedUnderPreviousSnapshot(t *testing.T) {
	setupRegistrationTestDB(t)
	setRegistrationInvitationSettings(t, false, []string{common.InvitationRegistrationMethodLinuxDO})

	registrationEntered := make(chan struct{})
	releaseRegistration := make(chan struct{})
	registrationDone := make(chan error, 1)
	go func() {
		registrationDone <- RegisterNewUser(NewUserRegistration{
			User:   newRegistrationTestUser("pre-update-registration"),
			Method: common.InvitationRegistrationMethodPassword,
			CreateRelated: func(_ *gorm.DB, _ *model.User) error {
				close(registrationEntered)
				<-releaseRegistration
				return nil
			},
		})
	}()
	<-registrationEntered

	updateStarted := make(chan struct{})
	updateDone := make(chan error, 1)
	go func() {
		close(updateStarted)
		_, err := model.UpdateInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodPassword})
		updateDone <- err
	}()
	<-updateStarted
	select {
	case err := <-updateDone:
		t.Fatalf("configuration update completed before the admitted registration committed: %v", err)
	case <-time.After(50 * time.Millisecond):
	}

	close(releaseRegistration)
	require.NoError(t, <-registrationDone)
	require.NoError(t, <-updateDone)

	err := RegisterNewUser(NewUserRegistration{
		User:   newRegistrationTestUser("post-update-registration"),
		Method: common.InvitationRegistrationMethodPassword,
	})
	require.ErrorIs(t, err, ErrInvitationCodeRejected)
}
