package controller

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/billing_setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/gin-gonic/gin"
)

var completionRatioMetaOptionKeys = []string{
	"ModelPrice",
	"ImageResolutionPrice",
	"ModelRatio",
	"CompletionRatio",
	"CacheRatio",
	"CreateCacheRatio",
	"ImageRatio",
	"AudioRatio",
	"AudioCompletionRatio",
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
	common.OptionRuntimeRWMutex.RLock()
	defer common.OptionRuntimeRWMutex.RUnlock()
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
	Key           string  `json:"key"`
	Value         any     `json:"value"`
	ExpectedValue *string `json:"expected_value,omitempty"`
}

type OptionBatchUpdateRequest struct {
	Updates []OptionUpdateRequest `json:"updates"`
}

var atomicOptionUpdateKeys = map[string]struct{}{
	"ModelPrice":                   {},
	"ImageResolutionPrice":         {},
	"ModelRatio":                   {},
	"CacheRatio":                   {},
	"CreateCacheRatio":             {},
	"CompletionRatio":              {},
	"ImageRatio":                   {},
	"AudioRatio":                   {},
	"AudioCompletionRatio":         {},
	"ExposeRatioEnabled":           {},
	"billing_setting.billing_mode": {},
	"billing_setting.billing_expr": {},
	"GroupRatio":                   {},
	"TopupGroupRatio":              {},
	"UserUsableGroups":             {},
	"GroupGroupRatio":              {},
	"AutoGroups":                   {},
	"DefaultUseAutoGroup":          {},
	"group_ratio_setting.group_special_usable_group": {},
}

func optionValueString(value any) string {
	switch typed := value.(type) {
	case bool:
		return common.Interface2String(typed)
	case float64:
		return common.Interface2String(typed)
	case int:
		return common.Interface2String(typed)
	default:
		return fmt.Sprintf("%v", value)
	}
}

func validateFloatMapJSONString(value string) error {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	parsed := make(map[string]float64)
	return common.UnmarshalJsonStr(value, &parsed)
}

func validateAtomicOptionUpdates(values map[string]string) error {
	for key, value := range values {
		if _, ok := atomicOptionUpdateKeys[key]; !ok {
			return fmt.Errorf("option %q does not support atomic batch updates", key)
		}
		switch key {
		case "ImageResolutionPrice":
			if err := ratio_setting.ValidateImageResolutionPriceJSONString(value); err != nil {
				return fmt.Errorf("invalid ImageResolutionPrice: %w", err)
			}
		case "GroupRatio":
			if err := ratio_setting.CheckGroupRatio(value); err != nil {
				return fmt.Errorf("invalid GroupRatio: %w", err)
			}
		case "ModelPrice", "ModelRatio", "CacheRatio", "CreateCacheRatio", "CompletionRatio",
			"ImageRatio", "AudioRatio", "AudioCompletionRatio", "TopupGroupRatio":
			parsed := make(map[string]float64)
			if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
				return fmt.Errorf("invalid %s: %w", key, err)
			}
		case "GroupGroupRatio":
			parsed := make(map[string]map[string]float64)
			if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
				return fmt.Errorf("invalid GroupGroupRatio: %w", err)
			}
		case "UserUsableGroups":
			parsed := make(map[string]string)
			if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
				return fmt.Errorf("invalid UserUsableGroups: %w", err)
			}
		case "group_ratio_setting.group_special_usable_group":
			parsed := make(map[string]map[string]string)
			if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
				return fmt.Errorf("invalid group special usable group: %w", err)
			}
		case "AutoGroups":
			var parsed []string
			if err := common.UnmarshalJsonStr(value, &parsed); err != nil {
				return fmt.Errorf("invalid AutoGroups: %w", err)
			}
		case "ExposeRatioEnabled", "DefaultUseAutoGroup":
			if value != "true" && value != "false" {
				return fmt.Errorf("invalid %s: expected true or false", key)
			}
		case "billing_setting.billing_mode":
			modes := make(map[string]string)
			if err := common.UnmarshalJsonStr(value, &modes); err != nil {
				return fmt.Errorf("invalid billing mode: %w", err)
			}
			for modelName, mode := range modes {
				if mode != billing_setting.BillingModeRatio && mode != billing_setting.BillingModeTieredExpr {
					return fmt.Errorf("invalid billing mode %q for model %q", mode, modelName)
				}
			}
		case "billing_setting.billing_expr":
			expressions := make(map[string]string)
			if err := common.UnmarshalJsonStr(value, &expressions); err != nil {
				return fmt.Errorf("invalid billing expression map: %w", err)
			}
			for modelName, expression := range expressions {
				if strings.TrimSpace(expression) == "" {
					return fmt.Errorf("billing expression for model %q is empty", modelName)
				}
				if err := billing_setting.SmokeTestExpr(expression); err != nil {
					return fmt.Errorf("invalid billing expression for model %q: %w", modelName, err)
				}
			}
		}
	}

	modeValue, hasModes := values["billing_setting.billing_mode"]
	expressionValue, hasExpressions := values["billing_setting.billing_expr"]
	if !hasModes && !hasExpressions {
		return nil
	}
	if hasModes != hasExpressions {
		return fmt.Errorf("billing mode and billing expression must be updated together")
	}
	common.OptionRuntimeRWMutex.RLock()
	defer common.OptionRuntimeRWMutex.RUnlock()
	modes := billing_setting.GetBillingModeCopy()
	if hasModes {
		modes = make(map[string]string)
		if err := common.UnmarshalJsonStr(modeValue, &modes); err != nil {
			return err
		}
	}
	expressions := billing_setting.GetBillingExprCopy()
	if hasExpressions {
		expressions = make(map[string]string)
		if err := common.UnmarshalJsonStr(expressionValue, &expressions); err != nil {
			return err
		}
	}
	for modelName, mode := range modes {
		if mode == billing_setting.BillingModeTieredExpr && strings.TrimSpace(expressions[modelName]) == "" {
			return fmt.Errorf("tiered_expr billing for model %q requires an expression", modelName)
		}
	}
	return nil
}

