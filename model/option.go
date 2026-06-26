package model

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting"
	"github.com/QuantumNous/new-api/setting/config"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/performance_setting"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"
	"gorm.io/gorm"
)

type Option struct {
	Key   string `json:"key" gorm:"primaryKey"`
	Value string `json:"value"`
}

const OptionKeyPlaygroundDefaultModel = "PlaygroundDefaultModel"

func AllOption() ([]*Option, error) {
	var options []*Option
	var err error
	err = DB.Find(&options).Error
	return options, err
}

func InitOptionMap() {
	common.OptionMapRWMutex.Lock()
	common.OptionMap = make(map[string]string)

	// 添加原有的系统配置
	common.OptionMap["FileUploadPermission"] = strconv.Itoa(common.FileUploadPermission)
	common.OptionMap["FileDownloadPermission"] = strconv.Itoa(common.FileDownloadPermission)
	common.OptionMap["ImageUploadPermission"] = strconv.Itoa(common.ImageUploadPermission)
	common.OptionMap["ImageDownloadPermission"] = strconv.Itoa(common.ImageDownloadPermission)
	common.OptionMap["PasswordLoginEnabled"] = strconv.FormatBool(common.PasswordLoginEnabled)
	common.OptionMap["PasswordRegisterEnabled"] = strconv.FormatBool(common.PasswordRegisterEnabled)
	common.OptionMap["EmailVerificationEnabled"] = strconv.FormatBool(common.EmailVerificationEnabled)
	common.OptionMap["GitHubOAuthEnabled"] = strconv.FormatBool(common.GitHubOAuthEnabled)
	common.OptionMap["LinuxDOOAuthEnabled"] = strconv.FormatBool(common.LinuxDOOAuthEnabled)
	common.OptionMap["TelegramOAuthEnabled"] = strconv.FormatBool(common.TelegramOAuthEnabled)
	common.OptionMap["WeChatAuthEnabled"] = strconv.FormatBool(common.WeChatAuthEnabled)
	common.OptionMap["TurnstileCheckEnabled"] = strconv.FormatBool(common.TurnstileCheckEnabled)
	common.OptionMap["RegisterEnabled"] = strconv.FormatBool(common.RegisterEnabled)
	common.OptionMap["AutomaticDisableChannelEnabled"] = strconv.FormatBool(common.AutomaticDisableChannelEnabled)
	common.OptionMap["AutomaticEnableChannelEnabled"] = strconv.FormatBool(common.AutomaticEnableChannelEnabled)
	common.OptionMap["LogConsumeEnabled"] = strconv.FormatBool(common.LogConsumeEnabled)
	common.OptionMap["DisplayInCurrencyEnabled"] = strconv.FormatBool(common.DisplayInCurrencyEnabled)
	common.OptionMap["DisplayTokenStatEnabled"] = strconv.FormatBool(common.DisplayTokenStatEnabled)
	common.OptionMap["DrawingEnabled"] = strconv.FormatBool(common.DrawingEnabled)
	common.OptionMap["TaskEnabled"] = strconv.FormatBool(common.TaskEnabled)
	common.OptionMap["DataExportEnabled"] = strconv.FormatBool(common.DataExportEnabled)
	common.OptionMap["ChannelDisableThreshold"] = strconv.FormatFloat(common.ChannelDisableThreshold, 'f', -1, 64)
	common.OptionMap["EmailDomainRestrictionEnabled"] = strconv.FormatBool(common.EmailDomainRestrictionEnabled)
	common.OptionMap["EmailAliasRestrictionEnabled"] = strconv.FormatBool(common.EmailAliasRestrictionEnabled)
	common.OptionMap["EmailDomainWhitelist"] = strings.Join(common.EmailDomainWhitelist, ",")
	common.OptionMap["SMTPServer"] = ""
	common.OptionMap["SMTPFrom"] = ""
	common.OptionMap["SMTPPort"] = strconv.Itoa(common.SMTPPort)
	common.OptionMap["SMTPAccount"] = ""
	common.OptionMap["SMTPToken"] = ""
	common.OptionMap["SMTPSSLEnabled"] = strconv.FormatBool(common.SMTPSSLEnabled)
	common.OptionMap["SMTPForceAuthLogin"] = strconv.FormatBool(common.SMTPForceAuthLogin)
	common.OptionMap["Notice"] = ""
	common.OptionMap["About"] = ""
	common.OptionMap["HomePageContent"] = ""
	common.OptionMap["Footer"] = common.Footer
	common.OptionMap["SystemName"] = common.SystemName
	common.OptionMap["Logo"] = common.Logo
	common.OptionMap["ServerAddress"] = ""
	common.OptionMap["WorkerUrl"] = system_setting.WorkerUrl
	common.OptionMap["WorkerValidKey"] = system_setting.WorkerValidKey
	common.OptionMap["WorkerAllowHttpImageRequestEnabled"] = strconv.FormatBool(system_setting.WorkerAllowHttpImageRequestEnabled)
	common.OptionMap["PayAddress"] = ""
	common.OptionMap["CustomCallbackAddress"] = ""
	common.OptionMap["EpayId"] = ""
	common.OptionMap["EpayKey"] = ""
	common.OptionMap["Price"] = strconv.FormatFloat(operation_setting.Price, 'f', -1, 64)
	common.OptionMap["USDExchangeRate"] = strconv.FormatFloat(operation_setting.USDExchangeRate, 'f', -1, 64)
	common.OptionMap["MinTopUp"] = strconv.Itoa(operation_setting.MinTopUp)
	common.OptionMap["StripeMinTopUp"] = strconv.Itoa(setting.StripeMinTopUp)
	common.OptionMap["StripeApiSecret"] = setting.StripeApiSecret
	common.OptionMap["StripeWebhookSecret"] = setting.StripeWebhookSecret
	common.OptionMap["StripePriceId"] = setting.StripePriceId
	common.OptionMap["StripePriceId20"] = setting.StripePriceId20
	common.OptionMap["StripePriceId200"] = setting.StripePriceId200
	common.OptionMap["StripePriceIdJPY"] = setting.StripePriceIdJPY
	common.OptionMap["StripePriceIdJPY20"] = setting.StripePriceIdJPY20
	common.OptionMap["StripePriceIdJPY200"] = setting.StripePriceIdJPY200
	common.OptionMap["StripePriceIdBRL"] = setting.StripePriceIdBRL
	common.OptionMap["StripePriceIdBRL20"] = setting.StripePriceIdBRL20
	common.OptionMap["StripePriceIdBRL200"] = setting.StripePriceIdBRL200
	common.OptionMap["StripeUnitPrice"] = strconv.FormatFloat(setting.StripeUnitPrice, 'f', -1, 64)
	common.OptionMap["StripePromotionCodesEnabled"] = strconv.FormatBool(setting.StripePromotionCodesEnabled)
	common.OptionMap["StripeCardBindEnabled"] = strconv.FormatBool(setting.StripeCardBindEnabled)
	common.OptionMap["StripeAutoChargeEnabled"] = strconv.FormatBool(setting.StripeAutoChargeEnabled)
	common.OptionMap["StripeAutoChargeThreshold"] = strconv.Itoa(setting.StripeAutoChargeThreshold)
	common.OptionMap["StripeAutoChargeAmount"] = strconv.Itoa(setting.StripeAutoChargeAmount)
	common.OptionMap["StripeNewUserBonusAmount"] = strconv.Itoa(setting.StripeNewUserBonusAmount)
	common.OptionMap["CreemApiKey"] = setting.CreemApiKey
	common.OptionMap["CreemProducts"] = setting.CreemProducts
	common.OptionMap["CreemTestMode"] = strconv.FormatBool(setting.CreemTestMode)
	common.OptionMap["CreemWebhookSecret"] = setting.CreemWebhookSecret
	common.OptionMap["WaffoEnabled"] = strconv.FormatBool(setting.WaffoEnabled)
	common.OptionMap["WaffoApiKey"] = setting.WaffoApiKey
	common.OptionMap["WaffoPrivateKey"] = setting.WaffoPrivateKey
	common.OptionMap["WaffoPublicCert"] = setting.WaffoPublicCert
	common.OptionMap["WaffoSandboxPublicCert"] = setting.WaffoSandboxPublicCert
	common.OptionMap["WaffoSandboxApiKey"] = setting.WaffoSandboxApiKey
	common.OptionMap["WaffoSandboxPrivateKey"] = setting.WaffoSandboxPrivateKey
	common.OptionMap["WaffoSandbox"] = strconv.FormatBool(setting.WaffoSandbox)
	common.OptionMap["WaffoMerchantId"] = setting.WaffoMerchantId
	common.OptionMap["WaffoNotifyUrl"] = setting.WaffoNotifyUrl
	common.OptionMap["WaffoReturnUrl"] = setting.WaffoReturnUrl
	common.OptionMap["WaffoSubscriptionReturnUrl"] = setting.WaffoSubscriptionReturnUrl
	common.OptionMap["WaffoCurrency"] = setting.WaffoCurrency
	common.OptionMap["WaffoUnitPrice"] = strconv.FormatFloat(setting.WaffoUnitPrice, 'f', -1, 64)
	common.OptionMap["WaffoMinTopUp"] = strconv.Itoa(setting.WaffoMinTopUp)
	common.OptionMap["WaffoPayMethods"] = setting.WaffoPayMethods2JsonString()
	common.OptionMap["WaffoPancakeMerchantID"] = setting.WaffoPancakeMerchantID
	common.OptionMap["WaffoPancakePrivateKey"] = setting.WaffoPancakePrivateKey
	common.OptionMap["WaffoPancakeReturnURL"] = setting.WaffoPancakeReturnURL
	common.OptionMap["WaffoPancakeUnitPrice"] = strconv.FormatFloat(setting.WaffoPancakeUnitPrice, 'f', -1, 64)
	common.OptionMap["WaffoPancakeMinTopUp"] = strconv.Itoa(setting.WaffoPancakeMinTopUp)
	common.OptionMap["WaffoPancakeStoreID"] = setting.WaffoPancakeStoreID
	common.OptionMap["WaffoPancakeProductID"] = setting.WaffoPancakeProductID
	common.OptionMap["PaddleApiKey"] = setting.PaddleApiKey
	common.OptionMap["PaddleClientToken"] = setting.PaddleClientToken
	common.OptionMap["PaddleWebhookSecret"] = setting.PaddleWebhookSecret
	common.OptionMap["PaddleSandbox"] = strconv.FormatBool(setting.EffectivePaddleSandbox())
	common.OptionMap["PaddleProductId"] = setting.PaddleProductId
	common.OptionMap["PaddleCurrency"] = setting.PaddleCurrency
	common.OptionMap["PaddleUnitPrice"] = strconv.FormatFloat(setting.PaddleUnitPrice, 'f', -1, 64)
	common.OptionMap["PaddleMinTopUp"] = strconv.Itoa(setting.PaddleMinTopUp)
	common.OptionMap["TopupGroupRatio"] = common.TopupGroupRatio2JSONString()
	common.OptionMap["Chats"] = setting.Chats2JsonString()
	common.OptionMap["AutoGroups"] = setting.AutoGroups2JsonString()
	common.OptionMap["DefaultUseAutoGroup"] = strconv.FormatBool(setting.DefaultUseAutoGroup)
	common.OptionMap["PayMethods"] = operation_setting.PayMethods2JsonString()
	common.OptionMap["GitHubClientId"] = ""
	common.OptionMap["GitHubClientSecret"] = ""
	common.OptionMap["TelegramBotToken"] = ""
	common.OptionMap["TelegramBotName"] = ""
	common.OptionMap["WeChatServerAddress"] = ""
	common.OptionMap["WeChatServerToken"] = ""
	common.OptionMap["WeChatAccountQRCodeImageURL"] = ""
	common.OptionMap["TurnstileSiteKey"] = ""
	common.OptionMap["TurnstileSecretKey"] = ""
	common.OptionMap["QuotaForNewUser"] = strconv.Itoa(common.QuotaForNewUser)
	common.OptionMap["QuotaForInviter"] = strconv.Itoa(common.QuotaForInviter)
	common.OptionMap["QuotaForInvitee"] = strconv.Itoa(common.QuotaForInvitee)
	common.OptionMap["QuotaForInviterMaxCount"] = strconv.Itoa(common.QuotaForInviterMaxCount)
	common.OptionMap["QuotaRemindThreshold"] = strconv.Itoa(common.QuotaRemindThreshold)
	common.OptionMap["PreConsumedQuota"] = strconv.Itoa(common.PreConsumedQuota)
	common.OptionMap["ModelRequestRateLimitCount"] = strconv.Itoa(setting.ModelRequestRateLimitCount)
	common.OptionMap["ModelRequestRateLimitDurationMinutes"] = strconv.Itoa(setting.ModelRequestRateLimitDurationMinutes)
	common.OptionMap["ModelRequestRateLimitSuccessCount"] = strconv.Itoa(setting.ModelRequestRateLimitSuccessCount)
	common.OptionMap["ModelRequestRateLimitGroup"] = setting.ModelRequestRateLimitGroup2JSONString()
	common.OptionMap["ModelRatio"] = ratio_setting.ModelRatio2JSONString()
	common.OptionMap["ModelPrice"] = ratio_setting.ModelPrice2JSONString()
	common.OptionMap["CacheRatio"] = ratio_setting.CacheRatio2JSONString()
	common.OptionMap["CreateCacheRatio"] = ratio_setting.CreateCacheRatio2JSONString()
	common.OptionMap["GroupRatio"] = ratio_setting.GroupRatio2JSONString()
	common.OptionMap["GroupGroupRatio"] = ratio_setting.GroupGroupRatio2JSONString()
	common.OptionMap["UserUsableGroups"] = setting.UserUsableGroups2JSONString()
	common.OptionMap["CompletionRatio"] = ratio_setting.CompletionRatio2JSONString()
	common.OptionMap["ImageRatio"] = ratio_setting.ImageRatio2JSONString()
	common.OptionMap["AudioRatio"] = ratio_setting.AudioRatio2JSONString()
	common.OptionMap["AudioCompletionRatio"] = ratio_setting.AudioCompletionRatio2JSONString()
	common.OptionMap["TopUpLink"] = common.TopUpLink
	//common.OptionMap["ChatLink"] = common.ChatLink
	//common.OptionMap["ChatLink2"] = common.ChatLink2
	common.OptionMap["QuotaPerUnit"] = strconv.FormatFloat(common.QuotaPerUnit, 'f', -1, 64)
	common.OptionMap["RetryTimes"] = strconv.Itoa(common.RetryTimes)
	common.OptionMap["DataExportInterval"] = strconv.Itoa(common.DataExportInterval)
	common.OptionMap["DataExportDefaultTime"] = common.DataExportDefaultTime
	common.OptionMap["DefaultCollapseSidebar"] = strconv.FormatBool(common.DefaultCollapseSidebar)
	common.OptionMap[OptionKeyPlaygroundDefaultModel] = "gpt-4o"
	common.OptionMap["MjNotifyEnabled"] = strconv.FormatBool(setting.MjNotifyEnabled)
	common.OptionMap["MjAccountFilterEnabled"] = strconv.FormatBool(setting.MjAccountFilterEnabled)
	common.OptionMap["MjModeClearEnabled"] = strconv.FormatBool(setting.MjModeClearEnabled)
	common.OptionMap["MjForwardUrlEnabled"] = strconv.FormatBool(setting.MjForwardUrlEnabled)
	common.OptionMap["MjActionCheckSuccessEnabled"] = strconv.FormatBool(setting.MjActionCheckSuccessEnabled)
	common.OptionMap["CheckSensitiveEnabled"] = strconv.FormatBool(setting.CheckSensitiveEnabled)
	common.OptionMap["DemoSiteEnabled"] = strconv.FormatBool(operation_setting.DemoSiteEnabled)
	common.OptionMap["SelfUseModeEnabled"] = strconv.FormatBool(operation_setting.SelfUseModeEnabled)
	common.OptionMap["ModelRequestRateLimitEnabled"] = strconv.FormatBool(setting.ModelRequestRateLimitEnabled)
	common.OptionMap["CheckSensitiveOnPromptEnabled"] = strconv.FormatBool(setting.CheckSensitiveOnPromptEnabled)
	common.OptionMap["StopOnSensitiveEnabled"] = strconv.FormatBool(setting.StopOnSensitiveEnabled)
	common.OptionMap["SensitiveWords"] = setting.SensitiveWordsToString()
	common.OptionMap["StreamCacheQueueLength"] = strconv.Itoa(setting.StreamCacheQueueLength)
	common.OptionMap["AutomaticDisableKeywords"] = operation_setting.AutomaticDisableKeywordsToString()
	common.OptionMap["AutomaticDisableStatusCodes"] = operation_setting.AutomaticDisableStatusCodesToString()
	common.OptionMap["AutomaticRetryStatusCodes"] = operation_setting.AutomaticRetryStatusCodesToString()
	common.OptionMap["ExposeRatioEnabled"] = strconv.FormatBool(ratio_setting.IsExposeRatioEnabled())

	// 自动添加所有注册的模型配置
	modelConfigs := config.GlobalConfig.ExportAllConfigs()
	for k, v := range modelConfigs {
		common.OptionMap[k] = v
	}

	common.OptionMapRWMutex.Unlock()
	LoadOptionsFromDatabase()
}

