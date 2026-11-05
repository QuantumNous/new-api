package service

import (
	"fmt"
	"maps"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/glebarez/sqlite"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// hwSeedTestOptionValues decodes the stored option rows, so a test can compare
// what the seeding actually wrote instead of the in-memory state it left behind.
func hwSeedTestOptionValues(t *testing.T) map[string]string {
	t.Helper()
	rows, err := model.AllOption()
	require.NoError(t, err)
	values := make(map[string]string, len(rows))
	for _, row := range rows {
		values[row.Key] = row.Value
	}
	return values
}

// setupHwSeedDefaultsTest gives a test an empty options table plus the global
// settings the seeding writes into, and restores every touched global afterward.
func setupHwSeedDefaultsTest(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalMaster := common.IsMasterNode
	originalSystemName := common.SystemName
	originalGeneral := *operation_setting.GetGeneralSetting()
	originalClaude := *model_setting.GetClaudeSettings()
	originalModelRatio := ratio_setting.ModelRatio2JSONString()
	originalCompletionRatio := ratio_setting.CompletionRatio2JSONString()
	originalGroupRatio := ratio_setting.GroupRatio2JSONString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalServerAddress := system_setting.ServerAddress
	originalPasskey := *system_setting.GetPasskeySettings()
	originalLegal := *system_setting.GetLegalSettings()
	originalChats := setting.Chats2JsonString()
	originalOptions := make(map[string]string)
	common.OptionMapRWMutex.RLock()
	maps.Copy(originalOptions, common.OptionMap)
	common.OptionMapRWMutex.RUnlock()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.Channel{}, &model.Ability{}))
	model.DB = db
	common.IsMasterNode = true
	common.OptionMapRWMutex.Lock()
	common.OptionMap = map[string]string{}
	common.OptionMapRWMutex.Unlock()
	// An empty option table means the shipped code defaults are in force; put
	// them back so a test starts where a fresh deployment starts.
	system_setting.ServerAddress = originalServerAddress
	*system_setting.GetPasskeySettings() = originalPasskey
	*system_setting.GetLegalSettings() = originalLegal
	require.NoError(t, setting.UpdateChatsByJsonString(originalChats))

	t.Cleanup(func() {
		model.DB = originalDB
		common.IsMasterNode = originalMaster
		common.SystemName = originalSystemName
		*operation_setting.GetGeneralSetting() = originalGeneral
		*model_setting.GetClaudeSettings() = originalClaude
		require.NoError(t, ratio_setting.UpdateModelRatioByJSONString(originalModelRatio))
		require.NoError(t, ratio_setting.UpdateCompletionRatioByJSONString(originalCompletionRatio))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatio))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		system_setting.ServerAddress = originalServerAddress
		*system_setting.GetPasskeySettings() = originalPasskey
		*system_setting.GetLegalSettings() = originalLegal
		require.NoError(t, setting.UpdateChatsByJsonString(originalChats))
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptions
		common.OptionMapRWMutex.Unlock()
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})
}

