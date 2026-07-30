package openai

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCollectStreamFunctionCallNamesDeduplicatesDeltaFragments(t *testing.T) {
	seen := make(map[string]struct{})
	var names []string
	collectStreamFunctionCallNames(`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"paid_lookup","arguments":"{"}}]}}]}`, seen, &names)
	collectStreamFunctionCallNames(`{"choices":[{"index":0,"delta":{"tool_calls":[{"index":0,"function":{"name":"paid_lookup","arguments":"}"}},{"index":1,"function":{"name":"other_lookup","arguments":"{}"}}]}}]}`, seen, &names)

	assert.Equal(t, []string{"paid_lookup", "other_lookup"}, names)
}

func TestOaiResponsesHandlerBillsCompletedOutputsNotToolDeclarations(t *testing.T) {
	operation_setting.LoadToolPricesFromJSONString(`{"paid_lookup":3}`)
	t.Cleanup(func() { operation_setting.LoadToolPricesFromJSONString(`{}`) })

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	responseBody := `{
		"status":"completed",
		"tools":[{"type":"web_search"},{"type":"function","name":"declared_only"}],
		"output":[
			{"id":"web-1","type":"web_search_call","status":"completed"},
			{"id":"web-failed","type":"web_search_call","status":"failed"},
			{"id":"function-1","type":"function_call","name":"paid_lookup","status":"completed"},
			{"id":"function-incomplete","type":"function_call","name":"paid_lookup","status":"incomplete"},
			{"id":"image-1","type":"image_generation_call","status":"completed","result":"image-data","quality":"low","size":"1024x1024"},
			{"id":"image-2","type":"image_generation_call","status":"failed","result":"failed-image-data"}
		],
		"usage":{"input_tokens":0,"output_tokens":0,"total_tokens":0}
	}`
	info := &relaycommon.RelayInfo{
		OriginModelName: "gpt-test",
		ResponsesUsageInfo: &relaycommon.ResponsesUsageInfo{BuiltInTools: map[string]*relaycommon.BuildInToolInfo{
			dto.BuildInToolWebSearch: {ToolName: dto.BuildInToolWebSearch},
		}},
	}

	usage, apiErr := OaiResponsesHandler(c, info, &http.Response{
		StatusCode: http.StatusOK,
		Header:     http.Header{"Content-Type": []string{"application/json"}},
		Body:       io.NopCloser(strings.NewReader(responseBody)),
	})

	require.Nil(t, apiErr)
	require.NotNil(t, usage)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolWebSearch].CallCount)
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools["paid_lookup"].CallCount)
	assert.NotContains(t, info.ResponsesUsageInfo.BuiltInTools, "declared_only")
	assert.Equal(t, 1, info.ResponsesUsageInfo.BuiltInTools[dto.BuildInToolImageGeneration].CallCount)
	assert.True(t, c.GetBool("image_generation_call"))
	assert.Equal(t, 1, c.GetInt("image_generation_call_count"))
}
