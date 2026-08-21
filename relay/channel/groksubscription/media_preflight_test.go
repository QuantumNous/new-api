package groksubscription

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func setupMediaPreflightTestDB(t *testing.T) {
	t.Helper()
	originalDB := model.DB
	originalSQLite := common.UsingSQLite
	common.UsingSQLite = true
	db, err := gorm.Open(sqlite.Open(t.TempDir()+"/media-preflight.db"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.Channel{}, &model.Ability{}, &model.GrokChannelState{}))
	model.DB = db
	t.Cleanup(func() {
		model.DB = originalDB
		common.UsingSQLite = originalSQLite
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
}

func seedMediaPreflightChannel(t *testing.T, expiresAt int64) int {
	t.Helper()
	cred := Credential{Version: 1, Type: CredentialType, AccessToken: "old-at", RefreshToken: "rt", TokenType: "Bearer", ExpiresAt: expiresAt}
	key, err := cred.Serialize()
	require.NoError(t, err)
	ch := model.Channel{
		Type:   constant.ChannelTypeGrokSubscription,
		Key:    key,
		Models: "grok-4.6",
		Group:  "default",
		Status: common.ChannelStatusEnabled,
	}
	require.NoError(t, ch.Insert())
	require.NoError(t, model.UpsertGrokChannelState(&model.GrokChannelState{ChannelID: ch.Id, AuthStatus: model.GrokAuthStatusActive}))
	return ch.Id
}

func TestEnsureMediaCredentialRefreshesAndProbesBeforePaidWrite(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 2000+int64(MediaCredentialExpirySafetyWindow/time.Second)-1)

	var tokenRefreshes, billingCalls int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.String() == OAuthToken:
				tokenRefreshes++
				return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"rt2","token_type":"Bearer","expires_in":7200}`), nil
			case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
				billingCalls++
				require.Equal(t, "Bearer new-at", req.Header.Get("Authorization"))
				return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
			case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
				billingCalls++
				require.Equal(t, "Bearer new-at", req.Header.Get("Authorization"))
				return jsonResponse(http.StatusServiceUnavailable, `{}`), nil
			default:
				t.Fatalf("unexpected upstream request: %s", req.URL.String())
				return nil, nil
			}
		}),
	})
	defer restore()

	got, err := EnsureMediaCredential(context.Background(), channelID, true)

	require.NoError(t, err)
	require.Equal(t, MediaCredential{ChannelID: channelID, AccessToken: "new-at"}, got)
	require.Equal(t, 1, tokenRefreshes)
	require.Equal(t, 2, billingCalls)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(2000), st.BillingObservedAt)
	require.Contains(t, st.QuotaSnapshot, `"version":1`)
	require.Equal(t, "SuperGrok", st.BillingPlan)
	var mediaCount int64
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ? AND model IN ?", channelID, model.GrokMediaAbilityModels()).Count(&mediaCount).Error)
	require.Equal(t, int64(3), mediaCount)
}

func TestEnsureMediaCredentialReadDoesNotDenyStaleBilling(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Where("channel_id = ?", channelID).Updates(map[string]any{
		"quota_snapshot":      `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
		"billing_observed_at": 1,
	}).Error)
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			t.Fatalf("read preflight with non-expiring token must not call upstream, got %s", req.URL.String())
			return nil, nil
		}),
	})
	defer restore()

	got, err := EnsureMediaCredential(context.Background(), channelID, false)

	require.NoError(t, err)
	require.Equal(t, "old-at", got.AccessToken)
}

func TestForceRefreshMediaCredentialRefreshesWithoutBillingProbe(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	var tokenRefreshes int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.String() != OAuthToken {
				t.Fatalf("forced polling refresh must not probe billing, got %s", req.URL.String())
			}
			tokenRefreshes++
			return jsonResponse(http.StatusOK, `{"access_token":"forced-at","refresh_token":"forced-rt","token_type":"Bearer","expires_in":7200}`), nil
		}),
	})
	defer restore()

	got, err := ForceRefreshMediaCredential(context.Background(), channelID)

	require.NoError(t, err)
	require.Equal(t, MediaCredential{ChannelID: channelID, AccessToken: "forced-at"}, got)
	require.Equal(t, 1, tokenRefreshes)
}

