package controller

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relay/helper"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

// ChatStreamRequest 加密请求格式
type ChatStreamRequest struct {
	EncryptedData string   `json:"encrypted_data"`
	IV            string   `json:"iv"`
	Data          string   `json:"data"`
	Images        []string `json:"images"`
	Model         string   `json:"model"`
}

// RelayPassthrough 传透模式接口处理器
// 请求/响应内容透传，但使用 new-api 内置的计费、模型映射、渠道适配功能
func RelayPassthrough(c *gin.Context) {
	requestId := c.GetString(common.RequestIdKey)

	var newAPIError *types.NewAPIError
	var usage *dto.Usage

	defer func() {
		if newAPIError != nil {
			logger.LogError(c, fmt.Sprintf("passthrough relay error: %s", newAPIError.Error()))
			newAPIError.SetMessage(common.MessageWithRequestId(newAPIError.Error(), requestId))
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	// 解析请求获取模型名称（用于渠道选择和计费）
	var chatStreamReq ChatStreamRequest
	if err := common.UnmarshalBodyReusable(c, &chatStreamReq); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	if chatStreamReq.Model == "" {
		newAPIError = types.NewError(errors.New("model is required"), types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	// 敏感词检测（仅检测 data 字段）
	if setting.ShouldCheckPromptSensitive() && chatStreamReq.Data != "" {
		contains, words := service.CheckSensitiveText(chatStreamReq.Data)
		if contains {
			logger.LogWarn(c, fmt.Sprintf("passthrough sensitive words detected: %s", strings.Join(words, ", ")))
			newAPIError = types.NewError(errors.New("sensitive words detected"), types.ErrorCodeSensitiveWordsDetected, types.ErrOptionWithSkipRetry())
			return
		}
	}

	// 生成 RelayInfo
	relayInfo := genPassthroughRelayInfo(c, chatStreamReq.Model, true)

	// 精确计算输入 token
	estimatedInputTokens := calculateInputTokens(chatStreamReq, relayInfo.OriginModelName)
	relayInfo.SetEstimatePromptTokens(estimatedInputTokens)

	// 获取价格数据（使用模型倍率、分组倍率）
	priceData, err := helper.ModelPriceHelper(c, relayInfo, estimatedInputTokens, &types.TokenCountMeta{})
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeModelPriceError)
		return
	}

	// 预扣费（如果不是免费模型）
	if !priceData.FreeModel {
		newAPIError = service.PreConsumeQuota(c, priceData.QuotaToPreConsume, relayInfo)
		if newAPIError != nil {
			return
		}
	}

	defer func() {
		// 失败时返还预扣费
		if newAPIError != nil && relayInfo.FinalPreConsumedQuota != 0 {
			service.ReturnPreConsumedQuota(c, relayInfo)
		}
	}()

	// 重试逻辑
	retryParam := &service.RetryParam{
		Ctx:        c,
		TokenGroup: relayInfo.TokenGroup,
		ModelName:  relayInfo.OriginModelName,
		Retry:      common.GetPointer(0),
	}

	for ; retryParam.GetRetry() <= common.RetryTimes; retryParam.IncreaseRetry() {
		channel, channelErr := getPassthroughChannel(c, relayInfo, retryParam)
		if channelErr != nil {
			logger.LogError(c, channelErr.Error())
			newAPIError = channelErr
			break
		}

		addUsedChannel(c, channel.Id)

		// 重新初始化 ChannelMeta（渠道可能在重试时改变）
		relayInfo.InitChannelMeta(c)

		// 应用模型映射
		if err := applyModelMapping(c, relayInfo); err != nil {
			newAPIError = types.NewError(err, types.ErrorCodeChannelModelMappedError, types.ErrOptionWithSkipRetry())
			break
		}

		requestBody, bodyErr := common.GetRequestBody(c)
		if bodyErr != nil {
			if common.IsRequestBodyTooLargeError(bodyErr) || errors.Is(bodyErr, common.ErrRequestBodyTooLarge) {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusRequestEntityTooLarge, types.ErrOptionWithSkipRetry())
			} else {
				newAPIError = types.NewErrorWithStatusCode(bodyErr, types.ErrorCodeReadRequestBodyFailed, http.StatusBadRequest, types.ErrOptionWithSkipRetry())
			}
			break
		}
		c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))

		// 执行传透请求，获取 usage 信息
		usage, newAPIError = relay.PassthroughHelperWithUsage(c, relayInfo)

		if newAPIError == nil {
			// 成功，根据本地计算的 token 记录消费
			postPassthroughConsumeQuotaWithUsage(c, relayInfo, usage, estimatedInputTokens)
			return
		}

		// 处理渠道错误
		processChannelError(c, *types.NewChannelError(channel.Id, channel.Type, channel.Name, channel.ChannelInfo.IsMultiKey, common.GetContextKeyString(c, constant.ContextKeyChannelKey), channel.GetAutoBan()), newAPIError)

		if !shouldRetry(c, newAPIError, common.RetryTimes-retryParam.GetRetry()) {
			break
		}
	}

	useChannel := c.GetStringSlice("use_channel")
	if len(useChannel) > 1 {
		retryLogStr := fmt.Sprintf("重试：%s", strings.Trim(strings.Join(strings.Fields(fmt.Sprint(useChannel)), "->"), "[]"))
		logger.LogInfo(c, retryLogStr)
	}
}

