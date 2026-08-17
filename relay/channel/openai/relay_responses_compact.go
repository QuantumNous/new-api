package openai

import (
	"fmt"
	"io"
	"net/http"
	"strings"
	"unicode"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

const maxCompactResponseObjectAuditRunes = 128

func compactResponseObjectAuditValue(value string) string {
	value = strings.TrimSpace(value)
	value = strings.Map(func(r rune) rune {
		if unicode.IsControl(r) {
			return -1
		}
		return r
	}, value)
	if value == "" {
		return "<missing>"
	}
	runes := []rune(value)
	if len(runes) > maxCompactResponseObjectAuditRunes {
		return string(runes[:maxCompactResponseObjectAuditRunes]) + "..."
	}
	return value
}

func OaiResponsesCompactionHandler(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	var compactResp dto.OpenAIResponsesCompactionResponse
	if err := common.Unmarshal(responseBody, &compactResp); err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}
	if oaiError := compactResp.GetOpenAIError(); oaiError != nil && oaiError.Type != "" {
		return nil, types.WithOpenAIError(*oaiError, resp.StatusCode)
	}
	if compactResp.Object != "response.compaction" {
		observed := compactResponseObjectAuditValue(compactResp.Object)
		if info != nil {
			info.CompactResponseObject = observed
		}
		logger.LogWarn(c, fmt.Sprintf("compact upstream returned unexpected object: %q", observed))
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	usage := dto.Usage{}
	if compactResp.Usage != nil {
		usage.PromptTokens = compactResp.Usage.InputTokens
		usage.CompletionTokens = compactResp.Usage.OutputTokens
		usage.TotalTokens = compactResp.Usage.TotalTokens
		if compactResp.Usage.InputTokensDetails != nil {
			usage.PromptTokensDetails.CachedTokens = compactResp.Usage.InputTokensDetails.CachedTokens
			usage.PromptTokensDetails.CacheWriteTokens = compactResp.Usage.InputTokensDetails.CacheWriteTokens
		}
	}

	return &usage, nil
}
