package dto

// ─── Shared / Reusable ──────────────────────────────────────────────

type StatusOnlyParams struct {
	StatusOnly string `query:"status_only" description:"Only update status"`
}

type EmailParams struct {
	Email string `query:"email" description:"Email address"`
}

type TopUpSearchParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
}

// ─── OAuth ──────────────────────────────────────────────────────────

type GenerateOAuthCodeParams struct {
	Aff string `query:"aff" description:"Affiliate code"`
}

type WeChatBindParams struct {
	Code string `query:"code" description:"WeChat auth code"`
}

type EmailBindParams struct {
	Email string `query:"email" description:"Email address"`
	Code  string `query:"code"  description:"Verification code"`
}

// ─── User ───────────────────────────────────────────────────────────

type SearchUsersParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
	Group   string `query:"group"   description:"Filter by group"`
}

// ─── Checkin ────────────────────────────────────────────────────────

type GetCheckinStatusParams struct {
	Month string `query:"month" description:"Month in YYYY-MM format"`
}

// ─── Token ──────────────────────────────────────────────────────────

type SearchTokensParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
	Token   string `query:"token"   description:"Filter by token"`
}

// ─── Redemption ─────────────────────────────────────────────────────

type SearchRedemptionsParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
}

// ─── Log ────────────────────────────────────────────────────────────

type GetAllLogsParams struct {
	Type           int    `query:"type"`
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	Username       string `query:"username"         description:"Filter by username"`
	TokenName      string `query:"token_name"       description:"Filter by token name"`
	ModelName      string `query:"model_name"       description:"Filter by model name"`
	Channel        int    `query:"channel"`
	Group          string `query:"group"            description:"Filter by group"`
	RequestID      string `query:"request_id"       description:"Filter by request ID"`
}

type GetUserLogsParams struct {
	Type           int    `query:"type"`
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	TokenName      string `query:"token_name"       description:"Filter by token name"`
	ModelName      string `query:"model_name"       description:"Filter by model name"`
	Group          string `query:"group"            description:"Filter by group"`
	RequestID      string `query:"request_id"       description:"Filter by request ID"`
}

type LogStatParams struct {
	Type           int    `query:"type"`
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	TokenName      string `query:"token_name"       description:"Filter by token name"`
	Username       string `query:"username"         description:"Filter by username"`
	ModelName      string `query:"model_name"       description:"Filter by model name"`
	Channel        int    `query:"channel"`
	Group          string `query:"group"            description:"Filter by group"`
}

type LogSelfStatParams struct {
	Type           int    `query:"type"`
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	TokenName      string `query:"token_name"       description:"Filter by token name"`
	ModelName      string `query:"model_name"       description:"Filter by model name"`
	Channel        int    `query:"channel"`
	Group          string `query:"group"            description:"Filter by group"`
}

type DeleteHistoryLogsParams struct {
	TargetTimestamp int64 `query:"target_timestamp"`
}

// ─── Quota / Usage Data ─────────────────────────────────────────────

type GetAllQuotaDatesParams struct {
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	Username       string `query:"username"         description:"Filter by username"`
}

type GetUserQuotaDatesParams struct {
	StartTimestamp int64 `query:"start_timestamp"`
	EndTimestamp   int64 `query:"end_timestamp"`
}

// ─── Prefill Group ──────────────────────────────────────────────────

type GetPrefillGroupsParams struct {
	Type string `query:"type" description:"Filter by group type"`
}

// ─── Channel ────────────────────────────────────────────────────────

type GetAllChannelsParams struct {
	IdSort  bool   `query:"id_sort"`
	TagMode bool   `query:"tag_mode"`
	Status  string `query:"status"   description:"Filter by status"`
	Type    int    `query:"type"`
}

type SearchChannelsParams struct {
	Keyword string `query:"keyword"  description:"Search keyword"`
	Group   string `query:"group"    description:"Filter by group"`
	Model   string `query:"model"    description:"Filter by model"`
	Status  string `query:"status"   description:"Filter by status"`
	IdSort  bool   `query:"id_sort"`
	TagMode bool   `query:"tag_mode"`
	Type    int    `query:"type"`
}