// TestHwSeedDefaultOptions protects the production defaults a fresh database
// needs: without them every request fails with a model price error and the
// console shows dollars.
func TestHwSeedDefaultOptions(t *testing.T) {
	t.Run("a fresh database gets the sale groups, the list prices and the TL display", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)
		common.OptionMapRWMutex.Lock()
		common.OptionMap[HwOptionTryPerUsd] = "40"
		common.OptionMapRWMutex.Unlock()

		require.NoError(t, HwSeedDefaultOptions())

		// The sale groups exist at the official price, next to the shipped ones.
		for _, group := range []string{"default", "vip", model.HwFreeGroupName, model.HwPaidGroupName} {
			assert.Equal(t, 1.0, ratio_setting.GetGroupRatio(group), "group ratio of %s", group)
		}
		// The console labels the sale groups; the shipped labels stay.
		assert.Equal(t, "Ücretsiz deneme", setting.GetUsableGroupDescription(model.HwFreeGroupName))
		assert.Equal(t, "Ücretli", setting.GetUsableGroupDescription(model.HwPaidGroupName))
		assert.Equal(t, "Default group", setting.GetUsableGroupDescription("default"))

		// Model ratio 1 is $2 per million tokens, so the ratio is the input
		// price per million divided by two, at half the list price.
		expectedModelRatios := map[string]float64{
			"claude-opus-5-5":   1,
			"claude-sonnet-5-5": 0.5,
			"claude-haiku-5-5":  0.025,
		}
		for name, expected := range expectedModelRatios {
			ratio, ok, _ := ratio_setting.GetModelRatio(name)
			require.True(t, ok, "model ratio of %s", name)
			assert.Equal(t, expected, ratio, "model ratio of %s", name)
		}
		// The completion ratio is the output price in units of the input price.
		for name := range expectedModelRatios {
			assert.Equal(t, 5.0, ratio_setting.GetCompletionRatio(name), "completion ratio of %s", name)
		}
		// The three gpt names left the catalog, so the seed prices no gpt model.
		for name := range hwRetiredModels {
			_, ok, _ := ratio_setting.GetModelRatio(name)
			assert.False(t, ok, "model ratio of the retired %s", name)
		}

		// The thinking adapter would rewrite the model alias on its way to the
		// supplier, where that name does not exist.
		assert.False(t, model_setting.GetClaudeSettings().ThinkingAdapterEnabled)

		// The console shows TL through the same getters /api/status answers from.
		assert.Equal(t, operation_setting.QuotaDisplayTypeCustom, operation_setting.GetQuotaDisplayType())
		assert.Equal(t, HwTryCurrencySymbol, operation_setting.GetCurrencySymbol())
		assert.Equal(t, 40.0, operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate)
		assert.Equal(t, HwTryCurrencySymbol, operation_setting.GetGeneralSetting().CustomCurrencySymbol)
	})

	t.Run("the TL display is set even before the first rate is published", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)

		require.NoError(t, HwSeedDefaultOptions())

		assert.Equal(t, operation_setting.QuotaDisplayTypeCustom, operation_setting.GetQuotaDisplayType())
		assert.Equal(t, 1.0, operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
			"the shipped rate stays until the daily job publishes one")
	})

	t.Run("operator values stay and a missing sold name is filled in", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)
		// The operator priced one sold model itself, changed the free group and
		// chose the dollar display.
		require.NoError(t, model.UpdateOption(hwModelRatioOption, `{"claude-opus-5-5":3.5,"gpt-4o":1.25}`))
		require.NoError(t, model.UpdateOption(hwCompletionRatioOption, `{"claude-opus-5-5":4}`))
		require.NoError(t, model.UpdateOption(hwGroupRatioOption, `{"default":1,"vip":1,"free":0.9}`))
		require.NoError(t, model.UpdateOption(hwDisplayTypeOption, operation_setting.QuotaDisplayTypeUSD))

		require.NoError(t, HwSeedDefaultOptions())

		ratio, ok, _ := ratio_setting.GetModelRatio("claude-opus-5-5")
		require.True(t, ok)
		assert.Equal(t, 3.5, ratio, "an operator price is never replaced")
		assert.Equal(t, 4.0, ratio_setting.GetCompletionRatio("claude-opus-5-5"))
		ratio, ok, _ = ratio_setting.GetModelRatio("claude-haiku-5-5")
		require.True(t, ok, "a missing sold model is filled in")
		assert.Equal(t, 0.025, ratio)
		ratio, ok, _ = ratio_setting.GetModelRatio("gpt-4o")
		require.True(t, ok, "a model outside the catalog stays")
		assert.Equal(t, 1.25, ratio)

		assert.Equal(t, 0.9, ratio_setting.GetGroupRatio(model.HwFreeGroupName))
		assert.Equal(t, 1.0, ratio_setting.GetGroupRatio(model.HwPaidGroupName))

		// A display the operator chose is left alone, down to the symbol.
		assert.Equal(t, operation_setting.QuotaDisplayTypeUSD, operation_setting.GetQuotaDisplayType())
		assert.Equal(t, "¤", operation_setting.GetGeneralSetting().CustomCurrencySymbol)
	})

	t.Run("an operator currency without a display type is kept", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)
		require.NoError(t, model.UpdateOption(hwDisplaySymbolOption, "kr"))

		require.NoError(t, HwSeedDefaultOptions())

		assert.Equal(t, "kr", operation_setting.GetGeneralSetting().CustomCurrencySymbol)
		assert.Equal(t, operation_setting.QuotaDisplayTypeUSD, operation_setting.GetQuotaDisplayType(),
			"our TL display is not forced onto another currency")
	})

	// A visitor of /api/status reads these straight from the answer: the address
	// the site answers on, the name and domain a passkey prompt shows, the chat
	// app list and whether both legal pages exist.
	t.Run("a fresh database gets our own address, passkey name, chat list and legal texts", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)

		require.NoError(t, HwSeedDefaultOptions())

		assert.Equal(t, "https://api.hisarweb.be", system_setting.ServerAddress)
		passkey := system_setting.PasskeySettingsSnapshot()
		assert.Equal(t, "HisarWeb AI", passkey.RPDisplayName)
		assert.Equal(t, "api.hisarweb.be", passkey.EffectiveRPID())
		assert.Empty(t, setting.Chats, "no third-party chat app is launched with our key")

		legal := system_setting.GetLegalSettings()
		require.NotEmpty(t, legal.PrivacyPolicy)
		require.NotEmpty(t, legal.UserAgreement)
		for _, text := range []string{legal.PrivacyPolicy, legal.UserAgreement} {
			// The statement has to point a visitor at a working route for the
			// rights it lists, and it may never leak a supplier.
			assert.Contains(t, text, "hisarweb.be@gmail.com")
			assert.NotContains(t, strings.ToLower(text), "lumia")
			assert.NotContains(t, strings.ToLower(text), "openrouter")
		}
		assert.Contains(t, legal.PrivacyPolicy, "KVKK madde 11")
		// The texts say what the shop really does: the payment providers and the
		// Telegram bot are named as processors, credit lasts 30 days (14 for the
		// trial) and the agreement no longer promises that unused credit never
		// expires.
		for _, processor := range []string{"Stripe", "Revolut", "Telegram"} {
			assert.Contains(t, legal.PrivacyPolicy, processor)
		}
		assert.Contains(t, legal.UserAgreement, "30 gün")
		assert.Contains(t, legal.UserAgreement, "14 gün")
		assert.NotContains(t, legal.UserAgreement, "kullanılmayan kredi sonraki isteklerde")
	})

	t.Run("public identity entries the operator set are kept", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)
		// The operator runs on another address, has configured its own passkey
		// domain, kept one chat app and wrote its own privacy policy.
		require.NoError(t, model.UpdateOption(hwServerAddressOption, "https://ai.example.test"))
		require.NoError(t, model.UpdateOption(hwPasskeyRPIDOption, "ai.example.test"))
		require.NoError(t, model.UpdateOption(hwChatAppsOption, `[{"Eigen app":"eigenapp://x"}]`))
		require.NoError(t, model.UpdateOption(hwPrivacyPolicyOption, "Eigen beleid."))

		require.NoError(t, HwSeedDefaultOptions())

		assert.Equal(t, "https://ai.example.test", system_setting.ServerAddress)
		assert.Equal(t, "ai.example.test", system_setting.PasskeySettingsSnapshot().EffectiveRPID())
		assert.Len(t, setting.Chats, 1, "an operator list is not emptied")
		assert.Equal(t, "Eigen beleid.", system_setting.GetLegalSettings().PrivacyPolicy)
		// The agreement was still empty, so the seeding fills it in.
		assert.NotEmpty(t, system_setting.GetLegalSettings().UserAgreement)
	})

	t.Run("a second run writes the same values", func(t *testing.T) {
		setupHwSeedDefaultsTest(t)
		common.OptionMapRWMutex.Lock()
		common.OptionMap[HwOptionTryPerUsd] = "40"
		common.OptionMapRWMutex.Unlock()

		require.NoError(t, HwSeedDefaultOptions())
		first := hwSeedTestOptionValues(t)
		require.NoError(t, HwSeedDefaultOptions())
		second := hwSeedTestOptionValues(t)

		require.Len(t, second, len(first))
		for key, value := range first {
			require.Contains(t, second, key)
			// The ratio maps are re-encoded, so compare them decoded.
			if key == hwModelRatioOption || key == hwCompletionRatioOption || key == hwGroupRatioOption {
				assert.JSONEq(t, value, second[key], "option %s", key)
				continue
			}
			assert.Equal(t, value, second[key], "option %s", key)
		}
	})
}

