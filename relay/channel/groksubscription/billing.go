package groksubscription

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"strings"
)

const (
	billingSnapshotVersion      = 1
	billingMaxEvidenceAge       = 24 * 60 * 60
	billingMaxFutureSkewSeconds = 5 * 60
	maxBillingResponseBytes     = 1 << 20
)

var (
	ErrMediaSubscriptionRequired = errors.New("grok billing: media subscription required")
	ErrBillingSnapshotInvalid    = errors.New("grok billing: snapshot invalid")
	ErrBillingSnapshotStale      = errors.New("grok billing: snapshot stale")
	ErrBillingProbeFailed        = errors.New("grok billing: probe request failed")
)

type BillingWindowSnapshot struct {
	StatusCode        int      `json:"status_code"`
	UsagePercent      *float64 `json:"usage_percent,omitempty"`
	UsedPercent       *float64 `json:"used_percent,omitempty"`
	MonthlyLimitCents *int64   `json:"monthly_limit_cents,omitempty"`
	Limit             *float64 `json:"limit,omitempty"`
	Used              *float64 `json:"used,omitempty"`
	Remaining         *float64 `json:"remaining,omitempty"`
	Unit              string   `json:"unit,omitempty"`
	PeriodType        string   `json:"period_type,omitempty"`
	PeriodStart       string   `json:"period_start,omitempty"`
	PeriodEnd         string   `json:"period_end,omitempty"`
	OnDemandCap       *float64 `json:"on_demand_cap,omitempty"`
	OnDemandUsed      *float64 `json:"on_demand_used,omitempty"`
	OnDemandRemaining *float64 `json:"on_demand_remaining,omitempty"`
	PrepaidBalance    *float64 `json:"prepaid_balance,omitempty"`
}

type BillingProbeSnapshot struct {
	Version int                   `json:"version"`
	Plan    string                `json:"plan,omitempty"`
	Tier    string                `json:"tier,omitempty"`
	Monthly BillingWindowSnapshot `json:"monthly"`
	Weekly  BillingWindowSnapshot `json:"weekly"`
}

func EvaluateMediaEligibility(snapshotJSON string, observedAt, now int64) error {
	if observedAt <= 0 || observedAt < now-billingMaxEvidenceAge || observedAt > now+billingMaxFutureSkewSeconds {
		return ErrBillingSnapshotStale
	}

	snapshot, err := parsePersistedBillingSnapshot(snapshotJSON)
	if err != nil {
		return err
	}
	if isExplicitFree(snapshot.Plan) || isExplicitFree(snapshot.Tier) {
		return ErrMediaSubscriptionRequired
	}
	if isUnauthorizedBillingStatus(snapshot.Monthly.StatusCode) || isUnauthorizedBillingStatus(snapshot.Weekly.StatusCode) {
		return ErrMediaSubscriptionRequired
	}
	if !isSuccessfulBillingStatus(snapshot.Monthly.StatusCode) && !isSuccessfulBillingStatus(snapshot.Weekly.StatusCode) {
		return ErrMediaSubscriptionRequired
	}
	if hasAuthoritativePaidEvidence(snapshot) {
		return nil
	}
	return ErrMediaSubscriptionRequired
}

func ProbeBilling(ctx context.Context, doer HTTPDoer, cred Credential) (BillingProbeSnapshot, error) {
	if doer == nil {
		return BillingProbeSnapshot{}, errors.New("grok billing: http doer is required")
	}
	if strings.TrimSpace(cred.AccessToken) == "" {
		return BillingProbeSnapshot{}, errors.New("grok billing: access token required")
	}

	snapshot := BillingProbeSnapshot{Version: billingSnapshotVersion}
	monthly, err := probeBillingWindow(ctx, doer, cred, BillingMonthlyPath)
	if err != nil {
		return BillingProbeSnapshot{}, err
	}
	weekly, err := probeBillingWindow(ctx, doer, cred, BillingWeeklyCreditsPath)
	if err != nil {
		return BillingProbeSnapshot{}, err
	}

	snapshot.Monthly = monthly.snapshot
	snapshot.Weekly = weekly.snapshot
	snapshot.Plan = firstNonEmpty(canonicalBillingPlan(monthly.upstream.MonthlyLimit), firstNonEmpty(monthly.upstream.Plan, weekly.upstream.Plan))
	snapshot.Tier = firstNonEmpty(monthly.upstream.Tier, weekly.upstream.Tier)
	// A zero-usage billing response does not reliably distinguish a free account
	// from a newly activated paid subscription. The CLI also checks the live user
	// subscription endpoint. Keep this lookup best-effort: a billing snapshot that
	// already contains authoritative plan/tier evidence must not fail just because
	// the optional identity endpoint is unavailable.
	if snapshot.Plan == "" && snapshot.Tier == "" {
		if tier, tierErr := probeSubscriptionTier(ctx, doer, cred); tierErr == nil {
			snapshot.Tier = tier
		}
	}
	return snapshot, nil
}

