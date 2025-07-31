package relay

import (
	"bytes"
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/dto"
	relaycommon "one-api/relay/common"
	"one-api/relay/helper"
	"one-api/service"
	"one-api/types"

	"github.com/gin-gonic/gin"
)

func getRerankPromptToken(rerankRequest dto.RerankRequest) int {
	token := service.CountTokenInput(rerankRequest.Query, rerankRequest.Model)
	for _, document := range rerankRequest.Documents {
		tkm := service.CountTokenInput(document, rerankRequest.Model)
		token += tkm
	}
	return token
}

func RerankHelper(c *gin.Context, relayMode int) (newAPIError *types.NewAPIError) {

	var rerankRequest *dto.RerankRequest
	err := common.UnmarshalBodyReusable(c, &rerankRequest)
	if err != nil {
		common.LogError(c, fmt.Sprintf("getAndValidateTextRequest failed: %s", err.Error()))
		return types.NewError(err, types.ErrorCodeInvalidRequest)
	}

	relayInfo := relaycommon.GenRelayInfoRerank(c, rerankRequest)

	if rerankRequest.Query == "" {
		return types.NewError(fmt.Errorf("query is empty"), types.ErrorCodeInvalidRequest)
	}
	if len(rerankRequest.Documents) == 0 {
		return types.NewError(fmt.Errorf("documents is empty"), types.ErrorCodeInvalidRequest)
	}

	err = helper.ModelMappedHelper(c, relayInfo, rerankRequest)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelModelMappedError)
	}

	promptToken := getRerankPromptToken(*rerankRequest)
	relayInfo.PromptTokens = promptToken

	priceData, err := helper.ModelPriceHelper(c, relayInfo, promptToken, 0)
	if err != nil {
		return types.NewError(err, types.ErrorCodeModelPriceError)
	}
	// pre-consume quota 预消耗配额
	preConsumedQuota, userQuota, newAPIError := preConsumeQuota(c, priceData.ShouldPreConsumedQuota, relayInfo)
	if newAPIError != nil {
		return newAPIError
	}
	defer func() {
		if newAPIError != nil {
			returnPreConsumedQuota(c, relayInfo, userQuota, preConsumedQuota)
		}
	}()

	adaptor := GetAdaptor(relayInfo.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", relayInfo.ApiType), types.ErrorCodeInvalidApiType)
	}
	adaptor.Init(relayInfo)

	convertedRequest, err := adaptor.ConvertRerankRequest(c, relayInfo.RelayMode, *rerankRequest)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed)
	}
	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return types.NewError(err, types.ErrorCodeConvertRequestFailed)
	}
	requestBody := bytes.NewBuffer(jsonData)
	if common.DebugEnabled {
		println(fmt.Sprintf("Rerank request body: %s", requestBody.String()))
	}
	resp, err := adaptor.DoRequest(c, relayInfo, requestBody)
	if err != nil {
		return types.NewOpenAIError(err, types.ErrorCodeDoRequestFailed, http.StatusInternalServerError)
	}

	statusCodeMappingStr := c.GetString("status_code_mapping")
	var httpResp *http.Response
	if resp != nil {
		httpResp = resp.(*http.Response)
		if httpResp.StatusCode != http.StatusOK {
			newAPIError = service.RelayErrorHandler(httpResp, false)
			// reset status code 重置状态码
			service.ResetStatusCode(newAPIError, statusCodeMappingStr)
			return newAPIError
		}
	}

	usage, newAPIError := adaptor.DoResponse(c, httpResp, relayInfo)
	if newAPIError != nil {
		// reset status code 重置状态码
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}
	postConsumeQuota(c, relayInfo, usage.(*dto.Usage), preConsumedQuota, userQuota, priceData, "")
	return nil
}
