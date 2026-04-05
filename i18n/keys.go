package i18n

// Message keys for i18n translations
// Use these constants instead of hardcoded strings

// Common error messages
const (
	MsgInvalidParams     = "common.invalid_params"
	MsgDatabaseError     = "common.database_error"
	MsgRetryLater        = "common.retry_later"
	MsgGenerateFailed    = "common.generate_failed"
	MsgNotFound          = "common.not_found"
	MsgUnauthorized      = "common.unauthorized"
	MsgForbidden         = "common.forbidden"
	MsgInvalidId         = "common.invalid_id"
	MsgIdEmpty           = "common.id_empty"
	MsgFeatureDisabled   = "common.feature_disabled"
	MsgOperationSuccess  = "common.operation_success"
	MsgOperationFailed   = "common.operation_failed"
	MsgUpdateSuccess     = "common.update_success"
	MsgUpdateFailed      = "common.update_failed"
	MsgCreateSuccess     = "common.create_success"
	MsgCreateFailed      = "common.create_failed"
	MsgDeleteSuccess     = "common.delete_success"
	MsgDeleteFailed      = "common.delete_failed"
	MsgAlreadyExists     = "common.already_exists"
	MsgNameCannotBeEmpty = "common.name_cannot_be_empty"
)

// Token related messages
const (
	MsgTokenNameTooLong          = "token.name_too_long"
	MsgTokenQuotaNegative        = "token.quota_negative"
	MsgTokenQuotaExceedMax       = "token.quota_exceed_max"
	MsgTokenCountLimitReached    = "token.count_limit_reached"
	MsgTokenGenerateFailed       = "token.generate_failed"
	MsgTokenGetInfoFailed        = "token.get_info_failed"
	MsgTokenExpiredCannotEnable  = "token.expired_cannot_enable"
	MsgTokenExhaustedCannotEable = "token.exhausted_cannot_enable"
	MsgTokenInvalid              = "token.invalid"
	MsgTokenNotProvided          = "token.not_provided"
	MsgTokenExpired              = "token.expired"
	MsgTokenExhausted            = "token.exhausted"
	MsgTokenStatusUnavailable    = "token.status_unavailable"
	MsgTokenDbError              = "token.db_error"
)

// Redemption related messages
const (
	MsgRedemptionNameLength        = "redemption.name_length"
	MsgRedemptionCountPositive     = "redemption.count_positive"
	MsgRedemptionCountMax          = "redemption.count_max"
	MsgRedemptionCreateFailed      = "redemption.create_failed"
	MsgRedemptionInvalid           = "redemption.invalid"
	MsgRedemptionUsed              = "redemption.used"
	MsgRedemptionExpired           = "redemption.expired"
	MsgRedemptionFailed            = "redemption.failed"
	MsgRedemptionNotProvided       = "redemption.not_provided"
	MsgRedemptionExpireTimeInvalid = "redemption.expire_time_invalid"
)

