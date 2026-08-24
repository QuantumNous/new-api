package model

import (
	"errors"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/glebarez/sqlite"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupCodexFingerprintSeedTestDB(t *testing.T) {
	t.Helper()

	originalDB := DB
	originalUsingSQLite := common.UsingSQLite
	originalUsingMySQL := common.UsingMySQL
	originalUsingPostgreSQL := common.UsingPostgreSQL

	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/codex-fingerprint-seed.db?_pragma=busy_timeout(5000)"), &gorm.Config{})
	require.NoError(t, err)
	sqlDB, err := db.DB()
	require.NoError(t, err)
	sqlDB.SetMaxOpenConns(8)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}))

	DB = db
	common.UsingSQLite = true
	common.UsingMySQL = false
	common.UsingPostgreSQL = false

	t.Cleanup(func() {
		DB = originalDB
		common.UsingSQLite = originalUsingSQLite
		common.UsingMySQL = originalUsingMySQL
		common.UsingPostgreSQL = originalUsingPostgreSQL
		require.NoError(t, sqlDB.Close())
	})
}

func insertCodexFingerprintSeedChannel(t *testing.T, channelType int, status int, seed string) Channel {
	t.Helper()

	channel := Channel{
		Type:                 channelType,
		Key:                  `{"access_token":"at","account_id":"acct"}`,
		Name:                 "seed-test",
		Status:               status,
		Models:               "gpt-5-codex",
		Group:                "default",
		CodexFingerprintSeed: seed,
	}
	require.NoError(t, DB.Create(&channel).Error)
	return channel
}

func requireUUIDString(t *testing.T, value string) {
	t.Helper()

	require.NotEmpty(t, value)
	_, err := uuid.Parse(value)
	require.NoError(t, err)
}

func TestEnsureCodexFingerprintSeedCreatePreserveAndRepair(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusEnabled, "")

	first, err := EnsureCodexFingerprintSeed(channel.Id)
	require.NoError(t, err)
	requireUUIDString(t, first)

	second, err := EnsureCodexFingerprintSeed(channel.Id)
	require.NoError(t, err)
	require.Equal(t, first, second)

	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("codex_fingerprint_seed", "not-a-uuid").Error)
	repaired, err := EnsureCodexFingerprintSeed(channel.Id)
	require.NoError(t, err)
	requireUUIDString(t, repaired)
	require.NotEqual(t, "not-a-uuid", repaired)

	repairedAgain, err := EnsureCodexFingerprintSeed(channel.Id)
	require.NoError(t, err)
	require.Equal(t, repaired, repairedAgain)
}

func TestEnsureCodexFingerprintSeedConcurrentCompareAndSet(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusEnabled, "")

	const callers = 16
	results := make(chan string, callers)
	errs := make(chan error, callers)
	var wg sync.WaitGroup
	wg.Add(callers)
	for i := 0; i < callers; i++ {
		go func() {
			defer wg.Done()
			seed, err := EnsureCodexFingerprintSeed(channel.Id)
			if err != nil {
				errs <- err
				return
			}
			results <- seed
		}()
	}
	wg.Wait()
	close(results)
	close(errs)

	for err := range errs {
		require.NoError(t, err)
	}

	var observed string
	for seed := range results {
		requireUUIDString(t, seed)
		if observed == "" {
			observed = seed
			continue
		}
		require.Equal(t, observed, seed)
	}
	require.NotEmpty(t, observed)

	var stored Channel
	require.NoError(t, DB.First(&stored, "id = ?", channel.Id).Error)
	require.Equal(t, observed, stored.CodexFingerprintSeed)
}

func TestBackfillCodexFingerprintSeedsUsesBoundedKeysetQueries(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channels := make([]Channel, 0, codexFingerprintSeedBackfillBatchSize+7)
	for i := 0; i < codexFingerprintSeedBackfillBatchSize+7; i++ {
		seed := "018f89db-7792-7b5e-a360-7fd9279fd725"
		if i >= codexFingerprintSeedBackfillBatchSize+5 {
			seed = "invalid-seed"
		}
		channels = append(channels, Channel{
			Type:                 constant.ChannelTypeCodex,
			Key:                  `{"access_token":"at","account_id":"acct"}`,
			Name:                 "seed-backfill",
			Status:               common.ChannelStatusEnabled,
			Models:               "gpt-5-codex",
			Group:                "default",
			CodexFingerprintSeed: seed,
		})
	}
	require.NoError(t, DB.CreateInBatches(&channels, 100).Error)

	queryCount := 0
	const callbackName = "test:count_codex_seed_backfill_queries"
	require.NoError(t, DB.Callback().Query().Before("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "channels" {
			queryCount++
		}
	}))

	require.NoError(t, BackfillCodexFingerprintSeeds())
	require.LessOrEqual(t, queryCount, 3)
	require.NoError(t, DB.Callback().Query().Remove(callbackName))

	var repaired []Channel
	require.NoError(t, DB.Where("id IN ?", []int{channels[len(channels)-2].Id, channels[len(channels)-1].Id}).Find(&repaired).Error)
	require.Len(t, repaired, 2)
	for _, channel := range repaired {
		requireUUIDString(t, channel.CodexFingerprintSeed)
		require.NotEqual(t, "invalid-seed", channel.CodexFingerprintSeed)
	}
}

