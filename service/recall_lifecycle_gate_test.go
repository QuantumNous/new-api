package service

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestRecallLifecycleSendGateMutableEligibility(t *testing.T) {
	tests := []struct {
		name       string
		trigger    string
		eventData  map[string]any
		seed       func(t *testing.T, f recallEmailFixture, event model.RecallLifecycleEvent)
		wantReason string
		wantSend   bool
		wantTo     string
	}{
		{
			name:    "user registered requires usable current email",
			trigger: model.RecallLifecycleTriggerUserRegistered,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				updateRecallLifecycleUserEmail(t, f.user.Id, "")
			},
			wantReason: "no_account_email",
		},
		{
			name:    "user registered ignores empty enrollment snapshot when current email is valid",
			trigger: model.RecallLifecycleTriggerUserRegistered,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				updateRecallLifecycleRecipientEmailSnapshot(t, f.recipient.Id, "")
				updateRecallLifecycleUserEmail(t, f.user.Id, "current-empty-snapshot@example.com")
			},
			wantSend: true,
			wantTo:   "current-empty-snapshot@example.com",
		},
		{
			name:    "user registered ignores invalid enrollment snapshot when current email is valid",
			trigger: model.RecallLifecycleTriggerUserRegistered,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				updateRecallLifecycleRecipientEmailSnapshot(t, f.recipient.Id, "not an email")
				updateRecallLifecycleUserEmail(t, f.user.Id, "current-invalid-snapshot@example.com")
			},
			wantSend: true,
			wantTo:   "current-invalid-snapshot@example.com",
		},
		{
			name:    "user registered blocks invalid current email at SMTP gate",
			trigger: model.RecallLifecycleTriggerUserRegistered,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				updateRecallLifecycleRecipientEmailSnapshot(t, f.recipient.Id, "stale@example.com")
				updateRecallLifecycleUserEmail(t, f.user.Id, "not an email")
			},
			wantReason: "invalid_email",
		},
		{
			name:    "registration unused stops after first request",
			trigger: model.RecallLifecycleTriggerRegistrationUnused,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", f.user.Id).Update("request_count", 1).Error)
			},
			wantReason: "registration_used",
		},
		{
			name:    "quota low requires same cycle and current low positive balance",
			trigger: model.RecallLifecycleTriggerQuotaLow,
			eventData: map[string]any{
				"scope_type":       model.QuotaLifecycleScopeWallet,
				"scope_id":         "2",
				"cycle_key":        "wallet-cycle-a",
				"current_balance":  float64(50),
				"threshold":        float64(100),
				"previous_balance": float64(150),
			},
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				setRecallLifecycleQuotaWarningThreshold(t, f.user.Id, 100)
				seedRecallLifecycleQuotaState(t, f.user.Id, model.QuotaLifecycleScopeWallet, "2", "wallet-cycle-a", 150, 100)
			},
			wantReason: "quota_recovered",
		},
		{
			name:    "quota exhausted stops when cycle changed",
			trigger: model.RecallLifecycleTriggerQuotaExhaustedUnpaid,
			eventData: map[string]any{
				"scope_type":       model.QuotaLifecycleScopeWallet,
				"scope_id":         "2",
				"cycle_key":        "wallet-cycle-a",
				"current_balance":  float64(0),
				"previous_balance": float64(10),
			},
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				seedRecallLifecycleQuotaState(t, f.user.Id, model.QuotaLifecycleScopeWallet, "2", "wallet-cycle-b", 0, 100)
			},
			wantReason: "quota_cycle_changed",
		},
		{
			name:    "payment failed requires current topup failed",
			trigger: model.RecallLifecycleTriggerPaymentFailed,
			eventData: map[string]any{
				"purchase_kind": model.PurchaseLifecycleKindTopUp,
				"trade_no":      "gate-topup-failed",
				"to_status":     common.TopUpStatusFailed,
			},
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				seedRecallLifecycleTopUp(t, f.user.Id, "gate-topup-failed", common.TopUpStatusSuccess)
			},
			wantReason: "order_state_changed",
		},
		{
			name:    "payment pending requires current subscription pending",
			trigger: model.RecallLifecycleTriggerPaymentPending,
			eventData: map[string]any{
				"purchase_kind": model.PurchaseLifecycleKindSubscription,
				"trade_no":      "gate-sub-pending",
				"to_status":     common.TopUpStatusPending,
			},
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				seedRecallLifecycleSubscriptionOrder(t, f.user.Id, "gate-sub-pending", common.TopUpStatusFailed)
			},
			wantReason: "order_state_changed",
		},
		{
			name:    "payment succeeded requires current topup success",
			trigger: model.RecallLifecycleTriggerPaymentSucceeded,
			eventData: map[string]any{
				"purchase_kind": model.PurchaseLifecycleKindTopUp,
				"trade_no":      "gate-topup-success",
				"to_status":     common.TopUpStatusSuccess,
			},
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				seedRecallLifecycleTopUp(t, f.user.Id, "gate-topup-success", common.TopUpStatusPending)
			},
			wantReason: "order_state_changed",
		},
		{
			name:    "enrollment email snapshot refreshes to current account email",
			trigger: model.RecallLifecycleTriggerUserRegistered,
			seed: func(t *testing.T, f recallEmailFixture, _ model.RecallLifecycleEvent) {
				updateRecallLifecycleUserEmail(t, f.user.Id, "new-account@example.com")
			},
			wantSend:   true,
			wantTo:     "new-account@example.com",
			wantReason: "",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			fixture := newRecallLifecycleEmailFixture(t, tc.trigger, tc.eventData)
			if tc.seed != nil {
				tc.seed(t, fixture, loadRecallLifecycleEventForRecipient(t, fixture.recipient.Id))
			}

			err := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

			require.NoError(t, err)
			if tc.wantSend {
				require.Len(t, *fixture.sent, 1)
				require.Equal(t, tc.wantTo, (*fixture.sent)[0].receiver)
				var refreshed model.RecallRecipient
				require.NoError(t, model.DB.First(&refreshed, fixture.recipient.Id).Error)
				require.Equal(t, tc.wantTo, refreshed.EmailSnapshot)
				return
			}
			require.Empty(t, *fixture.sent)
			stored := loadRecallEmailMessageByID(t, fixture.message.Id)
			require.Equal(t, model.RecallMessageCancelled, stored.State)
			require.Equal(t, tc.wantReason, stored.LastErrorCode)
			assertRecallLifecycleSMTPAdmissionDidNotConsume(t)
		})
	}
}

