package relay

import (
	"bytes"
	"fmt"
	"github.com/gin-gonic/gin"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/service"
)

// CustomPassHelper 处理CustomPass透传请求
func CustomPassHelper(c *gin.Context) (openaiErr *dto.OpenAIErrorWithStatusCode) {
	// 生成RelayInfo
	relayInfo := relaycommon.GenRelayInfo(c)
	
	// 获取适配器
	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.OpenAIErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)

	// 处理请求体
	var requestBody io.Reader
	if c.Request.Method != "GET" {
		// 对于非GET请求，读取请求体
		bodyBytes, err := common.GetRequestBody(c)
		if err != nil {
			return service.OpenAIErrorWrapperLocal(err, "read_request_body_failed", http.StatusBadRequest)
		}
		requestBody = bytes.NewBuffer(bodyBytes)
	}

	// 执行请求
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}

	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			openaiErr = service.RelayErrorHandler(httpResp, false)
			return openaiErr
		}
	}

	// 处理响应
	_, openaiErr = adaptor.DoResponse(c, httpResp, relayInfo)
	if openaiErr != nil {
		return openaiErr
	}

	return nil
}
