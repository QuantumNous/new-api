package main

import (
	"fmt"
	"strconv"
	"strings"
)

// respSpec describes the typed payload of `data` inside the standard
// {success, message, data} wrapper.
//
// Exactly one of the discriminators should be set:
//   - Wrap: "ApiResponse" (default, untyped data)
//   - Type: <ModelName> + List/Paged flags
//   - Custom: explicit schema name from components.schemas (preserved/manual)
//   - Empty: data is null/absent → uses ApiResponse
//
// Type semantics:
//   - default: data = $ref ModelName (single object)
//   - List=true: data = []ModelName
//   - Paged=true: data = {page, page_size, total, items: []ModelName}
type respSpec struct {
	Wrap   string // override wrapper schema name; takes precedence
	Type   string // model type name (must exist in model/*.go) → ApiResponseOf<Type>
	List   bool   // []Type → ApiResponseListOf<Type>
	Paged  bool   // PageInfo<Type> → ApiResponsePagedOf<Type>
	Empty  bool   // data not used (null) — wraps with ApiResponse
	Custom string // direct $ref to components.schemas.<Custom>
	// Body: fallback for requestBody when AST analysis fails (anonymous struct
	// scoping issues, generated handlers, etc.). Set to a $ref schema name from
	// components.schemas. Only used when enrichFromHandlers leaves no body.
	Body string
}