func TestRecallLifecycleSendGateFenceLossDoesNotCancelOrConsume(t *testing.T) {
	fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerUserRegistered, nil)

	err := model.DB.Model(&model.RecallMessage{}).
		Where("id = ?", fixture.message.Id).
		Updates(map[string]any{"lease_owner": "other-owner", "lease_expires_at": fixture.message.LeaseExpiresAt + 1}).Error
	require.NoError(t, err)

	processErr := fixture.worker.ProcessLeased(context.Background(), fixture.message.Id)

	require.ErrorIs(t, processErr, ErrRecallEmailLeaseLost)
	require.Empty(t, *fixture.sent)
	stored := loadRecallEmailMessageByID(t, fixture.message.Id)
	require.Equal(t, model.RecallMessageLeased, stored.State)
	require.Equal(t, "other-owner", stored.LeaseOwner)
	assertRecallLifecycleSMTPAdmissionDidNotConsume(t)
}

func TestRecallLifecycleQuotaLowUsesCurrentEffectiveThreshold(t *testing.T) {
	tests := []struct {
		name             string
		eventThreshold   int64
		currentThreshold float64
		balance          int64
		wantSend         bool
	}{
		{
			name:             "sends when current threshold rises above current balance",
			eventThreshold:   100,
			currentThreshold: 200,
			balance:          150,
			wantSend:         true,
		},
		{
			name:             "suppresses when current threshold drops below current balance",
			eventThreshold:   200,
			currentThreshold: 100,
			balance:          150,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			data := map[string]any{
				"scope_type":       model.QuotaLifecycleScopeWallet,
				"scope_id":         "2",
				"cycle_key":        "threshold-cycle",
				"current_balance":  float64(50),
				"threshold":        float64(tc.eventThreshold),
				"previous_balance": float64(250),
			}
			fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerQuotaLow, data)
			setRecallLifecycleQuotaWarningThreshold(t, fixture.user.Id, tc.currentThreshold)
			seedRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeWallet, "2", "threshold-cycle", tc.balance, tc.eventThreshold)

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			if tc.wantSend {
				require.Len(t, *fixture.sent, 1)
				require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
				return
			}
			require.Empty(t, *fixture.sent)
			require.Equal(t, "quota_recovered", loadRecallEmailMessageByID(t, fixture.message.Id).LastErrorCode)
			assertRecallLifecycleSMTPAdmissionDidNotConsume(t)
		})
	}
}

