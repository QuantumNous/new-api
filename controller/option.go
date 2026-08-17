package controller

import (
	"encoding/json"
	"fmt"
	"math"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/console_setting"
	"github.com/QuantumNous/new-api/setting/model_setting"
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
	common.OptionMapRWMutex.Lock()
	for k, v := range common.OptionMap {
		if k == "theme.frontend" {
			continue
		}
		value := common.Interface2String(v)
		if isSensitiveOptionKey(k) {
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

func isSensitiveOptionKey(key string) bool {
	return strings.HasSuffix(key, "Token") ||
		strings.HasSuffix(key, "Secret") ||
		strings.HasSuffix(key, "Key") ||
		strings.HasSuffix(key, "Cert") ||
		strings.HasSuffix(key, "Certificate") ||
		strings.HasSuffix(key, "Password") ||
		strings.HasSuffix(key, "secret") ||
		strings.HasSuffix(key, "api_key")
}

// GetOptionSecretStatus returns configured secret key names only. It never
// returns the values, which keeps the existing option-read boundary intact.
func GetOptionSecretStatus(c *gin.Context) {
	configured := make([]string, 0)
	common.OptionMapRWMutex.RLock()
	for key, value := range common.OptionMap {
		if isSensitiveOptionKey(key) && strings.TrimSpace(value) != "" {
			configured = append(configured, key)
		}
	}
	common.OptionMapRWMutex.RUnlock()
	sort.Strings(configured)
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"configured": configured,
		},
	})
}

type OptionUpdateRequest struct {
	Key   string `json:"key"`
	Value any    `json:"value"`
}

type OptionBulkUpdateRequest struct {
	Options map[string]any `json:"options"`
}

func normalizeOptionValue(value any) (string, error) {
	switch typed := value.(type) {
	case string:
		return typed, nil
	case bool:
		return common.Interface2String(typed), nil
	case float64:
		return common.Interface2String(typed), nil
	case int:
		return common.Interface2String(typed), nil
	default:
		return "", fmt.Errorf("配置项值只能是字符串、数值或布尔值")
	}
}

func optionSnapshot(overrides map[string]string) map[string]string {
	snapshot := make(map[string]string, len(common.OptionMap)+len(overrides))
	common.OptionMapRWMutex.RLock()
	for key, value := range common.OptionMap {
		snapshot[key] = value
	}
	common.OptionMapRWMutex.RUnlock()
	for key, value := range overrides {
		snapshot[key] = value
	}
	return snapshot
}

func optionValuePresent(snapshot map[string]string, key string) bool {
	return strings.TrimSpace(snapshot[key]) != ""
}

func optionListPresent(snapshot map[string]string, key string) bool {
	return len(strings.FieldsFunc(snapshot[key], func(r rune) bool {
		return r == ',' || r == '\n' || r == '\r'
	})) > 0
}

func validateJSON(value string) error {
	var decoded any
	return json.Unmarshal([]byte(value), &decoded)
}

func validateRatioMap(value string) error {
	var ratios map[string]float64
	return json.Unmarshal([]byte(value), &ratios)
}

func validateNestedRatioMap(value string) error {
	var ratios map[string]map[string]float64
	return json.Unmarshal([]byte(value), &ratios)
}