// TestHwApplySnapshotModelRatios protects the link between the daily price list
// and the bill: the sold models are billed at half the day's list price.
func TestHwApplySnapshotModelRatios(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	// An operator priced two sold models itself and one model outside the catalog.
	require.NoError(t, model.UpdateOption(hwModelRatioOption,
		`{"claude-opus-5-5":3.5,"claude-haiku-5-5":1,"gemini-3.8-flash":0.75,"gpt-4o":1.25}`))
	require.NoError(t, model.UpdateOption(hwCompletionRatioOption,
		`{"claude-opus-5-5":4,"claude-haiku-5-5":5,"gemini-3.8-flash":6}`))

	snapshot := &model.HwPriceSnapshot{
		Models: `{"claude-opus-5-5":{"in":6000000,"out":30000000},` +
			`"claude-sonnet-5-5":{"in":2000000,"out":10000000},` +
			`"gpt-5.6-sol":{"in":2000000,"out":10000000},` +
			`"gemini-3.8-flash":{"in":0,"out":9000000}}`,
	}
	require.NoError(t, HwApplySnapshotModelRatios(snapshot))

	// A sold model is billed at half the published list price.
	ratio, ok, _ := ratio_setting.GetModelRatio("claude-opus-5-5")
	require.True(t, ok)
	assert.Equal(t, 1.5, ratio)
	assert.Equal(t, 5.0, ratio_setting.GetCompletionRatio("claude-opus-5-5"))
	// A sold model the snapshot prices for the first time gets both ratios.
	ratio, ok, _ = ratio_setting.GetModelRatio("claude-sonnet-5-5")
	require.True(t, ok)
	assert.Equal(t, 0.5, ratio)
	assert.Equal(t, 5.0, ratio_setting.GetCompletionRatio("claude-sonnet-5-5"))
	// A retired name in the snapshot is never priced again: the daily list may
	// still carry it, but the bill does not.
	_, ok, _ = ratio_setting.GetModelRatio("gpt-5.6-sol")
	assert.False(t, ok, "a retired model is not priced by the snapshot")
	// A model outside the catalog keeps its operator ratio.
	ratio, ok, _ = ratio_setting.GetModelRatio("gpt-4o")
	require.True(t, ok)
	assert.Equal(t, 1.25, ratio)
	// A sold model the snapshot does not price keeps its entry.
	ratio, ok, _ = ratio_setting.GetModelRatio("claude-haiku-5-5")
	require.True(t, ok)
	assert.Equal(t, 1.0, ratio)
	assert.Equal(t, 5.0, ratio_setting.GetCompletionRatio("claude-haiku-5-5"))
	// An unusable price never lowers the bill of a sold model to zero.
	ratio, ok, _ = ratio_setting.GetModelRatio("gemini-3.8-flash")
	require.True(t, ok)
	assert.Equal(t, 0.75, ratio)
	assert.Equal(t, 6.0, ratio_setting.GetCompletionRatio("gemini-3.8-flash"))
}

