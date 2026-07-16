package dto

// Fork-owned response DTOs for admin endpoints whose handlers reply with
// ad-hoc gin.H maps or with types living in packages the OpenAPI generator
// does not parse (service/*, pkg/perf_metrics). Each struct mirrors the exact
// JSON shape produced by its handler and is referenced from
// cmd/gen-admin-openapi/manifest.go via respSpec{Type: "..."} — keep both in
// sync when a handler changes.

// ChannelOpsResponse — GET /api/channel/ops (controller.GetChannelOps).
type ChannelOpsResponse struct {
	RetryTimes int `json:"retry_times"`
}

// DeletedCountResponse — DELETE /api/system-info/stale-instances and
// DELETE /api/system-info/instances/{node_name}.
type DeletedCountResponse struct {
	DeletedCount int64 `json:"deleted_count"`
}

// PaymentComplianceResponse — POST /api/option/payment_compliance
// (controller.ConfirmPaymentCompliance).
type PaymentComplianceResponse struct {
	Confirmed    bool   `json:"confirmed"`
	TermsVersion string `json:"terms_version"`
	ConfirmedAt  int64  `json:"confirmed_at"`
	ConfirmedBy  int    `json:"confirmed_by"`
}

// AuthzActionDefinition mirrors service/authz.ActionDefinition.
type AuthzActionDefinition struct {
	Action         string `json:"action"`
	LabelKey       string `json:"label_key"`
	DescriptionKey string `json:"description_key"`
}

// AuthzResourceDefinition mirrors service/authz.ResourceDefinition.
type AuthzResourceDefinition struct {
	Resource string                  `json:"resource"`
	LabelKey string                  `json:"label_key"`
	Actions  []AuthzActionDefinition `json:"actions"`
}

// AuthzRoleDescriptor mirrors service/authz.RoleDescriptor.
type AuthzRoleDescriptor struct {
	Key       string                     `json:"key"`
	Name      string                     `json:"name"`
	BuiltIn   bool                       `json:"built_in"`
	Superuser bool                       `json:"superuser"`
	Grants    map[string]map[string]bool `json:"grants"`
}

// AuthzCatalogResponse — GET /api/authz/catalog (controller.GetPermissionCatalog).
type AuthzCatalogResponse struct {
	Resources []AuthzResourceDefinition `json:"resources"`
	Roles     []AuthzRoleDescriptor     `json:"roles"`
}

// PerfMetricsModelSummary mirrors pkg/perf_metrics.ModelSummary.
type PerfMetricsModelSummary struct {
	ModelName          string    `json:"model_name"`
	AvgLatencyMs       int64     `json:"avg_latency_ms"`
	SuccessRate        float64   `json:"success_rate"`
	AvgTps             float64   `json:"avg_tps"`
	RecentSuccessRates []float64 `json:"recent_success_rates,omitempty"`
}

// PerfMetricsSummaryResponse — GET /api/perf-metrics/summary
// (controller.GetPerfMetricsSummary), mirrors pkg/perf_metrics.SummaryAllResult.
type PerfMetricsSummaryResponse struct {
	Models []PerfMetricsModelSummary `json:"models"`
}

// WaffoPancakeCatalogProduct mirrors service.WaffoPancakeCatalogProduct.
type WaffoPancakeCatalogProduct struct {
	ID     string `json:"id"`
	Name   string `json:"name"`
	Status string `json:"status"`
}

// WaffoPancakeCatalogStore mirrors service.WaffoPancakeCatalogStore.
type WaffoPancakeCatalogStore struct {
	ID              string                       `json:"id"`
	Name            string                       `json:"name"`
	Status          string                       `json:"status"`
	ProdEnabled     bool                         `json:"prodEnabled"`
	OnetimeProducts []WaffoPancakeCatalogProduct `json:"onetimeProducts"`
}

// WaffoPancakeCatalogResponse — GET /api/option/waffo-pancake/catalog,
// mirrors service.WaffoPancakeCatalog.
type WaffoPancakeCatalogResponse struct {
	Stores []WaffoPancakeCatalogStore `json:"stores"`
}

// WaffoPancakeProductOptionsResponse — GET
// /api/option/waffo-pancake/subscription-product-options.
type WaffoPancakeProductOptionsResponse struct {
	StoreID  string                       `json:"store_id"`
	Products []WaffoPancakeCatalogProduct `json:"products"`
}

// WaffoPancakePairResponse — POST /api/option/waffo-pancake/pair.
type WaffoPancakePairResponse struct {
	StoreID     string `json:"store_id"`
	StoreName   string `json:"store_name"`
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
}