func parsePersistedBillingSnapshot(raw string) (BillingProbeSnapshot, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return BillingProbeSnapshot{}, ErrBillingSnapshotInvalid
	}
	var snapshot BillingProbeSnapshot
	dec := json.NewDecoder(strings.NewReader(trimmed))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&snapshot); err != nil {
		return BillingProbeSnapshot{}, ErrBillingSnapshotInvalid
	}
	if err := ensureDecoderEOF(dec); err != nil {
		return BillingProbeSnapshot{}, ErrBillingSnapshotInvalid
	}
	if snapshot.Version != billingSnapshotVersion {
		return BillingProbeSnapshot{}, ErrBillingSnapshotInvalid
	}
	return snapshot, nil
}

func ensureDecoderEOF(dec *json.Decoder) error {
	var extra any
	if err := dec.Decode(&extra); err != io.EOF {
		return errors.New("trailing JSON data")
	}
	return nil
}

func probeBillingWindow(ctx context.Context, doer HTTPDoer, cred Credential, path string) (billingWindowProbe, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, CLIProxyBase+path, nil)
	if err != nil {
		return billingWindowProbe{}, err
	}
	setCLIBillingHeaders(req, cred)

	resp, err := doer.Do(req)
	if err != nil {
		return billingWindowProbe{}, ErrBillingProbeFailed
	}
	if resp == nil || resp.Body == nil {
		return billingWindowProbe{}, errors.New("grok billing: empty response")
	}
	defer resp.Body.Close()

	body, err := readBoundedBillingBody(resp.Body)
	if err != nil {
		return billingWindowProbe{}, err
	}
	out := billingWindowProbe{snapshot: BillingWindowSnapshot{StatusCode: resp.StatusCode}}
	if !isSuccessfulBillingStatus(resp.StatusCode) {
		return out, nil
	}

	upstream, err := parseUpstreamBillingWindow(body)
	if err != nil {
		return billingWindowProbe{}, err
	}
	out.upstream = upstream
	out.snapshot = snapshotFromUpstream(resp.StatusCode, upstream)
	return out, nil
}

func probeSubscriptionTier(ctx context.Context, doer HTTPDoer, cred Credential) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, CLIProxyBase+SubscriptionTierPath, nil)
	if err != nil {
		return "", err
	}
	setCLIBillingHeaders(req, cred)

	resp, err := doer.Do(req)
	if err != nil {
		return "", ErrBillingProbeFailed
	}
	if resp == nil || resp.Body == nil {
		return "", errors.New("grok billing: empty subscription response")
	}
	defer resp.Body.Close()
	body, err := readBoundedBillingBody(resp.Body)
	if err != nil {
		return "", err
	}
	if resp.StatusCode != http.StatusOK {
		return "", nil
	}

	var payload map[string]any
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&payload); err != nil {
		return "", ErrBillingSnapshotInvalid
	}
	if err := ensureDecoderEOF(dec); err != nil {
		return "", ErrBillingSnapshotInvalid
	}
	tier := firstBillingString(payload, "subscriptionTier", "subscription_tier")
	if tier == "" {
		if user, ok := payload["user"].(map[string]any); ok {
			tier = firstBillingString(user, "subscriptionTier", "subscription_tier")
		}
	}
	return normalizeSubscriptionTier(tier), nil
}

