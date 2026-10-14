package service

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	relaytypes "github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestManagedSourceDiversityWithinSamePriority(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, db.AutoMigrate(&model.UpstreamManagedRoute{}))
	const modelName = "gpt-5.4"
	createChannelSelectPriorityChannel(t, db, 62, "default", modelName, 998)
	createChannelSelectPriorityChannel(t, db, 54, "default", modelName, 0)
	createChannelSelectPriorityChannel(t, db, 60, "default", modelName, 0)
	for _, route := range []model.UpstreamManagedRoute{
		{SourceID: 1, ExternalGroupID: "25", Platform: "openai", Protocol: "openai", ChannelID: 62, State: model.UpstreamRouteStateActive},
		{SourceID: 1, ExternalGroupID: "31", Platform: "openai", Protocol: "openai", ChannelID: 54, State: model.UpstreamRouteStateActive},
		{SourceID: 2, ExternalGroupID: "55", Platform: "openai", Protocol: "openai", ChannelID: 60, State: model.UpstreamRouteStateActive},
	} {
		require.NoError(t, db.Create(&route).Error)
	}
	model.InitChannelCache()

	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	param := &RetryParam{
		Ctx:        ctx,
		TokenGroup: "default",
		ModelName:  modelName,
	}

	assert.Equal(t, 2, AdaptiveRetryTimes(param))
	assert.Equal(t, []int64{998, 0, 0}, param.PriorityPath)

	first, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, first)
	assert.Equal(t, 62, first.Id)

	param.IncreaseRetry()
	second, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, second)
	assert.Equal(t, 60, second.Id)

	param.IncreaseRetry()
	third, _, err := CacheGetRandomSatisfiedChannel(param)
	require.NoError(t, err)
	require.NotNil(t, third)
	assert.Equal(t, 54, third.Id)
}

func TestRecordRetryAttemptDeduplicatesChannelAndSourceIDs(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, db.AutoMigrate(&model.UpstreamManagedRoute{}))
	channel := &model.Channel{Id: 62}
	require.NoError(t, db.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "25",
		Platform:        "openai",
		Protocol:        model.UpstreamProtocolOpenAI,
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
	}).Error)
	param := &RetryParam{}

	RecordRetryAttempt(param, channel)
	RecordRetryAttempt(param, channel)

	assert.Equal(t, []int{channel.Id}, param.AttemptedChannelIDs)
	assert.Equal(t, []int64{1}, param.AttemptedSourceIDs)
}

func TestManagedModelUnsupportedDetection(t *testing.T) {
	unsupported := relaytypes.NewOpenAIError(
		errors.New(`Model "gpt-5.4" is not supported by any configured account in this group`),
		relaytypes.ErrorCodeBadResponseStatusCode,
		http.StatusNotFound,
	)
	ordinary := relaytypes.NewOpenAIError(
		errors.New("not found"),
		relaytypes.ErrorCodeBadResponseStatusCode,
		http.StatusNotFound,
	)

	assert.True(t, IsManagedModelUnsupported(unsupported))
	assert.True(t, ShouldRecordManagedRouteFailure(unsupported))
	assert.False(t, IsManagedModelUnsupported(ordinary))
	assert.False(t, ShouldRecordManagedRouteFailure(ordinary))
}

