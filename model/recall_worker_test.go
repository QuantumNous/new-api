package model

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallWorkerUserStripeCustomerConditionalWriteChoosesOneWinner(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	user := User{Username: "recall-customer-winner", Password: "password", Email: "winner@example.com"}
	require.NoError(t, DB.Create(&user).Error)

	won, err := SetUserStripeCustomerIfEmptyOrMatches(user.Id, "", "cus_a")
	require.NoError(t, err)
	require.True(t, won)
	won, err = SetUserStripeCustomerIfEmptyOrMatches(user.Id, "", "cus_b")
	require.NoError(t, err)
	require.False(t, won)

	stored, err := GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_a", stored.StripeCustomer)
}

func TestRecallWorkerUserStripeCustomerConditionalWriteClaimsLegacyNull(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	user := User{Username: "recall-customer-null", Password: "password", Email: "null@example.com"}
	require.NoError(t, DB.Create(&user).Error)
	require.NoError(t, DB.Exec("UPDATE users SET stripe_customer = NULL WHERE id = ?", user.Id).Error)

	won, err := SetUserStripeCustomerIfEmptyOrMatchesWithContext(context.Background(), user.Id, "", "cus_legacy")
	require.NoError(t, err)
	require.True(t, won)

	stored, err := GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_legacy", stored.StripeCustomer)
}

func TestRecallWorkerUserStripeCustomerConditionalWriteReplacesExpectedDeletedID(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	user := User{Username: "recall-customer-replace", Password: "password", Email: "replace@example.com", StripeCustomer: "cus_deleted"}
	require.NoError(t, DB.Create(&user).Error)

	won, err := SetUserStripeCustomerIfEmptyOrMatches(user.Id, "cus_deleted", "cus_new")
	require.NoError(t, err)
	require.True(t, won)
	won, err = SetUserStripeCustomerIfEmptyOrMatches(user.Id, "cus_deleted", "cus_loser")
	require.NoError(t, err)
	require.False(t, won)

	stored, err := GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_new", stored.StripeCustomer)
}

func TestRecallWorkerRecipientAdvanceFencesExactLeaseExpiry(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	recipient := RecallRecipient{CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "lease@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued}
	require.NoError(t, DB.Create(&recipient).Error)
	won, err := LeaseRecallRecipient(recipient.Id, "node-a", 100, 160)
	require.NoError(t, err)
	require.True(t, won)
	won, err = LeaseRecallRecipient(recipient.Id, "node-a", 161, 221)
	require.NoError(t, err)
	require.True(t, won)

	won, err = AdvanceRecallRecipientLease(context.Background(), recipient.Id, "node-a", 160, []string{RecallRecipientQueued}, RecallRecipientCustomerReady, nil)
	require.NoError(t, err)
	require.False(t, won)
	won, err = AdvanceRecallRecipientLease(context.Background(), recipient.Id, "node-a", 221, []string{RecallRecipientQueued}, RecallRecipientCustomerReady, nil)
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallRecipientCustomerReady, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Zero(t, stored.LeaseExpiresAt)
}

func TestRecallWorkerExternalIDsPersistWithoutAllowingStaleAdvance(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	recipient := RecallRecipient{CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "external@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued, LeaseOwner: "old", LeaseExpiresAt: 160}
	require.NoError(t, DB.Create(&recipient).Error)

	persisted, err := PersistRecallRecipientStripeCustomer(context.Background(), recipient.Id, "cus_1")
	require.NoError(t, err)
	require.True(t, persisted)
	require.NoError(t, DB.Model(&RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{"lease_owner": "new", "lease_expires_at": int64(221)}).Error)
	won, err := AdvanceRecallRecipientLease(context.Background(), recipient.Id, "old", 160, []string{RecallRecipientQueued}, RecallRecipientCustomerReady, nil)
	require.NoError(t, err)
	require.False(t, won)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallRecipientQueued, stored.State)
	require.Equal(t, "cus_1", stored.StripeCustomerId)
	require.Equal(t, "new", stored.LeaseOwner)
}

func TestRecallWorkerRetryDeferralKeepsStateAndGatesDueListing(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	recipient := RecallRecipient{CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "retry@example.com", LanguageSnapshot: "en", State: RecallRecipientCustomerReady, LeaseOwner: "node-a", LeaseExpiresAt: 160}
	require.NoError(t, DB.Create(&recipient).Error)

	won, err := DeferRecallRecipientLease(context.Background(), recipient.Id, "node-a", 160, 190, "stripe_retryable")
	require.NoError(t, err)
	require.True(t, won)
	ids, err := ListDueRecallRecipientIDs(189, 10)
	require.NoError(t, err)
	require.Empty(t, ids)
	ids, err = ListDueRecallRecipientIDs(191, 10)
	require.NoError(t, err)
	require.Equal(t, []int64{recipient.Id}, ids)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallRecipientCustomerReady, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Equal(t, int64(190), stored.LeaseExpiresAt)
	require.Equal(t, "stripe_retryable", stored.LastErrorCode)
}

func TestRecallWorkerRevocationLeaseRequiresExactOwnerAndEpoch(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	promotionID := "promo_revoke_cas"
	recipient := RecallRecipient{
		CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "revoke-cas@example.com", LanguageSnapshot: "en",
		State: RecallRecipientContacting, StripePromotionCodeId: &promotionID, PromotionCode: "REVOKECAS123", PromotionExpiresAt: 1_900_000_000,
		PromotionRevocationState: RecallPromotionRevocationPending,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	won, err := LeaseRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_000, 1_800_000_060)
	require.NoError(t, err)
	require.True(t, won)
	won, err = LeaseRecallPromotionRevocation(context.Background(), recipient.Id, "node-b", 1_800_000_001, 1_800_000_061)
	require.NoError(t, err)
	require.False(t, won)

	won, err = CompleteRecallPromotionRevocation(context.Background(), recipient.Id, "node-b", 1_800_000_060, 1_800_000_010, "")
	require.NoError(t, err)
	require.False(t, won)
	won, err = CompleteRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_061, 1_800_000_010, "")
	require.NoError(t, err)
	require.False(t, won)
	won, err = CompleteRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_060, 1_800_000_010, "")
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallPromotionRevocationCompleted, stored.PromotionRevocationState)
	require.Empty(t, stored.PromotionRevocationLeaseOwner)
	require.Zero(t, stored.PromotionRevocationLeaseExpiresAt)
	require.Equal(t, int64(1_800_000_010), stored.PromotionRevokedAt)
}

