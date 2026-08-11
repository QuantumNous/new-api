package model

import (
	"fmt"
	"os"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupInvitationOptionTest(t *testing.T) {
	t.Helper()
	require.NoError(t, DB.AutoMigrate(&Option{}))

	var originalOptions []Option
	require.NoError(t, DB.Find(&originalOptions).Error)
	originalSettings := common.GetInvitationCodeSettings()
	common.OptionMapRWMutex.RLock()
	var originalOptionMap map[string]string
	if common.OptionMap != nil {
		originalOptionMap = make(map[string]string, len(common.OptionMap))
		for key, value := range common.OptionMap {
			originalOptionMap[key] = value
		}
	}
	common.OptionMapRWMutex.RUnlock()

	require.NoError(t, DB.Where("1 = 1").Delete(&Option{}).Error)
	require.NoError(t, applyInvitationCodeSettings(common.DefaultInvitationCodeSettings()))

	t.Cleanup(func() {
		require.NoError(t, DB.Exec("DROP TRIGGER IF EXISTS fail_invitation_methods_update").Error)
		require.NoError(t, DB.Where("1 = 1").Delete(&Option{}).Error)
		if len(originalOptions) > 0 {
			require.NoError(t, DB.Create(&originalOptions).Error)
		}
		_, err := common.ApplyInvitationCodeSettings(originalSettings.Required, originalSettings.Methods)
		require.NoError(t, err)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})
}

func invitationOptionMapSnapshot() map[string]string {
	common.OptionMapRWMutex.RLock()
	defer common.OptionMapRWMutex.RUnlock()
	return map[string]string{
		InvitationCodeRequiredOptionKey: common.OptionMap[InvitationCodeRequiredOptionKey],
		InvitationCodeMethodsOptionKey:  common.OptionMap[InvitationCodeMethodsOptionKey],
	}
}

func invitationOptionsFromDatabase(t *testing.T) map[string]string {
	t.Helper()
	var options []Option
	require.NoError(t, DB.Where(map[string]any{"key": []string{
		InvitationCodeRequiredOptionKey,
		InvitationCodeMethodsOptionKey,
	}}).Find(&options).Error)
	values := make(map[string]string, len(options))
	for _, option := range options {
		values[option.Key] = option.Value
	}
	return values
}

func TestUpdateInvitationCodeSettingsPersistsAndAppliesPairAtomically(t *testing.T) {
	setupInvitationOptionTest(t)

	settings, err := UpdateInvitationCodeSettings(true, []string{
		common.InvitationRegistrationMethodPassword,
		common.InvitationRegistrationMethodLinuxDO,
		common.InvitationRegistrationMethodPassword,
	})
	require.NoError(t, err)
	assert.Equal(t, common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{"linuxdo", "password"},
	}, settings)
	assert.Equal(t, settings, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo","password"]`,
	}, invitationOptionMapSnapshot())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo","password"]`,
	}, invitationOptionsFromDatabase(t))
}

func TestInitOptionMapSeedsAuthoritativeInvitationRows(t *testing.T) {
	setupInvitationOptionTest(t)

	InitOptionMap()

	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "false",
		InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}, invitationOptionsFromDatabase(t))
	settings, err := GetInvitationCodeSettingsFromDatabase()
	require.NoError(t, err)
	assert.Equal(t, common.DefaultInvitationCodeSettings(), settings)
}

func TestInvitationSettingsTransactionFailsClosedWhenAuthoritativeRowsAreMissing(t *testing.T) {
	setupInvitationOptionTest(t)

	err := WithInvitationCodeSettingsTransaction(func(_ *gorm.DB, _ common.InvitationCodeSettings) error {
		return nil
	})
	require.ErrorIs(t, err, ErrInvitationCodeSettingsUnavailable)
}