type GetTagModelsParams struct {
	Tag string `query:"tag" description:"Tag name"`
}

type CopyChannelParams struct {
	Suffix       string `query:"suffix"        description:"Name suffix"`
	ResetBalance bool   `query:"reset_balance"`
}

type TestChannelParams struct {
	Model        string `query:"model"         description:"Model to test"`
	EndpointType string `query:"endpoint_type"  description:"Endpoint type"`
	Stream       bool   `query:"stream"`
}

// ─── Channel Affinity Cache ─────────────────────────────────────────

type ClearChannelAffinityCacheParams struct {
	All      string `query:"all"       description:"Clear all entries"`
	RuleName string `query:"rule_name" description:"Filter by rule name"`
}

type GetChannelAffinityUsageCacheStatsParams struct {
	RuleName   string `query:"rule_name"   description:"Filter by rule name"`
	UsingGroup string `query:"using_group" description:"Filter by group"`
	KeyFp      string `query:"key_fp"      description:"Filter by key fingerprint"`
}

// ─── Vendor ─────────────────────────────────────────────────────────

type SearchVendorsParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
}

// ─── Model Meta ─────────────────────────────────────────────────────

type SearchModelsMetaParams struct {
	Keyword string `query:"keyword" description:"Search keyword"`
	Vendor  string `query:"vendor"  description:"Filter by vendor"`
}

// ─── Model Sync ─────────────────────────────────────────────────────

type SyncUpstreamPreviewParams struct {
	Locale string `query:"locale" description:"Locale for model descriptions"`
}

// ─── Midjourney ─────────────────────────────────────────────────────

type GetAllMidjourneyParams struct {
	ChannelID      string `query:"channel_id"      description:"Filter by channel ID"`
	MjID           string `query:"mj_id"           description:"Midjourney task ID"`
	StartTimestamp string `query:"start_timestamp"  description:"Start timestamp"`
	EndTimestamp   string `query:"end_timestamp"    description:"End timestamp"`
}

type GetUserMidjourneyParams struct {
	MjID           string `query:"mj_id"           description:"Midjourney task ID"`
	StartTimestamp string `query:"start_timestamp"  description:"Start timestamp"`
	EndTimestamp   string `query:"end_timestamp"    description:"End timestamp"`
}

// ─── Task ───────────────────────────────────────────────────────────

type GetAllTaskParams struct {
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	Platform       string `query:"platform"        description:"Filter by platform"`
	TaskID         string `query:"task_id"         description:"Filter by task ID"`
	Status         string `query:"status"          description:"Filter by status"`
	Action         string `query:"action"          description:"Filter by action"`
	ChannelID      string `query:"channel_id"      description:"Filter by channel ID"`
}

type GetUserTaskParams struct {
	StartTimestamp int64  `query:"start_timestamp"`
	EndTimestamp   int64  `query:"end_timestamp"`
	Platform       string `query:"platform"        description:"Filter by platform"`
	TaskID         string `query:"task_id"         description:"Filter by task ID"`
	Status         string `query:"status"          description:"Filter by status"`
	Action         string `query:"action"          description:"Filter by action"`
}

// ─── Deployment ─────────────────────────────────────────────────────

type GetAllDeploymentsParams struct {
	Status string `query:"status" description:"Filter by status"`
}

type SearchDeploymentsParams struct {
	Status  string `query:"status"  description:"Filter by status"`
	Keyword string `query:"keyword" description:"Search keyword"`
}

type GetAvailableReplicasParams struct {
	HardwareID int `query:"hardware_id"`
	GpuCount   int `query:"gpu_count"`
}

type CheckClusterNameAvailabilityParams struct {
	Name string `query:"name" description:"Cluster name to check"`
}

type GetDeploymentLogsParams struct {
	ContainerID string `query:"container_id" description:"Container ID"`
	Level       string `query:"level"        description:"Log level"`
	Stream      string `query:"stream"       description:"Stream type"`
	Cursor      string `query:"cursor"       description:"Pagination cursor"`
	Limit       int    `query:"limit"`
	Follow      bool   `query:"follow"`
	StartTime   string `query:"start_time"   description:"Start time (RFC3339)"`
	EndTime     string `query:"end_time"     description:"End time (RFC3339)"`
}
