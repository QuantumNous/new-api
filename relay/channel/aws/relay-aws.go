package aws

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/claude"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/pkg/errors"

	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/bedrockruntime"
	bedrockruntimeTypes "github.com/aws/aws-sdk-go-v2/service/bedrockruntime/types"
	"github.com/aws/smithy-go/auth/bearer"
)

// getAwsErrorStatusCode extracts HTTP status code from AWS SDK error
func getAwsErrorStatusCode(err error) int {
	// Check for HTTP response error which contains status code
	var httpErr interface{ HTTPStatusCode() int }
	if errors.As(err, &httpErr) {
		return httpErr.HTTPStatusCode()
	}
	// Default to 500 if we can't determine the status code
	return http.StatusInternalServerError
}

func newAwsInvokeContext(parent context.Context) (context.Context, context.CancelFunc) {
	if common.RelayTimeout <= 0 {
		return context.WithCancel(parent)
	}
	return context.WithTimeout(parent, time.Duration(common.RelayTimeout)*time.Second)
}

func newAwsInvokeError(requestContext context.Context, err error, operation string) *types.NewAPIError {
	options := make([]types.NewAPIErrorOptions, 0, 1)
	if requestContext.Err() != nil {
		options = append(options, types.ErrOptionWithSkipRetry())
	}
	return types.NewOpenAIError(
		errors.Wrap(err, operation),
		types.ErrorCodeAwsInvokeError,
		getAwsErrorStatusCode(err),
		options...,
	)
}

func newAwsClient(c *gin.Context, info *relaycommon.RelayInfo) (*bedrockruntime.Client, error) {
	httpClient, err := service.GetHttpClientWithProxySettings(info.ChannelSetting.Proxy, info.ChannelSetting)
	if err != nil {
		return nil, fmt.Errorf("new proxy http client failed: %w", err)
	}

	if info.ChannelOtherSettings.AwsKeyType == dto.AwsKeyTypeCredentialChain {
		return newAwsCredentialChainClient(info, httpClient)
	}

	awsSecret := strings.Split(info.ApiKey, "|")
	var client *bedrockruntime.Client
	switch len(awsSecret) {
	case 2:
		apiKey := awsSecret[0]
		region := awsSecret[1]
		client = bedrockruntime.New(bedrockruntime.Options{
			Region:                  region,
			BearerAuthTokenProvider: bearer.StaticTokenProvider{Token: bearer.Token{Value: apiKey}},
			HTTPClient:              httpClient,
		})
	case 3:
		ak := awsSecret[0]
		sk := awsSecret[1]
		region := awsSecret[2]
		client = bedrockruntime.New(bedrockruntime.Options{
			Region:      region,
			Credentials: aws.NewCredentialsCache(credentials.NewStaticCredentialsProvider(ak, sk, "")),
			HTTPClient:  httpClient,
		})
	default:
		return nil, errors.New("invalid aws secret key")
	}

	return client, nil
}

// awsCredentialChainProviders 按 "profile|region" 缓存凭据提供者。
//
// 默认凭据链的解析开销远高于静态密钥：它要读取共享配置文件，并且可能执行
// credential_process 子进程或访问实例元数据服务。SDK 返回的提供者自带
// aws.CredentialsCache，会在凭据过期前自动刷新，因此按渠道配置缓存一次即可，
// 不能每个请求重新解析。
var awsCredentialChainProviders sync.Map

// parseAwsCredentialChainKey 解析 credential_chain 模式的渠道密钥。
// 支持 "<region>" 与 "<profile>|<region>" 两种格式。
func parseAwsCredentialChainKey(key string) (profile string, region string, err error) {
	parts := strings.SplitN(key, "|", 2)
	if len(parts) == 2 {
		profile = strings.TrimSpace(parts[0])
		region = strings.TrimSpace(parts[1])
	} else {
		region = strings.TrimSpace(parts[0])
	}
	if region == "" {
		return "", "", errors.New("invalid aws credential chain key, should be in format of <region> or <profile>|<region>")
	}
	return profile, region, nil
}