// WaffoPancakeSaveResponse — POST /api/option/waffo-pancake/save.
type WaffoPancakeSaveResponse struct {
	ProductID string `json:"product_id"`
	StoreID   string `json:"store_id"`
}

// WaffoPancakeSubscriptionProductResponse — POST
// /api/option/waffo-pancake/subscription-product.
type WaffoPancakeSubscriptionProductResponse struct {
	ProductID   string `json:"product_id"`
	ProductName string `json:"product_name"`
	StoreID     string `json:"store_id"`
}

// WaffoPancakeCheckoutResponse — POST /api/user/waffo-pancake/pay and
// POST /api/subscription/waffo-pancake/pay (gin.H remap of
// service.WaffoPancakeCheckoutSession).
type WaffoPancakeCheckoutResponse struct {
	CheckoutURL    string `json:"checkout_url"`
	SessionID      string `json:"session_id"`
	ExpiresAt      string `json:"expires_at"`
	OrderID        string `json:"order_id"`
	Token          string `json:"token"`
	TokenExpiresAt string `json:"token_expires_at"`
}

// FixAbilityResponse — POST /api/channel/fix (controller.FixChannelsAbilities).
type FixAbilityResponse struct {
	Success int `json:"success"`
	Fails   int `json:"fails"`
}

// OllamaVersionResponse — GET /api/channel/ollama/version/{id}.
type OllamaVersionResponse struct {
	Version string `json:"version"`
}

// MultiKeyStatus mirrors controller.KeyStatus (multi-key channel management).
type MultiKeyStatus struct {
	Index        int    `json:"index"`
	Status       int    `json:"status"`
	DisabledTime int64  `json:"disabled_time,omitempty"`
	Reason       string `json:"reason,omitempty"`
	KeyPreview   string `json:"key_preview"`
}

// MultiKeyStatusResponse mirrors controller.MultiKeyStatusResponse
// (POST /api/channel/multi_key/manage, action=get_key_status).
type MultiKeyStatusResponse struct {
	Keys                []MultiKeyStatus `json:"keys"`
	Total               int              `json:"total"`
	Page                int              `json:"page"`
	PageSize            int              `json:"page_size"`
	TotalPages          int              `json:"total_pages"`
	EnabledCount        int              `json:"enabled_count"`
	ManualDisabledCount int              `json:"manual_disabled_count"`
	AutoDisabledCount   int              `json:"auto_disabled_count"`
}

// ApplyChannelUpstreamModelUpdatesResponse — POST /api/channel/upstream_updates/apply.
type ApplyChannelUpstreamModelUpdatesResponse struct {
	Id                    int      `json:"id"`
	AddedModels           []string `json:"added_models"`
	RemovedModels         []string `json:"removed_models"`
	IgnoredModels         []string `json:"ignored_models"`
	RemainingModels       []string `json:"remaining_models"`
	RemainingRemoveModels []string `json:"remaining_remove_models"`
	Models                string   `json:"models"`
	Settings              string   `json:"settings"`
}

// ApplyAllChannelUpstreamModelUpdatesResult mirrors the per-channel entry of
// POST /api/channel/upstream_updates/apply_all.
type ApplyAllChannelUpstreamModelUpdatesResult struct {
	ChannelId             int      `json:"channel_id"`
	ChannelName           string   `json:"channel_name"`
	AddedModels           []string `json:"added_models"`
	RemovedModels         []string `json:"removed_models"`
	RemainingModels       []string `json:"remaining_models"`
	RemainingRemoveModels []string `json:"remaining_remove_models"`
}

// ApplyAllChannelUpstreamModelUpdatesResponse — POST /api/channel/upstream_updates/apply_all.
type ApplyAllChannelUpstreamModelUpdatesResponse struct {
	ProcessedChannels int                                         `json:"processed_channels"`
	AddedModels       int                                         `json:"added_models"`
	RemovedModels     int                                         `json:"removed_models"`
	FailedChannelIds  []int                                       `json:"failed_channel_ids"`
	Results           []ApplyAllChannelUpstreamModelUpdatesResult `json:"results"`
}

// DetectChannelUpstreamModelUpdatesResponse — POST /api/channel/upstream_updates/detect.
type DetectChannelUpstreamModelUpdatesResponse struct {
	ChannelId       int      `json:"channel_id"`
	ChannelName     string   `json:"channel_name"`
	AddModels       []string `json:"add_models"`
	RemoveModels    []string `json:"remove_models"`
	LastCheckTime   int64    `json:"last_check_time"`
	AutoAddedModels int      `json:"auto_added_models"`
}