// User related messages
const (
	MsgUserPasswordLoginDisabled     = "user.password_login_disabled"
	MsgUserRegisterDisabled          = "user.register_disabled"
	MsgUserPasswordRegisterDisabled  = "user.password_register_disabled"
	MsgUserUsernameOrPasswordEmpty   = "user.username_or_password_empty"
	MsgUserUsernameOrPasswordError   = "user.username_or_password_error"
	MsgUserEmailOrPasswordEmpty      = "user.email_or_password_empty"
	MsgUserExists                    = "user.exists"
	MsgUserNotExists                 = "user.not_exists"
	MsgUserDisabled                  = "user.disabled"
	MsgUserSessionSaveFailed         = "user.session_save_failed"
	MsgUserRequire2FA                = "user.require_2fa"
	MsgUserEmailVerificationRequired = "user.email_verification_required"
	MsgUserVerificationCodeError     = "user.verification_code_error"
	MsgUserInputInvalid              = "user.input_invalid"
	MsgUserNoPermissionSameLevel     = "user.no_permission_same_level"
	MsgUserNoPermissionHigherLevel   = "user.no_permission_higher_level"
	MsgUserCannotCreateHigherLevel   = "user.cannot_create_higher_level"
	MsgUserCannotDeleteRootUser      = "user.cannot_delete_root_user"
	MsgUserCannotDisableRootUser     = "user.cannot_disable_root_user"
	MsgUserCannotDemoteRootUser      = "user.cannot_demote_root_user"
	MsgUserAlreadyAdmin              = "user.already_admin"
	MsgUserAlreadyCommon             = "user.already_common"
	MsgUserAdminCannotPromote        = "user.admin_cannot_promote"
	MsgUserOriginalPasswordError     = "user.original_password_error"
	MsgUserInviteQuotaInsufficient   = "user.invite_quota_insufficient"
	MsgUserTransferQuotaMinimum      = "user.transfer_quota_minimum"
	MsgUserTransferSuccess           = "user.transfer_success"
	MsgUserTransferFailed            = "user.transfer_failed"
	MsgUserTopUpProcessing           = "user.topup_processing"
	MsgUserRegisterFailed            = "user.register_failed"
	MsgUserDefaultTokenFailed        = "user.default_token_failed"
	MsgUserAffCodeEmpty              = "user.aff_code_empty"
	MsgUserEmailEmpty                = "user.email_empty"
	MsgUserGitHubIdEmpty             = "user.github_id_empty"
	MsgUserDiscordIdEmpty            = "user.discord_id_empty"
	MsgUserOidcIdEmpty               = "user.oidc_id_empty"
	MsgUserWeChatIdEmpty             = "user.wechat_id_empty"
	MsgUserTelegramIdEmpty           = "user.telegram_id_empty"
	MsgUserTelegramNotBound          = "user.telegram_not_bound"
	MsgUserLinuxDOIdEmpty            = "user.linux_do_id_empty"
)

// Quota related messages
const (
	MsgQuotaNegative        = "quota.negative"
	MsgQuotaExceedMax       = "quota.exceed_max"
	MsgQuotaInsufficient    = "quota.insufficient"
	MsgQuotaWarningInvalid  = "quota.warning_invalid"
	MsgQuotaThresholdGtZero = "quota.threshold_gt_zero"
)

// Subscription related messages
const (
	MsgSubscriptionNotEnabled       = "subscription.not_enabled"
	MsgSubscriptionTitleEmpty       = "subscription.title_empty"
	MsgSubscriptionPriceNegative    = "subscription.price_negative"
	MsgSubscriptionPriceMax         = "subscription.price_max"
	MsgSubscriptionPurchaseLimitNeg = "subscription.purchase_limit_negative"
	MsgSubscriptionQuotaNegative    = "subscription.quota_negative"
	MsgSubscriptionGroupNotExists   = "subscription.group_not_exists"
	MsgSubscriptionResetCycleGtZero = "subscription.reset_cycle_gt_zero"
	MsgSubscriptionPurchaseMax      = "subscription.purchase_max"
	MsgSubscriptionInvalidId        = "subscription.invalid_id"
	MsgSubscriptionInvalidUserId    = "subscription.invalid_user_id"
)

// Payment related messages
const (
	MsgPaymentNotConfigured    = "payment.not_configured"
	MsgPaymentMethodNotExists  = "payment.method_not_exists"
	MsgPaymentCallbackError    = "payment.callback_error"
	MsgPaymentCreateFailed     = "payment.create_failed"
	MsgPaymentStartFailed      = "payment.start_failed"
	MsgPaymentAmountTooLow     = "payment.amount_too_low"
	MsgPaymentProductRequired  = "payment.product_required"
	MsgPaymentProductNotFound  = "payment.product_not_found"
	MsgPaymentStripeNotConfig  = "payment.stripe_not_configured"
	MsgPaymentWebhookNotConfig = "payment.webhook_not_configured"
	MsgPaymentPriceIdNotConfig = "payment.price_id_not_configured"
	MsgPaymentCreemNotConfig   = "payment.creem_not_configured"
)

