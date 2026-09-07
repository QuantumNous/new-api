package middleware

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSetupContextForSelectedChannelConsumesSchedulerKeyIndex(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	channel := &model.Channel{
		Id:  101,
		Key: "key-zero\nkey-one",
		ChannelInfo: model.ChannelInfo{
			IsMultiKey: true,
			MultiKeyStatusList: map[int]int{
				0: common.ChannelStatusEnabled,
				1: common.ChannelStatusEnabled,
			},
		},
	}
	common.SetContextKey(c, constant.ContextKeySchedulerKeyIndex, 1)

	require.Nil(t, SetupContextForSelectedChannel(c, channel, "deepseek-v4-flash"))
	require.Equal(t, "key-one", common.GetContextKeyString(c, constant.ContextKeyChannelKey))
	require.Equal(t, 1, common.GetContextKeyInt(c, constant.ContextKeyChannelMultiKeyIndex))
	if _, ok := common.GetContextKeyType[int](c, constant.ContextKeySchedulerKeyIndex); ok {
		t.Fatal("scheduler key index hint was not consumed")
	}
}

func TestGetModelFromJSONBodyReadsOptionalWorkload(t *testing.T) {
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", bytes.NewBufferString(`{"model":"m","group":"vip","workload":"coding"}`))
	c.Request.Header.Set("Content-Type", "application/json")

	got, err := getModelFromJSONBody(c)
	require.NoError(t, err)
	require.Equal(t, &ModelRequest{Model: "m", Group: "vip", Workload: "coding"}, got)
}
