package groksubscription

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"time"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const (
	MediaCredentialExpirySafetyWindow = 5 * time.Minute
	mediaPreflightLeaseTTLSeconds     = 30
	mediaPreflightWaitInterval        = 100 * time.Millisecond
	mediaPreflightMaxWait             = 2 * time.Second
)

const (
	BillingStatusEligible    = "eligible"
	BillingStatusIneligible  = "ineligible"
	BillingStatusUnavailable = "unavailable"
)

type MediaCredential struct {
	ChannelID   int
	AccessToken string
}

type MediaPreflightHooks struct {
	Now      func(context.Context) int64
	HTTPDoer HTTPDoer
	Sleep    func(context.Context, time.Duration) error
}

var mediaPreflightHooks = MediaPreflightHooks{
	Now: func(ctx context.Context) int64 {
		now, err := model.GetDBTimestampWithContext(ctx)
		if err != nil {
			return 0
		}
		return now
	},
	HTTPDoer: &http.Client{Timeout: 30 * time.Second},
	Sleep: func(ctx context.Context, d time.Duration) error {
		timer := time.NewTimer(d)
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
			return nil
		}
	},
}

func SetMediaPreflightHooksForTest(hooks MediaPreflightHooks) func() {
	original := mediaPreflightHooks
	if hooks.Now != nil {
		mediaPreflightHooks.Now = hooks.Now
	}
	if hooks.HTTPDoer != nil {
		mediaPreflightHooks.HTTPDoer = hooks.HTTPDoer
	}
	if hooks.Sleep != nil {
		mediaPreflightHooks.Sleep = hooks.Sleep
	}
	return func() { mediaPreflightHooks = original }
}

func EnsureMediaCredential(ctx context.Context, channelID int, requirePaid bool) (MediaCredential, error) {
	return ensureMediaCredential(ctx, channelID, requirePaid, mediaPreflightHooks)
}

func ForceRefreshMediaCredential(ctx context.Context, channelID int) (MediaCredential, error) {
	return forceRefreshMediaCredential(ctx, channelID, mediaPreflightHooks)
}

func forceRefreshMediaCredential(ctx context.Context, channelID int, hooks MediaPreflightHooks) (MediaCredential, error) {
	if ctx == nil {
		return MediaCredential{}, errors.New("grok media preflight: context is nil")
	}
	if channelID <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: invalid channel id")
	}
	startingCred, err := loadMediaCredential(ctx, channelID)
	if err != nil {
		return MediaCredential{}, err
	}
	for waited := time.Duration(0); ; waited += mediaPreflightWaitInterval {
		hooks = normalizeMediaPreflightHooks(hooks)
		now := hooks.Now(ctx)
		if now <= 0 {
			return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
		}
		currentCred, err := loadMediaCredential(ctx, channelID)
		if err != nil {
			return MediaCredential{}, err
		}
		if currentCred != startingCred {
			return MediaCredential{ChannelID: channelID, AccessToken: currentCred.AccessToken}, nil
		}
		owner := "media-force-refresh:" + common.GetUUID()
		acquired, err := model.AcquireGrokRefreshLease(channelID, owner, now, mediaPreflightLeaseTTLSeconds)
		if err != nil {
			return MediaCredential{}, err
		}
		if acquired {
			defer func() { _ = model.ReleaseGrokRefreshLease(channelID, owner) }()
			refresher := NewRefresher(newMediaCredentialStore(), hooks.HTTPDoer, func() int64 { return now })
			cred, err := refresher.Refresh(ctx, channelID)
			if err != nil {
				if mediaRefreshShouldMarkNeedsReauth(err) {
					_ = markGrokAuthStatus(channelID, model.GrokAuthStatusNeedsReauth, false, err.Error())
				}
				return MediaCredential{}, err
			}
			_ = markGrokAuthStatus(channelID, model.GrokAuthStatusActive, true, "")
			return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
		}
		if waited >= mediaPreflightMaxWait {
			return MediaCredential{}, ErrRefreshConflict
		}
		if err := hooks.Sleep(ctx, mediaPreflightWaitInterval); err != nil {
			return MediaCredential{}, err
		}
	}
}

