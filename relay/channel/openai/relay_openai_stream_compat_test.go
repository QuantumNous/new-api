package openai

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestSendStreamData_VertexWrapsPlainTextChunk(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	info := &relaycommon.RelayInfo{
		OriginModelName: "zai-org/glm-5-maas",
		RelayFormat:     types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeVertexAi,
		},
	}

	err := sendStreamData(ctx, info, "fault filter abort", false, false)
	require.NoError(t, err)

	body := recorder.Body.String()
	require.Contains(t, body, "data: {")
	require.Contains(t, body, `"object":"chat.completion.chunk"`)
	require.Contains(t, body, `"content":"fault filter abort"`)
}

func TestSendStreamData_NonVertexKeepsRawData(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)

	info := &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatOpenAI,
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelType: constant.ChannelTypeOpenAI,
		},
	}

	err := sendStreamData(ctx, info, "fault filter abort", false, false)
	require.NoError(t, err)

	body := recorder.Body.String()
	require.True(t, strings.Contains(body, "data: fault filter abort"))
}