func LoadOptionsFromDatabase() {
	options, _ := AllOption()
	for _, option := range options {
		err := updateOptionMap(option.Key, option.Value)
		if err != nil {
			common.SysLog("failed to update option map: " + err.Error())
		}
	}
	setting.ApplyPaddleEnvOverrides()
	syncPaddleOptionMap()
}

func syncPaddleOptionMap() {
	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()

	common.OptionMap["PaddleApiKey"] = setting.PaddleApiKey
	common.OptionMap["PaddleClientToken"] = setting.PaddleClientToken
	common.OptionMap["PaddleWebhookSecret"] = setting.PaddleWebhookSecret
	common.OptionMap["PaddleSandbox"] = strconv.FormatBool(setting.EffectivePaddleSandbox())
	common.OptionMap["PaddleProductId"] = setting.PaddleProductId
	common.OptionMap["PaddleCurrency"] = setting.PaddleCurrency
	common.OptionMap["PaddleUnitPrice"] = strconv.FormatFloat(setting.PaddleUnitPrice, 'f', -1, 64)
	common.OptionMap["PaddleMinTopUp"] = strconv.Itoa(setting.PaddleMinTopUp)
}

func SyncOptions(frequency int) {
	for {
		time.Sleep(time.Duration(frequency) * time.Second)
		common.SysLog("syncing options from database")
		LoadOptionsFromDatabase()
	}
}

