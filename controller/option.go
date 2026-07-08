package controller

import (
	"fmt"
	"net/http"
	"reflect"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
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

func isPricingDisplayOptionKey(key string) bool {
	switch key {
	case "ModelPrice",
		"ModelRatio",
		"CompletionRatio",
		"CacheRatio",
		"CreateCacheRatio",
		"ImageRatio",
		"AudioRatio",
		"AudioCompletionRatio",
		"GroupRatio",
		"GroupModelRatio",
		"UserUsableGroups",
		"group_ratio_setting.group_ratio",
		"group_ratio_setting.group_model_ratio",
		"billing_setting.billing_mode",
		"billing_setting.billing_expr":
		return true
	default:
		return false
	}
}

func invalidatePricingDisplayCachesForOptions(keys ...string) {
	for _, key := range keys {
		if isPricingDisplayOptionKey(key) {
			model.InvalidatePricingCache()
			InvalidateWebsitePricingCache()
			return
		}
	}
}

func isPaymentComplianceOptionKey(key string) bool {
	return strings.HasPrefix(key, "payment_setting.compliance_")
}

func isPositiveOptionValue(value string) bool {
	intValue, err := strconv.Atoi(strings.TrimSpace(value))
	if err == nil {
		return intValue > 0
	}
	floatValue, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	return err == nil && floatValue > 0
}

func isNonNegativeIntegerOptionValue(value string) bool {
	value = strings.TrimSpace(value)
	if value == "" {
		return false
	}
	intValue, err := strconv.Atoi(value)
	return err == nil && intValue >= 0
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

func parseStringSliceOptionValue(value any) ([]string, error) {
	if raw, ok := value.(string); ok {
		raw = strings.TrimSpace(raw)
		if raw == "" {
			return []string{}, nil
		}
		var patterns []string
		if strings.HasPrefix(raw, "[") {
			if err := common.UnmarshalJsonStr(raw, &patterns); err != nil {
				return nil, err
			}
			return patterns, nil
		}
		return strings.Split(strings.ReplaceAll(raw, "\r\n", "\n"), "\n"), nil
	}

	val := reflect.ValueOf(value)
	if !val.IsValid() {
		return []string{}, nil
	}
	if val.Kind() == reflect.Ptr {
		if val.IsNil() {
			return []string{}, nil
		}
		val = val.Elem()
	}
	if val.Kind() != reflect.Slice && val.Kind() != reflect.Array {
		return nil, fmt.Errorf("expected string slice option value, got %T", value)
	}

	patterns := make([]string, 0, val.Len())
	for i := 0; i < val.Len(); i++ {
		item := val.Index(i)
		if item.Kind() == reflect.Interface {
			if item.IsNil() {
				return nil, fmt.Errorf("expected string at index %d, got nil", i)
			}
			item = item.Elem()
		}
		if item.Kind() != reflect.String {
			return nil, fmt.Errorf("expected string at index %d, got %s", i, item.Kind())
		}
		patterns = append(patterns, item.String())
	}
	return patterns, nil
}

func normalizeStringSliceOptionValue(value any) (string, []string, error) {
	values, err := parseStringSliceOptionValue(value)
	if err != nil {
		return "", nil, err
	}
	normalized := make([]string, 0, len(values))
	for _, item := range values {
		item = strings.TrimSpace(item)
		if item != "" {
			normalized = append(normalized, item)
		}
	}
	raw, isString := value.(string)
	if isString && strings.HasPrefix(strings.TrimSpace(raw), "[") && reflect.DeepEqual(normalized, values) {
		return raw, normalized, nil
	}
	bytes, err := common.Marshal(normalized)
	if err != nil {
		return "", nil, err
	}
	return string(bytes), normalized, nil
}

func normalizeCodexPatternsOptionValue(value any) (string, error) {
	serialized, patterns, err := normalizeStringSliceOptionValue(value)
	if err != nil {
		return "", err
	}
	if err := operation_setting.ValidateCodexModelGovernancePatterns(patterns); err != nil {
		return "", err
	}
	return serialized, nil
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
		if isSensitiveKey {
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
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

type OptionsUpdateRequest struct {
	Options []OptionUpdateRequest `json:"options"`
}

func isBulkOptionUpdateKey(key string) bool {
	switch key {
	case "SidebarModulesAdmin", model.OptionKeyPlaygroundDefaultModel:
		return true
	default:
		return false
	}
}

func prepareOptionUpdate(c *gin.Context, option *OptionUpdateRequest) bool {
	var err error
	switch option.Key {
	case "codex_model_governance_setting.unsupported_message_patterns":
		option.Value, err = normalizeCodexPatternsOptionValue(option.Value)
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "codex_model_governance_setting.official_source_urls",
		"codex_model_governance_setting.official_lifecycle_terms":
		serialized, _, serializeErr := normalizeStringSliceOptionValue(option.Value)
		if serializeErr != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": serializeErr.Error(),
			})
			return false
		}
		option.Value = serialized
	default:
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
	}
	switch option.Key {
	case "QuotaForInviterMaxCount":
		if !isNonNegativeIntegerOptionValue(option.Value.(string)) {
			common.ApiErrorI18n(c, i18n.MsgQuotaInviterRewardLimitInvalid)
			return false
		}
	case "QuotaForInviter", "QuotaForInvitee":
		if isPositiveOptionValue(option.Value.(string)) && !operation_setting.IsPaymentComplianceConfirmed() {
			common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
			return false
		}
	default:
		if isPaymentComplianceOptionKey(option.Key) {
			common.ApiErrorMsg(c, "合规确认字段不允许通过通用设置接口修改")
			return false
		}
	}
	switch option.Key {
	case "GitHubOAuthEnabled":
		if option.Value == "true" && common.GitHubClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！",
			})
			return false
		}
	case "discord.enabled":
		if option.Value == "true" && system_setting.GetDiscordSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！",
			})
			return false
		}
	case "oidc.enabled":
		if option.Value == "true" && system_setting.GetOIDCSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！",
			})
			return false
		}
	case "google.enabled":
		if option.Value == "true" && system_setting.GetGoogleSettings().ClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Google OAuth，请先填入 Google Client Id 以及 Google Client Secret！",
			})
			return false
		}
	case "LinuxDOOAuthEnabled":
		if option.Value == "true" && common.LinuxDOClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！",
			})
			return false
		}
	case "EmailDomainRestrictionEnabled":
		if option.Value == "true" && len(common.EmailDomainWhitelist) == 0 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用邮箱域名限制，请先填入限制的邮箱域名！",
			})
			return false
		}
	case "WeChatAuthEnabled":
		if option.Value == "true" && common.WeChatServerAddress == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用微信登录，请先填入微信登录相关配置信息！",
			})
			return false
		}
	case "TurnstileCheckEnabled":
		if option.Value == "true" && common.TurnstileSiteKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
			})
			return false
		}
	case "TelegramOAuthEnabled":
		if option.Value == "true" && common.TelegramBotToken == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Telegram OAuth，请先填入 Telegram Bot Token！",
			})
			return false
		}
	case "theme.frontend":
		if option.Value != "default" && option.Value != "classic" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的主题值，可选值：default（新版前端）、classic（经典前端）",
			})
			return false
		}
	case "GroupRatio":
		err = ratio_setting.CheckGroupRatio(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return false
		}
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return false
		}
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return false
		}
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "缓存创建倍率设置失败: " + err.Error(),
			})
			return false
		}
	case "ModelRequestRateLimitGroup":
		err = setting.CheckModelRequestRateLimitGroup(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "AutomaticDisableStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "AutomaticRetryStatusCodes":
		_, err = operation_setting.ParseHTTPStatusCodeRanges(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "console_setting.api_info":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "ApiInfo")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "console_setting.announcements":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "Announcements")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "console_setting.faq":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FAQ")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	case "console_setting.uptime_kuma_groups":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "UptimeKumaGroups")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return false
		}
	}
	return true
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
	if !prepareOptionUpdate(c, &option) {
		return
	}
	err = model.UpdateOption(option.Key, option.Value.(string))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	invalidatePricingDisplayCachesForOptions(option.Key)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

func UpdateOptions(c *gin.Context) {
	var request OptionsUpdateRequest
	err := common.DecodeJson(c.Request.Body, &request)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}
	if len(request.Options) > 100 {
		common.ApiErrorI18n(c, i18n.MsgBatchTooMany, map[string]any{"Max": 100})
		return
	}

	values := make(map[string]string, len(request.Options))
	for i := range request.Options {
		if !isBulkOptionUpdateKey(request.Options[i].Key) {
			common.ApiErrorMsg(c, "该配置项不支持批量保存")
			return
		}
		value, ok := request.Options[i].Value.(string)
		if !ok {
			common.ApiErrorMsg(c, "配置项值必须为字符串")
			return
		}
		if !prepareOptionUpdate(c, &request.Options[i]) {
			return
		}
		values[request.Options[i].Key] = value
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}
	for key := range values {
		invalidatePricingDisplayCachesForOptions(key)
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
