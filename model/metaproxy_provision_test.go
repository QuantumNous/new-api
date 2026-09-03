package model

import (
	"errors"
	"fmt"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupMetaproxyProvisionTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:metaproxy-provision-%s?mode=memory&cache=shared", t.Name())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&Channel{}, &Ability{}, &Option{}))

	previousDB := DB
	previousMemoryCacheEnabled := common.MemoryCacheEnabled
	DB = db
	common.MemoryCacheEnabled = true
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = map[string]string{
		MetaproxyProvisionDigestOption:   "old-digest",
		MetaproxyProvisionRevisionOption: "old-revision",
	}
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		DB = previousDB
		common.MemoryCacheEnabled = previousMemoryCacheEnabled
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})
	return db
}

// stubProvisionReload replaces the hot-reload steps for the duration of one
// test and restores them afterwards.
func stubProvisionReload(t *testing.T, reloadOptions func(), reloadChannels func()) {
	t.Helper()
	originalOptions, originalChannels := reloadProvisionOptions, reloadProvisionChannels
	reloadProvisionOptions, reloadProvisionChannels = reloadOptions, reloadChannels
	t.Cleanup(func() {
		reloadProvisionOptions, reloadProvisionChannels = originalOptions, originalChannels
	})
}

func provisionTestChannel(name, key, models string) MetaproxyProvisionChannel {
	return MetaproxyProvisionChannel{
		Type:         1,
		Key:          key,
		Name:         name,
		BaseURL:      "https://upstream.example/v1",
		Models:       models,
		Group:        "standard",
		Priority:     10,
		Weight:       100,
		Status:       1,
		TestModel:    models,
		ModelMapping: "",
	}
}

func seedProvisionState(t *testing.T, db *gorm.DB) Channel {
	t.Helper()
	tag := MetaproxyProvisionManagedTag
	baseURL := "https://old.example/v1"
	priority := int64(1)
	weight := uint(50)
	old := Channel{
		Type:        1,
		Key:         "old-key",
		Name:        "Old upstream [old]",
		BaseURL:     &baseURL,
		Models:      "old-model",
		Group:       "standard",
		Priority:    &priority,
		Weight:      &weight,
		Status:      2,
		Tag:         &tag,
		UsedQuota:   12345,
		CreatedTime: 99,
	}
	require.NoError(t, db.Create(&old).Error)
	require.NoError(t, old.AddAbilities(db))
	require.NoError(t, db.Create(&[]Option{
		{Key: MetaproxyProvisionDigestOption, Value: "old-digest"},
		{Key: MetaproxyProvisionRevisionOption, Value: "old-revision"},
		{Key: "ModelRatio", Value: `{"old-model":1}`},
		{Key: "CompletionRatio", Value: `{"old-model":2}`},
		{Key: "CacheRatio", Value: `{}`},
		{Key: "billing_setting.billing_mode", Value: `{}`},
		{Key: "billing_setting.billing_expr", Value: `{}`},
		{Key: "GroupRatio", Value: `{"standard":1}`},
		{Key: "UserUsableGroups", Value: `{"default":"standard"}`},
	}).Error)
	return old
}

func desiredProvisionConfig() MetaproxyProvisionConfig {
	return MetaproxyProvisionConfig{
		Revision: "ba57fd0526c6ce9e9869c225ac9997d96b2bbdea",
		Digest:   "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		Channels: []MetaproxyProvisionChannel{
			provisionTestChannel("New upstream [new]", "new-key", "new-model"),
		},
		Options: MetaproxyProvisionOptions{
			ModelRatio:       `{"new-model":1.5}`,
			CompletionRatio:  `{"new-model":3}`,
			CacheRatio:       `{"new-model":0.1}`,
			ModelBillingMode: `{"image-model":"tiered_expr"}`,
			ModelBillingExpr: `{"image-model":"tier(\"base\", 200000)"}`,
			GroupRatio:       `{"standard":1}`,
			UserUsableGroups: `{"default":"standard"}`,
		},
	}
}

