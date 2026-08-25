package groksubscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestEvaluateMediaEligibility(t *testing.T) {
	const now = int64(2000000000)
	usage := 12.5
	used := 20.0
	limit := int64(15000)

	tests := []struct {
		name       string
		snapshot   string
		observedAt int64
		wantErr    error
	}{
		{
			name:       "canonical SuperGrok plan with one success grants media",
			snapshot:   `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			observedAt: now,
		},
		{
			name:       "canonical SuperGrok Heavy plan grants media",
			snapshot:   `{"version":1,"plan":"SuperGrok Heavy","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			observedAt: now,
		},
		{
			name:       "known paid subscription tier grants media",
			snapshot:   `{"version":1,"tier":"SuperGrokPlus","monthly":{"status_code":200},"weekly":{"status_code":200}}`,
			observedAt: now,
		},
		{
			name:       "missing version fails strict snapshot parsing",
			snapshot:   `{"monthly":{"status_code":200},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrBillingSnapshotInvalid,
		},
		{
			name:       "unknown version fails strict snapshot parsing",
			snapshot:   `{"version":2,"monthly":{"status_code":200},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrBillingSnapshotInvalid,
		},
		{
			name:       "unknown persisted field fails strict snapshot parsing",
			snapshot:   `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200,"raw":"nope"},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrBillingSnapshotInvalid,
		},
		{
			name:       "explicit free plan denies media",
			snapshot:   `{"version":1,"plan":"free","monthly":{"status_code":200,"usage_percent":12.5},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "explicit numeric free tier denies media",
			snapshot:   `{"version":1,"tier":"0","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "explicit x_basic tier denies media",
			snapshot:   `{"version":1,"tier":"x_basic","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "numeric x_basic equivalent tier denies media",
			snapshot:   `{"version":1,"tier":"2","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "textual basic equivalent tier denies media",
			snapshot:   `{"version":1,"tier":"basic","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "positive monthly limit grants media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, MonthlyLimitCents: &limit}, Weekly: BillingWindowSnapshot{StatusCode: 503}}),
			observedAt: now,
		},
		{
			name:       "usage percent alone does not prove paid media entitlement",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}, Weekly: BillingWindowSnapshot{StatusCode: 503}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "derived used percent alone does not prove paid media entitlement",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, UsedPercent: &used}, Weekly: BillingWindowSnapshot{StatusCode: 503}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "partial weekly usage without entitlement denies media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 500}, Weekly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "paid-looking evidence on failed window does not grant media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 500, MonthlyLimitCents: &limit}, Weekly: BillingWindowSnapshot{StatusCode: 200}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "monthly unauthorized denies even when weekly paid",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 401}, Weekly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "weekly forbidden denies even when monthly paid",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}, Weekly: BillingWindowSnapshot{StatusCode: 403}}),
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "no authoritative paid evidence denies media",
			snapshot:   `{"version":1,"monthly":{"status_code":200},"weekly":{"status_code":200}}`,
			observedAt: now,
			wantErr:    ErrMediaSubscriptionRequired,
		},
		{
			name:       "exact 24 hour boundary remains fresh",
			snapshot:   `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			observedAt: now - 24*60*60,
		},
		{
			name:       "older than 24 hours is stale",
			snapshot:   `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			observedAt: now - 24*60*60 - 1,
			wantErr:    ErrBillingSnapshotStale,
		},
		{
			name:       "excessive future skew is stale",
			snapshot:   `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			observedAt: now + 5*60 + 1,
			wantErr:    ErrBillingSnapshotStale,
		},
		{
			name:       "malformed JSON is invalid",
			snapshot:   `{"version":1`,
			observedAt: now,
			wantErr:    ErrBillingSnapshotInvalid,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := EvaluateMediaEligibility(tt.snapshot, tt.observedAt, now)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("EvaluateMediaEligibility() err = %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func TestProbeBillingSanitizesUpstreamBillingResponses(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	var seen []string
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		seen = append(seen, req.URL.String())
		if req.URL.Host != HostCLIProxy {
			t.Fatalf("billing probe must use CLI proxy host, got %q", req.URL.Host)
		}
		if got := req.Header.Get("Authorization"); got != "Bearer access-secret" {
			t.Fatalf("Authorization = %q, want Bearer token", got)
		}
		if got := req.Header.Get(HeaderXAITokenAuth); got != HeaderXAITokenAuthValue {
			t.Fatalf("%s = %q, want CLI identity", HeaderXAITokenAuth, got)
		}
		if got := req.Header.Get(HeaderGrokClientID); got != GrokClientIDValue {
			t.Fatalf("%s = %q, want CLI client id", HeaderGrokClientID, got)
		}
		if got := req.Header.Get(HeaderGrokClientVersion); got == "" {
			t.Fatalf("%s must be set", HeaderGrokClientVersion)
		}
		if got := req.Header.Get("User-Agent"); !strings.HasPrefix(got, CLIUserAgentPrefix) {
			t.Fatalf("User-Agent = %q, want CLI prefix", got)
		}

		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{"monthlyLimit":15000,"includedUsed":3000,"creditUsagePercent":12.5,"ignoredRaw":"not copied"}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"usagePercent":8}`), nil
		default:
			t.Fatalf("unexpected billing path %q", req.URL.RequestURI())
			return nil, nil
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if len(seen) != 2 {
		t.Fatalf("ProbeBilling request count = %d, want 2", len(seen))
	}
	if got.Version != 1 || got.Plan != "SuperGrok" || got.Monthly.StatusCode != 200 || got.Weekly.StatusCode != 200 {
		t.Fatalf("unexpected snapshot metadata: %+v", got)
	}
	if got.Monthly.MonthlyLimitCents == nil || *got.Monthly.MonthlyLimitCents != 15000 {
		t.Fatalf("monthly_limit_cents = %v, want 15000", got.Monthly.MonthlyLimitCents)
	}
	if got.Monthly.UsagePercent == nil || *got.Monthly.UsagePercent != 12.5 {
		t.Fatalf("monthly usage_percent = %v, want 12.5", got.Monthly.UsagePercent)
	}
	if got.Monthly.UsedPercent == nil || *got.Monthly.UsedPercent != 20 {
		t.Fatalf("monthly used_percent = %v, want 20", got.Monthly.UsedPercent)
	}
	if got.Weekly.UsagePercent == nil || *got.Weekly.UsagePercent != 8 {
		t.Fatalf("weekly usage_percent = %v, want 8", got.Weekly.UsagePercent)
	}
	serialized := mustBillingSnapshotJSON(t, got)
	for _, secret := range []string{"access-secret", "ignoredRaw"} {
		if strings.Contains(serialized, secret) {
			t.Fatalf("sanitized snapshot must not retain %q: %s", secret, serialized)
		}
	}
}