func setCLIBillingHeaders(req *http.Request, cred Credential) {
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cred.AccessToken))
	req.Header.Set("Accept", "application/json")
	req.Header.Set(HeaderXAITokenAuth, HeaderXAITokenAuthValue)
	req.Header.Set(HeaderGrokClientVersion, CLIClientVersion())
	req.Header.Set(HeaderGrokClientID, GrokClientIDValue)
	req.Header.Set("User-Agent", CLIUserAgentPrefix+CLIClientVersion())
}

func readBoundedBillingBody(body io.Reader) ([]byte, error) {
	limited, err := io.ReadAll(io.LimitReader(body, maxBillingResponseBytes+1))
	if err != nil {
		return nil, errors.New("grok billing: failed to read response")
	}
	if len(limited) > maxBillingResponseBytes {
		return nil, errors.New("grok billing: response too large")
	}
	return limited, nil
}

type billingWindowProbe struct {
	snapshot BillingWindowSnapshot
	upstream upstreamBillingWindow
}

type upstreamBillingWindow struct {
	Plan               string
	Tier               string
	CreditUsagePercent *float64
	UsagePercent       *float64
	MonthlyLimit       *int64
	Used               *float64
	IncludedUsed       *float64
	OnDemandCap        *float64
	OnDemandUsed       *float64
	PrepaidBalance     *float64
	PeriodType         string
	PeriodStart        string
	PeriodEnd          string
	BillingPeriodStart string
	BillingPeriodEnd   string
}

func parseUpstreamBillingWindow(body []byte) (upstreamBillingWindow, error) {
	var outer map[string]any
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&outer); err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	if err := ensureDecoderEOF(dec); err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}

	primary := outer
	if config, ok := outer["config"].(map[string]any); ok {
		primary = config
	}
	planCode, planName := billingPlanValues(primary)
	outerPlanCode, outerPlanName := billingPlanValues(outer)
	if planCode == "" {
		planCode = outerPlanCode
	}
	if planName == "" {
		planName = outerPlanName
	}
	tier := firstBillingString(primary, "subscriptionTier", "subscription_tier", "tier")
	if tier == "" {
		tier = firstBillingString(outer, "subscriptionTier", "subscription_tier", "tier")
	}

	creditUsagePercent, err := firstBillingNumber(primary, outer, "creditUsagePercent", "credit_usage_percent")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	usagePercent, err := firstBillingNumber(primary, outer, "usagePercent", "usage_percent")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	monthlyLimitValue, err := firstBillingNumber(primary, outer, "monthlyLimit", "monthly_limit")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	monthlyLimit, err := billingInt64(monthlyLimitValue)
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	used, err := firstBillingNumber(primary, outer, "used", "totalUsed", "total_used")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	includedUsed, err := firstBillingNumber(primary, outer, "includedUsed", "included_used")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	onDemandCap, err := firstBillingNumber(primary, outer, "onDemandCap", "on_demand_cap", "maxAmountPerMonth", "max_amount_per_month")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	onDemandUsed, err := firstBillingNumber(primary, outer, "onDemandUsed", "on_demand_used")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	prepaidBalance, err := firstBillingNumber(primary, outer, "prepaidBalance", "prepaid_balance")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	for _, value := range []*float64{used, includedUsed, onDemandCap, onDemandUsed, prepaidBalance} {
		if err := validateNonNegativeBillingNumber(value); err != nil {
			return upstreamBillingWindow{}, err
		}
	}
	if err := validateBillingPercentage(creditUsagePercent); err != nil {
		return upstreamBillingWindow{}, err
	}
	if err := validateBillingPercentage(usagePercent); err != nil {
		return upstreamBillingWindow{}, err
	}
	periodType, periodStart, periodEnd := billingPeriodValues(primary, outer)
	billingPeriodStart := firstBillingString(primary, "billingPeriodStart", "billing_period_start")
	if billingPeriodStart == "" {
		billingPeriodStart = firstBillingString(outer, "billingPeriodStart", "billing_period_start")
	}
	billingPeriodEnd := firstBillingString(primary, "billingPeriodEnd", "billing_period_end")
	if billingPeriodEnd == "" {
		billingPeriodEnd = firstBillingString(outer, "billingPeriodEnd", "billing_period_end")
	}

	return upstreamBillingWindow{
		Plan:               firstNonEmpty(planName, planCode),
		Tier:               normalizeSubscriptionTier(tier),
		CreditUsagePercent: creditUsagePercent,
		UsagePercent:       usagePercent,
		MonthlyLimit:       monthlyLimit,
		Used:               used,
		IncludedUsed:       includedUsed,
		OnDemandCap:        onDemandCap,
		OnDemandUsed:       onDemandUsed,
		PrepaidBalance:     prepaidBalance,
		PeriodType:         periodType,
		PeriodStart:        periodStart,
		PeriodEnd:          periodEnd,
		BillingPeriodStart: billingPeriodStart,
		BillingPeriodEnd:   billingPeriodEnd,
	}, nil
}

