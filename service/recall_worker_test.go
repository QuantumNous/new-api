package service

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

const recallWorkerTestNow = int64(1_800_000_000)

func TestRecallWorkerRuntimeUsesReplicaOwnerAndMaintenanceRunsRecipients(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-runtime", Password: "password", Email: "runtime@example.com", StripeCustomer: "cus_runtime"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Update("created_at", recallWorkerTestNow-60).Error)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) { return &stripe.Customer{ID: id}, nil },
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_runtime", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, common.GetReplicaID())
	originalRuntime := recallRuntime
	recallRuntime = &RecallRuntime{
		Campaigns:  NewRecallCampaignService(NewRecallAudienceSelector(), NewRecallStripeService(client)),
		Claims:     NewRecallClaimService(),
		Recipients: worker,
	}
	recallRuntimeOnce = sync.Once{}
	recallRuntimeOnce.Do(func() {})
	t.Cleanup(func() {
		recallRuntime = originalRuntime
		recallRuntimeOnce = sync.Once{}
		if originalRuntime != nil {
			recallRuntimeOnce.Do(func() {})
		}
	})

	RunRecallMaintenanceTick(context.Background())
	require.Equal(t, common.GetReplicaID(), recallRuntime.Recipients.owner)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
}

func TestRecallMaintenanceRunsRecipientBeforeEmailInSameTick(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("next_run_at", int64(1_900_000_000)).Error)
	user := model.User{Username: "recall-maintenance-sequence", Password: "password", Status: common.UserStatusEnabled, Email: "snapshot@example.com", EmailVerifiedAt: recallWorkerTestNow - 100, StripeCustomer: "cus_sequence"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) { return &stripe.Customer{ID: id}, nil },
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_sequence", params), nil
		},
	}
	stripeService := NewRecallStripeService(client)
	stripeService.codeGenerator = func(int) (string, error) { return "WORKER234", nil }
	claims := NewRecallClaimService()
	audience := NewRecallAudienceSelector()
	recipientWorker := NewRecallRecipientWorker(stripeService, claims, "maintenance-worker")
	recipientWorker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }
	sent := 0
	emailWorker := NewRecallEmailWorker(func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent++
		return nil
	}, audience, claims, "maintenance-worker")
	emailWorker.now = recipientWorker.now
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(audience, stripeService),
		Claims:     claims,
		Recipients: recipientWorker,
		Emails:     emailWorker,
	})

	RunRecallMaintenanceTick(context.Background())

	require.Equal(t, 1, sent)
	message := loadRecallEmailMessage(t, recipient.Id, 1)
	require.Equal(t, model.RecallMessageAccepted, message.State)
}

func TestRecallMaintenanceRecipientErrorStillRunsEmailBatch(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("next_run_at", int64(1_900_000_000)).Error)
	failingUser := model.User{Username: "recall-maintenance-failure", Password: "password", Status: common.UserStatusEnabled, Email: "failure@example.com", EmailVerifiedAt: recallWorkerTestNow - 100, AffCode: "maintenance-failure"}
	require.NoError(t, model.DB.Create(&failingUser).Error)
	createRecallWorkerRecipient(t, campaign.Id, failingUser.Id, model.RecallRecipientQueued)
	emailUser := model.User{Username: "recall-maintenance-email", Password: "password", Status: common.UserStatusEnabled, Email: "snapshot@example.com", EmailVerifiedAt: recallWorkerTestNow - 100, AffCode: "maintenance-email"}
	require.NoError(t, model.DB.Create(&emailUser).Error)
	emailRecipient := createRecallWorkerRecipient(t, campaign.Id, emailUser.Id, model.RecallRecipientContacting)
	promotionID := "promo_existing"
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", emailRecipient.Id).Updates(map[string]any{
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           "EXISTING123",
		"promotion_expires_at":     int64(1_900_000_000),
	}).Error)
	stages := make([]RecallEmailStage, 0)
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages))
	templateSnapshot, err := common.Marshal(stages[0].Templates)
	require.NoError(t, err)
	message := model.RecallMessage{RecipientId: emailRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: string(templateSnapshot), ScheduledAt: recallWorkerTestNow, State: model.RecallMessageScheduled}
	require.NoError(t, model.DB.Create(&message).Error)
	stripeErr := errors.New("scripted recipient Stripe failure")
	client := &recallStripeFakeClient{createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) { return nil, stripeErr }}
	stripeService := NewRecallStripeService(client)
	claims := NewRecallClaimService()
	audience := NewRecallAudienceSelector()
	recipientWorker := NewRecallRecipientWorker(stripeService, claims, "maintenance-worker")
	recipientWorker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }
	sent := 0
	emailWorker := NewRecallEmailWorker(func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent++
		return nil
	}, audience, claims, "maintenance-worker")
	emailWorker.now = recipientWorker.now
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(audience, stripeService),
		Claims:     claims,
		Recipients: recipientWorker,
		Emails:     emailWorker,
	})

	RunRecallMaintenanceTick(context.Background())

	require.Equal(t, 1, sent)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, message.Id).State)
}

func TestRecallMaintenanceCampaignErrorStillRunsRecipientsAndEmail(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	poisoned := createRecallWorkerCampaign(t, model.RecallCampaignScheduled)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", poisoned.Id).Updates(map[string]any{
		"execution_mode":        "scheduled_once",
		"scheduled_at":          int64(1),
		"next_run_at":           int64(1),
		"email_sequence_config": `{`,
	}).Error)
	healthy := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{
		Username: "recall-maintenance-campaign-error", Password: "password", Status: common.UserStatusEnabled,
		Email: "snapshot@example.com", EmailVerifiedAt: recallWorkerTestNow - 100, StripeCustomer: "cus_campaign_error", AffCode: "campaign-error",
	}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, healthy.Id, user.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) { return &stripe.Customer{ID: id}, nil },
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_campaign_error", params), nil
		},
	}
	stripeService := NewRecallStripeService(client)
	stripeService.codeGenerator = func(int) (string, error) { return "CAMPAIGN234", nil }
	claims := NewRecallClaimService()
	audience := NewRecallAudienceSelector()
	recipientWorker := NewRecallRecipientWorker(stripeService, claims, "maintenance-worker")
	recipientWorker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }
	sent := 0
	emailWorker := NewRecallEmailWorker(func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent++
		return nil
	}, audience, claims, "maintenance-worker")
	emailWorker.now = recipientWorker.now
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:  NewRecallCampaignService(audience, stripeService),
		Claims:     claims,
		Recipients: recipientWorker,
		Emails:     emailWorker,
	})

	RunRecallMaintenanceTick(context.Background())

	poisonedStored, err := model.GetRecallCampaignByID(poisoned.Id)
	require.NoError(t, err)
	require.Equal(t, model.RecallCampaignCompleted, poisonedStored.Status)
	require.Equal(t, 1, sent)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessage(t, recipient.Id, 1).State)
}

func TestRecallPromotionRevocationSettlesTerminalStripeStatesWithoutDeactivation(t *testing.T) {
	tests := []struct {
		name      string
		promo     *stripe.PromotionCode
		getErr    error
		localPast bool
	}{
		{name: "local expired", localPast: true},
		{name: "missing", getErr: &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Code: stripe.ErrorCodeResourceMissing, Msg: "No such promotion code"}},
		{name: "inactive", promo: &stripe.PromotionCode{ID: "promo_revoke_active", Active: false, ExpiresAt: recallWorkerTestNow + 100, MaxRedemptions: 1}},
		{name: "redeemed", promo: &stripe.PromotionCode{ID: "promo_revoke_active", Active: true, ExpiresAt: recallWorkerTestNow + 100, MaxRedemptions: 1, TimesRedeemed: 1}},
		{name: "stripe expired", promo: &stripe.PromotionCode{ID: "promo_revoke_active", Active: true, ExpiresAt: recallWorkerTestNow - 1, MaxRedemptions: 1}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			recipient := createRecallRevocationRecipient(t, recallWorkerTestNow+100)
			if test.localPast {
				require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Update("promotion_expires_at", recallWorkerTestNow-1).Error)
			}
			updateCalls := 0
			client := &recallStripeFakeClient{
				getPromotionCodeFn: func(context.Context, string) (*stripe.PromotionCode, error) {
					if test.getErr != nil {
						return nil, test.getErr
					}
					return test.promo, nil
				},
				updatePromotionCodeFn: func(context.Context, string, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
					updateCalls++
					return nil, nil
				},
			}
			worker := NewRecallPromotionRevocationWorker(NewRecallStripeService(client), "revoker-a")
			worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }

			processed, err := worker.RunBatch(context.Background(), 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			require.Equal(t, 0, updateCalls)
			stored := loadRecallRecipientForTest(t, recipient.Id)
			require.Equal(t, model.RecallPromotionRevocationCompleted, stored.PromotionRevocationState)
		})
	}
}