func TestProbeBillingReadsSubscriptionTierWhenBillingHasNoPlanEvidence(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	var seenSubscription bool
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{}`), nil
		case SubscriptionTierPath:
			seenSubscription = true
			if got := req.Header.Get("Authorization"); got != "Bearer access-secret" {
				t.Fatalf("subscription Authorization = %q, want Bearer token", got)
			}
			if got := req.Header.Get(HeaderXAITokenAuth); got != HeaderXAITokenAuthValue {
				t.Fatalf("subscription %s = %q, want CLI identity", HeaderXAITokenAuth, got)
			}
			return jsonResponse(200, `{"user":{"subscriptionTier":"SuperGrok"}}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if !seenSubscription {
		t.Fatal("ProbeBilling did not query the subscription endpoint")
	}
	if got.Tier != "SuperGrok" {
		t.Fatalf("Tier = %q, want SuperGrok", got.Tier)
	}
	if err := EvaluateMediaEligibility(mustBillingSnapshotJSON(t, got), 2000000000, 2000000000); err != nil {
		t.Fatalf("known paid subscription tier must grant media, got %v", err)
	}
}

func TestProbeBillingReadsSnakeCaseNestedSubscriptionTier(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath, BillingWeeklyCreditsPath:
			return jsonResponse(200, `{}`), nil
		case SubscriptionTierPath:
			return jsonResponse(200, `{"user":{"subscription_tier":"SuperGrokPro"}}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if got.Tier != "SuperGrokPro" {
		t.Fatalf("Tier = %q, want SuperGrokPro", got.Tier)
	}
}

func TestProbeBillingPreservesNumericSubscriptionTier(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath, BillingWeeklyCreditsPath:
			return jsonResponse(200, `{}`), nil
		case SubscriptionTierPath:
			return jsonResponse(200, `{"user":{"subscriptionTier":3}}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if got.Tier != "x_premium" {
		t.Fatalf("Tier = %q, want x_premium", got.Tier)
	}
	if err := EvaluateMediaEligibility(mustBillingSnapshotJSON(t, got), 2000000000, 2000000000); err != nil {
		t.Fatalf("known numeric paid tier must grant media, got %v", err)
	}
}

func TestProbeBillingDerivesGrok2APICreditBalancesAndPeriods(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{"planName":"SuperGrok","config":{"monthlyLimit":{"val":100},"used":{"val":25},"onDemandCap":{"val":50},"onDemandUsed":{"val":12.5},"prepaidBalance":{"val":3},"billingPeriodStart":"2026-07-01T00:00:00Z","billingPeriodEnd":"2026-08-01T00:00:00Z"}}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"subscriptionTier":"SuperGrok Heavy","config":{"creditUsagePercent":42.5,"currentPeriod":{"type":"USAGE_PERIOD_TYPE_WEEKLY","start":"2026-07-08T00:00:00Z","end":"2026-07-15T00:00:00Z"}}}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if got.Plan != "SuperGrok" || got.Tier != "SuperGrok Heavy" {
		t.Fatalf("plan/tier = %q/%q, want SuperGrok/SuperGrok Heavy", got.Plan, got.Tier)
	}
	if got.Monthly.Limit == nil || *got.Monthly.Limit != 100 {
		t.Fatalf("monthly limit = %v, want 100", got.Monthly.Limit)
	}
	if got.Monthly.Used == nil || *got.Monthly.Used != 25 {
		t.Fatalf("monthly used = %v, want 25", got.Monthly.Used)
	}
	if got.Monthly.Remaining == nil || *got.Monthly.Remaining != 75 {
		t.Fatalf("monthly remaining = %v, want 75", got.Monthly.Remaining)
	}
	if got.Monthly.OnDemandCap == nil || *got.Monthly.OnDemandCap != 50 {
		t.Fatalf("on-demand cap = %v, want 50", got.Monthly.OnDemandCap)
	}
	if got.Monthly.OnDemandUsed == nil || *got.Monthly.OnDemandUsed != 12.5 {
		t.Fatalf("on-demand used = %v, want 12.5", got.Monthly.OnDemandUsed)
	}
	if got.Monthly.OnDemandRemaining == nil || *got.Monthly.OnDemandRemaining != 37.5 {
		t.Fatalf("on-demand remaining = %v, want 37.5", got.Monthly.OnDemandRemaining)
	}
	if got.Monthly.PrepaidBalance == nil || *got.Monthly.PrepaidBalance != 3 {
		t.Fatalf("prepaid balance = %v, want 3", got.Monthly.PrepaidBalance)
	}
	if got.Monthly.PeriodStart != "2026-07-01T00:00:00Z" || got.Monthly.PeriodEnd != "2026-08-01T00:00:00Z" {
		t.Fatalf("monthly period = %q/%q", got.Monthly.PeriodStart, got.Monthly.PeriodEnd)
	}
	if got.Weekly.Unit != "percent" || got.Weekly.Limit == nil || *got.Weekly.Limit != 100 {
		t.Fatalf("weekly unit/limit = %q/%v, want percent/100", got.Weekly.Unit, got.Weekly.Limit)
	}
	if got.Weekly.Used == nil || *got.Weekly.Used != 42.5 || got.Weekly.Remaining == nil || *got.Weekly.Remaining != 57.5 {
		t.Fatalf("weekly used/remaining = %v/%v, want 42.5/57.5", got.Weekly.Used, got.Weekly.Remaining)
	}
	if got.Weekly.PeriodType != "USAGE_PERIOD_TYPE_WEEKLY" || got.Weekly.PeriodEnd != "2026-07-15T00:00:00Z" {
		t.Fatalf("weekly period = %q/%q, want weekly/2026-07-15", got.Weekly.PeriodType, got.Weekly.PeriodEnd)
	}
}

