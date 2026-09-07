package constant

type ContextKey string

const (
	ContextKeyTokenCountMeta  ContextKey = "token_count_meta"
	ContextKeyPromptTokens    ContextKey = "prompt_tokens"
	ContextKeyEstimatedTokens ContextKey = "estimated_tokens"

	ContextKeyOriginalModel    ContextKey = "original_model"
	ContextKeyRequestStartTime ContextKey = "request_start_time"

	/* token related keys */
	ContextKeyTokenUnlimited         ContextKey = "token_unlimited_quota"
	ContextKeyTokenKey               ContextKey = "token_key"
	ContextKeyTokenId                ContextKey = "token_id"
	ContextKeyTokenGroup             ContextKey = "token_group"
	ContextKeyOriginTasks            ContextKey = "origin_tasks"
	ContextKeyChannelConstraints     ContextKey = "channel_constraints"
	ContextKeyTokenModelLimitEnabled ContextKey = "token_model_limit_enabled"
	ContextKeyTokenModelLimit        ContextKey = "token_model_limit"
	ContextKeyTokenCrossGroupRetry   ContextKey = "token_cross_group_retry"
	ContextKeyTokenAutoGroups        ContextKey = "token_auto_groups"

	/* channel related keys */
	ContextKeyChannelId                ContextKey = "channel_id"
	ContextKeyChannelName              ContextKey = "channel_name"
	ContextKeyChannelCreateTime        ContextKey = "channel_create_time"
	ContextKeyChannelBaseUrl           ContextKey = "base_url"
	ContextKeyChannelType              ContextKey = "channel_type"
	ContextKeyChannelSetting           ContextKey = "channel_setting"
	ContextKeyChannelOtherSetting      ContextKey = "channel_other_setting"
	ContextKeyChannelParamOverride     ContextKey = "param_override"
	ContextKeyChannelHeaderOverride    ContextKey = "header_override"
	ContextKeyChannelOrganization      ContextKey = "channel_organization"
	ContextKeyChannelAutoBan           ContextKey = "auto_ban"
	ContextKeyChannelModelMapping      ContextKey = "model_mapping"
	ContextKeyChannelStatusCodeMapping ContextKey = "status_code_mapping"
	ContextKeyChannelIsMultiKey        ContextKey = "channel_is_multi_key"
	ContextKeyChannelMultiKeyIndex     ContextKey = "channel_multi_key_index"
	ContextKeyChannelKey               ContextKey = "channel_key"
	// ContextKeySchedulerKeyIndex is an optional per-attempt hint supplied by
	// the Scheduler. When present, new-api must consume exactly this enabled
	// multi-key slot instead of applying its local random/polling policy.
	ContextKeySchedulerKeyIndex          ContextKey = "scheduler_key_index"
	ContextKeySchedulerCandidates        ContextKey = "scheduler_candidates"
	ContextKeySchedulerDecisionID        ContextKey = "scheduler_decision_id"
	ContextKeySchedulerScoreVersion      ContextKey = "scheduler_score_version"
	ContextKeySchedulerPreferenceVersion ContextKey = "scheduler_preference_version"
	ContextKeySchedulerReservationID     ContextKey = "scheduler_reservation_id"
	ContextKeySchedulerShadowMatch       ContextKey = "scheduler_shadow_match"
	ContextKeySchedulerUpstreamModel     ContextKey = "scheduler_upstream_model"
	ContextKeySchedulerAttemptReported   ContextKey = "scheduler_attempt_reported"
	ContextKeySchedulerInputTokens       ContextKey = "scheduler_input_tokens"
	ContextKeySchedulerOutputTokens      ContextKey = "scheduler_output_tokens"
	ContextKeySchedulerUsageUnverified   ContextKey = "scheduler_usage_unverified"
	ContextKeySchedulerEstimatedTokens   ContextKey = "scheduler_estimated_tokens"
	ContextKeySchedulerStreamStarted     ContextKey = "scheduler_stream_started"
	ContextKeySchedulerTTFTMS            ContextKey = "scheduler_ttft_ms"
	ContextKeySchedulerWorkload          ContextKey = "scheduler_workload"
	// ContextKeySchedulerAllowedChannelIDs carries the effective group/model
	// channel scope into the Scheduler request. An empty-but-present slice
	// means the group has no usable channel and must not fall back globally.
	ContextKeySchedulerAllowedChannelIDs ContextKey = "scheduler_allowed_channel_ids"
	// ContextKeySchedulerAffinityChannelID carries the currently bound
	// conversation-affinity channel into an enforced Scheduler request.
	ContextKeySchedulerAffinityChannelID ContextKey = "scheduler_affinity_channel_id"
	// ContextKeySchedulerEmergencyNative marks a request that explicitly fell
	// back to native routing because Scheduler infrastructure was unavailable.
	ContextKeySchedulerEmergencyNative ContextKey = "scheduler_emergency_native"
	ContextKeySchedulerDegradedReason  ContextKey = "scheduler_degraded_reason"
	ContextKeySchedulerFailureReason   ContextKey = "scheduler_failure_reason"
	ContextKeySchedulerEnforcedRequest ContextKey = "scheduler_enforced_request"

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

	// ContextKeyRelayAttempt stores the in-progress relay attempt telemetry
	// record, so the upstream request layer and the billing layer can annotate
	// the attempt they are part of without threading a parameter through every
	// relay handler signature.
	ContextKeyRelayAttempt ContextKey = "relay_attempt"

	// ContextKeyFinishReason stores the terminal finish/stop reason reported by
	// the upstream model, extracted where the response is already being parsed.
	ContextKeyFinishReason ContextKey = "finish_reason"

	// ContextKeyLanguage stores the user's language preference for i18n
	ContextKeyLanguage ContextKey = "language"
	ContextKeyIsStream ContextKey = "is_stream"

	// ContextKeyAuditLogged marks that the current request has already recorded
	// a manage/operation audit log inside the handler. When set, the admin-audit
	// fallback in authHelper (finishAdminAudit) skips its record to avoid
	// duplicate entries.
	ContextKeyAuditLogged ContextKey = "audit_logged"
)