// TestHwSeedRetiredModels protects the retirement of an old model on a running
// database: after startup no channel, ability or billing ratio offers it any
// more, and a second start changes nothing.
func TestHwSeedRetiredModels(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	channels := []model.Channel{
		{Name: "mixed", Key: "k1", Status: common.ChannelStatusEnabled, Group: "free,paid", Models: "claude-haiku-4-5,claude-haiku-5-5,claude-sonnet-5,claude-sonnet-5-5"},
		{Name: "only-retired", Key: "k2", Status: common.ChannelStatusEnabled, Group: "paid", Models: "claude-sonnet-5"},
		{Name: "untouched", Key: "k3", Status: common.ChannelStatusEnabled, Group: "paid", Models: "gpt-4o,claude-haiku-5-5"},
	}
	for i := range channels {
		require.NoError(t, channels[i].Insert())
	}
	require.NoError(t, model.UpdateOption(hwModelRatioOption, `{"claude-haiku-4-5":0.025,"claude-sonnet-5":0.5,"gpt-4o":1.25}`))
	require.NoError(t, model.UpdateOption(hwCompletionRatioOption, `{"claude-haiku-4-5":5,"claude-sonnet-5":5,"gpt-4o":4}`))

	for range 2 {
		require.NoError(t, HwSeedDefaultOptions())

		models := map[string]string{}
		var stored []model.Channel
		require.NoError(t, model.DB.Find(&stored).Error)
		for _, channel := range stored {
			models[channel.Name] = channel.Models
		}
		assert.Equal(t, map[string]string{
			"mixed":        "claude-haiku-5-5,claude-sonnet-5-5",
			"only-retired": "",
			"untouched":    "gpt-4o,claude-haiku-5-5,gpt-6-luna,gpt-6.1-sol,gpt-6-astra",
		}, models)

		var abilityModels []string
		require.NoError(t, model.DB.Model(&model.Ability{}).Distinct("model").Order("model").Pluck("model", &abilityModels).Error)
		// The gpt channel also receives the sold gpt names of its family.
		assert.Equal(t, []string{"claude-haiku-5-5", "claude-sonnet-5-5", "gpt-4o", "gpt-6-astra", "gpt-6-luna", "gpt-6.1-sol"}, abilityModels)

		for retired := range hwRetiredModels {
			_, ok := ratio_setting.GetModelRatioCopy()[retired]
			assert.False(t, ok, "model ratio of %s", retired)
			_, ok = ratio_setting.GetCompletionRatioCopy()[retired]
			assert.False(t, ok, "completion ratio of %s", retired)
		}
		ratio, ok, _ := ratio_setting.GetModelRatio("gpt-4o")
		require.True(t, ok)
		assert.Equal(t, 1.25, ratio, "an operator ratio of another model stays")
	}
}

