package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// PassthroughHelperWithUsage 传透模式处理器（带 usage 提取）
// 直接将请求转发到上游服务商，不做额外处理或转换
// 从响应中提取 usage 信息用于精确计费
func PassthroughHelperWithUsage(c *gin.Context, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	info.InitChannelMeta(c)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return nil, types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// 直接获取原始请求体，不做任何转换
	body, err := common.GetRequestBody(c)
	if err != nil {
		return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	if common.DebugEnabled {
		logger.LogDebug(c, fmt.Sprintf("passthrough request body: %s", string(body)))
	}

	requestBody := bytes.NewBuffer(body)

	// 发送请求到上游
	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		// 检测是否为流式响应
		info.IsStream = info.IsStream || strings.HasPrefix(httpResp.Header.Get("Content-Type"), "text/event-stream")

		if httpResp.StatusCode != http.StatusOK {
			newApiErr := service.RelayErrorHandler(c.Request.Context(), httpResp, false)
			return nil, newApiErr
		}
	}

	// 透传响应并提取 usage
	return passthroughResponseWithUsage(c, httpResp, info)
}

// PassthroughHelper 传透模式处理器（兼容旧接口）
func PassthroughHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	_, err := PassthroughHelperWithUsage(c, info)
	return err
}

// passthroughResponseWithUsage 透传响应并提取 usage 信息
func passthroughResponseWithUsage(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	if resp == nil || resp.Body == nil {
		return nil, types.NewOpenAIError(fmt.Errorf("invalid response"), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	defer service.CloseResponseBodyGracefully(resp)

	// 复制响应头
	for key, values := range resp.Header {
		for _, value := range values {
			c.Writer.Header().Add(key, value)
		}
	}

	if info.IsStream {
		// 流式响应透传，同时收集数据提取 usage
		return passthroughStreamResponseWithUsage(c, resp, info)
	}

	// 非流式响应透传
	return passthroughNonStreamResponseWithUsage(c, resp, info)
}

// passthroughStreamResponseWithUsage 流式响应透传（带 usage 提取）
func passthroughStreamResponseWithUsage(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	helper.SetEventStreamHeaders(c)

	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		logger.LogWarn(c, "streaming not supported, falling back to buffered response")
		responseBody, err := io.ReadAll(resp.Body)
		if err != nil {
			return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
		}
		c.Writer.Write(responseBody)
		return extractUsageFromStreamData(responseBody), nil
	}

	// 收集所有流数据用于提取 usage
	var allData bytes.Buffer
	buffer := make([]byte, 4096)
	for {
		n, err := resp.Body.Read(buffer)
		if n > 0 {
			info.SetFirstResponseTime()
			// 写入客户端
			if _, writeErr := c.Writer.Write(buffer[:n]); writeErr != nil {
				logger.LogError(c, "passthrough stream write error: "+writeErr.Error())
				break
			}
			flusher.Flush()
			// 同时收集数据
			allData.Write(buffer[:n])
		}
		if err != nil {
			if err != io.EOF {
				logger.LogError(c, "passthrough stream read error: "+err.Error())
			}
			break
		}
	}

	// 从流数据中提取 usage
	usage := extractUsageFromStreamData(allData.Bytes())
	return usage, nil
}

// passthroughNonStreamResponseWithUsage 非流式响应透传（带 usage 提取）
func passthroughNonStreamResponseWithUsage(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (*dto.Usage, *types.NewAPIError) {
	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, types.NewOpenAIError(err, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	info.SetFirstResponseTime()

	if common.DebugEnabled {
		logger.LogDebug(c, fmt.Sprintf("passthrough response body: %s", string(responseBody)))
	}

	service.IOCopyBytesGracefully(c, resp, responseBody)

	// 提取 usage
	usage := GetPassthroughUsage(responseBody, info)
	return usage, nil
}

// extractUsageFromStreamData 从流式数据中提取 usage 信息
func extractUsageFromStreamData(data []byte) *dto.Usage {
	// 流式响应的最后一个数据块通常包含 usage 信息
	// 格式: data: {"id":"...","usage":{"prompt_tokens":10,"completion_tokens":20,...}}
	lines := bytes.Split(data, []byte("\n"))
	for i := len(lines) - 1; i >= 0; i-- {
		line := bytes.TrimSpace(lines[i])
		if bytes.HasPrefix(line, []byte("data: ")) {
			jsonData := bytes.TrimPrefix(line, []byte("data: "))
			if bytes.Equal(jsonData, []byte("[DONE]")) {
				continue
			}
			var streamResp struct {
				Usage *dto.Usage `json:"usage"`
			}
			if err := common.Unmarshal(jsonData, &streamResp); err == nil && streamResp.Usage != nil {
				return streamResp.Usage
			}
		}
	}
	return nil
}

// passthroughResponse 直接透传上游响应到客户端（兼容旧接口）
func passthroughResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
	_, err := passthroughResponseWithUsage(c, resp, info)
	return err
}

// passthroughStreamResponse 流式响应透传（兼容旧接口）
func passthroughStreamResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
	_, err := passthroughStreamResponseWithUsage(c, resp, info)
	return err
}

// passthroughNonStreamResponse 非流式响应透传（兼容旧接口）
func passthroughNonStreamResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) *types.NewAPIError {
	_, err := passthroughNonStreamResponseWithUsage(c, resp, info)
	return err
}

// GetPassthroughUsage 从响应中提取 usage 信息（用于计费）
// 如果无法提取，返回基于预估 token 的 usage
func GetPassthroughUsage(responseBody []byte, info *relaycommon.RelayInfo) *dto.Usage {
	var simpleResponse struct {
		Usage *dto.Usage `json:"usage"`
	}

	if err := common.Unmarshal(responseBody, &simpleResponse); err == nil && simpleResponse.Usage != nil {
		return simpleResponse.Usage
	}

	// 无法提取 usage，返回基于预估的 usage
	return &dto.Usage{
		PromptTokens:     info.GetEstimatePromptTokens(),
		CompletionTokens: 0,
		TotalTokens:      info.GetEstimatePromptTokens(),
	}
}

// DoPassthroughRequest 执行传透请求（供外部调用）
func DoPassthroughRequest(adaptor channel.Adaptor, c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (*http.Response, error) {
	return channel.DoApiRequest(adaptor, c, info, requestBody)
}

