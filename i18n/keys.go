package i18n

// Message keys of i18n/locales/*.yaml, for text the backend translates itself:
// errors returned to AI clients, emails and notifications. Web console messages
// are not listed here; the web console translates them (see common.Message).

// Errors returned to AI clients
const (
	MsgDatabaseError      = "common.database_error"
	MsgAuthUserBanned     = "auth.user_banned"
	MsgTokenGetInfoFailed = "token.get_info_failed"
	MsgTokenInvalid       = "token.invalid"

	MsgAuthClientIPUnresolved     = "auth.client_ip_unresolved"
	MsgAuthTokenIPNotAllowed      = "auth.token_ip_not_allowed"
	MsgAuthTokenGroupForbidden    = "auth.token_group_forbidden"
	MsgAuthTokenGroupDeprecated   = "auth.token_group_deprecated"
	MsgAuthChannelSelectForbidden = "auth.channel_select_forbidden"

	MsgRateLimitReached      = "rate_limit.reached"
	MsgRateLimitTotalReached = "rate_limit.total_reached"

	MsgDistributorInvalidRequest               = "distributor.invalid_request"
	MsgDistributorInvalidChannelId             = "distributor.invalid_channel_id"
	MsgDistributorChannelDisabled              = "distributor.channel_disabled"
	MsgDistributorTokenNoModelAccess           = "distributor.token_no_model_access"
	MsgDistributorTokenModelForbidden          = "distributor.token_model_forbidden"
	MsgDistributorModelNameRequired            = "distributor.model_name_required"
	MsgDistributorInvalidPlayground            = "distributor.invalid_playground_request"
	MsgDistributorGroupAccessDenied            = "distributor.group_access_denied"
	MsgDistributorGetChannelFailed             = "distributor.get_channel_failed"
	MsgDistributorNoAvailableChannel           = "distributor.no_available_channel"
	MsgDistributorNoAvailableChannelTaskPlugin = "distributor.no_available_channel_task_plugin"
	MsgDistributorInvalidMidjourney            = "distributor.invalid_midjourney_request"
	MsgDistributorInvalidParseModel            = "distributor.invalid_request_parse_model"

	MsgQuotaUserInsufficient             = "quota.user_insufficient"
	MsgQuotaPreConsumeInsufficient       = "quota.pre_consume_insufficient"
	MsgQuotaSubscriptionInsufficient     = "quota.subscription_insufficient"
	MsgRelayModelPriceNotConfigured      = "relay.model_price_not_configured"
	MsgRelayModelPriceNotConfiguredAdmin = "relay.model_price_not_configured_admin"
	MsgRelayTaskChannelDisabled          = "relay.task_channel_disabled"
	MsgRelayGroupSaturated               = "relay.group_saturated"
	MsgRelayGroupUpstreamSaturated       = "relay.group_upstream_saturated"
	MsgRelayRetryGetChannelFailed        = "relay.retry_get_channel_failed"
	MsgRelayRetryNoAvailableChannel      = "relay.retry_no_available_channel"
	MsgRelayAccessTokenUnsupported       = "relay.access_token_unsupported"
)

// Emails and the name of the token created at registration, in the
// recipient's language
const (
	MsgUserDefaultTokenName = "user.default_token_name"

	MsgEmailVerificationSubject  = "email.verification.subject"
	MsgEmailVerificationGreeting = "email.verification.greeting"
	MsgEmailVerificationCode     = "email.verification.code"
	MsgEmailVerificationValidity = "email.verification.validity"

	MsgEmailPasswordResetSubject      = "email.password_reset.subject"
	MsgEmailPasswordResetGreeting     = "email.password_reset.greeting"
	MsgEmailPasswordResetLink         = "email.password_reset.link"
	MsgEmailPasswordResetLinkFallback = "email.password_reset.link_fallback"
	MsgEmailPasswordResetValidity     = "email.password_reset.validity"
)

