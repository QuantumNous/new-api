package common

import (
	"crypto/tls"
	//"os"
	//"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
)

var (
	StartTime  = time.Now().Unix() // unit: second
	Version    = "v0.0.0"          // this hard coding will be replaced automatically when building, no need to manually change
	SystemName = "New API"
	Footer     = ""
	Logo       = ""
	TopUpLink  = ""
)

var themeValue atomic.Value // stores string; safe for concurrent read/write

const (
	FrontendThemeCookieName = "new-api-frontend"
	FrontendThemeDefault    = "default"
	FrontendThemeClassic    = "classic"
)

func init() {
	themeValue.Store(FrontendThemeClassic)
}

func GetTheme() string {
	return themeValue.Load().(string)
}

func NormalizeFrontendTheme(t string) string {
	if t == FrontendThemeDefault || t == FrontendThemeClassic {
		return t
	}
	return FrontendThemeClassic
}

// SetTheme updates the frontend theme atomically.
// Only "default" and "classic" are accepted; other values are silently ignored.
func SetTheme(t string) {
	if t == FrontendThemeDefault || t == FrontendThemeClassic {
		themeValue.Store(t)
	}
}

// ThemeAwarePath rewrites legacy /console/* paths to the default-theme
// equivalents when the active theme is "default".  For "classic" (or any
// other theme) the path is returned unchanged.  The function only touches
// known prefixes so it is safe to call with arbitrary suffixes and query
// strings.
func ThemeAwarePath(suffix string) string {
	if GetTheme() != "default" {
		return suffix
	}
	switch {
	case strings.HasPrefix(suffix, "/console/topup"):
		return strings.Replace(suffix, "/console/topup", "/wallet", 1)
	case strings.HasPrefix(suffix, "/console/log"):
		return strings.Replace(suffix, "/console/log", "/usage-logs", 1)
	case strings.HasPrefix(suffix, "/console/personal"):
		return strings.Replace(suffix, "/console/personal", "/profile", 1)
	}
	return suffix
}

// var ChatLink = ""
// var ChatLink2 = ""
var (
	QuotaPerUnit = 500 * 1000.0 // $0.002 / 1K tokens
	// 保留旧变量以兼容历史逻辑，实际展示由 general_setting.quota_display_type 控制
	DisplayInCurrencyEnabled = true
	DisplayTokenStatEnabled  = true
	DrawingEnabled           = true
	TaskEnabled              = true
	DataExportEnabled        = true
	DataExportInterval       = 5      // unit: minute
	DataExportDefaultTime    = "hour" // unit: minute
	DefaultCollapseSidebar   = false  // default value of collapse sidebar
)

// Any options with "Secret", "Token" in its key won't be return by GetOptions

var (
	SessionSecret            = uuid.New().String()
	CryptoSecret             = uuid.New().String()
	SessionCookieSecure      = false
	SessionCookieTrustedURLs []string
)

var (
	OptionMap        map[string]string
	OptionMapRWMutex sync.RWMutex
)

var (
	ItemsPerPage   = 10
	MaxRecentItems = 1000
)

var (
	PasswordLoginEnabled           = true
	PasswordLoginEncryptionEnabled = false
	PasswordRegisterEnabled        = true
	EmailVerificationEnabled       = false
	GitHubOAuthEnabled             = false
	LinuxDOOAuthEnabled            = false
	QQOAuthEnabled                 = false
	WeChatAuthEnabled              = false
	TelegramOAuthEnabled           = false
	SteamOAuthEnabled              = false
	TurnstileCheckEnabled          = false
	// Turnstile 场景必须单独加开关；以后新增 Turnstile 校验入口时不要复用全局开关。
	TurnstileLoginEnabled                     = false
	TurnstileRegisterEnabled                  = false
	TurnstileRegisterEmailVerificationEnabled = false
	TurnstileEmailBindingVerificationEnabled  = false
	TurnstilePasswordResetEnabled             = false
	TurnstileCheckinEnabled                   = false
	TurnstileSensitiveUpdateEnabled           = false
	RegisterEnabled                           = true
	OAuthRegisterEnabled                      = true
	RegisterInviteCodeRequired                = false
)

const (
	GitHubAccountAgeUnitDay   = "day"
	GitHubAccountAgeUnitMonth = "month"
	GitHubAccountAgeUnitYear  = "year"
)

var (
	GitHubMinimumAccountAge     = 0
	GitHubMinimumAccountAgeUnit = GitHubAccountAgeUnitDay
)