func TestSnapshotFromUpstreamKeepsMonthlyCreditsWhenCurrentPeriodIsMonthly(t *testing.T) {
	got, err := parseUpstreamBillingWindow([]byte(`{
		"monthlyLimit": 100,
		"used": 25,
		"creditUsagePercent": 25,
		"currentPeriod": {
			"type": "USAGE_PERIOD_TYPE_MONTHLY",
			"start": "2026-08-01T00:00:00Z",
			"end": "2026-09-01T00:00:00Z"
		}
	}`))
	if err != nil {
		t.Fatalf("parseUpstreamBillingWindow err = %v", err)
	}
	snapshot := snapshotFromUpstream(http.StatusOK, got)
	if snapshot.Unit != "credits" || snapshot.Limit == nil || *snapshot.Limit != 100 {
		t.Fatalf("monthly period must preserve credit limit, got unit=%q limit=%v", snapshot.Unit, snapshot.Limit)
	}
	if snapshot.Used == nil || *snapshot.Used != 25 || snapshot.Remaining == nil || *snapshot.Remaining != 75 {
		t.Fatalf("monthly period must preserve credit balances, got used=%v remaining=%v", snapshot.Used, snapshot.Remaining)
	}
}

func TestSnapshotFromUpstreamPreservesOverageAndClampsRemaining(t *testing.T) {
	got, err := parseUpstreamBillingWindow([]byte(`{"monthlyLimit":100,"used":130,"creditUsagePercent":125}`))
	if err != nil {
		t.Fatalf("overage billing values should remain parseable: %v", err)
	}
	snapshot := snapshotFromUpstream(http.StatusOK, got)
	if snapshot.Used == nil || *snapshot.Used != 130 {
		t.Fatalf("overage used = %v, want 130", snapshot.Used)
	}
	if snapshot.Remaining == nil || *snapshot.Remaining != 0 {
		t.Fatalf("overage remaining = %v, want 0", snapshot.Remaining)
	}
}