func TestRecallLifecycleQuotaExhaustedRecoveryIsScopeAware(t *testing.T) {
	tests := []struct {
		name       string
		scopeType  string
		scopeID    string
		seed       func(t *testing.T, fixture recallEmailFixture)
		wantSend   bool
		wantReason string
	}{
		{
			name:      "wallet ignores unrelated subscription success",
			scopeType: model.QuotaLifecycleScopeWallet,
			scopeID:   "2",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleSubscriptionOrder(t, fixture.user.Id, "unrelated-subscription-success", common.TopUpStatusSuccess)
			},
			wantSend: true,
		},
		{
			name:      "subscription ignores unrelated wallet topup success",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleTopUp(t, fixture.user.Id, "unrelated-wallet-success", common.TopUpStatusSuccess)
			},
			wantSend: true,
		},
		{
			name:      "subscription ignores a different subscription success",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleSubscriptionOrder(t, fixture.user.Id, "other-subscription-success", common.TopUpStatusSuccess)
				seedRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeSubscription, "11", "other-sub-cycle", 100, 100)
			},
			wantSend: true,
		},
		{
			name:      "wallet recovered balance suppresses",
			scopeType: model.QuotaLifecycleScopeWallet,
			scopeID:   "2",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				updateRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeWallet, "2", "exhausted-cycle", 25, 100)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "wallet topup success after event suppresses stale exhausted state",
			scopeType: model.QuotaLifecycleScopeWallet,
			scopeID:   "2",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleTopUpPaymentSucceededEvent(t, fixture.user.Id, "related-wallet-topup", recallEmailTestNow+5, 100)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "wallet topup success event suppresses when legacy complete time is empty",
			scopeType: model.QuotaLifecycleScopeWallet,
			scopeID:   "2",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleTopUpPaymentSucceededEventWithCompleteTime(t, fixture.user.Id, "related-wallet-topup-empty-complete", recallEmailTestNow+5, 0, 100)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "subscription recovered balance suppresses",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				updateRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeSubscription, "10", "exhausted-cycle", 25, 100)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "subscription renewal success after event suppresses stale exhausted state",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleSubscriptionScope(t, fixture.user.Id, 10, 901, "exhausted-grant")
				seedRecallLifecycleSubscriptionRenewalSucceededEvent(t, fixture.user.Id, 10, "related-renewal", recallEmailTestNow+5)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "subscription renewal success event suppresses when legacy complete time is empty",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleSubscriptionScope(t, fixture.user.Id, 10, 901, "exhausted-grant")
				seedRecallLifecycleSubscriptionRenewalSucceededEventWithCompleteTime(t, fixture.user.Id, 10, "related-renewal-empty-complete", recallEmailTestNow+5, 0)
			},
			wantReason: "quota_recovered",
		},
		{
			name:      "subscription renewal success for another scope does not suppress",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				seedRecallLifecycleSubscriptionScope(t, fixture.user.Id, 10, 901, "exhausted-grant")
				seedRecallLifecycleSubscriptionRenewalSucceededEvent(t, fixture.user.Id, 11, "other-renewal", recallEmailTestNow+5)
			},
			wantSend: true,
		},
		{
			name:      "subscription new cycle suppresses",
			scopeType: model.QuotaLifecycleScopeSubscription,
			scopeID:   "10",
			seed: func(t *testing.T, fixture recallEmailFixture) {
				updateRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeSubscription, "10", "renewed-cycle", 0, 100)
			},
			wantReason: "quota_cycle_changed",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			data := map[string]any{
				"scope_type":       tc.scopeType,
				"scope_id":         tc.scopeID,
				"cycle_key":        "exhausted-cycle",
				"current_balance":  float64(0),
				"previous_balance": float64(10),
				"threshold":        float64(100),
			}
			fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerQuotaExhaustedUnpaid, data)
			seedRecallLifecycleQuotaState(t, fixture.user.Id, tc.scopeType, tc.scopeID, "exhausted-cycle", 0, 100)
			if tc.seed != nil {
				tc.seed(t, fixture)
			}

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			if tc.wantSend {
				require.Len(t, *fixture.sent, 1)
				require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
				return
			}
			require.Empty(t, *fixture.sent)
			require.Equal(t, tc.wantReason, loadRecallEmailMessageByID(t, fixture.message.Id).LastErrorCode)
			assertRecallLifecycleSMTPAdmissionDidNotConsume(t)
		})
	}
}