func normalizeSubscriptionTier(value string) string {
	normalized := strings.TrimSpace(value)
	switch normalized {
	case "0":
		return "free"
	case "1":
		return "supergrok"
	case "2":
		return "x_basic"
	case "3":
		return "x_premium"
	case "4":
		return "x_premium_plus"
	case "5":
		return "supergrok_heavy"
	case "6":
		return "supergrok_lite"
	default:
		return normalized
	}
}

func billingPeriodValues(primary, fallback map[string]any) (string, string, string) {
	for _, values := range []map[string]any{primary, fallback} {
		if current, ok := values["currentPeriod"].(map[string]any); ok {
			periodType := firstBillingString(current, "type", "periodType", "period_type")
			periodStart := firstBillingString(current, "start", "periodStart", "period_start")
			periodEnd := firstBillingString(current, "end", "periodEnd", "period_end")
			if periodType != "" || periodStart != "" || periodEnd != "" {
				return periodType, periodStart, periodEnd
			}
		}
		periodType := firstBillingString(values, "usagePeriodType", "usage_period_type", "periodType", "period_type")
		periodStart := firstBillingString(values, "usagePeriodStart", "usage_period_start", "periodStart", "period_start")
		periodEnd := firstBillingString(values, "usagePeriodEnd", "usage_period_end", "periodEnd", "period_end")
		if periodType != "" || periodStart != "" || periodEnd != "" {
			return periodType, periodStart, periodEnd
		}
	}
	return "", "", ""
}

func billingPlanValues(values map[string]any) (string, string) {
	code := firstBillingString(values, "planCode", "plan_code")
	name := firstBillingString(values, "planName", "plan_name", "subscriptionName", "subscription_name")
	for _, key := range []string{"plan", "subscription", "membership"} {
		value, ok := values[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			if name == "" {
				name = strings.TrimSpace(typed)
			}
		case map[string]any:
			if code == "" {
				code = firstBillingString(typed, "code", "id", "tier", "slug")
			}
			if name == "" {
				name = firstBillingString(typed, "name", "displayName", "display_name", "label")
			}
		}
	}
	return code, name
}

func firstBillingString(values map[string]any, keys ...string) string {
	for _, key := range keys {
		value, ok := values[key]
		if !ok {
			continue
		}
		switch typed := value.(type) {
		case string:
			return strings.TrimSpace(typed)
		case json.Number:
			return strings.TrimSpace(typed.String())
		}
	}
	return ""
}

func firstBillingNumber(primary, fallback map[string]any, keys ...string) (*float64, error) {
	for _, values := range []map[string]any{primary, fallback} {
		for _, key := range keys {
			value, ok := values[key]
			if !ok {
				continue
			}
			number, ok := billingNumber(value)
			if !ok {
				if isSkippableBillingNumber(value) {
					continue
				}
				return nil, ErrBillingSnapshotInvalid
			}
			if math.IsNaN(number) || math.IsInf(number, 0) {
				return nil, ErrBillingSnapshotInvalid
			}
			return &number, nil
		}
	}
	return nil, nil
}

func isSkippableBillingNumber(value any) bool {
	switch typed := value.(type) {
	case nil:
		return true
	case string:
		return strings.TrimSpace(typed) == ""
	case map[string]any:
		wrapped, ok := typed["val"]
		if !ok {
			return true
		}
		return isSkippableBillingNumber(wrapped)
	default:
		return false
	}
}

