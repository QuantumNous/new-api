package helper

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/types"

	"github.com/gin-gonic/gin"
)

const serviceTierOtherRatioKey = "service_tier"

func applyChannelServiceTierPricing(c *gin.Context, info *relaycommon.RelayInfo, priceData *types.PriceData) error {
	return applyChannelServiceTierPricingWithQuotaMode(c, info, priceData, true)
}

func RefreshChannelSpecificPriceData(c *gin.Context, info *relaycommon.RelayInfo) error {
	if c == nil || info == nil {
		return nil
	}
	resetChannelServiceTierPricing(&info.PriceData)
	info.InitChannelMeta(c)
	return applyChannelServiceTierPricingWithQuotaMode(c, info, &info.PriceData, true)
}

func applyChannelServiceTierPricingWithQuotaMode(c *gin.Context, info *relaycommon.RelayInfo, priceData *types.PriceData, updatePreConsumedQuota bool) error {
	if c == nil || info == nil || priceData == nil {
		return nil
	}
	if info.ChannelMeta == nil {
		info.InitChannelMeta(c)
	}
	if info.ChannelType != constant.ChannelTypeOpenAI {
		return nil
	}
	if info.RelayFormat != types.RelayFormatOpenAI && info.RelayFormat != types.RelayFormatOpenAIResponses {
		return nil
	}

	serviceTier, ratio, matched, err := resolveChannelServiceTierPricing(c, info)
	if err != nil || !matched {
		return err
	}

	priceData.ServiceTier = serviceTier
	priceData.ServiceTierRatio = ratio
	if ratio != 1 {
		priceData.AddOtherRatio(serviceTierOtherRatioKey, ratio)
	}
	if updatePreConsumedQuota && priceData.QuotaToPreConsume > 0 {
		baseQuota := priceData.BaseQuotaToPreConsume
		if baseQuota <= 0 {
			baseQuota = priceData.QuotaToPreConsume
		}
		priceData.QuotaToPreConsume = int(float64(baseQuota) * ratio)
	}
	return nil
}

func resetChannelServiceTierPricing(priceData *types.PriceData) {
	if priceData == nil {
		return
	}
	priceData.ServiceTier = ""
	priceData.ServiceTierRatio = 0
	if priceData.BaseQuotaToPreConsume > 0 {
		priceData.QuotaToPreConsume = priceData.BaseQuotaToPreConsume
	}
	if priceData.OtherRatios != nil {
		delete(priceData.OtherRatios, serviceTierOtherRatioKey)
	}
}

func resolveChannelServiceTierPricing(c *gin.Context, info *relaycommon.RelayInfo) (string, float64, bool, error) {
	if c == nil || info == nil {
		return "", 0, false, nil
	}
	if info.ChannelMeta == nil {
		info.InitChannelMeta(c)
	}

	ratios := normalizeServiceTierRatios(info.ChannelOtherSettings.ServiceTierRatios)
	if len(ratios) == 0 {
		return "", 0, false, nil
	}

	serviceTier, err := resolveEffectiveServiceTier(c, info)
	if err != nil {
		return "", 0, false, err
	}
	if serviceTier == "" {
		return "", 0, false, nil
	}

	ratio, ok := ratios[serviceTier]
	if !ok {
		return "", 0, false, nil
	}
	return serviceTier, ratio, true, nil
}

func resolveEffectiveServiceTier(c *gin.Context, info *relaycommon.RelayInfo) (string, error) {
	if c == nil || info == nil {
		return "", nil
	}
	if model_setting.GetGlobalSettings().PassThroughRequestEnabled || info.ChannelSetting.PassThroughBodyEnabled {
		return extractServiceTierFromBody(c)
	}

	switch request := info.Request.(type) {
	case *dto.GeneralOpenAIRequest:
		jsonData, err := renderFinalOpenAIRequestJSONForServiceTier(c, info, request)
		if err != nil {
			return "", err
		}
		return extractServiceTierFromJSON(jsonData)
	case *dto.OpenAIResponsesRequest:
		jsonData, err := renderFinalOpenAIResponsesRequestJSONForServiceTier(c, info, request)
		if err != nil {
			return "", err
		}
		return extractServiceTierFromJSON(jsonData)
	default:
		return "", nil
	}
}