func IsValidGitHubAccountAgeUnit(unit string) bool {
	return unit == GitHubAccountAgeUnitDay ||
		unit == GitHubAccountAgeUnitMonth ||
		unit == GitHubAccountAgeUnitYear
}

func NormalizeGitHubAccountAgeUnit(unit string) string {
	if IsValidGitHubAccountAgeUnit(unit) {
		return unit
	}
	return GitHubAccountAgeUnitDay
}

var TurnstileScopedOptionKeys = []string{
	"TurnstileLoginEnabled",
	"TurnstileRegisterEnabled",
	"TurnstileRegisterEmailVerificationEnabled",
	"TurnstileEmailBindingVerificationEnabled",
	"TurnstilePasswordResetEnabled",
	"TurnstileCheckinEnabled",
	"TurnstileSensitiveUpdateEnabled",
}

func IsTurnstileScopedOptionKey(key string) bool {
	for _, optionKey := range TurnstileScopedOptionKeys {
		if optionKey == key {
			return true
		}
	}
	return false
}

func IsAnyTurnstileCheckEnabled() bool {
	return TurnstileLoginEnabled ||
		TurnstileRegisterEnabled ||
		TurnstileRegisterEmailVerificationEnabled ||
		TurnstileEmailBindingVerificationEnabled ||
		TurnstilePasswordResetEnabled ||
		TurnstileCheckinEnabled ||
		TurnstileSensitiveUpdateEnabled
}

var (
	EmailDomainRestrictionEnabled           = false // 是否在注册时启用邮箱域名限制
	EmailDomainRestrictionForBindingEnabled = false // 是否在绑定邮箱时启用邮箱域名限制
	EmailAliasRestrictionEnabled            = false // 是否启用邮箱别名限制
	EmailDomainWhitelist                    = []string{
		"gmail.com",
		"163.com",
		"126.com",
		"qq.com",
		"outlook.com",
		"hotmail.com",
		"icloud.com",
		"yahoo.com",
		"foxmail.com",
	}
)
var EmailLoginAuthServerList = []string{
	"smtp.sendcloud.net",
	"smtp.azurecomm.net",
}

var (
	DebugEnabled       bool
	MemoryCacheEnabled bool
)

var LogConsumeEnabled = true

const ForceRecordIpLogOptionKey = "ForceRecordIpLogEnabled"

const (
	EmailNotificationTemplateOptionPrefix = "EmailNotificationTemplate."
	BalanceLowNotifyEnabledOptionKey      = "BalanceLowNotifyEnabled"
	EmailDefaultLanguageOptionKey         = "EmailDefaultLanguage"
	SubscriptionPurchaseMaxQuantityKey    = "SubscriptionPurchaseMaxQuantity"
	DefaultEmailLanguage                  = "zh-CN"
)

var ForceRecordIpLogEnabled = false

var (
	TLSInsecureSkipVerify bool
	InsecureTLSConfig     = &tls.Config{InsecureSkipVerify: true}
)

var (
	SMTPServer             = ""
	SMTPPort               = 587
	SMTPSSLEnabled         = false
	SMTPStartTLSEnabled    = false
	SMTPInsecureSkipVerify = false
	SMTPForceAuthLogin     = false
	SMTPAccount            = ""
	SMTPFrom               = ""
	SMTPToken              = ""
)

var (
	EmailProvider                      = "smtp"
	CFEmailAccountID                   = ""
	CFEmailAPIToken                    = ""
	CFEmailFrom                        = ""
	EmailDailyLimit                    = 0
	EmailVerificationDailyLimitPerUser = 5
)

var (
	GitHubClientId           = ""
	GitHubClientSecret       = ""
	LinuxDOClientId          = ""
	LinuxDOClientSecret      = ""
	LinuxDOMinimumTrustLevel = 0
	QQClientId               = ""
	QQClientSecret           = ""
	SteamWebAPIKey           = ""
)

var (
	WeChatServerAddress         = ""
	WeChatServerToken           = ""
	WeChatAccountQRCodeImageURL = ""
)

var (
	TurnstileSiteKey   = ""
	TurnstileSecretKey = ""
)

var (
	TelegramBotToken = ""
	TelegramBotName  = ""
)

var (
	QuotaForNewUser                = 0
	DefaultSubscriptionPlans       = "[]"
	QuotaForInviter                = 0
	QuotaForInvitee                = 0
	ChannelDisableThreshold        = 5.0
	AutomaticDisableChannelEnabled = false
	AutomaticEnableChannelEnabled  = false
	QuotaRemindThreshold           = 1000
	PreConsumedQuota               = 500
	DefaultUserGroup               = "default"
)