// awsCredentialChainProvider 返回指定 profile 与 region 对应的凭据提供者。
func awsCredentialChainProvider(profile, region string) (aws.CredentialsProvider, error) {
	cacheKey := profile + "|" + region
	if cached, ok := awsCredentialChainProviders.Load(cacheKey); ok {
		return cached.(aws.CredentialsProvider), nil
	}

	options := []func(*awsconfig.LoadOptions) error{awsconfig.WithRegion(region)}
	if profile != "" {
		options = append(options, awsconfig.WithSharedConfigProfile(profile))
	}
	// 使用 context.Background 而非请求上下文：解析结果会被缓存复用，
	// 不应随首个请求的取消而失效。
	cfg, err := awsconfig.LoadDefaultConfig(context.Background(), options...)
	if err != nil {
		return nil, fmt.Errorf("load aws credential chain failed: %w", err)
	}
	if cfg.Credentials == nil {
		return nil, errors.New("aws credential chain resolved no credentials provider")
	}

	actual, _ := awsCredentialChainProviders.LoadOrStore(cacheKey, cfg.Credentials)
	return actual.(aws.CredentialsProvider), nil
}

// newAwsCredentialChainClient 使用 AWS 默认凭据链构造 Bedrock 客户端。
//
// 凭据由部署环境提供（共享配置文件中的 credential_process 或 SSO、EC2 实例角色、
// ECS 任务角色、EKS IRSA 等），渠道密钥中不含任何机密。
func newAwsCredentialChainClient(info *relaycommon.RelayInfo, httpClient *http.Client) (*bedrockruntime.Client, error) {
	profile, region, err := parseAwsCredentialChainKey(info.ApiKey)
	if err != nil {
		return nil, err
	}

	provider, err := awsCredentialChainProvider(profile, region)
	if err != nil {
		return nil, err
	}

	return bedrockruntime.New(bedrockruntime.Options{
		Region:      region,
		Credentials: provider,
		HTTPClient:  httpClient,
	}), nil
}

func doAwsClientRequest(c *gin.Context, info *relaycommon.RelayInfo, a *Adaptor, requestBody io.Reader) (any, error) {
	awsCli, err := newAwsClient(c, info)
	if err != nil {
		return nil, types.NewError(err, types.ErrorCodeChannelAwsClientError)
	}
	a.AwsClient = awsCli

	// 获取对应的AWS模型ID
	awsModelId := getAwsModelID(info.UpstreamModelName)

	awsRegionPrefix := getAwsRegionPrefix(awsCli.Options().Region)
	canCrossRegion := awsModelCanCrossRegion(awsModelId, awsRegionPrefix)
	if canCrossRegion {
		awsModelId = awsModelCrossRegion(awsModelId, awsRegionPrefix)
	}

	// init empty request.header
	requestHeader := http.Header{}
	a.SetupRequestHeader(c, &requestHeader, info)
	headerOverride, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, err
	}
	for key, value := range headerOverride {
		requestHeader.Set(key, value)
	}

	if isNovaModel(awsModelId) {
		var novaReq *NovaRequest
		err = common.DecodeJson(requestBody, &novaReq)
		if err != nil {
			return nil, types.NewError(errors.Wrap(err, "decode nova request fail"), types.ErrorCodeBadRequestBody)
		}

		// 使用InvokeModel API，但使用Nova格式的请求体
		awsReq := &bedrockruntime.InvokeModelInput{
			ModelId:     aws.String(awsModelId),
			Accept:      aws.String("application/json"),
			ContentType: aws.String("application/json"),
		}

		reqBody, err := common.Marshal(novaReq)
		if err != nil {
			return nil, types.NewError(errors.Wrap(err, "marshal nova request"), types.ErrorCodeBadResponseBody)
		}
		awsReq.Body = reqBody
		a.AwsReq = awsReq
		return nil, nil
	} else {
		awsClaudeReq, err := formatRequest(requestBody, requestHeader)
		if err != nil {
			return nil, types.NewError(errors.Wrap(err, "format aws request fail"), types.ErrorCodeBadRequestBody)
		}

		if info.IsStream {
			awsReq := &bedrockruntime.InvokeModelWithResponseStreamInput{
				ModelId:     aws.String(awsModelId),
				Accept:      aws.String("application/json"),
				ContentType: aws.String("application/json"),
			}
			awsReq.Body, err = buildAwsRequestBody(c, info, awsClaudeReq)
			if err != nil {
				return nil, types.NewError(errors.Wrap(err, "marshal aws request fail"), types.ErrorCodeBadRequestBody)
			}
			a.AwsReq = awsReq
			return nil, nil
		} else {
			awsReq := &bedrockruntime.InvokeModelInput{
				ModelId:     aws.String(awsModelId),
				Accept:      aws.String("application/json"),
				ContentType: aws.String("application/json"),
			}
			awsReq.Body, err = buildAwsRequestBody(c, info, awsClaudeReq)
			if err != nil {
				return nil, types.NewError(errors.Wrap(err, "marshal aws request fail"), types.ErrorCodeBadRequestBody)
			}
			a.AwsReq = awsReq
			return nil, nil
		}
	}
}

