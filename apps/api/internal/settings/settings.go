// Package settings owns the runtime configuration mechanism: seeding the
// option map with typed defaults, applying option updates to their typed
// targets, validating option values, and the gateway-routing key contract.
//
// It deliberately holds NO admin HTTP use cases and performs NO database
// access: callers (model layer) feed option rows in via ApplyOption.
package settings

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/sensitive"
	"github.com/QuantumNous/new-api/internal/transport/middleware/rate_limit"
	"github.com/QuantumNous/new-api/internal/transport/middleware/status_code"
)

// RetiredThemeOptionKey is the option key of the removed classic frontend
// theme. It must never re-enter the option map.
const RetiredThemeOptionKey = "theme.frontend"

// OnBillingSettingChanged invalidates caches that live outside this package
// when a billing_setting.* tiered config changes. Wired by the host module to
// avoid an import cycle.
var OnBillingSettingChanged func()

// OnPerformanceSettingChanged invalidates caches that live outside this package
// when performance_setting.* config changes. Wired by main to keep settings
// free of internal/usage/record_perf import (record_perf depends on model for
// flush ops, which would cycle with the model layer).
var OnPerformanceSettingChanged func()

// OnApplyOperationSetting etc registered by catalog init() (manage_channels.go,
// resolve_group.go, track_health.go, manage_models.go) for option apply/validate/seed without
// settings importing catalog children (breaks test cycles while keeping option
// behavior in catalog per plan.md). Nil-safe: return nil or default if unregistered.
var (
	OnApplyOperationSetting         func(key, value string) error
	OnApplyResolveGroupSetting      func(key, value string) error
	OnIsGatewayDispatchOptionKey    func(key string) bool
	OnValidateGatewayDispatchOption func(key, value string) error
	OnIsChannelHealthOptionKey      func(key string) bool
	OnValidateChannelHealthOption   func(key, value string) error
	OnApplyGatewayDispatchOption    func(key, value string) error
	OnApplyChannelHealthOption      func(key, value string) error
	OnIsRouteStatsOptionKey         func(key string) bool
	OnValidateRouteStatsOption      func(key, value string) error
	OnApplyRouteStatsOption         func(key, value string) error
	OnSeedCatalogOptions            func() map[string]string
)

// Domain-owned option hooks, registered from each domain's own init() so this
// package never imports billing / usage / egress / catalog. Same nil-safe
// contract as the catalog hooks above: unregistered means "no such option
// behavior", not an error.
//
// Validation dispatch criterion (ValidateOptionValue): a rule that is a pure
// check on the value string stays inline in this package, so it holds in every
// binary regardless of which domains are linked. A rule that needs domain
// state — a key set, a range table, a price schema — arrives as a hook,
// because inlining it would mean importing that domain and closing a cycle.
// The consequence is deliberate: in a binary that does not link catalog, the
// health keys are simply not recognized as options and validate to nil, the
// same neutral path as any other unknown key.
var (
	OnSeedPaymentOptions func() map[string]string
	OnApplyPaymentOption func(key, value string) error
	OnSeedUsageOptions   func() map[string]string
	OnApplyUsageOption   func(key, value string) error
	OnSeedEgressOptions  func() map[string]string
	OnApplyEgressOption  func(key, value string) error
	OnSeedRatioOptions   func() map[string]string
	OnApplyRatioOption   func(key, value string) error

	OnIsToolPriceOptionKey    func(key string) bool
	OnValidateToolPriceOption func(value string) error
	OnApplyToolPriceOption    func(value string)

	// OnApplyUserInsightSetting applies a user_insight_setting.<key> option
	// with domain-owned locking. blocked_clients is read on the relay hot path
	// under usage's blockedClientsLock, so the generic reflect write in
	// updateConfigFromMap must not touch it. Return true when the key was
	// handled; false falls through to the generic path. Registered by the
	// usage domain's init().
	OnApplyUserInsightSetting func(configKey, value string) bool
)