func TestRecallLifecycleMIMEPolicy(t *testing.T) {
	serviceTriggers := []string{
		model.RecallLifecycleTriggerUserRegistered,
		model.RecallLifecycleTriggerQuotaLow,
		model.RecallLifecycleTriggerQuotaExhaustedUnpaid,
		model.RecallLifecycleTriggerPaymentFailed,
		model.RecallLifecycleTriggerPaymentSucceeded,
	}
	for _, trigger := range serviceTriggers {
		t.Run(trigger, func(t *testing.T) {
			fixture := newRecallLifecycleEmailFixture(t, trigger, validRecallLifecycleEventData(trigger))
			seedRecallLifecycleValidMutableFacts(t, fixture, trigger)
			setRecallLifecycleOptOut(t, fixture.user.Id)

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			require.Len(t, *fixture.sent, 1)
			sent := (*fixture.sent)[0]
			require.NotContains(t, sent.htmlBody, "/api/recall/unsubscribe")
			require.Empty(t, sent.options.ListUnsubscribeURL)
			require.Empty(t, sent.options.ListUnsubscribeMailto)
			require.False(t, sent.options.Multipart)
		})
	}

	for _, trigger := range []string{model.RecallLifecycleTriggerRegistrationUnused, model.RecallLifecycleTriggerPaymentPending} {
		t.Run(trigger, func(t *testing.T) {
			fixture := newRecallLifecycleEmailFixture(t, trigger, validRecallLifecycleEventData(trigger))
			seedRecallLifecycleValidMutableFacts(t, fixture, trigger)
			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))
			require.Len(t, *fixture.sent, 1)
			require.Contains(t, (*fixture.sent)[0].htmlBody, "/api/recall/unsubscribe")
			require.NotEmpty(t, (*fixture.sent)[0].options.ListUnsubscribeURL)
			require.True(t, (*fixture.sent)[0].options.Multipart)

			optedOut := newRecallLifecycleEmailFixture(t, trigger, validRecallLifecycleEventData(trigger))
			setRecallLifecycleOptOut(t, optedOut.user.Id)
			require.NoError(t, optedOut.worker.ProcessLeased(context.Background(), optedOut.message.Id))
			require.Empty(t, *optedOut.sent)
			require.Equal(t, "engagement_opted_out", loadRecallEmailMessageByID(t, optedOut.message.Id).LastErrorCode)
		})
	}
}

func seedRecallLifecycleValidMutableFacts(t *testing.T, fixture recallEmailFixture, trigger string) {
	t.Helper()
	switch trigger {
	case model.RecallLifecycleTriggerQuotaLow:
		seedRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeWallet, "2", "wallet-cycle-ok", 50, 100)
	case model.RecallLifecycleTriggerQuotaExhaustedUnpaid:
		seedRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeWallet, "2", "wallet-cycle-zero", 0, 100)
	case model.RecallLifecycleTriggerPaymentPending:
		seedRecallLifecycleTopUp(t, fixture.user.Id, "gate-pending-ok", common.TopUpStatusPending)
	case model.RecallLifecycleTriggerPaymentFailed:
		seedRecallLifecycleTopUp(t, fixture.user.Id, "gate-failed-ok", common.TopUpStatusFailed)
	case model.RecallLifecycleTriggerPaymentSucceeded:
		seedRecallLifecycleTopUp(t, fixture.user.Id, "gate-success-ok", common.TopUpStatusSuccess)
	}
}

func newRecallLifecycleEmailFixture(t *testing.T, trigger string, eventData map[string]any) recallEmailFixture {
	t.Helper()
	fixture := newRecallEmailFixture(t, 1, nil)
	require.NoError(t, model.DB.AutoMigrate(&model.RecallLifecycleEvent{}, &model.QuotaLifecycleState{}))
	if eventData == nil {
		eventData = map[string]any{}
	}
	payload, err := common.Marshal(eventData)
	require.NoError(t, err)
	occurrence, err := recallLifecycleTestOccurrence(trigger, fixture.user.Id, eventData)
	require.NoError(t, err)
	event := model.RecallLifecycleEvent{
		EventType:         trigger,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		ScopeType:         strings.TrimSpace(fmt.Sprint(eventData["scope_type"])),
		ScopeId:           strings.TrimSpace(fmt.Sprint(eventData["scope_id"])),
		UserId:            fixture.user.Id,
		EventData:         string(payload),
		Disposition:       model.RecallLifecycleEventEnrolled,
		OccurredAt:        recallEmailTestNow - 10,
		AvailableAt:       recallEmailTestNow - 10,
		CampaignId:        fixture.campaign.Id,
		RecipientId:       fixture.recipient.Id,
	}
	inserted, err := model.TryInsertRecallLifecycleEventWithContext(context.Background(), &event)
	require.NoError(t, err)
	require.True(t, inserted)
	require.NoError(t, model.DB.Model(&model.RecallCampaign{}).Where("id = ?", fixture.campaign.Id).Updates(map[string]any{
		"campaign_type":        model.RecallCampaignTypeContentOnly,
		"delivery_policy":      recallLifecycleExpectedDeliveryPolicy(t, trigger),
		"lifecycle_trigger":    trigger,
		"execution_mode":       "continuous",
		"coupon_source":        "none",
		"discount_config":      `{}`,
		"product_scope":        `{}`,
		"promotion_expires_at": recallEmailTestNow + 3600,
	}).Error)
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", fixture.recipient.Id).Updates(map[string]any{
		"lifecycle_event_id":       event.Id,
		"recipient_identity":       model.RecallLifecycleRecipientIdentity(trigger, occurrence.Hash),
		"eligibility_snapshot":     string(payload),
		"stripe_customer_id":       "",
		"stripe_promotion_code_id": nil,
		"promotion_code":           "",
		"claim_token_hash":         nil,
		"promotion_expires_at":     recallEmailTestNow + 3600,
	}).Error)
	fixture.campaign = loadRecallLifecycleCampaign(t, fixture.campaign.Id)
	fixture.recipient = loadRecallLifecycleRecipient(t, fixture.recipient.Id)
	return fixture
}

