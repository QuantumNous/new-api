package aws

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	bedrockruntimeTypes "github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/aws/smithy-go/auth/bearer"
)

func newAwsClient(c *gin.Context, info *relaycommon.RelayInfo) (*bedrockruntime.Client, error) {
	awsSecret := strings.Split(info.ApiKey, "|")
	var client *bedrockruntime.Client
	switch len(awsSecret) {
	case 2:
		apiKey := awsSecret[0]
		region := awsSecret[1]
		client = bedrockruntime.New(bedrockruntime.Options{
			Region:                  region,
			BearerAuthTokenProvider: bearer.StaticTokenProvider{Token: bearer.Token{Value: apiKey}},
		})
	case 3:
		ak := awsSecret[0]
		sk := awsSecret[1]
		region := awsSecret[2]
		client = bedrockruntime.New(bedrockruntime.Options{
			Region:      region,
			Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(ak, sk, "")),
		})
	default:
		return nil, errors.New("invalid aws secret key")
	}

	return client, nil
}

func wrapErr(err error) *dto.OpenAIErrorWithStatusCode {
	return &dto.OpenAIErrorWithStatusCode{
		StatusCode: http.StatusInternalServerError,
		Error: dto.OpenAIError{
			Message: fmt.Sprintf("%s", err.Error()),
		},
	}
}

func awsRegionPrefix(awsRegionId string) string {
	parts := strings.Split(awsRegionId, "-")
	regionPrefix := ""
	if len(parts) > 0 {
		regionPrefix = parts[0]
	}
	return regionPrefix
}

func awsModelCanCrossRegion(awsModelId, awsRegionPrefix string) bool {
	regionSet, exists := awsModelCanCrossRegionMap[awsModelId]
	return exists && regionSet[awsRegionPrefix]
}

func awsModelCrossRegion(awsModelId, awsRegionPrefix string) string {
	modelPrefix, find := awsRegionCrossModelPrefixMap[awsRegionPrefix]
	if !find {
		return awsModelId
	}
	return modelPrefix + "." + awsModelId
}

func awsModelID(requestModel string) string {
	if awsModelID, ok := awsModelIDMap[requestModel]; ok {
		return awsModelID
	}

	return requestModel
}

func awsHandler(c *gin.Context, info *relaycommon.RelayInfo, requestMode int) (*types.NewAPIError, *dto.Usage) {
	awsCli, err := newAwsClient(c, info)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelAwsClientError), nil
	}

	awsModelId := awsModelID(c.GetString("request_model"))
	// 检查是否为Nova模型
	isNova, _ := c.Get("is_nova_model")
	if isNova == true {
		// Nova模型也支持跨区域
		awsRegionPrefix := awsRegionPrefix(awsCli.Options().Region)
		canCrossRegion := awsModelCanCrossRegion(awsModelId, awsRegionPrefix)
		if canCrossRegion {
			awsModelId = awsModelCrossRegion(awsModelId, awsRegionPrefix)
		}
		return handleNovaRequest(c, awsCli, info, awsModelId)
	}

	// 原有的Claude处理逻辑
	awsRegionPrefix := awsRegionPrefix(awsCli.Options().Region)
	canCrossRegion := awsModelCanCrossRegion(awsModelId, awsRegionPrefix)
	if canCrossRegion {
		awsModelId = awsModelCrossRegion(awsModelId, awsRegionPrefix)
	}

	awsReq := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(awsModelId),
		Accept:      aws.String("application/json"),
		ContentType: aws.String("application/json"),
	}

	claudeReq_, ok := c.Get("converted_request")
	if !ok {
		return types.NewError(errors.New("aws claude request not found"), types.ErrorCodeInvalidRequest), nil
	}
	claudeReq := claudeReq_.(*dto.ClaudeRequest)
	awsClaudeReq := copyRequest(claudeReq)
	awsReq.Body, err = common.Marshal(awsClaudeReq)
	if err != nil {
		return types.NewError(errors.Wrap(err, "marshal request"), types.ErrorCodeBadResponseBody), nil
	}

	awsResp, err := awsCli.InvokeModel(c.Request.Context(), awsReq)
	if err != nil {
		return types.NewOpenAIError(errors.Wrap(err, "InvokeModel"), types.ErrorCodeAwsInvokeError, http.StatusInternalServerError), nil
	}

	claudeInfo := &claude.ClaudeResponseInfo{
		ResponseId:   helper.GetResponseID(c),
		Created:      common.GetTimestamp(),
		Model:        info.UpstreamModelName,
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}

	// 复制上游 Content-Type 到客户端响应头
	if awsResp.ContentType != nil && *awsResp.ContentType != "" {
		c.Writer.Header().Set("Content-Type", *awsResp.ContentType)
	}

	handlerErr := claude.HandleClaudeResponseData(c, info, claudeInfo, nil, awsResp.Body, RequestModeMessage)
	if handlerErr != nil {
		return handlerErr, nil
	}
	return nil, claudeInfo.Usage
}