// GatewayRoutingOptionKeys is deliberately explicit. New settings must be
// reviewed before they become part of the gateway snapshot contract.
var GatewayRoutingOptionKeys = map[string]struct{}{
	"ModelRatio": {}, "ModelPrice": {}, "CompletionRatio": {},
	"CacheRatio": {}, "CreateCacheRatio": {}, "ImageRatio": {},
	"AudioRatio": {}, "AudioCompletionRatio": {}, "GroupRatio": {},
	"GroupGroupRatio": {}, "UserUsableGroups": {}, "AutoGroups": {},
	"MaxTokenAutoGroups": {},
}

func IsGatewayRoutingOptionKey(key string) bool {
	_, ok := GatewayRoutingOptionKeys[key]
	return ok
}

func GatewayRoutingOptionKeyList() []string {
	keys := make([]string, 0, len(GatewayRoutingOptionKeys))
	for key := range GatewayRoutingOptionKeys {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}

func ValidateOptionValue(key string, value string) error {
	if OnIsToolPriceOptionKey != nil && OnIsToolPriceOptionKey(key) {
		if OnValidateToolPriceOption != nil {
			return OnValidateToolPriceOption(value)
		}
		return nil
	}
	if key == "MaxTokenAutoGroups" {
		// Validated here rather than through a domain hook: the rule is a pure
		// string check with no catalog state, and a hook would silently accept
		// invalid values in every binary that does not link the catalog domain
		// (model's own tests are one). Catalog still owns applying the value.
		if count, convErr := strconv.Atoi(value); convErr != nil || count <= 0 {
			return fmt.Errorf("MaxTokenAutoGroups must be a positive integer")
		}
		return nil
	}
	if key == "quota_setting.empty_response_multiplier" {
		multiplier, convErr := strconv.ParseFloat(value, 64)
		if convErr != nil || math.IsNaN(multiplier) || math.IsInf(multiplier, 0) ||
			multiplier < 0 || multiplier > 1 {
			return fmt.Errorf("%s must be a finite number in [0,1]", key)
		}
		return nil
	}
	if key == "ResponseCacheTtlSeconds" || key == "ResponseCacheMaxEntries" || key == "ResponseCacheMaxBodySize" {
		// Pure numeric check, no domain state: 0 is accepted for TTL/size
		// (resets to defaults in responsecache.SetConfig), but negative values
		// are invalid configuration.
		if n, convErr := strconv.Atoi(value); convErr != nil || n < 0 {
			return fmt.Errorf("%s must be a non-negative integer", key)
		}
		return nil
	}
	if key == "SMTPAccountPool" {
		// Validated here rather than through a domain hook: the rule is a pure
		// JSON shape check with no catalog state.
		if _, err := common.ParseSMTPAccountPoolJSON(value); err != nil {
			return err
		}
		return nil
	}
	if OnIsRouteStatsOptionKey != nil && OnIsRouteStatsOptionKey(key) {
		if OnValidateRouteStatsOption != nil {
			return OnValidateRouteStatsOption(key, value)
		}
		return nil
	}
	if OnIsGatewayDispatchOptionKey != nil && OnIsGatewayDispatchOptionKey(key) {
		if OnValidateGatewayDispatchOption != nil {
			return OnValidateGatewayDispatchOption(key, value)
		}
		return nil
	}
	if OnIsChannelHealthOptionKey != nil && OnIsChannelHealthOptionKey(key) {
		if OnValidateChannelHealthOption != nil {
			return OnValidateChannelHealthOption(key, value)
		}
		return nil
	}
	if key == ThemeCustomizationOptionKey {
		return ValidateThemeCustomizationOption(value)
	}
	return nil
}

// SeedOptionMap initializes common.OptionMap with typed defaults from every
// config domain. Callers load persisted overrides afterwards via ApplyOption.
func SeedOptionMap() {
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
	common.OptionMap["DisplayGroupRatioTable"] = strconv.FormatBool(common.DisplayGroupRatioTable)
	common.OptionMap["DrawingEnabled"] = strconv.FormatBool(common.DrawingEnabled)
	common.OptionMap["TaskEnabled"] = strconv.FormatBool(common.TaskEnabled)
	common.OptionMap["DataExportEnabled"] = strconv.FormatBool(common.DataExportEnabled)
	common.OptionMap["ChannelDisableThreshold"] = strconv.FormatFloat(common.ChannelDisableThreshold, 'f', -1, 64)
	common.OptionMap["EmailDomainRestrictionEnabled"] = strconv.FormatBool(common.EmailDomainRestrictionEnabled)
	common.OptionMap["EmailAliasRestrictionEnabled"] = strconv.FormatBool(common.EmailAliasRestrictionEnabled)
	common.OptionMap["EmailDomainWhitelist"] = strings.Join(common.EmailDomainWhitelist, ",")
	common.OptionMap["EmailFormatRegex"] = common.EmailFormatRegex
	common.OptionMap["SMTPServer"] = ""
	common.OptionMap["SMTPFrom"] = ""
	common.OptionMap["SMTPPort"] = strconv.Itoa(common.SMTPPort)
	common.OptionMap["SMTPAccount"] = ""
	common.OptionMap["SMTPToken"] = ""
	common.OptionMap["SMTPSSLEnabled"] = strconv.FormatBool(common.SMTPSSLEnabled)
	common.OptionMap["SMTPStartTLSEnabled"] = strconv.FormatBool(common.SMTPStartTLSEnabled)
	common.OptionMap["SMTPInsecureSkipVerify"] = strconv.FormatBool(common.SMTPInsecureSkipVerify)
	common.OptionMap["SMTPForceAuthLogin"] = strconv.FormatBool(common.SMTPForceAuthLogin)
	common.OptionMap["SMTPAccountPool"] = ""
	common.OptionMap["Notice"] = ""
	common.OptionMap["About"] = ""
	common.OptionMap["HomePageContent"] = ""
	common.OptionMap["Footer"] = common.Footer
	common.OptionMap["SystemName"] = common.SystemName
	common.OptionMap["Logo"] = common.Logo
	common.OptionMap["ServerAddress"] = ""
	common.OptionMap["PayAddress"] = ""
	common.OptionMap["CustomCallbackAddress"] = ""
	common.OptionMap["EpayId"] = ""
	common.OptionMap["EpayKey"] = ""
	common.OptionMap["VmqAddress"] = ""
	common.OptionMap["VmqKey"] = ""
	common.OptionMap["CodePayAddress"] = ""
	common.OptionMap["CodePayId"] = ""
	common.OptionMap["CodePayKey"] = ""
	common.OptionMap["TopupGroupRatio"] = common.TopupGroupRatio2JSONString()
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
	common.OptionMap["QuotaRemindThreshold"] = strconv.Itoa(common.QuotaRemindThreshold)
	common.OptionMap["PreConsumedQuota"] = strconv.Itoa(common.PreConsumedQuota)
	common.OptionMap["ModelRequestRateLimitCount"] = strconv.Itoa(rate_limit.ModelRequestRateLimitCount)
	common.OptionMap["ModelRequestRateLimitDurationMinutes"] = strconv.Itoa(rate_limit.ModelRequestRateLimitDurationMinutes)
	common.OptionMap["ModelRequestRateLimitSuccessCount"] = strconv.Itoa(rate_limit.ModelRequestRateLimitSuccessCount)
	common.OptionMap["ModelRequestRateLimitGroup"] = rate_limit.ModelRequestRateLimitGroup2JSONString()
	common.OptionMap["TopUpLink"] = common.TopUpLink
	common.OptionMap["QuotaPerUnit"] = strconv.FormatFloat(common.QuotaPerUnit, 'f', -1, 64)
	common.OptionMap["RetryTimes"] = strconv.Itoa(common.RetryTimes)
	common.OptionMap["DataExportInterval"] = strconv.Itoa(common.DataExportInterval)
	common.OptionMap["DataExportDefaultTime"] = common.DataExportDefaultTime
	common.OptionMap["DefaultCollapseSidebar"] = strconv.FormatBool(common.DefaultCollapseSidebar)
	common.OptionMap["CheckSensitiveEnabled"] = strconv.FormatBool(sensitive.CheckSensitiveEnabled)
	common.OptionMap["ModelRequestRateLimitEnabled"] = strconv.FormatBool(rate_limit.ModelRequestRateLimitEnabled)
	common.OptionMap["ResponseCacheEnabled"] = strconv.FormatBool(common.ResponseCacheEnabled)
	common.OptionMap["ResponseCacheTtlSeconds"] = strconv.Itoa(common.ResponseCacheTtlSeconds)
	common.OptionMap["ResponseCacheMaxEntries"] = strconv.Itoa(common.ResponseCacheMaxEntries)
	common.OptionMap["ResponseCacheMaxBodySize"] = strconv.Itoa(common.ResponseCacheMaxBodySize)
	common.OptionMap["CheckSensitiveOnPromptEnabled"] = strconv.FormatBool(sensitive.CheckSensitiveOnPromptEnabled)
	common.OptionMap["CheckSensitiveOnCompletionEnabled"] = strconv.FormatBool(sensitive.CheckSensitiveOnCompletionEnabled)
	common.OptionMap["StopOnSensitiveEnabled"] = strconv.FormatBool(sensitive.StopOnSensitiveEnabled)
	common.OptionMap["SensitiveWords"] = sensitive.SensitiveWordsToString()
	common.OptionMap["SensitiveBlockGroups"] = sensitive.SensitiveGroupsToString()
	common.OptionMap["StreamCacheQueueLength"] = strconv.Itoa(sensitive.StreamCacheQueueLength)
	common.OptionMap["AutomaticDisableStatusCodes"] = status_code.AutomaticDisableStatusCodesToString()
	common.OptionMap["AutomaticRetryStatusCodes"] = status_code.AutomaticRetryStatusCodesToString()
	common.OptionMap["proxy_config"] = ""
	// Empty means "no pinned theme"; a persisted override is loaded from the
	// options table by loadOptionsFromDatabase on startup.
	common.OptionMap[ThemeCustomizationOptionKey] = ""
	// Catalog-owned options (resolve_group, manage_channels, health, etc.) are
	// provided by registered OnSeedCatalogOptions hook from their behavior files'
	// init(); this avoids direct imports and cycles while keeping behavior in catalog.
	for _, seed := range []func() map[string]string{
		OnSeedCatalogOptions, OnSeedPaymentOptions, OnSeedUsageOptions,
		OnSeedEgressOptions, OnSeedRatioOptions,
	} {
		if seed == nil {
			continue
		}
		for k, v := range seed() {
			common.OptionMap[k] = v
		}
	}

	// 自动添加所有注册的模型配置
	modelConfigs := GlobalConfig.ExportAllConfigs()
	for k, v := range modelConfigs {
		common.OptionMap[k] = v
	}

	common.OptionMapRWMutex.Unlock()
}

// ApplyOption dispatches one persisted option value onto its typed target and
// records it in common.OptionMap.
func ApplyOption(key string, value string) (err error) {
	if OnIsGatewayDispatchOptionKey != nil && OnIsGatewayDispatchOptionKey(key) {
		// Gateway dispatch state-machine options are dispatched to the atomic
		// runtime config before the OptionMap lock is taken; a
		// parse/validation error returns without storing an invalid value.
		if OnApplyGatewayDispatchOption != nil {
			if err = OnApplyGatewayDispatchOption(key, value); err != nil {
				return err
			}
		}
		common.OptionMapRWMutex.Lock()
		common.OptionMap[key] = value
		common.OptionMapRWMutex.Unlock()
		return nil
	} else if OnIsChannelHealthOptionKey != nil && OnIsChannelHealthOptionKey(key) {
		if OnApplyChannelHealthOption != nil {
			if err = OnApplyChannelHealthOption(key, value); err != nil {
				return err
			}
		}
		common.OptionMapRWMutex.Lock()
		common.OptionMap[key] = value
		common.OptionMapRWMutex.Unlock()
		return nil
	}
	if OnIsRouteStatsOptionKey != nil && OnIsRouteStatsOptionKey(key) {
		// Route stats options reach the atomic runtime setting before the
		// OptionMap lock, same as the health options above: a parse failure must
		// not leave an invalid value recorded as applied.
		if OnApplyRouteStatsOption != nil {
			if err = OnApplyRouteStatsOption(key, value); err != nil {
				return err
			}
		}
		common.OptionMapRWMutex.Lock()
		common.OptionMap[key] = value
		common.OptionMapRWMutex.Unlock()
		return nil
	}
	if key == RetiredThemeOptionKey {
		common.OptionMapRWMutex.Lock()
		delete(common.OptionMap, key)
		common.OptionMapRWMutex.Unlock()
		return nil
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
	if strings.HasSuffix(key, "Enabled") || key == "DisplayGroupRatioTable" || key == "DefaultCollapseSidebar" || key == "DefaultUseAutoGroup" || key == "SMTPForceAuthLogin" || key == "SMTPInsecureSkipVerify" {
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
			if cfg := GlobalConfig.Get("general_setting"); cfg != nil {
				_ = UpdateConfigFromMap(cfg, map[string]string{"quota_display_type": newVal})
			}
		case "DisplayTokenStatEnabled":
			common.DisplayTokenStatEnabled = boolValue
		case "DisplayGroupRatioTable":
			common.DisplayGroupRatioTable = boolValue
		case "DrawingEnabled":
			common.DrawingEnabled = boolValue
		case "TaskEnabled":
			common.TaskEnabled = boolValue
		case "DataExportEnabled":
			common.DataExportEnabled = boolValue
		case "DefaultCollapseSidebar":
			common.DefaultCollapseSidebar = boolValue
		case "MjNotifyEnabled", "MjAccountFilterEnabled", "MjModeClearEnabled",
			"MjForwardUrlEnabled", "MjActionCheckSuccessEnabled":
			if OnApplyUsageOption != nil {
				err = OnApplyUsageOption(key, value)
			}
		case "CheckSensitiveEnabled":
			sensitive.CheckSensitiveEnabled = boolValue
		case "DemoSiteEnabled", "SelfUseModeEnabled":
			if OnApplyOperationSetting != nil {
				_ = OnApplyOperationSetting(key, value)
			}
		case "CheckSensitiveOnPromptEnabled":
			sensitive.CheckSensitiveOnPromptEnabled = boolValue
		case "CheckSensitiveOnCompletionEnabled":
			sensitive.CheckSensitiveOnCompletionEnabled = boolValue
		case "ModelRequestRateLimitEnabled":
			rate_limit.ModelRequestRateLimitEnabled = boolValue
		case "ResponseCacheEnabled":
			common.ResponseCacheEnabled = boolValue
		case "StopOnSensitiveEnabled":
			sensitive.StopOnSensitiveEnabled = boolValue
		case "SMTPSSLEnabled":
			common.SMTPSSLEnabled = boolValue
		case "SMTPStartTLSEnabled":
			common.SMTPStartTLSEnabled = boolValue
		case "SMTPInsecureSkipVerify":
			common.SMTPInsecureSkipVerify = boolValue
		case "SMTPForceAuthLogin":
			common.SMTPForceAuthLogin = boolValue
		case "WorkerAllowHttpImageRequestEnabled":
			if OnApplyEgressOption != nil {
				err = OnApplyEgressOption(key, value)
			}
		case "DefaultUseAutoGroup":
			if OnApplyResolveGroupSetting != nil {
				_ = OnApplyResolveGroupSetting(key, value)
			}
		case "ExposeRatioEnabled":
			if OnApplyRatioOption != nil {
				err = OnApplyRatioOption(key, value)
			}
		}
	}
	switch key {
	case "EmailDomainWhitelist":
		common.EmailDomainWhitelist = strings.Split(value, ",")
	case "EmailFormatRegex":
		common.EmailFormatRegex = strings.TrimSpace(value)
		common.EmailFormatRegexCompiled = nil
		if common.EmailFormatRegex != "" {
			var compiled []*regexp.Regexp
			for _, line := range strings.Split(common.EmailFormatRegex, "\n") {
				rule := strings.TrimSpace(line)
				if rule == "" {
					continue
				}
				if re, err := regexp.Compile(rule); err == nil {
					compiled = append(compiled, re)
				} else {
					common.SysError("invalid EmailFormatRegex line disabled: " + err.Error())
				}
			}
			common.EmailFormatRegexCompiled = compiled
		}
	case "SMTPServer":
		common.SMTPServer = value
	case "SMTPPort":
		intValue, _ := strconv.Atoi(value)
		common.SMTPPort = intValue
	case "ResponseCacheTtlSeconds":
		intValue, _ := strconv.Atoi(value)
		common.ResponseCacheTtlSeconds = intValue
	case "ResponseCacheMaxEntries":
		intValue, _ := strconv.Atoi(value)
		common.ResponseCacheMaxEntries = intValue
	case "ResponseCacheMaxBodySize":
		intValue, _ := strconv.Atoi(value)
		common.ResponseCacheMaxBodySize = intValue
	case "SMTPAccount":
		common.SMTPAccount = value
	case "SMTPFrom":
		common.SMTPFrom = value
	case "SMTPToken":
		common.SMTPToken = value
	case "SMTPAccountPool":
		// A malformed value keeps the previous pool: option application also runs
		// on startup without validation, and clearing a working pool on one bad
		// row would silently stop all outbound mail.
		pool, poolErr := common.ParseSMTPAccountPoolJSON(value)
		if poolErr != nil {
			err = poolErr
			break
		}
		common.SMTPAccountPool = pool
		common.RebuildSMTPSenderPool()
	case "ServerAddress", "WorkerUrl", "WorkerValidKey":
		if OnApplyEgressOption != nil {
			err = OnApplyEgressOption(key, value)
		}
	case "PayAddress":
		if OnApplyPaymentOption != nil {
			err = OnApplyPaymentOption(key, value)
		}
	case "Chats":
		if OnApplyUsageOption != nil {
			err = OnApplyUsageOption(key, value)
		}
	case "AutoGroups", "MaxTokenAutoGroups":
		if OnApplyResolveGroupSetting != nil {
			err = OnApplyResolveGroupSetting(key, value)
		}
	case "CustomCallbackAddress", "EpayId", "EpayKey", "Price", "USDExchangeRate", "MinTopUp", "StripeApiSecret", "StripeWebhookSecret", "StripePriceId", "StripeUnitPrice", "StripeMinTopUp", "StripePromotionCodesEnabled", "CreemApiKey", "CreemProducts", "CreemTestMode", "CreemWebhookSecret", "WaffoEnabled", "WaffoApiKey", "WaffoPrivateKey", "WaffoPublicCert", "WaffoSandboxPublicCert", "WaffoSandboxApiKey", "WaffoSandboxPrivateKey", "WaffoSandbox", "WaffoMerchantId", "WaffoNotifyUrl", "WaffoReturnUrl", "WaffoSubscriptionReturnUrl", "WaffoCurrency", "WaffoUnitPrice", "WaffoMinTopUp", "WaffoPancakeMerchantID", "WaffoPancakePrivateKey", "WaffoPancakeReturnURL", "WaffoPancakeStoreID", "WaffoPancakeProductID", "WaffoPancakeUnitPrice", "WaffoPancakeMinTopUp", "VmqAddress", "VmqKey", "CodePayAddress", "CodePayId", "CodePayKey":
		if OnApplyPaymentOption != nil {
			err = OnApplyPaymentOption(key, value)
		}
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
	case "QuotaRemindThreshold":
		common.QuotaRemindThreshold, _ = strconv.Atoi(value)
	case "PreConsumedQuota":
		common.PreConsumedQuota, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitCount":
		rate_limit.ModelRequestRateLimitCount, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitDurationMinutes":
		rate_limit.ModelRequestRateLimitDurationMinutes, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitSuccessCount":
		rate_limit.ModelRequestRateLimitSuccessCount, _ = strconv.Atoi(value)
	case "ModelRequestRateLimitGroup":
		err = rate_limit.UpdateModelRequestRateLimitGroupByJSONString(value)
	case "RetryTimes":
		common.RetryTimes, _ = strconv.Atoi(value)
	case "DataExportInterval":
		common.DataExportInterval, _ = strconv.Atoi(value)
	case "DataExportDefaultTime":
		common.DataExportDefaultTime = value
	case "ModelRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "GroupRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "GroupGroupRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "UserUsableGroups":
		if OnApplyResolveGroupSetting != nil {
			err = OnApplyResolveGroupSetting(key, value)
		}
	case "CompletionRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "ModelPrice":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "CacheRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "CreateCacheRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "ImageRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "AudioRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "AudioCompletionRatio":
		if OnApplyRatioOption != nil {
			err = OnApplyRatioOption(key, value)
		}
	case "TopUpLink":
		common.TopUpLink = value
	case "ChannelDisableThreshold":
		common.ChannelDisableThreshold, _ = strconv.ParseFloat(value, 64)
	case "QuotaPerUnit":
		common.QuotaPerUnit, _ = strconv.ParseFloat(value, 64)
	case "SensitiveWords":
		sensitive.SensitiveWordsFromString(value)
	case "SensitiveBlockGroups":
		sensitive.SensitiveGroupsFromString(value)
	case "AutomaticDisableKeywords":
		if OnApplyOperationSetting != nil {
			_ = OnApplyOperationSetting(key, value)
		}
	case "AutomaticDisableStatusCodes":
		err = status_code.AutomaticDisableStatusCodesFromString(value)
	case "AutomaticRetryStatusCodes":
		err = status_code.AutomaticRetryStatusCodesFromString(value)
	case "StreamCacheQueueLength":
		sensitive.StreamCacheQueueLength, _ = strconv.Atoi(value)
	case "PayMethods":
		if OnApplyPaymentOption != nil {
			err = OnApplyPaymentOption(key, value)
		}
	case "WaffoPayMethods":
		// WaffoPayMethods is read directly from OptionMap via billing.GetWaffoPayMethods().
		// The value is already stored in OptionMap at the top of this function.
		// No additional in-memory variable to update.
	}
	return err
}

// handleConfigUpdate 处理分层配置更新，返回是否已处理
func handleConfigUpdate(key, value string) bool {
	if OnIsToolPriceOptionKey != nil && OnIsToolPriceOptionKey(key) {
		if OnApplyToolPriceOption != nil {
			OnApplyToolPriceOption(value)
		}
		return true
	}

	parts := strings.SplitN(key, ".", 2)
	if len(parts) != 2 {
		return false // 不是分层配置
	}

	configName := parts[0]
	configKey := parts[1]

	// 获取配置对象
	cfg := GlobalConfig.Get(configName)
	if cfg == nil {
		return false // 未注册的配置
	}
	// user_insight_setting.blocked_clients 在 relay 热路径上被 CheckClientBan
	// 在 usage.blockedClientsLock 下读取，通用反射写不持该锁会与之竞争
	// （slice header 撕裂）。交给 usage 域钩子加锁应用，命中后跳过反射写。
	if configName == "user_insight_setting" && OnApplyUserInsightSetting != nil &&
		OnApplyUserInsightSetting(configKey, value) {
		return true // 已由域钩子处理
	}

	// 更新配置
	configMap := map[string]string{
		configKey: value,
	}
	UpdateConfigFromMap(cfg, configMap)

	// 特定配置的后处理
	if configName == "performance_setting" && OnPerformanceSettingChanged != nil {
		OnPerformanceSettingChanged()
	} else if configName == "billing_setting" && OnBillingSettingChanged != nil {
		OnBillingSettingChanged()
	}

	return true // 已处理
}
