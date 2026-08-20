package model

import (
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