func ensureMediaCredential(ctx context.Context, channelID int, requirePaid bool, hooks MediaPreflightHooks) (MediaCredential, error) {
	if ctx == nil {
		return MediaCredential{}, errors.New("grok media preflight: context is nil")
	}
	if channelID <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: invalid channel id")
	}
	for waited := time.Duration(0); ; waited += mediaPreflightWaitInterval {
		hooks = normalizeMediaPreflightHooks(hooks)
		now := hooks.Now(ctx)
		if now <= 0 {
			return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
		}
		cred, _, needsLease, terminalErr, err := inspectMediaCredential(ctx, channelID, requirePaid, now)
		if err != nil {
			return MediaCredential{}, err
		}
		if terminalErr != nil {
			return MediaCredential{}, terminalErr
		}
		if !needsLease {
			return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
		}

		owner := "media-preflight:" + common.GetUUID()
		acquired, err := model.AcquireGrokRefreshLease(channelID, owner, now, mediaPreflightLeaseTTLSeconds)
		if err != nil {
			return MediaCredential{}, err
		}
		if acquired {
			return ensureMediaCredentialWithLease(ctx, channelID, requirePaid, owner, hooks)
		}
		if waited >= mediaPreflightMaxWait {
			return MediaCredential{}, ErrRefreshConflict
		}
		if err := hooks.Sleep(ctx, mediaPreflightWaitInterval); err != nil {
			return MediaCredential{}, err
		}
	}
}

func normalizeMediaPreflightHooks(hooks MediaPreflightHooks) MediaPreflightHooks {
	if hooks.Now == nil {
		hooks.Now = mediaPreflightHooks.Now
	}
	if hooks.HTTPDoer == nil {
		hooks.HTTPDoer = mediaPreflightHooks.HTTPDoer
	}
	if hooks.Sleep == nil {
		hooks.Sleep = mediaPreflightHooks.Sleep
	}
	return hooks
}

func inspectMediaCredential(ctx context.Context, channelID int, requirePaid bool, now int64) (Credential, *model.GrokChannelState, bool, error, error) {
	cred, err := loadMediaCredential(ctx, channelID)
	if err != nil {
		return Credential{}, nil, false, nil, err
	}
	if mediaCredentialNeedsRefresh(cred, now, requirePaid) {
		return cred, nil, true, nil, nil
	}
	st, stateErr := model.GetGrokChannelState(channelID)
	if stateErr != nil && !errors.Is(stateErr, gorm.ErrRecordNotFound) {
		return Credential{}, nil, false, nil, stateErr
	}
	if !requirePaid {
		return cred, st, false, nil, nil
	}
	if st != nil {
		eligibilityErr := EvaluateMediaEligibility(st.QuotaSnapshot, st.BillingObservedAt, now)
		if eligibilityErr == nil {
			if err := model.SyncGrokMediaAbilities(channelID, true); err != nil {
				return Credential{}, nil, false, nil, err
			}
			return cred, st, false, nil, nil
		}
		if errors.Is(eligibilityErr, ErrMediaSubscriptionRequired) {
			if err := model.SyncGrokMediaAbilities(channelID, false); err != nil {
				return Credential{}, nil, false, nil, err
			}
			return cred, st, false, ErrMediaSubscriptionRequired, nil
		}
	}
	return cred, st, true, nil, nil
}

func ensureMediaCredentialWithLease(ctx context.Context, channelID int, requirePaid bool, owner string, hooks MediaPreflightHooks) (MediaCredential, error) {
	return ensureMediaCredentialWithLeaseOptions(ctx, channelID, requirePaid, owner, hooks, true, false)
}

