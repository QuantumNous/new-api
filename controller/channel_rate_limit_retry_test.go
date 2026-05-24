package controller

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestGetChannelReselectsWhenContextChannelExcluded(t *testing.T) {
	db := setupModelListControllerTestDB(t)
	originalMemoryCacheEnabled := common.MemoryCacheEnabled
	common.MemoryCacheEnabled = false
	t.Cleanup(func() {
		common.MemoryCacheEnabled = originalMemoryCacheEnabled
	})

	ctx, _ := gin.CreateTestContext(httptest.NewRecorder())
	ctx.Set("channel_id", 1)
	ctx.Set("channel_type", constant.ChannelTypeOpenAI)
	ctx.Set("channel_name", "channel-a")
	ctx.Set("auto_ban", true)

	priority := int64(10)
	weight := uint(10)
	baseURL := "https://example.com"
	require.NoError(t, db.Create(&model.Channel{
		Id:       1,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "key-a",
		Status:   common.ChannelStatusEnabled,
		Name:     "channel-a",
		Models:   "gpt-test",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
		BaseURL:  &baseURL,
	}).Error)
	require.NoError(t, db.Create(&model.Channel{
		Id:       2,
		Type:     constant.ChannelTypeOpenAI,
		Key:      "key-b",
		Status:   common.ChannelStatusEnabled,
		Name:     "channel-b",
		Models:   "gpt-test",
		Group:    "default",
		Priority: &priority,
		Weight:   &weight,
		BaseURL:  &baseURL,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-test",
		ChannelId: 1,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)
	require.NoError(t, db.Create(&model.Ability{
		Group:     "default",
		Model:     "gpt-test",
		ChannelId: 2,
		Enabled:   true,
		Priority:  &priority,
		Weight:    weight,
	}).Error)

	retryParam := &service.RetryParam{
		Ctx:        ctx,
		TokenGroup: "default",
		ModelName:  "gpt-test",
		Retry:      common.GetPointer(0),
	}
	retryParam.ExcludeChannel(1)

	relayInfo := &relaycommon.RelayInfo{
		TokenGroup:      "default",
		UserGroup:       "default",
		UsingGroup:      "default",
		OriginModelName: "gpt-test",
	}
	channel, apiErr := getChannel(ctx, relayInfo, retryParam)

	require.Nil(t, apiErr)
	require.NotNil(t, channel)
	require.Equal(t, 2, channel.Id)
	require.Equal(t, 2, ctx.GetInt("channel_id"))
}