func TestIsolateManagedRouteModelOnlyRemovesFailedModel(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, db.AutoMigrate(
		&model.Option{},
		&model.UpstreamSource{},
		&model.UpstreamGroup{},
		&model.UpstreamManagedRoute{},
	))
	common.OptionMapRWMutex.Lock()
	originalOptionMap := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.OptionMapRWMutex.Lock()
		common.OptionMap = originalOptionMap
		common.OptionMapRWMutex.Unlock()
	})
	originalExclusions, err := json.Marshal(
		operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions,
	)
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, model.UpdateOption(
			managedModelExclusionsOption,
			string(originalExclusions),
		))
	})
	require.NoError(t, model.UpdateOption(
		managedModelExclusionsOption,
		`{"ebond:31":["gpt-existing"]}`,
	))
	priority := int64(998)
	weight := uint(100)
	channel := model.Channel{
		Id:       62,
		Status:   common.ChannelStatusEnabled,
		Name:     "ebond",
		Models:   "gpt-5.4,gpt-5.5",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
	}
	require.NoError(t, db.Create(&channel).Error)
	require.NoError(t, channel.AddAbilities(nil))
	require.NoError(t, db.Create(&model.UpstreamSource{
		ID:         1,
		Key:        "ebond",
		Name:       "eBond",
		ConsoleURL: "https://example.com",
	}).Error)
	group := model.UpstreamGroup{
		SourceID:            1,
		ExternalID:          "25",
		Name:                "GPT Pro",
		Platform:            "openai",
		EffectiveMultiplier: 0.2,
		HealthStatus:        model.UpstreamHealthUnknown,
		Models:              `["gpt-5.4","gpt-5.5"]`,
	}
	require.NoError(t, db.Create(&group).Error)
	require.NoError(t, db.Create(&model.UpstreamManagedRoute{
		SourceID:        1,
		ExternalGroupID: "25",
		Platform:        "openai",
		Protocol:        "openai",
		ChannelID:       channel.Id,
		State:           model.UpstreamRouteStateActive,
	}).Error)
	model.InitChannelCache()

	isolated, err := IsolateManagedRouteModel(
		channel.Id,
		"gpt-5.4",
		"status_code=404, unsupported",
	)
	require.NoError(t, err)
	assert.True(t, isolated)

	var storedChannel model.Channel
	require.NoError(t, db.First(&storedChannel, channel.Id).Error)
	assert.Equal(t, "gpt-5.5", storedChannel.Models)
	var failedAbilityCount int64
	require.NoError(t, db.Model(&model.Ability{}).
		Where("channel_id = ? AND model = ?", channel.Id, "gpt-5.4").
		Count(&failedAbilityCount).Error)
	assert.Zero(t, failedAbilityCount)
	var retainedAbilityCount int64
	require.NoError(t, db.Model(&model.Ability{}).
		Where("channel_id = ? AND model = ?", channel.Id, "gpt-5.5").
		Count(&retainedAbilityCount).Error)
	assert.Equal(t, int64(1), retainedAbilityCount)

	var storedGroup model.UpstreamGroup
	require.NoError(t, db.First(&storedGroup, group.ID).Error)
	assert.Equal(t, `["gpt-5.5"]`, storedGroup.Models)

	var option model.Option
	require.NoError(t, db.First(
		&option,
		"key = ?",
		managedModelExclusionsOption,
	).Error)
	var exclusions map[string][]string
	require.NoError(t, json.Unmarshal([]byte(option.Value), &exclusions))
	assert.Equal(t, []string{"gpt-existing"}, exclusions["ebond:31"])
	assert.Equal(t, []string{"gpt-5.4"}, exclusions["ebond:25"])
	assert.True(t, managedModelExcluded(
		"ebond",
		"25",
		"gpt-5.4",
		"gpt-5.4",
		operation_setting.GetUpstreamOrchestrationSetting().ModelExclusions,
	))
}