// genPassthroughRelayInfo 生成传透模式的 RelayInfo
func genPassthroughRelayInfo(c *gin.Context, modelName string, isStream bool) *relaycommon.RelayInfo {
	tokenGroup := common.GetContextKeyString(c, constant.ContextKeyTokenGroup)
	if tokenGroup == "" {
		tokenGroup = common.GetContextKeyString(c, constant.ContextKeyUserGroup)
	}

	startTime := common.GetContextKeyTime(c, constant.ContextKeyRequestStartTime)
	if startTime.IsZero() {
		startTime = time.Now()
	}

	info := &relaycommon.RelayInfo{
		UserId:          common.GetContextKeyInt(c, constant.ContextKeyUserId),
		UsingGroup:      common.GetContextKeyString(c, constant.ContextKeyUsingGroup),
		UserGroup:       common.GetContextKeyString(c, constant.ContextKeyUserGroup),
		UserQuota:       common.GetContextKeyInt(c, constant.ContextKeyUserQuota),
		UserEmail:       common.GetContextKeyString(c, constant.ContextKeyUserEmail),
		OriginModelName: modelName,
		TokenId:         common.GetContextKeyInt(c, constant.ContextKeyTokenId),
		TokenKey:        common.GetContextKeyString(c, constant.ContextKeyTokenKey),
		TokenUnlimited:  common.GetContextKeyBool(c, constant.ContextKeyTokenUnlimited),
		TokenGroup:      tokenGroup,
		IsStream:        isStream,
		StartTime:       startTime,
		RelayFormat:     types.RelayFormatOpenAI,
		RequestURLPath:  "/v1/chat/completions", // 传透模式使用标准路径
	}

	// 初始化 ChannelMeta，从上下文中获取 Distribute 中间件设置的渠道信息
	info.InitChannelMeta(c)

	return info
}