func UpdateOption(key string, value string) error {
	normalizedValue, err := validateAndNormalizeOptionValue(key, value)
	if err != nil {
		return err
	}
	value = normalizedValue

	// Save to database first
	option := Option{
		Key: key,
	}
	DB.FirstOrCreate(&option, Option{Key: key})
	option.Value = value
	DB.Save(&option)

	// Update local OptionMap
	if err := updateOptionMap(key, value); err != nil {
		return err
	}
	if isPaddleOptionKey(key) {
		setting.ApplyPaddleEnvOverrides()
		syncPaddleOptionMap()
	}

	// Notify peer replicas via pubsub. Pubsub failures are logged but do not
	// fail the save — the 60s polling fallback (SyncOptions in main.go) will
	// eventually converge state.
	if pubErr := common.PublishConfigChanged(context.Background(), common.ConfigScopeOptions); pubErr != nil {
		common.SysError("pubsub: failed to publish options change: " + pubErr.Error())
	}
	return nil
}

// UpdateOptionsBulk persists multiple key/value pairs in a single database
// transaction, then dispatches them through updateOptionMap in one pass. If
// any DB write fails the whole transaction rolls back and no in-memory state
// is touched — safe for callers that must commit a set of related options
// atomically (e.g. payment gateway binding).
func UpdateOptionsBulk(values map[string]string) error {
	if len(values) == 0 {
		return nil
	}
	normalizedValues := make(map[string]string, len(values))
	var incomingAmountBonus map[int]int64
	if value, ok := values["payment_setting.amount_bonus"]; ok {
		normalizedValue, err := validateAndNormalizeOptionValue("payment_setting.amount_bonus", value)
		if err != nil {
			return err
		}
		normalizedValues["payment_setting.amount_bonus"] = normalizedValue
		if err := common.UnmarshalJsonStr(normalizedValue, &incomingAmountBonus); err != nil {
			return err
		}
	}
	for k, v := range values {
		if k == "payment_setting.amount_bonus" {
			continue
		}
		if k == "payment_setting.amount_bonus_groups" && incomingAmountBonus != nil {
			normalizedValue, err := normalizeAmountBonusGroupsOptionValueForBonusTiers(v, incomingAmountBonus)
			if err != nil {
				return err
			}
			normalizedValues[k] = normalizedValue
			continue
		}
		normalizedValue, err := validateAndNormalizeOptionValue(k, v)
		if err != nil {
			return err
		}
		normalizedValues[k] = normalizedValue
	}
	err := DB.Transaction(func(tx *gorm.DB) error {
		for k, v := range normalizedValues {
			option := Option{Key: k}
			if err := tx.FirstOrCreate(&option, Option{Key: k}).Error; err != nil {
				return err
			}
			option.Value = v
			if err := tx.Save(&option).Error; err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	for k, v := range normalizedValues {
		if err := applyOptionMapValue(k, v); err != nil {
			return err
		}
	}
	if hasPaddleOptionKey(normalizedValues) {
		setting.ApplyPaddleEnvOverrides()
		syncPaddleOptionMap()
	}
	if pubErr := common.PublishConfigChanged(context.Background(), common.ConfigScopeOptions); pubErr != nil {
		common.SysError("pubsub: failed to publish options change: " + pubErr.Error())
	}
	return nil
}

func validateAndNormalizeOptionValue(key string, value string) (string, error) {
	if err := setting.ValidatePaddleOption(key, value); err != nil {
		return "", err
	}
	if key == "payment_setting.amount_bonus" {
		return normalizeAmountBonusOptionValue(value)
	}
	if key == "payment_setting.amount_bonus_limit" {
		return normalizeAmountBonusLimitOptionValue(value)
	}
	if key == "payment_setting.amount_bonus_groups" {
		return normalizeAmountBonusGroupsOptionValue(value)
	}
	if key == "QuotaForInviterMaxCount" {
		maxCount, err := parseInviterRewardMaxCount(value)
		if err != nil {
			return "", err
		}
		return strconv.Itoa(maxCount), nil
	}
	return value, nil
}

func normalizeAmountBonusOptionValue(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}", nil
	}

	var bonuses map[int]int64
	if err := common.UnmarshalJsonStr(trimmed, &bonuses); err != nil {
		return "", errors.New("充值赠送配置必须是充值金额到赠送额度的 JSON 对象")
	}
	if bonuses == nil {
		return "", errors.New("充值赠送配置必须是充值金额到赠送额度的 JSON 对象")
	}
	for amount, bonus := range bonuses {
		if amount <= 0 || bonus <= 0 {
			return "", errors.New("充值赠送配置的充值金额和赠送额度必须为正整数")
		}
	}
	return trimmed, nil
}

func normalizeAmountBonusLimitOptionValue(value string) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}", nil
	}

	var limits map[int]int
	if err := common.UnmarshalJsonStr(trimmed, &limits); err != nil {
		return "", errors.New("充值赠送次数限制必须是充值金额到次数的 JSON 对象")
	}
	if limits == nil {
		return "", errors.New("充值赠送次数限制必须是充值金额到次数的 JSON 对象")
	}
	for amount, limit := range limits {
		if amount <= 0 || limit < 0 {
			return "", errors.New("充值赠送次数限制的充值金额必须为正、次数必须为非负整数")
		}
	}
	return trimmed, nil
}

