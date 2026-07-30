package gemini

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestTrackGeminiCompletedToolsDeduplicatesStreamSnapshots(t *testing.T) {
	operation_setting.LoadToolPricesFromJSONString(`{"paid_lookup":3}`)
	t.Cleanup(func() { operation_setting.LoadToolPricesFromJSONString(`{}`) })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{OriginModelName: "gemini-test"}
	seen := make(map[string]struct{})
	response := &dto.GeminiChatResponse{Candidates: []dto.GeminiChatCandidate{{
		GroundingMetadata: &dto.GeminiGroundingMetadata{WebSearchQueries: []string{"query"}},
		Content: dto.GeminiChatContent{Parts: []dto.GeminiPart{
			{FunctionCall: &dto.FunctionCall{FunctionName: "paid_lookup", Arguments: map[string]interface{}{"q": "one"}}},
			{FunctionCall: &dto.FunctionCall{FunctionName: "paid_lookup", Arguments: map[string]interface{}{"q": "two"}}},
		}},
	}}}

	trackGeminiCompletedTools(c, info, response, seen)
	trackGeminiCompletedTools(c, info, response, seen)

	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolGoogleSearch].CallCount)
	assert.Equal(t, 2, info.ResponsesUsageInfo.BuiltInTools["paid_lookup"].CallCount)
	assert.True(t, c.GetBool("gemini_google_search_call"))
}