// Low-quota notices, in the recipient's saved language
const (
	MsgNotifyQuotaLowTitle             = "notify.quota_low_title"
	MsgNotifySubscriptionQuotaLowTitle = "notify.subscription_quota_low_title"
	MsgNotifyQuotaLowBark              = "notify.quota_low_bark"
	MsgNotifyQuotaLowGotify            = "notify.quota_low_gotify"
	MsgNotifyQuotaLowEmail             = "notify.quota_low_email"
)

// Channel notices sent to the root user and model update watchers
const (
	MsgChannelNotifyDisabledSubject = "channel.notify_disabled_subject"
	MsgChannelNotifyDisabledContent = "channel.notify_disabled_content"
	MsgChannelNotifyEnabledSubject  = "channel.notify_enabled_subject"
	MsgChannelNotifyEnabledContent  = "channel.notify_enabled_content"
	MsgChannelTestCompletedSubject  = "channel.test_completed_subject"
	MsgChannelTestCompletedContent  = "channel.test_completed_content"

	MsgChannelUpstreamUpdateNotifySubject   = "channel.upstream_update_notify_subject"
	MsgChannelUpstreamUpdateSummary         = "channel.upstream_update_summary"
	MsgChannelUpstreamUpdateChangedChannels = "channel.upstream_update_changed_channels"
	MsgChannelUpstreamUpdateMoreChannels    = "channel.upstream_update_more_channels"
	MsgChannelUpstreamUpdateAddedModels     = "channel.upstream_update_added_models"
	MsgChannelUpstreamUpdateRemovedModels   = "channel.upstream_update_removed_models"
	MsgChannelUpstreamUpdateFailedChannels  = "channel.upstream_update_failed_channels"
	MsgChannelUpstreamUpdateMoreOmitted     = "channel.upstream_update_more_omitted"
)

// Before the backend translated them, these messages were Chinese for every
// reader, and other gateways match their text, for example to disable a channel
// whose upstream account ran out of quota. They stay Chinese for a reader who
// states no language. Keys added later are not listed here and use DefaultLang.
var chineseByDefault = []string{
	MsgAuthClientIPUnresolved, MsgAuthTokenIPNotAllowed, MsgAuthTokenGroupForbidden,
	MsgAuthTokenGroupDeprecated, MsgAuthChannelSelectForbidden,
	MsgRateLimitReached, MsgRateLimitTotalReached,
	MsgQuotaUserInsufficient, MsgQuotaPreConsumeInsufficient, MsgQuotaSubscriptionInsufficient,
	MsgRelayModelPriceNotConfigured, MsgRelayModelPriceNotConfiguredAdmin,
	MsgRelayTaskChannelDisabled, MsgRelayGroupSaturated, MsgRelayGroupUpstreamSaturated,
	MsgRelayRetryGetChannelFailed, MsgRelayRetryNoAvailableChannel, MsgRelayAccessTokenUnsupported,
	MsgUserDefaultTokenName,
	MsgEmailVerificationSubject, MsgEmailVerificationGreeting, MsgEmailVerificationCode,
	MsgEmailVerificationValidity,
	MsgEmailPasswordResetSubject, MsgEmailPasswordResetGreeting, MsgEmailPasswordResetLink,
	MsgEmailPasswordResetLinkFallback, MsgEmailPasswordResetValidity,
	MsgNotifyQuotaLowTitle, MsgNotifySubscriptionQuotaLowTitle, MsgNotifyQuotaLowBark,
	MsgNotifyQuotaLowGotify, MsgNotifyQuotaLowEmail,
	MsgChannelNotifyDisabledSubject, MsgChannelNotifyDisabledContent,
	MsgChannelNotifyEnabledSubject, MsgChannelNotifyEnabledContent,
	MsgChannelTestCompletedSubject, MsgChannelTestCompletedContent,
	MsgChannelUpstreamUpdateNotifySubject, MsgChannelUpstreamUpdateSummary,
	MsgChannelUpstreamUpdateChangedChannels, MsgChannelUpstreamUpdateMoreChannels,
	MsgChannelUpstreamUpdateAddedModels, MsgChannelUpstreamUpdateRemovedModels,
	MsgChannelUpstreamUpdateFailedChannels, MsgChannelUpstreamUpdateMoreOmitted,
}
