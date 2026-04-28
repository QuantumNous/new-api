package controller

import (
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var completionRatioMetaOptionKeys = []string{
	"ModelPrice",
	"ModelRatio",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
}

func isVisiblePublicKeyOption(key string) bool {
	switch key {
	case "WaffoPancakeWebhookPublicKey", "WaffoPancakeWebhookTestKey":
		return true
	default:
		return false
	}
}

func collectModelNamesFromOptionValue(raw string, modelNames map[string]struct{}) {
	if strings.TrimSpace(raw) == "" {
		return
	}

	var parsed map[string]any
	if err := common.UnmarshalJsonStr(raw, &parsed); err != nil {
		return
	}

	for modelName := range parsed {
		modelNames[modelName] = struct{}{}
	}
}

func buildCompletionRatioMetaValue(optionValues map[string]string) string {
	modelNames := make(map[string]struct{})
	for _, key := range completionRatioMetaOptionKeys {
		collectModelNamesFromOptionValue(optionValues[key], modelNames)
	}

	meta := make(map[string]ratio_setting.CompletionRatioInfo, len(modelNames))
	for modelName := range modelNames {
		meta[modelName] = ratio_setting.GetCompletionRatioInfo(modelName)
	}

	jsonBytes, err := common.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(jsonBytes)
}

func GetOptions(c *gin.Context) {
	var options []*model.Option
	optionValues := make(map[string]string)
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		value := common.Interface2String(v)
		isSensitiveKey := strings.HasSuffix(k, "Token") ||
			strings.HasSuffix(k, "Secret") ||
			strings.HasSuffix(k, "Key") ||
			strings.HasSuffix(k, "secret") ||
			strings.HasSuffix(k, "api_key")
		if isSensitiveKey && !isVisiblePublicKeyOption(k) {
			continue
		}
		options = append(options, &model.Option{
			Key:   k,
			Value: value,
		})
		for _, optionKey := range completionRatioMetaOptionKeys {
			if optionKey == k {
				optionValues[k] = value
				break
			}
		}
	}
	common.OptionMapRWMutex.Unlock()
	options = append(options, &model.Option{
		Key:   "CompletionRatioMeta",
		Value: buildCompletionRatioMetaValue(optionValues),
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    options,
	})
	return
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

type PaymentAutoSwitchGroupUpdateRequest struct {
	Enabled       bool                                           `json:"enabled"`
	OnlyNewTopups bool                                           `json:"only_new_topups"`
	BaseGroup     string                                         `json:"base_group"`
	Rules         []operation_setting.PaymentAutoSwitchGroupRule `json:"rules"`
}

type normalizedPaymentAutoSwitchGroupRules struct {
	Rules []operation_setting.PaymentAutoSwitchGroupRule
	JSON  string
}

const paymentAutoSwitchGroupRulesRequiredMessage = "启用充值后自动切换分组前，请至少配置一条合法规则"

func normalizePaymentAutoSwitchGroupBaseGroup(baseGroup string) string {
	trimmed := strings.TrimSpace(baseGroup)
	if trimmed == "" {
		return "default"
	}
	return trimmed
}

func isValidPaymentAutoSwitchGroup(group string) bool {
	group = strings.TrimSpace(group)
	if group == "" {
		return false
	}
	_, ok := ratio_setting.GetGroupRatioCopy()[group]
	return ok
}

func marshalPaymentAutoSwitchGroupRules(rules []operation_setting.PaymentAutoSwitchGroupRule) (string, error) {
	if len(rules) == 0 {
		rules = []operation_setting.PaymentAutoSwitchGroupRule{}
	}
	jsonBytes, err := common.Marshal(rules)
	if err != nil {
		return "", err
	}
	return string(jsonBytes), nil
}

func normalizePaymentAutoSwitchGroupRulesList(rules []operation_setting.PaymentAutoSwitchGroupRule) (*normalizedPaymentAutoSwitchGroupRules, error) {
	normalizedRules := make([]operation_setting.PaymentAutoSwitchGroupRule, 0, len(rules))
	seenThresholds := make(map[string]struct{}, len(rules))
	for idx, rule := range rules {
		group := strings.TrimSpace(rule.Group)
		if math.IsNaN(rule.ThresholdUSD) || math.IsInf(rule.ThresholdUSD, 0) || rule.ThresholdUSD <= 0 {
			return nil, fmt.Errorf("第 %d 条充值自动切换分组规则的阈值必须大于 0", idx+1)
		}
		if !isValidPaymentAutoSwitchGroup(group) {
			return nil, fmt.Errorf("第 %d 条充值自动切换分组规则的分组不存在", idx+1)
		}
		thresholdKey := strconv.FormatFloat(rule.ThresholdUSD, 'f', -1, 64)
		if _, exists := seenThresholds[thresholdKey]; exists {
			return nil, fmt.Errorf("充值自动切换分组规则存在重复阈值: %s USD", thresholdKey)
		}
		seenThresholds[thresholdKey] = struct{}{}
		normalizedRules = append(normalizedRules, operation_setting.PaymentAutoSwitchGroupRule{
			ThresholdUSD: rule.ThresholdUSD,
			Group:        group,
		})
	}

	sort.Slice(normalizedRules, func(i, j int) bool {
		return normalizedRules[i].ThresholdUSD < normalizedRules[j].ThresholdUSD
	})

	normalizedJSON, err := marshalPaymentAutoSwitchGroupRules(normalizedRules)
	if err != nil {
		return nil, err
	}
	return &normalizedPaymentAutoSwitchGroupRules{Rules: normalizedRules, JSON: normalizedJSON}, nil
}

func finalizeRequestedPaymentAutoSwitchGroupState(currentState *operation_setting.PaymentSetting, enabled bool, onlyNewTopups bool) (bool, bool, int64) {
	enabledFrom := int64(0)
	currentEnabled := false
	currentOnlyNewTopups := false
	currentEnabledFrom := int64(0)
	if currentState != nil {
		currentEnabled = currentState.AutoSwitchGroupEnabled
		currentOnlyNewTopups = currentState.AutoSwitchGroupOnlyNewTopups
		currentEnabledFrom = currentState.AutoSwitchGroupEnabledFrom
	}

	onlyNewTopups = enabled && onlyNewTopups
	if enabled && onlyNewTopups {
		enabledFrom = currentEnabledFrom
		if !currentEnabled || !currentOnlyNewTopups {
			enabledFrom = common.GetTimestamp() + 1
		}
	}
	return enabled, onlyNewTopups, enabledFrom
}

func buildPaymentAutoSwitchGroupOptionValues(normalizedBaseGroup string, normalizedRules *normalizedPaymentAutoSwitchGroupRules, enabled bool, onlyNewTopups bool, enabledFrom int64) map[string]string {
	return map[string]string{
		"payment_setting.auto_switch_group_base_group":      normalizedBaseGroup,
		"payment_setting.auto_switch_group_rules":           normalizedRules.JSON,
		"payment_setting.auto_switch_group_enabled":         strconv.FormatBool(enabled),
		"payment_setting.auto_switch_group_only_new_topups": strconv.FormatBool(onlyNewTopups),
		"payment_setting.auto_switch_group_enabled_from":    strconv.FormatInt(enabledFrom, 10),
	}
}

func UpdatePaymentAutoSwitchGroup(c *gin.Context) {
	var request PaymentAutoSwitchGroupUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	normalizedBaseGroup := normalizePaymentAutoSwitchGroupBaseGroup(request.BaseGroup)
	if !isValidPaymentAutoSwitchGroup(normalizedBaseGroup) {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "充值自动切换分组的基础分组不存在",
		})
		return
	}

	normalizedRules, err := normalizePaymentAutoSwitchGroupRulesList(request.Rules)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	if request.Enabled && len(normalizedRules.Rules) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": paymentAutoSwitchGroupRulesRequiredMessage,
		})
		return
	}

	enabled, onlyNewTopups, enabledFrom := finalizeRequestedPaymentAutoSwitchGroupState(
		operation_setting.GetPaymentSetting(),
		request.Enabled,
		request.OnlyNewTopups,
	)
	optionValues := buildPaymentAutoSwitchGroupOptionValues(normalizedBaseGroup, normalizedRules, enabled, onlyNewTopups, enabledFrom)
	if err := model.UpdateOptions(optionValues); err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func UpdateOption(c *gin.Context) {
	var option OptionUpdateRequest
	err := common.DecodeJson(c.Request.Body, &option)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	switch option.Value.(type) {
	case bool:
		option.Value = common.Interface2String(option.Value.(bool))
	case float64:
		option.Value = common.Interface2String(option.Value.(float64))
	case int:
		option.Value = common.Interface2String(option.Value.(int))
	default:
		option.Value = fmt.Sprintf("%v", option.Value)
	}
	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})

			return
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "缓存创建倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
	return
}