func TestParseUpstreamBillingWindowRejectsInvalidCreditNumbers(t *testing.T) {
	for _, tc := range []struct {
		name string
		body string
	}{
		{name: "negative monthly limit", body: `{"monthlyLimit":-1}`},
		{name: "negative on demand cap", body: `{"onDemandCap":-1}`},
		{name: "negative prepaid balance", body: `{"prepaidBalance":-1}`},
		{name: "nan usage", body: `{"used":"NaN"}`},
		{name: "infinite usage", body: `{"used":"Infinity"}`},
		{name: "fractional monthly limit", body: `{"monthlyLimit":1.5}`},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := parseUpstreamBillingWindow([]byte(tc.body)); !errors.Is(err, ErrBillingSnapshotInvalid) {
				t.Fatalf("parseUpstreamBillingWindow err = %v, want ErrBillingSnapshotInvalid", err)
			}
		})
	}
}

func TestProbeBillingParsesObservedNestedBillingPayloads(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	requestCount := 0
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		requestCount++
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{"config":{"monthlyLimit":{"val":15000},"includedUsed":{"val":3000}}}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"subscriptionTier":"SuperGrokPlus","config":{"creditUsagePercent":42.5}}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if requestCount != 2 {
		t.Fatalf("request count = %d, want two billing requests without user fallback", requestCount)
	}
	if got.Plan != "SuperGrok" || got.Tier != "SuperGrokPlus" {
		t.Fatalf("plan/tier = %q/%q, want SuperGrok/SuperGrokPlus", got.Plan, got.Tier)
	}
	if got.Monthly.MonthlyLimitCents == nil || *got.Monthly.MonthlyLimitCents != 15000 {
		t.Fatalf("monthly limit = %v, want 15000", got.Monthly.MonthlyLimitCents)
	}
	if got.Monthly.UsedPercent == nil || *got.Monthly.UsedPercent != 20 {
		t.Fatalf("monthly used percent = %v, want 20", got.Monthly.UsedPercent)
	}
	if got.Weekly.UsagePercent == nil || *got.Weekly.UsagePercent != 42.5 {
		t.Fatalf("weekly usage percent = %v, want 42.5", got.Weekly.UsagePercent)
	}
	if err := EvaluateMediaEligibility(mustBillingSnapshotJSON(t, got), 2000000000, 2000000000); err != nil {
		t.Fatalf("observed paid billing payload must grant media, got %v", err)
	}
}

