package model

import (
	"errors"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestAPIIdempotencySchemaScopesKeyByUserRouteAndHash(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)

	first := APIIdempotencyRecord{
		UserId: 7, Route: "/v1/byteplus/real-person/profiles", KeyHash: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		RequestHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Status:      APIIdempotencyStatusProcessing,
	}
	require.NoError(t, db.Create(&first).Error)

	sameKeyDifferentRoute := APIIdempotencyRecord{
		UserId: 7, Route: "/v1/byteplus/visual-validation/sessions", KeyHash: first.KeyHash,
		RequestHash: first.RequestHash, Status: APIIdempotencyStatusReceiving,
	}
	require.NoError(t, db.Create(&sameKeyDifferentRoute).Error)

	duplicate := APIIdempotencyRecord{
		UserId: 7, Route: first.Route, KeyHash: first.KeyHash,
		RequestHash: first.RequestHash, Status: APIIdempotencyStatusReceiving,
	}
	require.Error(t, db.Create(&duplicate).Error)
}

func TestAPIIdempotencyPublicContractAliases(t *testing.T) {
	require.Equal(t, "verification_session", APIIdempotencyResourceTypeVerificationSession)
	require.Equal(t, "asset", APIIdempotencyResourceTypeAsset)
	require.Equal(t, APIIdempotencyResourceTypeVerificationSession, APIIdempotencyResourceVerificationSession)
	require.Equal(t, APIIdempotencyResourceTypeAsset, APIIdempotencyResourceAsset)

	require.Equal(t, APIIdempotencyDecision("owner"), APIIdempotencyDecisionOwner)
	require.Equal(t, APIIdempotencyDecision("in_progress"), APIIdempotencyDecisionInProgress)
	require.Equal(t, APIIdempotencyDecision("resume"), APIIdempotencyDecisionResume)
	require.Equal(t, APIIdempotencyDecision("replay"), APIIdempotencyDecisionReplay)
	require.Equal(t, APIIdempotencyDecision("conflict"), APIIdempotencyDecisionConflict)
	require.Equal(t, APIIdempotencyDecision("outcome_unknown"), APIIdempotencyDecisionOutcomeUnknown)
	require.Equal(t, APIIdempotencyDecisionOwner, DecisionOwner)
	require.Equal(t, APIIdempotencyDecisionOutcomeUnknown, DecisionOutcomeUnknown)
}

func TestClaimAPIIdempotencyConcurrentOwnerExactlyOnce(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	var owners atomic.Int64
	var conflicts atomic.Int64
	var wg sync.WaitGroup
	errs := make(chan error, 12)
	for i := 0; i < 12; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			claim, err := ClaimAPIIdempotency(7, "/route", strings.Repeat("a", 64), strings.Repeat("b", 64), APIIdempotencyResourceVerificationSession, 100, 50, 1000)
			if err != nil {
				errs <- err
				return
			}
			if claim.Decision == DecisionOwner {
				owners.Add(1)
			} else {
				conflicts.Add(1)
			}
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	require.Equal(t, int64(1), owners.Load())
	require.Equal(t, int64(11), conflicts.Load())
}

func TestClaimAPIIdempotencyConflictOnDifferentRequestHash(t *testing.T) {
	newBytePlusRealPersonTestDB(t)
	first, err := ClaimAPIIdempotency(7, "/route", strings.Repeat("a", 64), strings.Repeat("b", 64), APIIdempotencyResourceAsset, 100, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionOwner, first.Decision)

	second, err := ClaimAPIIdempotency(7, "/route", strings.Repeat("a", 64), strings.Repeat("c", 64), APIIdempotencyResourceAsset, 101, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionConflict, second.Decision)
}