func TestRecallPromotionRevocationActiveCodeDeactivatesExactlyOnce(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	recipient := createRecallRevocationRecipient(t, recallWorkerTestNow+100)
	updateCalls := 0
	client := &recallStripeFakeClient{
		getPromotionCodeFn: func(context.Context, string) (*stripe.PromotionCode, error) {
			return &stripe.PromotionCode{ID: "promo_revoke_active", Active: true, ExpiresAt: recallWorkerTestNow + 100, MaxRedemptions: 1}, nil
		},
		updatePromotionCodeFn: func(_ context.Context, id string, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			updateCalls++
			require.Equal(t, "promo_revoke_active", id)
			require.NotNil(t, params.Active)
			require.False(t, *params.Active)
			return &stripe.PromotionCode{ID: id, Active: false}, nil
		},
	}
	worker := NewRecallPromotionRevocationWorker(NewRecallStripeService(client), "revoker-a")
	worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	processed, err = worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, processed)
	require.Equal(t, 1, updateCalls)
	stored := loadRecallRecipientForTest(t, recipient.Id)
	require.Equal(t, model.RecallPromotionRevocationCompleted, stored.PromotionRevocationState)
}

func TestRecallWorkerPromotionCreatedDuringCancellationQueuesRevocationAndSkipsDelivery(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-cancel-race", Password: "password", Email: "cancel-race@example.com", StripeCustomer: "cus_cancel_race"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"lease_owner":      "worker-a",
		"lease_expires_at": int64(recallWorkerTestNow + 60),
		"promotion_code":   "FKRACEABCDE223",
	}).Error)
	updateCalls := 0
	client := &recallStripeFakeClient{
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignCancelled).Error)
			return recallWorkerPromotionFromParams("promo_cancel_race_created", params), nil
		},
		updatePromotionCodeFn: func(_ context.Context, id string, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			updateCalls++
			require.Equal(t, "promo_cancel_race_created", id)
			require.NotNil(t, params.Active)
			require.False(t, *params.Active)
			return &stripe.PromotionCode{ID: id, Active: false}, nil
		},
	}
	worker := newRecallWorkerForTest(client, "worker-a")
	worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }

	err := worker.ProcessLeased(context.Background(), recipient.Id)
	require.NoError(t, err)

	stored := loadRecallRecipientForTest(t, recipient.Id)
	require.Equal(t, model.RecallRecipientCustomerReady, stored.State)
	require.Equal(t, model.RecallPromotionRevocationPending, stored.PromotionRevocationState)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, "promo_cancel_race_created", *stored.StripePromotionCodeId)
	var messages int64
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("recipient_id = ?", recipient.Id).Count(&messages).Error)
	require.Zero(t, messages)
	require.Equal(t, 1, updateCalls)
}

func TestRecallPromotionRevocationRetriesTransientAndFailsPermanentWithSanitizedCode(t *testing.T) {
	tests := []struct {
		name      string
		err       error
		wantState string
		wantCode  string
	}{
		{name: "transient", err: &stripe.Error{HTTPStatusCode: 500, Type: stripe.ErrorTypeAPI, Msg: "server leaked sk_secret"}, wantState: model.RecallPromotionRevocationPending, wantCode: "stripe_retryable"},
		{name: "permanent", err: &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Msg: "invalid leaked sk_secret"}, wantState: model.RecallPromotionRevocationFailed, wantCode: "stripe_permanent"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			recipient := createRecallRevocationRecipient(t, recallWorkerTestNow+100)
			client := &recallStripeFakeClient{
				getPromotionCodeFn: func(context.Context, string) (*stripe.PromotionCode, error) {
					return nil, test.err
				},
			}
			worker := NewRecallPromotionRevocationWorker(NewRecallStripeService(client), "revoker-a")
			worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }

			processed, err := worker.RunBatch(context.Background(), 10)
			require.NoError(t, err)
			require.Equal(t, 1, processed)
			stored := loadRecallRecipientForTest(t, recipient.Id)
			require.Equal(t, test.wantState, stored.PromotionRevocationState)
			require.Equal(t, test.wantCode, stored.PromotionRevocationLastErrorCode)
			require.NotContains(t, stored.PromotionRevocationLastErrorCode, "secret")
			if test.wantState == model.RecallPromotionRevocationPending {
				require.Equal(t, 1, stored.PromotionRevocationAttemptCount)
				require.Greater(t, stored.PromotionRevocationNextAttemptAt, recallWorkerTestNow)
			}
		})
	}
}

func TestRecallMaintenanceRevocationErrorStillRunsEmailBatch(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	createRecallRevocationRecipient(t, recallWorkerTestNow+100)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	emailUser := model.User{Username: "recall-revocation-maint-email", Password: "password", Status: common.UserStatusEnabled, Email: "snapshot@example.com", EmailVerifiedAt: recallWorkerTestNow - 100, AffCode: "revocation-maint-email"}
	require.NoError(t, model.DB.Create(&emailUser).Error)
	emailRecipient := createRecallWorkerRecipient(t, campaign.Id, emailUser.Id, model.RecallRecipientContacting)
	promotionID := "promo_existing"
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", emailRecipient.Id).Updates(map[string]any{
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           "EXISTING123",
		"promotion_expires_at":     int64(1_900_000_000),
	}).Error)
	stages := make([]RecallEmailStage, 0)
	require.NoError(t, common.Unmarshal([]byte(campaign.EmailSequenceConfig), &stages))
	templateSnapshot, err := common.Marshal(stages[0].Templates)
	require.NoError(t, err)
	message := model.RecallMessage{RecipientId: emailRecipient.Id, StageNo: 1, TemplateVersion: 1, TemplateSnapshot: string(templateSnapshot), ScheduledAt: recallWorkerTestNow, State: model.RecallMessageScheduled}
	require.NoError(t, model.DB.Create(&message).Error)
	client := &recallStripeFakeClient{
		getPromotionCodeFn: func(context.Context, string) (*stripe.PromotionCode, error) {
			return nil, &stripe.Error{HTTPStatusCode: 500, Type: stripe.ErrorTypeAPI}
		},
	}
	stripeService := NewRecallStripeService(client)
	claims := NewRecallClaimService()
	audience := NewRecallAudienceSelector()
	revocations := NewRecallPromotionRevocationWorker(stripeService, "maintenance-worker")
	revocations.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }
	sent := 0
	emailWorker := NewRecallEmailWorker(func(_ common.SMTPConfig, subject, receiver, content, messageID string, _ common.EmailOptions) error {
		sent++
		return nil
	}, audience, claims, "maintenance-worker")
	emailWorker.now = revocations.now
	setRecallRuntimeForTest(t, &RecallRuntime{
		Campaigns:   NewRecallCampaignService(audience, stripeService),
		Claims:      claims,
		Revocations: revocations,
		Recipients:  NewRecallRecipientWorker(stripeService, claims, "maintenance-worker"),
		Emails:      emailWorker,
		Attribution: nil,
	})

	RunRecallMaintenanceTick(context.Background())

	require.Equal(t, 1, sent)
	require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, message.Id).State)
}

func TestRecallWorkerCampaignEnrollmentDefersStageOneUntilCodeReady(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	now := time.Date(2026, 7, 16, 9, 0, 0, 0, time.UTC)
	createRecallCampaignEligibleUser(t, db, now, "worker-deferred-message")
	draft := validRecallCampaignDraft(now)
	draft.Audience.LastAPICallAgeDays = 0
	campaignService := NewRecallCampaignService(NewRecallAudienceSelector(), newRecallCampaignStripeService(t, &recallCampaignStripeCalls{}))
	campaignService.now = func() time.Time { return now }
	campaign, err := campaignService.SaveDraft(context.Background(), 7, draft)
	require.NoError(t, err)

	require.NoError(t, campaignService.Activate(context.Background(), 7, campaign.Id))
	var recipientCount, messageCount int64
	require.NoError(t, db.Model(&model.RecallRecipient{}).Count(&recipientCount).Error)
	require.NoError(t, db.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.EqualValues(t, 1, recipientCount)
	require.Zero(t, messageCount)
}

func TestRecallWorkerReusesCustomerCreatesBoundPromotionAndSchedulesStageOne(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-reuse", Password: "password", Email: " Current@Example.com ", StripeCustomer: "cus_existing"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)

	createCustomerCalls := 0
	updateEmails := make([]string, 0, 1)
	var promotionParams *stripe.PromotionCodeParams
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			require.Equal(t, "cus_existing", id)
			return &stripe.Customer{ID: id}, nil
		},
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			createCustomerCalls++
			return nil, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			updateEmails = append(updateEmails, *params.Email)
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			promotionParams = params
			return recallWorkerPromotionFromParams("promo_reuse", params), nil
		},
	}
	stripeService := NewRecallStripeService(client)
	stripeService.codeGenerator = func(int) (string, error) { return "WORKER234", nil }
	worker := NewRecallRecipientWorker(stripeService, NewRecallClaimService(), "node-a")
	worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Zero(t, createCustomerCalls)
	require.Equal(t, []string{"current@example.com"}, updateEmails)
	require.NotNil(t, promotionParams)
	require.Equal(t, "cus_existing", *promotionParams.Customer)
	require.NotNil(t, promotionParams.Promotion)
	require.Equal(t, "coupon_worker", *promotionParams.Promotion.Coupon)
	require.Equal(t, int64(1), *promotionParams.MaxRedemptions)
	require.Equal(t, int64(2500), *promotionParams.Restrictions.MinimumAmount)
	require.Equal(t, "usd", *promotionParams.Restrictions.MinimumAmountCurrency)

	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
	require.Equal(t, "cus_existing", stored.StripeCustomerId)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, "promo_reuse", *stored.StripePromotionCodeId)
	require.Equal(t, "FKWXRKER234", stored.PromotionCode)
	require.Equal(t, recallWorkerTestNow, stored.PromotionIssuedAt)
	var message model.RecallMessage
	require.NoError(t, model.DB.Where("recipient_id = ? AND stage_no = 1", stored.Id).First(&message).Error)
	require.Nil(t, message.ClaimTokenHash)
	require.Equal(t, model.RecallMessageScheduled, message.State)
}