func validRecallLifecycleEventData(trigger string) map[string]any {
	switch trigger {
	case model.RecallLifecycleTriggerQuotaLow:
		return map[string]any{"scope_type": model.QuotaLifecycleScopeWallet, "scope_id": "2", "cycle_key": "wallet-cycle-ok", "current_balance": float64(50), "threshold": float64(100)}
	case model.RecallLifecycleTriggerQuotaExhaustedUnpaid:
		return map[string]any{"scope_type": model.QuotaLifecycleScopeWallet, "scope_id": "2", "cycle_key": "wallet-cycle-zero", "current_balance": float64(0), "threshold": float64(100)}
	case model.RecallLifecycleTriggerPaymentPending:
		return map[string]any{"purchase_kind": model.PurchaseLifecycleKindTopUp, "trade_no": "gate-pending-ok", "to_status": common.TopUpStatusPending}
	case model.RecallLifecycleTriggerPaymentFailed:
		return map[string]any{"purchase_kind": model.PurchaseLifecycleKindTopUp, "trade_no": "gate-failed-ok", "to_status": common.TopUpStatusFailed}
	case model.RecallLifecycleTriggerPaymentSucceeded:
		return map[string]any{"purchase_kind": model.PurchaseLifecycleKindTopUp, "trade_no": "gate-success-ok", "to_status": common.TopUpStatusSuccess}
	default:
		return map[string]any{}
	}
}

func recallLifecycleTestOccurrence(trigger string, userID int, eventData map[string]any) (model.RecallLifecycleOccurrence, error) {
	switch trigger {
	case model.RecallLifecycleTriggerQuotaLow, model.RecallLifecycleTriggerQuotaExhaustedUnpaid:
		return model.NewRecallLifecycleQuotaOccurrence(trigger, fmt.Sprint(eventData["scope_type"]), fmt.Sprint(eventData["scope_id"]), fmt.Sprint(eventData["cycle_key"]), userID)
	case model.RecallLifecycleTriggerPaymentFailed, model.RecallLifecycleTriggerPaymentPending, model.RecallLifecycleTriggerPaymentSucceeded:
		return model.NewRecallLifecyclePurchaseOccurrence(trigger, fmt.Sprint(eventData["purchase_kind"]), fmt.Sprint(eventData["trade_no"]), "", 0, userID)
	default:
		return model.NewRecallLifecycleUserOccurrence(trigger, userID)
	}
}

func recallLifecycleExpectedDeliveryPolicy(t *testing.T, trigger string) string {
	t.Helper()
	policy, err := model.RecallLifecycleTriggerDeliveryPolicy(trigger)
	require.NoError(t, err)
	return policy
}

func loadRecallLifecycleCampaign(t *testing.T, id int64) model.RecallCampaign {
	t.Helper()
	var campaign model.RecallCampaign
	require.NoError(t, model.DB.First(&campaign, id).Error)
	return campaign
}

func loadRecallLifecycleRecipient(t *testing.T, id int64) model.RecallRecipient {
	t.Helper()
	var recipient model.RecallRecipient
	require.NoError(t, model.DB.First(&recipient, id).Error)
	return recipient
}

func loadRecallLifecycleEventForRecipient(t *testing.T, recipientID int64) model.RecallLifecycleEvent {
	t.Helper()
	var event model.RecallLifecycleEvent
	require.NoError(t, model.DB.First(&event, "recipient_id = ?", recipientID).Error)
	return event
}

func updateRecallLifecycleUserEmail(t *testing.T, userID int, email string) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Update("email", email).Error)
}

func updateRecallLifecycleRecipientEmailSnapshot(t *testing.T, recipientID int64, email string) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.RecallRecipient{}).Where("id = ?", recipientID).Update("email_snapshot", email).Error)
}