func TestParseUpstreamBillingWindowSkipsEmptyAliases(t *testing.T) {
	got, err := parseUpstreamBillingWindow([]byte(`{
		"monthlyLimit": 7000,
		"config": {
			"monthlyLimit": null,
			"monthly_limit": 15000,
			"creditUsagePercent": "",
			"credit_usage_percent": 12.5,
			"usagePercent": {"value": 8},
			"usage_percent": 7.5,
			"includedUsed": {"val": null},
			"included_used": 3000
		}
	}`))
	if err != nil {
		t.Fatalf("parseUpstreamBillingWindow err = %v", err)
	}
	if got.MonthlyLimit == nil || *got.MonthlyLimit != 15000 {
		t.Fatalf("monthly limit = %v, want later non-empty alias 15000", got.MonthlyLimit)
	}
	if got.CreditUsagePercent == nil || *got.CreditUsagePercent != 12.5 {
		t.Fatalf("credit usage percent = %v, want later non-empty alias 12.5", got.CreditUsagePercent)
	}
	if got.UsagePercent == nil || *got.UsagePercent != 7.5 {
		t.Fatalf("usage percent = %v, want later supported alias 7.5", got.UsagePercent)
	}
	if got.IncludedUsed == nil || *got.IncludedUsed != 3000 {
		t.Fatalf("included used = %v, want later non-empty alias 3000", got.IncludedUsed)
	}
}

func TestParseUpstreamBillingWindowFallsBackAfterEmptyConfigValue(t *testing.T) {
	got, err := parseUpstreamBillingWindow([]byte(`{
		"monthlyLimit": 7000,
		"config": {"monthlyLimit": null}
	}`))
	if err != nil {
		t.Fatalf("parseUpstreamBillingWindow err = %v", err)
	}
	if got.MonthlyLimit == nil || *got.MonthlyLimit != 7000 {
		t.Fatalf("monthly limit = %v, want outer fallback 7000", got.MonthlyLimit)
	}
}

func TestProbeBillingKeepsBillingSnapshotWhenOptionalSubscriptionLookupFails(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath, BillingWeeklyCreditsPath:
			return jsonResponse(200, `{}`), nil
		case SubscriptionTierPath:
			return nil, errors.New("identity endpoint unavailable")
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("optional subscription failure must not discard billing evidence: %v", err)
	}
	if got.Version != billingSnapshotVersion || got.Monthly.StatusCode != 200 || got.Weekly.StatusCode != 200 {
		t.Fatalf("billing snapshot not preserved: %+v", got)
	}
}