func normalizeAmountBonusGroupsOptionValue(value string) (string, error) {
	return normalizeAmountBonusGroupsOptionValueForBonusTiers(
		value,
		operation_setting.GetPaymentSetting().AmountBonus,
	)
}

func normalizeAmountBonusGroupsOptionValueForBonusTiers(value string, bonusTiers map[int]int64) (string, error) {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return "{}", nil
	}

	var groups map[int][]string
	if err := common.UnmarshalJsonStr(trimmed, &groups); err != nil {
		return "", errors.New("充值赠送用户组白名单必须是充值金额到用户组数组的 JSON 对象")
	}
	if groups == nil {
		return "", errors.New("充值赠送用户组白名单必须是充值金额到用户组数组的 JSON 对象")
	}

	// 真实用户身份组集合：用于检测保留关键字 "all" 冲突。"all" 是白名单里「全部用户组」的
	// 通配符（对应 controller.TopUpBonusGroupAll），若系统里真存在名为 all 的用户组，
	// 白名单中的 all 将无法区分「通配符」与「该组」，故拒绝这种有歧义的配置。
	realUserGroups := make(map[string]struct{})
	for _, name := range common.GetTopupGroupRatioKeys() {
		realUserGroups[name] = struct{}{}
	}
	for _, name := range ratio_setting.GetGroupGroupRatioKeys() {
		realUserGroups[name] = struct{}{}
	}

	// 组名是精确匹配的标识符：trim 后落库，避免带首尾空格的组名（如 " plg "）通过校验、
	// 却在发放时因精确匹配永不命中而静默不发赠送。归一化后重新序列化存储。
	const allKeyword = "all" // 与 controller.TopUpBonusGroupAll 保持一致
	normalized := make(map[int][]string, len(groups))
	for amount, names := range groups {
		if amount <= 0 {
			return "", errors.New("充值赠送用户组白名单的充值金额必须为正整数")
		}
		// 白名单只能挂在已存在的赠送档位上；孤儿档位静默丢弃，不落库。
		if _, ok := bonusTiers[amount]; !ok {
			continue
		}
		cleaned := make([]string, 0, len(names))
		for _, name := range names {
			trimmedName := strings.TrimSpace(name)
			if trimmedName == "" {
				return "", errors.New("充值赠送用户组白名单的用户组名不能为空")
			}
			if trimmedName == allKeyword {
				if _, conflict := realUserGroups[allKeyword]; conflict {
					return "", errors.New("用户组名 all 与保留关键字冲突：all 仅表示「全部用户组」，请重命名该用户组后再配置赠送白名单")
				}
			}
			cleaned = append(cleaned, trimmedName)
		}
		normalized[amount] = cleaned
	}
	out, err := common.Marshal(normalized)
	if err != nil {
		return "", errors.New("充值赠送用户组白名单序列化失败")
	}
	return string(out), nil
}