func runExternalInvitationSettingsBoundaryTest(t *testing.T, databaseType common.DatabaseType, dsn string) {
	t.Helper()
	db := openInvitationConcurrencyExternalDB(t, databaseType, dsn)
	if db.Migrator().HasTable(&Option{}) {
		t.Skipf("refusing to run invitation settings boundary test because %s already has an options table", databaseType)
	}
	t.Cleanup(func() {
		if db.Migrator().HasTable(&Option{}) {
			require.NoError(t, db.Migrator().DropTable(&Option{}))
		}
	})
	useInvitationConcurrencyDB(t, db, databaseType)
	configureInvitationConcurrencyPool(t, db)
	require.NoError(t, db.AutoMigrate(&Option{}))

	originalSettings := common.GetInvitationCodeSettings()
	t.Cleanup(func() {
		require.NoError(t, applyInvitationCodeSettings(originalSettings))
	})
	_, err := UpdateInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)

	transactionEntered := make(chan struct{})
	releaseTransaction := make(chan struct{})
	transactionDone := make(chan error, 1)
	go func() {
		transactionDone <- WithInvitationCodeSettingsTransaction(func(_ *gorm.DB, settings common.InvitationCodeSettings) error {
			if settings.Required {
				return fmt.Errorf("unexpected pre-update settings: %+v", settings)
			}
			close(transactionEntered)
			<-releaseTransaction
			return nil
		})
	}()
	select {
	case <-transactionEntered:
	case transactionErr := <-transactionDone:
		t.Fatalf("%s registration transaction did not reach the admission boundary: %v", databaseType, transactionErr)
	}

	updateStarted := make(chan struct{})
	updateDone := make(chan error, 1)
	go func() {
		close(updateStarted)
		_, updateErr := UpdateInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodPassword})
		updateDone <- updateErr
	}()
	<-updateStarted
	select {
	case updateErr := <-updateDone:
		t.Fatalf("%s configuration update crossed an admitted registration boundary: %v", databaseType, updateErr)
	case <-time.After(100 * time.Millisecond):
	}

	close(releaseTransaction)
	require.NoError(t, <-transactionDone)
	require.NoError(t, <-updateDone)
	settings, err := GetInvitationCodeSettingsFromDatabase()
	require.NoError(t, err)
	assert.Equal(t, common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodPassword},
	}, settings)
}

func TestInvitationSettingsBoundaryMySQL(t *testing.T) {
	dsn := os.Getenv("TEST_MYSQL_DSN")
	if dsn == "" {
		t.Skip("set TEST_MYSQL_DSN to run the MySQL invitation settings boundary test")
	}
	runExternalInvitationSettingsBoundaryTest(t, common.DatabaseTypeMySQL, dsn)
}

func TestInvitationSettingsBoundaryPostgreSQL(t *testing.T) {
	dsn := os.Getenv("TEST_POSTGRES_DSN")
	if dsn == "" {
		t.Skip("set TEST_POSTGRES_DSN to run the PostgreSQL invitation settings boundary test")
	}
	runExternalInvitationSettingsBoundaryTest(t, common.DatabaseTypePostgreSQL, dsn)
}

func TestUpdateInvitationCodeSettingsRejectsRequiredWithoutMethodsWithoutMutation(t *testing.T) {
	setupInvitationOptionTest(t)
	beforeSettings := common.GetInvitationCodeSettings()
	beforeOptionMap := invitationOptionMapSnapshot()

	_, err := UpdateInvitationCodeSettings(true, nil)
	require.Error(t, err)
	assert.Equal(t, beforeSettings, common.GetInvitationCodeSettings())
	assert.Equal(t, beforeOptionMap, invitationOptionMapSnapshot())
	assert.Empty(t, invitationOptionsFromDatabase(t))
}