func TestProbeBillingCapturesUnauthorizedWindowsForEligibilityDenial(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(401, `{"error":"token expired"}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"usagePercent":8}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("ProbeBilling err = %v", err)
	}
	if got.Monthly.StatusCode != 401 || got.Weekly.StatusCode != 200 {
		t.Fatalf("status capture = monthly %d weekly %d, want 401/200", got.Monthly.StatusCode, got.Weekly.StatusCode)
	}
	if err := EvaluateMediaEligibility(mustBillingSnapshotJSON(t, got), 2000000000, 2000000000); !errors.Is(err, ErrMediaSubscriptionRequired) {
		t.Fatalf("401 billing window must deny media, got %v", err)
	}
}

func TestProbeBillingFailsOnMalformedSuccessfulWindow(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{"monthlyLimit":"not-a-number"}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"usagePercent":8}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	if _, err := ProbeBilling(context.Background(), doer, cred); err == nil {
		t.Fatalf("malformed successful billing body must fail closed")
	}
}

func TestProbeBillingFailsOnOversizedSuccessfulWindow(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{}`+strings.Repeat(" ", maxBillingResponseBytes+1)), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{"usagePercent":8}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	if _, err := ProbeBilling(context.Background(), doer, cred); err == nil {
		t.Fatalf("oversized successful billing body must fail closed")
	}
}

func TestProbeBillingFailsOnTransportError(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return nil, errors.New("dial failed")
	})

	if _, err := ProbeBilling(context.Background(), doer, cred); err == nil {
		t.Fatalf("transport failure must fail probe")
	}
}

func TestProbeBillingTransportErrorDoesNotLeakSecret(t *testing.T) {
	const secret = "secret-access-token-from-transport"
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		return nil, fmt.Errorf("dial failed with %s", secret)
	})

	_, err := ProbeBilling(context.Background(), doer, cred)
	if !errors.Is(err, ErrBillingProbeFailed) {
		t.Fatalf("transport failure err = %v, want ErrBillingProbeFailed", err)
	}
	if !strings.Contains(err.Error(), "probe request failed") {
		t.Fatalf("transport failure should return stable probe category, got %q", err.Error())
	}
	if strings.Contains(err.Error(), secret) {
		t.Fatalf("transport failure must not leak secret, got %q", err.Error())
	}
}

func TestProbeBillingPreservesExplicitFreeObservation(t *testing.T) {
	cred := Credential{AccessToken: "access-secret", TokenType: "Bearer"}
	doer := doerFunc(func(req *http.Request) (*http.Response, error) {
		switch req.URL.RequestURI() {
		case BillingMonthlyPath:
			return jsonResponse(200, `{"plan":"free","monthlyLimit":0}`), nil
		case BillingWeeklyCreditsPath:
			return jsonResponse(200, `{}`), nil
		default:
			return nil, fmt.Errorf("unexpected path %s", req.URL.RequestURI())
		}
	})

	got, err := ProbeBilling(context.Background(), doer, cred)
	if err != nil {
		t.Fatalf("explicit free observation should be preserved, got err %v", err)
	}
	if got.Plan != "free" || got.Monthly.StatusCode != 200 || got.Weekly.StatusCode != 200 {
		t.Fatalf("free snapshot not preserved: %+v", got)
	}
	if err := EvaluateMediaEligibility(mustBillingSnapshotJSON(t, got), 2000000000, 2000000000); !errors.Is(err, ErrMediaSubscriptionRequired) {
		t.Fatalf("free billing snapshot must deny media, got %v", err)
	}
}

func mustBillingSnapshotJSON(t *testing.T, snapshot BillingProbeSnapshot) string {
	t.Helper()
	b, err := json.Marshal(snapshot)
	if err != nil {
		t.Fatalf("marshal snapshot: %v", err)
	}
	return string(b)
}