// TestHwSeedSoldModelChannels protects the startup step that re-attaches a sold
// model which has no ability row: without it, a name that returns to
// hwSoldModels is sold by the comparator and the status page while no channel
// answers it (measured on 28 Oct 2026, gpt-6-luna, gpt-6.1-sol, gpt-6-astra).
func TestHwSeedSoldModelChannels(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	channel := model.Channel{
		Name: "sonnet-only", Key: "k1", Status: common.ChannelStatusEnabled,
		Group: model.HwPaidGroupName, Models: "claude-sonnet-5",
	}
	require.NoError(t, channel.Insert())

	for range 2 {
		require.NoError(t, HwSeedDefaultOptions())

		var stored model.Channel
		require.NoError(t, model.DB.First(&stored, "id = ?", channel.Id).Error)
		assert.Contains(t, stored.GetModels(), "claude-sonnet-5-5",
			"the sold model of the family is attached to the channel of its family")
		assert.NotContains(t, stored.GetModels(), "claude-sonnet-5",
			"a retired name is not put back")

		var routed []string
		require.NoError(t, model.DB.Model(&model.Ability{}).
			Where("channel_id = ?", channel.Id).Distinct("model").Pluck("model", &routed).Error)
		assert.ElementsMatch(t, []string{"claude-sonnet-5-5"}, routed,
			"the ability row is derived from the channel models")
	}
}

// TestHwSeedSoldModelChannelsRepairsDisabledAbility protects the price table
// against a sold model whose ability rows exist but are disabled: the name is
// then sold and routable in principle while the enabled rows the price table
// reads do not carry it (measured on 5 Nov 2026, claude-sonnet-5-5, 8 of 9 names
// on /api/pricing).
func TestHwSeedSoldModelChannelsRepairsDisabledAbility(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	channel := model.Channel{
		Name: "sonnet", Key: "k1", Status: common.ChannelStatusEnabled,
		Group: model.HwPaidGroupName, Models: "claude-sonnet-5-5",
	}
	require.NoError(t, channel.Insert())
	// The channel row still lists the name while its derived row is disabled,
	// which is what a switched-off channel leaves behind.
	require.NoError(t, model.DB.Model(&model.Ability{}).
		Where("channel_id = ? and model = ?", channel.Id, "claude-sonnet-5-5").
		Update("enabled", false).Error)

	require.NoError(t, HwSeedDefaultOptions())

	var abilities []model.Ability
	require.NoError(t, model.DB.Where("channel_id = ? and model = ?", channel.Id, "claude-sonnet-5-5").
		Find(&abilities).Error)
	require.Len(t, abilities, 1)
	assert.True(t, abilities[0].Enabled, "the sold model gets an enabled ability row again")

	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, "id = ?", channel.Id).Error)
	assert.Equal(t, "claude-sonnet-5-5", stored.Models, "the model list is not duplicated")
}