func renderFinalOpenAIRequestJSONForServiceTier(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) ([]byte, error) {
	workingRequest, err := common.DeepCopy(request)
	if err != nil {
		return nil, fmt.Errorf("copy openai request failed: %w", err)
	}
	workingInfo := cloneRelayInfoForServiceTier(c, info)

	if err = ModelMappedHelper(c, &workingInfo, workingRequest); err != nil {
		return nil, err
	}

	if info.RelayMode == relayconstant.RelayModeChatCompletions &&
		service.ShouldChatCompletionsUseResponsesGlobal(info.ChannelId, info.ChannelType, info.OriginModelName) {
		return renderFinalChatViaResponsesJSONForServiceTier(c, &workingInfo, workingRequest)
	}

	normalizeOpenAITextRequestForServiceTier(workingRequest, &workingInfo)
	applySystemPromptForServiceTier(&workingInfo, workingRequest)
	jsonData, err := common.Marshal(workingRequest)
	if err != nil {
		return nil, err
	}
	return applyServiceTierRequestTransforms(jsonData, &workingInfo)
}

func renderFinalChatViaResponsesJSONForServiceTier(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) ([]byte, error) {
	applySystemPromptForServiceTier(info, request)

	chatJSON, err := common.Marshal(request)
	if err != nil {
		return nil, err
	}
	chatJSON, err = applyServiceTierRequestTransforms(chatJSON, info)
	if err != nil {
		return nil, err
	}

	var overriddenChatReq dto.GeneralOpenAIRequest
	if err = common.Unmarshal(chatJSON, &overriddenChatReq); err != nil {
		return nil, err
	}

	responsesReq, err := service.ChatCompletionsRequestToResponsesRequest(&overriddenChatReq)
	if err != nil {
		return nil, err
	}
	normalizeOpenAIResponsesRequestForServiceTier(responsesReq)

	jsonData, err := common.Marshal(responsesReq)
	if err != nil {
		return nil, err
	}
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, err
	}
	return jsonData, nil
}

func renderFinalOpenAIResponsesRequestJSONForServiceTier(c *gin.Context, info *relaycommon.RelayInfo, request *dto.OpenAIResponsesRequest) ([]byte, error) {
	workingRequest, err := common.DeepCopy(request)
	if err != nil {
		return nil, fmt.Errorf("copy openai responses request failed: %w", err)
	}
	workingInfo := cloneRelayInfoForServiceTier(c, info)

	if err = ModelMappedHelper(c, &workingInfo, workingRequest); err != nil {
		return nil, err
	}
	normalizeOpenAIResponsesRequestForServiceTier(workingRequest)

	jsonData, err := common.Marshal(workingRequest)
	if err != nil {
		return nil, err
	}
	return applyServiceTierRequestTransforms(jsonData, &workingInfo)
}

func applyServiceTierRequestTransforms(jsonData []byte, info *relaycommon.RelayInfo) ([]byte, error) {
	if info == nil {
		return jsonData, nil
	}
	var err error
	jsonData, err = relaycommon.RemoveDisabledFields(jsonData, info.ChannelOtherSettings, info.ChannelSetting.PassThroughBodyEnabled)
	if err != nil {
		return nil, err
	}
	if info.ChannelMeta != nil && len(info.ParamOverride) > 0 {
		jsonData, err = relaycommon.ApplyParamOverrideWithRelayInfo(jsonData, info)
		if err != nil {
			return nil, err
		}
	}
	return jsonData, nil
}

func extractServiceTierFromBody(c *gin.Context) (string, error) {
	storage, err := common.GetBodyStorage(c)
	if err != nil {
		return "", err
	}
	body, err := storage.Bytes()
	if err != nil {
		return "", err
	}
	return extractServiceTierFromJSON(body)
}

func extractServiceTierFromJSON(jsonData []byte) (string, error) {
	var data map[string]any
	if err := common.Unmarshal(jsonData, &data); err != nil {
		return "", err
	}
	rawServiceTier, exists := data["service_tier"]
	if !exists {
		return "", nil
	}
	serviceTier, ok := rawServiceTier.(string)
	if !ok {
		return "", nil
	}
	return normalizeServiceTierKey(serviceTier), nil
}

