package custompass

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"one-api/common"
	"one-api/dto"
	"one-api/model"
	"one-api/relay/channel"
	relaycommon "one-api/relay/common"
	"one-api/service"
	"one-api/setting/ratio_setting"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
	ChannelType int
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.ChannelType = info.ChannelType
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	// 从URL路径中提取模型名称: /pass/{model}
	// 模型名称格式为 "model/action"，直接使用
	// 构建上游URL: baseurl/{model}
	modelName := info.OriginModelName
	if modelName == "" {
		return "", fmt.Errorf("model name is required")
	}

	baseURL := fmt.Sprintf("%s/%s", info.BaseUrl, modelName)
	return baseURL, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, header)
	header.Set("Authorization", "Bearer "+info.ApiKey)
	// 添加客户端token到header中
	if info.TokenKey != "" {
		header.Set("new-api-token", info.TokenKey)
	}
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	// CustomPass透传，将请求转换为JSON
	jsonData, err := json.Marshal(request)
	if err != nil {
		return nil, fmt.Errorf("error marshalling audio request: %w", err)
	}
	return bytes.NewReader(jsonData), nil
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	// CustomPass透传，直接返回原始请求
	return request, nil
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *dto.OpenAIErrorWithStatusCode) {
	responseBody, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, service.OpenAIErrorWrapper(readErr, "read_response_body_failed", http.StatusInternalServerError)
	}

	// 尝试提取usage信息进行计费
	var respData map[string]interface{}
	if jsonErr := json.Unmarshal(responseBody, &respData); jsonErr == nil {
		if usageData, exists := respData["usage"]; exists {
			if usageMap, ok := usageData.(map[string]interface{}); ok {
				var usageInfo dto.Usage
				if promptTokens, ok := usageMap["prompt_tokens"].(float64); ok {
					usageInfo.PromptTokens = int(promptTokens)
				}
				if completionTokens, ok := usageMap["completion_tokens"].(float64); ok {
					usageInfo.CompletionTokens = int(completionTokens)
				}
				if totalTokens, ok := usageMap["total_tokens"].(float64); ok {
					usageInfo.TotalTokens = int(totalTokens)
				}
				
				// 如果提取到了有效的usage信息，进行计费
				if usageInfo.TotalTokens > 0 {
					// 使用完整的模型名称进行计费
					// info.OriginModelName 现在已经是 "model/action" 格式
					modelName := info.OriginModelName
					
					// 获取分组倍率
					groupRatio := ratio_setting.GetGroupRatio(info.UsingGroup)
					
					// 计算费用
					finalQuota := calculateCustomPassQuota(modelName, groupRatio, &usageInfo)
					
					if finalQuota > 0 {
						// 进行计费
						err := service.PostConsumeQuota(info, finalQuota, 0, true)
						if err != nil {
							common.SysError("error consuming quota for CustomPass API call: " + err.Error())
						}
						
						// 记录消费日志
						tokenName := c.GetString("token_name")
						logContent := fmt.Sprintf("CustomPass API调用: model=%s, prompt_tokens=%d, completion_tokens=%d, total_tokens=%d",
							modelName, usageInfo.PromptTokens, usageInfo.CompletionTokens, usageInfo.TotalTokens)
						
						// 获取模型价格配置用于日志记录
						modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
						modelRatio, _ := ratio_setting.GetModelRatio(modelName)
						completionRatio := ratio_setting.GetCompletionRatio(modelName)

						other := make(map[string]interface{})
						other["usage"] = usageInfo
						other["billing_type"] = "usage"
						other["model_name"] = modelName
						other["model_ratio"] = modelRatio
						other["completion_ratio"] = completionRatio
						other["group_ratio"] = groupRatio
						other["model_price"] = modelPrice
						other["use_price"] = usePrice

						// 记录日志
						// 注意：这里需要获取userQuota，但在普通relay流程中可能不容易获取，暂时设为0
						userQuota := 0
						model.RecordConsumeLog(c, info.UserId, info.ChannelId, usageInfo.PromptTokens, usageInfo.CompletionTokens,
							modelName, tokenName, finalQuota, logContent, info.TokenId, userQuota, 0, false, info.UsingGroup, other)
						model.UpdateUserUsedQuotaAndRequestCount(info.UserId, finalQuota)
						model.UpdateChannelUsedQuota(info.ChannelId, finalQuota)
					}
					
					usage = &usageInfo
				}
			}
		}
	}

	// 如果没有usage信息，检查是否需要按次计费
	if usage == nil {
		modelName := info.OriginModelName
		groupRatio := ratio_setting.GetGroupRatio(info.UsingGroup)

		// 获取模型价格配置
		modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
		modelRatio, _ := ratio_setting.GetModelRatio(modelName)
		completionRatio := ratio_setting.GetCompletionRatio(modelName)

		// 如果配置了按次计费，进行计费
		if usePrice && modelPrice > 0 {
			finalQuota := int(modelPrice * groupRatio * common.QuotaPerUnit)

			if finalQuota > 0 {
				// 进行计费
				err := service.PostConsumeQuota(info, finalQuota, 0, true)
				if err != nil {
					common.SysError("error consuming quota for CustomPass per-call billing: " + err.Error())
				}

				// 记录消费日志
				tokenName := c.GetString("token_name")
				logContent := fmt.Sprintf("CustomPass 按次计费: model=%s, price=%.4f, group_ratio=%.2f",
					modelName, modelPrice, groupRatio)

				other := make(map[string]interface{})
				other["billing_type"] = "per_call"
				other["model_name"] = modelName
				other["model_ratio"] = modelRatio
				other["completion_ratio"] = completionRatio
				other["group_ratio"] = groupRatio
				other["model_price"] = modelPrice
				other["use_price"] = usePrice

				// 记录日志
				userQuota := 0
				model.RecordConsumeLog(c, info.UserId, info.ChannelId, 0, 0,
					modelName, tokenName, finalQuota, logContent, info.TokenId, userQuota, 0, false, info.UsingGroup, other)
				model.UpdateUserUsedQuotaAndRequestCount(info.UserId, finalQuota)
				model.UpdateChannelUsedQuota(info.ChannelId, finalQuota)
			}
		}
	}

	// 直接返回上游响应
	c.Data(resp.StatusCode, resp.Header.Get("Content-Type"), responseBody)
	return usage, nil
}

func (a *Adaptor) GetModelList() []string {
	// 自定义透传渠道支持任意模型名称
	return []string{}
}

func (a *Adaptor) GetChannelName() string {
	return "custompass"
}



// calculateCustomPassQuota 计算CustomPass费用
func calculateCustomPassQuota(modelName string, groupRatio float64, usage *dto.Usage) int {
	// 获取模型价格配置
	modelPrice, usePrice := ratio_setting.GetModelPrice(modelName, false)
	modelRatio, _ := ratio_setting.GetModelRatio(modelName)
	completionRatio := ratio_setting.GetCompletionRatio(modelName)
	
	quotaInfo := service.CustomPassQuotaInfo{
		ModelName:       modelName,
		GroupRatio:      groupRatio,
		Usage:           usage,
		UsePrice:        usePrice,
		ModelPrice:      modelPrice,
		ModelRatio:      modelRatio,
		CompletionRatio: completionRatio,
	}
	
	return service.CalculateCustomPassQuota(quotaInfo)
}