func setRecallLifecycleQuotaWarningThreshold(t *testing.T, userID int, threshold float64) {
	t.Helper()
	settingJSON, err := common.Marshal(dto.UserSetting{QuotaWarningThreshold: threshold})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Update("setting", string(settingJSON)).Error)
}

func seedRecallLifecycleQuotaState(t *testing.T, userID int, scopeType string, scopeID string, cycle string, balance int64, threshold int64) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.QuotaLifecycleState{
		UserId: userID, ScopeType: scopeType, ScopeId: scopeID, Cycle: cycle, Balance: balance, Threshold: threshold, Source: "test", SourceData: `{}`, StateVersion: 1,
	}).Error)
}

func updateRecallLifecycleQuotaState(t *testing.T, userID int, scopeType string, scopeID string, cycle string, balance int64, threshold int64) {
	t.Helper()
	require.NoError(t, model.DB.Model(&model.QuotaLifecycleState{}).
		Where("user_id = ? AND scope_type = ? AND scope_id = ?", userID, scopeType, scopeID).
		Updates(map[string]any{"cycle": cycle, "balance": balance, "threshold": threshold}).Error)
}

func seedRecallLifecycleTopUp(t *testing.T, userID int, tradeNo string, status string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.TopUp{UserId: userID, TradeNo: tradeNo, Status: status, CreateTime: recallEmailTestNow - 20, CompleteTime: recallEmailTestNow - 5}).Error)
}

func seedRecallLifecycleSubscriptionOrder(t *testing.T, userID int, tradeNo string, status string) {
	t.Helper()
	require.NoError(t, model.DB.Create(&model.SubscriptionOrder{UserId: userID, TradeNo: tradeNo, Status: status, CreateTime: recallEmailTestNow - 20, CompleteTime: recallEmailTestNow - 5}).Error)
}

func seedRecallLifecycleTopUpPaymentSucceededEvent(t *testing.T, userID int, tradeNo string, occurredAt int64, amount int64) {
	t.Helper()
	seedRecallLifecycleTopUpPaymentSucceededEventWithCompleteTime(t, userID, tradeNo, occurredAt, occurredAt, amount)
}

func seedRecallLifecycleTopUpPaymentSucceededEventWithCompleteTime(t *testing.T, userID int, tradeNo string, occurredAt int64, completeTime int64, amount int64) {
	t.Helper()
	topUp := model.TopUp{UserId: userID, TradeNo: tradeNo, Status: common.TopUpStatusSuccess, Amount: amount, CreateTime: occurredAt - 20, CompleteTime: completeTime}
	require.NoError(t, model.DB.Create(&topUp).Error)
	payload, err := common.Marshal(map[string]any{
		"purchase_kind": model.PurchaseLifecycleKindTopUp,
		"source_table":  "top_ups",
		"source_id":     topUp.Id,
		"trade_no":      tradeNo,
		"user_id":       userID,
		"to_status":     common.TopUpStatusSuccess,
		"credit":        amount,
		"source_ref":    "topup:" + tradeNo,
	})
	require.NoError(t, err)
	occurrence, err := model.NewRecallLifecyclePurchaseOccurrence(model.RecallLifecycleTriggerPaymentSucceeded, model.PurchaseLifecycleKindTopUp, tradeNo, "top_ups", int64(topUp.Id), userID)
	require.NoError(t, err)
	inserted, err := model.TryInsertRecallLifecycleEventWithContext(context.Background(), &model.RecallLifecycleEvent{
		EventType:         model.RecallLifecycleTriggerPaymentSucceeded,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		ScopeType:         model.PurchaseLifecycleKindTopUp,
		ScopeId:           tradeNo,
		UserId:            userID,
		EventData:         string(payload),
		Disposition:       model.RecallLifecycleEventPending,
		OccurredAt:        occurredAt,
		AvailableAt:       occurredAt,
		SchemaVersion:     1,
	})
	require.NoError(t, err)
	require.True(t, inserted)
}

func seedRecallLifecycleSubscriptionScope(t *testing.T, userID int, subscriptionID int, contractID int64, grantKey string) {
	t.Helper()
	require.NoError(t, model.DB.AutoMigrate(&model.UserSubscriptionContract{}, &model.UserSubscription{}))
	require.NoError(t, model.DB.Create(&model.UserSubscriptionContract{Id: contractID, UserId: userID, Status: model.SubscriptionContractStatusActive, PaymentMode: model.SubscriptionPaymentModeBalanceOnePeriod}).Error)
	require.NoError(t, model.DB.Create(&model.UserSubscription{
		Id:         subscriptionID,
		UserId:     userID,
		ContractId: contractID,
		GrantKey:   &grantKey,
		Status:     model.SubscriptionEntitlementStatusActive,
	}).Error)
}