func TestManagedModelExclusionSerializesWithFullPolicyWrite(t *testing.T) {
	db := setupChannelSelectAutoGroupsTest(t)
	require.NoError(t, db.AutoMigrate(&model.Option{}, &model.UpstreamSource{}))
	previousType := common.MainDatabaseType()
	common.SetMainDatabaseType(common.DatabaseTypeSQLite)
	previousSetting, err := config.ConfigToMap(
		operation_setting.GetUpstreamOrchestrationSetting(),
	)
	require.NoError(t, err)
	common.OptionMapRWMutex.Lock()
	previousOptions := common.OptionMap
	common.OptionMap = make(map[string]string)
	common.OptionMapRWMutex.Unlock()
	t.Cleanup(func() {
		common.SetMainDatabaseType(previousType)
		updated, restoreErr := config.GlobalConfig.UpdateFromMap(
			"upstream_orchestration",
			previousSetting,
		)
		require.NoError(t, restoreErr)
		require.True(t, updated)
		common.OptionMapRWMutex.Lock()
		common.OptionMap = previousOptions
		common.OptionMapRWMutex.Unlock()
	})
	initial := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"initial"},
		ModelAliases:            map[string]string{"initial": "model"},
		ModelExclusions:         map[string][]string{"source:paid": {"initial-model"}},
		ProtocolModelExclusions: map[string][]string{"openai": {"initial-protocol-model"}},
	}
	require.NoError(t, model.UpdateUpstreamOrchestrationPolicy(initial))
	source := model.UpstreamSource{
		Key: "source", Name: "Source", ConsoleURL: "https://console.example.com",
	}
	require.NoError(t, db.Create(&source).Error)

	uiPolicy := operation_setting.UpstreamRoutingPolicy{
		TargetGroups:            []string{"ui"},
		ModelAliases:            map[string]string{"ui": "model"},
		ModelExclusions:         map[string][]string{"source:paid": {"ui-model"}},
		ProtocolModelExclusions: map[string][]string{"anthropic": {"ui-protocol-model"}},
	}
	uiLocked := make(chan struct{})
	releaseUI := make(chan struct{})
	releaseUIOnce := sync.Once{}
	healthRead := make(chan struct{})
	var uiOnce, healthOnce sync.Once
	releaseUIWriter := func() {
		releaseUIOnce.Do(func() { close(releaseUI) })
	}
	t.Cleanup(releaseUIWriter)
	const callbackName = "test:managed_exclusion_policy_serialization"
	require.NoError(t, db.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if tx.Statement.Table != "options" {
			return
		}
		for _, value := range tx.Statement.Vars {
			key, ok := value.(string)
			if !ok {
				continue
			}
			switch key {
			case "upstream_orchestration.model_aliases":
				uiOnce.Do(func() {
					close(uiLocked)
					<-releaseUI
				})
			case managedModelExclusionsOption:
				healthOnce.Do(func() { close(healthRead) })
			}
		}
	}))
	t.Cleanup(func() {
		require.NoError(t, db.Callback().Query().Remove(callbackName))
	})

	uiDone := make(chan error, 1)
	go func() {
		uiDone <- model.UpdateUpstreamOrchestrationPolicy(uiPolicy)
	}()
	select {
	case <-uiLocked:
	case <-time.After(5 * time.Second):
		t.Fatal("UI policy writer did not reach the transaction barrier")
	}
	healthStarted := make(chan struct{})
	healthDone := make(chan error, 1)
	go func() {
		close(healthStarted)
		_, appendErr := persistManagedModelExclusion(source.ID, "paid", "health-model")
		healthDone <- appendErr
	}()
	select {
	case <-healthStarted:
	case <-time.After(5 * time.Second):
		t.Fatal("health writer did not start")
	}
	select {
	case earlyErr := <-healthDone:
		t.Fatalf("health writer completed before the full policy writer released its lock: %v", earlyErr)
	case <-time.After(250 * time.Millisecond):
	}
	releaseUIWriter()
	require.NoError(t, <-uiDone)
	select {
	case <-healthRead:
	case <-time.After(5 * time.Second):
		t.Fatal("health writer did not reach the persisted policy read after lock release")
	}
	require.NoError(t, <-healthDone)

	var stored model.Option
	require.NoError(t, db.Where("key = ?", managedModelExclusionsOption).First(&stored).Error)
	var exclusions map[string][]string
	require.NoError(t, common.UnmarshalJsonStr(stored.Value, &exclusions))
	assert.Equal(t, []string{"ui-model", "health-model"}, exclusions["source:paid"])
	runtime := operation_setting.GetUpstreamOrchestrationSetting()
	assert.Equal(t, uiPolicy.TargetGroups, runtime.TargetGroups)
	assert.Equal(t, uiPolicy.ModelAliases, runtime.ModelAliases)
	assert.Equal(t, exclusions, runtime.ModelExclusions)
	assert.Equal(t, uiPolicy.ProtocolModelExclusions, runtime.ProtocolModelExclusions)
}