func awsStreamHandler(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo, requestMode int) (*types.NewAPIError, *dto.Usage) {
	awsCli, err := newAwsClient(c, info)
	if err != nil {
		return types.NewError(err, types.ErrorCodeChannelAwsClientError), nil
	}

	awsModelId := awsModelID(c.GetString("request_model"))

	awsRegionPrefix := awsRegionPrefix(awsCli.Options().Region)
	canCrossRegion := awsModelCanCrossRegion(awsModelId, awsRegionPrefix)
	if canCrossRegion {
		awsModelId = awsModelCrossRegion(awsModelId, awsRegionPrefix)
	}

	awsReq := &bedrockruntime.InvokeModelWithResponseStreamInput{
		ModelId:     aws.String(awsModelId),
		Accept:      aws.String("application/json"),
		ContentType: aws.String("application/json"),
	}

	claudeReq_, ok := c.Get("converted_request")
	if !ok {
		return types.NewError(errors.New("aws claude request not found"), types.ErrorCodeInvalidRequest), nil
	}
	claudeReq := claudeReq_.(*dto.ClaudeRequest)

	awsClaudeReq := copyRequest(claudeReq)
	awsReq.Body, err = common.Marshal(awsClaudeReq)
	if err != nil {
		return types.NewError(errors.Wrap(err, "marshal request"), types.ErrorCodeBadResponseBody), nil
	}

	awsResp, err := awsCli.InvokeModelWithResponseStream(c.Request.Context(), awsReq)
	if err != nil {
		return types.NewOpenAIError(errors.Wrap(err, "InvokeModelWithResponseStream"), types.ErrorCodeAwsInvokeError, http.StatusInternalServerError), nil
	}
	stream := awsResp.GetStream()
	defer stream.Close()

	claudeInfo := &claude.ClaudeResponseInfo{
		ResponseId:   helper.GetResponseID(c),
		Created:      common.GetTimestamp(),
		Model:        info.UpstreamModelName,
		ResponseText: strings.Builder{},
		Usage:        &dto.Usage{},
	}

	for event := range stream.Events() {
		switch v := event.(type) {
		case *bedrockruntimeTypes.ResponseStreamMemberChunk:
			info.SetFirstResponseTime()
			respErr := claude.HandleStreamResponseData(c, info, claudeInfo, string(v.Value.Bytes), RequestModeMessage)
			if respErr != nil {
				return respErr, nil
			}
		case *bedrockruntimeTypes.UnknownUnionMember:
			fmt.Println("unknown tag:", v.Tag)
			return types.NewError(errors.New("unknown response type"), types.ErrorCodeInvalidRequest), nil
		default:
			fmt.Println("union is nil or unknown type")
			return types.NewError(errors.New("nil or unknown response type"), types.ErrorCodeInvalidRequest), nil
		}
	}

	claude.HandleStreamFinalResponse(c, info, claudeInfo, RequestModeMessage)
	return nil, claudeInfo.Usage
}

// Nova模型处理函数
func handleNovaRequest(c *gin.Context, awsCli *bedrockruntime.Client, info *relaycommon.RelayInfo, awsModelId string) (*types.NewAPIError, *dto.Usage) {
	novaReq_, ok := c.Get("converted_request")
	if !ok {
		return types.NewError(errors.New("nova request not found"), types.ErrorCodeInvalidRequest), nil
	}
	novaReq := novaReq_.(*NovaRequest)

	// 使用InvokeModel API，但使用Nova格式的请求体
	awsReq := &bedrockruntime.InvokeModelInput{
		ModelId:     aws.String(awsModelId),
		Accept:      aws.String("application/json"),
		ContentType: aws.String("application/json"),
	}

	reqBody, err := json.Marshal(novaReq)
	if err != nil {
		return types.NewError(errors.Wrap(err, "marshal nova request"), types.ErrorCodeBadResponseBody), nil
	}
	awsReq.Body = reqBody

	awsResp, err := awsCli.InvokeModel(c.Request.Context(), awsReq)
	if err != nil {
		return types.NewError(errors.Wrap(err, "InvokeModel"), types.ErrorCodeChannelAwsClientError), nil
	}

	// 解析Nova响应
	var novaResp struct {
		Output struct {
			Message struct {
				Content []struct {
					Text string `json:"text"`
				} `json:"content"`
			} `json:"message"`
		} `json:"output"`
		Usage struct {
			InputTokens  int `json:"inputTokens"`
			OutputTokens int `json:"outputTokens"`
			TotalTokens  int `json:"totalTokens"`
		} `json:"usage"`
	}

	if err := json.Unmarshal(awsResp.Body, &novaResp); err != nil {
		return types.NewError(errors.Wrap(err, "unmarshal nova response"), types.ErrorCodeBadResponseBody), nil
	}

	// 构造OpenAI格式响应
	response := dto.OpenAITextResponse{
		Id:      helper.GetResponseID(c),
		Object:  "chat.completion",
		Created: common.GetTimestamp(),
		Model:   info.UpstreamModelName,
		Choices: []dto.OpenAITextResponseChoice{{
			Index: 0,
			Message: dto.Message{
				Role:    "assistant",
				Content: novaResp.Output.Message.Content[0].Text,
			},
			FinishReason: "stop",
		}},
		Usage: dto.Usage{
			PromptTokens:     novaResp.Usage.InputTokens,
			CompletionTokens: novaResp.Usage.OutputTokens,
			TotalTokens:      novaResp.Usage.TotalTokens,
		},
	}

	c.JSON(http.StatusOK, response)
	return nil, &response.Usage
}