func isPaddleOptionKey(key string) bool {
	return key == "PaddleApiKey" ||
		key == "PaddleClientToken" ||
		key == "PaddleWebhookSecret" ||
		key == "PaddleSandbox" ||
		key == "PaddleProductId" ||
		key == "PaddleCurrency" ||
		key == "PaddleUnitPrice" ||
		key == "PaddleMinTopUp"
}

func hasPaddleOptionKey(values map[string]string) bool {
	for key := range values {
		if isPaddleOptionKey(key) {
			return true
		}
	}
	return false
}

func updateOptionMap(key string, value string) (err error) {
	normalizedValue, err := validateAndNormalizeOptionValue(key, value)
	if err != nil {
		return err
	}
	return applyOptionMapValue(key, normalizedValue)
}

func applyOptionMapValue(key string, value string) (err error) {
	var inviterRewardMaxCount int
	if key == "QuotaForInviterMaxCount" {
		inviterRewardMaxCount, err = parseInviterRewardMaxCount(value)
		if err != nil {
			return err
		}
	}

	common.OptionMapRWMutex.Lock()
	defer common.OptionMapRWMutex.Unlock()
	common.OptionMap[key] = value

	// 检查是否是模型配置 - 使用更规范的方式处理
	if handleConfigUpdate(key, value) {
		return nil // 已由配置系统处理
	}

	// 处理传统配置项...
	if strings.HasSuffix(key, "Permission") {
		intValue, _ := strconv.Atoi(value)
		switch key {
		case "FileUploadPermission":
			common.FileUploadPermission = intValue
		case "FileDownloadPermission":
			common.FileDownloadPermission = intValue
		case "ImageUploadPermission":
			common.ImageUploadPermission = intValue
		case "ImageDownloadPermission":
			common.ImageDownloadPermission = intValue
		}
	}
	if strings.HasSuffix(key, "Enabled") || key == "DefaultCollapseSidebar" || key == "DefaultUseAutoGroup" || key == "SMTPForceAuthLogin" {
		boolValue := value == "true"
		switch key {
		case "PasswordRegisterEnabled":
			common.PasswordRegisterEnabled = boolValue
		case "PasswordLoginEnabled":
			common.PasswordLoginEnabled = boolValue
		case "EmailVerificationEnabled":
			common.EmailVerificationEnabled = boolValue
		case "GitHubOAuthEnabled":
			common.GitHubOAuthEnabled = boolValue
		case "LinuxDOOAuthEnabled":
			common.LinuxDOOAuthEnabled = boolValue
		case "WeChatAuthEnabled":
			common.WeChatAuthEnabled = boolValue
		case "TelegramOAuthEnabled":
			common.TelegramOAuthEnabled = boolValue
		case "TurnstileCheckEnabled":
			common.TurnstileCheckEnabled = boolValue
		case "RegisterEnabled":
			common.RegisterEnabled = boolValue
		case "EmailDomainRestrictionEnabled":
			common.EmailDomainRestrictionEnabled = boolValue
		case "EmailAliasRestrictionEnabled":
			common.EmailAliasRestrictionEnabled = boolValue
		case "AutomaticDisableChannelEnabled":
			common.AutomaticDisableChannelEnabled = boolValue
		case "AutomaticEnableChannelEnabled":
			common.AutomaticEnableChannelEnabled = boolValue
		case "LogConsumeEnabled":
			common.LogConsumeEnabled = boolValue
		case "DisplayInCurrencyEnabled":
			// 兼容旧字段：同步到新配置 general_setting.quota_display_type（运行时生效）
			// true -> USD, false -> TOKENS
			newVal := "USD"
			if !boolValue {
				newVal = "TOKENS"
			}
			if cfg := config.GlobalConfig.Get("general_setting"); cfg != nil {
				_ = config.UpdateConfigFromMap(cfg, map[string]string{"quota_display_type": newVal})
			}
		case "DisplayTokenStatEnabled":
			common.DisplayTokenStatEnabled = boolValue
		case "DrawingEnabled":
			common.DrawingEnabled = boolValue
		case "TaskEnabled":
			common.TaskEnabled = boolValue
		case "DataExportEnabled":
			common.DataExportEnabled = boolValue
		case "DefaultCollapseSidebar":
			common.DefaultCollapseSidebar = boolValue
		case "MjNotifyEnabled":
			setting.MjNotifyEnabled = boolValue
		case "MjAccountFilterEnabled":
			setting.MjAccountFilterEnabled = boolValue
		case "MjModeClearEnabled":
			setting.MjModeClearEnabled = boolValue
		case "MjForwardUrlEnabled":
			setting.MjForwardUrlEnabled = boolValue
		case "MjActionCheckSuccessEnabled":
			setting.MjActionCheckSuccessEnabled = boolValue
		case "CheckSensitiveEnabled":
			setting.CheckSensitiveEnabled = boolValue
		case "DemoSiteEnabled":
			operation_setting.DemoSiteEnabled = boolValue
		case "SelfUseModeEnabled":
			operation_setting.SelfUseModeEnabled = boolValue
		case "CheckSensitiveOnPromptEnabled":
			setting.CheckSensitiveOnPromptEnabled = boolValue
		case "ModelRequestRateLimitEnabled":
			setting.ModelRequestRateLimitEnabled = boolValue
		case "StopOnSensitiveEnabled":
			setting.StopOnSensitiveEnabled = boolValue
		case "SMTPSSLEnabled":
			common.SMTPSSLEnabled = boolValue
		case "SMTPForceAuthLogin":
			common.SMTPForceAuthLogin = boolValue
		case "WorkerAllowHttpImageRequestEnabled":
			system_setting.WorkerAllowHttpImageRequestEnabled = boolValue
		case "DefaultUseAutoGroup":
			setting.DefaultUseAutoGroup = boolValue
		case "ExposeRatioEnabled":
			ratio_setting.SetExposeRatioEnabled(boolValue)
		}
	}
	switch key {
	case "EmailDomainWhitelist":
		common.EmailDomainWhitelist = strings.Split(value, ",")
	case "SMTPServer":
		common.SMTPServer = value
	case "SMTPPort":
		intValue, _ := strconv.Atoi(value)
		common.SMTPPort = intValue
	case "SMTPAccount":
		common.SMTPAccount = value
	case "SMTPFrom":
		common.SMTPFrom = value
	case "SMTPToken":
		common.SMTPToken = value
	case "ServerAddress":
		system_setting.ServerAddress = value
	case "WorkerUrl":
		system_setting.WorkerUrl = value
	case "WorkerValidKey":
		system_setting.WorkerValidKey = value
	case "PayAddress":
		operation_setting.PayAddress = value
	case "Chats":
		err = setting.UpdateChatsByJsonString(value)
	case "AutoGroups":
		err = setting.UpdateAutoGroupsByJsonString(value)
	case "CustomCallbackAddress":
		operation_setting.CustomCallbackAddress = value
	case "EpayId":
		operation_setting.EpayId = value
	case "EpayKey":
		operation_setting.EpayKey = value
	case "Price":
		operation_setting.Price, _ = strconv.ParseFloat(value, 64)
	case "USDExchangeRate":
		operation_setting.USDExchangeRate, _ = strconv.ParseFloat(value, 64)
	case "MinTopUp":
		operation_setting.MinTopUp, _ = strconv.Atoi(value)
	case "StripeApiSecret":
		setting.StripeApiSecret = value
	case "StripeWebhookSecret":
		setting.StripeWebhookSecret = value
	case "StripePriceId":
		setting.StripePriceId = value
	case "StripePriceId20":
		setting.StripePriceId20 = value
	case "StripePriceId200":
		setting.StripePriceId200 = value
	case "StripePriceIdJPY":
		setting.StripePriceIdJPY = value
	case "StripePriceIdJPY20":
		setting.StripePriceIdJPY20 = value
	case "StripePriceIdJPY200":
		setting.StripePriceIdJPY200 = value
	case "StripePriceIdBRL":
		setting.StripePriceIdBRL = value
	case "StripePriceIdBRL20":
		setting.StripePriceIdBRL20 = value
	case "StripePriceIdBRL200":
		setting.StripePriceIdBRL200 = value
	case "StripeUnitPrice":
		setting.StripeUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "StripeMinTopUp":
		setting.StripeMinTopUp, _ = strconv.Atoi(value)
	case "StripePromotionCodesEnabled":
		setting.StripePromotionCodesEnabled = value == "true"
	case "StripeCardBindEnabled":
		setting.StripeCardBindEnabled = value == "true"
	case "StripeAutoChargeEnabled":
		setting.StripeAutoChargeEnabled = value == "true"
	case "StripeAutoChargeThreshold":
		setting.StripeAutoChargeThreshold, _ = strconv.Atoi(value)
	case "StripeAutoChargeAmount":
		setting.StripeAutoChargeAmount, _ = strconv.Atoi(value)
	case "StripeNewUserBonusAmount":
		setting.StripeNewUserBonusAmount, _ = strconv.Atoi(value)
	case "CreemApiKey":
		setting.CreemApiKey = value
	case "CreemProducts":
		setting.CreemProducts = value
	case "CreemTestMode":
		setting.CreemTestMode = value == "true"
	case "CreemWebhookSecret":
		setting.CreemWebhookSecret = value
	case "WaffoEnabled":
		setting.WaffoEnabled = value == "true"
	case "WaffoApiKey":
		setting.WaffoApiKey = value
	case "WaffoPrivateKey":
		setting.WaffoPrivateKey = value
	case "WaffoPublicCert":
		setting.WaffoPublicCert = value
	case "WaffoSandboxPublicCert":
		setting.WaffoSandboxPublicCert = value
	case "WaffoSandboxApiKey":
		setting.WaffoSandboxApiKey = value
	case "WaffoSandboxPrivateKey":
		setting.WaffoSandboxPrivateKey = value
	case "WaffoSandbox":
		setting.WaffoSandbox = value == "true"
	case "WaffoMerchantId":
		setting.WaffoMerchantId = value
	case "WaffoNotifyUrl":
		setting.WaffoNotifyUrl = value
	case "WaffoReturnUrl":
		setting.WaffoReturnUrl = value
	case "WaffoSubscriptionReturnUrl":
		setting.WaffoSubscriptionReturnUrl = value
	case "WaffoCurrency":
		setting.WaffoCurrency = value
	case "WaffoUnitPrice":
		setting.WaffoUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "WaffoMinTopUp":
		setting.WaffoMinTopUp, _ = strconv.Atoi(value)
	case "WaffoPancakeMerchantID":
		setting.WaffoPancakeMerchantID = value
	case "WaffoPancakePrivateKey":
		setting.WaffoPancakePrivateKey = value
	case "WaffoPancakeReturnURL":
		setting.WaffoPancakeReturnURL = value
	case "WaffoPancakeStoreID":
		setting.WaffoPancakeStoreID = value
	case "WaffoPancakeProductID":
		setting.WaffoPancakeProductID = value
	case "WaffoPancakeUnitPrice":
		setting.WaffoPancakeUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "WaffoPancakeMinTopUp":
		setting.WaffoPancakeMinTopUp, _ = strconv.Atoi(value)
	case "PaddleApiKey":
		setting.PaddleApiKey = value
		common.OptionMap["PaddleSandbox"] = strconv.FormatBool(setting.EffectivePaddleSandbox())
	case "PaddleClientToken":
		setting.PaddleClientToken = value
		common.OptionMap["PaddleSandbox"] = strconv.FormatBool(setting.EffectivePaddleSandbox())
	case "PaddleWebhookSecret":
		setting.PaddleWebhookSecret = value
	case "PaddleSandbox":
		setting.PaddleSandbox = value == "true"
		common.OptionMap["PaddleSandbox"] = strconv.FormatBool(setting.EffectivePaddleSandbox())
	case "PaddleProductId":
		setting.PaddleProductId = value
	case "PaddleCurrency":
		setting.PaddleCurrency = value
	case "PaddleUnitPrice":
		setting.PaddleUnitPrice, _ = strconv.ParseFloat(value, 64)
	case "PaddleMinTopUp":
		setting.PaddleMinTopUp, _ = strconv.Atoi(value)
	case "TopupGroupRatio":
		err = common.UpdateTopupGroupRatioByJSONString(value)
	case "GitHubClientId":
		common.GitHubClientId = value
	case "GitHubClientSecret":
		common.GitHubClientSecret = value
	case "LinuxDOClientId":
		common.LinuxDOClientId = value
	case "LinuxDOClientSecret":
		common.LinuxDOClientSecret = value
	case "LinuxDOMinimumTrustLevel":
		common.LinuxDOMinimumTrustLevel, _ = strconv.Atoi(value)
	case "Footer":
		common.Footer = value
	case "SystemName":
		common.SystemName = value
	case "Logo":
		common.Logo = value
	case "WeChatServerAddress":
		common.WeChatServerAddress = value
	case "WeChatServerToken":
		common.WeChatServerToken = value
	case "WeChatAccountQRCodeImageURL":
		common.WeChatAccountQRCodeImageURL = value
	case "TelegramBotToken":
		common.TelegramBotToken = value
	case "TelegramBotName":
		common.TelegramBotName = value
	case "TurnstileSiteKey":
		common.TurnstileSiteKey = value
	case "TurnstileSecretKey":
		common.TurnstileSecretKey = value
	case "QuotaForNewUser":
		common.QuotaForNewUser, _ = strconv.Atoi(value)
	case "QuotaForInviter":
		common.QuotaForInviter, _ = strconv.Atoi(value)
	case "QuotaForInvitee":
		common.QuotaForInvitee, _ = strconv.Atoi(value)
	case "QuotaForInviterMaxCount":
		common.QuotaForInviterMaxCount = inviterRewardMaxCount
	case "QuotaRemindThreshold":
		common.QuotaRemindThreshold, _ = strconv.Atoi(value)
	case "PreConsumedQuota":
		common.PreConsumedQuota, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitCount":
		setting.ModelRequestRateLimitCount, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitDurationMinutes":
		setting.ModelRequestRateLimitDurationMinutes, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitSuccessCount":
		setting.ModelRequestRateLimitSuccessCount, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitGroup":
		err = setting.UpdateModelRequestRateLimitGroupByJSONString(value)
	case "RetryTimes":
		common.RetryTimes, _ = strconv.Atoi(value)
	case "DataExportInterval":
		common.DataExportInterval, _ = strconv.Atoi(value)
	case "DataExportDefaultTime":
		common.DataExportDefaultTime = value
	case "ModelRatio":
		err = ratio_setting.UpdateModelRatioByJSONString(value)
	case "GroupRatio":
		oldGroupRatio := ratio_setting.GetGroupRatioCopy()
		newGroupRatio := make(map[string]float64)
		err = common.UnmarshalJsonStr(value, &newGroupRatio)
		if err == nil {
			renames := inferGroupRatioRenames(oldGroupRatio, newGroupRatio)
			err = ratio_setting.UpdateGroupRatioByJSONString(value)
			if err == nil && len(renames) > 0 {
				err = syncRenamedGroupsToChannels(renames)
			}
		}
	case "GroupGroupRatio":
		err = ratio_setting.UpdateGroupGroupRatioByJSONString(value)
	case "UserUsableGroups":
		err = setting.UpdateUserUsableGroupsByJSONString(value)
	case "CompletionRatio":
		err = ratio_setting.UpdateCompletionRatioByJSONString(value)
	case "ModelPrice":
		err = ratio_setting.UpdateModelPriceByJSONString(value)
	case "CacheRatio":
		err = ratio_setting.UpdateCacheRatioByJSONString(value)
	case "CreateCacheRatio":
		err = ratio_setting.UpdateCreateCacheRatioByJSONString(value)
	case "ImageRatio":
		err = ratio_setting.UpdateImageRatioByJSONString(value)
	case "AudioRatio":
		err = ratio_setting.UpdateAudioRatioByJSONString(value)
	case "AudioCompletionRatio":
		err = ratio_setting.UpdateAudioCompletionRatioByJSONString(value)
	case "TopUpLink":
		common.TopUpLink = value
	//case "ChatLink":
	//	common.ChatLink = value
	//case "ChatLink2":
	//	common.ChatLink2 = value
	case "ChannelDisableThreshold":
		common.ChannelDisableThreshold, _ = strconv.ParseFloat(value, 64)
	case "QuotaPerUnit":
		common.QuotaPerUnit, _ = strconv.ParseFloat(value, 64)
	case "SensitiveWords":
		setting.SensitiveWordsFromString(value)
	case "AutomaticDisableKeywords":
		operation_setting.AutomaticDisableKeywordsFromString(value)
	case "AutomaticDisableStatusCodes":
		err = operation_setting.AutomaticDisableStatusCodesFromString(value)
	case "AutomaticRetryStatusCodes":
		err = operation_setting.AutomaticRetryStatusCodesFromString(value)
	case "StreamCacheQueueLength":
		setting.StreamCacheQueueLength, _ = strconv.Atoi(value)
	case "PayMethods":
		err = operation_setting.UpdatePayMethodsByJsonString(value)
	case "WaffoPayMethods":
		// WaffoPayMethods is read directly from OptionMap via setting.GetWaffoPayMethods().
		// The value is already stored in OptionMap at the top of this function (line: common.OptionMap[key] = value).
		// No additional in-memory variable to update.
	}
	return err
}