func TestNonCodexAndOffChannelsDoNotMintSeed(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	nonCodex := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeOpenAI, common.ChannelStatusEnabled, "")
	offCodex := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusManuallyDisabled, "")

	nonCodexSeed, err := EnsureCodexFingerprintSeed(nonCodex.Id)
	require.NoError(t, err)
	require.Empty(t, nonCodexSeed)

	offCodexSeed, err := EnsureCodexFingerprintSeed(offCodex.Id)
	require.NoError(t, err)
	require.Empty(t, offCodexSeed)

	var stored []Channel
	require.NoError(t, DB.Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	require.Empty(t, stored[0].CodexFingerprintSeed)
	require.Empty(t, stored[1].CodexFingerprintSeed)
}

func TestCodexFingerprintSeedValidationRequiresCanonicalNonNilUUID(t *testing.T) {
	for _, seed := range []string{
		uuid.Nil.String(),
		strings.ToUpper("018f89db-7792-7b5e-a360-7fd9279fd725"),
		"018f89db77927b5ea3607fd9279fd725",
	} {
		require.False(t, validCodexFingerprintSeed(seed), seed)
	}
	require.True(t, validCodexFingerprintSeed("018f89db-7792-7b5e-a360-7fd9279fd725"))
}

func TestChannelUpdateClearsSeedWhenChangingToNonCodex(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusEnabled, "018f89db-7792-7b5e-a360-7fd9279fd725")
	channel.Type = constant.ChannelTypeOpenAI

	require.NoError(t, channel.Update())

	var updated Channel
	require.NoError(t, DB.First(&updated, channel.Id).Error)
	require.Equal(t, constant.ChannelTypeOpenAI, updated.Type)
	require.Empty(t, updated.CodexFingerprintSeed)
}

func TestEnableChannelByTagMintsSeedForLegacyDisabledCodexChannel(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	tag := "legacy-codex"
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusManuallyDisabled, "")
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("tag", tag).Error)

	require.NoError(t, EnableChannelByTag(tag))

	var stored Channel
	require.NoError(t, DB.First(&stored, "id = ?", channel.Id).Error)
	require.Equal(t, common.ChannelStatusEnabled, stored.Status)
	requireUUIDString(t, stored.CodexFingerprintSeed)
}

func TestEnableChannelByTagRollsBackWhenSeedUpdateFails(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	tag := "rollback-codex"
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusManuallyDisabled, "")
	require.NoError(t, DB.Model(&Channel{}).Where("id = ?", channel.Id).Update("tag", tag).Error)

	updates := 0
	const callbackName = "test:fail_codex_seed_update"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "channels" {
			return
		}
		updates++
		if updates == 2 {
			tx.AddError(errors.New("forced seed update failure"))
		}
	}))

	err := EnableChannelByTag(tag)
	require.ErrorContains(t, err, "forced seed update failure")
	require.NoError(t, DB.Callback().Update().Remove(callbackName))

	var stored Channel
	require.NoError(t, DB.First(&stored, "id = ?", channel.Id).Error)
	require.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
	require.Empty(t, stored.CodexFingerprintSeed)
}

func TestChannelUpdateRollsBackWhenAbilityRefreshFails(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusManuallyDisabled, "")
	originalName := channel.Name

	const callbackName = "test:fail_channel_ability_refresh"
	require.NoError(t, DB.Callback().Delete().Before("gorm:delete").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(errors.New("forced ability refresh failure"))
		}
	}))

	channel.Name = "partially-updated"
	channel.Status = common.ChannelStatusEnabled
	err := channel.Update()
	require.ErrorContains(t, err, "forced ability refresh failure")
	require.NoError(t, DB.Callback().Delete().Remove(callbackName))

	var stored Channel
	require.NoError(t, DB.First(&stored, "id = ?", channel.Id).Error)
	require.Equal(t, originalName, stored.Name)
	require.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status)
	require.Empty(t, stored.CodexFingerprintSeed)
}

func TestUpdateChannelStatusMintsSeedForLegacyAutoDisabledCodexChannel(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusAutoDisabled, "")

	require.True(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, ""))

	var stored Channel
	require.NoError(t, DB.First(&stored, "id = ?", channel.Id).Error)
	require.Equal(t, common.ChannelStatusEnabled, stored.Status)
	requireUUIDString(t, stored.CodexFingerprintSeed)
}

func TestUpdateChannelStatusRollsBackWhenAbilityUpdateFails(t *testing.T) {
	setupCodexFingerprintSeedTestDB(t)
	channel := insertCodexFingerprintSeedChannel(t, constant.ChannelTypeCodex, common.ChannelStatusAutoDisabled, "")
	ability := Ability{
		Group:     "default",
		Model:     "gpt-5-codex",
		ChannelId: channel.Id,
		Enabled:   false,
	}
	require.NoError(t, DB.Create(&ability).Error)

	const callbackName = "test:fail_channel_status_ability_update"
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table == "abilities" {
			tx.AddError(errors.New("forced ability status update failure"))
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, DB.Callback().Update().Remove(callbackName))
	})

	require.False(t, UpdateChannelStatus(channel.Id, "", common.ChannelStatusEnabled, "manual retry"))

	var storedChannel Channel
	require.NoError(t, DB.First(&storedChannel, "id = ?", channel.Id).Error)
	require.Equal(t, common.ChannelStatusAutoDisabled, storedChannel.Status)
	require.Empty(t, storedChannel.CodexFingerprintSeed)

	var storedAbility Ability
	require.NoError(t, DB.First(&storedAbility, "channel_id = ?", channel.Id).Error)
	require.False(t, storedAbility.Enabled)
}