// validateOptionPatch is intentionally free of persistence and runtime side
// effects so a full patch can be checked before model.UpdateOptionsBulk opens
// its transaction. The current option map plus the patch forms the final state.
func validateOptionPatch(values map[string]string) error {
	snapshot := optionSnapshot(values)
	for key, value := range values {
		if key == "" {
			return fmt.Errorf("配置项名称不能为空")
		}
		if isPaymentComplianceOptionKey(key) {
			return fmt.Errorf("合规确认字段不允许通过通用设置接口修改")
		}
		if (key == "QuotaForInviter" || key == "QuotaForInvitee") && isPositiveOptionValue(value) && !operation_setting.IsPaymentComplianceConfirmed() {
			return fmt.Errorf("支付合规确认后才可设置邀请奖励")
		}

		switch key {
		case "GitHubOAuthEnabled":
			if value == "true" && (!optionValuePresent(snapshot, "GitHubClientId") || !optionValuePresent(snapshot, "GitHubClientSecret")) {
				return fmt.Errorf("无法启用 GitHub OAuth，请先填入 GitHub Client Id 以及 GitHub Client Secret！")
			}
		case "discord.enabled":
			if value == "true" && (!optionValuePresent(snapshot, "discord.client_id") || !optionValuePresent(snapshot, "discord.client_secret")) {
				return fmt.Errorf("无法启用 Discord OAuth，请先填入 Discord Client Id 以及 Discord Client Secret！")
			}
		case "oidc.enabled":
			if value == "true" && (!optionValuePresent(snapshot, "oidc.client_id") || !optionValuePresent(snapshot, "oidc.client_secret")) {
				return fmt.Errorf("无法启用 OIDC 登录，请先填入 OIDC Client Id 以及 OIDC Client Secret！")
			}
		case "LinuxDOOAuthEnabled":
			if value == "true" && (!optionValuePresent(snapshot, "LinuxDOClientId") || !optionValuePresent(snapshot, "LinuxDOClientSecret")) {
				return fmt.Errorf("无法启用 LinuxDO OAuth，请先填入 LinuxDO Client Id 以及 LinuxDO Client Secret！")
			}
		case "EmailDomainRestrictionEnabled":
			if value == "true" && !optionListPresent(snapshot, "EmailDomainWhitelist") {
				return fmt.Errorf("无法启用邮箱域名限制，请先填入限制的邮箱域名！")
			}
		case "WeChatAuthEnabled":
			if value == "true" && !optionValuePresent(snapshot, "WeChatServerAddress") {
				return fmt.Errorf("无法启用微信登录，请先填入微信登录相关配置信息！")
			}
		case "TurnstileCheckEnabled":
			if value == "true" && (!optionValuePresent(snapshot, "TurnstileSiteKey") || !optionValuePresent(snapshot, "TurnstileSecretKey")) {
				return fmt.Errorf("无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！")
			}
		case "TelegramOAuthEnabled":
			if value == "true" && !optionValuePresent(snapshot, "TelegramBotToken") {
				return fmt.Errorf("无法启用 Telegram OAuth，请先填入 Telegram Bot Token！")
			}
		case "theme.frontend":
			if value != "default" {
				return fmt.Errorf("Classic 前端已移除，主题只能设置为 default")
			}
		case "GroupRatio":
			if err := ratio_setting.CheckGroupRatio(value); err != nil {
				return err
			}
		case "GroupGroupRatio":
			if err := validateNestedRatioMap(value); err != nil {
				return err
			}
		case "ModelRatio", "ModelPrice", "CompletionRatio", "CacheRatio", "CreateCacheRatio", "ImageRatio", "AudioRatio", "AudioCompletionRatio", "TopupGroupRatio":
			if err := validateRatioMap(value); err != nil {
				return err
			}
		case "gemini.safety_settings":
			if err := model_setting.ValidateGeminiSafetySettings(value); err != nil {
				return err
			}
		case "claude.default_max_tokens":
			if err := model_setting.ValidateClaudeDefaultMaxTokens(value); err != nil {
				return err
			}
		case operation_setting.ToolPriceOptionKey:
			if err := operation_setting.ValidateToolPricesJSON(value); err != nil {
				return err
			}
		case "ModelRequestRateLimitGroup":
			if err := setting.CheckModelRequestRateLimitGroup(value); err != nil {
				return err
			}
		case "AutomaticDisableStatusCodes", "AutomaticRetryStatusCodes":
			if _, err := operation_setting.ParseHTTPStatusCodeRanges(value); err != nil {
				return err
			}
		case "console_setting.api_info":
			if err := console_setting.ValidateConsoleSettings(value, "ApiInfo"); err != nil {
				return err
			}
		case "console_setting.announcements":
			if err := console_setting.ValidateConsoleSettings(value, "Announcements"); err != nil {
				return err
			}
		case "console_setting.faq":
			if err := console_setting.ValidateConsoleSettings(value, "FAQ"); err != nil {
				return err
			}
		case "console_setting.uptime_kuma_groups":
			if err := console_setting.ValidateConsoleSettings(value, "UptimeKumaGroups"); err != nil {
				return err
			}
		case "Chats", "AutoGroups", "UserUsableGroups", "PayMethods", "WaffoPayMethods":
			if err := validateJSON(value); err != nil {
				return err
			}
		}
	}
	return nil
}