func TestUpdateInvitationCodeSettingsRollsBackDatabaseAndMemoryWhenSecondWriteFails(t *testing.T) {
	setupInvitationOptionTest(t)
	beforeSettings, err := UpdateInvitationCodeSettings(false, []string{common.InvitationRegistrationMethodLinuxDO})
	require.NoError(t, err)
	beforeOptionMap := invitationOptionMapSnapshot()
	beforeDatabase := invitationOptionsFromDatabase(t)

	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_invitation_methods_update
		BEFORE UPDATE ON options
		WHEN NEW.key = 'InvitationCodeMethods'
		BEGIN
			SELECT RAISE(ABORT, 'forced second write failure');
		END
	`).Error)

	_, err = UpdateInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodPassword})
	require.Error(t, err)
	assert.Equal(t, beforeSettings, common.GetInvitationCodeSettings())
	assert.Equal(t, beforeOptionMap, invitationOptionMapSnapshot())
	assert.Equal(t, beforeDatabase, invitationOptionsFromDatabase(t))
}

func TestInvitationOptionsLoadRepairsLegacyRequiredWithoutMethods(t *testing.T) {
	setupInvitationOptionTest(t)
	require.NoError(t, DB.Create(&[]Option{
		{Key: InvitationCodeRequiredOptionKey, Value: "true"},
		{Key: InvitationCodeMethodsOptionKey, Value: "[]"},
	}).Error)
	require.NoError(t, applyInvitationCodeSettings(common.InvitationCodeSettings{
		Required: false,
		Methods:  []string{common.InvitationRegistrationMethodGitHub},
	}))

	require.NoError(t, loadOptionsFromDatabase())
	expected := common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodLinuxDO},
	}
	assert.Equal(t, expected, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}, invitationOptionMapSnapshot())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}, invitationOptionsFromDatabase(t))
}

func TestInvitationOptionsLoadRepairsLegacyRequiredWithMissingMethodsRow(t *testing.T) {
	setupInvitationOptionTest(t)
	require.NoError(t, DB.Create(&Option{
		Key:   InvitationCodeRequiredOptionKey,
		Value: "true",
	}).Error)
	require.NoError(t, applyInvitationCodeSettings(common.InvitationCodeSettings{
		Required: false,
		Methods:  []string{common.InvitationRegistrationMethodGitHub},
	}))

	require.NoError(t, loadOptionsFromDatabase())
	expected := common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodLinuxDO},
	}
	assert.Equal(t, expected, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}, invitationOptionsFromDatabase(t))
}

func TestInvitationOptionsLoadKeepsSafeRuntimeWhenLegacyRepairWriteFails(t *testing.T) {
	setupInvitationOptionTest(t)
	require.NoError(t, DB.Create(&[]Option{
		{Key: InvitationCodeRequiredOptionKey, Value: "true"},
		{Key: InvitationCodeMethodsOptionKey, Value: "[]"},
	}).Error)
	require.NoError(t, applyInvitationCodeSettings(common.InvitationCodeSettings{
		Required: false,
		Methods:  []string{common.InvitationRegistrationMethodGitHub},
	}))
	require.NoError(t, DB.Exec(`
		CREATE TRIGGER fail_invitation_methods_update
		BEFORE UPDATE ON options
		WHEN NEW.key = 'InvitationCodeMethods'
		BEGIN
			SELECT RAISE(ABORT, 'forced repair write failure');
		END
	`).Error)

	err := loadOptionsFromDatabase()
	require.Error(t, err)
	expectedRuntime := common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodLinuxDO},
	}
	assert.Equal(t, expectedRuntime, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["linuxdo"]`,
	}, invitationOptionMapSnapshot())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `[]`,
	}, invitationOptionsFromDatabase(t), "failed repair must leave the historical database pair untouched")
}

func TestLegacyInvitationRepairDoesNotOverwriteNewerAtomicPair(t *testing.T) {
	setupInvitationOptionTest(t)
	require.NoError(t, DB.Create(&[]Option{
		{Key: InvitationCodeRequiredOptionKey, Value: "true"},
		{Key: InvitationCodeMethodsOptionKey, Value: "[]"},
	}).Error)

	staleOptions, err := AllOption()
	require.NoError(t, err)
	staleSettings, needsRepair, err := invitationCodeSettingsFromOptions(staleOptions)
	require.NoError(t, err)
	require.True(t, needsRepair)
	assert.Equal(t, common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodLinuxDO},
	}, staleSettings)

	newerSettings := common.InvitationCodeSettings{
		Required: false,
		Methods: []string{
			common.InvitationRegistrationMethodGitHub,
			common.InvitationRegistrationMethodPassword,
		},
	}
	require.NoError(t, persistInvitationCodeSettings(newerSettings))

	effectiveSettings, repaired, err := repairLegacyInvitationCodeSettings()
	require.NoError(t, err)
	assert.False(t, repaired)
	assert.Equal(t, newerSettings, effectiveSettings)
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "false",
		InvitationCodeMethodsOptionKey:  `["github","password"]`,
	}, invitationOptionsFromDatabase(t))
}

func TestInvitationOptionsLoadRejectsUnknownMethodsWithoutPollutingState(t *testing.T) {
	setupInvitationOptionTest(t)
	require.NoError(t, applyInvitationCodeSettings(common.InvitationCodeSettings{
		Required: false,
		Methods:  []string{common.InvitationRegistrationMethodGitHub},
	}))
	beforeSettings := common.GetInvitationCodeSettings()
	beforeOptionMap := invitationOptionMapSnapshot()
	require.NoError(t, DB.Create(&[]Option{
		{Key: InvitationCodeRequiredOptionKey, Value: "true"},
		{Key: InvitationCodeMethodsOptionKey, Value: `["unknown"]`},
	}).Error)

	err := loadOptionsFromDatabase()
	require.Error(t, err)
	assert.Equal(t, beforeSettings, common.GetInvitationCodeSettings())
	assert.Equal(t, beforeOptionMap, invitationOptionMapSnapshot())
}