var RetryTimes = 0

// var RootUserEmail = ""
var IsMasterNode bool

const (
	NodeNameSourceManual   = "manual"
	NodeNameSourceHostname = "hostname"
)

// NodeName 节点名称，优先从 NODE_NAME 环境变量读取，未配置时回退主机名。
// 用于审计日志和后台任务中标识节点身份；多实例部署时建议显式配置稳定 NODE_NAME。
var NodeName = ""

// NodeNameSource 记录节点名称来源，便于实例管理识别手动配置与自动回退。
var NodeNameSource = NodeNameSourceHostname

var NodeNameManuallyConfigured bool

var (
	requestInterval int
	RequestInterval time.Duration
)

var SyncFrequency int // unit is second

var (
	BatchUpdateEnabled  = false
	BatchUpdateInterval int
)

var RelayTimeout int // unit is second

var (
	RelayIdleConnTimeout int // unit is second

	// RelayResponseHeaderTimeout limits how long the relay transport waits for the
	// upstream response headers after the request has been fully written.
	// 0 disables it (previous behaviour: wait forever).
	//
	// Note this is NOT the same as RelayTimeout (http.Client.Timeout), which covers
	// the whole response read and therefore breaks legitimate long streaming calls.
	// ResponseHeaderTimeout only bounds the wait for the response headers; once the
	// headers arrive, streaming is unaffected.
	RelayResponseHeaderTimeout int // unit is second
	RelayMaxIdleConns          int
	RelayMaxIdleConnsPerHost   int
)

var GeminiSafetySetting string

// https://docs.cohere.com/docs/safety-modes Type; NONE/CONTEXTUAL/STRICT
var CohereSafetySetting string

const (
	RequestIdKey         = "X-Oneapi-Request-Id"
	UpstreamRequestIdKey = "X-Upstream-Request-Id"
)

const (
	RoleGuestUser  = 0
	RoleCommonUser = 1
	RoleAdminUser  = 10
	RoleRootUser   = 100
)

func IsValidateRole(role int) bool {
	return role == RoleGuestUser || role == RoleCommonUser || role == RoleAdminUser || role == RoleRootUser
}

var (
	FileUploadPermission    = RoleGuestUser
	FileDownloadPermission  = RoleGuestUser
	ImageUploadPermission   = RoleGuestUser
	ImageDownloadPermission = RoleGuestUser
)

// All duration's unit is seconds
// Shouldn't larger then RateLimitKeyExpirationDuration
var (
	GlobalApiRateLimitEnable   bool
	GlobalApiRateLimitNum      int
	GlobalApiRateLimitDuration int64

	GlobalWebRateLimitEnable   bool
	GlobalWebRateLimitNum      int
	GlobalWebRateLimitDuration int64

	CriticalRateLimitEnable   bool
	CriticalRateLimitNum            = 20
	CriticalRateLimitDuration int64 = 20 * 60

	UploadRateLimitNum            = 10
	UploadRateLimitDuration int64 = 60

	DownloadRateLimitNum            = 10
	DownloadRateLimitDuration int64 = 60

	// Per-user search rate limit (applies after authentication, keyed by user ID)
	SearchRateLimitEnable         = true
	SearchRateLimitNum            = 10
	SearchRateLimitDuration int64 = 60
)

var RateLimitKeyExpirationDuration = 20 * time.Minute

const (
	UserStatusEnabled  = 1 // don't use 0, 0 is the default value!
	UserStatusDisabled = 2 // also don't use 0
)

const (
	TokenStatusEnabled   = 1 // don't use 0, 0 is the default value!
	TokenStatusDisabled  = 2 // also don't use 0
	TokenStatusExpired   = 3
	TokenStatusExhausted = 4
)

const (
	RedemptionCodeStatusEnabled  = 1 // don't use 0, 0 is the default value!
	RedemptionCodeStatusDisabled = 2 // also don't use 0
	RedemptionCodeStatusUsed     = 3 // also don't use 0
)

const (
	ChannelStatusUnknown          = 0
	ChannelStatusEnabled          = 1 // don't use 0, 0 is the default value!
	ChannelStatusManuallyDisabled = 2 // also don't use 0
	ChannelStatusAutoDisabled     = 3
	ChannelStatusRateLimited      = 4
)

const (
	TopUpStatusPending = "pending"
	TopUpStatusSuccess = "success"
	TopUpStatusFailed  = "failed"
	TopUpStatusExpired = "expired"
)