func TestRecallWorkerPromotionMinimumSpendPassThrough(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	discountJSON, err := common.Marshal(RecallDiscountConfig{MinimumSpend: &RecallMinimumSpendConfig{
		Enabled: true,
		Amounts: map[string]int64{"usd": 2_500, "inr": 200_000, "brl": 12_500, "jpy": 3_750},
	}})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("discount_config", string(discountJSON)).Error)
	user := model.User{Username: "recall-worker-minimum-spend", Password: "password", Email: "minimum@example.com", StripeCustomer: "cus_minimum"}
	require.NoError(t, model.DB.Create(&user).Error)
	createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)

	var promotionParams *stripe.PromotionCodeParams
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			promotionParams = params
			return recallWorkerPromotionFromParams("promo_minimum_spend", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)

	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.NotNil(t, promotionParams)
	require.NotNil(t, promotionParams.Restrictions)
	require.Equal(t, int64(2_500), *promotionParams.Restrictions.MinimumAmount)
	require.Equal(t, "usd", *promotionParams.Restrictions.MinimumAmountCurrency)
	require.NotNil(t, promotionParams.Restrictions.CurrencyOptions)
	require.Equal(t, int64(200_000), *promotionParams.Restrictions.CurrencyOptions["inr"].MinimumAmount)
	require.Equal(t, int64(12_500), *promotionParams.Restrictions.CurrencyOptions["brl"].MinimumAmount)
	require.Equal(t, int64(3_750), *promotionParams.Restrictions.CurrencyOptions["jpy"].MinimumAmount)
	require.NotContains(t, promotionParams.Restrictions.CurrencyOptions, "usd")
}

func TestRecallWorkerDiscountConfigCouponRedeemByCompatibility(t *testing.T) {
	tests := []struct {
		name            string
		discountJSON    string
		wantCreateCalls int
		wantState       string
	}{
		{
			name: "historical coupon redeem by caps lightweight coupon",
			discountJSON: func() string {
				encoded, err := common.Marshal(recallPersistedDiscountConfig{
					RecallDiscountConfig: RecallDiscountConfig{MinimumAmount: 2500, MinimumAmountCurrency: "usd"},
					CouponRedeemBy:       1_899_999_999,
				})
				require.NoError(t, err)
				return string(encoded)
			}(),
			wantState: model.RecallRecipientFailed,
		},
		{
			name: "new discount config has no lightweight coupon cap",
			discountJSON: func() string {
				encoded, err := common.Marshal(RecallDiscountConfig{MinimumAmount: 2500, MinimumAmountCurrency: "usd"})
				require.NoError(t, err)
				return string(encoded)
			}(),
			wantCreateCalls: 1,
			wantState:       model.RecallRecipientContacting,
		},
	}
	for _, testCase := range tests {
		t.Run(testCase.name, func(t *testing.T) {
			setupRecallCampaignTestDB(t)
			setRecallCampaignEnabled(t, true)
			campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("discount_config", testCase.discountJSON).Error)
			user := model.User{Username: "recall-worker-cap-" + strings.ReplaceAll(testCase.name, " ", "-"), Password: "password", Email: "cap@example.com", StripeCustomer: "cus_cap"}
			require.NoError(t, model.DB.Create(&user).Error)
			recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
				"lease_owner":        "node-a",
				"lease_expires_at":   int64(recallWorkerTestNow + 60),
				"promotion_code":     "FKWXRKER234",
				"stripe_customer_id": "cus_cap",
			}).Error)
			createCalls := 0
			client := &recallStripeFakeClient{
				createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
					createCalls++
					return recallWorkerPromotionFromParams("promo_cap", params), nil
				},
			}
			worker := newRecallWorkerForTest(client, "node-a")

			err := worker.ProcessLeased(context.Background(), recipient.Id)

			require.NoError(t, err)
			require.Equal(t, testCase.wantCreateCalls, createCalls)
			stored := loadRecallRecipientForTest(t, recipient.Id)
			require.Equal(t, testCase.wantState, stored.State)
		})
	}
}

func TestRecallWorkerEmailOnlyRecipientSkipsCustomerAndSchedulesStageOne(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	recipient := createRecallWorkerRecipient(t, campaign.Id, 0, model.RecallRecipientQueued)

	getCustomerCalls := 0
	createCustomerCalls := 0
	updateCustomerCalls := 0
	var promotionParams *stripe.PromotionCodeParams
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			getCustomerCalls++
			return &stripe.Customer{ID: id}, nil
		},
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			createCustomerCalls++
			return &stripe.Customer{ID: "cus_unexpected"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			updateCustomerCalls++
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			promotionParams = params
			return &stripe.PromotionCode{
				ID: "promo_email_only", Active: true, Code: *params.Code, Promotion: recallTestCouponPromotion(*params.Promotion.Coupon),
				ExpiresAt: *params.ExpiresAt, MaxRedemptions: *params.MaxRedemptions,
			}, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Zero(t, getCustomerCalls)
	require.Zero(t, createCustomerCalls)
	require.Zero(t, updateCustomerCalls)
	require.NotNil(t, promotionParams)
	require.Nil(t, promotionParams.Customer)
	require.Equal(t, int64(1), *promotionParams.MaxRedemptions)
	require.NotNil(t, promotionParams.Promotion)
	require.Equal(t, "coupon_worker", *promotionParams.Promotion.Coupon)
	require.NotNil(t, promotionParams.Restrictions)
	require.Equal(t, int64(2500), *promotionParams.Restrictions.MinimumAmount)
	require.Equal(t, "usd", *promotionParams.Restrictions.MinimumAmountCurrency)
	require.NotContains(t, promotionParams.Metadata, "flatkey_user_id")
	require.Equal(t, fmt.Sprint(campaign.Id), promotionParams.Metadata["recall_campaign_id"])
	require.Equal(t, fmt.Sprint(recipient.Id), promotionParams.Metadata["recall_recipient_id"])

	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
	require.Empty(t, stored.StripeCustomerId)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, "promo_email_only", *stored.StripePromotionCodeId)
	require.Equal(t, "FKWXRKER234", stored.PromotionCode)
	var message model.RecallMessage
	require.NoError(t, model.DB.Where("recipient_id = ? AND stage_no = 1", stored.Id).First(&message).Error)
	require.Equal(t, model.RecallMessageScheduled, message.State)
}

func TestRecallWorkerContentOnlyRecipientsScheduleStageOneWithoutStripe(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			t.Fatal("content-only recipient looked up a Stripe Customer")
			return nil, nil
		},
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			t.Fatal("content-only recipient created a Stripe Customer")
			return nil, nil
		},
		updateCustomerFn: func(context.Context, string, *stripe.CustomerParams) (*stripe.Customer, error) {
			t.Fatal("content-only recipient updated a Stripe Customer")
			return nil, nil
		},
		createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			t.Fatal("content-only recipient created a Stripe Promotion Code")
			return nil, nil
		},
		getPromotionCodeFn: func(context.Context, string) (*stripe.PromotionCode, error) {
			t.Fatal("content-only recipient looked up a Stripe Promotion Code")
			return nil, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")
	modes := []struct {
		name          string
		status        string
		executionMode string
	}{
		{name: "manual", status: model.RecallCampaignRunning, executionMode: "manual"},
		{name: "scheduled", status: model.RecallCampaignScheduled, executionMode: "scheduled_once"},
		{name: "recurring", status: model.RecallCampaignRunning, executionMode: "recurring"},
	}
	recipientIDs := make([]int64, 0, len(modes)*2)
	for _, mode := range modes {
		campaign := createRecallWorkerContentOnlyCampaign(t, mode.status, mode.executionMode)
		user := model.User{
			Username:       "recall-content-worker-" + mode.name,
			Password:       "password",
			Email:          mode.name + "@example.com",
			AffCode:        "content-worker-" + mode.name,
			StripeCustomer: "cus_should_not_be_used",
		}
		require.NoError(t, model.DB.Create(&user).Error)
		for _, userID := range []int{user.Id, 0} {
			recipient := createRecallWorkerRecipient(t, campaign.Id, userID, model.RecallRecipientQueued)
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
				"promotion_expires_at": int64(0),
				"created_at":           recallWorkerTestNow - 60,
			}).Error)
			recipientIDs = append(recipientIDs, recipient.Id)
		}
	}

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, len(recipientIDs), processed)
	processed, err = worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, processed)

	var recipients []model.RecallRecipient
	require.NoError(t, model.DB.Where("id IN ?", recipientIDs).Order("id ASC").Find(&recipients).Error)
	require.Len(t, recipients, len(recipientIDs))
	for _, recipient := range recipients {
		require.Equal(t, model.RecallRecipientContacting, recipient.State)
		require.Empty(t, recipient.StripeCustomerId)
		require.Nil(t, recipient.StripePromotionCodeId)
		require.Empty(t, recipient.PromotionCode)
		require.Zero(t, recipient.PromotionExpiresAt)
	}
	var messages []model.RecallMessage
	require.NoError(t, model.DB.Where("recipient_id IN ?", recipientIDs).Order("recipient_id ASC").Find(&messages).Error)
	require.Len(t, messages, len(recipientIDs))
	for _, message := range messages {
		require.Equal(t, 1, message.StageNo)
		require.Equal(t, model.RecallMessageScheduled, message.State)
		require.Nil(t, message.ClaimTokenHash)
	}
}