// buildAwsRequestBody prepares the payload for AWS requests, applying passthrough rules when enabled.
func buildAwsRequestBody(c *gin.Context, info *relaycommon.RelayInfo, awsClaudeReq any) ([]byte, error) {
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		storage, err := common.GetBodyStorage(c)
		if err != nil {
			return nil, errors.Wrap(err, "get request body for pass-through fail")
		}
		body, err := storage.Bytes()
		if err != nil {
			return nil, errors.Wrap(err, "get request body bytes fail")
		}
		var data map[string]interface{}
		if err := common.Unmarshal(body, &data); err != nil {
			return nil, errors.Wrap(err, "pass-through unmarshal request body fail")
		}
		delete(data, "model")
		delete(data, "stream")
		return common.Marshal(data)
	}
	return common.Marshal(awsClaudeReq)
}

func getAwsRegionPrefix(awsRegionId string) string {
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

func getAwsModelID(requestModel string) string {
	if awsModelIDName, ok := awsModelIDMap[requestModel]; ok {
		return awsModelIDName
	}
	return requestModel
}

func awsHandler(c *gin.Context, info *relaycommon.RelayInfo, a *Adaptor) (*types.NewAPIError, *dto.Usage) {

	requestContext := c.Request.Context()
	ctx, cancel := newAwsInvokeContext(requestContext)
	defer cancel()

	awsResp, err := a.AwsClient.InvokeModel(ctx, a.AwsReq.(*bedrockruntime.InvokeModelInput))
	if err != nil {
		return newAwsInvokeError(requestContext, err, "InvokeModel"), nil
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

	handlerErr := claude.HandleClaudeResponseData(c, info, claudeInfo, nil, awsResp.Body)
	if handlerErr != nil {
		return handlerErr, nil
	}
	return nil, claudeInfo.Usage
}

func awsStreamHandler(c *gin.Context, info *relaycommon.RelayInfo, a *Adaptor) (*types.NewAPIError, *dto.Usage) {
	requestContext := c.Request.Context()
	ctx, cancel := newAwsInvokeContext(requestContext)
	defer cancel()

	awsResp, err := a.AwsClient.InvokeModelWithResponseStream(ctx, a.AwsReq.(*bedrockruntime.InvokeModelWithResponseStreamInput))
	if err != nil {
		return newAwsInvokeError(requestContext, err, "InvokeModelWithResponseStream"), nil
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

	events := stream.Events()
streamLoop:
	for {
		select {
		case <-ctx.Done():
			break streamLoop
		case event, ok := <-events:
			if !ok {
				break streamLoop
			}
			if ctx.Err() != nil {
				break streamLoop
			}

			switch v := event.(type) {
			case *bedrockruntimeTypes.ResponseStreamMemberChunk:
				info.SetFirstResponseTime()
				respErr := claude.HandleStreamResponseData(c, info, claudeInfo, string(v.Value.Bytes))
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
	}

	_ = stream.Close()
	claude.HandleStreamFinalResponse(c, info, claudeInfo)
	return nil, claudeInfo.Usage
}

// Nova模型处理函数
func handleNovaRequest(c *gin.Context, info *relaycommon.RelayInfo, a *Adaptor) (*types.NewAPIError, *dto.Usage) {

	requestContext := c.Request.Context()
	ctx, cancel := newAwsInvokeContext(requestContext)
	defer cancel()

	awsResp, err := a.AwsClient.InvokeModel(ctx, a.AwsReq.(*bedrockruntime.InvokeModelInput))
	if err != nil {
		return newAwsInvokeError(requestContext, err, "InvokeModel"), nil
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