// handleConfigUpdate 处理分层配置更新，返回是否已处理
func handleConfigUpdate(key, value string) bool {
	parts := strings.SplitN(key, ".", 2)
	if len(parts) != 2 {
		return false // 不是分层配置
	}

	configName := parts[0]
	configKey := parts[1]

	// 获取配置对象
	cfg := config.GlobalConfig.Get(configName)
	if cfg == nil {
		return false // 未注册的配置
	}

	// 更新配置
	configMap := map[string]string{
		configKey: value,
	}
	config.UpdateConfigFromMap(cfg, configMap)

	// 特定配置的后处理
	if configName == "performance_setting" {
		performance_setting.UpdateAndSync()
	} else if configName == "tool_price_setting" {
		operation_setting.RebuildToolPriceIndex()
	} else if configName == "billing_setting" {
		InvalidatePricingCache()
		ratio_setting.InvalidateExposedDataCache()
	} else if configName == "theme" {
		system_setting.UpdateAndSyncTheme()
	}

	return true // 已处理
}

func inferGroupRatioRenames(oldGroupRatio, newGroupRatio map[string]float64) map[string]string {
	removed := make([]string, 0)
	added := make([]string, 0)
	for oldName := range oldGroupRatio {
		if _, ok := newGroupRatio[oldName]; !ok {
			removed = append(removed, oldName)
		}
	}
	for newName := range newGroupRatio {
		if _, ok := oldGroupRatio[newName]; !ok {
			added = append(added, newName)
		}
	}
	if len(removed) != 1 || len(added) != 1 {
		return nil
	}
	oldName := strings.TrimSpace(removed[0])
	newName := strings.TrimSpace(added[0])
	if oldName == "" || newName == "" || oldName == newName {
		return nil
	}
	return map[string]string{oldName: newName}
}

