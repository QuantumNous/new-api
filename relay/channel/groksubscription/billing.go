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
	out.snapshot.UsagePercent = upstream.firstUsagePercent()
	out.snapshot.MonthlyLimitCents = upstream.MonthlyLimit
	out.snapshot.UsedPercent = deriveUsedPercent(upstream.IncludedUsed, upstream.MonthlyLimit)
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
	return tier, nil
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
	IncludedUsed       *float64
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
	includedUsed, err := firstBillingNumber(primary, outer, "includedUsed", "included_used", "used", "totalUsed")
	if err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}

	return upstreamBillingWindow{
		Plan:               firstNonEmpty(planName, planCode),
		Tier:               tier,
		CreditUsagePercent: creditUsagePercent,
		UsagePercent:       usagePercent,
		MonthlyLimit:       monthlyLimit,
		IncludedUsed:       includedUsed,
	}, nil
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