func billingNumber(value any) (float64, bool) {
	switch typed := value.(type) {
	case json.Number:
		number, err := typed.Float64()
		return number, err == nil
	case string:
		number, err := json.Number(strings.TrimSpace(typed)).Float64()
		return number, err == nil
	case map[string]any:
		wrapped, ok := typed["val"]
		if !ok {
			return 0, false
		}
		return billingNumber(wrapped)
	default:
		return 0, false
	}
}

func billingInt64(value *float64) (*int64, error) {
	if value == nil {
		return nil, nil
	}
	if *value < 0 || *value > float64(math.MaxInt64) || math.Trunc(*value) != *value {
		return nil, ErrBillingSnapshotInvalid
	}
	converted := int64(*value)
	return &converted, nil
}

func validateNonNegativeBillingNumber(value *float64) error {
	if value != nil && *value < 0 {
		return ErrBillingSnapshotInvalid
	}
	return nil
}

func validateBillingPercentage(value *float64) error {
	// Usage can legitimately exceed the included pool when an account is in
	// overage. Keep the raw observation for accounting and clamp only the
	// derived/display percentage at the projection boundary.
	if value != nil && *value < 0 {
		return ErrBillingSnapshotInvalid
	}
	return nil
}

func snapshotFromUpstream(statusCode int, upstream upstreamBillingWindow) BillingWindowSnapshot {
	snapshot := BillingWindowSnapshot{
		StatusCode:        statusCode,
		UsagePercent:      upstream.firstUsagePercent(),
		MonthlyLimitCents: upstream.MonthlyLimit,
		OnDemandCap:       cloneFloat(upstream.OnDemandCap),
		OnDemandUsed:      cloneFloat(upstream.OnDemandUsed),
		PrepaidBalance:    cloneFloat(upstream.PrepaidBalance),
		PeriodType:        upstream.PeriodType,
		PeriodStart:       upstream.PeriodStart,
		PeriodEnd:         upstream.PeriodEnd,
	}

	used := firstNonNilFloat(upstream.Used, upstream.IncludedUsed)
	if upstream.MonthlyLimit != nil {
		limit := float64(*upstream.MonthlyLimit)
		snapshot.Limit = &limit
		snapshot.Unit = "credits"
		if used != nil {
			snapshot.Used = cloneFloat(used)
			remaining := maxFloat(limit-*used, 0)
			snapshot.Remaining = &remaining
			if limit > 0 {
				usedPercent := *used / limit * 100
				snapshot.UsedPercent = &usedPercent
				if snapshot.UsagePercent == nil {
					snapshot.UsagePercent = &usedPercent
				}
			}
		}
	}

	if snapshot.Limit == nil && upstream.OnDemandCap != nil {
		limit := *upstream.OnDemandCap
		snapshot.Limit = &limit
		snapshot.Unit = "credits"
	}
	if upstream.OnDemandCap != nil {
		onDemandUsed := upstream.OnDemandUsed
		if onDemandUsed == nil && *upstream.OnDemandCap > 0 && upstream.firstUsagePercent() != nil && *upstream.firstUsagePercent() > 0 {
			inferred := *upstream.OnDemandCap * *upstream.firstUsagePercent() / 100
			onDemandUsed = &inferred
			snapshot.OnDemandUsed = &inferred
		}
		if onDemandUsed != nil {
			remaining := maxFloat(*upstream.OnDemandCap-*onDemandUsed, 0)
			snapshot.OnDemandRemaining = &remaining
			if snapshot.Used == nil {
				snapshot.Used = cloneFloat(onDemandUsed)
				snapshot.Remaining = cloneFloat(&remaining)
			}
		}
	}
	if snapshot.Limit == nil && upstream.PrepaidBalance != nil {
		snapshot.Unit = "credits"
		snapshot.Remaining = cloneFloat(upstream.PrepaidBalance)
	}

	// A currentPeriod is present in both monthly credit and weekly percentage
	// payloads. Only let an explicitly percentage/weekly period replace the
	// credit-pool projection; otherwise a monthly limit would be silently
	// rewritten as a 0..100 percentage window.
	if isPercentageBillingPeriod(upstream.PeriodType) || (snapshot.Limit == nil && snapshot.UsagePercent != nil) {
		percent := snapshot.UsagePercent
		if percent == nil {
			percent = upstream.firstUsagePercent()
		}
		if percent != nil {
			value := clampBillingPercentage(*percent)
			snapshot.Unit = "percent"
			snapshot.Limit = floatPointer(100)
			snapshot.Used = &value
			remaining := 100 - value
			snapshot.Remaining = &remaining
			snapshot.UsagePercent = &value
		}
	}
	if snapshot.PeriodStart == "" {
		snapshot.PeriodStart = upstream.BillingPeriodStart
	}
	if snapshot.PeriodEnd == "" {
		snapshot.PeriodEnd = upstream.BillingPeriodEnd
	}
	return snapshot
}