func seedRecallLifecycleSubscriptionRenewalSucceededEvent(t *testing.T, userID int, subscriptionScopeID int64, renewalKey string, occurredAt int64) {
	t.Helper()
	seedRecallLifecycleSubscriptionRenewalSucceededEventWithCompleteTime(t, userID, subscriptionScopeID, renewalKey, occurredAt, occurredAt)
}

func seedRecallLifecycleSubscriptionRenewalSucceededEventWithCompleteTime(t *testing.T, userID int, subscriptionScopeID int64, renewalKey string, occurredAt int64, completeTime int64) {
	t.Helper()
	order := model.SubscriptionOrder{
		UserId:        userID,
		TradeNo:       renewalKey,
		Status:        common.TopUpStatusSuccess,
		CreateTime:    occurredAt - 20,
		CompleteTime:  completeTime,
		RenewalSource: model.SubscriptionRenewalSourceWallet,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	payload, err := common.Marshal(map[string]any{
		"purchase_kind":         model.PurchaseLifecycleKindSubscription,
		"source_table":          "subscription_orders",
		"source_id":             order.Id,
		"trade_no":              renewalKey,
		"user_id":               userID,
		"to_status":             common.TopUpStatusSuccess,
		"subscription_scope_id": subscriptionScopeID,
	})
	require.NoError(t, err)
	occurrence, err := model.NewRecallLifecyclePurchaseOccurrence(model.RecallLifecycleTriggerPaymentSucceeded, model.PurchaseLifecycleKindSubscription, renewalKey, "subscription_orders", int64(order.Id), userID)
	require.NoError(t, err)
	inserted, err := model.TryInsertRecallLifecycleEventWithContext(context.Background(), &model.RecallLifecycleEvent{
		EventType:         model.RecallLifecycleTriggerPaymentSucceeded,
		OccurrenceKeyHash: occurrence.Hash,
		BusinessKey:       occurrence.Canonical,
		ScopeType:         model.PurchaseLifecycleKindSubscription,
		ScopeId:           renewalKey,
		UserId:            userID,
		EventData:         string(payload),
		Disposition:       model.RecallLifecycleEventPending,
		OccurredAt:        occurredAt,
		AvailableAt:       occurredAt,
		SchemaVersion:     1,
	})
	require.NoError(t, err)
	require.True(t, inserted)
}

func setRecallLifecycleOptOut(t *testing.T, userID int) {
	t.Helper()
	settingJSON, err := common.Marshal(dto.UserSetting{RecallMarketingOptOut: true})
	require.NoError(t, err)
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", userID).Update("setting", string(settingJSON)).Error)
}

func assertRecallLifecycleSMTPAdmissionDidNotConsume(t *testing.T) {
	t.Helper()
	status, err := model.GetRecallEmailQuotaStatusWithContext(context.Background(), 100000)
	require.NoError(t, err)
	require.Zero(t, status.Used)
	var pacing model.RecallEmailPacingState
	result := model.DB.Where("scope = ?", "activity_email").First(&pacing)
	if result.Error == nil {
		require.Zero(t, pacing.LastStartedAtMillis)
		return
	}
	require.ErrorIs(t, result.Error, gorm.ErrRecordNotFound)
}

func TestRecallLifecycleRetryPreservesDeterministicMessageID(t *testing.T) {
	fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerUserRegistered, nil)
	require.NoError(t, model.DB.Model(&model.RecallMessage{}).Where("id = ?", fixture.message.Id).Update("provider_message_id", "<recall-fixed@notify.example.com>").Error)
	var sent []recallEmailSent
	fixture.worker.sender = func(config common.SMTPConfig, subject, receiver, content, messageID string, options common.EmailOptions) error {
		sent = append(sent, recallEmailSent{config: config, subject: subject, receiver: receiver, htmlBody: content, messageID: messageID, options: options})
		return nil
	}

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, sent, 1)
	require.Equal(t, "<recall-fixed@notify.example.com>", sent[0].messageID)
}