// manifest maps path → method → response shape.
// Methods are lowercase ("get", "post", "put", "delete", "patch").
// Paths must match the existing api.json paths exactly (with {id} placeholders).
var manifest = map[string]map[string]respSpec{
	// === System ===
	"/api/about":             {"get": {Wrap: "ApiResponseOfString"}},
	"/api/notice":            {"get": {Wrap: "ApiResponseOfString"}},
	"/api/home_page_content": {"get": {Wrap: "ApiResponseOfString"}},
	"/api/user-agreement":    {"get": {Wrap: "ApiResponseOfString"}},
	"/api/privacy-policy":    {"get": {Wrap: "ApiResponseOfString"}},
	"/api/pricing":           {"get": {Custom: "PricingResponse"}},
	"/api/setup":             {"get": {Wrap: "ApiResponseOfObject"}, "post": {Empty: true}},
	"/api/status":            {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/status/test":       {"get": {Empty: true}},
	"/api/uptime/status":     {"get": {Type: "UptimeGroupResult", List: true}},
	"/api/ratio_config":      {"get": {Wrap: "ApiResponseOfRatioConfig"}},
	"/api/verification":      {"get": {Empty: true}},
	"/api/verify":            {"post": {Empty: true}},

	// === Auth & Login ===
	"/api/user/login":     {"post": {Type: "User"}},
	"/api/user/login/2fa": {"post": {Type: "User"}},
	"/api/user/logout":    {"get": {Empty: true}},
	"/api/user/register":  {"post": {Empty: true}},
	"/api/user/reset":     {"post": {Empty: true}},
	"/api/reset_password": {"get": {Empty: true}},

	// === OAuth ===
	// Real route is /api/oauth/{provider} (Gin path param). For better client
	// ergonomics we also expose explicit endpoints per known provider — Gin
	// matches both. Keeps backward compat with hand-maintained spec.
	"/api/oauth/state":          {"get": {Wrap: "ApiResponseOfString"}},
	"/api/oauth/email/bind":     {"post": {Empty: true}},
	"/api/oauth/wechat":         {"get": {Empty: true}},
	"/api/oauth/wechat/bind":    {"post": {Empty: true}},
	"/api/oauth/telegram/login": {"get": {Empty: true}},
	"/api/oauth/telegram/bind":  {"get": {Empty: true}},
	"/api/oauth/{provider}":     {"get": {Empty: true}},

	// === User management ===
	"/api/user/":            {"get": {Type: "User", Paged: true}, "post": {Type: "User"}, "put": {Type: "User"}},
	"/api/user/{id}":        {"get": {Type: "User"}, "delete": {Empty: true}},
	"/api/user/search":      {"get": {Type: "User", Paged: true}},
	"/api/user/manage":      {"post": {Type: "ManageUserResponse"}},
	"/api/user/group/batch": {"post": {Type: "BulkUpdateUserGroupResponse", Body: "BulkUpdateUserGroupRequest"}},

	// === Pricing admin ===
	"/api/option/pricing/models/{channel_type}": {"get": {Type: "ListProviderModelsResponse"}},
	"/api/option/pricing/adjust":                {"post": {Type: "AdjustModelPricingResponse", Body: "AdjustModelPricingRequest"}},
	"/api/user/self":                            {"get": {Type: "User"}},
	"/api/user/aff":                             {"get": {Wrap: "ApiResponseOfString"}},
	"/api/user/groups":                          {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/user/self/groups":                     {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/user/aff_transfer":                    {"post": {Empty: true}},
	"/api/user/amount":                          {"post": {Custom: "MessageEnvelopeOfString"}},
	"/api/user/setting":                         {"put": {Empty: true}},
	"/api/user/token":                           {"get": {Wrap: "ApiResponseOfString"}},
	"/api/user/models":                          {"get": {Wrap: "ApiResponseOfStringList"}},

	// === Passkey ===
	"/api/user/passkey":                 {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/user/passkey/login/begin":     {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/passkey/login/finish":    {"post": {Type: "User"}},
	"/api/user/passkey/register/begin":  {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/passkey/register/finish": {"post": {Empty: true}},
	"/api/user/passkey/verify/begin":    {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/passkey/verify/finish":   {"post": {Empty: true}},
	"/api/user/{id}/2fa":                {"delete": {Empty: true}},
	"/api/user/{id}/reset_passkey":      {"delete": {Empty: true}},

	// === 2FA ===
	"/api/user/2fa/setup":        {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/2fa/enable":       {"post": {Empty: true}},
	"/api/user/2fa/disable":      {"post": {Empty: true}},
	"/api/user/2fa/status":       {"get": {Type: "TwoFAStatusResponse"}},
	"/api/user/2fa/backup_codes": {"post": {Wrap: "ApiResponseOfStringList"}},
	"/api/user/2fa/stats":        {"get": {Type: "TwoFAStatsResponse"}},

	// === Topup / Payment ===
	"/api/user/epay/notify":    {"get": {Empty: true}, "post": {Empty: true}},
	"/api/user/topup":          {"post": {Empty: true}},
	"/api/user/topup/info":     {"get": {Type: "TopUpInfoResponse"}},
	"/api/user/topup/complete": {"post": {Empty: true}},
	"/api/user/topup/self":     {"get": {Type: "TopUp", Paged: true}},
	"/api/user/pay":            {"post": {Custom: "EpayCheckoutEnvelope"}},
	"/api/user/stripe/pay":     {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/creem/pay":      {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/stripe/amount":  {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/stripe/webhook":      {"post": {Empty: true}},
	"/api/creem/webhook":       {"post": {Empty: true}},

	// === Channel ===
	"/api/channel/":                    {"get": {Type: "Channel", Paged: true}, "post": {Empty: true}, "put": {Type: "Channel"}},
	"/api/channel/{id}":                {"get": {Type: "Channel"}, "delete": {Empty: true}},
	"/api/channel/{id}/key":            {"post": {Type: "ChannelKeyResponse"}},
	"/api/channel/search":              {"get": {Type: "SearchChannelsResponse"}},
	"/api/channel/test":                {"get": {Type: "ChannelTestResponse"}},
	"/api/channel/test/{id}":           {"get": {Type: "ChannelTestResponse"}},
	"/api/channel/update_balance":      {"get": {Empty: true}},
	"/api/channel/update_balance/{id}": {"get": {Custom: "ChannelBalanceEnvelope"}},
	"/api/channel/disabled":            {"delete": {Empty: true}},
	"/api/channel/fix":                 {"post": {Type: "FixAbilityResponse"}},
	"/api/channel/copy/{id}":           {"post": {Empty: true}},
	"/api/channel/batch":               {"post": {Wrap: "ApiResponseOfInt"}},
	"/api/channel/batch/tag":           {"post": {Empty: true}},
	"/api/channel/multi_key/manage":    {"post": {Custom: "ApiResponseOfMultiKeyManageResult"}},
	"/api/channel/tag":                 {"put": {Empty: true}},
	"/api/channel/tag/disabled":        {"post": {Empty: true}},
	"/api/channel/tag/enabled":         {"post": {Empty: true}},
	"/api/channel/tag/models":          {"get": {Wrap: "ApiResponseOfString"}},
	"/api/channel/models":              {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/channel/models_enabled":      {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/channel/fetch_models":        {"post": {Wrap: "ApiResponseOfStringList", Body: "FetchModelsRequest"}},
	"/api/channel/fetch_models/{id}":   {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/channel/validate_models":     {"post": {Type: "ValidateModelsResponse"}},

	// === Token ===
	"/api/token/":       {"get": {Type: "Token", Paged: true}, "post": {Type: "Token"}, "put": {Type: "Token"}},
	"/api/token/{id}":   {"get": {Type: "Token"}, "delete": {Empty: true}},
	"/api/token/search": {"get": {Type: "Token", Paged: true}},
	"/api/token/batch":  {"post": {Wrap: "ApiResponseOfObject"}},

	// === Logs ===
	"/api/log/":            {"get": {Type: "Log", Paged: true}},
	"/api/log/search":      {"get": {Type: "Log", Paged: true}},
	"/api/log/self":        {"get": {Type: "Log", Paged: true}},
	"/api/log/self/search": {"get": {Type: "Log", Paged: true}},
	"/api/log/self/stat":   {"get": {Type: "Stat"}},
	"/api/log/stat":        {"get": {Type: "Stat"}},
	"/api/log/token":       {"get": {Type: "Log", Paged: true}},

	// === Redemption ===
	"/api/redemption/":        {"get": {Type: "Redemption", Paged: true}, "post": {Empty: true}, "put": {Empty: true}},
	"/api/redemption/{id}":    {"get": {Type: "Redemption"}, "delete": {Empty: true}},
	"/api/redemption/search":  {"get": {Type: "Redemption", Paged: true}},
	"/api/redemption/invalid": {"delete": {Empty: true}},

	// === Models ===
	"/api/models":                       {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/models/":                      {"get": {Type: "ListModelsMetaResponse"}, "post": {Type: "Model"}, "put": {Type: "Model"}},
	"/api/models/{id}":                  {"get": {Type: "Model"}, "delete": {Empty: true}},
	"/api/models/missing":               {"get": {Wrap: "ApiResponseOfStringList"}},
	"/api/models/search":                {"get": {Type: "Model", Paged: true}},
	"/api/models/sync_upstream":         {"post": {Type: "SyncUpstreamModelsResponse"}},
	"/api/models/sync_upstream/preview": {"get": {Type: "SyncUpstreamPreviewResponse"}},

	// === Vendors ===
	"/api/vendors/":       {"get": {Type: "Vendor", Paged: true}, "post": {Type: "Vendor"}, "put": {Type: "Vendor"}},
	"/api/vendors/{id}":   {"get": {Type: "Vendor"}, "delete": {Empty: true}},
	"/api/vendors/search": {"get": {Type: "Vendor", Paged: true}},

	// === Prefill groups ===
	"/api/prefill_group/":     {"get": {Type: "PrefillGroup", Paged: true}, "post": {Empty: true}, "put": {Empty: true}},
	"/api/prefill_group/{id}": {"delete": {Empty: true}},

	// === Tasks (Mj/Suno) ===
	"/api/task/":     {"get": {Type: "Task", Paged: true}},
	"/api/task/self": {"get": {Type: "Task", Paged: true}},
	"/api/mj/":       {"get": {Type: "Midjourney", Paged: true}},
	"/api/mj/self":   {"get": {Type: "Midjourney", Paged: true}},

	// === Data stats ===
	"/api/data/":      {"get": {Wrap: "ApiResponseListOfQuotaDataRow"}},
	"/api/data/self":  {"get": {Wrap: "ApiResponseListOfQuotaDataRow"}},
	"/api/data/users": {"get": {Wrap: "ApiResponseListOfQuotaDataRow"}},

	// === Group ===
	"/api/group/": {"get": {Wrap: "ApiResponseOfStringList"}},

	// === Option ===
	"/api/option/":                        {"get": {Type: "Option", List: true}, "put": {Empty: true}},
	"/api/option/migrate_console_setting": {"post": {Empty: true}},
	"/api/option/rest_model_ratio":        {"post": {Empty: true}},

	// === Ratio sync ===
	"/api/ratio_sync/channels": {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/ratio_sync/fetch":    {"post": {Wrap: "ApiResponseOfObject"}},

	// === Usage ===
	"/api/usage/token/": {"get": {Wrap: "ApiResponseOfObject"}},

	// === Subscription (user-facing) ===
	"/api/subscription/plans":           {"get": {Type: "SubscriptionPlan", List: true}},
	"/api/subscription/self":            {"get": {Type: "UserSubscription"}},
	"/api/subscription/self/preference": {"put": {Empty: true}},
	"/api/subscription/epay/pay":        {"post": {Custom: "EpayCheckoutEnvelope"}},
	"/api/subscription/stripe/pay":      {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/subscription/creem/pay":       {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/subscription/epay/notify":     {"get": {Empty: true}, "post": {Empty: true}},
	"/api/subscription/epay/return":     {"get": {Empty: true}, "post": {Empty: true}},

	// === Subscription admin ===
	"/api/subscription/admin/plans":                              {"get": {Type: "SubscriptionPlan", List: true}, "post": {Empty: true}},
	"/api/subscription/admin/plans/{id}":                         {"put": {Empty: true}, "patch": {Empty: true}},
	"/api/subscription/admin/bind":                               {"post": {Empty: true}},
	"/api/subscription/admin/users/{id}/subscriptions":           {"get": {Type: "UserSubscription", List: true}, "post": {Empty: true}},
	"/api/subscription/admin/user_subscriptions/{id}/invalidate": {"post": {Empty: true}},
	"/api/subscription/admin/user_subscriptions/{id}":            {"delete": {Empty: true}},

	// === Custom OAuth providers ===
	"/api/custom-oauth-provider/":          {"get": {Type: "CustomOAuthProvider", List: true}, "post": {Empty: true}},
	"/api/custom-oauth-provider/{id}":      {"get": {Type: "CustomOAuthProvider"}, "put": {Empty: true}, "delete": {Empty: true}},
	"/api/custom-oauth-provider/discovery": {"post": {Wrap: "ApiResponseOfObject"}},

	// === Performance ===
	"/api/performance/stats":       {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/performance/disk_cache":  {"delete": {Empty: true}},
	"/api/performance/reset_stats": {"post": {Empty: true}},
	"/api/performance/gc":          {"post": {Empty: true}},
	"/api/performance/logs":        {"get": {Wrap: "ApiResponseOfObject"}, "delete": {Empty: true}},
	"/api/perf-metrics/summary":    {"get": {Custom: "SuccessEnvelopeOfPerfMetricsSummary"}},
	"/api/rankings":                {"get": {Wrap: "ApiResponseOfObject"}},

	// === Channel — codex / ollama / upstream-updates ===
	"/api/channel/{id}/codex/refresh": {"post": {Type: "CodexCredentialRefreshResponse"}},

	// === Upstream v1.0.0-rc.11..rc.21 additions ===
	"/api/authz/catalog":                                     {"get": {Type: "AuthzCatalogResponse"}},
	"/api/channel/ops":                                       {"get": {Type: "ChannelOpsResponse"}},
	"/api/channel/status/batch":                              {"post": {Wrap: "ApiResponseOfInt"}},
	"/api/channel/{id}/status":                               {"post": {Wrap: "ApiResponseOfBool"}},
	"/api/channel/{id}/codex/usage/reset-credits":            {"get": {Custom: "CodexUpstreamProxyResponse"}},
	"/api/channel/{id}/codex/usage/reset":                    {"post": {Custom: "CodexUpstreamProxyResponse"}},
	"/api/data/flow":                                         {"get": {Type: "FlowQuotaData", List: true}},
	"/api/data/flow/self":                                    {"get": {Type: "FlowQuotaData", List: true}},
	"/api/system-info/instances":                             {"get": {Type: "SystemInstanceResponse", List: true}},
	"/api/system-info/instances/{node_name}":                 {"delete": {Type: "DeletedCountResponse"}},
	"/api/system-info/stale-instances":                       {"delete": {Type: "DeletedCountResponse"}},
	"/api/system-task/current":                               {"get": {Type: "SystemTaskResponse"}},
	"/api/system-task/list":                                  {"get": {Type: "SystemTaskResponse", List: true}},
	"/api/system-task/{task_id}":                             {"get": {Type: "SystemTaskResponse"}},
	"/api/system-task/log-cleanup":                           {"post": {Type: "SystemTaskResponse"}},
	"/api/option/payment_compliance":                         {"post": {Type: "PaymentComplianceResponse"}},
	"/api/option/waffo-pancake/catalog":                      {"get": {Custom: "WaffoEnvelopeOfCatalog"}},
	"/api/option/waffo-pancake/subscription-product-options": {"get": {Custom: "WaffoEnvelopeOfProductOptions"}},
	"/api/option/waffo-pancake/pair":                         {"post": {Custom: "WaffoEnvelopeOfPair"}},
	"/api/option/waffo-pancake/save":                         {"post": {Custom: "WaffoEnvelopeOfSave"}},
	"/api/option/waffo-pancake/subscription-product":         {"post": {Custom: "WaffoEnvelopeOfSubscriptionProduct"}},
	"/api/subscription/admin/plans/{id}/subscriptions/reset": {"post": {Type: "SubscriptionResetResult"}},
	"/api/subscription/admin/users/{id}/subscriptions/reset": {"post": {Type: "SubscriptionResetResult"}},
	"/api/subscription/balance/pay":                          {"post": {Empty: true}},
	"/api/subscription/waffo-pancake/pay":                    {"post": {Custom: "WaffoEnvelopeOfCheckout"}},
	"/api/user/waffo-pancake/amount":                         {"post": {Custom: "MessageEnvelopeOfString"}},
	"/api/user/waffo-pancake/pay":                            {"post": {Custom: "WaffoEnvelopeOfCheckout"}},
	"/api/waffo-pancake/webhook/{env}":                       {"post": {Empty: true}},
	"/api/channel/{id}/codex/usage":                          {"get": {Custom: "CodexUpstreamProxyResponse"}},
	"/api/channel/ollama/pull":                               {"post": {Empty: true}},
	"/api/channel/ollama/pull/stream":                        {"post": {Empty: true}}, // SSE stream, not a JSON envelope
	"/api/channel/ollama/delete":                             {"delete": {Empty: true}},
	"/api/channel/ollama/version/{id}":                       {"get": {Type: "OllamaVersionResponse"}},
	"/api/channel/upstream_updates/apply":                    {"post": {Type: "ApplyChannelUpstreamModelUpdatesResponse"}},
	"/api/channel/upstream_updates/apply_all":                {"post": {Type: "ApplyAllChannelUpstreamModelUpdatesResponse"}},
	"/api/channel/upstream_updates/detect":                   {"post": {Type: "DetectChannelUpstreamModelUpdatesResponse"}},
	"/api/channel/upstream_updates/detect_all":               {"post": {Type: "SystemTaskRefResponse"}},

	// === Deployments (ionet) ===
	"/api/deployments/":                               {"get": {Type: "DeploymentListResponse"}, "post": {Type: "DeploymentCreateResponse"}},
	"/api/deployments/search":                         {"get": {Type: "DeploymentSearchResponse"}},
	"/api/deployments/settings":                       {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/deployments/settings/test-connection":       {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/deployments/test-connection":                {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/deployments/hardware-types":                 {"get": {Type: "DeploymentHardwareTypesResponse"}},
	"/api/deployments/locations":                      {"get": {Type: "DeploymentLocationsResponse"}},
	"/api/deployments/available-replicas":             {"get": {Type: "AvailableReplicasResponse"}},
	"/api/deployments/check-name":                     {"get": {Type: "ClusterNameAvailabilityResponse"}},
	"/api/deployments/price-estimation":               {"post": {Type: "PriceEstimationResponse"}},
	"/api/deployments/{id}":                           {"get": {Type: "DeploymentDetailResponse"}, "put": {Empty: true}, "delete": {Empty: true}},
	"/api/deployments/{id}/name":                      {"put": {Empty: true}},
	"/api/deployments/{id}/extend":                    {"post": {Type: "DeploymentSummary"}},
	"/api/deployments/{id}/logs":                      {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/deployments/{id}/containers":                {"get": {Type: "DeploymentContainersResponse"}},
	"/api/deployments/{id}/containers/{container_id}": {"get": {Type: "ContainerDetailsResponse"}},

	// === Misc admin ===
	"/api/option/channel_affinity_cache":          {"get": {Wrap: "ApiResponseOfObject"}, "delete": {Empty: true}},
	"/api/log/channel_affinity_usage_cache":       {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/user/checkin":                           {"get": {Wrap: "ApiResponseOfObject"}, "post": {Wrap: "ApiResponseOfObject"}},
	"/api/user/oauth/bindings":                    {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/user/oauth/bindings/{provider_id}":      {"delete": {Empty: true}},
	"/api/user/{id}/oauth/bindings":               {"get": {Wrap: "ApiResponseOfObject"}},
	"/api/user/{id}/oauth/bindings/{provider_id}": {"delete": {Empty: true}},
	"/api/user/{id}/bindings/{binding_type}":      {"delete": {Empty: true}},
	"/api/user/waffo/amount":                      {"post": {Custom: "MessageEnvelopeOfString"}},
	"/api/user/waffo/pay":                         {"post": {Wrap: "ApiResponseOfObject"}},
	"/api/waffo/webhook":                          {"post": {Empty: true}},
	"/api/token/{id}/key":                         {"post": {Type: "TokenKeyResponse"}},
	"/api/token/batch/keys":                       {"post": {Wrap: "ApiResponseOfStringList"}},
}

// applyManifest sets responses["200"] for every (path, method) listed in the manifest,
// and leaves all other operation fields (summary, description, tags, parameters,
// requestBody, security) intact. Creates path/operation entries when missing.
//
// When respSpec.Body is set, registers the requestBody $ref as a manifest-driven
// fallback (consumed after enrichFromHandlers when AST analysis didn't yield
// a body schema for that operation).
func applyManifest(paths map[string]interface{}) {
	for path, methodMap := range manifest {
		pathObj, _ := paths[path].(map[string]interface{})
		if pathObj == nil {
			pathObj = map[string]interface{}{}
			paths[path] = pathObj
		}
		for method, resp := range methodMap {
			op, _ := pathObj[method].(map[string]interface{})
			if op == nil {
				op = newOperation(path, method)
				pathObj[method] = op
			}
			op["responses"] = buildResponse(resp)
			if resp.Body != "" {
				referencedTypes[resp.Body] = true
			}
		}
	}
}

// applyManifestBodies sets requestBody from respSpec.Body for any operation
// whose body is missing or still a known placeholder. Runs AFTER enrichFromHandlers,
// so handler-derived bodies always win over manifest fallback.
func applyManifestBodies(paths map[string]interface{}) {
	for path, methodMap := range manifest {
		pathObj, _ := paths[path].(map[string]interface{})
		if pathObj == nil {
			continue
		}
		for method, resp := range methodMap {
			if resp.Body == "" {
				continue
			}
			op, _ := pathObj[method].(map[string]interface{})
			if op == nil {
				continue
			}
			if !needsBodyOverride(op) {
				continue
			}
			op["requestBody"] = bodyRefSchema(resp.Body)
		}
	}
}

// needsBodyOverride returns true when the operation has no requestBody, or has
// a body that matches a known placeholder pattern from the legacy spec template.
func needsBodyOverride(op map[string]interface{}) bool {
	body, _ := op["requestBody"].(map[string]interface{})
	if body == nil {
		return true
	}
	content, _ := body["content"].(map[string]interface{})
	if content == nil {
		return true
	}
	js, _ := content["application/json"].(map[string]interface{})
	if js == nil {
		return true
	}
	schema, _ := js["schema"].(map[string]interface{})
	if schema == nil {
		return true
	}
	if _, hasRef := schema["$ref"]; hasRef {
		return false
	}
	return isPlaceholderSchema(schema)
}

// isPlaceholderSchema detects body shapes that the legacy spec template emits
// when no real schema is known. Currently catches:
//   - {data: [{id: string}]} — list-of-id placeholder
//   - {data: {}} — empty object wrapper
//   - {} — empty schema
func isPlaceholderSchema(schema map[string]interface{}) bool {
	props, _ := schema["properties"].(map[string]interface{})
	if len(props) == 0 {
		return true
	}
	if len(props) != 1 {
		return false
	}
	dataProp, ok := props["data"].(map[string]interface{})
	if !ok {
		return false
	}
	switch dataProp["type"] {
	case "array":
		items, _ := dataProp["items"].(map[string]interface{})
		if items == nil {
			return true
		}
		ip, _ := items["properties"].(map[string]interface{})
		if len(ip) == 0 {
			return true
		}
		if len(ip) == 1 {
			if id, ok := ip["id"].(map[string]interface{}); ok {
				if id["type"] == "string" {
					return true
				}
			}
		}
	case "object":
		dp, _ := dataProp["properties"].(map[string]interface{})
		if len(dp) == 0 {
			return true
		}
	}
	return false
}

// newOperation builds a stub operation for a route that's in code+manifest but
// missing from the existing spec. Caller fills responses afterwards.
func newOperation(path, method string) map[string]interface{} {
	tag := guessTag(path)
	return map[string]interface{}{
		"summary":     method + " " + path,
		"description": "Auto-generated entry. Add a manual summary/description in api.json.",
		"deprecated":  false,
		"tags":        []interface{}{tag},
		"parameters":  buildPathParams(path),
		"security":    defaultSecurity(),
	}
}

func defaultSecurity() []interface{} {
	return []interface{}{
		map[string]interface{}{"Combination343": []interface{}{}},
		map[string]interface{}{"Combination1243": []interface{}{}},
	}
}

func buildPathParams(path string) []interface{} {
	out := []interface{}{}
	// Match {name}-style placeholders.
	for _, seg := range splitPath(path) {
		if len(seg) >= 2 && seg[0] == '{' && seg[len(seg)-1] == '}' {
			name := seg[1 : len(seg)-1]
			schema := map[string]interface{}{"type": "string"}
			if name == "id" {
				schema = map[string]interface{}{"type": "integer"}
			}
			out = append(out, map[string]interface{}{
				"name":        name,
				"in":          "path",
				"description": "",
				"required":    true,
				"schema":      schema,
			})
		}
	}
	return out
}

func splitPath(path string) []string {
	parts := []string{}
	cur := ""
	for _, r := range path {
		if r == '/' {
			if cur != "" {
				parts = append(parts, cur)
			}
			cur = ""
		} else {
			cur += string(r)
		}
	}
	if cur != "" {
		parts = append(parts, cur)
	}
	return parts
}

// currentLocale is set by the generator's locale loop before each spec build.
// Functions that emit user-visible strings (descriptions, tags, summaries)
// read this to pick the right translation. Defaults to "en" for safety when
// the generator is invoked single-shot without setting it.
var currentLocale = "en"

// tagKeyFor maps a URL path to a translation key (`tag.xxx`). The actual
// localized label is resolved by translate(currentLocale, key) at the call
// site. Keeps mapping logic in one place; locale-agnostic.
func tagKeyFor(path string) string {
	switch {
	case startsWith(path, "/api/subscription/admin"):
		return "tag.subscription_admin"
	case startsWith(path, "/api/subscription"):
		return "tag.subscription"
	case startsWith(path, "/api/custom-oauth-provider"), startsWith(path, "/api/oauth"):
		return "tag.oauth"
	case startsWith(path, "/api/performance"), startsWith(path, "/api/perf-metrics"), startsWith(path, "/api/rankings"):
		return "tag.performance"
	case startsWith(path, "/api/deployments"):
		return "tag.deployment"
	case startsWith(path, "/api/channel"):
		return "tag.channel"
	case startsWith(path, "/api/user"):
		return "tag.user"
	case startsWith(path, "/api/token"):
		return "tag.token"
	case startsWith(path, "/api/log"):
		return "tag.log"
	case startsWith(path, "/api/data"):
		return "tag.data"
	case startsWith(path, "/api/option"):
		return "tag.system"
	case startsWith(path, "/api/waffo"):
		return "tag.topup"
	}
	return "tag.uncategorized"
}

// guessTag returns the localized tag label for the given path.
func guessTag(path string) string {
	return translate(currentLocale, tagKeyFor(path))
}

func startsWith(s, prefix string) bool {
	return len(s) >= len(prefix) && s[:len(prefix)] == prefix
}

// removeFakePaths deletes path/method entries from the spec that don't exist in
// the actual router. Listed manually because we don't parse Go AST for routes
// in this generator (relying on the audit script to produce the list).
func removeFakePaths(paths map[string]interface{}) {
	fakes := map[string][]string{
		// Spec had GET; real handler only POST.
		"/api/oauth/email/bind":  {"get"},
		"/api/oauth/wechat/bind": {"get"},
		// Phantom path — no router declaration.
		"/api/verify/status": {"get"},
		// Method mismatches: spec used wrong HTTP verb. Real verbs are in manifest.
		"/api/channel/batch":                {"delete"}, // real: POST
		"/api/channel/batch/tag":            {"put"},    // real: POST
		"/api/channel/disabled":             {"get"},    // real: DELETE
		"/api/channel/tag/disabled":         {"put"},    // real: POST
		"/api/channel/tag/enabled":          {"put"},    // real: POST
		"/api/channel/tag/models":           {"put"},    // real: GET
		"/api/token/batch":                  {"delete"}, // real: POST
		"/api/redemption/invalid":           {"get"},    // real: DELETE
		"/api/models/sync_upstream/preview": {"post"},   // real: GET
		"/api/user/{id}/reset_passkey":      {"post"},   // real: DELETE
		"/api/models/{id}":                  {"put"},    // real: PUT on /api/models/ (not by id)
	}
	for path, methods := range fakes {
		pathObj, _ := paths[path].(map[string]interface{})
		if pathObj == nil {
			continue
		}
		for _, m := range methods {
			delete(pathObj, m)
		}
		// Drop path entry if empty after removals.
		hasOps := false
		for k := range pathObj {
			if isHTTPMethod(k) {
				hasOps = true
				break
			}
		}
		if !hasOps {
			delete(paths, path)
		}
	}
}

// defaultUntypedResponses fills in a generic ApiResponse wrapper for any operation
// whose responses["200"] still lacks `content` (i.e. wasn't covered by the manifest).
// Also injects standard error responses (4xx / 5xx) referencing ApiErrorResponse
// so SDK consumers get a typed error envelope for every endpoint.
func defaultUntypedResponses(paths map[string]interface{}) {
	for _, pathObj := range paths {
		pathMap, _ := pathObj.(map[string]interface{})
		for method, op := range pathMap {
			// Skip non-method keys (e.g. "parameters")
			if !isHTTPMethod(method) {
				continue
			}
			opMap, _ := op.(map[string]interface{})
			if opMap == nil {
				continue
			}
			responses, _ := opMap["responses"].(map[string]interface{})
			if responses == nil {
				opMap["responses"] = buildResponse(respSpec{Wrap: "ApiResponse"})
				responses = opMap["responses"].(map[string]interface{})
			} else {
				r200, _ := responses["200"].(map[string]interface{})
				if r200 == nil {
					opMap["responses"] = buildResponse(respSpec{Wrap: "ApiResponse"})
					responses = opMap["responses"].(map[string]interface{})
				} else if _, has := r200["content"]; !has {
					opMap["responses"] = buildResponse(respSpec{Wrap: "ApiResponse"})
					responses = opMap["responses"].(map[string]interface{})
				}
			}
			injectErrorResponses(responses)
		}
	}
}

// standardErrorCodeList — HTTP statuses for which every operation gets a
// default ApiErrorResponse response (localized via err.<code> keys).
var standardErrorCodeList = []string{"400", "401", "403", "404", "409", "422", "500", "502"}

// injectErrorResponses adds standard ApiErrorResponse-typed entries for HTTP
// 400/401/403/404/409/422/500/502 unless the operation already declares them.
// Each description is localized via translate(currentLocale, "err.<code>").
// This ensures every endpoint surfaces a typed error envelope to SDK clients.
func injectErrorResponses(responses map[string]interface{}) {
	referencedTypes["ApiErrorResponse"] = true
	for _, code := range standardErrorCodeList {
		if _, exists := responses[code]; exists {
			continue
		}
		responses[code] = map[string]interface{}{
			"description": translate(currentLocale, "err."+code),
			"content": map[string]interface{}{
				"application/json": map[string]interface{}{
					"schema": map[string]interface{}{
						"$ref": "#/components/schemas/ApiErrorResponse",
					},
				},
			},
		}
	}
}

func isHTTPMethod(s string) bool {
	switch s {
	case "get", "post", "put", "delete", "patch", "head", "options":
		return true
	}
	return false
}

// enrichFromHandlers walks parsed routes + controller analysis and fills
// missing requestBody / parameters / response data on each operation.
//
// Rules:
//   - Existing requestBody/parameters/responses from the spec are NOT overwritten
//     (hand-curated content wins).
//   - For routes the manifest has explicit response for, response stays.
//   - For other routes: if controller has ApiSuccess(c, X) where X is a known
//     model type, upgrade ApiResponse → ApiResponseOf<X>.
//   - Add typed requestBody when controller calls ShouldBindJSON(&model.X{}).
//   - Add query parameters from c.Query("name") and common.GetPageQuery(c).
//
// clearPlaceholderBodies wipes requestBody on POST/PUT/PATCH operations whose
// schema matches a known placeholder template. Runs BEFORE enrichFromHandlers
// so the handler-derived schema unconditionally replaces stale placeholders
// (legacy spec templates persist across regenerations otherwise).
func clearPlaceholderBodies(paths map[string]interface{}) {
	cleared := 0
	for _, methods := range paths {
		methodMap, _ := methods.(map[string]interface{})
		if methodMap == nil {
			continue
		}
		for method, opAny := range methodMap {
			if method != "post" && method != "put" && method != "patch" {
				continue
			}
			op, _ := opAny.(map[string]interface{})
			if op == nil {
				continue
			}
			body, _ := op["requestBody"].(map[string]interface{})
			if body == nil {
				continue
			}
			content, _ := body["content"].(map[string]interface{})
			if content == nil {
				continue
			}
			js, _ := content["application/json"].(map[string]interface{})
			if js == nil {
				continue
			}
			schema, _ := js["schema"].(map[string]interface{})
			if schema == nil {
				continue
			}
			if _, hasRef := schema["$ref"]; hasRef {
				continue
			}
			if isPlaceholderSchema(schema) {
				delete(op, "requestBody")
				cleared++
			}
		}
	}
	if cleared > 0 {
		fmt.Printf("    cleared:    %d placeholder body(ies)\n", cleared)
	}
}

func enrichFromHandlers(paths map[string]interface{}) {
	for _, route := range routes {
		if route.HandlerName == "" {
			continue
		}
		h, ok := handlers[route.HandlerName]
		if !ok {
			continue
		}
		pathObj, _ := paths[route.Path].(map[string]interface{})
		if pathObj == nil {
			continue
		}
		method := strings.ToLower(route.Method)
		op, _ := pathObj[method].(map[string]interface{})
		if op == nil {
			continue
		}

		// --- requestBody: handler analysis is authoritative ---
		if method == "post" || method == "put" || method == "patch" {
			switch {
			case h.BodyType != "":
				referencedTypes[h.BodyType] = true
				op["requestBody"] = bodyRefSchema(h.BodyType)
			case h.BodySchema != nil:
				op["requestBody"] = inlineBodySchema(h.BodySchema)
			}
		}

		// --- query parameters: merge handler-derived params with existing,
		// upgrading types where AST analysis is more accurate than the legacy
		// spec (e.g. *_timestamp should be integer, not string). Path params
		// in `existing` are preserved untouched.
		if len(h.QueryParams) > 0 {
			existing, _ := op["parameters"].([]interface{})
			handlerByName := map[string]QueryParam{}
			for _, qp := range h.QueryParams {
				handlerByName[qp.Name] = qp
			}
			merged := []interface{}{}
			seen := map[string]bool{}
			for _, p := range existing {
				pm, _ := p.(map[string]interface{})
				if pm == nil {
					merged = append(merged, p)
					continue
				}
				name, _ := pm["name"].(string)
				in, _ := pm["in"].(string)
				if in == "query" {
					if qp, ok := handlerByName[name]; ok {
						pm["schema"] = map[string]interface{}{"type": qp.Type}
						seen[name] = true
					}
				}
				merged = append(merged, pm)
			}
			for _, qp := range h.QueryParams {
				if seen[qp.Name] {
					continue
				}
				merged = append(merged, map[string]interface{}{
					"name":        qp.Name,
					"in":          "query",
					"required":    false,
					"description": "",
					"schema":      map[string]interface{}{"type": qp.Type},
				})
			}
			op["parameters"] = merged
		}

		// --- response: prefer inline schema when handler returns a custom envelope.
		// Only replace if the current response is the generic untyped wrapper —
		// preserves manifest overrides like Custom or specific ApiResponseOf<X>.
		if h.RespSchema != nil && isGenericResponse(op) {
			setInlineResponse(op, h.RespSchema)
		} else if h.RespType != "" || h.RespIsPaged {
			upgradeResponse(op, h)
		}

		// --- summary: replace auto "post /api/x" placeholder with godoc /
		// translation. Only overwrite when the existing summary still has the
		// placeholder shape (preserves any manually-curated summaries).
		if curSummary, _ := op["summary"].(string); isAutoSummary(curSummary, route.Method, route.Path) {
			if s := translateSummaryWithFallback(currentLocale, h.Name, handlerSummaries[h.Name]); s != "" {
				op["summary"] = s
			}
		}
	}
}

// isAutoSummary returns true when the operation's summary matches the
// auto-generated "<method> <path>" placeholder from newOperation. Used to
// avoid overwriting hand-curated summaries.
func isAutoSummary(summary, method, path string) bool {
	if summary == "" {
		return true
	}
	expected := strings.ToLower(method) + " " + path
	return summary == expected
}

// enrichErrorResponses walks routes and augments each operation's response
// map with handler-specific error catalog data. For every (HTTP status, code)
// pair extracted from the handler body by analyzeErrorCall, we:
//   - Add the code to `responses[status]["x-error-codes"]` (vendor extension —
//     machine-readable list of every error code that path may emit at that status).
//   - Add an entry to `responses[status]["content"]["application/json"]["examples"]`
//     with the literal envelope shape `{success:false, code, message}` — Swagger
//     UI renders these inline as labeled examples per code.
//
// Runs AFTER enrichFromHandlers (so response schemas exist) and AFTER
// defaultUntypedResponses (so generic 4xx/5xx slots are present).
func enrichErrorResponses(paths map[string]interface{}) {
	for _, route := range routes {
		if route.HandlerName == "" {
			continue
		}
		h, ok := handlers[route.HandlerName]
		if !ok || len(h.ErrorCodes) == 0 {
			continue
		}
		pathObj, _ := paths[route.Path].(map[string]interface{})
		if pathObj == nil {
			continue
		}
		op, _ := pathObj[strings.ToLower(route.Method)].(map[string]interface{})
		if op == nil {
			continue
		}
		responses, _ := op["responses"].(map[string]interface{})
		if responses == nil {
			continue
		}

		byStatus := map[int][]string{}
		for _, ec := range h.ErrorCodes {
			byStatus[ec.Status] = append(byStatus[ec.Status], ec.Code)
		}
		for status, codes := range byStatus {
			sCode := strconv.Itoa(status)
			resp, _ := responses[sCode].(map[string]interface{})
			if resp == nil {
				continue // status not in default catalog (e.g. 201) — handled by setup, skip
			}
			resp["x-error-codes"] = stringsToInterfaces(codes)

			content, _ := resp["content"].(map[string]interface{})
			if content == nil {
				continue
			}
			appJSON, _ := content["application/json"].(map[string]interface{})
			if appJSON == nil {
				continue
			}
			examples := map[string]interface{}{}
			for _, code := range codes {
				examples[code] = map[string]interface{}{
					"summary": code,
					"value": map[string]interface{}{
						"success": false,
						"code":    code,
						"message": "<localized message>",
					},
				}
			}
			appJSON["examples"] = examples
		}
	}
}

// stringsToInterfaces is a tiny helper because Go's JSON encoder needs
// []interface{} for heterogeneous slices but our codes are []string.
func stringsToInterfaces(in []string) []interface{} {
	out := make([]interface{}, len(in))
	for i, s := range in {
		out[i] = s
	}
	return out
}

// isGenericResponse returns true when responses["200"] points at the bare
// ApiResponse or ApiResponseOfObject — i.e. there's no real type info to lose.
func isGenericResponse(op map[string]interface{}) bool {
	r, _ := op["responses"].(map[string]interface{})
	if r == nil {
		return true
	}
	r200, _ := r["200"].(map[string]interface{})
	if r200 == nil {
		return true
	}
	c, _ := r200["content"].(map[string]interface{})
	if c == nil {
		return true
	}
	js, _ := c["application/json"].(map[string]interface{})
	if js == nil {
		return true
	}
	sch, _ := js["schema"].(map[string]interface{})
	if sch == nil {
		return true
	}
	ref, _ := sch["$ref"].(string)
	return ref == "#/components/schemas/ApiResponse" ||
		ref == "#/components/schemas/ApiResponseOfObject"
}

// setInlineResponse replaces responses["200"] schema with an inline object
// when the controller returns a custom gin.H{...} envelope.
func setInlineResponse(op map[string]interface{}, schema map[string]interface{}) {
	op["responses"] = map[string]interface{}{
		"200": map[string]interface{}{
			"description": translate(currentLocale, "resp.success"),
			"headers":     map[string]interface{}{},
			"content": map[string]interface{}{
				"application/json": map[string]interface{}{
					"schema": schema,
				},
			},
		},
	}
}

func inlineBodySchema(schema map[string]interface{}) map[string]interface{} {
	return map[string]interface{}{
		"content": map[string]interface{}{
			"application/json": map[string]interface{}{
				"schema": schema,
			},
		},
	}
}

func paramNames(params []interface{}) map[string]bool {
	out := map[string]bool{}
	for _, p := range params {
		pm, _ := p.(map[string]interface{})
		if pm == nil {
			continue
		}
		if name, ok := pm["name"].(string); ok {
			out[name] = true
		}
	}
	return out
}

func bodyRefSchema(typeName string) map[string]interface{} {
	return map[string]interface{}{
		"content": map[string]interface{}{
			"application/json": map[string]interface{}{
				"schema": map[string]interface{}{
					"$ref": "#/components/schemas/" + typeName,
				},
			},
		},
	}
}

// upgradeResponse replaces an `ApiResponse` (untyped) reference with a more
// specific wrapper based on the handler's detected response shape.
// Does NOT touch responses that already have a typed wrapper or non-200 codes.
func upgradeResponse(op map[string]interface{}, h *HandlerInfo) {
	responses, _ := op["responses"].(map[string]interface{})
	if responses == nil {
		return
	}
	r200, _ := responses["200"].(map[string]interface{})
	if r200 == nil {
		return
	}
	content, _ := r200["content"].(map[string]interface{})
	if content == nil {
		return
	}
	js, _ := content["application/json"].(map[string]interface{})
	if js == nil {
		return
	}
	schema, _ := js["schema"].(map[string]interface{})
	if schema == nil {
		return
	}
	ref, _ := schema["$ref"].(string)
	// Only upgrade generic wrappers; never overwrite a model-typed wrapper.
	if ref != "#/components/schemas/ApiResponse" &&
		ref != "#/components/schemas/ApiResponseOfObject" {
		return
	}
	target := ""
	switch {
	case h.RespIsPaged && h.RespType != "":
		target = "ApiResponsePagedOf" + h.RespType
		referencedTypes[h.RespType] = true
	case h.RespIsPaged:
		// Paged but item type unknown — leave as is.
		return
	case h.RespType != "":
		target = "ApiResponseOf" + h.RespType
		referencedTypes[h.RespType] = true
	}
	if target != "" {
		schema["$ref"] = "#/components/schemas/" + target
	}
}

// buildResponse turns a respSpec into an OpenAPI responses object.
func buildResponse(spec respSpec) map[string]interface{} {
	schemaName := "ApiResponse"
	switch {
	case spec.Empty:
		schemaName = "ApiResponse"
	case spec.Custom != "":
		schemaName = spec.Custom
	case spec.Wrap != "":
		schemaName = spec.Wrap
	case spec.Type != "":
		referencedTypes[spec.Type] = true
		switch {
		case spec.Paged:
			schemaName = "ApiResponsePagedOf" + spec.Type
		case spec.List:
			schemaName = "ApiResponseListOf" + spec.Type
		default:
			schemaName = "ApiResponseOf" + spec.Type
		}
	}
	return map[string]interface{}{
		"200": map[string]interface{}{
			"description": translate(currentLocale, "resp.success"),
			"headers":     map[string]interface{}{},
			"content": map[string]interface{}{
				"application/json": map[string]interface{}{
					"schema": map[string]interface{}{
						"$ref": "#/components/schemas/" + schemaName,
					},
				},
			},
		},
	}
}
