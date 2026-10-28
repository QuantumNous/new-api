package service

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// Regression tests for issue #8063: a retry that follows a failed channel
// must skip the channels already attempted in this request, and the first
// retry after a session-affinity attempt must restart from the highest
// priority tier instead of tier index 1.

const channelSelectRetryModel = "retry-tier-model"

func setupChannelSelectRetryTest(t *testing.T) *gorm.DB {
	t.Helper()

	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true

	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
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

func createChannelSelectRetryChannel(t *testing.T, db *gorm.DB, id int, group, modelName string, priority int64, weight uint) {
	t.Helper()
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

// seedChannelSelectRetryTiers mirrors the topology of issue #8063: priority 4
// carries channels 24/26/28 weighted 3:3:6 and priority 3 carries 25/27/29.
func seedChannelSelectRetryTiers(t *testing.T, db *gorm.DB) {
	t.Helper()
	for _, ch := range []struct {
		id       int
		priority int64
		weight   uint
	}{
		{24, 4, 3}, {26, 4, 3}, {28, 4, 6},
		{25, 3, 1}, {27, 3, 1}, {29, 3, 1},
	} {
		createChannelSelectRetryChannel(t, db, ch.id, "default", channelSelectRetryModel, ch.priority, ch.weight)
	}
	model.InitChannelCache()
}

func newChannelSelectRetryContext(t *testing.T, usedChannels []string) *gin.Context {
	t.Helper()
	gin.SetMode(gin.TestMode)
	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	if len(usedChannels) > 0 {
		ctx.Set("use_channel", usedChannels)
	}
	return ctx
}

func newChannelSelectRetryParam(ctx *gin.Context, retry int) *RetryParam {
	return &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   channelSelectRetryModel,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	}
}

func TestCacheGetRandomSatisfiedChannelExcludesTriedChannel(t *testing.T) {
	db := setupChannelSelectRetryTest(t)
	seedChannelSelectRetryTiers(t, db)

	ctx := newChannelSelectRetryContext(t, []string{"24"})
	channel, _, err := CacheGetRandomSatisfiedChannel(newChannelSelectRetryParam(ctx, 0))
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.EqualValues(t, 4, channel.GetPriority(), "the first attempt still uses the top priority tier")
	assert.Contains(t, []int{26, 28}, channel.Id, "an already tried channel must not be selected again")
}

func TestCacheGetRandomSatisfiedChannelRestoresTopTierAfterAffinityRetry(t *testing.T) {
	db := setupChannelSelectRetryTest(t)
	seedChannelSelectRetryTiers(t, db)

	// The session-affinity attempt landed on channel 27 (priority 3) and
	// failed; the retry must restart from the highest priority tier and skip 27.
	ctx := newChannelSelectRetryContext(t, []string{"27"})
	common.SetContextKey(ctx, constant.ContextKeyChannelAffinityAttempted, true)
	channel, _, err := CacheGetRandomSatisfiedChannel(newChannelSelectRetryParam(ctx, 1))
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.EqualValues(t, 4, channel.GetPriority(), "retry after a failed affinity attempt must restart from the top tier")
	assert.NotEqual(t, 27, channel.Id)

	// Without affinity the retry ladder is unchanged: retry 1 targets the
	// second priority tier.
	plainCtx := newChannelSelectRetryContext(t, []string{"27"})
	channel, _, err = CacheGetRandomSatisfiedChannel(newChannelSelectRetryParam(plainCtx, 1))
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.EqualValues(t, 3, channel.GetPriority())
}

func TestCacheGetRandomSatisfiedChannelSkipsExhaustedTiers(t *testing.T) {
	db := setupChannelSelectRetryTest(t)
	seedChannelSelectRetryTiers(t, db)

	// Priority 3 is exhausted by this request; the retry index would clamp
	// into it, so selection must fall back to the still-populated top tier
	// instead of re-rolling an already tried channel.
	ctx := newChannelSelectRetryContext(t, []string{"25", "27", "29"})
	channel, _, err := CacheGetRandomSatisfiedChannel(newChannelSelectRetryParam(ctx, 2))
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.EqualValues(t, 4, channel.GetPriority())
	assert.Contains(t, []int{24, 26, 28}, channel.Id)
}

func TestCacheGetRandomSatisfiedChannelFallsBackWhenAllChannelsTried(t *testing.T) {
	db := setupChannelSelectRetryTest(t)
	seedChannelSelectRetryTiers(t, db)

	// Once every eligible channel was attempted, the request still retries
	// the existing pool instead of failing (transient failures recover on a
	// second attempt, which TestResponsesHTTPHealthCountsFinalResult covers
	// end to end for a single channel).
	ctx := newChannelSelectRetryContext(t, []string{"24", "26", "28", "25", "27", "29"})
	channel, _, err := CacheGetRandomSatisfiedChannel(newChannelSelectRetryParam(ctx, 0))
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Contains(t, []int{24, 26, 28, 25, 27, 29}, channel.Id)

	// A single-channel group retries that channel.
	const singleModel = "retry-single-model"
	createChannelSelectRetryChannel(t, db, 30, "default", singleModel, 7, 1)
	model.InitChannelCache()
	singleCtx := newChannelSelectRetryContext(t, []string{"30"})
	retry := 0
	channel, _, err = CacheGetRandomSatisfiedChannel(&RetryParam{
		Ctx:         singleCtx,
		TokenGroup:  "default",
		ModelName:   singleModel,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	})
	require.NoError(t, err)
	require.NotNil(t, channel)
	assert.Equal(t, 30, channel.Id)
}

func TestSelectChannelForRequestMarksAffinityAttempt(t *testing.T) {
	db := setupChannelSelectRetryTest(t)
	const modelName = "affinity-flag-model"
	createChannelSelectRetryChannel(t, db, 27, "default", modelName, 3, 1)
	model.InitChannelCache()

	rule := operation_setting.ChannelAffinityRule{
		Name:       "retry-flag-affinity",
		ModelRegex: []string{"^affinity-flag-.*$"},
		KeySources: []operation_setting.ChannelAffinityKeySource{
			{Type: "request_header", Key: "X-Affinity-Key"},
		},
	}
	affinityValue := fmt.Sprintf("retry-flag-%d", time.Now().UnixNano())
	cacheKeySuffix := buildChannelAffinityCacheKeySuffix(rule, modelName, "default", affinityValue)
	cache := getChannelAffinityCache()
	require.NoError(t, cache.SetWithTTL(cacheKeySuffix, 27, time.Minute))
	t.Cleanup(func() {
		_, _ = cache.DeleteMany([]string{cacheKeySuffix})
	})

	setting := operation_setting.GetChannelAffinitySetting()
	originalRules := setting.Rules
	setting.Rules = append([]operation_setting.ChannelAffinityRule{rule}, originalRules...)
	t.Cleanup(func() {
		setting.Rules = originalRules
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	ctx.Request.Header.Set("X-Affinity-Key", affinityValue)

	retry := 0
	channel, selectGroup, selectErr := SelectChannelForRequest(ctx, modelName, &RetryParam{
		Ctx:         ctx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &retry,
	})
	require.Nil(t, selectErr)
	require.NotNil(t, channel)
	assert.Equal(t, 27, channel.Id)
	assert.Equal(t, "default", selectGroup)
	assert.True(t, common.GetContextKeyBool(ctx, constant.ContextKeyChannelAffinityAttempted),
		"an affinity-served first attempt must be marked so retries restart from the top priority tier")

	plainCtx, _ := gin.CreateTestContext(httptest.NewRecorder())
	plainCtx.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)
	plainRetry := 0
	plainChannel, _, plainErr := SelectChannelForRequest(plainCtx, modelName, &RetryParam{
		Ctx:         plainCtx,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       &plainRetry,
	})
	require.Nil(t, plainErr)
	require.NotNil(t, plainChannel)
	assert.False(t, common.GetContextKeyBool(plainCtx, constant.ContextKeyChannelAffinityAttempted),
		"a plain random selection must not consume the affinity tier adjustment")
}
