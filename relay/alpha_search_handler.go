package relay

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

var codexAlphaSearchUnsupportedBodyFields = [...]string{
	// Codex alpha/search is a standalone SearchRequest protocol, not a
	// /v1/responses subrequest. Codex clients and proxy chains may carry these
	// Responses-only fields; ChatGPT alpha/search rejects them as unknown.
	"prompt_cache_key",
	"prompt_cache_retention",
}

func buildCodexAlphaSearchBody(body []byte, model string) ([]byte, error) {
	if len(body) == 0 {
		return body, nil
	}
	var obj map[string]json.RawMessage
	if err := common.Unmarshal(body, &obj); err != nil || obj == nil {
		return body, err
	}

	changed := false
	for _, field := range codexAlphaSearchUnsupportedBodyFields {
		if _, ok := obj[field]; ok {
			delete(obj, field)
			changed = true
		}
	}

	model = strings.TrimSpace(model)
	if _, hasModel := obj["model"]; hasModel && model != "" {
		marshaledModel, err := common.Marshal(model)
		if err != nil {
			return nil, err
		}
		if string(obj["model"]) != string(marshaledModel) {
			obj["model"] = marshaledModel
			changed = true
		}
	}

	if !changed {
		return body, nil
	}
	out, err := common.Marshal(obj)
	if err != nil {
		return nil, err
	}
	return out, nil
}

func alphaSearchRelaySupported(apiType int) bool {
	switch apiType {
	case constant.APITypeOpenAI,
		constant.APITypeOpenRouter,
		constant.APITypeXinference,
		constant.APITypeCodex,
		constant.APITypeAdvancedCustom:
		return true
	default:
		return false
	}
}

func AlphaSearchHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)
	if !alphaSearchRelaySupported(info.ApiType) {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("unsupported endpoint %q for api type %d", "/v1/alpha/search", info.ApiType),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}

	request, ok := info.Request.(*dto.CodexAlphaSearchRequest)
	if !ok {
		return types.NewErrorWithStatusCode(
			fmt.Errorf("invalid request type, expected dto.CodexAlphaSearchRequest, got %T", info.Request),
			types.ErrorCodeInvalidRequest,
			http.StatusBadRequest,
			types.ErrOptionWithSkipRetry(),
		)
	}
	requestCopy := *request
	if err := helper.ModelMappedHelper(c, info, &requestCopy); err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	bodyBytes, err := storage.Bytes()
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}
	outboundBytes, err := buildCodexAlphaSearchBody(bodyBytes, requestCopy.Model)
	if err != nil {
		return types.NewErrorWithStatusCode(err, types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	requestBody, size, closer, err := relaycommon.NewOutboundJSONBody(outboundBytes)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	defer closer.Close()
	info.UpstreamRequestBodySize = size

	resp, err := adaptor.DoRequest(c, info, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}
	httpResp, ok := resp.(*http.Response)
	if !ok || httpResp == nil {
		return types.NewOpenAIError(fmt.Errorf("invalid alpha search response type: %T", resp), types.ErrorCodeBadResponse, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	if httpResp.StatusCode < http.StatusOK || httpResp.StatusCode >= http.StatusMultipleChoices {
		newAPIError = service.RelayErrorHandler(c.Request.Context(), httpResp, false)
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	if _, newAPIError = adaptor.DoResponse(c, httpResp, info); newAPIError != nil {
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	service.PostCodexAlphaSearchConsumeQuota(c, info)
	return nil
}