func TestRecallWorkerRevocationDeferralAndPermanentFailureUseSanitizedCodes(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	promotionID := "promo_revoke_error"
	recipient := RecallRecipient{
		CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "revoke-error@example.com", LanguageSnapshot: "en",
		State: RecallRecipientContacting, StripePromotionCodeId: &promotionID, PromotionCode: "REVOKEERR123", PromotionExpiresAt: 1_900_000_000,
		PromotionRevocationState: RecallPromotionRevocationPending, PromotionRevocationLeaseOwner: "node-a", PromotionRevocationLeaseExpiresAt: 1_800_000_060,
	}
	require.NoError(t, DB.Create(&recipient).Error)

	won, err := DeferRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_060, 1_800_000_300, "stripe_retryable")
	require.NoError(t, err)
	require.True(t, won)

	var stored RecallRecipient
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallPromotionRevocationPending, stored.PromotionRevocationState)
	require.Equal(t, 1, stored.PromotionRevocationAttemptCount)
	require.Equal(t, int64(1_800_000_300), stored.PromotionRevocationNextAttemptAt)
	require.Equal(t, "stripe_retryable", stored.PromotionRevocationLastErrorCode)
	require.NotContains(t, stored.PromotionRevocationLastErrorCode, "secret")

	won, err = LeaseRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_301, 1_800_000_360)
	require.NoError(t, err)
	require.True(t, won)
	won, err = FailRecallPromotionRevocation(context.Background(), recipient.Id, "node-a", 1_800_000_360, "stripe_permanent")
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, DB.First(&stored, recipient.Id).Error)
	require.Equal(t, RecallPromotionRevocationFailed, stored.PromotionRevocationState)
	require.Equal(t, "stripe_permanent", stored.PromotionRevocationLastErrorCode)
	require.Empty(t, stored.PromotionRevocationLeaseOwner)
}

