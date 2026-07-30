package claude

import (
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
)

func TestCountClaudeStreamBillableToolsDeduplicatesContentBlock(t *testing.T) {
	operation_setting.LoadToolPricesFromJSONString(`{"paid_lookup":3}`)
	t.Cleanup(func() { operation_setting.LoadToolPricesFromJSONString(`{}`) })
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	info := &relaycommon.RelayInfo{OriginModelName: "claude-test"}
	firstIndex, secondIndex := 0, 1
	first := &dto.ClaudeResponse{Type: "content_block_start", Index: &firstIndex, ContentBlock: &dto.ClaudeMediaMessage{Id: "tool-1", Type: "tool_use", Name: "paid_lookup"}}
	duplicate := &dto.ClaudeResponse{Type: "content_block_start", Index: &firstIndex, ContentBlock: &dto.ClaudeMediaMessage{Id: "tool-1", Type: "tool_use", Name: "paid_lookup"}}
	second := &dto.ClaudeResponse{Type: "content_block_start", Index: &secondIndex, ContentBlock: &dto.ClaudeMediaMessage{Id: "tool-2", Type: "tool_use", Name: "paid_lookup"}}

	countClaudeStreamBillableTools(c, info, first)
	countClaudeStreamBillableTools(c, info, duplicate)
	countClaudeStreamBillableTools(c, info, second)

	assert.Equal(t, 2, info.ResponsesUsageInfo.BuiltInTools["paid_lookup"].CallCount)
}