func TestForceRefreshMediaCredentialWaiterDoesNotReturnStaleCredentialOrRefreshAgain(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	const now = int64(2000)
	acquired, err := model.AcquireGrokRefreshLease(channelID, "slow-winner", now, 30)
	require.NoError(t, err)
	require.True(t, acquired)

	var sleeps, tokenRefreshes int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return now },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			tokenRefreshes++
			return jsonResponse(http.StatusOK, `{"access_token":"duplicate-at","refresh_token":"duplicate-rt","token_type":"Bearer","expires_in":7200}`), nil
		}),
		Sleep: func(ctx context.Context, d time.Duration) error {
			sleeps++
			return nil
		},
	})
	defer restore()

	got, err := ForceRefreshMediaCredential(context.Background(), channelID)

	require.ErrorIs(t, err, ErrRefreshConflict)
	require.Empty(t, got.AccessToken)
	require.Equal(t, 0, tokenRefreshes, "waiter must not run a duplicate forced refresh")
	require.GreaterOrEqual(t, sleeps, int(mediaPreflightMaxWait/mediaPreflightWaitInterval))
	cred, err := loadMediaCredential(context.Background(), channelID)
	require.NoError(t, err)
	require.Equal(t, "old-at", cred.AccessToken)
}

func TestEnsureMediaCredentialProbeFailurePreservesSnapshotAndReturnsUnavailable(t *testing.T) {
	setupMediaPreflightTestDB(t)
	now := int64(2000 + billingMaxEvidenceAge + 1)
	channelID := seedMediaPreflightChannel(t, now+3600)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Where("channel_id = ?", channelID).Updates(map[string]any{
		"quota_snapshot":      `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
		"billing_observed_at": 100,
		"billing_plan":        "SuperGrok",
	}).Error)
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return now },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			return nil, errors.New("network down")
		}),
	})
	defer restore()

	_, err := EnsureMediaCredential(context.Background(), channelID, true)

	require.ErrorIs(t, err, ErrBillingProbeFailed)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(100), st.BillingObservedAt)
	require.Equal(t, "SuperGrok", st.BillingPlan)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)
}

func TestForceRefreshMediaCredentialTransportErrorDoesNotMarkNeedsReauth(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.String() != OAuthToken {
				t.Fatalf("transport error path must only hit token endpoint, got %s", req.URL.String())
			}
			return nil, errors.New("transient refresh error")
		}),
	})
	defer restore()

	_, err := ForceRefreshMediaCredential(context.Background(), channelID)

	require.Error(t, err)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusActive, st.AuthStatus)
	require.Empty(t, st.LastError)
}

func TestForceRefreshMediaCredentialUnauthorizedMarksNeedsReauth(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			if req.URL.String() != OAuthToken {
				t.Fatalf("unauthorized path must only hit token endpoint, got %s", req.URL.String())
			}
			return jsonResponse(http.StatusUnauthorized, `{"error":"invalid_grant"}`), nil
		}),
	})
	defer restore()

	_, err := ForceRefreshMediaCredential(context.Background(), channelID)

	require.Error(t, err)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, model.GrokAuthStatusNeedsReauth, st.AuthStatus)
	require.NotEmpty(t, st.LastError)
}

func TestMediaRefreshShouldMarkNeedsReauthOnlyForDefinitiveAuthFailures(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{name: "missing refresh token", err: ErrNotRefreshable, want: true},
		{name: "token endpoint 401", err: RefreshHTTPStatusError{StatusCode: http.StatusUnauthorized}, want: true},
		{name: "token endpoint 403", err: RefreshHTTPStatusError{StatusCode: http.StatusForbidden}, want: true},
		{name: "transport error", err: errors.New("dial tcp: transient network failure"), want: false},
		{name: "token endpoint 500", err: RefreshHTTPStatusError{StatusCode: http.StatusInternalServerError}, want: false},
		{name: "cas conflict", err: ErrRefreshConflict, want: false},
		{name: "invalid token response", err: errors.New("grok refresh: invalid token response"), want: false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, mediaRefreshShouldMarkNeedsReauth(tt.err))
		})
	}
}

func TestRefreshMediaBillingStatusWithHTTPDoerProbesBillingEvenWhenCredentialFresh(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 2000+int64(MediaCredentialExpirySafetyWindow/time.Second)-1)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Where("channel_id = ?", channelID).Updates(map[string]any{
		"quota_snapshot":      `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200,"used_percent":12.5}}`,
		"billing_observed_at": 2000,
	}).Error)

	var tokenRefreshes, billingCalls int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.String() == OAuthToken:
				tokenRefreshes++
				return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"rt2","token_type":"Bearer","expires_in":7200}`), nil
			case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
				billingCalls++
				return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
			case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
				billingCalls++
				return jsonResponse(http.StatusOK, `{"usagePercent":12.5}`), nil
			default:
				t.Fatalf("unexpected upstream request: %s", req.URL.String())
				return nil, nil
			}
		}),
	})
	defer restore()

	got := RefreshMediaBillingStatusWithHTTPDoer(context.Background(), channelID, doerFunc(func(req *http.Request) (*http.Response, error) {
		switch {
		case req.URL.String() == OAuthToken:
			tokenRefreshes++
			return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"rt2","token_type":"Bearer","expires_in":7200}`), nil
		case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
			billingCalls++
			return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
		case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
			billingCalls++
			return jsonResponse(http.StatusOK, `{"usagePercent":12.5}`), nil
		default:
			t.Fatalf("unexpected upstream request: %s", req.URL.String())
			return nil, nil
		}
	}))

	require.Equal(t, BillingStatusEligible, got)
	require.Equal(t, 1, tokenRefreshes)
	require.Equal(t, 2, billingCalls)
}

func TestRefreshMediaBillingStatusWithHTTPDoerIgnoresCachedBillingSnapshot(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 4000)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Where("channel_id = ?", channelID).Updates(map[string]any{
		"quota_snapshot":      `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200,"used_percent":12.5}}`,
		"billing_observed_at": 2000,
	}).Error)

	var tokenRefreshes, billingCalls int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case req.URL.String() == OAuthToken:
				tokenRefreshes++
				return jsonResponse(http.StatusOK, `{"access_token":"new-at","refresh_token":"rt2","token_type":"Bearer","expires_in":7200}`), nil
			case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
				billingCalls++
				return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
			case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
				billingCalls++
				return jsonResponse(http.StatusOK, `{"usagePercent":12.5}`), nil
			default:
				t.Fatalf("unexpected upstream request: %s", req.URL.String())
				return nil, nil
			}
		}),
	})
	defer restore()

	got := RefreshMediaBillingStatusWithHTTPDoer(context.Background(), channelID, nil)

	require.Equal(t, BillingStatusEligible, got)
	require.Zero(t, tokenRefreshes)
	require.Equal(t, 2, billingCalls)
}

func TestRefreshMediaBillingStatusReplacesCachedSnapshotInSameDatabaseSecond(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 5000)
	require.NoError(t, model.DB.Model(&model.GrokChannelState{}).Where("channel_id = ?", channelID).Updates(map[string]any{
		"quota_snapshot":      `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200,"monthly_limit_cents":15000},"weekly":{"status_code":200,"usage_percent":12.5}}`,
		"billing_plan":        "SuperGrok",
		"billing_observed_at": 2000,
	}).Error)

	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
	})
	defer restore()

	got := RefreshMediaBillingStatusWithHTTPDoer(context.Background(), channelID, doerFunc(func(req *http.Request) (*http.Response, error) {
		switch {
		case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
			return jsonResponse(http.StatusOK, `{"plan":"free","monthlyLimit":0}`), nil
		case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
			return jsonResponse(http.StatusOK, `{}`), nil
		default:
			t.Fatalf("unexpected upstream request: %s", req.URL.String())
			return nil, nil
		}
	}))

	require.Equal(t, BillingStatusIneligible, got)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Equal(t, int64(2000), st.BillingObservedAt)
	require.Equal(t, "free", st.BillingPlan)
	require.ErrorIs(t, EvaluateMediaEligibility(st.QuotaSnapshot, st.BillingObservedAt, 2000), ErrMediaSubscriptionRequired)
}

func TestEnsureMediaCredentialDoesNotSyncAbilitiesFromUnsavedProbe(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 5000)
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return 2000 },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
				return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
			case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
				return jsonResponse(http.StatusServiceUnavailable, `{}`), nil
			default:
				t.Fatalf("unexpected upstream request: %s", req.URL.String())
				return nil, nil
			}
		}),
	})
	defer restore()

	_, err := ensureMediaCredentialWithLease(context.Background(), channelID, true, "owner-that-does-not-own-lease", mediaPreflightHooks)

	require.ErrorIs(t, err, ErrRefreshConflict)
	st, err := model.GetGrokChannelState(channelID)
	require.NoError(t, err)
	require.Zero(t, st.BillingObservedAt)
	var mediaCount int64
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ? AND model IN ?", channelID, model.GrokMediaAbilityModels()).Count(&mediaCount).Error)
	require.Zero(t, mediaCount)
}

func TestEnsureMediaCredentialDoesNotSaveProbeAfterLeaseExpires(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 5000)
	var nowCalls int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 {
			nowCalls++
			if nowCalls >= 4 {
				return 2031
			}
			return 2000
		},
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			switch {
			case strings.HasSuffix(req.URL.Path, BillingMonthlyPath):
				return jsonResponse(http.StatusOK, `{"monthlyLimit":15000}`), nil
			case strings.HasSuffix(req.URL.Path, BillingWeeklyCreditsPath):
				return jsonResponse(http.StatusOK, `{"usagePercent":12.5}`), nil
			default:
				t.Fatalf("unexpected upstream request: %s", req.URL.String())
				return nil, nil
			}
		}),
	})
	defer restore()

	_, err := EnsureMediaCredential(context.Background(), channelID, true)

	require.ErrorIs(t, err, ErrRefreshConflict)
	st, stateErr := model.GetGrokChannelState(channelID)
	require.NoError(t, stateErr)
	require.Zero(t, st.BillingObservedAt)
}

func TestEnsureMediaCredentialLosingWorkerWaitsAndReloadsPersistedEvidence(t *testing.T) {
	setupMediaPreflightTestDB(t)
	channelID := seedMediaPreflightChannel(t, 5000)
	const now = int64(2000)
	acquired, err := model.AcquireGrokRefreshLease(channelID, "winner", now, 30)
	require.NoError(t, err)
	require.True(t, acquired)

	var sleeps int
	restore := SetMediaPreflightHooksForTest(MediaPreflightHooks{
		Now: func(context.Context) int64 { return now },
		HTTPDoer: doerFunc(func(req *http.Request) (*http.Response, error) {
			t.Fatalf("losing worker must reload winner evidence instead of probing, got %s", req.URL.String())
			return nil, nil
		}),
		Sleep: func(ctx context.Context, d time.Duration) error {
			sleeps++
			wrote, err := model.SaveGrokBillingObservationAt(channelID, "winner", now, model.GrokBillingObservation{
				ObservedAt:    now,
				BillingPlan:   "SuperGrok",
				QuotaSnapshot: `{"version":1,"plan":"SuperGrok","monthly":{"status_code":200},"weekly":{"status_code":503}}`,
			})
			require.NoError(t, err)
			require.True(t, wrote)
			require.NoError(t, model.ReleaseGrokRefreshLease(channelID, "winner"))
			return nil
		},
	})
	defer restore()

	got, err := EnsureMediaCredential(context.Background(), channelID, true)

	require.NoError(t, err)
	require.Equal(t, MediaCredential{ChannelID: channelID, AccessToken: "old-at"}, got)
	require.Equal(t, 1, sleeps)
	var mediaCount int64
	require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ? AND model IN ?", channelID, model.GrokMediaAbilityModels()).Count(&mediaCount).Error)
	require.Equal(t, int64(3), mediaCount)
}