func normalizeServiceTierRatios(rawRatios map[string]any) map[string]float64 {
	if len(rawRatios) == 0 {
		return nil
	}
	normalized := make(map[string]float64, len(rawRatios))
	for rawKey, rawValue := range rawRatios {
		key := normalizeServiceTierKey(rawKey)
		if key == "" {
			continue
		}
		value, ok := parsePositiveFloat64(rawValue)
		if !ok {
			continue
		}
		normalized[key] = value
	}
	if len(normalized) == 0 {
		return nil
	}
	return normalized
}

func parsePositiveFloat64(raw any) (float64, bool) {
	switch value := raw.(type) {
	case float64:
		if value > 0 {
			return value, true
		}
	case float32:
		if value > 0 {
			return float64(value), true
		}
	case int:
		if value > 0 {
			return float64(value), true
		}
	case int32:
		if value > 0 {
			return float64(value), true
		}
	case int64:
		if value > 0 {
			return float64(value), true
		}
	case string:
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			return 0, false
		}
		parsed, err := strconv.ParseFloat(trimmed, 64)
		if err == nil && parsed > 0 {
			return parsed, true
		}
	}
	return 0, false
}

func normalizeServiceTierKey(key string) string {
	return strings.ToLower(strings.TrimSpace(key))
}

func cloneRelayInfoForServiceTier(c *gin.Context, info *relaycommon.RelayInfo) relaycommon.RelayInfo {
	workingInfo := *info
	if workingInfo.ChannelMeta == nil {
		workingInfo.InitChannelMeta(c)
	}
	if workingInfo.ChannelMeta != nil {
		channelMeta := *workingInfo.ChannelMeta
		workingInfo.ChannelMeta = &channelMeta
	}
	return workingInfo
}

func normalizeOpenAITextRequestForServiceTier(request *dto.GeneralOpenAIRequest, info *relaycommon.RelayInfo) {
	if request == nil || info == nil {
		return
	}
	modelName := strings.TrimSpace(info.UpstreamModelName)
	if modelName == "" {
		modelName = strings.TrimSpace(request.Model)
	}
	if !strings.HasPrefix(modelName, "o") && !strings.HasPrefix(modelName, "gpt-5") {
		return
	}
	_, originModel := parseReasoningEffortSuffixForServiceTier(modelName)
	if originModel == modelName {
		return
	}
	info.UpstreamModelName = originModel
	request.Model = originModel
}

func normalizeOpenAIResponsesRequestForServiceTier(request *dto.OpenAIResponsesRequest) {
	if request == nil {
		return
	}
	_, originModel := parseReasoningEffortSuffixForServiceTier(request.Model)
	request.Model = originModel
}

func parseReasoningEffortSuffixForServiceTier(modelName string) (string, string) {
	effortSuffixes := []string{"-high", "-minimal", "-low", "-medium", "-none", "-xhigh"}
	for _, suffix := range effortSuffixes {
		if strings.HasSuffix(modelName, suffix) {
			return strings.TrimPrefix(suffix, "-"), strings.TrimSuffix(modelName, suffix)
		}
	}
	return "", modelName
}

func applySystemPromptForServiceTier(info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) {
	if info == nil || request == nil || info.ChannelSetting.SystemPrompt == "" {
		return
	}

	systemRole := request.GetSystemRoleName()
	for i, message := range request.Messages {
		if message.Role != systemRole {
			continue
		}
		if !info.ChannelSetting.SystemPromptOverride {
			return
		}
		if message.IsStringContent() {
			request.Messages[i].SetStringContent(info.ChannelSetting.SystemPrompt + "\n" + message.StringContent())
			return
		}

		contents := message.ParseContent()
		contents = append([]dto.MediaContent{{
			Type: dto.ContentTypeText,
			Text: info.ChannelSetting.SystemPrompt,
		}}, contents...)
		request.Messages[i].Content = contents
		return
	}

	request.Messages = append([]dto.Message{{
		Role:    systemRole,
		Content: info.ChannelSetting.SystemPrompt,
	}}, request.Messages...)
}
