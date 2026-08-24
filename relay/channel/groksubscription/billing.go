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
	req.Header.Set("Authorization", "Bearer "+strings.TrimSpace(cred.AccessToken))
	req.Header.Set("Accept", "application/json")
	req.Header.Set(HeaderXAITokenAuth, HeaderXAITokenAuthValue)
	req.Header.Set(HeaderGrokClientVersion, CLIClientVersion())
	req.Header.Set(HeaderGrokClientID, GrokClientIDValue)
	req.Header.Set("User-Agent", CLIUserAgentPrefix+CLIClientVersion())

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
	Plan               string       `json:"plan,omitempty"`
	Tier               string       `json:"tier,omitempty"`
	CreditUsagePercent *float64     `json:"creditUsagePercent,omitempty"`
	UsagePercent       *float64     `json:"usagePercent,omitempty"`
	MonthlyLimit       *int64       `json:"monthlyLimit,omitempty"`
	IncludedUsed       *json.Number `json:"includedUsed,omitempty"`
}

func parseUpstreamBillingWindow(body []byte) (upstreamBillingWindow, error) {
	var raw upstreamBillingWindow
	dec := json.NewDecoder(bytes.NewReader(body))
	dec.UseNumber()
	if err := dec.Decode(&raw); err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	if err := ensureDecoderEOF(dec); err != nil {
		return upstreamBillingWindow{}, ErrBillingSnapshotInvalid
	}
	return raw, nil
}

func (w upstreamBillingWindow) firstUsagePercent() *float64 {
	if w.CreditUsagePercent != nil {
		return w.CreditUsagePercent
	}
	return w.UsagePercent
}

func deriveUsedPercent(includedUsed *json.Number, monthlyLimit *int64) *float64 {
	if includedUsed == nil || monthlyLimit == nil || *monthlyLimit <= 0 {
		return nil
	}
	used, err := includedUsed.Float64()
	if err != nil || used < 0 {
		return nil
	}
	percent := used / float64(*monthlyLimit) * 100
	if math.IsNaN(percent) || math.IsInf(percent, 0) {
		return nil
	}
	return &percent
}

func isExplicitFree(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "free", "0", "2", "basic", "x_basic", "xai_basic":
		return true
	default:
		return false
	}
}

func hasAuthoritativePaidEvidence(snapshot BillingProbeSnapshot) bool {
	if isCanonicalPaidBillingPlan(snapshot.Plan) {
		return true
	}
	return successfulWindowHasPaidEvidence(snapshot.Monthly) || successfulWindowHasPaidEvidence(snapshot.Weekly)
}

func successfulWindowHasPaidEvidence(window BillingWindowSnapshot) bool {
	if !isSuccessfulBillingStatus(window.StatusCode) {
		return false
	}
	if window.UsagePercent != nil || window.UsedPercent != nil {
		return true
	}
	return window.MonthlyLimitCents != nil && *window.MonthlyLimitCents > 0
}

func isCanonicalPaidBillingPlan(plan string) bool {
	switch strings.TrimSpace(plan) {
	case "SuperGrok", "SuperGrok Heavy":
		return true
	default:
		return false
	}
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