func TestApplyMetaproxyProvisionReplacesManagedStateAtomically(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	seedProvisionState(t, db)
	config := desiredProvisionConfig()

	result, err := ApplyMetaproxyProvision(config, "old-digest")
	require.NoError(t, err)
	require.Equal(t, MetaproxyProvisionResult{
		AlreadyApplied: false,
		PreviousDigest: "old-digest",
	}, result)

	var channels []Channel
	require.NoError(t, db.Where("tag = ?", MetaproxyProvisionManagedTag).Find(&channels).Error)
	require.Len(t, channels, 1)
	require.Equal(t, "New upstream [new]", channels[0].Name)
	require.Equal(t, "new-key", channels[0].Key)
	require.Greater(t, channels[0].CreatedTime, int64(0))

	var abilities []Ability
	require.NoError(t, db.Find(&abilities).Error)
	require.Len(t, abilities, 1)
	require.Equal(t, "new-model", abilities[0].Model)
	require.Equal(t, channels[0].Id, abilities[0].ChannelId)

	var options []Option
	require.NoError(t, db.Find(&options).Error)
	got := make(map[string]string, len(options))
	for _, option := range options {
		got[option.Key] = option.Value
	}
	require.Equal(t, config.Digest, got[MetaproxyProvisionDigestOption])
	require.Equal(t, config.Revision, got[MetaproxyProvisionRevisionOption])
	require.Equal(t, `{"new-model":1.5}`, got["ModelRatio"])
	require.Equal(t, `{"image-model":"tiered_expr"}`, got["billing_setting.billing_mode"])
	require.Equal(t, `{"image-model":"tier(\"base\", 200000)"}`, got["billing_setting.billing_expr"])

	// The apply hot-reloads the in-process state: the new digest is active in
	// memory and the new channel is routable without a restart.
	common.OptionMapRWMutex.RLock()
	require.Equal(t, config.Digest, common.OptionMap[MetaproxyProvisionDigestOption])
	common.OptionMapRWMutex.RUnlock()

	channel, err := GetRandomSatisfiedChannel("standard", "new-model", 0, "")
	require.NoError(t, err)
	require.NotNil(t, channel)
	require.Equal(t, "New upstream [new]", channel.Name)
	require.Equal(t, "new-key", channel.Key)
}

func TestApplyMetaproxyProvisionReloadsOptionsBeforeChannels(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	seedProvisionState(t, db)

	var reloadSequence []string
	stubProvisionReload(t,
		func() { reloadSequence = append(reloadSequence, "options") },
		func() { reloadSequence = append(reloadSequence, "channels") },
	)

	_, err := ApplyMetaproxyProvision(desiredProvisionConfig(), "old-digest")
	require.NoError(t, err)
	require.Equal(t, []string{"options", "channels"}, reloadSequence)
}

func TestApplyMetaproxyProvisionIdempotentRetrySkipsReload(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	seedProvisionState(t, db)
	config := desiredProvisionConfig()

	first, err := ApplyMetaproxyProvision(config, "old-digest")
	require.NoError(t, err)
	require.False(t, first.AlreadyApplied)
	common.OptionMapRWMutex.RLock()
	require.Equal(t, config.Digest, common.OptionMap[MetaproxyProvisionDigestOption])
	common.OptionMapRWMutex.RUnlock()

	optionsReloads, channelsReloads := 0, 0
	stubProvisionReload(t, func() { optionsReloads++ }, func() { channelsReloads++ })

	second, err := ApplyMetaproxyProvision(config, config.Digest)
	require.NoError(t, err)
	require.True(t, second.AlreadyApplied)
	require.Zero(t, optionsReloads)
	require.Zero(t, channelsReloads)
}