func TestRecallWorkerResolvesCompetingCustomerWinnerByReloadAndValidation(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-winner", Password: "password", Email: "winner@example.com", StripeCustomer: "cus_deleted"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)

	var getIDs []string
	createParams := make([]*stripe.CustomerParams, 0, 1)
	var promotionCustomer string
	injectedWinner := false
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			getIDs = append(getIDs, id)
			if id == "cus_deleted" {
				return &stripe.Customer{ID: id, Deleted: true}, nil
			}
			require.Equal(t, "cus_winner", id)
			return &stripe.Customer{ID: id}, nil
		},
		createCustomerFn: func(_ context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
			createParams = append(createParams, params)
			if !injectedWinner {
				injectedWinner = true
				require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", user.Id).Update("stripe_customer", "cus_winner").Error)
			}
			return &stripe.Customer{ID: "cus_created"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			promotionCustomer = *params.Customer
			return recallWorkerPromotionFromParams("promo_winner", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, []string{"cus_deleted", "cus_winner"}, getIDs)
	require.Len(t, createParams, 1)
	require.Nil(t, createParams[0].Email)
	require.Nil(t, createParams[0].Name)
	require.Nil(t, createParams[0].Description)
	require.Equal(t, map[string]string{"flatkey_user_id": fmt.Sprintf("%d", user.Id)}, createParams[0].Metadata)
	require.Equal(t, "recall_customer:"+fmt.Sprintf("%d", user.Id), *createParams[0].IdempotencyKey)
	require.Equal(t, "cus_winner", promotionCustomer)

	storedUser, err := model.GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_winner", storedUser.StripeCustomer)
	var storedRecipient model.RecallRecipient
	require.NoError(t, model.DB.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, "cus_winner", storedRecipient.StripeCustomerId)
	require.Equal(t, model.RecallRecipientContacting, storedRecipient.State)
}

func TestRecallWorkerReconcilesExistingPromotionWithoutCreate(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-existing-promo", Password: "password", Email: "existing@example.com", StripeCustomer: "cus_existing"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	promotionID := "promo_existing"
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "cus_existing",
		"stripe_promotion_code_id": promotionID,
		"promotion_code":           "FKEXXST234",
	}).Error)
	createCalls := 0
	getCalls := 0
	client := &recallStripeFakeClient{
		getPromotionCodeFn: func(_ context.Context, id string) (*stripe.PromotionCode, error) {
			getCalls++
			require.Equal(t, promotionID, id)
			return &stripe.PromotionCode{
				ID: id, Active: true, Code: "FKEXXST234", Promotion: recallTestCouponPromotion("coupon_worker"), Customer: &stripe.Customer{ID: "cus_existing"},
				ExpiresAt: 1_900_000_000, MaxRedemptions: 1,
				Restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 2500, MinimumAmountCurrency: stripe.CurrencyUSD},
			}, nil
		},
		createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			createCalls++
			return nil, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, getCalls)
	require.Zero(t, createCalls)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
	require.Zero(t, stored.PromotionIssuedAt)
}

func TestRecallWorkerRejectsMismatchedPersistedPromotionID(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-promo-id-mismatch", Password: "password", Email: "promo-id@example.com", StripeCustomer: "cus_expected", AffCode: "promo-id-mismatch"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	persistedPromotionID := "promo_expected"
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id":       "cus_expected",
		"stripe_promotion_code_id": persistedPromotionID,
		"promotion_code":           "FKEXXST234",
	}).Error)
	client := &recallStripeFakeClient{
		getPromotionCodeFn: func(_ context.Context, id string) (*stripe.PromotionCode, error) {
			require.Equal(t, persistedPromotionID, id)
			return &stripe.PromotionCode{
				ID: "promo_other", Active: true, Code: "FKEXXST234", Promotion: recallTestCouponPromotion("coupon_worker"), Customer: &stripe.Customer{ID: "cus_expected"},
				ExpiresAt: 1_900_000_000, MaxRedemptions: 1,
				Restrictions: &stripe.PromotionCodeRestrictions{MinimumAmount: 2500, MinimumAmountCurrency: stripe.CurrencyUSD},
			}, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientFailed, stored.State)
	require.Equal(t, "stripe_permanent", stored.LastErrorCode)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, persistedPromotionID, *stored.StripePromotionCodeId)
}

func TestRecallWorkerTwoWorkersCreateOnePromotion(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-race", Password: "password", Email: "race@example.com", StripeCustomer: "cus_race"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id": "cus_race", "promotion_code": "FKRACE234",
	}).Error)
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	t.Cleanup(func() { closeRecallWorkerTestSignal(release) })
	var createCalls atomic.Int32
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		createCalls.Add(1)
		started <- struct{}{}
		select {
		case <-release:
		case <-time.After(2 * time.Second):
			return nil, fmt.Errorf("timed out waiting to release promotion creation")
		}
		return recallWorkerPromotionFromParams("promo_race", params), nil
	}}
	workerA := newRecallWorkerForTest(client, "node-a")
	workerB := newRecallWorkerForTest(client, "node-b")
	errCh := make(chan error, 1)
	go func() {
		_, err := workerA.RunBatch(context.Background(), 10)
		errCh <- err
	}()
	receiveRecallWorkerTest(t, started, "promotion creation start")

	processedB, err := workerB.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, processedB)
	closeRecallWorkerTestSignal(release)
	require.NoError(t, receiveRecallWorkerTest(t, errCh, "first worker completion"))
	require.Equal(t, int32(1), createCalls.Load())
}

func TestRecallWorkerRunBatchHonorsPerCampaignConcurrency(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaignA := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	campaignB := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaignA.Id).Update("worker_concurrency", 2).Error)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaignB.Id).Update("worker_concurrency", 1).Error)

	codes := []string{"FKAAAA234", "FKBBBB234", "FKCCCC234", "FKDDDD234", "FKEEEE234", "FKFFFF234"}
	for i := range codes {
		campaignID := campaignA.Id
		if i >= 4 {
			campaignID = campaignB.Id
		}
		user := model.User{
			Username:       fmt.Sprintf("recall-worker-concurrency-%d", i),
			Password:       "password",
			Email:          fmt.Sprintf("concurrency-%d@example.com", i),
			AffCode:        fmt.Sprintf("worker-concurrency-%d", i),
			StripeCustomer: fmt.Sprintf("cus_concurrency_%d", i),
		}
		require.NoError(t, model.DB.Create(&user).Error)
		recipient := createRecallWorkerRecipient(t, campaignID, user.Id, model.RecallRecipientCustomerReady)
		require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
			"stripe_customer_id": user.StripeCustomer,
			"promotion_code":     codes[i],
		}).Error)
	}

	started := make(chan int64, len(codes))
	release := make(chan struct{})
	t.Cleanup(func() { closeRecallWorkerTestSignal(release) })
	active := map[int64]int{}
	peak := map[int64]int{}
	var concurrencyMu sync.Mutex
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		var campaignID int64
		_, err := fmt.Sscan(params.Metadata["recall_campaign_id"], &campaignID)
		require.NoError(t, err)
		concurrencyMu.Lock()
		active[campaignID]++
		if active[campaignID] > peak[campaignID] {
			peak[campaignID] = active[campaignID]
		}
		concurrencyMu.Unlock()
		started <- campaignID
		select {
		case <-release:
		case <-time.After(2 * time.Second):
			return nil, fmt.Errorf("timed out waiting to release campaign concurrency test")
		}
		concurrencyMu.Lock()
		active[campaignID]--
		concurrencyMu.Unlock()
		return recallWorkerPromotionFromParams("promo_"+params.Metadata["recall_recipient_id"], params), nil
	}}
	worker := newRecallWorkerForTest(client, "node-a")
	type runResult struct {
		processed int
		err       error
	}
	done := make(chan runResult, 1)
	go func() {
		processed, err := worker.RunBatch(context.Background(), len(codes))
		done <- runResult{processed: processed, err: err}
	}()

	startedCount := 0
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	for startedCount < 3 {
		select {
		case <-started:
			startedCount++
		case <-timer.C:
			closeRecallWorkerTestSignal(release)
			result := receiveRecallWorkerTest(t, done, "campaign concurrency completion")
			require.NoError(t, result.err)
			t.Fatalf("expected three concurrent Stripe calls across campaign caps, got %d", startedCount)
		}
	}
	closeRecallWorkerTestSignal(release)
	result := receiveRecallWorkerTest(t, done, "campaign concurrency completion")
	require.NoError(t, result.err)
	require.Equal(t, len(codes), result.processed)
	concurrencyMu.Lock()
	defer concurrencyMu.Unlock()
	require.Equal(t, 2, peak[campaignA.Id])
	require.Equal(t, 1, peak[campaignB.Id])
}