// getPassthroughChannel 获取传透模式的渠道
func getPassthroughChannel(c *gin.Context, info *relaycommon.RelayInfo, retryParam *service.RetryParam) (*model.Channel, *types.NewAPIError) {
	if info.ChannelMeta == nil {
		autoBan := c.GetBool("auto_ban")
		autoBanInt := 1
		if !autoBan {
			autoBanInt = 0
		}
		return &model.Channel{
			Id:      c.GetInt("channel_id"),
			Type:    c.GetInt("channel_type"),
			Name:    c.GetString("channel_name"),
			AutoBan: &autoBanInt,
		}, nil
	}

	channel, selectGroup, err := service.CacheGetRandomSatisfiedChannel(retryParam)
	info.PriceData.GroupRatioInfo = helper.HandleGroupRatio(c, info)

	if err != nil {
		return nil, types.NewError(fmt.Errorf("获取分组 %s 下模型 %s 的可用渠道失败: %s", selectGroup, info.OriginModelName, err.Error()), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}
	if channel == nil {
		return nil, types.NewError(fmt.Errorf("分组 %s 下模型 %s 的可用渠道不存在", selectGroup, info.OriginModelName), types.ErrorCodeGetChannelFailed, types.ErrOptionWithSkipRetry())
	}

	newAPIError := middleware.SetupContextForSelectedChannel(c, channel, info.OriginModelName)
	if newAPIError != nil {
		return nil, newAPIError
	}
	return channel, nil
}

// applyModelMapping 应用模型映射
func applyModelMapping(c *gin.Context, info *relaycommon.RelayInfo) error {
	return helper.ModelMappedHelper(c, info, nil)
}

// calculateInputTokens 精确计算输入 token 数量
// 排除 encrypted_data、iv 字段，计算 data、images、model 字段的 token
func calculateInputTokens(req ChatStreamRequest, modelName string) int {
	totalTokens := 0

	// 1. 对 data 字段使用精确 token 计算
	if req.Data != "" {
		totalTokens += service.CountTextToken(req.Data, modelName)
	}

	// 2. 对 images 数组计算图片 token
	for _, imageData := range req.Images {
		if imageData == "" {
			continue
		}
		// 构建 FileMeta 用于图片 token 计算
		fileMeta := &types.FileMeta{
			FileType:   types.FileTypeImage,
			OriginData: imageData,
		}
		// 尝试精确计算图片 token，失败则使用默认值
		imageTokens, err := service.GetImageTokenForPassthrough(fileMeta, modelName)
		if err != nil {
			// 计算失败，使用默认估算值 500
			common.SysLog(fmt.Sprintf("calculate image token failed: %v, using default 500", err))
			imageTokens = 500
		}
		totalTokens += imageTokens
	}

	// 3. 对 model 字段计算 token
	if req.Model != "" {
		totalTokens += service.CountTextToken(req.Model, modelName)
	}

	// 最小返回值为 1
	if totalTokens < 1 {
		totalTokens = 1
	}

	return totalTokens
}

// postPassthroughConsumeQuotaWithUsage 传透模式的消费记录（带 usage 信息）
// estimatedInputTokens: 本地估算的输入 token 数量（仅用于预扣费参考）
// 计费逻辑：优先使用上游返回的 usage，如果上游未返回则输出 token 计为 0
func postPassthroughConsumeQuotaWithUsage(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, usage *dto.Usage, estimatedInputTokens int) {
	useTimeSeconds := time.Now().Unix() - relayInfo.StartTime.Unix()
	tokenName := ctx.GetString("token_name")

	var promptTokens, completionTokens int
	var logContent string

	// 计费逻辑：完全依赖上游返回的 usage
	if usage != nil && (usage.PromptTokens > 0 || usage.CompletionTokens > 0) {
		// 使用上游返回的 usage 进行计费
		promptTokens = usage.PromptTokens
		completionTokens = usage.CompletionTokens
		logContent = "传透模式（上游计费）"
	} else {
		// 上游未返回 usage，输出 token 计为 0，输入 token 使用本地估算
		promptTokens = estimatedInputTokens
		completionTokens = 0
		logContent = "传透模式（上游无 usage，本地估算输入）"
	}

	// 根据 token 计算配额
	modelRatio := relayInfo.PriceData.ModelRatio
	groupRatio := relayInfo.PriceData.GroupRatioInfo.GroupRatio
	completionRatio := relayInfo.PriceData.CompletionRatio
	modelPrice := relayInfo.PriceData.ModelPrice
	usePrice := relayInfo.PriceData.UsePrice
	userGroupRatio := relayInfo.PriceData.GroupRatioInfo.GroupSpecialRatio

	var quota int

	if !usePrice {
		// 基于 token 计算
		calculateQuota := float64(promptTokens) + float64(completionTokens)*completionRatio
		calculateQuota = calculateQuota * groupRatio * modelRatio
		quota = int(calculateQuota)
		logContent += fmt.Sprintf("，模型倍率 %.2f，补全倍率 %.2f，分组倍率 %.2f", modelRatio, completionRatio, groupRatio)
	} else {
		// 基于价格计算
		quota = int(modelPrice * common.QuotaPerUnit * groupRatio)
		logContent += fmt.Sprintf("，模型价格 %.2f，分组倍率 %.2f", modelPrice, groupRatio)
	}

	// 处理预扣费差额
	quotaDelta := quota - relayInfo.FinalPreConsumedQuota

	if quotaDelta > 0 {
		logger.LogInfo(ctx, fmt.Sprintf("传透模式预扣费后补扣费：%s（实际消耗：%s，预扣费：%s）",
			logger.FormatQuota(quotaDelta),
			logger.FormatQuota(quota),
			logger.FormatQuota(relayInfo.FinalPreConsumedQuota),
		))
	} else if quotaDelta < 0 {
		logger.LogInfo(ctx, fmt.Sprintf("传透模式预扣费后返还扣费：%s（实际消耗：%s，预扣费：%s）",
			logger.FormatQuota(-quotaDelta),
			logger.FormatQuota(quota),
			logger.FormatQuota(relayInfo.FinalPreConsumedQuota),
		))
	}

	if quotaDelta != 0 {
		err := service.PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
		if err != nil {
			logger.LogError(ctx, "error consuming token remain quota: "+err.Error())
		}
	}

	// 更新使用量统计
	if quota > 0 {
		model.UpdateUserUsedQuotaAndRequestCount(relayInfo.UserId, quota)
		model.UpdateChannelUsedQuota(relayInfo.ChannelId, quota)
	}

	// 构建 other 字段，包含前端显示价格所需的所有信息
	other := service.GenerateTextOtherInfo(ctx, relayInfo, modelRatio, groupRatio, completionRatio, 0, 0.0, modelPrice, userGroupRatio)
	other["passthrough"] = true
	if usage != nil {
		other["usage"] = usage
	}

	model.RecordConsumeLog(ctx, relayInfo.UserId, model.RecordConsumeLogParams{
		ChannelId:        relayInfo.ChannelId,
		PromptTokens:     promptTokens,
		CompletionTokens: completionTokens,
		ModelName:        relayInfo.OriginModelName,
		TokenName:        tokenName,
		Quota:            quota,
		Content:          logContent,
		TokenId:          relayInfo.TokenId,
		UseTimeSeconds:   int(useTimeSeconds),
		IsStream:         relayInfo.IsStream,
		Group:            relayInfo.UsingGroup,
		Other:            other,
	})
}