// Topup related messages
const (
	MsgTopupNotProvided    = "topup.not_provided"
	MsgTopupOrderNotExists = "topup.order_not_exists"
	MsgTopupOrderStatus    = "topup.order_status"
	MsgTopupFailed         = "topup.failed"
	MsgTopupInvalidQuota   = "topup.invalid_quota"
)

// Channel related messages
const (
	MsgChannelNotExists              = "channel.not_exists"
	MsgChannelIdFormatError          = "channel.id_format_error"
	MsgChannelNoAvailableKey         = "channel.no_available_key"
	MsgChannelGetListFailed          = "channel.get_list_failed"
	MsgChannelGetTagsFailed          = "channel.get_tags_failed"
	MsgChannelGetKeyFailed           = "channel.get_key_failed"
	MsgChannelGetOllamaFailed        = "channel.get_ollama_failed"
	MsgChannelGetOllamaVersionFailed = "channel.get_ollama_version_failed"
	MsgChannelOllamaOnlyOperation    = "channel.ollama_only_operation"
	MsgChannelQueryFailed            = "channel.query_failed"
	MsgChannelNoValidUpstream        = "channel.no_valid_upstream"
	MsgChannelUpstreamSaturated      = "channel.upstream_saturated"
	MsgChannelGetAvailableFailed     = "channel.get_available_failed"
)

// Model related messages
const (
	MsgModelNameEmpty     = "model.name_empty"
	MsgModelNameExists    = "model.name_exists"
	MsgModelIdMissing     = "model.id_missing"
	MsgModelGetListFailed = "model.get_list_failed"
	MsgModelGetFailed     = "model.get_failed"
	MsgModelResetSuccess  = "model.reset_success"
)

// Vendor related messages
const (
	MsgVendorNameEmpty  = "vendor.name_empty"
	MsgVendorNameExists = "vendor.name_exists"
	MsgVendorIdMissing  = "vendor.id_missing"
)

// Group related messages
const (
	MsgGroupNameTypeEmpty = "group.name_type_empty"
	MsgGroupNameExists    = "group.name_exists"
	MsgGroupIdMissing     = "group.id_missing"
)

// Checkin related messages
const (
	MsgCheckinDisabled     = "checkin.disabled"
	MsgCheckinAlreadyToday = "checkin.already_today"
	MsgCheckinFailed       = "checkin.failed"
	MsgCheckinQuotaFailed  = "checkin.quota_failed"
)

// Passkey related messages
const (
	MsgPasskeyCreateFailed    = "passkey.create_failed"
	MsgPasskeyLoginAbnormal   = "passkey.login_abnormal"
	MsgPasskeyUpdateFailed    = "passkey.update_failed"
	MsgPasskeyInvalidUserId   = "passkey.invalid_user_id"
	MsgPasskeyVerifyFailed    = "passkey.verify_failed"
	MsgPasskeyNotEnabled      = "passkey.not_enabled"
	MsgPasskeyNotBound        = "passkey.not_bound"
	MsgPasskeyRegisterSuccess = "passkey.register_success"
	MsgPasskeyUnbound         = "passkey.unbound"
	MsgPasskeyResetSuccess    = "passkey.reset_success"
	MsgPasskeyVerifySuccess   = "passkey.verify_success"
)

// 2FA related messages
const (
	MsgTwoFANotEnabled    = "twofa.not_enabled"
	MsgTwoFAUserIdEmpty   = "twofa.user_id_empty"
	MsgTwoFAAlreadyExists = "twofa.already_exists"
	MsgTwoFARecordIdEmpty = "twofa.record_id_empty"
	MsgTwoFACodeInvalid   = "twofa.code_invalid"
)

// Rate limit related messages
const (
	MsgRateLimitReached      = "rate_limit.reached"
	MsgRateLimitTotalReached = "rate_limit.total_reached"
)

