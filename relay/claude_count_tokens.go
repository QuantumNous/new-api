package relay

import (
	"bytes"
	"fmt"
	"io"
	"net/http"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel"
	awsrelay "github.com/QuantumNous/new-api/relay/channel/aws"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

func ClaudeCountTokensHelper(c *gin.Context, info *relaycommon.RelayInfo) *types.NewAPIError {
	info.InitChannelMeta(c)

	if info.ChannelType != constant.ChannelTypeAws {
		return types.NewErrorWithStatusCode(fmt.Errorf("count_tokens only supports AWS Bedrock Claude channels"), types.ErrorCodeInvalidApiType, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	claudeReq, ok := info.Request.(*dto.ClaudeRequest)
	if !ok {
		return types.NewErrorWithStatusCode(fmt.Errorf("invalid request type, expected *dto.ClaudeRequest, got %T", info.Request), types.ErrorCodeInvalidRequest, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
	}

	request, prepareErr := prepareClaudeRequestForUpstream(c, info, claudeReq, false)
	if prepareErr != nil {
		return prepareErr
	}

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	requestBody, buildErr := buildClaudeCountTokensRequestBody(c, info, adaptor, request)
	if buildErr != nil {
		return buildErr
	}

	inputTokens, countErr := awsrelay.CountClaudeTokens(c, info, requestBody)
	if countErr != nil {
		return countErr
	}

	c.JSON(http.StatusOK, gin.H{"input_tokens": inputTokens})
	return nil
}

func buildClaudeCountTokensRequestBody(c *gin.Context, info *relaycommon.RelayInfo, adaptor channel.Adaptor, request *dto.ClaudeRequest) (io.Reader, *types.NewAPIError) {
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, types.NewErrorWithStatusCode(err, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
		}
		return common.ReaderOnly(storage), nil
	}

	convertedRequest, err := adaptor.ConvertClaudeRequest(c, info, request)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	relaycommon.AppendRequestConversionFromRequest(info, convertedRequest)

	jsonData, err := common.Marshal(convertedRequest)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}

	if len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, newAPIErrorFromParamOverride(err)
		}
	}

	if common.DebugEnabled {
		println("countTokensRequestBody: ", string(jsonData))
	}
	return bytes.NewBuffer(jsonData), nil
}