func ensureMediaCredentialWithLeaseOptions(ctx context.Context, channelID int, requirePaid bool, owner string, hooks MediaPreflightHooks, allowCachedBilling bool, forceRefresh bool) (MediaCredential, error) {
	defer func() { _ = model.ReleaseGrokRefreshLease(channelID, owner) }()

	now := hooks.Now(ctx)
	if now <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
	}
	// A forced billing refresh must inspect only credential freshness. Looking
	// at the cached paid eligibility here could return an old ineligible result
	// before the new ProbeBilling evidence has a chance to replace it.
	inspectRequirePaid := requirePaid && allowCachedBilling
	cred, st, _, terminalErr, err := inspectMediaCredential(ctx, channelID, inspectRequirePaid, now)
	if err != nil {
		return MediaCredential{}, err
	}
	if terminalErr != nil {
		return MediaCredential{}, terminalErr
	}

	if forceRefresh || mediaCredentialNeedsRefresh(cred, now, requirePaid) {
		refresher := NewRefresher(newMediaCredentialStore(), hooks.HTTPDoer, func() int64 { return now })
		cred, err = refresher.Refresh(ctx, channelID)
		if err != nil {
			if mediaRefreshShouldMarkNeedsReauth(err) {
				_ = markGrokAuthStatus(channelID, model.GrokAuthStatusNeedsReauth, false, err.Error())
			}
			return MediaCredential{}, err
		}
		_ = markGrokAuthStatus(channelID, model.GrokAuthStatusActive, true, "")
	}

	if !requirePaid {
		return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
	}

	now = hooks.Now(ctx)
	if now <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
	}
	st, err = model.GetGrokChannelState(channelID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return MediaCredential{}, err
	}
	if allowCachedBilling && st != nil {
		if eligibilityErr := EvaluateMediaEligibility(st.QuotaSnapshot, st.BillingObservedAt, now); eligibilityErr == nil {
			if err := model.SyncGrokMediaAbilities(channelID, true); err != nil {
				return MediaCredential{}, err
			}
			return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
		} else if errors.Is(eligibilityErr, ErrMediaSubscriptionRequired) {
			if err := model.SyncGrokMediaAbilities(channelID, false); err != nil {
				return MediaCredential{}, err
			}
			return MediaCredential{}, ErrMediaSubscriptionRequired
		}
	}

	snapshot, err := ProbeBilling(ctx, hooks.HTTPDoer, cred)
	if err != nil {
		return MediaCredential{}, ErrBillingProbeFailed
	}
	snapshotJSON, err := json.Marshal(snapshot)
	if err != nil {
		return MediaCredential{}, err
	}
	// Billing probes can be slow enough to cross the lease TTL. Re-read the
	// database clock immediately before the CAS so an expired worker cannot
	// publish evidence after another worker is entitled to take over.
	now = hooks.Now(ctx)
	if now <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
	}
	observation := model.GrokBillingObservation{
		ObservedAt:    now,
		BillingPlan:   snapshot.Plan,
		TierRaw:       snapshot.Tier,
		QuotaSnapshot: string(snapshotJSON),
	}
	wrote, err := model.SaveGrokBillingObservationAt(channelID, owner, now, observation)
	if err != nil {
		return MediaCredential{}, err
	}
	if !wrote {
		if err := syncGrokMediaAbilitiesFromPersistedEvidence(channelID, now); err != nil {
			return MediaCredential{}, err
		}
		return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
	}
	if eligibilityErr := EvaluateMediaEligibility(observation.QuotaSnapshot, observation.ObservedAt, now); eligibilityErr != nil {
		if errors.Is(eligibilityErr, ErrMediaSubscriptionRequired) {
			if err := model.SyncGrokMediaAbilities(channelID, false); err != nil {
				return MediaCredential{}, err
			}
		}
		return MediaCredential{}, eligibilityErr
	}
	if err := model.SyncGrokMediaAbilities(channelID, true); err != nil {
		return MediaCredential{}, err
	}
	return MediaCredential{ChannelID: channelID, AccessToken: cred.AccessToken}, nil
}

func syncGrokMediaAbilitiesFromPersistedEvidence(channelID int, now int64) error {
	st, err := model.GetGrokChannelState(channelID)
	if err != nil {
		return ErrRefreshConflict
	}
	eligibilityErr := EvaluateMediaEligibility(st.QuotaSnapshot, st.BillingObservedAt, now)
	switch {
	case eligibilityErr == nil:
		return model.SyncGrokMediaAbilities(channelID, true)
	case errors.Is(eligibilityErr, ErrMediaSubscriptionRequired):
		if err := model.SyncGrokMediaAbilities(channelID, false); err != nil {
			return err
		}
		return ErrMediaSubscriptionRequired
	default:
		return ErrRefreshConflict
	}
}

func RefreshMediaBillingStatus(ctx context.Context, channelID int) string {
	return RefreshMediaBillingStatusWithHTTPDoer(ctx, channelID, nil)
}

func RefreshMediaBillingStatusWithHTTPDoer(ctx context.Context, channelID int, doer HTTPDoer) string {
	hooks := mediaPreflightHooks
	if doer != nil {
		hooks.HTTPDoer = doer
	}
	_, err := refreshMediaBillingStatus(ctx, channelID, hooks)
	switch {
	case err == nil:
		return BillingStatusEligible
	case errors.Is(err, ErrMediaSubscriptionRequired):
		return BillingStatusIneligible
	default:
		return BillingStatusUnavailable
	}
}