// Setting related messages
const (
	MsgSettingInvalidType      = "setting.invalid_type"
	MsgSettingWebhookEmpty     = "setting.webhook_empty"
	MsgSettingWebhookInvalid   = "setting.webhook_invalid"
	MsgSettingEmailInvalid     = "setting.email_invalid"
	MsgSettingBarkUrlEmpty     = "setting.bark_url_empty"
	MsgSettingBarkUrlInvalid   = "setting.bark_url_invalid"
	MsgSettingGotifyUrlEmpty   = "setting.gotify_url_empty"
	MsgSettingGotifyTokenEmpty = "setting.gotify_token_empty"
	MsgSettingGotifyUrlInvalid = "setting.gotify_url_invalid"
	MsgSettingUrlMustHttp      = "setting.url_must_http"
	MsgSettingSaved            = "setting.saved"
)

// Deployment related messages (io.net)
const (
	MsgDeploymentNotEnabled     = "deployment.not_enabled"
	MsgDeploymentIdRequired     = "deployment.id_required"
	MsgDeploymentContainerIdReq = "deployment.container_id_required"
	MsgDeploymentNameEmpty      = "deployment.name_empty"
	MsgDeploymentNameTaken      = "deployment.name_taken"
	MsgDeploymentHardwareIdReq  = "deployment.hardware_id_required"
	MsgDeploymentHardwareInvId  = "deployment.hardware_invalid_id"
	MsgDeploymentApiKeyRequired = "deployment.api_key_required"
	MsgDeploymentInvalidPayload = "deployment.invalid_payload"
	MsgDeploymentNotFound       = "deployment.not_found"
)

// Performance related messages
const (
	MsgPerfDiskCacheCleared    = "performance.disk_cache_cleared"
	MsgPerfStatsReset          = "performance.stats_reset"
	MsgPerfGcExecuted          = "performance.gc_executed"
	MsgPerfInvalidMode         = "performance.invalid_mode"
	MsgPerfInvalidValue        = "performance.invalid_value"
	MsgPerfLogDirNotConfigured = "performance.log_dir_not_configured"
)

// Ability related messages
const (
	MsgAbilityDbCorrupted   = "ability.db_corrupted"
	MsgAbilityRepairRunning = "ability.repair_running"
)

// OAuth related messages
const (
	MsgOAuthInvalidCode     = "oauth.invalid_code"
	MsgOAuthGetUserErr      = "oauth.get_user_error"
	MsgOAuthAccountUsed     = "oauth.account_used"
	MsgOAuthUnknownProvider = "oauth.unknown_provider"
	MsgOAuthStateInvalid    = "oauth.state_invalid"
	MsgOAuthNotEnabled      = "oauth.not_enabled"
	MsgOAuthUserDeleted     = "oauth.user_deleted"
	MsgOAuthUserBanned      = "oauth.user_banned"
	MsgOAuthBindSuccess     = "oauth.bind_success"
	MsgOAuthAlreadyBound    = "oauth.already_bound"
	MsgOAuthConnectFailed   = "oauth.connect_failed"
	MsgOAuthTokenFailed     = "oauth.token_failed"
	MsgOAuthUserInfoEmpty   = "oauth.user_info_empty"
	MsgOAuthTrustLevelLow   = "oauth.trust_level_low"
)

// Model layer error messages (for translation in controller)
const (
	MsgRedeemFailed          = "redeem.failed"
	MsgCreateDefaultTokenErr = "user.create_default_token_error"
	MsgUuidDuplicate         = "common.uuid_duplicate"
	MsgInvalidInput          = "common.invalid_input"
)