// TestHwSeedSoldModelChannelsKeepsDisabledChannelOff protects the operator
// decision behind a switched-off channel: a sold model of that family is not
// attached to it and the channel is not switched on by the seed.
func TestHwSeedSoldModelChannelsKeepsDisabledChannelOff(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	channel := model.Channel{
		Name: "sonnet-off", Key: "k1", Status: common.ChannelStatusManuallyDisabled,
		Group: model.HwPaidGroupName, Models: "claude-sonnet-5-5",
	}
	require.NoError(t, channel.Insert())

	require.NoError(t, HwSeedDefaultOptions())

	var stored model.Channel
	require.NoError(t, model.DB.First(&stored, "id = ?", channel.Id).Error)
	assert.Equal(t, common.ChannelStatusManuallyDisabled, stored.Status,
		"a disabled channel stays disabled")
}

// TestHwSeedRetiredModelsRefreshesTheChannelCache protects a running database
// against the window between the seed and the next cache rebuild: the channel
// cache that was built before the seed (startup builds it after the seed, but a
// rolling node, a test or a future caller may not) must not route a request for
// a retired name to a channel that no longer offers it.
func TestHwSeedRetiredModelsRefreshesTheChannelCache(t *testing.T) {
	setupHwSeedDefaultsTest(t)
	originalMemoryCache := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = true
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCache
		model.InitChannelCache()
	})

	channel := model.Channel{
		Name: "mixed", Key: "k1", Status: common.ChannelStatusEnabled, Group: model.HwPaidGroupName,
		Models: "claude-sonnet-5,claude-sonnet-5-5",
	}
	require.NoError(t, channel.Insert())
	// The cache is built while the retired name still exists, exactly like a
	// process whose cache was warmed before the seed ran.
	model.InitChannelCache()
	found, err := model.GetRandomSatisfiedChannel(model.HwPaidGroupName, "claude-sonnet-5", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, found, "the retired name is routable before the seed")

	require.NoError(t, HwSeedDefaultOptions())

	found, err = model.GetRandomSatisfiedChannel(model.HwPaidGroupName, "claude-sonnet-5", 0, nil)
	require.NoError(t, err)
	assert.Nil(t, found, "a retired model finds no channel after the seed")
	found, err = model.GetRandomSatisfiedChannel(model.HwPaidGroupName, "claude-sonnet-5-5", 0, nil)
	require.NoError(t, err)
	require.NotNil(t, found, "the sold successor stays routable")
	assert.Equal(t, channel.Id, found.Id)
}

// TestHwSyncDisplayCurrencyRate protects the TL display against a stale rate:
// the first successful price fetch fills in the rate.
func TestHwSyncDisplayCurrencyRate(t *testing.T) {
	setupHwSeedDefaultsTest(t)

	require.NoError(t, hwSyncDisplayCurrencyRate(decimal.NewFromInt(41)))

	assert.Equal(t, operation_setting.QuotaDisplayTypeUSD, operation_setting.GetQuotaDisplayType(),
		"a dollar display is left alone")
	assert.Equal(t, 1.0, operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate)

	require.NoError(t, model.UpdateOption(hwDisplayTypeOption, operation_setting.QuotaDisplayTypeCustom))
	require.NoError(t, model.UpdateOption(hwDisplaySymbolOption, HwTryCurrencySymbol))
	require.NoError(t, hwSyncDisplayCurrencyRate(decimal.NewFromInt(41)))

	assert.Equal(t, 41.0, operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
		"a TL display follows the daily rate")

	require.NoError(t, model.UpdateOption(hwDisplaySymbolOption, "kr"))
	require.NoError(t, hwSyncDisplayCurrencyRate(decimal.NewFromInt(42)))

	assert.Equal(t, 41.0, operation_setting.GetGeneralSetting().CustomCurrencyExchangeRate,
		"a display the operator set to another currency is left alone")
}
