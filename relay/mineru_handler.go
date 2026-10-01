package relay

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// MinerUHelper forwards /v1/file_parse (multipart/form-data) requests to
// channel base_url + /file_parse and streams the upstream response back to
// the client verbatim. Channel conventions:
//   - Local MinerU:  base_url = http://mineru-api:8000
//   - Upstream API:  base_url = https://gateway.example.com/v1
func MinerUHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	if _, ok := info.Request.(*dto.MinerURequest); !ok {
		return types.NewError(errors.New("invalid request type"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// The multipart body has already been made replayable (BodyStorage) by
	// controller.Relay; forward it as-is.
	resp, err := adaptor.DoRequest(c, info, c.Request.Body)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewError(errors.New("invalid upstream response"), types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer httpResp.Body.Close()

	statusCodeMappingStr := c.GetString("status_code_mapping")
	if httpResp.StatusCode < 200 || httpResp.StatusCode > 299 {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	// Stream the successful response back verbatim (JSON / ZIP alike),
	// preserving the upstream status code.
	if contentType := httpResp.Header.Get("Content-Type"); contentType != "" {
		c.Writer.Header().Set("Content-Type", contentType)
	}
	if cd := httpResp.Header.Get("Content-Disposition"); cd != "" {
		c.Writer.Header().Set("Content-Disposition", cd)
	}
	c.Status(httpResp.StatusCode)
	if _, err := io.Copy(c.Writer, httpResp.Body); err != nil {
		// The 2xx status line is already committed and cannot be replaced;
		// return a non-retryable error so the request is not marked
		// successful and the reserved charge gets refunded on the existing
		// failure path.
		return types.NewError(err, types.ErrorCodeReadResponseBodyFailed, types.ErrOptionWithSkipRetry())
	}

	// Per-call billing (mineru is quota_type=1, priced per call; zero usage).
	service.PostTextConsumeQuota(c, info, &dto.Usage{}, nil)
	return nil
}
