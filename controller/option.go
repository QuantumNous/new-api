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
	"github.com/QuantumNous/new-api/setting/config"
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

func isPaymentComplianceOptionKey(key string) bool {
	return strings.HasPrefix(key, "payment_setting.compliance_")
}

func hasConfiguredEmailDomainWhitelist() bool {
	for _, domain := range common.EmailDomainWhitelist {
		if strings.TrimSpace(domain) != "" {
			return true
		}
	}
	return false
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
	intValue, err := strconv.Atoi(strings.TrimSpace(value))
	return err == nil && intValue >= 0
}

func isTurnstileEnableOption(key string) bool {
	return key == "TurnstileCheckEnabled" || common.IsTurnstileScopedOptionKey(key)
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
		if strings.HasPrefix(k, common.EmailNotificationTemplateOptionPrefix) {
			continue
		}
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

func UpdatePasskeyDomains(c *gin.Context) {
	var request struct {
		Values       map[string]string `json:"values"`
		Preview      bool              `json:"preview"`
		Confirmation string            `json:"confirmation"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil || len(request.Values) == 0 {
		common.ApiErrorI18n(c, i18n.MsgInvalidParams)
		return
	}
	change, err := model.UpdatePasskeyDomainOptions(request.Values, request.Preview, request.Confirmation)
	if err != nil {
		var removal *model.PasskeyDomainRemovalError
		if errors.As(err, &removal) {
			c.JSON(http.StatusConflict, gin.H{
				"success": false,
				"code":    "PASSKEY_RP_ID_REMOVAL_CONFIRMATION_REQUIRED",
				"message": i18n.T(c, i18n.MsgPasskeyDomainRemovalConfirmationRequired),
				"data":    removal.Change,
			})
			return
		}
		if errors.Is(err, system_setting.ErrPasskeyRPIDUnavailable) {
			common.ApiErrorI18n(c, i18n.MsgPasskeyRPIDUnavailable)
			return
		}
		if errors.Is(err, system_setting.ErrPasskeyRPIDInvalid) {
			common.ApiErrorI18n(c, i18n.MsgPasskeyRPIDInvalid)
			return
		}
		common.ApiError(c, err)
		return
	}
	if !request.Preview {
		recordManageAudit(c, "option.passkey_domains_update", map[string]interface{}{
			"rp_id":         request.Values["passkey.rp_id"],
			"legacy_rp_ids": request.Values["passkey.legacy_rp_ids"],
			"origins":       request.Values["passkey.origins"],
		})
	}
	c.JSON(http.StatusOK, gin.H{"success": true, "message": "", "data": change})
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
	if model.IsPasskeyDomainOption(option.Key) {
		common.ApiErrorI18n(c, i18n.MsgPasskeyDomainOptionUseDedicatedAPI)
		return
	}
	if strings.HasPrefix(option.Key, "fetch_setting.") {
		if err := system_setting.ValidateFetchSettingOption(option.Key, option.Value.(string)); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	if strings.HasPrefix(option.Key, "loan_setting.") {
		// 放贷市场字段与官方日利率互相约束，任何 loan_setting 保存都按"应用后全量校验"
		// 处理：把本次改动应用到当前配置的副本再跑 ValidateLoanMarketSetting，
		// 保证不合法的市场配置无法入库（与 fetch_setting 的保存前校验同风格）。
		proposed := *operation_setting.GetLoanSetting()
		configKey := strings.TrimPrefix(option.Key, "loan_setting.")
		config.UpdateConfigFromMap(&proposed, map[string]string{configKey: option.Value.(string)})
		if err := operation_setting.ValidateLoanMarketSetting(&proposed); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
	if strings.HasPrefix(option.Key, "checkin_setting.") {
		// 签到概率/额度配置做保存前校验：负额度会倒扣用户余额，概率越界会让大额档 100% 命中
		proposed := *operation_setting.GetCheckinSetting()
		configKey := strings.TrimPrefix(option.Key, "checkin_setting.")
		config.UpdateConfigFromMap(&proposed, map[string]string{configKey: option.Value.(string)})
		if err := operation_setting.ValidateCheckinSetting(&proposed); err != nil {
			common.ApiErrorMsg(c, err.Error())
			return
		}
	}
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
	case common.BalanceLowNotifyEnabledOptionKey:
		if option.Value != "true" && option.Value != "false" {
			common.ApiErrorMsg(c, "余额不足提醒开关必须是布尔值")
			return
		}
	case common.EmailDefaultLanguageOptionKey:
		language := strings.TrimSpace(option.Value.(string))
		if !common.IsSupportedEmailLanguage(language) {
			common.ApiErrorMsg(c, "默认邮件语言无效，可选值：zh-CN、zh-TW、en")
			return
		}
		option.Value = language
	case "QuotaRemindThreshold":
		if !isNonNegativeIntegerOptionValue(option.Value.(string)) {
			common.ApiErrorMsg(c, "余额不足提醒阈值必须是非负整数")
			return
		}
	case "GitHubMinimumAccountAge":
		if !isNonNegativeIntegerOptionValue(option.Value.(string)) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "GitHub 账号最小注册时间必须是非负整数",
			})
			return
		}
	case "GitHubMinimumAccountAgeUnit":
		if !common.IsValidGitHubAccountAgeUnit(option.Value.(string)) {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "GitHub 账号注册时间单位无效，可选值：day、month、year",
			})
			return
		}
	case "SteamOAuthEnabled":
		if option.Value == "true" && common.SteamWebAPIKey == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 Steam 登录，请先填入 Steam Web API Key！",
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
	case "QQOAuthEnabled":
		if option.Value == "true" && common.QQClientId == "" {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "无法启用 QQ OAuth，请先填入 QQ App ID 以及 App Key！",
			})
			return
		}
	case "EmailDomainRestrictionEnabled", "EmailDomainRestrictionForBindingEnabled":
		if option.Value == "true" && !hasConfiguredEmailDomainWhitelist() {
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
	case "UserGroupConcurrencyLimit":
		err = setting.CheckUserGroupConcurrencyLimit(option.Value.(string))
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	case "HiddenUserGroups":
		err = setting.CheckHiddenUserGroups(option.Value.(string))
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
	case "DefaultSubscriptionPlans":
		option.Value, err = model.NormalizeDefaultSubscriptionPlansJSON(option.Value.(string))
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
	case "console_setting.friend_links":
		err = console_setting.ValidateConsoleSettings(option.Value.(string), "FriendLinks")
		if err != nil {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": err.Error(),
			})
			return
		}
	}
	if isTurnstileEnableOption(option.Key) && option.Value == "true" && common.TurnstileSiteKey == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无法启用 Turnstile 校验，请先填入 Turnstile 校验相关配置信息！",
		})
		return
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
