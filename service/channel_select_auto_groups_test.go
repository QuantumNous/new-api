package service

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupChannelSelectAutoGroupsTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalRetryTimes := common.RetryTimes
	originalAutoGroups := setting.AutoGroups2JsonString()
	originalUsableGroups := setting.UserUsableGroups2JSONString()
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()
	originalMaxTokenAutoGroups := setting.GetMaxTokenAutoGroups()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	common.RetryTimes = 0

	require.NoError(t, setting.UpdateAutoGroupsByJsonString(`[]`))
	require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(`{"default":"Default","vip":"VIP"}`))
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1,"vip":2}`))
	require.NoError(t, setting.UpdateMaxTokenAutoGroups("2"))

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		common.RetryTimes = originalRetryTimes
		require.NoError(t, setting.UpdateAutoGroupsByJsonString(originalAutoGroups))
		require.NoError(t, setting.UpdateUserUsableGroupsByJSONString(originalUsableGroups))
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		require.NoError(t, setting.UpdateMaxTokenAutoGroups(fmt.Sprintf("%d", originalMaxTokenAutoGroups)))

		if originalMemoryCacheEnabled && originalDB != nil &&
			originalDB.Migrator().HasTable(&model.Channel{}) && originalDB.Migrator().HasTable(&model.Ability{}) {
			model.InitChannelCache()
		}
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	return db
}

func createChannelSelectAutoGroupsChannel(t *testing.T, db *gorm.DB, id int, group, modelName string) {
	t.Helper()
	priority := int64(0)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id:       id,
		Type:     constant.ChannelTypeOpenAI,
		Key:      fmt.Sprintf("key-%d", id),
		Status:   common.ChannelStatusEnabled,
		Name:     fmt.Sprintf("channel-%d", id),
		Weight:   &weight,
		Models:   modelName,
		Group:    group,
		Priority: &priority,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     group,
		Model:     modelName,
		ChannelId: id,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
}

func TestCacheGetRandomSatisfiedChannelUsesTokenAutoGroupsWhenGlobalAutoIsEmpty(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "auto-groups-runtime-model"
	createChannelSelectAutoGroupsChannel(t, db, 2101, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2102, "default", modelName)
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)

	retry := 0
	param := &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "auto",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}

	first, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2101, first.Id)
	assert.Equal(t, "vip", selectedGroup)
	assert.Equal(t, "vip", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
	assert.Empty(t, setting.GetAutoGroups(), "the selection must not depend on the global Auto list")

	param.IncreaseRetry()
	second, selectedGroup, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2102, second.Id)
	assert.Equal(t, "default", selectedGroup)
	assert.Equal(t, "default", common.GetContextKeyString(ctx, constant.ContextKeyAutoGroup))
}

func TestZeroChannelBudgetKeepsLegacyAutoGroupTransition(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "legacy-auto-retry-model"
	createChannelSelectAutoGroupsChannel(t, db, 2151, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2152, "default", modelName)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}

	for attempt := range 3 {
		selected, group, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, selected)
		assert.Equal(t, "vip", group)
		common.SetContextKey(ctx, constant.ContextKeyChannelId, selected.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, selected.GetOtherSettings())
		if attempt < 2 {
			param.IncreaseRetry()
		}
	}

	assert.Zero(t, param.GetRetry(), "legacy selection resets the counter on the last attempt")
	assert.Equal(t, 1, common.GetContextKeyInt(ctx, constant.ContextKeyAutoGroupIndex))
	param.IncreaseRetry()
	assert.Zero(t, param.GetRetry(), "the loop increment must not consume the next group's first attempt")
	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "default", group)
	assert.Zero(t, param.GetRetry(), "the next group's first attempt starts at zero")
}

func TestZeroBudgetAffinityKeepsLegacyAutoRetryGroup(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 1
	const modelName = "zero-budget-affinity-auto-model"
	createChannelSelectAutoGroupsChannel(t, db, 2601, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2602, "default", modelName)
	model.InitChannelCache()

	affinity := operation_setting.GetChannelAffinitySetting()
	previousAffinity := *affinity
	t.Cleanup(func() { *affinity = previousAffinity })
	snapshot, err := model.BuildRequestPolicy(map[string]string{
		"channel_affinity_setting.enabled":      "true",
		"channel_affinity_setting.session_mode": "prefer",
		"channel_affinity_setting.rules":        `[{"name":"session","model_regex":[".*"],"key_sources":[{"type":"request_header","key":"X-Session"}]}]`,
	})
	require.NoError(t, err)
	*affinity = snapshot.Affinity

	newContext := func() *gin.Context {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
		ctx.Request.Header.Set("X-Session", t.Name())
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
		return ctx
	}
	seed := newContext()
	_, found := GetPreferredChannelByAffinity(seed, modelName, "auto")
	require.False(t, found)
	common.SetContextKey(seed, constant.ContextKeyChannelId, 2602)
	RecordChannelAffinity(seed, 2602)
	t.Cleanup(func() { ClearCurrentChannelAffinityCache(seed) })

	ctx := newContext()
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}
	first, group, selectErr := SelectChannelForRequest(ctx, modelName, param)
	require.Nil(t, selectErr)
	require.NotNil(t, first)
	assert.Equal(t, 2602, first.Id)
	assert.Equal(t, "default", group)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, first.GetOtherSettings())

	param.IncreaseRetry()
	second, group, selectErr := SelectChannelForRequest(ctx, modelName, param)
	require.Nil(t, selectErr)
	require.NotNil(t, second)
	assert.Equal(t, 2601, second.Id, "zero budget must not change the legacy retry group")
	assert.Equal(t, "vip", group)
}

func TestBudgetedAffinityStartsAutoRetryFromTheSelectedGroup(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 1
	const modelName = "budgeted-affinity-auto-model"
	createChannelSelectAutoGroupsChannel(t, db, 2611, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2612, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2612).Update("settings", `{"retry_budget":1}`).Error)
	model.InitChannelCache()

	affinity := operation_setting.GetChannelAffinitySetting()
	previousAffinity := *affinity
	t.Cleanup(func() { *affinity = previousAffinity })
	snapshot, err := model.BuildRequestPolicy(map[string]string{
		"channel_affinity_setting.enabled":      "true",
		"channel_affinity_setting.session_mode": "prefer",
		"channel_affinity_setting.rules":        `[{"name":"session","model_regex":[".*"],"key_sources":[{"type":"request_header","key":"X-Session"}]}]`,
	})
	require.NoError(t, err)
	*affinity = snapshot.Affinity

	newContext := func() *gin.Context {
		ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
		ctx.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
		ctx.Request.Header.Set("X-Session", t.Name())
		common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
		common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
		common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
		return ctx
	}
	seed := newContext()
	_, found := GetPreferredChannelByAffinity(seed, modelName, "auto")
	require.False(t, found)
	common.SetContextKey(seed, constant.ContextKeyChannelId, 2612)
	RecordChannelAffinity(seed, 2612)
	t.Cleanup(func() { ClearCurrentChannelAffinityCache(seed) })

	ctx := newContext()
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}
	first, group, selectErr := SelectChannelForRequest(ctx, modelName, param)
	require.Nil(t, selectErr)
	require.NotNil(t, first)
	assert.Equal(t, 2612, first.Id)
	assert.Equal(t, "default", group)
	assert.Equal(t, 1, common.GetContextKeyInt(ctx, constant.ContextKeyAutoGroupIndex))
	common.SetContextKey(ctx, constant.ContextKeyChannelId, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, first.GetOtherSettings())

	param.IncreaseRetry()
	second, group, selectErr := SelectChannelForRequest(ctx, modelName, param)
	require.Nil(t, selectErr)
	require.NotNil(t, second)
	assert.Equal(t, first.Id, second.Id)
	assert.Equal(t, "default", group)
}

func TestUnavailableAutoGroupStartsSelectedAttemptAtZero(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "skipped-auto-retry-model"
	createChannelSelectAutoGroupsChannel(t, db, 2161, "default", modelName)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}
	param.IncreaseRetry()

	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "default", group)
	assert.Zero(t, param.GetRetry(), "skipping an unavailable group starts a new attempt")
}

func TestIncreaseRetryOnlyAdvancesAttemptCounter(t *testing.T) {
	setupChannelSelectAutoGroupsTest(t)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, dto.ChannelOtherSettings{RetryBudget: 1})
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto"}

	param.IncreaseRetry()
	assert.Equal(t, 1, param.GetRetry(), "the generic counter must only advance the attempt")
	assert.Zero(t, common.GetContextKeyInt(ctx, constant.ContextKeyAutoGroupIndex))
}

func TestChannelRetryBudgetDoesNotAddAutoGroupRetries(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	const modelName = "zero-in-group-retries-model"
	createChannelSelectAutoGroupsChannel(t, db, 2171, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2172, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2171).Update("settings", `{"retry_budget":1}`).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}

	selected, group, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "vip", group)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, selected.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, selected.GetOtherSettings())
	assert.Equal(t, 1, common.GetContextKeyInt(ctx, constant.ContextKeyAutoGroupIndex))
	param.IncreaseRetry()
	assert.Zero(t, param.GetRetry())
	selected, group, err = CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, selected)
	assert.Equal(t, "default", group)
}

func TestChannelRetryBudgetKeepsSelectedChannelWithinGroupBudget(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 3
	const modelName = "retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2201, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2202, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2201).Updates(map[string]any{
		"priority": 10, "settings": `{"retry_budget":2}`,
	}).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2201).Update("priority", 10).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2202).Update("priority", 5).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2202).Update("priority", 5).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName}
	var selected []int
	for attempt := 0; attempt <= common.RetryTimes; attempt++ {
		channel, group, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, channel)
		assert.Equal(t, "default", group)
		selected = append(selected, channel.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelId, channel.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
		if attempt < common.RetryTimes {
			param.IncreaseRetry()
		}
	}
	assert.Equal(t, []int{2201, 2201, 2201, 2202}, selected)
	assert.Equal(t, 3, param.GetRetry())

	var settings dto.ChannelOtherSettings
	require.NoError(t, common.Unmarshal([]byte(`{"retry_budget":2}`), &settings))
	assert.Equal(t, 2, settings.RetryBudget)
}

func TestChannelRetryBudgetUsesCurrentCachedSettings(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "updated-retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2211, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2212, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2211).Updates(map[string]any{
		"priority": 10, "settings": `{"retry_budget":2}`,
	}).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2211).Update("priority", 10).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2212).Update("priority", 5).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2212).Update("priority", 5).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName}
	first, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2211, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, first.GetOtherSettings())

	param.IncreaseRetry()
	second, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2211, second.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, second.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, second.GetOtherSettings())

	// The in-flight request retains the initial context snapshot, while channel edits refresh the cache.
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2211).Update("settings", `{"retry_budget":1}`).Error)
	model.InitChannelCache()

	param.IncreaseRetry()
	third, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, third)
	assert.Equal(t, 2212, third.Id, "the updated cached budget must stop reusing the channel")
}

func TestChannelRetryBudgetZeroKeepsPrioritySequence(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "zero-retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2251, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2252, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2251).Update("priority", 10).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2251).Update("priority", 10).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2252).Update("priority", 5).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2252).Update("priority", 5).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName}
	var selected []int
	for attempt := 0; attempt <= common.RetryTimes; attempt++ {
		channel, _, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, channel)
		selected = append(selected, channel.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelId, channel.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
		if attempt < common.RetryTimes {
			param.IncreaseRetry()
		}
	}
	assert.Equal(t, []int{2251, 2252, 2252}, selected)
}

func TestChannelRetryBudgetStartsWithMiddlewareSelectedChannel(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "middleware-retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2301, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2302, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2301).Update("settings", `{"retry_budget":5}`).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2301).Update("weight", 0).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2301).Update("weight", 0).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	channel, err := model.CacheGetChannel(2301)
	require.NoError(t, err)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, channel.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, channel.GetOtherSettings())
	param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName}
	for attempt := 1; attempt <= common.RetryTimes; attempt++ {
		param.IncreaseRetry()
		selected, _, selectErr := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, selectErr)
		require.NotNil(t, selected)
		assert.Equal(t, 2301, selected.Id)
		assert.Equal(t, attempt, param.GetRetry())
	}
}

func TestChannelRetryBudgetSwitchesAutoGroupAfterLastAttempt(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "auto-retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2401, "vip", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2402, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2401).Update("settings", `{"retry_budget":1}`).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	common.SetContextKey(ctx, constant.ContextKeyUserGroup, "default")
	common.SetContextKey(ctx, constant.ContextKeyTokenAutoGroups, []string{"vip", "default"})
	common.SetContextKey(ctx, constant.ContextKeyTokenCrossGroupRetry, true)
	param := &RetryParam{Ctx: ctx, TokenGroup: "auto", ModelName: modelName}
	var channelIDs, retryIndexes []int
	for range 4 {
		retryIndexes = append(retryIndexes, param.GetRetry())
		selected, _, err := CacheGetRandomSatisfiedChannel(param)
		require.NoError(t, err)
		require.NotNil(t, selected)
		channelIDs = append(channelIDs, selected.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelId, selected.Id)
		common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, selected.GetOtherSettings())
		if len(channelIDs) == 3 {
			require.Equal(t, 1, common.GetContextKeyInt(ctx, constant.ContextKeyAutoGroupIndex), "the original selector prepares the next group on the last attempt")
			require.Zero(t, param.GetRetry(), "the next group starts its own retry count")
		}
		param.IncreaseRetry()
	}
	assert.Equal(t, []int{2401, 2401, 2401, 2402}, channelIDs)
	assert.Equal(t, []int{0, 1, 2, 0}, retryIndexes)
}

func TestChannelRetryBudgetFallsBackWhenCurrentChannelIsDisabled(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	common.RetryTimes = 2
	const modelName = "disabled-retry-budget-model"
	createChannelSelectAutoGroupsChannel(t, db, 2501, "default", modelName)
	createChannelSelectAutoGroupsChannel(t, db, 2502, "default", modelName)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2501).Updates(map[string]any{
		"priority": 10, "settings": `{"retry_budget":2}`,
	}).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2501).Update("priority", 10).Error)
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2502).Update("priority", 5).Error)
	require.NoError(t, db.Model(&model.Ability{}).Where("channel_id = ?", 2502).Update("priority", 5).Error)
	model.InitChannelCache()

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := &RetryParam{Ctx: ctx, TokenGroup: "default", ModelName: modelName}
	first, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 2501, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelId, first.Id)
	common.SetContextKey(ctx, constant.ContextKeyChannelOtherSetting, first.GetOtherSettings())
	param.IncreaseRetry()
	require.NoError(t, db.Model(&model.Channel{}).Where("id = ?", 2501).Update("status", common.ChannelStatusManuallyDisabled).Error)
	model.InitChannelCache()

	second, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 2502, second.Id)
	assert.Equal(t, 1, param.GetRetry())
}
