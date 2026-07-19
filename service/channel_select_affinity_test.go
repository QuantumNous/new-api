package service

import (
	"net/http/httptest"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestNewAffinitySelectsOnlyMeasuredFastChannel(t *testing.T) {
	oldMemoryCacheEnabled := common.MemoryCacheEnabled
	oldHealthEnabled := common.AdaptiveChannelHealthEnabled
	common.MemoryCacheEnabled = true
	common.AdaptiveChannelHealthEnabled = true
	model.ClearChannelCacheForTest()
	t.Cleanup(func() {
		model.ClearChannelCacheForTest()
		common.MemoryCacheEnabled = oldMemoryCacheEnabled
		common.AdaptiveChannelHealthEnabled = oldHealthEnabled
	})

	priority := int64(10)
	weight := uint(0)
	newChannel := func(id int) *model.Channel {
		return &model.Channel{
			Id:       id,
			Status:   common.ChannelStatusEnabled,
			Priority: &priority,
			Weight:   &weight,
		}
	}
	const modelName = "gpt-5.6-sol-new-affinity"
	model.SetChannelCacheForTest(
		map[int]*model.Channel{
			117: newChannel(117),
			141: newChannel(141),
			151: newChannel(151),
		},
		map[string]map[string][]int{
			"default": {modelName: {117, 141, 151}},
		},
	)

	for i := 0; i < 6; i++ {
		model.RecordChannelOutcome(model.ChannelHealthKey{ChannelID: 117, Model: modelName, Path: "/v1/responses"}, model.ChannelOutcome{StatusCode: 200, Latency: 1500 * time.Millisecond})
		model.RecordChannelOutcome(model.ChannelHealthKey{ChannelID: 141, Model: modelName, Path: "/v1/responses"}, model.ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
		model.RecordChannelOutcome(model.ChannelHealthKey{ChannelID: 151, Model: modelName, Path: "/v1/responses"}, model.ChannelOutcome{StatusCode: 200, Latency: 6 * time.Second})
	}

	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	setChannelAffinityContext(ctx, channelAffinityMeta{
		CacheKey:    "new-api:channel_affinity:v1:test-new-affinity",
		TTLSeconds:  3600,
		RuleName:    "codex cli trace",
		ModelName:   modelName,
		RequestPath: "/v1/responses",
	})

	// A slow-channel probe is cheap for an ordinary one-off request, but it is
	// not cheap for a fresh affinity key: one random hit pins the whole active
	// session to that channel for a sliding hour. Once a stable fast peer exists,
	// every new affinity assignment should stay inside the measured-fast set.
	for i := 0; i < 500; i++ {
		retry := 0
		channel, _, err := CacheGetRandomSatisfiedChannel(&RetryParam{
			Ctx:         ctx,
			TokenGroup:  "default",
			ModelName:   modelName,
			RequestPath: "/v1/responses",
			Retry:       &retry,
		})
		require.NoError(t, err)
		require.NotNil(t, channel)
		require.Equal(t, 117, channel.Id, "new affinity was pinned to a measured-slow channel on selection %d", i)
	}
}