func TestRecallWorkerRunBatchScansPastFullCampaignForAvailableWork(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaignA := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaignA.Id).Update("worker_concurrency", 1).Error)
	blockerUser := model.User{Username: "recall-worker-fair-blocker", Password: "password", Email: "blocker@example.com", AffCode: "fair-blocker"}
	starvedUser := model.User{Username: "recall-worker-fair-a", Password: "password", Email: "a@example.com", AffCode: "fair-a"}
	require.NoError(t, model.DB.Create(&blockerUser).Error)
	require.NoError(t, model.DB.Create(&starvedUser).Error)
	blocker := createRecallWorkerRecipient(t, campaignA.Id, blockerUser.Id, model.RecallRecipientQueued)
	starved := createRecallWorkerRecipient(t, campaignA.Id, starvedUser.Id, model.RecallRecipientQueued)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", blocker.Id).Updates(map[string]any{
		"lease_owner": "capacity-holder", "lease_expires_at": recallWorkerTestNow + recallRecipientLeaseSeconds,
	}).Error)

	campaignB := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaignB.Id).Update("worker_concurrency", 1).Error)
	availableUser := model.User{Username: "recall-worker-fair-b", Password: "password", Email: "b@example.com", StripeCustomer: "cus_fair_b", AffCode: "fair-b"}
	require.NoError(t, model.DB.Create(&availableUser).Error)
	available := createRecallWorkerRecipient(t, campaignB.Id, availableUser.Id, model.RecallRecipientQueued)

	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			require.Equal(t, "cus_fair_b", id)
			return &stripe.Customer{ID: id}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_fair_b", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, processed)

	var storedStarved, storedAvailable model.RecallRecipient
	require.NoError(t, model.DB.First(&storedStarved, starved.Id).Error)
	require.NoError(t, model.DB.First(&storedAvailable, available.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, storedStarved.State)
	require.Equal(t, model.RecallRecipientContacting, storedAvailable.State)
}

func TestRecallWorkerRunBatchAdvancesBoundedScanAcrossTicks(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	for i := 0; i < recallRecipientScanPages; i++ {
		campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
		require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("worker_concurrency", 1).Error)
		blockerUser := model.User{
			Username: fmt.Sprintf("recall-worker-cursor-blocker-%d", i), Password: "password", Email: fmt.Sprintf("blocker-%d@example.com", i), AffCode: fmt.Sprintf("cursor-blocker-%d", i),
		}
		dueUser := model.User{
			Username: fmt.Sprintf("recall-worker-cursor-due-%d", i), Password: "password", Email: fmt.Sprintf("due-%d@example.com", i), AffCode: fmt.Sprintf("cursor-due-%d", i),
		}
		require.NoError(t, model.DB.Create(&blockerUser).Error)
		require.NoError(t, model.DB.Create(&dueUser).Error)
		blocker := createRecallWorkerRecipient(t, campaign.Id, blockerUser.Id, model.RecallRecipientQueued)
		createRecallWorkerRecipient(t, campaign.Id, dueUser.Id, model.RecallRecipientQueued)
		require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", blocker.Id).Updates(map[string]any{
			"lease_owner": fmt.Sprintf("capacity-holder-%d", i), "lease_expires_at": recallWorkerTestNow + recallRecipientLeaseSeconds,
		}).Error)
	}

	availableCampaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", availableCampaign.Id).Update("worker_concurrency", 1).Error)
	availableUser := model.User{Username: "recall-worker-cursor-available", Password: "password", Email: "cursor-available@example.com", StripeCustomer: "cus_cursor_available", AffCode: "cursor-available"}
	require.NoError(t, model.DB.Create(&availableUser).Error)
	available := createRecallWorkerRecipient(t, availableCampaign.Id, availableUser.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			require.Equal(t, "cus_cursor_available", id)
			return &stripe.Customer{ID: id}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_cursor_available", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 1)
	require.NoError(t, err)
	require.Zero(t, processed)
	processed, err = worker.RunBatch(context.Background(), 1)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, available.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
}

func TestRecallWorkerCanceledConcurrentBatchDoesNotWaitForActiveScan(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-scan-cancel", Password: "password", Email: "scan-cancel@example.com", StripeCustomer: "cus_scan_cancel", AffCode: "scan-cancel"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id": "cus_scan_cancel", "promotion_code": "FKSCAN234",
	}).Error)
	started := make(chan struct{}, 1)
	release := make(chan struct{})
	t.Cleanup(func() {
		select {
		case <-release:
		default:
			close(release)
		}
	})
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		started <- struct{}{}
		select {
		case <-release:
			return recallWorkerPromotionFromParams("promo_scan_cancel", params), nil
		case <-time.After(2 * time.Second):
			return nil, fmt.Errorf("timed out waiting to release scan cancellation test")
		}
	}}
	worker := newRecallWorkerForTest(client, "node-a")
	activeDone := make(chan error, 1)
	go func() {
		_, err := worker.RunBatch(context.Background(), 1)
		activeDone <- err
	}()
	select {
	case <-started:
	case <-time.After(2 * time.Second):
		t.Fatal("active batch did not reach the external call")
	}

	canceledCtx, cancel := context.WithCancel(context.Background())
	cancel()
	canceledDone := make(chan error, 1)
	go func() {
		_, err := worker.RunBatch(canceledCtx, 1)
		canceledDone <- err
	}()
	select {
	case err := <-canceledDone:
		require.ErrorIs(t, err, context.Canceled)
	case <-time.After(200 * time.Millisecond):
		close(release)
		select {
		case <-activeDone:
		case <-time.After(2 * time.Second):
		}
		t.Fatal("canceled batch waited for the active scan")
	}
	close(release)
	select {
	case err := <-activeDone:
		require.NoError(t, err)
	case <-time.After(2 * time.Second):
		t.Fatal("active batch did not finish after release")
	}
}

func TestRecallWorkerRunBatchHonorsCampaignConcurrencyAcrossWorkers(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("worker_concurrency", 1).Error)

	recipientIDs := make([]int64, 0, 2)
	for i, code := range []string{"FKAAAA234", "FKBBBB234"} {
		user := model.User{
			Username:       fmt.Sprintf("recall-worker-node-cap-%d", i),
			Password:       "password",
			Email:          fmt.Sprintf("node-cap-%d@example.com", i),
			AffCode:        fmt.Sprintf("worker-node-cap-%d", i),
			StripeCustomer: fmt.Sprintf("cus_node_cap_%d", i),
		}
		require.NoError(t, model.DB.Create(&user).Error)
		recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
		require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
			"stripe_customer_id": user.StripeCustomer,
			"promotion_code":     code,
		}).Error)
		recipientIDs = append(recipientIDs, recipient.Id)
	}

	started := make(chan int64, 2)
	release := make(chan struct{})
	t.Cleanup(func() { closeRecallWorkerTestSignal(release) })
	var active atomic.Int32
	var peak atomic.Int32
	var createCalls atomic.Int32
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		var recipientID int64
		_, err := fmt.Sscan(params.Metadata["recall_recipient_id"], &recipientID)
		require.NoError(t, err)
		createCalls.Add(1)
		current := active.Add(1)
		for {
			observed := peak.Load()
			if current <= observed || peak.CompareAndSwap(observed, current) {
				break
			}
		}
		started <- recipientID
		select {
		case <-release:
		case <-time.After(2 * time.Second):
			return nil, fmt.Errorf("timed out waiting to release cross-worker concurrency test")
		}
		active.Add(-1)
		return recallWorkerPromotionFromParams(fmt.Sprintf("promo_node_cap_%d", recipientID), params), nil
	}}
	workerA := newRecallWorkerForTest(client, "node-a")
	workerB := newRecallWorkerForTest(client, "node-b")
	type runResult struct {
		processed int
		err       error
	}
	firstDone := make(chan runResult, 1)
	go func() {
		processed, err := workerA.RunBatch(context.Background(), 1)
		firstDone <- runResult{processed: processed, err: err}
	}()
	select {
	case recipientID := <-started:
		require.Equal(t, recipientIDs[0], recipientID)
	case firstResult := <-firstDone:
		require.NoError(t, firstResult.err)
		t.Fatal("first worker finished before reaching the external call")
	case <-time.After(2 * time.Second):
		t.Fatal("first worker did not reach the external call")
	}

	secondDone := make(chan runResult, 1)
	go func() {
		processed, err := workerB.RunBatch(context.Background(), 2)
		secondDone <- runResult{processed: processed, err: err}
	}()
	var secondResult runResult
	secondFinished := false
	secondStarted := false
	select {
	case <-started:
		secondStarted = true
	case secondResult = <-secondDone:
		secondFinished = true
	case <-time.After(2 * time.Second):
		closeRecallWorkerTestSignal(release)
		firstResult := receiveRecallWorkerTest(t, firstDone, "first cross-worker completion")
		require.NoError(t, firstResult.err)
		t.Fatal("second worker did not finish or start an external call")
	}
	closeRecallWorkerTestSignal(release)
	firstResult := receiveRecallWorkerTest(t, firstDone, "first cross-worker completion")
	require.NoError(t, firstResult.err)
	require.Equal(t, 1, firstResult.processed)
	if !secondFinished {
		secondResult = receiveRecallWorkerTest(t, secondDone, "second cross-worker completion")
	}
	require.NoError(t, secondResult.err)
	require.False(t, secondStarted, "campaign capacity must be shared across worker owners")
	require.Zero(t, secondResult.processed)
	require.Equal(t, int32(1), peak.Load())

	processed, err := workerB.RunBatch(context.Background(), 2)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, int32(1), peak.Load())

	var stored []model.RecallRecipient
	require.NoError(t, model.DB.Where("id IN ?", recipientIDs).Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	require.NotNil(t, stored[0].StripePromotionCodeId)
	require.NotNil(t, stored[1].StripePromotionCodeId)
	require.NotEqual(t, *stored[0].StripePromotionCodeId, *stored[1].StripePromotionCodeId)
	require.Equal(t, int32(2), createCalls.Load())
}