func TestApplyMetaproxyProvisionConflictDoesNotWrite(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	old := seedProvisionState(t, db)

	_, err := ApplyMetaproxyProvision(desiredProvisionConfig(), "some-other-digest")
	require.ErrorIs(t, err, ErrMetaproxyProvisionConflict)

	var channel Channel
	require.NoError(t, db.First(&channel, old.Id).Error)
	require.Equal(t, "old-key", channel.Key)
	var digest Option
	require.NoError(t, db.First(&digest, "key = ?", MetaproxyProvisionDigestOption).Error)
	require.Equal(t, "old-digest", digest.Value)

	common.OptionMapRWMutex.RLock()
	require.Equal(t, "old-digest", common.OptionMap[MetaproxyProvisionDigestOption])
	common.OptionMapRWMutex.RUnlock()
}

func TestApplyMetaproxyProvisionRequiresMemoryCache(t *testing.T) {
	setupMetaproxyProvisionTestDB(t)
	common.MemoryCacheEnabled = false

	_, err := ApplyMetaproxyProvision(desiredProvisionConfig(), "none")
	require.ErrorIs(t, err, ErrMetaproxyProvisionRequiresMemoryCache)
}

func TestApplyMetaproxyProvisionUpdatesInPlaceAndIsIdempotent(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	old := seedProvisionState(t, db)
	config := desiredProvisionConfig()
	config.Channels = []MetaproxyProvisionChannel{
		provisionTestChannel(old.Name, "rotated-key", "new-model"),
	}
	config.Channels[0].Status = old.Status

	first, err := ApplyMetaproxyProvision(config, "old-digest")
	require.NoError(t, err)
	require.False(t, first.AlreadyApplied)

	var updated Channel
	require.NoError(t, db.First(&updated, old.Id).Error)
	require.Equal(t, old.Id, updated.Id)
	require.Equal(t, old.CreatedTime, updated.CreatedTime)
	require.Equal(t, old.UsedQuota, updated.UsedQuota)
	require.Equal(t, old.Status, updated.Status)
	require.Equal(t, "rotated-key", updated.Key)

	second, err := ApplyMetaproxyProvision(config, config.Digest)
	require.NoError(t, err)
	require.True(t, second.AlreadyApplied)

	var count int64
	require.NoError(t, db.Model(&Channel{}).Where("tag = ?", MetaproxyProvisionManagedTag).Count(&count).Error)
	require.EqualValues(t, 1, count)
}

func TestApplyMetaproxyProvisionRollsBackEveryTableOnFailure(t *testing.T) {
	db := setupMetaproxyProvisionTestDB(t)
	old := seedProvisionState(t, db)
	require.NoError(t, db.Exec(`
		CREATE TRIGGER reject_completion_ratio
		BEFORE UPDATE ON options
		WHEN NEW.key = 'CompletionRatio'
		BEGIN
			SELECT RAISE(ABORT, 'injected option failure');
		END;
	`).Error)

	_, err := ApplyMetaproxyProvision(desiredProvisionConfig(), "old-digest")
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrMetaproxyProvisionConflict))

	var channels []Channel
	require.NoError(t, db.Where("tag = ?", MetaproxyProvisionManagedTag).Find(&channels).Error)
	require.Len(t, channels, 1)
	require.Equal(t, old.Id, channels[0].Id)
	require.Equal(t, "old-key", channels[0].Key)

	var modelRatio Option
	require.NoError(t, db.First(&modelRatio, "key = ?", "ModelRatio").Error)
	require.Equal(t, `{"old-model":1}`, modelRatio.Value)
	var digest Option
	require.NoError(t, db.First(&digest, "key = ?", MetaproxyProvisionDigestOption).Error)
	require.Equal(t, "old-digest", digest.Value)

	common.OptionMapRWMutex.RLock()
	require.Equal(t, "old-digest", common.OptionMap[MetaproxyProvisionDigestOption])
	common.OptionMapRWMutex.RUnlock()
}
