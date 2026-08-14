package helper

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

// ResponseValidationActive reports whether model output validation (empty
// response retry / output blacklist) is enabled. Callers should use it as a
// cheap gate before collecting response text for validation.
func ResponseValidationActive() bool {
	return operation_setting.ResponseValidationActive()
}

// CheckModelOutput validates accumulated model output against the configured
// response rules. text is the accumulated response text (content plus
// reasoning); hasOutput indicates whether the response carries usable output
// (non-empty content or tool calls). It returns a retryable error when the
// response should be treated as a failed upstream response, otherwise nil.
func CheckModelOutput(c *gin.Context, text string, hasOutput bool) *types.NewAPIError {
	if !operation_setting.ResponseValidationActive() {
		return nil
	}
	if keywords := operation_setting.ResponseBlacklistKeywords; len(keywords) > 0 {
		trimmed := strings.TrimSpace(text)
		if trimmed != "" {
			if matched, words := service.AcSearch(strings.ToLower(trimmed), keywords, true); matched {
				logger.LogError(c, fmt.Sprintf("model output matched response blacklist keywords: %s", strings.Join(words, ", ")))
				return types.NewOpenAIError(
					fmt.Errorf("upstream returned blacklisted content as model output"),
					types.ErrorCodeBlacklistedResponse,
					http.StatusBadGateway,
				)
			}
		}
	}
	if !hasOutput && operation_setting.EmptyResponseRetryEnabled {
		return types.NewOpenAIError(
			fmt.Errorf("empty response from upstream: no content and no tool calls"),
			types.ErrorCodeEmptyResponse,
			http.StatusBadGateway,
		)
	}
	return nil
}