func TestClaimAPIIdempotencyStaleCallingUpstreamBecomesOutcomeUnknown(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusCallingUpstream, ResourceType: APIIdempotencyResourceVerificationSession, LeaseUpdatedTime: 10, ExpiresAt: 1000}
	require.NoError(t, db.Create(&record).Error)

	claim, err := ClaimAPIIdempotency(7, "/route", record.KeyHash, record.RequestHash, record.ResourceType, 100, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionOutcomeUnknown, claim.Decision)
	require.NotEqual(t, DecisionOwner, claim.Decision)
	require.NoError(t, db.First(&record, record.Id).Error)
	require.Equal(t, APIIdempotencyStatusOutcomeUnknown, record.Status)
}

func TestClaimAPIIdempotencyReplaysCompletedFailed(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	payload, err := common.Marshal(map[string]any{"id": "rvs_public", "status": "pending"})
	require.NoError(t, err)
	require.NotContains(t, string(payload), "verification_url")
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusCompleted, ResourceType: APIIdempotencyResourceVerificationSession, ResourcePublicId: "rvs_public", ResponseStatus: 200, ResponsePayload: string(payload), LeaseUpdatedTime: 100}
	require.NoError(t, db.Create(&record).Error)

	claim, err := ClaimAPIIdempotency(7, "/route", record.KeyHash, record.RequestHash, record.ResourceType, 101, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionReplay, claim.Decision)
	require.Equal(t, 200, claim.Record.ResponseStatus)
	require.NotContains(t, claim.Record.ResponsePayload, "verification_url")
}

func TestClaimAPIIdempotencyReplaysFailedPublicPayload(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	payload, err := common.Marshal(map[string]any{"id": "rvs_public", "status": "failed"})
	require.NoError(t, err)
	require.NotContains(t, string(payload), "verification_url")
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceVerificationSession, ResourcePublicId: "rvs_public", LeaseUpdatedTime: 100}
	require.NoError(t, db.Create(&record).Error)
	require.NoError(t, FailAPIIdempotency(record.Id, record.LeaseUpdatedTime, "rvs_public", 502, string(payload), 101))

	claim, err := ClaimAPIIdempotency(7, "/route", record.KeyHash, record.RequestHash, record.ResourceType, 102, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionReplay, claim.Decision)
	require.Equal(t, APIIdempotencyStatusFailed, claim.Record.Status)
	require.Equal(t, 502, claim.Record.ResponseStatus)
	require.NotContains(t, claim.Record.ResponsePayload, "verification_url")
}

func TestClaimAPIIdempotencyStaleProcessingWithResourceResumes(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	profile := BytePlusRealPersonProfile{PublicId: "rph_original", UserId: 7, Name: "p", Status: BytePlusRealPersonProfileStatusPendingVerification}
	require.NoError(t, db.Create(&profile).Error)
	session := BytePlusVisualValidationSession{PublicId: "rvs_original", ProfileId: profile.Id, Status: BytePlusVisualValidationSessionStatusPending}
	require.NoError(t, db.Create(&session).Error)
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceVerificationSession, ResourcePublicId: "rvs_original", LeaseUpdatedTime: 10}
	require.NoError(t, db.Create(&record).Error)

	claim, err := ClaimAPIIdempotency(7, "/route", record.KeyHash, record.RequestHash, record.ResourceType, 100, 50, 1000)
	require.NoError(t, err)
	require.Equal(t, DecisionResume, claim.Decision)
	require.Equal(t, APIIdempotencyResourceVerificationSession, claim.Record.ResourceType)
	require.Equal(t, "rvs_original", claim.Record.ResourcePublicId)
	var profiles, sessions int64
	require.NoError(t, db.Model(&BytePlusRealPersonProfile{}).Count(&profiles).Error)
	require.NoError(t, db.Model(&BytePlusVisualValidationSession{}).Count(&sessions).Error)
	require.Equal(t, int64(1), profiles)
	require.Equal(t, int64(1), sessions)
}

