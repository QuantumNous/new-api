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
			name:       "usage percent grants media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}, Weekly: BillingWindowSnapshot{StatusCode: 503}}),
			observedAt: now,
		},
		{
			name:       "derived used percent grants media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 200, UsedPercent: &used}, Weekly: BillingWindowSnapshot{StatusCode: 503}}),
			observedAt: now,
		},
		{
			name:       "partial weekly success with monthly failure grants media",
			snapshot:   mustBillingSnapshotJSON(t, BillingProbeSnapshot{Version: 1, Monthly: BillingWindowSnapshot{StatusCode: 500}, Weekly: BillingWindowSnapshot{StatusCode: 200, UsagePercent: &usage}}),
			observedAt: now,
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