func writeOptionValidationError(c *gin.Context, err error) {
	c.JSON(http.StatusOK, gin.H{"success": false, "message": err.Error()})
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
	normalizedValue, err := normalizeOptionValue(option.Value)
	if err != nil {
		writeOptionValidationError(c, err)
		return
	}
	option.Value = normalizedValue
	if err = validateOptionPatch(map[string]string{option.Key: normalizedValue}); err != nil {
		writeOptionValidationError(c, err)
		return
	}
	switch option.Key {
	case "QuotaForInviter", "QuotaForInvitee", "AffiliateEnabled":
		if isPositiveOptionValue(option.Value.(string)) && !operation_setting.IsPaymentComplianceConfirmed() {
			common.ApiErrorI18n(c, i18n.MsgPaymentComplianceRequired)
			return
		}
	case "AffiliateActivatedAt":
		common.ApiErrorMsg(c, "邀请返利激活时间不允许直接修改")
		return
	default:
		if isPaymentComplianceOptionKey(option.Key) {
			common.ApiErrorMsg(c, "合规确认字段不允许通过通用设置接口修改")
			return
		}
	}
	switch option.Key {
	case "AffiliateEnabled":
		enabled, parseErr := strconv.ParseBool(option.Value.(string))
		if parseErr != nil {
			common.ApiErrorMsg(c, "邀请返利开关参数无效")
			return
		}
		if err := model.SetAffiliateProgramEnabled(enabled); err != nil {
			common.ApiError(c, err)
			return
		}
		recordManageAudit(c, "option.update", map[string]interface{}{"key": option.Key})
		common.ApiSuccess(c, nil)
		return
	case "AffiliateRegistrationRequired":
		if option.Value == "true" {
			if common.AffiliateActivatedAt <= 0 {
				common.ApiErrorMsg(c, "请先激活邀请返利计划")
				return
			}
			hasSeed, seedErr := model.HasActiveAffiliateSeed()
			if seedErr != nil {
				common.ApiError(c, seedErr)
				return
			}
			if !hasSeed {
				common.ApiErrorMsg(c, "至少需要一个有效的管理员或根用户邀请码")
				return
			}
		}
	case "AffiliateRebateRateBps":
		value, parseErr := strconv.Atoi(option.Value.(string))
		if parseErr != nil || value < 0 || value > 10000 {
			common.ApiErrorMsg(c, "返利比例必须在 0 到 10000 基点之间")
			return
		}
	case "AffiliateFreezeHours", "AffiliateDurationDays":
		value, parseErr := strconv.Atoi(option.Value.(string))
		if parseErr != nil || value < 0 {
			common.ApiErrorMsg(c, "邀请返利周期不能为负数")
			return
		}
	case "AffiliatePerInviteeCap":
		value, parseErr := strconv.ParseFloat(option.Value.(string), 64)
		if parseErr != nil || math.IsNaN(value) || math.IsInf(value, 0) || value < 0 {
			common.ApiErrorMsg(c, "单个受邀用户返利上限必须是非负有限数值")
			return
		}
	case "QuotaForInviter":
		if common.AffiliateActivatedAt > 0 && isPositiveOptionValue(option.Value.(string)) {
			common.ApiErrorMsg(c, "邀请返利计划激活后固定邀请人奖励已废弃")
			return
		}
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
		if option.Value != "default" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "Classic 前端已移除，主题只能设置为 default",
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
	case "gemini.safety_settings":
		err = model_setting.ValidateGeminiSafetySettings(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "claude.default_max_tokens":
		err = model_setting.ValidateClaudeDefaultMaxTokens(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case operation_setting.ToolPriceOptionKey:
		err = operation_setting.ValidateToolPricesJSON(option.Value.(string))
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
	// 出于安全考虑只记录被修改的配置项名称，不记录配置值（可能含密钥等敏感信息）。
	recordManageAudit(c, "option.update", map[string]interface{}{
		"key": option.Key,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// UpdateOptionsBulk validates a patch against its final configuration state
// before using the model-layer transaction to persist all values together.
func UpdateOptionsBulk(c *gin.Context) {
	var request OptionBulkUpdateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Options) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	values := make(map[string]string, len(request.Options))
	for key, value := range request.Options {
		normalizedValue, err := normalizeOptionValue(value)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
		values[key] = normalizedValue
	}
	if err := validateOptionPatch(values); err != nil {
		writeOptionValidationError(c, err)
		return
	}
	if err := model.UpdateOptionsBulk(values); err != nil {
		common.ApiError(c, err)
		return
	}

	keys := make([]string, 0, len(values))
	for key := range values {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	recordManageAudit(c, "option.bulk_update", map[string]interface{}{
		"keys": keys,
	})
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    gin.H{"keys": keys},
	})
}