func TestRecallLifecyclePaymentGateAcceptsBothPurchaseKinds(t *testing.T) {
	for _, tc := range []struct {
		name    string
		trigger string
		kind    string
		status  string
		seed    func(t *testing.T, userID int, tradeNo string, status string)
	}{
		{"topup failed", model.RecallLifecycleTriggerPaymentFailed, model.PurchaseLifecycleKindTopUp, common.TopUpStatusFailed, seedRecallLifecycleTopUp},
		{"topup pending", model.RecallLifecycleTriggerPaymentPending, model.PurchaseLifecycleKindTopUp, common.TopUpStatusPending, seedRecallLifecycleTopUp},
		{"topup success", model.RecallLifecycleTriggerPaymentSucceeded, model.PurchaseLifecycleKindTopUp, common.TopUpStatusSuccess, seedRecallLifecycleTopUp},
		{"subscription failed", model.RecallLifecycleTriggerPaymentFailed, model.PurchaseLifecycleKindSubscription, common.TopUpStatusFailed, seedRecallLifecycleSubscriptionOrder},
		{"subscription pending", model.RecallLifecycleTriggerPaymentPending, model.PurchaseLifecycleKindSubscription, common.TopUpStatusPending, seedRecallLifecycleSubscriptionOrder},
		{"subscription success", model.RecallLifecycleTriggerPaymentSucceeded, model.PurchaseLifecycleKindSubscription, common.TopUpStatusSuccess, seedRecallLifecycleSubscriptionOrder},
	} {
		t.Run(tc.name, func(t *testing.T) {
			tradeNo := "gate-" + strings.ReplaceAll(tc.name, " ", "-")
			fixture := newRecallLifecycleEmailFixture(t, tc.trigger, map[string]any{"purchase_kind": tc.kind, "trade_no": tradeNo, "to_status": tc.status})
			tc.seed(t, fixture.user.Id, tradeNo, tc.status)

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			require.Len(t, *fixture.sent, 1)
			require.Equal(t, model.RecallMessageAccepted, loadRecallEmailMessageByID(t, fixture.message.Id).State)
		})
	}
}

func TestRecallLifecycleQuotaGateAcceptsCurrentSameCycleStates(t *testing.T) {
	for _, tc := range []struct {
		trigger   string
		cycle     string
		balance   int64
		threshold int64
	}{
		{model.RecallLifecycleTriggerQuotaLow, "low-cycle", 50, 100},
		{model.RecallLifecycleTriggerQuotaExhaustedUnpaid, "zero-cycle", 0, 100},
	} {
		t.Run(tc.trigger, func(t *testing.T) {
			data := map[string]any{"scope_type": model.QuotaLifecycleScopeWallet, "scope_id": "2", "cycle_key": tc.cycle, "current_balance": float64(tc.balance), "threshold": float64(tc.threshold)}
			fixture := newRecallLifecycleEmailFixture(t, tc.trigger, data)
			seedRecallLifecycleQuotaState(t, fixture.user.Id, model.QuotaLifecycleScopeWallet, "2", tc.cycle, tc.balance, tc.threshold)

			require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

			require.Len(t, *fixture.sent, 1)
		})
	}
}

func TestRecallLifecycleGateUsesCommonJSONForEventData(t *testing.T) {
	payload, err := common.Marshal(map[string]any{"scope_type": model.QuotaLifecycleScopeWallet, "scope_id": "2", "cycle_key": "json-cycle"})
	require.NoError(t, err)
	var decoded map[string]any
	require.NoError(t, common.Unmarshal(payload, &decoded))
	require.Equal(t, "json-cycle", decoded["cycle_key"])
}

func TestRecallLifecycleServiceMailHasNoUnsubscribeEvenAfterRenderedPreview(t *testing.T) {
	fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerUserRegistered, nil)
	_, preview, err := RenderRecallEmail(RecallEmailRenderInput{
		CampaignType:   model.RecallCampaignTypeContentOnly,
		Language:       "en",
		Template:       RecallEmailTemplate{Subject: "Preview", BodyText: "Preview body"},
		UnsubscribeURL: "https://console.flatkey.ai/api/recall/unsubscribe?token=preview",
	})
	require.NoError(t, err)
	require.Contains(t, preview, "/api/recall/unsubscribe")

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Len(t, *fixture.sent, 1)
	require.NotContains(t, (*fixture.sent)[0].htmlBody, "/api/recall/unsubscribe")
}

func TestRecallLifecycleGateDoesNotDependOnProcessLockTiming(t *testing.T) {
	fixture := newRecallLifecycleEmailFixture(t, model.RecallLifecycleTriggerRegistrationUnused, nil)
	*fixture.now = time.Unix(recallEmailTestNow+1, 0).UTC()
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", fixture.user.Id).Update("request_count", 2).Error)

	require.NoError(t, fixture.worker.ProcessLeased(context.Background(), fixture.message.Id))

	require.Empty(t, *fixture.sent)
	require.Equal(t, "registration_used", loadRecallEmailMessageByID(t, fixture.message.Id).LastErrorCode)
}