// Distributor related messages
const (
	MsgDistributorInvalidRequest      = "distributor.invalid_request"
	MsgDistributorInvalidChannelId    = "distributor.invalid_channel_id"
	MsgDistributorChannelDisabled     = "distributor.channel_disabled"
	MsgDistributorTokenNoModelAccess  = "distributor.token_no_model_access"
	MsgDistributorTokenModelForbidden = "distributor.token_model_forbidden"
	MsgDistributorModelNameRequired   = "distributor.model_name_required"
	MsgDistributorInvalidPlayground   = "distributor.invalid_playground_request"
	MsgDistributorGroupAccessDenied   = "distributor.group_access_denied"
	MsgDistributorGetChannelFailed    = "distributor.get_channel_failed"
	MsgDistributorNoAvailableChannel  = "distributor.no_available_channel"
	MsgDistributorInvalidMidjourney   = "distributor.invalid_midjourney_request"
	MsgDistributorInvalidParseModel   = "distributor.invalid_request_parse_model"
)

// Custom OAuth provider related messages
const (
	MsgCustomOAuthNotFound                  = "custom_oauth.not_found"
	MsgCustomOAuthSlugEmpty                 = "custom_oauth.slug_empty"
	MsgCustomOAuthSlugExists                = "custom_oauth.slug_exists"
	MsgCustomOAuthSlugConflictBuiltin       = "custom_oauth.slug_conflict_builtin"
	MsgCustomOAuthNameEmpty                 = "custom_oauth.name_empty"
	MsgCustomOAuthInvalidRequestParams      = "custom_oauth.invalid_request_params"
	MsgCustomOAuthDiscoveryOrIssuerRequired = "custom_oauth.discovery_or_issuer_required"
	MsgCustomOAuthDiscoveryURLInvalid       = "custom_oauth.discovery_url_invalid"
	MsgCustomOAuthDiscoveryRequestFailed    = "custom_oauth.discovery_request_failed"
	MsgCustomOAuthDiscoveryFetchFailed      = "custom_oauth.discovery_fetch_failed"
	MsgCustomOAuthDiscoveryParseFailed      = "custom_oauth.discovery_parse_failed"
	MsgCustomOAuthBindingCheckFailed        = "custom_oauth.binding_check_failed"
	MsgCustomOAuthHasBindings               = "custom_oauth.has_bindings"
	MsgCustomOAuthBindingNotFound           = "custom_oauth.binding_not_found"
	MsgCustomOAuthProviderIdInvalid         = "custom_oauth.provider_id_field_invalid"
)

// Usage data messages
const (
	MsgUsageTimeRangeTooLong = "usedata.time_range_too_long"
)

// Log messages
const (
	MsgLogDeprecated = "log.deprecated_api"
)

// Channel affinity messages
const (
	MsgChannelAffinityRuleRequired = "channel_affinity.rule_required"
)

// Codex messages
const (
	MsgCodexChannelTypeInvalid    = "codex.channel_type_invalid"
	MsgCodexMultiKeyUnsupported   = "codex.multi_key_unsupported"
	MsgCodexCredentialParseFailed = "codex.credential_parse_failed"
	MsgCodexAccessTokenRequired   = "codex.access_token_required"
	MsgCodexAccountIDRequired     = "codex.account_id_required"
	MsgCodexUsageFetchFailed      = "codex.usage_fetch_failed"
	MsgCodexAuthInputParseFailed  = "codex.auth_input_parse_failed"
	MsgCodexOAuthFlowExpired      = "codex.oauth_flow_expired"
	MsgCodexTokenExchangeFailed   = "codex.token_exchange_failed"
	MsgCodexAccountExtractFailed  = "codex.account_extract_failed"
)

// Secure verification messages
const (
	MsgSecureVerificationMethodNotEnabled = "secure_verification.method_not_enabled"
)

// Setup messages
const (
	MsgSetupAlreadyCompleted   = "setup.already_completed"
	MsgSetupUsernameTooLong    = "setup.username_too_long"
	MsgSetupPasswordMismatch   = "setup.password_mismatch"
	MsgSetupPasswordTooShort   = "setup.password_too_short"
	MsgSetupSystemError        = "setup.system_error"
	MsgSetupCreateAdminFailed  = "setup.create_admin_failed"
	MsgSetupSaveSelfUseFailed  = "setup.save_self_use_failed"
	MsgSetupSaveDemoSiteFailed = "setup.save_demo_site_failed"
	MsgSetupInitFailed         = "setup.init_failed"
	MsgSetupInitSuccess        = "setup.init_success"
)