func TestDeleteExpiredSafeAPIIdempotencyRecordsOnlyDeletesTerminal(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	statuses := []string{APIIdempotencyStatusCompleted, APIIdempotencyStatusFailed, APIIdempotencyStatusReceiving, APIIdempotencyStatusProcessing, APIIdempotencyStatusCallingUpstream, APIIdempotencyStatusOutcomeUnknown}
	for i, status := range statuses {
		require.NoError(t, db.Create(&APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat(string(rune('a'+i)), 64), RequestHash: strings.Repeat("b", 64), Status: status, ExpiresAt: 10}).Error)
	}
	deleted, err := DeleteExpiredSafeAPIIdempotencyRecords(100, 10)
	require.NoError(t, err)
	require.Equal(t, 2, deleted)
	var remaining int64
	require.NoError(t, db.Model(&APIIdempotencyRecord{}).Count(&remaining).Error)
	require.Equal(t, int64(4), remaining)
}

func TestAPIIdempotencyStrictCASErrorRowsAffected(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceAsset, LeaseUpdatedTime: 100}
	require.NoError(t, db.Create(&record).Error)

	require.ErrorIs(t, db.Transaction(func(tx *gorm.DB) error {
		return BindAPIIdempotencyResourceTx(tx, record.Id, 99, "ast_1", 101)
	}), ErrAPIIdempotencyCASLost)
	require.ErrorIs(t, MarkAPIIdempotencyCallingUpstream(record.Id, 99, 101), ErrAPIIdempotencyCASLost)
	require.ErrorIs(t, CompleteAPIIdempotency(record.Id, 99, "ast_1", 200, "{}", 101), ErrAPIIdempotencyCASLost)
	require.ErrorIs(t, FailAPIIdempotency(record.Id, 99, "ast_1", 500, "{}", 101), ErrAPIIdempotencyCASLost)

	require.NoError(t, db.Model(&APIIdempotencyRecord{}).Where("id = ?", record.Id).Updates(map[string]any{"resource_public_id": "ast_original"}).Error)
	require.ErrorIs(t, CompleteAPIIdempotency(record.Id, 100, "ast_other", 200, "{}", 101), ErrAPIIdempotencyCASLost)
}

func TestBindAPIIdempotencyResourceTxRejectsBlankPublicID(t *testing.T) {
	for _, publicID := range []string{"", "   "} {
		t.Run("blank_"+strings.ReplaceAll(publicID, " ", "_"), func(t *testing.T) {
			db := newBytePlusRealPersonTestDB(t)
			record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceVerificationSession, LeaseUpdatedTime: 100}
			require.NoError(t, db.Create(&record).Error)

			err := db.Transaction(func(tx *gorm.DB) error {
				return BindAPIIdempotencyResourceTx(tx, record.Id, record.LeaseUpdatedTime, publicID, 101)
			})
			require.Error(t, err)
			require.NoError(t, db.First(&record, record.Id).Error)
			require.Empty(t, record.ResourcePublicId)
		})
	}
}

func TestBindAPIIdempotencyResourceTxBindsExactPublicID(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, ResourceType: APIIdempotencyResourceVerificationSession, LeaseUpdatedTime: 100}
	require.NoError(t, db.Create(&record).Error)

	require.NoError(t, db.Transaction(func(tx *gorm.DB) error {
		return BindAPIIdempotencyResourceTx(tx, record.Id, record.LeaseUpdatedTime, "rvs_exact", 101)
	}))
	require.NoError(t, db.First(&record, record.Id).Error)
	require.Equal(t, "rvs_exact", record.ResourcePublicId)
}