func TestRecallWorkerSchedulesStageOneAndContactsOnlyWithExactLease(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	recipient := RecallRecipient{CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "message@example.com", LanguageSnapshot: "en", State: RecallRecipientCodeReady, LeaseOwner: "node-a", LeaseExpiresAt: 160}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{StageNo: 1, TemplateVersion: 2, TemplateSnapshot: `{"en":{"subject":"hello"}}`, ScheduledAt: 120, State: RecallMessageScheduled}

	won, err := ScheduleRecallStageOneAndAdvance(context.Background(), recipient.Id, "node-a", 159, message)
	require.NoError(t, err)
	require.False(t, won)
	won, err = ScheduleRecallStageOneAndAdvance(context.Background(), recipient.Id, "node-a", 160, message)
	require.NoError(t, err)
	require.True(t, won)

	var storedRecipient RecallRecipient
	require.NoError(t, DB.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, RecallRecipientContacting, storedRecipient.State)
	var storedMessage RecallMessage
	require.NoError(t, DB.Where("recipient_id = ? AND stage_no = 1", recipient.Id).First(&storedMessage).Error)
	require.Nil(t, storedMessage.ClaimTokenHash)
}

func TestRecallWorkerSchedulesStageOneFromExplicitSourceState(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	recipient := RecallRecipient{CampaignId: 1, UserId: 1, EligibilitySnapshot: `{}`, EmailSnapshot: "message@example.com", LanguageSnapshot: "en", State: RecallRecipientQueued, LeaseOwner: "node-a", LeaseExpiresAt: 160}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{StageNo: 1, TemplateVersion: 2, TemplateSnapshot: `{"en":{"subject":"hello"}}`, ScheduledAt: 120, State: RecallMessageScheduled}

	won, err := ScheduleRecallStageOneFromStatesAndAdvance(context.Background(), recipient.Id, "node-a", 160, []string{RecallRecipientCustomerReady}, message)
	require.NoError(t, err)
	require.False(t, won)
	won, err = ScheduleRecallStageOneFromStatesAndAdvance(context.Background(), recipient.Id, "node-a", 160, []string{RecallRecipientQueued}, message)
	require.NoError(t, err)
	require.True(t, won)

	var storedRecipient RecallRecipient
	require.NoError(t, DB.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, RecallRecipientContacting, storedRecipient.State)
	var storedMessage RecallMessage
	require.NoError(t, DB.Where("recipient_id = ? AND stage_no = 1", recipient.Id).First(&storedMessage).Error)
	require.Nil(t, storedMessage.ClaimTokenHash)
}

func TestRecallExclusionBeginSMTPAttemptSuppressesPersistentExclusionWithoutQuota(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	campaign := newRecallRepositoryCampaign("suppressed smtp begin")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 8001, RecipientIdentity: RecallRecipientIdentityForUser(8001),
		EligibilitySnapshot: `{}`, EmailSnapshot: "suppressed@example.com", LanguageSnapshot: "en", State: RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "node-a", LeaseExpiresAt: 200}
	require.NoError(t, DB.Create(&message).Error)
	require.NoError(t, DB.Create(&RecallCampaignExclusion{
		CampaignId: campaign.Id, RecipientIdentity: recipient.RecipientIdentity, UserId: recipient.UserId,
		Persistent: true, PersistentReasonCode: "operator_csv",
	}).Error)

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(context.Background(), message.Id, "node-a", 200, 1)

	require.NoError(t, err)
	require.True(t, attempt.LeaseOwned)
	require.True(t, attempt.Suppressed)
	require.False(t, attempt.Reserved)
	stored := RecallMessage{}
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageCancelled, stored.State)
	require.Equal(t, "operator_csv", stored.LastErrorCode)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, status.Used)
}

func TestRecallExclusionBeginSMTPAttemptReportsSuppressedWhenConfirmationCancelsAfterInitialRead(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	campaign := newRecallRepositoryCampaign("suppressed after read")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 8101, RecipientIdentity: RecallRecipientIdentityForUser(8101),
		EligibilitySnapshot: `{}`, EmailSnapshot: "after-read@example.com", LanguageSnapshot: "en", State: RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "node-a", LeaseExpiresAt: 200}
	require.NoError(t, DB.Create(&message).Error)
	callbackName := "recall_exclusion_after_initial_read"
	fired := false
	require.NoError(t, DB.Callback().Query().After("gorm:query").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" {
			return
		}
		fired = true
		db := tx.Session(&gorm.Session{NewDB: true})
		if err := db.Exec(
			"INSERT INTO recall_campaign_exclusions (campaign_id, recipient_identity, user_id, persistent, persistent_reason_code) VALUES (?, ?, ?, ?, ?)",
			campaign.Id, recipient.RecipientIdentity, recipient.UserId, true, "operator_csv",
		).Error; err != nil {
			tx.AddError(err)
			return
		}
		if err := db.Exec(
			"UPDATE recall_messages SET state = ?, lease_owner = ?, lease_expires_at = ?, last_error_code = ? WHERE id = ?",
			RecallMessageCancelled, "", int64(0), "operator_csv", message.Id,
		).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Query().Remove(callbackName) })

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(context.Background(), message.Id, "node-a", 200, 1)

	require.NoError(t, err)
	require.True(t, attempt.LeaseOwned)
	require.True(t, attempt.Suppressed)
	require.False(t, attempt.Reserved)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, status.Used)
	stored := RecallMessage{}
	require.NoError(t, DB.First(&stored, message.Id).Error)
	require.Equal(t, RecallMessageCancelled, stored.State)
}