// SystemTaskRefResponse — POST /api/channel/upstream_updates/detect_all
// (async task handle).
type SystemTaskRefResponse struct {
	TaskId string `json:"task_id"`
	Status string `json:"status"`
}

// CodexCredentialRefreshResponse — POST /api/channel/{id}/codex/refresh.
type CodexCredentialRefreshResponse struct {
	ExpiresAt   string `json:"expires_at"`
	LastRefresh string `json:"last_refresh"`
	AccountId   string `json:"account_id"`
	Email       string `json:"email"`
	ChannelId   int    `json:"channel_id"`
	ChannelType int    `json:"channel_type"`
	ChannelName string `json:"channel_name"`
}

// ModelValidationResult mirrors controller.ModelValidationResult
// (POST /api/channel/validate_models).
type ModelValidationResult struct {
	Model        string `json:"model"`
	OK           bool   `json:"ok"`
	Status       string `json:"status"`
	UpstreamCode int    `json:"upstream_code"`
	ErrorCode    string `json:"error_code"`
	Message      string `json:"message"`
	LatencyMs    int64  `json:"latency_ms"`
}

// ValidateModelsSummary mirrors controller.validateModelsSummary.
type ValidateModelsSummary struct {
	Alive     int `json:"alive"`
	Dead      int `json:"dead"`
	Uncertain int `json:"uncertain"`
}

// ValidateModelsResponse mirrors controller.ValidateModelsResponse.
type ValidateModelsResponse struct {
	Results []ModelValidationResult `json:"results"`
	Summary ValidateModelsSummary   `json:"summary"`
}

// UptimeMonitor mirrors controller.Monitor (GET /api/uptime/status).
type UptimeMonitor struct {
	Name   string  `json:"name"`
	Uptime float64 `json:"uptime"`
	Status int     `json:"status"`
	Group  string  `json:"group,omitempty"`
}

// UptimeGroupResult mirrors controller.UptimeGroupResult.
type UptimeGroupResult struct {
	CategoryName string          `json:"categoryName"`
	Monitors     []UptimeMonitor `json:"monitors"`
}

// TwoFAStatsResponse — GET /api/user/2fa/stats.
type TwoFAStatsResponse struct {
	TotalUsers   int64  `json:"total_users"`
	EnabledUsers int64  `json:"enabled_users"`
	EnabledRate  string `json:"enabled_rate"`
}

// TwoFAStatusResponse — GET /api/user/2fa/status.
type TwoFAStatusResponse struct {
	Enabled              bool `json:"enabled"`
	Locked               bool `json:"locked"`
	BackupCodesRemaining int  `json:"backup_codes_remaining,omitempty"`
}

// WaffoPayMethodOption mirrors constant.WaffoPayMethod for the top-up info payload.
type WaffoPayMethodOption struct {
	Name          string `json:"name"`
	Icon          string `json:"icon"`
	PayMethodType string `json:"payMethodType"`
	PayMethodName string `json:"payMethodName"`
}

// TopUpInfoResponse — GET /api/user/topup/info (controller.GetTopUpInfo).
type TopUpInfoResponse struct {
	EnableOnlineTopup             bool                   `json:"enable_online_topup"`
	EnableStripeTopup             bool                   `json:"enable_stripe_topup"`
	EnableCreemTopup              bool                   `json:"enable_creem_topup"`
	EnableWaffoTopup              bool                   `json:"enable_waffo_topup"`
	EnableWaffoPancakeTopup       bool                   `json:"enable_waffo_pancake_topup"`
	EnableRedemption              bool                   `json:"enable_redemption"`
	PaymentComplianceConfirmed    bool                   `json:"payment_compliance_confirmed"`
	PaymentComplianceTermsVersion string                 `json:"payment_compliance_terms_version"`
	WaffoPayMethods               []WaffoPayMethodOption `json:"waffo_pay_methods"`
	CreemProducts                 string                 `json:"creem_products"`
	PayMethods                    []map[string]string    `json:"pay_methods"`
	MinTopup                      int                    `json:"min_topup"`
	StripeMinTopup                int                    `json:"stripe_min_topup"`
	WaffoMinTopup                 int                    `json:"waffo_min_topup"`
	WaffoPancakeMinTopup          int                    `json:"waffo_pancake_min_topup"`
	AmountOptions                 []int                  `json:"amount_options"`
	Discount                      map[int]float64        `json:"discount"`
	TopupLink                     string                 `json:"topup_link"`
}