// Option messages
const (
	MsgOptionEnableRequiresConfig = "option.enable_requires_config"
	MsgOptionRatioUpdateFailed    = "option.ratio_update_failed"
)

// Misc messages
const (
	MsgMiscInvalidEmail        = "misc.invalid_email"
	MsgMiscEmailDomainRejected = "misc.email_domain_rejected"
	MsgMiscEmailAliasRejected  = "misc.email_alias_rejected"
	MsgMiscResetLinkInvalid    = "misc.reset_link_invalid"
)

// Additional user messages
const (
	MsgUserGetGroupFailed = "user.get_group_failed"
)

// Additional payment messages
const (
	MsgPaymentMinTopup                 = "payment.min_topup"
	MsgPaymentMaxTopup                 = "payment.max_topup"
	MsgPaymentSuccessRedirectUntrusted = "payment.success_redirect_untrusted"
	MsgPaymentCancelRedirectUntrusted  = "payment.cancel_redirect_untrusted"
)

// Additional 2FA messages
const (
	MsgTwoFASecretGenerateFailed = "twofa.secret_generate_failed"
	MsgTwoFABackupGenerateFailed = "twofa.backup_generate_failed"
	MsgTwoFABackupSaveFailed     = "twofa.backup_save_failed"
	MsgTwoFASetupInitSuccess     = "twofa.setup_init_success"
	MsgTwoFASetupRequired        = "twofa.setup_required"
	MsgTwoFAEnableSuccess        = "twofa.enable_success"
	MsgTwoFADisableSuccess       = "twofa.disable_success"
	MsgTwoFABackupRegenerated    = "twofa.backup_regenerated"
	MsgTwoFASessionExpired       = "twofa.session_expired"
	MsgTwoFASessionInvalid       = "twofa.session_invalid"
	MsgTwoFAAdminDisabled        = "twofa.admin_disabled"
)

// Additional channel messages
const (
	MsgChannelRefreshCredentialFailed      = "channel.refresh_credential_failed"
	MsgChannelUnsupportedAddMode           = "channel.unsupported_add_mode"
	MsgChannelTagRequired                  = "channel.tag_required"
	MsgChannelParamOverrideInvalidJSON     = "channel.param_override_invalid_json"
	MsgChannelHeaderOverrideInvalidJSON    = "channel.header_override_invalid_json"
	MsgChannelAppendKeyParseFailed         = "channel.append_key_parse_failed"
	MsgChannelCopyFailed                   = "channel.copy_failed"
	MsgChannelNotMultiKeyMode              = "channel.not_multi_key_mode"
	MsgChannelKeyIndexRequiredDisable      = "channel.key_index_required_disable"
	MsgChannelKeyIndexOutOfRange           = "channel.key_index_out_of_range"
	MsgChannelKeyDisabled                  = "channel.key_disabled"
	MsgChannelKeyIndexRequiredEnable       = "channel.key_index_required_enable"
	MsgChannelKeyEnabled                   = "channel.key_enabled"
	MsgChannelEnabledKeysCount             = "channel.enabled_keys_count"
	MsgChannelNoKeysToDisable              = "channel.no_keys_to_disable"
	MsgChannelDisabledKeysCount            = "channel.disabled_keys_count"
	MsgChannelKeyIndexRequiredDelete       = "channel.key_index_required_delete"
	MsgChannelCannotDeleteLastKey          = "channel.cannot_delete_last_key"
	MsgChannelKeyDeleted                   = "channel.key_deleted"
	MsgChannelNoAutoDisabledKeysToDelete   = "channel.no_auto_disabled_keys_to_delete"
	MsgChannelDeletedAutoDisabledKeysCount = "channel.deleted_auto_disabled_keys_count"
	MsgChannelMultiKeyBalanceUnsupported   = "channel.multi_key_balance_unsupported"
	MsgChannelUnsupportedOperation         = "channel.unsupported_operation"
)
