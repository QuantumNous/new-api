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

// MinerUHelper 将 /v1/file_parse（multipart/form-data）请求转发到
// 渠道 base_url + /file_parse，并将上游响应原样透传给客户端。
// 渠道约定：
//   - 本地 MinerU:  base_url = http://mineru-api:8000
//   - 上游 New-API: base_url = https://api.playground.ai.gcable.cc/v1
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

	// multipart 请求体已由 controller.Relay 置为可重放的 BodyStorage，直接透传
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
	if httpResp.StatusCode != http.StatusOK {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	// 原样回传响应（JSON / zip 均透传）
	if contentType := httpResp.Header.Get("Content-Type"); contentType != "" {
		c.Writer.Header().Set("Content-Type", contentType)
	}
	if cd := httpResp.Header.Get("Content-Disposition"); cd != "" {
		c.Writer.Header().Set("Content-Disposition", cd)
	}
	c.Status(http.StatusOK)
	_, _ = io.Copy(c.Writer, httpResp.Body)

	// 按次计费（mineru 为 quota_type=1 按次价格，usage 置零）
	service.PostTextConsumeQuota(c, info, &dto.Usage{}, nil)
	return nil
}