func TestRecallWorkerReacquiresCampaignCapacityBetweenStagesAcrossWorkers(t *testing.T) {
	db := setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("worker_concurrency", 1).Error)

	userB := model.User{
		Username: "recall-worker-stage-node-b", Password: "password", Email: "stage-node-b@example.com", AffCode: "worker-stage-node-b",
	}
	require.NoError(t, model.DB.Create(&userB).Error)
	recipientB := createRecallWorkerRecipient(t, campaign.Id, userB.Id, model.RecallRecipientQueued)
	userA := model.User{
		Username: "recall-worker-stage-node-a", Password: "password", Email: "stage-node-a@example.com", AffCode: "worker-stage-node-a",
	}
	require.NoError(t, model.DB.Create(&userA).Error)
	recipientA := createRecallWorkerRecipient(t, campaign.Id, userA.Id, model.RecallRecipientQueued)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipientA.Id).Update("promotion_code", "FKAAAA234").Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipientB.Id).Update("promotion_code", "FKBBBB234").Error)

	aAdvanced := make(chan struct{})
	allowAContinue := make(chan struct{})
	t.Cleanup(func() { closeRecallWorkerTestSignal(allowAContinue) })
	callbackName := "recall_worker_pause_after_customer_stage"
	var pauseOnce sync.Once
	require.NoError(t, db.Callback().Update().After("gorm:commit_or_rollback_transaction").Register(callbackName, func(tx *gorm.DB) {
		if tx.Error != nil || tx.Statement.Table != "recall_recipients" {
			return
		}
		updates, ok := tx.Statement.Dest.(map[string]any)
		if !ok || updates["state"] != model.RecallRecipientCustomerReady {
			return
		}
		pauseOnce.Do(func() {
			close(aAdvanced)
			select {
			case <-allowAContinue:
			case <-time.After(2 * time.Second):
				tx.AddError(fmt.Errorf("timed out waiting to continue customer stage"))
			}
		})
	}))

	bCustomerStarted := make(chan struct{}, 1)
	promotionStarted := make(chan int64, 2)
	releaseExternal := make(chan struct{})
	t.Cleanup(func() { closeRecallWorkerTestSignal(releaseExternal) })
	var active atomic.Int32
	var peak atomic.Int32
	var createPromotionCalls atomic.Int32
	recordExternalStart := func() {
		current := active.Add(1)
		for {
			observed := peak.Load()
			if current <= observed || peak.CompareAndSwap(observed, current) {
				return
			}
		}
	}
	client := &recallStripeFakeClient{
		createCustomerFn: func(_ context.Context, params *stripe.CustomerParams) (*stripe.Customer, error) {
			recordExternalStart()
			userID := params.Metadata["flatkey_user_id"]
			if userID == fmt.Sprint(userB.Id) {
				bCustomerStarted <- struct{}{}
				select {
				case <-releaseExternal:
				case <-time.After(2 * time.Second):
					return nil, fmt.Errorf("timed out waiting to release customer creation")
				}
			}
			active.Add(-1)
			return &stripe.Customer{ID: "cus_stage_" + userID}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			recordExternalStart()
			createPromotionCalls.Add(1)
			var recipientID int64
			_, err := fmt.Sscan(params.Metadata["recall_recipient_id"], &recipientID)
			require.NoError(t, err)
			promotionStarted <- recipientID
			select {
			case <-releaseExternal:
			case <-time.After(2 * time.Second):
				return nil, fmt.Errorf("timed out waiting to release promotion creation")
			}
			active.Add(-1)
			return recallWorkerPromotionFromParams(fmt.Sprintf("promo_stage_%d", recipientID), params), nil
		},
	}
	workerA := newRecallWorkerForTest(client, "node-a")
	workerB := newRecallWorkerForTest(client, "node-b")
	won, err := model.TryLeaseRecallRecipientWithinCampaignCapacity(
		context.Background(), recipientA.Id, workerA.owner, recallWorkerTestNow, recallWorkerTestNow+recallRecipientLeaseSeconds,
	)
	require.NoError(t, err)
	require.True(t, won)

	aDone := make(chan error, 1)
	go func() { aDone <- workerA.ProcessLeased(context.Background(), recipientA.Id) }()
	select {
	case <-aAdvanced:
	case err := <-aDone:
		closeRecallWorkerTestSignal(allowAContinue)
		closeRecallWorkerTestSignal(releaseExternal)
		require.NoError(t, err)
		t.Fatal("worker A finished before its customer-ready lease was released")
	case <-time.After(2 * time.Second):
		closeRecallWorkerTestSignal(allowAContinue)
		closeRecallWorkerTestSignal(releaseExternal)
		t.Fatal("worker A did not reach the committed customer-ready transition")
	}

	type runResult struct {
		processed int
		err       error
	}
	bDone := make(chan runResult, 1)
	go func() {
		processed, err := workerB.RunBatch(context.Background(), 1)
		bDone <- runResult{processed: processed, err: err}
	}()
	select {
	case <-bCustomerStarted:
	case result := <-bDone:
		closeRecallWorkerTestSignal(allowAContinue)
		closeRecallWorkerTestSignal(releaseExternal)
		require.NoError(t, result.err)
		t.Fatal("worker B finished before occupying campaign capacity")
	case <-time.After(2 * time.Second):
		closeRecallWorkerTestSignal(allowAContinue)
		closeRecallWorkerTestSignal(releaseExternal)
		t.Fatal("worker B did not occupy campaign capacity")
	}

	closeRecallWorkerTestSignal(allowAContinue)
	var aErr error
	aFinished := false
	aPromotionStarted := false
	select {
	case recipientID := <-promotionStarted:
		aPromotionStarted = recipientID == recipientA.Id
	case aErr = <-aDone:
		aFinished = true
	case <-time.After(2 * time.Second):
		closeRecallWorkerTestSignal(releaseExternal)
		receiveRecallWorkerTest(t, bDone, "worker B completion after stage timeout")
		t.Fatal("worker A neither yielded capacity nor entered its next external call")
	}
	closeRecallWorkerTestSignal(releaseExternal)
	if !aFinished {
		aErr = receiveRecallWorkerTest(t, aDone, "worker A completion")
	}
	bResult := receiveRecallWorkerTest(t, bDone, "worker B completion")
	require.False(t, aPromotionStarted, "worker A must not bypass worker B's campaign lease between stages")
	require.ErrorIs(t, aErr, ErrRecallRecipientLeaseLost)
	require.NoError(t, bResult.err)
	require.Equal(t, 1, bResult.processed)
	require.Equal(t, int32(1), peak.Load())

	processed, err := workerA.RunBatch(context.Background(), 2)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, int32(2), createPromotionCalls.Load())
	var stored []model.RecallRecipient
	require.NoError(t, model.DB.Where("id IN ?", []int64{recipientA.Id, recipientB.Id}).Order("id ASC").Find(&stored).Error)
	require.Len(t, stored, 2)
	require.Equal(t, model.RecallRecipientContacting, stored[0].State)
	require.Equal(t, model.RecallRecipientContacting, stored[1].State)
}

