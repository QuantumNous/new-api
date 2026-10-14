package constant

type ContextKey string

const (
	ContextKeyTokenCountMeta  ContextKey = "token_count_meta"
	ContextKeyPromptTokens    ContextKey = "prompt_tokens"
	ContextKeyEstimatedTokens ContextKey = "estimated_tokens"

	ContextKeyOriginalModel    ContextKey = "original_model"
	ContextKeyRequestStartTime ContextKey = "request_start_time"

	/* token related keys */
	ContextKeyTokenUnlimited                ContextKey = "token_unlimited_quota"
	ContextKeyTokenKey                      ContextKey = "token_key"
	ContextKeyTokenId                       ContextKey = "token_id"
	ContextKeyTokenGroup                    ContextKey = "token_group"
	ContextKeyOriginTasks                   ContextKey = "origin_tasks"
	ContextKeyChannelConstraints            ContextKey = "channel_constraints"
	ContextKeyTokenModelLimitEnabled        ContextKey = "token_model_limit_enabled"
	ContextKeyTokenModelLimit               ContextKey = "token_model_limit"
	ContextKeyTokenCrossGroupRetry          ContextKey = "token_cross_group_retry"
	ContextKeyTokenAutoGroups               ContextKey = "token_auto_groups"
	ContextKeyTokenStreamRecovery           ContextKey = "token_stream_recovery"
	ContextKeyTokenDefaultRoutingStrategy   ContextKey = "token_default_routing_strategy"
	ContextKeyTokenAllowedRoutingStrategies ContextKey = "token_allowed_routing_strategies"
	ContextKeyTokenDefaultConversionPolicy  ContextKey = "token_default_conversion_policy"
	ContextKeyTokenAllowLossyConversion     ContextKey = "token_allow_lossy_conversion"

	ContextKeyRoutingStrategy             ContextKey = "routing_strategy"
	ContextKeyConversionPolicy            ContextKey = "conversion_policy"
	ContextKeyRealtimeTicket              ContextKey = "realtime_ticket"
	ContextKeyRealtimeModel               ContextKey = "realtime_model"
	ContextKeyRealtimeClientWS            ContextKey = "realtime_client_ws"
	ContextKeyRealtimeSetup               ContextKey = "realtime_setup"
	ContextKeyRealtimeMessageType         ContextKey = "realtime_message_type"
	ContextKeyRealtimeWSOwned             ContextKey = "realtime_ws_owned"
	ContextKeyRealtimeSetupForwarded      ContextKey = "realtime_setup_forwarded"
	ContextKeyGeminiLiveUsageEstimated    ContextKey = "gemini_live_usage_estimated"
	ContextKeyRealtimeQuotaLimit          ContextKey = "realtime_quota_limit"
	ContextKeyRealtimeWSTerminated        ContextKey = "realtime_ws_terminated"
	ContextKeyRealtimeFailed              ContextKey = "realtime_failed"
	ContextKeyRealtimeSettlementUncertain ContextKey = "realtime_settlement_uncertain"

	/* channel related keys */
	ContextKeyChannelId                         ContextKey = "channel_id"
	ContextKeyChannelName                       ContextKey = "channel_name"
	ContextKeyChannelCreateTime                 ContextKey = "channel_create_time"
	ContextKeyChannelBaseUrl                    ContextKey = "base_url"
	ContextKeyChannelType                       ContextKey = "channel_type"
	ContextKeyChannelSetting                    ContextKey = "channel_setting"
	ContextKeyChannelOtherSetting               ContextKey = "channel_other_setting"
	ContextKeyChannelParamOverride              ContextKey = "param_override"
	ContextKeyChannelHeaderOverride             ContextKey = "header_override"
	ContextKeyChannelOrganization               ContextKey = "channel_organization"
	ContextKeyChannelAutoBan                    ContextKey = "auto_ban"
	ContextKeyChannelModelMapping               ContextKey = "model_mapping"
	ContextKeyChannelStatusCodeMapping          ContextKey = "status_code_mapping"
	ContextKeyChannelIsMultiKey                 ContextKey = "channel_is_multi_key"
	ContextKeyChannelMultiKeyIndex              ContextKey = "channel_multi_key_index"
	ContextKeyChannelKey                        ContextKey = "channel_key"
	ContextKeyManagedHealthPersistenceUncertain ContextKey = "managed_health_persistence_uncertain"

	ContextKeyAutoGroup           ContextKey = "auto_group"
	ContextKeyAutoGroupIndex      ContextKey = "auto_group_index"
	ContextKeyAutoGroupRetryIndex ContextKey = "auto_group_retry_index"

	/* user related keys */
	ContextKeyUserId      ContextKey = "id"
	ContextKeyUserSetting ContextKey = "user_setting"
	ContextKeyUserQuota   ContextKey = "user_quota"
	ContextKeyUserStatus  ContextKey = "user_status"
	ContextKeyUserEmail   ContextKey = "user_email"
	ContextKeyUserGroup   ContextKey = "user_group"
	ContextKeyUsingGroup  ContextKey = "group"
	ContextKeyUserName    ContextKey = "username"

	ContextKeyLocalCountTokens ContextKey = "local_count_tokens"

	ContextKeySystemPromptOverride ContextKey = "system_prompt_override"

	// ContextKeyFileSourcesToCleanup stores file sources that need cleanup when request ends
	ContextKeyFileSourcesToCleanup ContextKey = "file_sources_to_cleanup"

	// ContextKeyAdminRejectReason stores an admin-only reject/block reason extracted from upstream responses.
	// It is not returned to end users, but can be persisted into consume/error logs for debugging.
	ContextKeyAdminRejectReason ContextKey = "admin_reject_reason"

	// ContextKeyLanguage stores the user's language preference for i18n
	ContextKeyLanguage             ContextKey = "language"
	ContextKeyIsStream             ContextKey = "is_stream"
	ContextKeyResponseStreamStatus ContextKey = "response_stream_status"

	ContextKeyStreamRecoveryWorker            ContextKey = "stream_recovery_worker"
	ContextKeyStreamRecoveryID                ContextKey = "stream_recovery_id"
	ContextKeyStreamRecoveryRunner            ContextKey = "stream_recovery_runner"
	ContextKeyStreamRecoveryBroker            ContextKey = "stream_recovery_broker"
	ContextKeyStreamRecoveryReplayUnsafe      ContextKey = "stream_recovery_replay_unsafe"
	ContextKeyStreamRecoverySubmissionStarted ContextKey = "stream_recovery_submission_started"
	ContextKeyStreamRecoveryBillingUncertain  ContextKey = "stream_recovery_billing_uncertain"

	// ContextKeyAuditLogged marks that the current request has already recorded
	// a manage/operation audit log inside the handler. When set, the admin-audit
	// fallback in authHelper (finishAdminAudit) skips its record to avoid
	// duplicate entries.
	ContextKeyAuditLogged ContextKey = "audit_logged"

	// ContextKeyTokenAuditParams contains only the API token operation's safe metadata.
	ContextKeyTokenAuditParams ContextKey = "token_audit_params"
	// ContextKeyTokenAuditSucceeded disambiguates token responses that exceed the audit buffer.
	ContextKeyTokenAuditSucceeded ContextKey = "token_audit_succeeded"
)