func TestInvitationOptionsLoadRejectsCorruptedValuesWithoutPollutingState(t *testing.T) {
	testCases := []struct {
		name     string
		required string
		methods  string
	}{
		{name: "invalid required boolean", required: "definitely", methods: `["linuxdo"]`},
		{name: "malformed methods JSON", required: "true", methods: `{"linuxdo":true}`},
		{name: "null methods", required: "true", methods: `null`},
	}

	for _, testCase := range testCases {
		t.Run(testCase.name, func(t *testing.T) {
			setupInvitationOptionTest(t)
			require.NoError(t, applyInvitationCodeSettings(common.InvitationCodeSettings{
				Required: false,
				Methods:  []string{common.InvitationRegistrationMethodGitHub},
			}))
			beforeSettings := common.GetInvitationCodeSettings()
			beforeOptionMap := invitationOptionMapSnapshot()
			require.NoError(t, DB.Create(&[]Option{
				{Key: InvitationCodeRequiredOptionKey, Value: testCase.required},
				{Key: InvitationCodeMethodsOptionKey, Value: testCase.methods},
			}).Error)

			err := loadOptionsFromDatabase()
			require.Error(t, err)
			assert.Equal(t, beforeSettings, common.GetInvitationCodeSettings())
			assert.Equal(t, beforeOptionMap, invitationOptionMapSnapshot())
		})
	}
}

func TestInvitationInitOptionMapPreservesSettingsWhenDatabaseLoadFails(t *testing.T) {
	originalDB := DB
	originalSettings := common.GetInvitationCodeSettings()
	common.OptionMapRWMutex.RLock()
	originalOptionMap := make(map[string]string, len(common.OptionMap))
	for key, value := range common.OptionMap {
		originalOptionMap[key] = value
	}
	common.OptionMapRWMutex.RUnlock()
	t.Cleanup(func() {
		DB = originalDB
		_, err := common.ApplyInvitationCodeSettings(originalSettings.Required, originalSettings.Methods)
		require.NoError(t, err)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	failingDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := failingDB.DB()
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, sqlDB.Close())
	})
	DB = failingDB // The options table intentionally does not exist.
	expected, err := common.ApplyInvitationCodeSettings(true, []string{common.InvitationRegistrationMethodPassword})
	require.NoError(t, err)

	InitOptionMap()

	assert.Equal(t, expected, common.GetInvitationCodeSettings())
	assert.Equal(t, map[string]string{
		InvitationCodeRequiredOptionKey: "true",
		InvitationCodeMethodsOptionKey:  `["password"]`,
	}, invitationOptionMapSnapshot())
}

func TestUpdateOptionRejectsInvitationCodeKeys(t *testing.T) {
	setupInvitationOptionTest(t)

	for _, key := range []string{
		InvitationCodeRequiredOptionKey,
		InvitationCodeMethodsOptionKey,
		"invitationcoderequired",
		"INVITATIONCODEMETHODS",
		"  InvitationCodeRequired  ",
		"InvitationCodeMethods   ",
		"Invitation.Code.Required",
		"Invitation_Code_Methods",
		"Invitation-CodeRequired",
	} {
		t.Run(key, func(t *testing.T) {
			err := UpdateOption(key, "true")
			require.ErrorIs(t, err, ErrInvitationCodeOptionRequiresAtomicUpdate)
		})
	}
	assert.Empty(t, invitationOptionsFromDatabase(t))
}

func TestOptionKeyValidationRejectsNonASCIICollationLookalikes(t *testing.T) {
	setupInvitationOptionTest(t)

	require.ErrorIs(t, UpdateOption("InvítationCodeRequired", "true"), ErrInvalidOptionKey)
	require.ErrorIs(t, UpdateOptionsBulk(map[string]string{
		"InvitatiönCodeMethods": `["password"]`,
	}), ErrInvalidOptionKey)
	require.ErrorIs(t, updateOptionMap("InvitationCodeMethöds", `["password"]`), ErrInvalidOptionKey)
	assert.Empty(t, invitationOptionsFromDatabase(t))
}