func TestRecallWorkerPersistsPromotionAfterLeaseLossWithoutAdvancing(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-promo-lease", Password: "password", Email: "promo-lease@example.com", StripeCustomer: "cus_lease"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id": "cus_lease", "promotion_code": "FKSXFE234",
	}).Error)
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
			"lease_owner": "node-b", "lease_expires_at": recallWorkerTestNow + 120,
		}).Error)
		promotion := recallWorkerPromotionFromParams("promo_after_lease_loss", params)
		promotion.Code = "FKNEW234"
		return promotion, nil
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientCustomerReady, stored.State)
	require.Equal(t, "node-b", stored.LeaseOwner)
	require.NotNil(t, stored.StripePromotionCodeId)
	require.Equal(t, "promo_after_lease_loss", *stored.StripePromotionCodeId)
	require.Equal(t, "FKNEW234", stored.PromotionCode)
	var messageCount int64
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Count(&messageCount).Error)
	require.Zero(t, messageCount)
}

func TestRecallWorkerPersistsCustomerAfterLeaseLossWithoutAdvancing(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-customer-lease", Password: "password", Email: "customer-lease@example.com"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	updateCalls := 0
	client := &recallStripeFakeClient{
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
				"lease_owner": "node-b", "lease_expires_at": recallWorkerTestNow + 120,
			}).Error)
			return &stripe.Customer{ID: "cus_after_lease_loss"}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			updateCalls++
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, stored.State)
	require.Equal(t, "node-b", stored.LeaseOwner)
	require.Equal(t, "cus_after_lease_loss", stored.StripeCustomerId)
	storedUser, err := model.GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_after_lease_loss", storedUser.StripeCustomer)
	require.Zero(t, updateCalls)
}

func TestRecallWorkerPersistsCustomerBeforeRetryableEmailSyncFailure(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-customer-durable", Password: "password", Email: "durable@example.com"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)

	createCalls := 0
	updateCalls := 0
	updateSucceeds := false
	client := &recallStripeFakeClient{
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			createCalls++
			return &stripe.Customer{ID: "cus_durable"}, nil
		},
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			require.Equal(t, "cus_durable", id)
			return &stripe.Customer{ID: id}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			updateCalls++
			if !updateSucceeds {
				return nil, recallStripeTimeout{}
			}
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_durable", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 1, createCalls)
	require.Equal(t, 3, updateCalls)

	storedUser, err := model.GetUserByIdWithContext(context.Background(), user.Id)
	require.NoError(t, err)
	require.Equal(t, "cus_durable", storedUser.StripeCustomer)
	var storedRecipient model.RecallRecipient
	require.NoError(t, model.DB.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, storedRecipient.State)
	require.Equal(t, "cus_durable", storedRecipient.StripeCustomerId)

	updateSucceeds = true
	worker.now = func() time.Time { return time.Unix(recallWorkerTestNow+recallRecipientRetrySeconds+1, 0).UTC() }
	processed, err = worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 1, processed)
	require.Equal(t, 1, createCalls)
	require.Equal(t, 4, updateCalls)
	require.NoError(t, model.DB.First(&storedRecipient, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, storedRecipient.State)
	require.Equal(t, "cus_durable", storedRecipient.StripeCustomerId)
}

func TestRecallWorkerTransientStripeErrorDefersOnlyRecipient(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-transient", Password: "password", Email: "transient@example.com", StripeCustomer: "cus_transient"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
		return nil, recallStripeTimeout{}
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, stored.State)
	require.Empty(t, stored.LeaseOwner)
	require.Equal(t, recallWorkerTestNow+recallRecipientRetrySeconds, stored.LeaseExpiresAt)
	require.Equal(t, "stripe_retryable", stored.LastErrorCode)
}

func TestRecallWorkerPermanentCustomerErrorFailsOnlyOneRecipient(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	badUser := model.User{Username: "recall-worker-bad", Password: "password", Email: "bad@example.com", StripeCustomer: "cus_bad", AffCode: "worker-bad"}
	goodUser := model.User{Username: "recall-worker-good", Password: "password", Email: "good@example.com", StripeCustomer: "cus_good", AffCode: "worker-good"}
	require.NoError(t, model.DB.Create(&badUser).Error)
	require.NoError(t, model.DB.Create(&goodUser).Error)
	badRecipient := createRecallWorkerRecipient(t, campaign.Id, badUser.Id, model.RecallRecipientQueued)
	goodRecipient := createRecallWorkerRecipient(t, campaign.Id, goodUser.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) {
			if id == "cus_bad" {
				return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "customer", Msg: "invalid customer"}
			}
			return &stripe.Customer{ID: id}, nil
		},
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_good", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 2, processed)
	var badStored, goodStored model.RecallRecipient
	require.NoError(t, model.DB.First(&badStored, badRecipient.Id).Error)
	require.NoError(t, model.DB.First(&goodStored, goodRecipient.Id).Error)
	require.Equal(t, model.RecallRecipientFailed, badStored.State)
	require.Equal(t, model.RecallRecipientContacting, goodStored.State)
}

func TestRecallWorkerPermanentPromotionErrorFailsOnlyOneRecipient(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	badUser := model.User{Username: "recall-worker-promo-bad", Password: "password", Email: "promo-bad@example.com", StripeCustomer: "cus_promo_bad", AffCode: "worker-promo-bad"}
	goodUser := model.User{Username: "recall-worker-promo-good", Password: "password", Email: "promo-good@example.com", StripeCustomer: "cus_promo_good", AffCode: "worker-promo-good"}
	require.NoError(t, model.DB.Create(&badUser).Error)
	require.NoError(t, model.DB.Create(&goodUser).Error)
	badRecipient := createRecallWorkerRecipient(t, campaign.Id, badUser.Id, model.RecallRecipientCustomerReady)
	goodRecipient := createRecallWorkerRecipient(t, campaign.Id, goodUser.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", badRecipient.Id).Updates(map[string]any{
		"stripe_customer_id": badUser.StripeCustomer,
		"promotion_code":     "FKBADP234",
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", goodRecipient.Id).Updates(map[string]any{
		"stripe_customer_id": goodUser.StripeCustomer,
		"promotion_code":     "FKGXXD234",
	}).Error)
	client := &recallStripeFakeClient{createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		if *params.Customer == badUser.StripeCustomer {
			return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "customer", Msg: "invalid customer"}
		}
		return recallWorkerPromotionFromParams("promo_good_sibling", params), nil
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	processed, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 2, processed)
	var badStored, goodStored model.RecallRecipient
	require.NoError(t, model.DB.First(&badStored, badRecipient.Id).Error)
	require.NoError(t, model.DB.First(&goodStored, goodRecipient.Id).Error)
	require.Equal(t, model.RecallRecipientFailed, badStored.State)
	require.Equal(t, model.RecallRecipientContacting, goodStored.State)
}

func TestRecallWorkerPromotionCollisionStopsAfterFiveAndFailsRecipient(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-collision", Password: "password", Email: "collision@example.com", StripeCustomer: "cus_collision"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientCustomerReady)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipient.Id).Updates(map[string]any{
		"stripe_customer_id": "cus_collision", "promotion_code": "FKBASE234",
	}).Error)
	var calls int
	client := &recallStripeFakeClient{createPromotionCodeFn: func(context.Context, *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
		calls++
		return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Param: "code", Msg: "code is already active"}
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Equal(t, 5, calls)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientFailed, stored.State)
}

func TestRecallWorkerPauseBetweenStripeCallsPreventsNextExternalCall(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-pause", Password: "password", Email: "pause@example.com", StripeCustomer: "cus_deleted"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	createCalls := 0
	client := &recallStripeFakeClient{
		getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
			require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignPaused).Error)
			return &stripe.Customer{ID: "cus_deleted", Deleted: true}, nil
		},
		createCustomerFn: func(context.Context, *stripe.CustomerParams) (*stripe.Customer, error) {
			createCalls++
			return nil, nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	require.Zero(t, createCalls)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, stored.State)
	require.Empty(t, stored.LeaseOwner)
}

func TestRecallWorkerCancelAfterLeasePreventsExternalCall(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-cancel", Password: "password", Email: "cancel@example.com", StripeCustomer: "cus_cancel"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	won, err := model.LeaseRecallRecipient(recipient.Id, "node-a", recallWorkerTestNow, recallWorkerTestNow+60)
	require.NoError(t, err)
	require.True(t, won)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Update("status", model.RecallCampaignCancelled).Error)

	externalCalls := 0
	client := &recallStripeFakeClient{getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
		externalCalls++
		return nil, &stripe.Error{Type: stripe.ErrorTypeInvalidRequest, Msg: "must not be called"}
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	require.NoError(t, worker.ProcessLeased(context.Background(), recipient.Id))
	require.Zero(t, externalCalls)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientQueued, stored.State)
	require.Empty(t, stored.LeaseOwner)
}

func TestRecallWorkerFeatureDisableAfterLeasePreventsExternalCall(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-disabled", Password: "password", Email: "disabled@example.com", StripeCustomer: "cus_disabled"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	won, err := model.LeaseRecallRecipient(recipient.Id, "node-a", recallWorkerTestNow, recallWorkerTestNow+60)
	require.NoError(t, err)
	require.True(t, won)
	loadRecallCampaignEnabled(t, false)
	externalCalls := 0
	client := &recallStripeFakeClient{getCustomerFn: func(context.Context, string) (*stripe.Customer, error) {
		externalCalls++
		return nil, nil
	}}
	worker := newRecallWorkerForTest(client, "node-a")

	require.NoError(t, worker.ProcessLeased(context.Background(), recipient.Id))
	require.Zero(t, externalCalls)
}

