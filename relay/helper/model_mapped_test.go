package helper

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newResponseModelTestContext() (*gin.Context, *httptest.ResponseRecorder) {
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	return c, recorder
}

func TestModelMappedHelperPublishesResponseModelTarget(t *testing.T) {
	c, _ := newResponseModelTestContext()
	info := &relaycommon.RelayInfo{
		OriginModelName: "deepseek-chat",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-chat",
			ChannelSetting:    dto.ChannelSettings{ResponseModelRewrite: true},
		},
	}

	require.NoError(t, ModelMappedHelper(c, info, nil))
	assert.Equal(t, "deepseek-chat", common.ResponseModelRewriteTarget(c))
}

func TestModelMappedHelperClearsResponseModelTargetWhenDisabled(t *testing.T) {
	c, _ := newResponseModelTestContext()
	common.SetResponseModelRewriteTarget(c, "stale-model")
	info := &relaycommon.RelayInfo{
		OriginModelName: "deepseek-chat",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-chat",
		},
	}

	require.NoError(t, ModelMappedHelper(c, info, nil))
	assert.Empty(t, common.ResponseModelRewriteTarget(c))
}

func TestModelMappedHelperMapsUpstreamModel(t *testing.T) {
	c, _ := newResponseModelTestContext()
	c.Set("model_mapping", `{"deepseek-chat":"deepseek-v4"}`)
	info := &relaycommon.RelayInfo{
		OriginModelName: "deepseek-chat",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-chat",
			ChannelSetting:    dto.ChannelSettings{ResponseModelRewrite: true},
		},
	}

	require.NoError(t, ModelMappedHelper(c, info, nil))
	assert.Equal(t, "deepseek-v4", info.UpstreamModelName)
	assert.Equal(t, "deepseek-chat", common.ResponseModelRewriteTarget(c))
}