func TestCompleteFailAPIIdempotencyRejectUnsafeSourceStatuses(t *testing.T) {
	for _, status := range []string{
		APIIdempotencyStatusReceiving,
		APIIdempotencyStatusCompleted,
		APIIdempotencyStatusFailed,
		APIIdempotencyStatusOutcomeUnknown,
	} {
		t.Run(status, func(t *testing.T) {
			db := newBytePlusRealPersonTestDB(t)
			record := APIIdempotencyRecord{
				UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64),
				Status: status, ResourceType: APIIdempotencyResourceAsset, ResourcePublicId: "ast_original",
				ResponseStatus: 202, ResponsePayload: `{"id":"ast_original"}`, LeaseUpdatedTime: 100,
			}
			require.NoError(t, db.Create(&record).Error)

			require.ErrorIs(t, CompleteAPIIdempotency(record.Id, record.LeaseUpdatedTime, "ast_original", 200, `{"id":"ast_changed"}`, 101), ErrAPIIdempotencyCASLost)
			require.ErrorIs(t, FailAPIIdempotency(record.Id, record.LeaseUpdatedTime, "ast_original", 500, `{"id":"ast_failed"}`, 102), ErrAPIIdempotencyCASLost)
			require.NoError(t, db.First(&record, record.Id).Error)
			require.Equal(t, status, record.Status)
			require.Equal(t, 202, record.ResponseStatus)
			require.Equal(t, `{"id":"ast_original"}`, record.ResponsePayload)
			require.Equal(t, "ast_original", record.ResourcePublicId)
		})
	}
}

func TestCompleteFailAPIIdempotencyAcceptProcessingAndCallingUpstream(t *testing.T) {
	for _, status := range []string{APIIdempotencyStatusProcessing, APIIdempotencyStatusCallingUpstream} {
		t.Run("complete_"+status, func(t *testing.T) {
			db := newBytePlusRealPersonTestDB(t)
			record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: status, ResourceType: APIIdempotencyResourceAsset, ResourcePublicId: "ast_original", LeaseUpdatedTime: 100}
			require.NoError(t, db.Create(&record).Error)
			require.NoError(t, CompleteAPIIdempotency(record.Id, record.LeaseUpdatedTime, "ast_original", 200, `{"id":"ast_original"}`, 101))
			require.NoError(t, db.First(&record, record.Id).Error)
			require.Equal(t, APIIdempotencyStatusCompleted, record.Status)
		})

		t.Run("fail_"+status, func(t *testing.T) {
			db := newBytePlusRealPersonTestDB(t)
			record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: status, ResourceType: APIIdempotencyResourceAsset, ResourcePublicId: "ast_original", LeaseUpdatedTime: 100}
			require.NoError(t, db.Create(&record).Error)
			require.NoError(t, FailAPIIdempotency(record.Id, record.LeaseUpdatedTime, "ast_original", 500, `{"id":"ast_original"}`, 101))
			require.NoError(t, db.First(&record, record.Id).Error)
			require.Equal(t, APIIdempotencyStatusFailed, record.Status)
		})
	}
}

func TestMarkStaleAPIIdempotencyOutcomeUnknownOnlyReturnsUpdatedRows(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	stale := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusCallingUpstream, LeaseUpdatedTime: 10}
	fresh := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("c", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusCallingUpstream, LeaseUpdatedTime: 90}
	processing := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("d", 64), RequestHash: strings.Repeat("b", 64), Status: APIIdempotencyStatusProcessing, LeaseUpdatedTime: 10}
	require.NoError(t, db.Create(&stale).Error)
	require.NoError(t, db.Create(&fresh).Error)
	require.NoError(t, db.Create(&processing).Error)

	updated, err := MarkStaleAPIIdempotencyOutcomeUnknown(50, 100, 10)
	require.NoError(t, err)
	require.Len(t, updated, 1)
	require.Equal(t, stale.Id, updated[0].Id)
	require.NoError(t, db.First(&processing, processing.Id).Error)
	require.Equal(t, APIIdempotencyStatusProcessing, processing.Status)
}

func TestAPIIdempotencyUnknownStatusReturnsError(t *testing.T) {
	db := newBytePlusRealPersonTestDB(t)
	record := APIIdempotencyRecord{UserId: 7, Route: "/route", KeyHash: strings.Repeat("a", 64), RequestHash: strings.Repeat("b", 64), Status: "Mystery", LeaseUpdatedTime: 100}
	require.NoError(t, db.Create(&record).Error)
	_, err := ClaimAPIIdempotency(7, "/route", record.KeyHash, record.RequestHash, record.ResourceType, 101, 50, 1000)
	require.Error(t, err)
	require.False(t, errors.Is(err, ErrAPIIdempotencyCASLost))
}
