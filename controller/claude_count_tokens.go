package controller

import (
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ClaudeCountTokens implements POST /v1/messages/count_tokens.
//
// The estimate is computed locally — no upstream channel is selected
// and no quota is consumed. This is what makes the endpoint suitable
// for the SDK / CLI to poll before every chat.
func ClaudeCountTokens(c *gin.Context) {
	var req dto.ClaudeRequest
	if err := common.UnmarshalBodyReusable(c, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"type": "error",
			"error": types.ClaudeError{
				Type:    "invalid_request_error",
				Message: "invalid JSON body: " + err.Error(),
			},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"input_tokens": service.EstimateClaudeInputTokens(&req),
	})
}