func syncRenamedGroupsToChannels(renames map[string]string) error {
	changed := false
	err := DB.Transaction(func(tx *gorm.DB) error {
		for oldName, newName := range renames {
			var channels []*Channel
			if err := ApplyChannelGroupFilter(tx.Model(&Channel{}), oldName).Find(&channels).Error; err != nil {
				return err
			}
			for _, channel := range channels {
				updatedGroup, didChange := replaceChannelGroupName(channel.Group, oldName, newName)
				if !didChange {
					continue
				}
				channel.Group = updatedGroup
				if err := tx.Model(&Channel{}).Where("id = ?", channel.Id).Update("group", updatedGroup).Error; err != nil {
					return err
				}
				if err := channel.UpdateAbilities(tx); err != nil {
					return err
				}
				changed = true
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	if changed {
		publishChannelsChanged()
	}
	return nil
}

func parseInviterRewardMaxCount(value string) (int, error) {
	maxCount, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || maxCount < 0 {
		return 0, errors.New("inviter reward limit must be a non-negative integer")
	}
	return maxCount, nil
}

func replaceChannelGroupName(groupList, oldName, newName string) (string, bool) {
	groups := strings.Split(groupList, ",")
	seen := make(map[string]struct{}, len(groups))
	updated := make([]string, 0, len(groups))
	changed := false
	for _, group := range groups {
		group = strings.TrimSpace(group)
		if group == "" {
			continue
		}
		if group == oldName {
			group = newName
			changed = true
		}
		if _, ok := seen[group]; ok {
			continue
		}
		seen[group] = struct{}{}
		updated = append(updated, group)
	}
	if !changed {
		return groupList, false
	}
	return strings.Join(updated, ","), true
}