func TestRecallWorkerCompletedCampaignFinishesEnrolledRecipient(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignCompleted)
	user := model.User{Username: "recall-worker-completed", Password: "password", Email: "completed@example.com", StripeCustomer: "cus_completed"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	client := &recallStripeFakeClient{
		getCustomerFn: func(_ context.Context, id string) (*stripe.Customer, error) { return &stripe.Customer{ID: id}, nil },
		updateCustomerFn: func(_ context.Context, id string, params *stripe.CustomerParams) (*stripe.Customer, error) {
			return &stripe.Customer{ID: id, Email: *params.Email}, nil
		},
		createPromotionCodeFn: func(_ context.Context, params *stripe.PromotionCodeParams) (*stripe.PromotionCode, error) {
			return recallWorkerPromotionFromParams("promo_completed", params), nil
		},
	}
	worker := newRecallWorkerForTest(client, "node-a")

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipient.Id).Error)
	require.Equal(t, model.RecallRecipientContacting, stored.State)
}

func TestRecallWorkerLogsOnlyIDsAndErrorClass(t *testing.T) {
	setupRecallCampaignTestDB(t)
	setRecallCampaignEnabled(t, true)
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignRunning)
	user := model.User{Username: "recall-worker-log", Password: "password", Email: "secret-email@example.com", StripeCustomer: "cus_log"}
	require.NoError(t, model.DB.Create(&user).Error)
	recipient := createRecallWorkerRecipient(t, campaign.Id, user.Id, model.RecallRecipientQueued)
	secretError := workerSecretTimeout("FKSECRETCODE claim-secret email-body secret-email@example.com")
	client := &recallStripeFakeClient{getCustomerFn: func(context.Context, string) (*stripe.Customer, error) { return nil, secretError }}
	worker := newRecallWorkerForTest(client, "node-a")
	var logBuffer bytes.Buffer
	common.LogWriterMu.Lock()
	originalWriter := gin.DefaultErrorWriter
	gin.DefaultErrorWriter = &logBuffer
	common.LogWriterMu.Unlock()
	t.Cleanup(func() {
		common.LogWriterMu.Lock()
		gin.DefaultErrorWriter = originalWriter
		common.LogWriterMu.Unlock()
	})

	_, err := worker.RunBatch(context.Background(), 10)
	require.NoError(t, err)
	logged := logBuffer.String()
	require.Contains(t, logged, fmt.Sprintf("recipient_id=%d", recipient.Id))
	require.Contains(t, logged, "error_class=retryable")
	for _, secret := range []string{"FKSECRETCODE", "claim-secret", "email-body", "secret-email@example.com"} {
		require.NotContains(t, logged, secret)
	}
}

func newRecallWorkerForTest(client RecallStripeClient, owner string) *RecallRecipientWorker {
	stripeService := NewRecallStripeService(client)
	stripeService.codeGenerator = func(int) (string, error) { return "WORKER234", nil }
	worker := NewRecallRecipientWorker(stripeService, NewRecallClaimService(), owner)
	worker.now = func() time.Time { return time.Unix(recallWorkerTestNow, 0).UTC() }
	return worker
}

func setRecallRuntimeForTest(t *testing.T, runtime *RecallRuntime) {
	t.Helper()
	originalRuntime := recallRuntime
	recallRuntime = runtime
	recallRuntimeOnce = sync.Once{}
	recallRuntimeOnce.Do(func() {})
	t.Cleanup(func() {
		recallRuntime = originalRuntime
		recallRuntimeOnce = sync.Once{}
		if originalRuntime != nil {
			recallRuntimeOnce.Do(func() {})
		}
	})
}

type workerSecretTimeout string

func (e workerSecretTimeout) Error() string { return string(e) }
func (workerSecretTimeout) Timeout() bool   { return true }
func (workerSecretTimeout) Temporary() bool { return true }

func createRecallWorkerCampaign(t *testing.T, status string) model.RecallCampaign {
	t.Helper()
	discountJSON, err := common.Marshal(RecallDiscountConfig{MinimumAmount: 2500, MinimumAmountCurrency: "usd"})
	require.NoError(t, err)
	emailJSON, err := common.Marshal([]RecallEmailStage{{
		StageNo: 1, DelaySeconds: 60, TemplateVersion: 1,
		Templates: map[string]RecallEmailTemplate{"en": {Subject: "Return", BodyText: "Offer body"}},
	}})
	require.NoError(t, err)
	campaign := model.RecallCampaign{
		Name: "worker campaign", Status: status, AudienceTemplate: "inactive_users", AudienceConfig: `{}`,
		ExecutionMode: "manual", CouponSource: "existing", StripeCouponId: "coupon_worker",
		DiscountConfig: string(discountJSON), ProductScope: `{}`, PromotionValidSeconds: 3600,
		EmailSequenceConfig: string(emailJSON), EnrollmentLimit: 100, WorkerConcurrency: 2,
	}
	require.NoError(t, model.DB.Create(&campaign).Error)
	return campaign
}

func createRecallWorkerContentOnlyCampaign(t *testing.T, status string, executionMode string) model.RecallCampaign {
	t.Helper()
	campaign := createRecallWorkerCampaign(t, status)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", campaign.Id).Updates(map[string]any{
		"campaign_type":           model.RecallCampaignTypeContentOnly,
		"execution_mode":          executionMode,
		"coupon_source":           "",
		"stripe_coupon_id":        "",
		"discount_config":         `{}`,
		"product_scope":           `{}`,
		"promotion_valid_seconds": int64(0),
		"recurrence_config":       `{}`,
		"scheduled_at":            int64(0),
		"next_run_at":             int64(0),
		"worker_concurrency":      2,
		"email_sequence_config":   campaign.EmailSequenceConfig,
		"audience_template":       campaign.AudienceTemplate,
		"audience_config":         campaign.AudienceConfig,
		"enrollment_limit":        campaign.EnrollmentLimit,
		"completed_at":            campaign.CompletedAt,
		"created_by":              campaign.CreatedBy,
		"config_revision":         campaign.ConfigRevision,
		"name":                    campaign.Name,
		"status":                  status,
	}).Error)
	require.NoError(t, model.DB.First(&campaign, campaign.Id).Error)
	return campaign
}

func createRecallWorkerRecipient(t *testing.T, campaignID int64, userID int, state string) model.RecallRecipient {
	t.Helper()
	recipient := model.RecallRecipient{
		CampaignId: campaignID, UserId: userID, EligibilitySnapshot: `{}`, EmailSnapshot: "snapshot@example.com",
		LanguageSnapshot: "en", State: state, PromotionExpiresAt: 1_900_000_000,
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	return recipient
}

func createRecallRevocationRecipient(t *testing.T, expiresAt int64) model.RecallRecipient {
	t.Helper()
	campaign := createRecallWorkerCampaign(t, model.RecallCampaignCancelled)
	promotionID := "promo_revoke_active"
	recipient := model.RecallRecipient{
		CampaignId: campaign.Id, UserId: 901, EligibilitySnapshot: `{}`, EmailSnapshot: "revocation@example.com",
		LanguageSnapshot: "en", State: model.RecallRecipientContacting, StripePromotionCodeId: &promotionID,
		PromotionCode: "REVOKE123", PromotionExpiresAt: expiresAt,
		PromotionRevocationState: model.RecallPromotionRevocationPending,
	}
	require.NoError(t, model.DB.Create(&recipient).Error)
	return recipient
}

func loadRecallRecipientForTest(t *testing.T, recipientID int64) model.RecallRecipient {
	t.Helper()
	var stored model.RecallRecipient
	require.NoError(t, model.DB.First(&stored, recipientID).Error)
	return stored
}

func recallWorkerPromotionFromParams(id string, params *stripe.PromotionCodeParams) *stripe.PromotionCode {
	promotion := &stripe.PromotionCode{
		ID: id, Active: true, Code: *params.Code, Promotion: recallTestCouponPromotion(*params.Promotion.Coupon), Customer: &stripe.Customer{ID: *params.Customer},
		ExpiresAt: *params.ExpiresAt, MaxRedemptions: *params.MaxRedemptions,
	}
	if params.Restrictions != nil {
		promotion.Restrictions = &stripe.PromotionCodeRestrictions{
			MinimumAmount:         *params.Restrictions.MinimumAmount,
			MinimumAmountCurrency: stripe.Currency(*params.Restrictions.MinimumAmountCurrency),
		}
	}
	return promotion
}

func receiveRecallWorkerTest[T any](t *testing.T, ch <-chan T, event string) T {
	t.Helper()
	select {
	case value := <-ch:
		return value
	case <-time.After(2 * time.Second):
		t.Fatalf("timed out waiting for %s", event)
		var zero T
		return zero
	}
}

func closeRecallWorkerTestSignal(ch chan struct{}) {
	select {
	case <-ch:
	default:
		close(ch)
	}
}
