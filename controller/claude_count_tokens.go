package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ClaudeMessagesCountTokens(c *gin.Context) {
	request := &dto.ClaudeRequest{}
	if err := common.UnmarshalBodyReusable(c, request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"type": "error",
			"error": types.ClaudeError{
				Type:    "invalid_request_error",
				Message: err.Error(),
			},
		})
		return
	}
	if request.Messages == nil || len(request.Messages) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"type": "error",
			"error": types.ClaudeError{
				Type:    "invalid_request_error",
				Message: "field messages is required",
			},
		})
		return
	}
	if request.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"type": "error",
			"error": types.ClaudeError{
				Type:    "invalid_request_error",
				Message: "field model is required",
			},
		})
		return
	}

	common.SetContextKey(c, constant.ContextKeyOriginalModel, request.Model)
	count, err := service.EstimateRequestTokenAlways(c, request.GetTokenCountMeta(), &relaycommon.RelayInfo{
		RelayFormat: types.RelayFormatClaude,
		IsStream:    false,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"type": "error",
			"error": types.ClaudeError{
				Type:    "api_error",
				Message: err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{"input_tokens": count})
}