func TestRecallExclusionBeginSMTPAttemptQuotaRollsBackWhenCASLoses(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	campaign := newRecallRepositoryCampaign("quota rollback")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 8002, RecipientIdentity: RecallRecipientIdentityForUser(8002),
		EligibilitySnapshot: `{}`, EmailSnapshot: "quota-race@example.com", LanguageSnapshot: "en", State: RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageLeased, LeaseOwner: "node-a", LeaseExpiresAt: 200}
	require.NoError(t, DB.Create(&message).Error)
	callbackName := "recall_quota_cas_loss"
	fired := false
	require.NoError(t, DB.Callback().Update().Before("gorm:update").Register(callbackName, func(tx *gorm.DB) {
		if fired || tx.Statement.Schema == nil || tx.Statement.Schema.Name != "RecallMessage" {
			return
		}
		fired = true
		if err := tx.Session(&gorm.Session{NewDB: true}).
			Exec("UPDATE recall_messages SET state = ?, lease_owner = ?, lease_expires_at = ? WHERE id = ?", RecallMessageCancelled, "", int64(0), message.Id).Error; err != nil {
			tx.AddError(err)
		}
	}))
	t.Cleanup(func() { _ = DB.Callback().Update().Remove(callbackName) })

	attempt, err := BeginRecallEmailSMTPAttemptWithContext(context.Background(), message.Id, "node-a", 200, 1)

	require.NoError(t, err)
	require.False(t, attempt.LeaseOwned)
	require.False(t, attempt.Reserved)
	status, err := GetRecallEmailQuotaStatusWithContext(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, status.Used)
}

func TestRecallExclusionAcceptPreservesAcceptedButSkipsNextWhenExcluded(t *testing.T) {
	setupRecallRepositoryTestDB(t)
	campaign := newRecallRepositoryCampaign("accept suppressed")
	campaign.Status = RecallCampaignRunning
	require.NoError(t, CreateRecallCampaign(&campaign))
	recipient := RecallRecipient{
		CampaignId: campaign.Id, UserId: 8003, RecipientIdentity: RecallRecipientIdentityForUser(8003),
		EligibilitySnapshot: `{}`, EmailSnapshot: "accepted@example.com", LanguageSnapshot: "en", State: RecallRecipientContacting,
	}
	require.NoError(t, DB.Create(&recipient).Error)
	message := RecallMessage{RecipientId: recipient.Id, StageNo: 1, TemplateSnapshot: `{}`, State: RecallMessageSending, LeaseOwner: "node-a", LeaseExpiresAt: 200}
	require.NoError(t, DB.Create(&message).Error)
	require.NoError(t, DB.Create(&RecallCampaignExclusion{
		CampaignId: campaign.Id, RecipientIdentity: recipient.RecipientIdentity, UserId: recipient.UserId,
		Persistent: true, PersistentReasonCode: "operator_csv",
	}).Error)

	accepted, err := AcceptRecallMessageAndScheduleNextWithContext(context.Background(), message.Id, "node-a", 200, 150, &RecallMessage{
		StageNo: 2, TemplateSnapshot: `{}`, ScheduledAt: 300,
	})

	require.NoError(t, err)
	require.True(t, accepted)
	first := RecallMessage{}
	require.NoError(t, DB.First(&first, message.Id).Error)
	require.Equal(t, RecallMessageAccepted, first.State)
	var nextCount int64
	require.NoError(t, DB.Model(&RecallMessage{}).Where("recipient_id = ? AND stage_no = 2", recipient.Id).Count(&nextCount).Error)
	require.Zero(t, nextCount)
}