func parseAtomicOptionUpdates(updates []OptionUpdateRequest, requireUpdates bool) (map[string]string, map[string]string, []string, error) {
	if len(updates) == 0 {
		if requireUpdates {
			return nil, nil, nil, fmt.Errorf("无效的批量参数")
		}
		return map[string]string{}, map[string]string{}, nil, nil
	}
	if len(updates) > 64 {
		return nil, nil, nil, fmt.Errorf("无效的批量参数")
	}

	values := make(map[string]string, len(updates))
	expectedValues := make(map[string]string, len(updates))
	keys := make([]string, 0, len(updates))
	for _, update := range updates {
		key := strings.TrimSpace(update.Key)
		if key == "" || key != update.Key {
			return nil, nil, nil, fmt.Errorf("无效的配置项名称")
		}
		if _, exists := values[key]; exists {
			return nil, nil, nil, fmt.Errorf("批量配置项不能重复")
		}
		values[key] = optionValueString(update.Value)
		if update.ExpectedValue != nil {
			expectedValues[key] = *update.ExpectedValue
		}
		keys = append(keys, key)
	}
	if err := validateAtomicOptionUpdates(values); err != nil {
		return nil, nil, nil, err
	}
	return values, expectedValues, keys, nil
}

func UpdateOptionsBatch(c *gin.Context) {
	var request OptionBatchUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "无效的批量参数"})
		return
	}
	values, expectedValues, keys, err := parseAtomicOptionUpdates(request.Updates, true)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": err.Error()})
		return
	}
	if err := model.UpdateAtomicOptionsBulk(values, expectedValues); err != nil {
		if errors.Is(err, model.ErrOptionUpdateConflict) {
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "配置已被其他管理员修改，请刷新后重试"})
			return
		}
		common.ApiError(c, err)
		return
	}
	recordManageAudit(c, "option.update_batch", map[string]interface{}{"keys": strings.Join(keys, ", ")})
	c.JSON(http.StatusOK, gin.H{"success": true, "message": ""})
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
	option.Value = optionValueString(option.Value)
	switch option.Key {
	case "QuotaForInviter", "QuotaForInvitee":
		if isPositiveOptionValue(option.Value.(string)) && !operation_setting.IsPaymentComplianceConfirmed() {
			common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
			return
		}
	default:
		if isPaymentComplianceOptionKey(option.Key) {
			common.ApiErrorMsg(c, "合规确认字段不允许通过通用设置接口修改")
			return
		}
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
	case "theme.frontend":
		if option.Value != "default" && option.Value != "classic" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无效的主题值，可选值：default（新版前端）、classic（经典前端）",
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
		err = validateFloatMapJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片倍率设置失败: " + err.Error(),
			})
			return
		}
	case "ImageResolutionPrice":
		err = ratio_setting.ValidateImageResolutionPriceJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "图片分辨率价格设置失败: " + err.Error(),
			})
			return
		}
	case "AudioRatio":
		err = validateFloatMapJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频倍率设置失败: " + err.Error(),
			})
			return
		}
	case "AudioCompletionRatio":
		err = validateFloatMapJSONString(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "音频补全倍率设置失败: " + err.Error(),
			})
			return
		}
	case "CreateCacheRatio":
		err = validateFloatMapJSONString(option.Value.(string))
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
	// 出于安全考虑只记录被修改的配置项名称，不记录配置值（可能含密钥等敏感信息）。
	recordManageAudit(c, "option.update", map[string]interface{}{
		"key": option.Key,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}