func TestBulkAndInternalOptionUpdatesCannotBypassAtomicInvitationEndpoint(t *testing.T) {
	setupInvitationOptionTest(t)
	beforeSettings := common.GetInvitationCodeSettings()
	beforeOptionMap := invitationOptionMapSnapshot()

	err := UpdateOptionsBulk(map[string]string{
		"SystemName":               "must-not-write",
		" invitationcoderequired ": "true",
	})
	require.ErrorIs(t, err, ErrInvitationCodeOptionRequiresAtomicUpdate)
	require.ErrorIs(t, updateOptionMap("INVITATIONCODEMETHODS ", `["password"]`), ErrInvitationCodeOptionRequiresAtomicUpdate)

	assert.Equal(t, beforeSettings, common.GetInvitationCodeSettings())
	assert.Equal(t, beforeOptionMap, invitationOptionMapSnapshot())
	assert.Empty(t, invitationOptionsFromDatabase(t))
	var systemNameCount int64
	require.NoError(t, DB.Model(&Option{}).Where(map[string]any{"key": "SystemName"}).Count(&systemNameCount).Error)
	assert.Zero(t, systemNameCount, "bulk rejection must happen before any database write")
}

func TestInvitationConcurrentOnlineReloadAndAtomicUpdatesExposeOnlyCompletePairs(t *testing.T) {
	setupInvitationOptionTest(t)
	configA := common.InvitationCodeSettings{
		Required: true,
		Methods:  []string{common.InvitationRegistrationMethodPassword},
	}
	configB := common.InvitationCodeSettings{
		Required: false,
		Methods: []string{
			common.InvitationRegistrationMethodGitHub,
			common.InvitationRegistrationMethodLinuxDO,
		},
	}
	_, err := UpdateInvitationCodeSettings(configA.Required, configA.Methods)
	require.NoError(t, err)

	const operations = 40
	start := make(chan struct{})
	stopObserver := make(chan struct{})
	invalidSnapshot := make(chan string, 1)
	var observer sync.WaitGroup
	observer.Add(1)
	go func() {
		defer observer.Done()
		for {
			select {
			case <-stopObserver:
				return
			default:
			}
			settings := common.GetInvitationCodeSettings()
			isRuntimeA := settings.Required == configA.Required && slices.Equal(settings.Methods, configA.Methods)
			isRuntimeB := settings.Required == configB.Required && slices.Equal(settings.Methods, configB.Methods)
			if !isRuntimeA && !isRuntimeB {
				select {
				case invalidSnapshot <- fmt.Sprintf("invalid runtime settings: %#v", settings):
				default:
				}
				return
			}
			optionMap := invitationOptionMapSnapshot()
			isA := optionMap[InvitationCodeRequiredOptionKey] == "true" && optionMap[InvitationCodeMethodsOptionKey] == `["password"]`
			isB := optionMap[InvitationCodeRequiredOptionKey] == "false" && optionMap[InvitationCodeMethodsOptionKey] == `["github","linuxdo"]`
			if !isA && !isB {
				select {
				case invalidSnapshot <- fmt.Sprintf("invalid option map: %#v", optionMap):
				default:
				}
				return
			}
		}
	}()

	errorsCh := make(chan error, operations)
	var workers sync.WaitGroup
	workers.Add(operations)
	for index := 0; index < operations; index++ {
		go func(index int) {
			defer workers.Done()
			<-start
			if index%4 == 0 {
				InitOptionMap()
				errorsCh <- nil
				return
			}
			if index%2 == 0 {
				errorsCh <- loadOptionsFromDatabase()
				return
			}
			settings := configA
			if index%4 == 1 {
				settings = configB
			}
			_, updateErr := UpdateInvitationCodeSettings(settings.Required, settings.Methods)
			errorsCh <- updateErr
		}(index)
	}
	close(start)
	workers.Wait()
	close(stopObserver)
	observer.Wait()
	close(errorsCh)
	for operationErr := range errorsCh {
		require.NoError(t, operationErr)
	}
	select {
	case snapshotErr := <-invalidSnapshot:
		t.Fatal(snapshotErr)
	default:
	}

	finalSettings := common.GetInvitationCodeSettings()
	finalIsA := finalSettings.Required == configA.Required && slices.Equal(finalSettings.Methods, configA.Methods)
	finalIsB := finalSettings.Required == configB.Required && slices.Equal(finalSettings.Methods, configB.Methods)
	assert.True(t, finalIsA || finalIsB)
	finalDatabase := invitationOptionsFromDatabase(t)
	if finalIsA {
		assert.Equal(t, map[string]string{
			InvitationCodeRequiredOptionKey: "true",
			InvitationCodeMethodsOptionKey:  `["password"]`,
		}, finalDatabase)
	} else {
		assert.Equal(t, map[string]string{
			InvitationCodeRequiredOptionKey: "false",
			InvitationCodeMethodsOptionKey:  `["github","linuxdo"]`,
		}, finalDatabase)
	}
}