func isPercentageBillingPeriod(periodType string) bool {
	normalized := strings.ToLower(strings.TrimSpace(periodType))
	if normalized == "" {
		return false
	}
	return strings.Contains(normalized, "week") || strings.Contains(normalized, "percent")
}

func firstNonNilFloat(values ...*float64) *float64 {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func cloneFloat(value *float64) *float64 {
	if value == nil {
		return nil
	}
	cloned := *value
	return &cloned
}

func floatPointer(value float64) *float64 { return &value }

func maxFloat(value, floor float64) float64 {
	if value < floor {
		return floor
	}
	return value
}

func clampBillingPercentage(value float64) float64 {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func (w upstreamBillingWindow) firstUsagePercent() *float64 {
	if w.CreditUsagePercent != nil {
		return w.CreditUsagePercent
	}
	return w.UsagePercent
}

func deriveUsedPercent(includedUsed *float64, monthlyLimit *int64) *float64 {
	if includedUsed == nil || monthlyLimit == nil || *monthlyLimit <= 0 {
		return nil
	}
	used := *includedUsed
	if used < 0 {
		return nil
	}
	percent := used / float64(*monthlyLimit) * 100
	if math.IsNaN(percent) || math.IsInf(percent, 0) {
		return nil
	}
	return &percent
}

func isExplicitFree(value string) bool {
	switch normalizeBillingPlan(value) {
	case "free", "grokfree", "freetier", "0", "2", "basic", "grokbasic", "xbasic", "xaibasic":
		return true
	default:
		return false
	}
}

func hasAuthoritativePaidEvidence(snapshot BillingProbeSnapshot) bool {
	if isKnownPaidBillingPlan(snapshot.Plan) || isKnownPaidBillingPlan(snapshot.Tier) {
		return true
	}
	return successfulWindowHasPaidEvidence(snapshot.Monthly) || successfulWindowHasPaidEvidence(snapshot.Weekly)
}

func successfulWindowHasPaidEvidence(window BillingWindowSnapshot) bool {
	if !isSuccessfulBillingStatus(window.StatusCode) {
		return false
	}
	return window.MonthlyLimitCents != nil && *window.MonthlyLimitCents > 0
}

func isKnownPaidBillingPlan(plan string) bool {
	normalized := normalizeBillingPlan(plan)
	switch normalized {
	case "1", "3", "4", "5", "6", "super", "supergrok", "supergrokpro", "supergrokheavy", "supergroklite", "supergrokplus", "grokpro", "xpremium", "xpremiumplus", "apikey":
		return true
	default:
		return strings.HasPrefix(normalized, "supergrok")
	}
}

func normalizeBillingPlan(value string) string {
	return strings.NewReplacer(" ", "", "_", "", "-", "", "+", "plus").Replace(strings.ToLower(strings.TrimSpace(value)))
}

func canonicalBillingPlan(monthlyLimit *int64) string {
	if monthlyLimit == nil {
		return ""
	}
	switch *monthlyLimit {
	case 15000:
		return "SuperGrok"
	case 150000:
		return "SuperGrok Heavy"
	default:
		return ""
	}
}

func isSuccessfulBillingStatus(status int) bool {
	return status >= 200 && status <= 299
}

func isUnauthorizedBillingStatus(status int) bool {
	return status == http.StatusUnauthorized || status == http.StatusForbidden
}
