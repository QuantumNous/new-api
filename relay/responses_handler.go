package relay

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/setting"
	"one-api/setting/model_setting"
	"strings"

	"github.com/gin-gonic/gin"
)

func getAndValidateResponsesRequest(c *gin.Context) (*dto.OpenAIResponsesRequest, error) {
	request := &dto.OpenAIResponsesRequest{}
	err := common.UnmarshalBodyReusable(c, request)
	if err != nil {
		return nil, err
	}
	if request.Model == "" {
		return nil, errors.New("model is required")
	}
	if len(request.Input) == 0 {
		return nil, errors.New("input is required")
	}
	return request, nil

}

func checkInputSensitive(textRequest *dto.OpenAIResponsesRequest, info *relaycommon.RelayInfo) ([]string, error) {
	sensitiveWords, err := service.CheckSensitiveInput(textRequest.Input)
	return sensitiveWords, err
}

func getInputTokens(req *dto.OpenAIResponsesRequest, info *relaycommon.RelayInfo) int {
	inputTokens := service.CountTokenInput(req.Input, req.Model)
	info.PromptTokens = inputTokens
	return inputTokens
}

func ResponsesHelper(c *gin.Context) (openaiErr *dto.OpenAIErrorWithStatusCode) {
	req, err := getAndValidateResponsesRequest(c)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidateResponsesRequest error: %s", err.Error()))
		return service.OpenAIErrorWrapperLocal(err, "invalid_responses_request", http.StatusBadRequest)
	}

	relayInfo := relaycommon.GenRelayInfoResponses(c, req)

	if setting.ShouldCheckPromptSensitive() {
		sensitiveWords, err := checkInputSensitive(req, relayInfo)
		if err != nil {
			common.LogWarn(c, fmt.Sprintf("user sensitive words detected: %s", strings.Join(sensitiveWords, ", ")))
			return service.OpenAIErrorWrapperLocal(err, "check_request_sensitive_error", http.StatusBadRequest)
		}
	}

	err = helper.ModelMappedHelper(c, relayInfo, req)
	if err != nil {
		return service.OpenAIErrorWrapperLocal(err, "model_mapped_error", http.StatusBadRequest)
	}

	if value, exists := c.Get("prompt_tokens"); exists {
		promptTokens := value.(int)
		relayInfo.SetPromptTokens(promptTokens)
	} else {
		promptTokens := getInputTokens(req, relayInfo)
		c.Set("prompt_tokens", promptTokens)
	}

	priceData, err := helper.ModelPriceHelper(c, relayInfo, relayInfo.PromptTokens, int(req.MaxOutputTokens))
	if err != nil {
		return service.OpenAIErrorWrapperLocal(err, "model_price_error", http.StatusInternalServerError)
	}
	// pre consume quota
	preConsumedQuota, userQuota, openaiErr := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if openaiErr != nil {
		return openaiErr
	}
	defer func() {
		if openaiErr != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()
	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return service.OpenAIErrorWrapperLocal(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), "invalid_api_type", http.StatusBadRequest)
	}
	adaptor.Init(relayInfo)
	var requestBody io.Reader
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled {
		body, err := common.GetRequestBody(c)
		if err != nil {
			return service.OpenAIErrorWrapperLocal(err, "get_request_body_error", http.StatusInternalServerError)
		}
		requestBody = bytes.NewBuffer(body)
	} else {
		convertedRequest, err := adaptor.ConvertOpenAIResponsesRequest(c, relayInfo, *req)
		if err != nil {
			return service.OpenAIErrorWrapperLocal(err, "convert_request_error", http.StatusBadRequest)
		}
		jsonData, err := json.Marshal(convertedRequest)
		if err != nil {
			return service.OpenAIErrorWrapperLocal(err, "marshal_request_error", http.StatusInternalServerError)
		}
		// apply param override
		if len(relayInfo.ParamOverride) > 0 {
			reqMap := make(map[string]interface{})
			err = json.Unmarshal(jsonData, &reqMap)
			if err != nil {
				return service.OpenAIErrorWrapperLocal(err, "param_override_unmarshal_failed", http.StatusInternalServerError)
			}
			for key, value := range relayInfo.ParamOverride {
				reqMap[key] = value
			}
			jsonData, err = json.Marshal(reqMap)
			if err != nil {
				return service.OpenAIErrorWrapperLocal(err, "param_override_marshal_failed", http.StatusInternalServerError)
			}
		}

		if common.DebugEnabled {
			println("requestBody: ", string(jsonData))
		}
		requestBody = bytes.NewBuffer(jsonData)
	}

	var httpResp *http.Response
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		return service.OpenAIErrorWrapper(err, "do_request_failed", http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")

	if resp != nil {
		httpResp = resp.(*http.Response)

		if httpResp.StatusCode != http.StatusOK {
			openaiErr = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(openaiErr, statusCodeMappingStr)
			return openaiErr
		}
	}

	usage, openaiErr := adaptor.DoResponse(c, httpResp, relayInfo)
	if openaiErr != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(openaiErr, statusCodeMappingStr)
		return openaiErr
	}

	if strings.HasPrefix(relayInfo.OriginModelName, "gpt-4o-audio") {
		service.PostAudioConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	} else {
		postConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	}
	return nil
}
