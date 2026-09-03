package relay

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestOptInSafeToolLossRejectedAsBadRequestWithAdminDiagnostics(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/chat/completions", nil)

	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-4o",
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "gpt-4o",
			ChannelOtherSettings: dto.ChannelOtherSettings{
				ToolLossPolicy: string(types.ConversionLossPolicySafe),
			},
		},
	}

	tools, err := common.Marshal([]map[string]any{{"codeExecution": map[string]any{}}})
	require.NoError(t, err)
	req := &dto.GeminiChatRequest{
		Contents: []dto.GeminiChatContent{
			{Role: "user", Parts: []dto.GeminiPart{{Text: "run this"}}},
		},
		Tools: tools,
	}

	result, convErr := service.ConvertRequest(c, info, types.RelayFormatOpenAI, req)
	require.Error(t, convErr)
	var loss *types.ConversionLossError
	require.ErrorAs(t, convErr, &loss)
	require.NotEmpty(t, loss.Diagnostics)
	require.NotNil(t, result)

	apiErr := newConvertRequestFailedError(c, info, convErr)
	require.NotNil(t, apiErr)
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeConvertRequestFailed, apiErr.GetErrorCode())
	assert.True(t, types.IsSkipRetryError(apiErr))

	diagnostics := info.ConversionDiagnostics()
	require.NotEmpty(t, diagnostics)
	assert.True(t, hasHostDiagnosticCode(diagnostics, "unsupported_hosted_tool"))

	other := service.GenerateTextOtherInfo(c, info, 1, 1, 1, 0, 0, 0, 1)
	adminInfo, ok := other.Snapshot()["admin_info"].(map[string]interface{})
	require.True(t, ok)
	require.Contains(t, adminInfo, "conversion_diagnostics")
}

func hasHostDiagnosticCode(diagnostics []types.ConversionDiagnostic, code string) bool {
	for _, diagnostic := range diagnostics {
		if diagnostic.Code == code {
			return true
		}
	}
	return false
}