func refreshMediaBillingStatus(ctx context.Context, channelID int, hooks MediaPreflightHooks) (MediaCredential, error) {
	if ctx == nil {
		return MediaCredential{}, errors.New("grok media preflight: context is nil")
	}
	if channelID <= 0 {
		return MediaCredential{}, errors.New("grok media preflight: invalid channel id")
	}
	for waited := time.Duration(0); ; waited += mediaPreflightWaitInterval {
		hooks = normalizeMediaPreflightHooks(hooks)
		now := hooks.Now(ctx)
		if now <= 0 {
			return MediaCredential{}, errors.New("grok media preflight: database time unavailable")
		}
		owner := "media-refresh-status:" + common.GetUUID()
		acquired, err := model.AcquireGrokRefreshLease(channelID, owner, now, mediaPreflightLeaseTTLSeconds)
		if err != nil {
			return MediaCredential{}, err
		}
		if acquired {
			// Manual billing refresh must bypass the cached observation, but does
			// not needlessly rotate a still-valid OAuth credential. The lease and
			// the credential-needs-refresh check ensure a waiter cannot probe with
			// a stale token after another worker wins a refresh.
			return ensureMediaCredentialWithLeaseOptions(ctx, channelID, true, owner, hooks, false, false)
		}
		if waited >= mediaPreflightMaxWait {
			return MediaCredential{}, ErrRefreshConflict
		}
		if err := hooks.Sleep(ctx, mediaPreflightWaitInterval); err != nil {
			return MediaCredential{}, err
		}
	}
}

func mediaCredentialNeedsRefresh(cred Credential, now int64, requirePaid bool) bool {
	if cred.ExpiresAt <= now {
		return true
	}
	return requirePaid && cred.ExpiresAt <= now+int64(MediaCredentialExpirySafetyWindow/time.Second)
}

func loadMediaCredential(ctx context.Context, channelID int) (Credential, error) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return Credential{}, err
	}
	if ch.Type != constant.ChannelTypeGrokSubscription {
		return Credential{}, fmt.Errorf("grok media preflight: channel %d is not Grok subscription", channelID)
	}
	return ParseCredential(ch.Key)
}

type mediaCredentialStore struct {
	keys      map[int]string
	revisions map[int]int
}

func newMediaCredentialStore() *mediaCredentialStore {
	return &mediaCredentialStore{keys: map[int]string{}, revisions: map[int]int{}}
}

func (s *mediaCredentialStore) Load(ctx context.Context, channelID int) (string, int, error) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return "", 0, err
	}
	if ch.Type != constant.ChannelTypeGrokSubscription {
		return "", 0, fmt.Errorf("grok media preflight: channel %d is not Grok subscription", channelID)
	}
	s.revisions[channelID]++
	s.keys[channelID] = ch.Key
	return ch.Key, s.revisions[channelID], nil
}

func (s *mediaCredentialStore) CompareAndSwap(ctx context.Context, channelID, expectedRevision int, newKey string) (bool, error) {
	if s.revisions[channelID] != expectedRevision {
		return false, nil
	}
	oldKey, ok := s.keys[channelID]
	if !ok {
		return false, nil
	}
	return model.CompareAndSwapChannelKey(channelID, constant.ChannelTypeGrokSubscription, oldKey, newKey)
}

func mediaRefreshShouldMarkNeedsReauth(err error) bool {
	if err == nil || errors.Is(err, ErrRefreshConflict) {
		return false
	}
	if errors.Is(err, ErrNotRefreshable) {
		return true
	}
	var statusErr RefreshHTTPStatusError
	if errors.As(err, &statusErr) {
		return statusErr.StatusCode == http.StatusUnauthorized || statusErr.StatusCode == http.StatusForbidden
	}
	return false
}

func markGrokAuthStatus(channelID int, status string, markRefreshed bool, lastErr string) error {
	st := &model.GrokChannelState{ChannelID: channelID, AuthStatus: status}
	existing, err := model.GetGrokChannelState(channelID)
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if existing != nil {
		st.BillingPlan = existing.BillingPlan
		st.TierRaw = existing.TierRaw
		st.QuotaSnapshot = existing.QuotaSnapshot
		st.BillingObservedAt = existing.BillingObservedAt
		st.RefreshLeaseOwner = existing.RefreshLeaseOwner
		st.RefreshLeaseExpiresAt = existing.RefreshLeaseExpiresAt
		st.LastRefreshAt = existing.LastRefreshAt
		st.LastError = existing.LastError
		st.CreatedAt = existing.CreatedAt
	}
	if markRefreshed {
		st.LastRefreshAt = model.GetDBTimestamp()
	}
	if status == model.GrokAuthStatusActive {
		st.LastError = ""
	} else if lastErr != "" {
		st.LastError = truncateMediaPreflightString(lastErr, 512)
	}
	return model.UpsertGrokChannelState(st)
}

func truncateMediaPreflightString(s string, limit int) string {
	if len(s) <= limit {
		return s
	}
	cut := s[:limit]
	for len(cut) > 0 && !utf8.ValidString(cut) {
		cut = cut[:len(cut)-1]
	}
	return cut
}
