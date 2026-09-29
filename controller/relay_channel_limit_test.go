package controller

import (
	"fmt"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	taskdto "github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	relay "github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// relayRpmTestId returns a channel id unique to this process run so the
// in-process RPM window (keyed by channel id) never observes values left by
// a previous run of the test binary (go test -count=2).
var relayRpmTestIdSeq atomic.Int64

func relayRpmTestId() int {
	return int(960700 + relayRpmTestIdSeq.Add(1))
}

// TestGetChannelMovesToNextCandidateAfterRpmRejection covers the retry
// behavior after the strict RPM admission rejects the distributor-selected
// channel: the rejected channel lands in the use_channel trail, so the next
// getChannel iteration must enter candidate selection and return another
// channel instead of rebuilding the same over-limit distributor channel.
func TestGetChannelMovesToNextCandidateAfterRpmRejection(t *testing.T) {
	originalDB := model.DB
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	originalGroupRatios := ratio_setting.GroupRatio2JSONString()

	dsn := fmt.Sprintf("file:%s?mode=memory&cache=shared", strings.ReplaceAll(t.Name(), "/", "_"))
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}))
	model.DB = db
	common.MemoryCacheEnabled = true
	require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(`{"default":1}`))
	t.Cleanup(func() {
		model.DB = originalDB
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
		require.NoError(t, ratio_setting.UpdateGroupRatioByJSONString(originalGroupRatios))
		if originalMemoryCacheEnabled && originalDB != nil &&
			originalDB.Migrator().HasTable(&model.Channel{}) && originalDB.Migrator().HasTable(&model.Ability{}) {
			model.InitChannelCache()
		}
		sqlDB, err := db.DB()
		if err == nil {
			require.NoError(t, sqlDB.Close())
		}
	})

	const modelName = "rpm-rejection-model"
	distributorId := relayRpmTestId()
	fallbackId := relayRpmTestId()
	rpm := int64(1)
	highPriority := int64(0)
	lowPriority := int64(-1)
	weight := uint(100)
	require.NoError(t, db.Create(&model.Channel{
		Id: distributorId, Type: constant.ChannelTypeOpenAI, Key: "sk-a",
		Status: common.ChannelStatusEnabled, Name: "rpm-limited",
		Weight: &weight, Models: modelName, Group: "default",
		Priority: &highPriority, RpmLimit: &rpm,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id: fallbackId, Type: constant.ChannelTypeOpenAI, Key: "sk-b",
		Status: common.ChannelStatusEnabled, Name: "fallback",
		Weight: &weight, Models: modelName, Group: "default",
		Priority: &lowPriority,
	}).Error)
	for _, id := range []int{distributorId, fallbackId} {
		priority := highPriority
		if id == fallbackId {
			priority = lowPriority
		}
		require.NoError(t, db.Create(&model.Ability{
			Group: "default", Model: modelName, ChannelId: id,
			Enabled: true, Priority: &priority, Weight: weight,
		}).Error)
	}
	model.InitChannelCache()

	// Saturate the distributor channel's RPM window through the exported
	// dispatch admission so the first attempt is rejected (limit 1).
	require.True(t, model.ChannelRpmTryConsume(&model.Channel{Id: distributorId, RpmLimit: &rpm}))

	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	common.SetContextKey(c, constant.ContextKeyChannelId, distributorId)
	common.SetContextKey(c, constant.ContextKeyChannelType, constant.ChannelTypeOpenAI)
	common.SetContextKey(c, constant.ContextKeyChannelName, "rpm-limited")
	common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
	common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
	c.Set("auto_ban", false)
	// The distributor registers these filters for every request, including
	// retries.
	constraints := service.GetChannelConstraints(c)
	constraints.AddFilter(taskdto.ChannelFilter{Kind: taskdto.FilterRequestPath, RequestPath: "/v1/chat/completions"})
	constraints.AddFilter(taskdto.ChannelFilter{Kind: taskdto.FilterChannelLimits})

	info := &relaycommon.RelayInfo{OriginModelName: modelName, UsingGroup: "default"}
	retryParam := &service.RetryParam{
		Ctx:         c,
		TokenGroup:  "default",
		ModelName:   modelName,
		RequestPath: "/v1/chat/completions",
		Retry:       common.GetPointer(0),
	}

	first, firstErr := getChannel(c, info, retryParam)
	require.Nil(t, firstErr)
	require.NotNil(t, first)
	assert.Equal(t, distributorId, first.Id, "the first attempt reuses the distributor-selected channel")

	assert.False(t, model.ChannelRpmTryConsume(first), "the saturated channel must reject the dispatch")
	// What the fixed relay loop does on an RPM-rejected attempt.
	service.AppendUsedChannel(c, first.Id)
	retryParam.IncreaseRetry()

	second, secondErr := getChannel(c, info, retryParam)
	require.Nil(t, secondErr)
	require.NotNil(t, second)
	assert.Equal(t, fallbackId, second.Id,
		"after an RPM rejection the next iteration must select another candidate channel")
	assert.Equal(t, []string{fmt.Sprintf("%d", distributorId)}, c.GetStringSlice("use_channel"))
}

// TestExecuteTaskSubmissionStopsOnLockedChannelRpmRejection pins the
// locked-channel contract of the strict RPM admission: the rejection is
// deterministic for the whole retry budget, so the submission stops with the
// 429 limit error instead of re-running setup against the same channel and
// burning every retry attempt.
func TestExecuteTaskSubmissionStopsOnLockedChannelRpmRejection(t *testing.T) {
	originalRetryTimes := common.RetryTimes
	common.RetryTimes = 3
	t.Cleanup(func() { common.RetryTimes = originalRetryTimes })

	rpm := int64(1)
	lockedId := relayRpmTestId()
	// Saturate the locked channel's per-minute window before dispatch.
	require.True(t, model.ChannelRpmTryConsume(&model.Channel{Id: lockedId, RpmLimit: &rpm}))

	events := make([]string, 0, 3)
	billing := &taskSubmissionTestBilling{events: &events}
	c := taskSubmissionTestContext()
	info := taskSubmissionRelayInfo(billing)
	info.TaskRelayInfo.LockedChannel = &model.Channel{
		Id: lockedId, Type: constant.ChannelTypeTaskPlugin, Name: "locked-rpm", RpmLimit: &rpm,
	}
	info.ChannelMeta = &relaycommon.ChannelMeta{ChannelId: lockedId, ChannelType: constant.ChannelTypeTaskPlugin}

	submits := 0
	outcome, taskErr := executeTaskSubmissionWith(c, info, func(*gin.Context, *relaycommon.RelayInfo) (*relay.TaskSubmitResult, *taskdto.TaskError) {
		submits++
		return nil, nil
	})

	assert.Nil(t, outcome)
	require.NotNil(t, taskErr)
	assert.Equal(t, string(model.ChannelLimitExceededCode), taskErr.Code)
	assert.Zero(t, submits, "the deterministic RPM rejection must not reach the submit adaptor")
	assert.Equal(t, []string{"refund"}, events, "the undelivered submission refunds its billing")
	assert.Equal(t, 1, service.RequestPolicy(c).Attempts, "the rejection stops after the first dispatch attempt")
}
