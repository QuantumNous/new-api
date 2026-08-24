package relay

import (
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ElevenLabsHelper proxies ElevenLabs' native voice/SFX endpoints. The channel
// (and its upstream key) was already selected by the Distribute middleware from the
// path-resolved model; here we forward the body verbatim through the ElevenLabs
// adaptor (which swaps in the xi-api-key), stream the audio back, and settle the
// per-model quota. Billing units (chars for TTS, seconds for SFX) were computed
// in GetAndValidElevenLabsRequest and are applied as the estimate below.
func ElevenLabsHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)

	if req, ok := info.Request.(*dto.ElevenLabsRequest); ok {
		info.SetEstimatePromptTokens(req.BillTokens)
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// Forward the original request body verbatim (GET /v1/voices carries none).
	// Default to a non-nil empty body: DoApiRequest calls req.Body.Close(), which
	// nil-panics when http.NewRequest is given a nil body (bodyless GET).
	var reader io.Reader = strings.NewReader("")
	if c.Request.Body != nil && c.Request.ContentLength != 0 {
		body, err := common.GetRequestBody(c)
		if err != nil {
			return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		if body != nil {
			if _, err := body.Seek(0, io.SeekStart); err != nil {
				return types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
			}
			if r, ok := body.(io.Reader); ok {
				reader = r
			}
		}
	}

	resp, err := adaptor.DoRequest(c, info, reader)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	statusCodeMappingStr := c.GetString("status_code_mapping")
	httpResp, _ := resp.(*http.Response)
	if httpResp != nil && httpResp.StatusCode != http.StatusOK {
		newAPIError := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, info)
	if newAPIError != nil {
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	// The voices list is not billed (0 units); TTS/SFX settle the per-model quota.
	if u, ok := usage.(*dto.Usage); ok && u.PromptTokens > 0 {
		service.PostTextConsumeQuota(c, info, u, nil)
	}
	return nil
}
