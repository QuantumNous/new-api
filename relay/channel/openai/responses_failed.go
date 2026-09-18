package openai

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/gin-gonic/gin"
)

// hasResponsesFailedStatus 判断 Responses 状态是否精确为 failed
func hasResponsesFailedStatus(status []byte) bool {
	return string(status) == `"failed"`
}

// newResponsesFailedError 按 Responses 标准结构记录上游错误并禁止重试
func newResponsesFailedError(c *gin.Context, response *dto.OpenAIResponsesResponse, statusCode int) *types.NewAPIError {
	errorJSON, _ := common.Marshal(response.Error)
	common.SetContextKey(c, constant.ContextKeyUpstreamResponseError, errorJSON)
	openAIError := response.GetOpenAIError()
	// 完整上游错误仅进入管理员日志，不向客户端透传 metadata
	openAIError.Metadata = nil
	return types.WithOpenAIError(*openAIError, statusCode, types.ErrOptionWithSkipRetry())
}
