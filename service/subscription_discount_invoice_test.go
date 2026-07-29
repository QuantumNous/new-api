package service

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stretchr/testify/require"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

type stripeRenewalInvoiceMutationRecorder struct {
	gets                 int
	updates              []bool
	updateMetadata       []map[string]string
	items                []int64
	itemMetadata         []map[string]string
	itemIdempotencyKeys  []string
	itemListCalls        int
	existingItems        []*stripe.InvoiceItem
	updateIdempotencyKey []string
	failItem             bool
	failItemErr          error
	failResumeOnce       bool
	failEveryResume      bool
}

func replaceStripeRenewalInvoiceAccessors(t *testing.T, inv *stripe.Invoice, sub *stripe.Subscription, recorder *stripeRenewalInvoiceMutationRecorder) {
	t.Helper()
	restoreReconcile := replaceStripeInvoiceReconcilers(t, inv, sub)
	originalUpdater := stripeSubscriptionInvoiceUpdater
	originalItemCreator := stripeSubscriptionInvoiceItemCreator
	originalItemLister := stripeSubscriptionInvoiceItemLister
	t.Cleanup(func() {
		restoreReconcile()
		stripeSubscriptionInvoiceUpdater = originalUpdater
		stripeSubscriptionInvoiceItemCreator = originalItemCreator
		stripeSubscriptionInvoiceItemLister = originalItemLister
	})
	stripeSubscriptionInvoiceUpdater = func(ctx context.Context, invoiceID string, params *stripe.InvoiceParams) (*stripe.Invoice, error) {
		require.Equal(t, inv.ID, invoiceID)
		require.NotNil(t, params)
		require.NotNil(t, params.AutoAdvance)
		recorder.updates = append(recorder.updates, *params.AutoAdvance)
		if params.Params.IdempotencyKey != nil {
			recorder.updateIdempotencyKey = append(recorder.updateIdempotencyKey, *params.Params.IdempotencyKey)
		}
		recorder.updateMetadata = append(recorder.updateMetadata, params.Metadata)
		if recorder.failResumeOnce && *params.AutoAdvance {
			recorder.failResumeOnce = false
			return nil, errors.New("stripe invoice metadata resume failed")
		}
		if recorder.failEveryResume && *params.AutoAdvance {
			return nil, errors.New("stripe invoice metadata resume failed")
		}
		clone := *inv
		clone.AutoAdvance = *params.AutoAdvance
		return &clone, nil
	}
	stripeSubscriptionInvoiceItemLister = func(ctx context.Context, params *stripe.InvoiceItemListParams) ([]*stripe.InvoiceItem, error) {
		require.NotNil(t, params)
		require.NotNil(t, params.Invoice)
		require.Equal(t, inv.ID, *params.Invoice)
		recorder.itemListCalls++
		return recorder.existingItems, nil
	}
	stripeSubscriptionInvoiceItemCreator = func(ctx context.Context, params *stripe.InvoiceItemParams) (*stripe.InvoiceItem, error) {
		require.NotNil(t, params)
		if recorder.failItemErr != nil {
			return nil, recorder.failItemErr
		}
		if recorder.failItem {
			return nil, errors.New("stripe invoice item failed")
		}
		require.NotNil(t, params.Invoice)
		require.Equal(t, inv.ID, *params.Invoice)
		require.NotNil(t, params.Amount)
		recorder.items = append(recorder.items, *params.Amount)
		recorder.itemMetadata = append(recorder.itemMetadata, params.Metadata)
		if params.Params.IdempotencyKey != nil {
			recorder.itemIdempotencyKeys = append(recorder.itemIdempotencyKeys, *params.Params.IdempotencyKey)
		}
		item := stripeDiscountInvoiceItemFixture("ii_"+inv.ID, inv.ID, *params.Amount, stripe.Currency(*params.Currency), params.Metadata)
		recorder.existingItems = []*stripe.InvoiceItem{item}
		return item, nil
	}
}

func grantRenewalInvitationCredit(t *testing.T, userID int, usdMinor int64, key string) {
	t.Helper()
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.GrantSubscriptionDiscountTx(tx, model.SubscriptionDiscountGrantInput{
			UserID:         userID,
			USDMinor:       usdMinor,
			EntryType:      model.SubscriptionDiscountEntryTypeGrantInvitee,
			SourceType:     "test",
			SourceKey:      key,
			IdempotencyKey: key,
		})
		return err
	}))
}

func expireSubscriptionDiscountReservationForTest(t *testing.T, reservationKey string) {
	t.Helper()
	require.NoError(t, model.DB.Exec("UPDATE subscription_discount_entries SET expires_at = ? WHERE idempotency_key = ?", common.GetTimestamp()-10, reservationKey).Error)
}

func resetStripeSubscriptionDiscountInvoiceReconciliationCursorForTest(t *testing.T) {
	t.Helper()
	require.NoError(t, model.DB.Where("key = ?", stripeSubscriptionDiscountInvoiceReconciliationCursorOptionKey).Delete(&model.Option{}).Error)
}

func draftRenewalInvoiceFixture(invoiceID string, subscriptionID string) *stripe.Invoice {
	inv := stripeInvoiceFixture(invoiceID, subscriptionID)
	inv.Status = stripe.InvoiceStatusDraft
	inv.AmountPaid = 0
	inv.AmountDue = 1034
	inv.Subtotal = 1234
	inv.Total = 1034
	inv.AutoAdvance = true
	inv.BillingReason = stripe.InvoiceBillingReasonSubscriptionCycle
	inv.TotalDiscountAmounts = []*stripe.InvoiceTotalDiscountAmount{{Amount: 200}}
	return inv
}

func TestSubscriptionDiscountInvoiceExistingDiscountConsumesOnlyIncrementalCredit(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9201, 9301, "sub_discount_invoice")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9201, 9301, "sub_discount_invoice_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9201, 500, "grant-renewal-invoice")
	inv := draftRenewalInvoiceFixture("in_discount_invoice", "sub_discount_invoice")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_invoice", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_invoice"))
	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_invoice"))

	require.Equal(t, []bool{false, true, false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
	require.Equal(t, []string{"stripe-invoice:in_discount_invoice:adjustment"}, recorder.itemIdempotencyKeys)
	require.Equal(t, 2, recorder.itemListCalls)
	var reserve model.SubscriptionDiscountEntry
	require.NoError(t, model.DB.Where("idempotency_key = ?", "stripe-invoice:in_discount_invoice:reserve").First(&reserve).Error)
	require.Equal(t, int64(300), reserve.ReservedDeltaUSDMinor)
	require.Equal(t, int64(300), reserve.AppliedAmountMinor)
	require.Equal(t, "in_discount_invoice", reserve.TradeNo)
	require.Contains(t, reserve.PricingSnapshot, `"existing_discount_minor":200`)
	require.Contains(t, reserve.PricingSnapshot, `"selected_invitation_usd_minor":300`)
	require.Contains(t, reserve.PricingSnapshot, `"incremental_item_minor":300`)
	require.Contains(t, reserve.PricingSnapshot, `"expected_final_payment_minor":734`)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9201).Error)
	require.Equal(t, int64(200), account.AvailableUSDMinor)
	require.Equal(t, int64(300), account.ReservedUSDMinor)
	require.Equal(t, "stripe-invoice:in_discount_invoice:reserve", recorder.updateMetadata[1]["subscription_discount_reservation_key"])
	require.Equal(t, "300", recorder.updateMetadata[1]["subscription_discount_selected_usd_minor"])
	require.Equal(t, "734", recorder.updateMetadata[1]["subscription_discount_expected_final_minor"])
	require.Equal(t, "300", recorder.updateMetadata[1]["subscription_discount_incremental_item_minor"])
	require.Equal(t, "9301", recorder.updateMetadata[1]["subscription_discount_plan_id"])
	require.Equal(t, "stripe-invoice:in_discount_invoice:reserve", recorder.itemMetadata[0]["subscription_discount_reservation_key"])
}

func TestSubscriptionDiscountInvoicePrepareRetriesFinalMetadataResumeFailure(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9210, 9310, "sub_discount_resume_retry")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9210, 9310, "sub_discount_resume_retry_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9210, 500, "grant-renewal-resume-retry")
	inv := draftRenewalInvoiceFixture("in_discount_resume_retry", "sub_discount_resume_retry")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_resume_retry", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{failResumeOnce: true}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.Error(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_resume_retry"))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("idempotency_key = ?", "stripe-invoice:in_discount_resume_retry:reserve").Count(&reserveCount).Error)
	require.Equal(t, int64(1), reserveCount)

	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_resume_retry"))

	require.Equal(t, []bool{false, true, false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
	require.Equal(t, []string{"stripe-invoice:in_discount_resume_retry:adjustment"}, recorder.itemIdempotencyKeys)
	require.Equal(t, 2, recorder.itemListCalls)
	finalMetadata := recorder.updateMetadata[3]
	require.Equal(t, "stripe-invoice:in_discount_resume_retry:reserve", finalMetadata["subscription_discount_reservation_key"])
	require.Equal(t, "300", finalMetadata["subscription_discount_selected_usd_minor"])
	require.Equal(t, "500", finalMetadata["subscription_discount_selected_local_minor"])
	require.Equal(t, "200", finalMetadata["subscription_discount_existing_minor"])
	require.Equal(t, "300", finalMetadata["subscription_discount_incremental_item_minor"])
	require.Equal(t, "734", finalMetadata["subscription_discount_expected_final_minor"])
}

func TestSubscriptionDiscountInvoicePrepareResumesAfterPermanentLocalValidationError(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9217, 9317, "sub_discount_local_error")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("provider_customer_id", "cus_other").Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9217, 9317, "sub_discount_local_error_initial")).Error)
	grantRenewalInvitationCredit(t, 9217, 500, "grant-renewal-local-error")
	inv := draftRenewalInvoiceFixture("in_discount_local_error", "sub_discount_local_error")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_local_error", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_local_error")

	require.ErrorContains(t, err, "local Stripe customer mismatch")
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("idempotency_key = ?", "stripe-invoice:in_discount_local_error:reserve").Count(&reserveCount).Error)
	require.Zero(t, reserveCount)
}

func TestSubscriptionDiscountInvoicePrepareReturnsRetryableWhenResumeAfterLocalValidationFails(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9218, 9318, "sub_discount_local_resume_fail")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("provider_customer_id", "cus_other").Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9218, 9318, "sub_discount_local_resume_fail_initial")).Error)
	grantRenewalInvitationCredit(t, 9218, 500, "grant-renewal-local-resume-fail")
	inv := draftRenewalInvoiceFixture("in_discount_local_resume_fail", "sub_discount_local_resume_fail")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_local_resume_fail", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{failEveryResume: true}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_local_resume_fail")

	require.ErrorContains(t, err, "stripe invoice metadata resume failed")
	require.False(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
}

func TestSubscriptionDiscountInvoicePrepareFailsClosedOnConflictingExistingAdjustmentItem(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9219, 9319, "sub_discount_item_conflict")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9219, 9319, "sub_discount_item_conflict_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9219, 500, "grant-renewal-item-conflict")
	inv := draftRenewalInvoiceFixture("in_discount_item_conflict", "sub_discount_item_conflict")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_item_conflict", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	recorder.existingItems = []*stripe.InvoiceItem{
		stripeDiscountInvoiceItemFixture("ii_conflict", inv.ID, -301, stripe.CurrencyUSD, map[string]string{
			"source":                                     "new-api",
			"subscription_discount_version":              "1",
			"subscription_discount_source":               "stripe_renewal_invoice_discount",
			"subscription_discount_invoice_id":           inv.ID,
			"subscription_discount_reservation_key":      "stripe-invoice:in_discount_item_conflict:reserve",
			"subscription_discount_item_idempotency_key": "stripe-invoice:in_discount_item_conflict:adjustment",
		}),
	}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_item_conflict")

	require.ErrorContains(t, err, "conflicting subscription discount invoice item")
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_item_conflict:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
}

func TestSubscriptionDiscountInvoicePrepareFailsClosedOnDuplicateExistingAdjustmentItems(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9220, 9320, "sub_discount_item_duplicate")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9220, 9320, "sub_discount_item_duplicate_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", contract.Id).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9220, 500, "grant-renewal-item-duplicate")
	inv := draftRenewalInvoiceFixture("in_discount_item_duplicate", "sub_discount_item_duplicate")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_item_duplicate", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	metadata := map[string]string{
		"source":                                     "new-api",
		"subscription_discount_version":              "1",
		"subscription_discount_source":               "stripe_renewal_invoice_discount",
		"subscription_discount_invoice_id":           inv.ID,
		"subscription_discount_reservation_key":      "stripe-invoice:in_discount_item_duplicate:reserve",
		"subscription_discount_item_idempotency_key": "stripe-invoice:in_discount_item_duplicate:adjustment",
	}
	recorder := &stripeRenewalInvoiceMutationRecorder{
		existingItems: []*stripe.InvoiceItem{
			stripeDiscountInvoiceItemFixture("ii_duplicate_a", inv.ID, -300, stripe.CurrencyUSD, metadata),
			stripeDiscountInvoiceItemFixture("ii_duplicate_b", inv.ID, -300, stripe.CurrencyUSD, metadata),
		},
	}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_item_duplicate")

	require.ErrorContains(t, err, "multiple subscription discount invoice items")
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_item_duplicate:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
}

func TestSubscriptionDiscountInvoicePrepareExistingDiscountTieDoesNotReserve(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9202, 9302, "sub_discount_tie")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9202, 9302, "sub_discount_tie_initial")).Error)
	grantRenewalInvitationCredit(t, 9202, 500, "grant-renewal-tie")
	inv := draftRenewalInvoiceFixture("in_discount_tie", "sub_discount_tie")
	inv.AmountDue = 734
	inv.Total = 734
	inv.TotalDiscountAmounts = []*stripe.InvoiceTotalDiscountAmount{{Amount: 500}}
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_tie", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_tie"))

	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("idempotency_key = ?", "stripe-invoice:in_discount_tie:reserve").Count(&reserveCount).Error)
	require.Zero(t, reserveCount)
}

func TestSubscriptionDiscountInvoicePrepareItemFailureKeepsPausedAndRetriesWithoutDoubleReserve(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9203, 9303, "sub_discount_retry")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9203, 9303, "sub_discount_retry_initial")).Error)
	grantRenewalInvitationCredit(t, 9203, 500, "grant-renewal-retry")
	inv := draftRenewalInvoiceFixture("in_discount_retry", "sub_discount_retry")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_retry", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{failItem: true}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.Error(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_retry"))
	recorder.failItem = false
	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_retry"))

	require.Equal(t, []bool{false, false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
	var reserveCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("idempotency_key = ?", "stripe-invoice:in_discount_retry:reserve").Count(&reserveCount).Error)
	require.Equal(t, int64(1), reserveCount)
}

func TestSubscriptionDiscountInvoicePrepareRestoresOriginalAutoAdvanceFalseAcrossRetry(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9225, 9325, "sub_discount_retry_auto_false")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9225, 9325, "sub_discount_retry_auto_false_initial")).Error)
	grantRenewalInvitationCredit(t, 9225, 500, "grant-renewal-retry-auto-false")
	inv := draftRenewalInvoiceFixture("in_discount_retry_auto_false", "sub_discount_retry_auto_false")
	inv.AutoAdvance = false
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_retry_auto_false", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{failItem: true}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.Error(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_retry_auto_false"))
	recorder.failItem = false
	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_retry_auto_false"))

	require.Equal(t, []bool{false, false, false}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
}

func TestSubscriptionDiscountInvoicePrepareLegacyReservationRestoresAutoAdvanceTrueAcrossRetry(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9227, 9327, "sub_discount_retry_auto_legacy")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9227, 9327, "sub_discount_retry_auto_legacy_initial")).Error)
	grantRenewalInvitationCredit(t, 9227, 500, "grant-renewal-retry-auto-legacy")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9227,
			USDMinor:           300,
			TradeNo:            "in_discount_retry_auto_legacy",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    legacyRenewalInvoiceSnapshotJSONForTest(t, "in_discount_retry_auto_legacy", "sub_discount_retry_auto_legacy", binding.Id, binding.ContractId, 9327, 9227, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_retry_auto_legacy:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_retry_auto_legacy:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := draftRenewalInvoiceFixture("in_discount_retry_auto_legacy", "sub_discount_retry_auto_legacy")
	inv.AutoAdvance = false
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_retry_auto_legacy", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_retry_auto_legacy"))

	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
}

func TestSubscriptionDiscountInvoicePermanentStripeItemFailureReleasesReservationAndStopsRetry(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9226, 9326, "sub_discount_item_permanent")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9226, 9326, "sub_discount_item_permanent_initial")).Error)
	grantRenewalInvitationCredit(t, 9226, 500, "grant-renewal-item-permanent")
	inv := draftRenewalInvoiceFixture("in_discount_item_permanent", "sub_discount_item_permanent")
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_item_permanent", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{
		failItemErr: &stripe.Error{Msg: "invalid invoice item request", HTTPStatusCode: http.StatusBadRequest},
	}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_item_permanent")

	require.ErrorContains(t, err, "invalid invoice item request")
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_item_permanent:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9226).Error)
	require.Equal(t, int64(500), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
}

func TestSubscriptionDiscountInvoicePermanentStripeItemFailureReleasesLegacyReservationAndResumesAutoAdvanceTrue(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9228, 9328, "sub_discount_item_permanent_legacy")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9228, 9328, "sub_discount_item_permanent_legacy_initial")).Error)
	grantRenewalInvitationCredit(t, 9228, 500, "grant-renewal-item-permanent-legacy")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9228,
			USDMinor:           300,
			TradeNo:            "in_discount_item_permanent_legacy",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    legacyRenewalInvoiceSnapshotJSONForTest(t, "in_discount_item_permanent_legacy", "sub_discount_item_permanent_legacy", binding.Id, binding.ContractId, 9328, 9228, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_item_permanent_legacy:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_item_permanent_legacy:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := draftRenewalInvoiceFixture("in_discount_item_permanent_legacy", "sub_discount_item_permanent_legacy")
	inv.AutoAdvance = false
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_item_permanent_legacy", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{
		failItemErr: &stripe.Error{Msg: "invalid invoice item request", HTTPStatusCode: http.StatusBadRequest},
	}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	err := PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_item_permanent_legacy")

	require.ErrorContains(t, err, "invalid invoice item request")
	require.True(t, IsPermanentPaidInvoiceError(err))
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Empty(t, recorder.items)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_item_permanent_legacy:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
}

func TestSubscriptionDiscountInvoiceCommitAndReleaseAreIdempotent(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	grantRenewalInvitationCredit(t, 9204, 500, "grant-renewal-terminal")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9204,
			USDMinor:           500,
			TradeNo:            "in_terminal",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			IdempotencyKey:     "stripe-invoice:in_terminal:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))

	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		return CommitStripeSubscriptionDiscountInvoiceTx(tx, "in_terminal")
	}))
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		return CommitStripeSubscriptionDiscountInvoiceTx(tx, "in_terminal")
	}))
	require.NoError(t, ReleaseStripeSubscriptionDiscountInvoice(context.Background(), "in_terminal"))

	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9204).Error)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_terminal:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_terminal:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Zero(t, releaseCount)
}

func TestSubscriptionDiscountInvoicePrepareExcludesInitialSubscriptionCreate(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9205, 9305, "sub_discount_initial")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9205, 9305, "sub_discount_initial_order")).Error)
	grantRenewalInvitationCredit(t, 9205, 500, "grant-renewal-initial")
	inv := draftRenewalInvoiceFixture("in_discount_initial", "sub_discount_initial")
	inv.BillingReason = stripe.InvoiceBillingReasonSubscriptionCreate
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_initial", map[string]string{})
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	require.NoError(t, PrepareStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_initial"))

	require.Empty(t, recorder.updates)
	require.Empty(t, recorder.items)
}

func TestReconcilePaidInvoiceCommitsRenewalInvitationReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9206, 9306, "sub_discount_paid")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9206, 9306, "sub_discount_paid_initial")).Error)
	grantRenewalInvitationCredit(t, 9206, 500, "grant-renewal-paid")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9206,
			USDMinor:           500,
			TradeNo:            "in_discount_paid",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_paid", "sub_discount_paid", binding.Id, binding.ContractId, 9306, 9206, 1234, 0, 500, 300, 300, 934, "stripe-invoice:in_discount_paid:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_paid:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := stripeInvoiceFixture("in_discount_paid", "sub_discount_paid")
	inv.AmountPaid = 934
	inv.Total = 934
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_discount_paid")

	require.NoError(t, err)
	require.True(t, result.Applied)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9206).Error)
	require.Zero(t, account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_paid:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
}

func TestSubscriptionDiscountInvoicePaidValidationUsesSnapshotFinalPayment(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9211, 9311, "sub_discount_paid_snapshot")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9211, 9311, "sub_discount_paid_snapshot_initial")).Error)
	grantRenewalInvitationCredit(t, 9211, 500, "grant-renewal-paid-snapshot")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9211,
			USDMinor:           500,
			TradeNo:            "in_discount_paid_snapshot",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_paid_snapshot", "sub_discount_paid_snapshot", binding.Id, binding.ContractId, 9311, 9211, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_paid_snapshot:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_paid_snapshot:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := stripeInvoiceFixture("in_discount_paid_snapshot", "sub_discount_paid_snapshot")
	inv.AmountPaid = 734
	inv.Total = 734
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_paid_snapshot", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	result, err := ReconcilePaidInvoice(context.Background(), "in_discount_paid_snapshot")
	require.NoError(t, err)
	require.True(t, result.Applied)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_paid_snapshot:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
}

func TestSubscriptionDiscountInvoicePaidValidationRejectsMismatchedSnapshotFinalPayment(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9212, 9312, "sub_discount_paid_mismatch")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9212, 9312, "sub_discount_paid_mismatch_initial")).Error)
	grantRenewalInvitationCredit(t, 9212, 500, "grant-renewal-paid-mismatch")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9212,
			USDMinor:           500,
			TradeNo:            "in_discount_paid_mismatch",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_paid_mismatch", "sub_discount_paid_mismatch", binding.Id, binding.ContractId, 9312, 9212, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_paid_mismatch:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_paid_mismatch:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := stripeInvoiceFixture("in_discount_paid_mismatch", "sub_discount_paid_mismatch")
	inv.AmountPaid = 735
	inv.Total = 735
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_paid_mismatch", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	_, err := ReconcilePaidInvoice(context.Background(), "in_discount_paid_mismatch")
	require.ErrorContains(t, err, "Stripe invoice amount mismatch: expected 734 got 735")
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ?", "stripe-invoice:in_discount_paid_mismatch:reserve").Count(&commitCount).Error)
	require.Zero(t, commitCount)
}

func TestSubscriptionDiscountInvoicePaidValidationRejectsMalformedSnapshot(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9213, 9313, "sub_discount_paid_bad_snapshot")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9213, 9313, "sub_discount_paid_bad_snapshot_initial")).Error)
	grantRenewalInvitationCredit(t, 9213, 500, "grant-renewal-paid-bad-snapshot")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9213,
			USDMinor:           500,
			TradeNo:            "in_discount_paid_bad_snapshot",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    `{"invoice_id":"in_discount_paid_bad_snapshot"}`,
			IdempotencyKey:     "stripe-invoice:in_discount_paid_bad_snapshot:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	inv := stripeInvoiceFixture("in_discount_paid_bad_snapshot", "sub_discount_paid_bad_snapshot")
	inv.AmountPaid = 934
	inv.Total = 934
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_paid_bad_snapshot", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	_, err := ReconcilePaidInvoice(context.Background(), "in_discount_paid_bad_snapshot")
	require.ErrorContains(t, err, "subscription discount invoice snapshot")
}

func TestSubscriptionDiscountInvoiceLatePaidAfterReleaseGrantsEntitlementWithoutLedgerMutation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	contract, binding, entitlement := seedStripeRenewalContract(t, 9214, 9314, "sub_discount_late_paid")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9214, 9314, "sub_discount_late_paid_initial")).Error)
	grantRenewalInvitationCredit(t, 9214, 500, "grant-renewal-late-paid")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9214,
			USDMinor:           500,
			TradeNo:            "in_discount_late_paid",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_late_paid", "sub_discount_late_paid", binding.Id, binding.ContractId, 9314, 9214, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_late_paid:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_late_paid:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	require.NoError(t, ReleaseStripeSubscriptionDiscountInvoice(context.Background(), "in_discount_late_paid"))
	inv := stripeInvoiceFixture("in_discount_late_paid", "sub_discount_late_paid")
	inv.AmountPaid = 734
	inv.Total = 734
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_late_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	first, err := ReconcilePaidInvoice(context.Background(), "in_discount_late_paid")
	require.NoError(t, err)
	require.True(t, first.Applied)
	second, err := ReconcilePaidInvoice(context.Background(), "in_discount_late_paid")
	require.NoError(t, err)
	require.False(t, second.Applied)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_late_paid:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_late_paid:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Zero(t, commitCount)
	var reloaded model.UserSubscriptionContract
	require.NoError(t, model.DB.First(&reloaded, "id = ?", contract.Id).Error)
	require.NotEqual(t, entitlement.Id, reloaded.CurrentEntitlementId)
	require.Equal(t, "in_discount_late_paid", first.Binding.ProviderLatestInvoiceId)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9214).Error)
	require.Equal(t, int64(500), account.AvailableUSDMinor)
	require.Zero(t, account.ReservedUSDMinor)
}

func TestSubscriptionReconciliationDiscountConcurrentPaidCommitsOnce(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9215, 9315, "sub_discount_concurrent_paid")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9215, 9315, "sub_discount_concurrent_paid_initial")).Error)
	grantRenewalInvitationCredit(t, 9215, 500, "grant-renewal-concurrent-paid")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9215,
			USDMinor:           500,
			TradeNo:            "in_discount_concurrent_paid",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_concurrent_paid", "sub_discount_concurrent_paid", binding.Id, binding.ContractId, 9315, 9215, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_concurrent_paid:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_concurrent_paid:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_concurrent_paid:reserve")
	inv := stripeInvoiceFixture("in_discount_concurrent_paid", "sub_discount_concurrent_paid")
	inv.AmountPaid = 734
	inv.Total = 734
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_concurrent_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_concurrent_paid:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
}

func TestSubscriptionReconciliationDiscountConcurrentFinalReleasesOnce(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	grantRenewalInvitationCredit(t, 9216, 500, "grant-renewal-concurrent-final")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9216,
			USDMinor:           500,
			TradeNo:            "in_discount_concurrent_final",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_concurrent_final", "sub_discount_concurrent_final", 1, 1, 9316, 9216, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_concurrent_final:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_concurrent_final:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_concurrent_final:reserve")
	inv := stripeInvoiceFixture("in_discount_concurrent_final", "sub_discount_concurrent_final")
	inv.Status = stripe.InvoiceStatusVoid
	inv.AmountPaid = 0
	restore := replaceStripeInvoiceReconcilers(t, inv, stripeSubscriptionFixture("sub_discount_concurrent_final", map[string]string{}))
	defer restore()

	var wg sync.WaitGroup
	errs := make(chan error, 2)
	for i := 0; i < 2; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
			errs <- err
		}()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		require.NoError(t, err)
	}
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_concurrent_final:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
}

func TestSubscriptionReconciliationStaleDiscountInvoicePaidCommitsReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9207, 9307, "sub_discount_stale_paid")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9207, 9307, "sub_discount_stale_paid_initial")).Error)
	grantRenewalInvitationCredit(t, 9207, 500, "grant-renewal-stale-paid")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9207,
			USDMinor:           500,
			TradeNo:            "in_discount_stale_paid",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_paid", "sub_discount_stale_paid", binding.Id, binding.ContractId, 9307, 9207, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_stale_paid:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_paid:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_paid:reserve")
	inv := stripeInvoiceFixture("in_discount_stale_paid", "sub_discount_stale_paid")
	inv.AmountPaid = 734
	inv.Total = 734
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_stale_paid", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	restore := replaceStripeInvoiceReconcilers(t, inv, sub)
	defer restore()

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var commitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_stale_paid:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&commitCount).Error)
	require.Equal(t, int64(1), commitCount)
}

func TestSubscriptionReconciliationStaleDiscountInvoiceFinalReleasesReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	grantRenewalInvitationCredit(t, 9208, 500, "grant-renewal-stale-final")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9208,
			USDMinor:           500,
			TradeNo:            "in_discount_stale_final",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_final", "sub_discount_stale_final", 1, 1, 9308, 9208, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_stale_final:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_final:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_final:reserve")
	inv := stripeInvoiceFixture("in_discount_stale_final", "sub_discount_stale_final")
	inv.Status = stripe.InvoiceStatusVoid
	inv.AmountPaid = 0
	restore := replaceStripeInvoiceReconcilers(t, inv, stripeSubscriptionFixture("sub_discount_stale_final", map[string]string{}))
	defer restore()

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var releaseCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_stale_final:reserve", model.SubscriptionDiscountEntryTypeRelease).Count(&releaseCount).Error)
	require.Equal(t, int64(1), releaseCount)
}

func TestSubscriptionDiscountInvoiceReconciliationRetriesPausedDraftPreparation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9209, 9309, "sub_discount_stale_pending")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9209, 9309, "sub_discount_stale_pending_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", binding.ContractId).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9209, 500, "grant-renewal-stale-pending")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9209,
			USDMinor:           300,
			TradeNo:            "in_discount_stale_pending",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_pending", "sub_discount_stale_pending", binding.Id, binding.ContractId, 9309, 9209, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_stale_pending:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_pending:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	require.NoError(t, model.DB.Exec("UPDATE subscription_discount_entries SET created_at = ? WHERE idempotency_key = ?", common.GetTimestamp()-901, "stripe-invoice:in_discount_stale_pending:reserve").Error)
	inv := draftRenewalInvoiceFixture("in_discount_stale_pending", "sub_discount_stale_pending")
	inv.AutoAdvance = false
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_stale_pending", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, count)
	require.Equal(t, []bool{false, true}, recorder.updates)
	require.Equal(t, []int64{-300}, recorder.items)
	require.Equal(t, []string{"stripe-invoice:in_discount_stale_pending:adjustment"}, recorder.itemIdempotencyKeys)
	var terminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ?", "stripe-invoice:in_discount_stale_pending:reserve").Count(&terminalCount).Error)
	require.Zero(t, terminalCount)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9209).Error)
	require.Equal(t, int64(200), account.AvailableUSDMinor)
	require.Equal(t, int64(300), account.ReservedUSDMinor)
}

func TestSubscriptionDiscountInvoiceReconciliationOpenInvoiceFailsClosedAndKeepsReservation(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9222, 9322, "sub_discount_stale_open")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9222, 9322, "sub_discount_stale_open_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", binding.ContractId).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9222, 500, "grant-renewal-stale-open")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9222,
			USDMinor:           300,
			TradeNo:            "in_discount_stale_open",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_open", "sub_discount_stale_open", binding.Id, binding.ContractId, 9322, 9222, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_stale_open:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_open:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	require.NoError(t, model.DB.Exec("UPDATE subscription_discount_entries SET created_at = ? WHERE idempotency_key = ?", common.GetTimestamp()-901, "stripe-invoice:in_discount_stale_open:reserve").Error)
	inv := stripeInvoiceFixture("in_discount_stale_open", "sub_discount_stale_open")
	inv.Status = stripe.InvoiceStatusOpen
	inv.AmountPaid = 0
	inv.Total = 734
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_stale_open", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Zero(t, count)
	require.Empty(t, recorder.updates)
	require.Empty(t, recorder.items)
	var terminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ?", "stripe-invoice:in_discount_stale_open:reserve").Count(&terminalCount).Error)
	require.Zero(t, terminalCount)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9222).Error)
	require.Equal(t, int64(200), account.AvailableUSDMinor)
	require.Equal(t, int64(300), account.ReservedUSDMinor)
}

func TestSubscriptionDiscountInvoiceReconciliationOpenInvoiceDoesNotStarveLaterPaidReserve(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, openBinding, openEntitlement := seedStripeRenewalContract(t, 9223, 9323, "sub_discount_stale_open_batch")
	require.NoError(t, model.DB.Model(&model.User{}).Where("id = ?", 9223).Updates(map[string]any{
		"username":        "renewal_user_open_batch",
		"email":           "renewal-open-batch@example.com",
		"aff_code":        "renewal_aff_open_batch",
		"stripe_customer": "cus_invoice_open_batch",
	}).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscription{}).Where("id = ?", openEntitlement.Id).Update("grant_key", "stripe:in_old_open_batch").Error)
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", openBinding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9223, 9323, "sub_discount_stale_open_batch_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", openBinding.ContractId).Update("current_period_end", openEntitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9223, 500, "grant-renewal-stale-open-batch")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9223,
			USDMinor:           300,
			TradeNo:            "in_discount_stale_open_batch",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_open_batch", "sub_discount_stale_open_batch", openBinding.Id, openBinding.ContractId, 9323, 9223, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_stale_open_batch:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_open_batch:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))

	_, paidBinding, paidEntitlement := seedStripeRenewalContract(t, 9224, 9324, "sub_discount_stale_paid_batch")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", paidBinding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9224, 9324, "sub_discount_stale_paid_batch_initial")).Error)
	grantRenewalInvitationCredit(t, 9224, 500, "grant-renewal-stale-paid-batch")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9224,
			USDMinor:           500,
			TradeNo:            "in_discount_stale_paid_batch",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_paid_batch", "sub_discount_stale_paid_batch", paidBinding.Id, paidBinding.ContractId, 9324, 9224, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_stale_paid_batch:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_paid_batch:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_open_batch:reserve")
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_paid_batch:reserve")

	openInv := stripeInvoiceFixture("in_discount_stale_open_batch", "sub_discount_stale_open_batch")
	openInv.Status = stripe.InvoiceStatusOpen
	openInv.AmountPaid = 0
	openInv.Total = 734
	openInv.Lines.Data[0].Period = &stripe.Period{Start: openEntitlement.EndTime, End: openEntitlement.EndTime + 2592000}
	paidInv := stripeInvoiceFixture("in_discount_stale_paid_batch", "sub_discount_stale_paid_batch")
	paidInv.AmountPaid = 734
	paidInv.Total = 734
	paidInv.Lines.Data[0].Period = &stripe.Period{Start: paidEntitlement.EndTime, End: paidEntitlement.EndTime + 2592000}
	paidSub := stripeSubscriptionFixture("sub_discount_stale_paid_batch", map[string]string{})
	setStripeSubscriptionCurrentPeriod(paidSub, paidEntitlement.EndTime, paidEntitlement.EndTime+2592000)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		switch invoiceID {
		case openInv.ID:
			return openInv, nil
		case paidInv.ID:
			return paidInv, nil
		default:
			return nil, errors.New("unexpected invoice")
		}
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, paidSub.ID, subscriptionID)
		return paidSub, nil
	}

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var openTerminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ?", "stripe-invoice:in_discount_stale_open_batch:reserve").Count(&openTerminalCount).Error)
	require.Zero(t, openTerminalCount)
	var paidCommitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_stale_paid_batch:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&paidCommitCount).Error)
	require.Equal(t, int64(1), paidCommitCount)
}

func TestSubscriptionDiscountInvoiceReconciliationFullOpenPageDoesNotStarveLaterPaidReserve(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	grantRenewalInvitationCredit(t, 9230, int64(stripeSubscriptionReconciliationBatchSize), "grant-renewal-full-open-page")
	openReservationKeys := make([]string, 0, stripeSubscriptionReconciliationBatchSize)
	openInvoiceIDs := make(map[string]struct{}, stripeSubscriptionReconciliationBatchSize)
	for i := 0; i < stripeSubscriptionReconciliationBatchSize; i++ {
		invoiceID := "in_discount_stale_open_full_" + strconv.Itoa(i)
		reservationKey := "stripe-invoice:" + invoiceID + ":reserve"
		require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
			_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
				UserID:             9230,
				USDMinor:           1,
				TradeNo:            invoiceID,
				PaymentCurrency:    "USD",
				AppliedAmountMinor: 1,
				PricingSnapshot:    `{"source":"open-full-page-test"}`,
				IdempotencyKey:     reservationKey,
				ExpiresAt:          common.GetTimestamp() + 3600,
			})
			return err
		}))
		expireSubscriptionDiscountReservationForTest(t, reservationKey)
		openReservationKeys = append(openReservationKeys, reservationKey)
		openInvoiceIDs[invoiceID] = struct{}{}
	}

	_, paidBinding, paidEntitlement := seedStripeRenewalContract(t, 9231, 9331, "sub_discount_stale_paid_after_full_open")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", paidBinding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9231, 9331, "sub_discount_stale_paid_after_full_open_initial")).Error)
	grantRenewalInvitationCredit(t, 9231, 500, "grant-renewal-stale-paid-after-full-open")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9231,
			USDMinor:           500,
			TradeNo:            "in_discount_stale_paid_after_full_open",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_paid_after_full_open", "sub_discount_stale_paid_after_full_open", paidBinding.Id, paidBinding.ContractId, 9331, 9231, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_stale_paid_after_full_open:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_paid_after_full_open:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_paid_after_full_open:reserve")

	paidInv := stripeInvoiceFixture("in_discount_stale_paid_after_full_open", "sub_discount_stale_paid_after_full_open")
	paidInv.AmountPaid = 734
	paidInv.Total = 734
	paidInv.Lines.Data[0].Period = &stripe.Period{Start: paidEntitlement.EndTime, End: paidEntitlement.EndTime + 2592000}
	paidSub := stripeSubscriptionFixture("sub_discount_stale_paid_after_full_open", map[string]string{})
	setStripeSubscriptionCurrentPeriod(paidSub, paidEntitlement.EndTime, paidEntitlement.EndTime+2592000)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		if _, ok := openInvoiceIDs[invoiceID]; ok {
			return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusOpen}, nil
		}
		if invoiceID == paidInv.ID {
			return paidInv, nil
		}
		return nil, errors.New("unexpected invoice")
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, paidSub.ID, subscriptionID)
		return paidSub, nil
	}

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, count)
	var openTerminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key IN ?", openReservationKeys).Count(&openTerminalCount).Error)
	require.Zero(t, openTerminalCount)
	var paidCommitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_stale_paid_after_full_open:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&paidCommitCount).Error)
	require.Equal(t, int64(1), paidCommitCount)
}

func TestSubscriptionDiscountInvoiceReconciliationPersistentCursorAdvancesPastMaxOpenPages(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	resetStripeSubscriptionDiscountInvoiceReconciliationCursorForTest(t)
	t.Cleanup(func() {
		resetStripeSubscriptionDiscountInvoiceReconciliationCursorForTest(t)
	})
	openCount := stripeSubscriptionReconciliationBatchSize * stripeSubscriptionDiscountInvoiceReconciliationMaxPages
	grantRenewalInvitationCredit(t, 9240, int64(openCount), "grant-renewal-max-open-pages")
	openInvoiceIDs := make(map[string]struct{}, openCount)
	for i := 0; i < openCount; i++ {
		invoiceID := "in_discount_stale_open_max_" + strconv.Itoa(i)
		reservationKey := "stripe-invoice:" + invoiceID + ":reserve"
		require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
			_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
				UserID:             9240,
				USDMinor:           1,
				TradeNo:            invoiceID,
				PaymentCurrency:    "USD",
				AppliedAmountMinor: 1,
				PricingSnapshot:    `{"source":"open-max-pages-test"}`,
				IdempotencyKey:     reservationKey,
				ExpiresAt:          common.GetTimestamp() + 3600,
			})
			return err
		}))
		expireSubscriptionDiscountReservationForTest(t, reservationKey)
		openInvoiceIDs[invoiceID] = struct{}{}
	}

	_, paidBinding, paidEntitlement := seedStripeRenewalContract(t, 9241, 9341, "sub_discount_stale_paid_after_max_open")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", paidBinding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9241, 9341, "sub_discount_stale_paid_after_max_open_initial")).Error)
	grantRenewalInvitationCredit(t, 9241, 500, "grant-renewal-stale-paid-after-max-open")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9241,
			USDMinor:           500,
			TradeNo:            "in_discount_stale_paid_after_max_open",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_paid_after_max_open", "sub_discount_stale_paid_after_max_open", paidBinding.Id, paidBinding.ContractId, 9341, 9241, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_stale_paid_after_max_open:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_paid_after_max_open:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_paid_after_max_open:reserve")

	paidInv := stripeInvoiceFixture("in_discount_stale_paid_after_max_open", "sub_discount_stale_paid_after_max_open")
	paidInv.AmountPaid = 734
	paidInv.Total = 734
	paidInv.Lines.Data[0].Period = &stripe.Period{Start: paidEntitlement.EndTime, End: paidEntitlement.EndTime + 2592000}
	paidSub := stripeSubscriptionFixture("sub_discount_stale_paid_after_max_open", map[string]string{})
	setStripeSubscriptionCurrentPeriod(paidSub, paidEntitlement.EndTime, paidEntitlement.EndTime+2592000)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	})
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		if _, ok := openInvoiceIDs[invoiceID]; ok {
			return &stripe.Invoice{ID: invoiceID, Status: stripe.InvoiceStatusOpen}, nil
		}
		if invoiceID == paidInv.ID {
			return paidInv, nil
		}
		return nil, errors.New("unexpected invoice")
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, paidSub.ID, subscriptionID)
		return paidSub, nil
	}

	firstCount, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Zero(t, firstCount)
	var cursor model.Option
	require.NoError(t, model.DB.Where("key = ?", stripeSubscriptionDiscountInvoiceReconciliationCursorOptionKey).First(&cursor).Error)
	cursorState, err := parseStripeSubscriptionDiscountInvoiceReconciliationCursor(cursor.Value)
	require.NoError(t, err)
	require.Greater(t, cursorState.LastID, int64(0))
	require.Equal(t, int64(stripeSubscriptionDiscountInvoiceReconciliationMaxPages), cursorState.Revision)

	secondCount, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, secondCount)
	var paidCommitCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ? AND entry_type = ?", "stripe-invoice:in_discount_stale_paid_after_max_open:reserve", model.SubscriptionDiscountEntryTypeCommit).Count(&paidCommitCount).Error)
	require.Equal(t, int64(1), paidCommitCount)
}

func TestSubscriptionDiscountInvoiceReconciliationDoesNotAdvanceCursorOnTransientError(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	resetStripeSubscriptionDiscountInvoiceReconciliationCursorForTest(t)
	t.Cleanup(func() {
		resetStripeSubscriptionDiscountInvoiceReconciliationCursorForTest(t)
	})
	grantRenewalInvitationCredit(t, 9242, 1, "grant-renewal-transient-error")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9242,
			USDMinor:           1,
			TradeNo:            "in_discount_stale_transient_error",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 1,
			PricingSnapshot:    `{"source":"transient-error-test"}`,
			IdempotencyKey:     "stripe-invoice:in_discount_stale_transient_error:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_stale_transient_error:reserve")

	_, paidBinding, paidEntitlement := seedStripeRenewalContract(t, 9243, 9343, "sub_discount_paid_after_transient_error")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", paidBinding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9243, 9343, "sub_discount_paid_after_transient_error_initial")).Error)
	grantRenewalInvitationCredit(t, 9243, 500, "grant-renewal-paid-after-transient-error")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9243,
			USDMinor:           500,
			TradeNo:            "in_discount_paid_after_transient_error",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_paid_after_transient_error", "sub_discount_paid_after_transient_error", paidBinding.Id, paidBinding.ContractId, 9343, 9243, 1234, 200, 500, 500, 300, 734, "stripe-invoice:in_discount_paid_after_transient_error:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_paid_after_transient_error:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	expireSubscriptionDiscountReservationForTest(t, "stripe-invoice:in_discount_paid_after_transient_error:reserve")

	transientInv := &stripe.Invoice{ID: "in_discount_stale_transient_error", Status: stripe.InvoiceStatusOpen}
	paidInv := stripeInvoiceFixture("in_discount_paid_after_transient_error", "sub_discount_paid_after_transient_error")
	paidInv.AmountPaid = 734
	paidInv.Total = 734
	paidInv.Lines.Data[0].Period = &stripe.Period{Start: paidEntitlement.EndTime, End: paidEntitlement.EndTime + 2592000}
	paidSub := stripeSubscriptionFixture("sub_discount_paid_after_transient_error", map[string]string{})
	setStripeSubscriptionCurrentPeriod(paidSub, paidEntitlement.EndTime, paidEntitlement.EndTime+2592000)

	originalInvoiceGetter := stripeInvoiceGetter
	originalSubscriptionGetter := stripeSubscriptionGetter
	t.Cleanup(func() {
		stripeInvoiceGetter = originalInvoiceGetter
		stripeSubscriptionGetter = originalSubscriptionGetter
	})
	transientFailures := 1
	secondRunSeen := make([]string, 0, 2)
	recordSecondRun := false
	stripeInvoiceGetter = func(ctx context.Context, invoiceID string) (*stripe.Invoice, error) {
		if recordSecondRun {
			secondRunSeen = append(secondRunSeen, invoiceID)
		}
		switch invoiceID {
		case transientInv.ID:
			if transientFailures > 0 {
				transientFailures--
				return nil, errors.New("temporary Stripe read failure")
			}
			return transientInv, nil
		case paidInv.ID:
			return paidInv, nil
		default:
			return nil, errors.New("unexpected invoice")
		}
	}
	stripeSubscriptionGetter = func(ctx context.Context, subscriptionID string) (*stripe.Subscription, error) {
		require.Equal(t, paidSub.ID, subscriptionID)
		return paidSub, nil
	}

	firstCount, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.ErrorContains(t, err, "temporary Stripe read failure")
	require.Zero(t, firstCount)
	cursorState, err := loadStripeSubscriptionDiscountInvoiceReconciliationCursor()
	require.NoError(t, err)
	require.Zero(t, cursorState.LastID)
	require.Zero(t, cursorState.Revision)

	recordSecondRun = true
	secondCount, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.NoError(t, err)
	require.Equal(t, 1, secondCount)
	require.NotEmpty(t, secondRunSeen)
	require.Equal(t, transientInv.ID, secondRunSeen[0])
}

func TestSubscriptionDiscountInvoicePersistentPreparationFailureRemainsPausedAndObservable(t *testing.T) {
	setupSubscriptionInvoiceServiceTestDB(t)
	_, binding, entitlement := seedStripeRenewalContract(t, 9221, 9321, "sub_discount_stale_failure")
	require.NoError(t, model.DB.Model(&model.SubscriptionProviderBinding{}).Where("id = ?", binding.Id).Update("initial_order_id", seedInitialOrderSnapshotForRenewal(t, 9221, 9321, "sub_discount_stale_failure_initial")).Error)
	require.NoError(t, model.DB.Model(&model.UserSubscriptionContract{}).Where("id = ?", binding.ContractId).Update("current_period_end", entitlement.EndTime).Error)
	grantRenewalInvitationCredit(t, 9221, 500, "grant-renewal-stale-failure")
	require.NoError(t, model.DB.Transaction(func(tx *gorm.DB) error {
		_, err := model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             9221,
			USDMinor:           300,
			TradeNo:            "in_discount_stale_failure",
			PaymentCurrency:    "USD",
			AppliedAmountMinor: 300,
			PricingSnapshot:    renewalInvoiceSnapshotJSONForTest(t, "in_discount_stale_failure", "sub_discount_stale_failure", binding.Id, binding.ContractId, 9321, 9221, 1234, 200, 300, 500, 300, 734, "stripe-invoice:in_discount_stale_failure:reserve"),
			IdempotencyKey:     "stripe-invoice:in_discount_stale_failure:reserve",
			ExpiresAt:          common.GetTimestamp() + 3600,
		})
		return err
	}))
	require.NoError(t, model.DB.Exec("UPDATE subscription_discount_entries SET created_at = ? WHERE idempotency_key = ?", common.GetTimestamp()-901, "stripe-invoice:in_discount_stale_failure:reserve").Error)
	inv := draftRenewalInvoiceFixture("in_discount_stale_failure", "sub_discount_stale_failure")
	inv.AutoAdvance = false
	inv.Lines.Data[0].Period = &stripe.Period{Start: entitlement.EndTime, End: entitlement.EndTime + 2592000}
	sub := stripeSubscriptionFixture("sub_discount_stale_failure", map[string]string{})
	setStripeSubscriptionCurrentPeriod(sub, entitlement.EndTime, entitlement.EndTime+2592000)
	recorder := &stripeRenewalInvoiceMutationRecorder{failItem: true}
	replaceStripeRenewalInvoiceAccessors(t, inv, sub, recorder)

	count, err := ReconcileStaleStripeSubscriptionDiscountInvoices(context.Background())
	require.ErrorContains(t, err, "stripe invoice item failed")
	require.Zero(t, count)
	require.Equal(t, []bool{false}, recorder.updates)
	require.Empty(t, recorder.items)
	var terminalCount int64
	require.NoError(t, model.DB.Model(&model.SubscriptionDiscountEntry{}).Where("terminal_reservation_key = ?", "stripe-invoice:in_discount_stale_failure:reserve").Count(&terminalCount).Error)
	require.Zero(t, terminalCount)
	var account model.SubscriptionDiscountAccount
	require.NoError(t, model.DB.First(&account, "user_id = ?", 9221).Error)
	require.Equal(t, int64(200), account.AvailableUSDMinor)
	require.Equal(t, int64(300), account.ReservedUSDMinor)
}

func renewalInvoiceSnapshotJSONForTest(t *testing.T, invoiceID string, subscriptionID string, bindingID int64, contractID int64, planID int, userID int, originalSubtotal int64, existingDiscount int64, selectedUSD int64, selectedLocal int64, incremental int64, expectedFinal int64, reservationKey string) string {
	t.Helper()
	payload := map[string]any{
		"version":                         1,
		"source":                          "stripe_renewal_invoice_discount",
		"invoice_id":                      invoiceID,
		"subscription_id":                 subscriptionID,
		"binding_id":                      bindingID,
		"contract_id":                     contractID,
		"plan_id":                         planID,
		"user_id":                         userID,
		"currency":                        "USD",
		"canonical_usd_minor":             originalSubtotal,
		"original_subtotal_minor":         originalSubtotal,
		"existing_discount_minor":         existingDiscount,
		"selected_invitation_usd_minor":   selectedUSD,
		"selected_invitation_local_minor": selectedLocal,
		"incremental_item_minor":          incremental,
		"expected_final_payment_minor":    expectedFinal,
		"account_available_before":        selectedUSD,
		"account_available_remaining":     int64(0),
		"account_reserved_before":         int64(0),
		"account_reserved_after":          selectedUSD,
		"reservation_key":                 reservationKey,
		"item_idempotency_key":            strings.TrimSuffix(reservationKey, ":reserve") + ":adjustment",
		"original_auto_advance":           true,
	}
	data, err := common.Marshal(payload)
	require.NoError(t, err)
	return string(data)
}

func legacyRenewalInvoiceSnapshotJSONForTest(t *testing.T, invoiceID string, subscriptionID string, bindingID int64, contractID int64, planID int, userID int, originalSubtotal int64, existingDiscount int64, selectedUSD int64, selectedLocal int64, incremental int64, expectedFinal int64, reservationKey string) string {
	t.Helper()
	var payload map[string]any
	require.NoError(t, common.Unmarshal([]byte(renewalInvoiceSnapshotJSONForTest(t, invoiceID, subscriptionID, bindingID, contractID, planID, userID, originalSubtotal, existingDiscount, selectedUSD, selectedLocal, incremental, expectedFinal, reservationKey)), &payload))
	delete(payload, "original_auto_advance")
	data, err := common.Marshal(payload)
	require.NoError(t, err)
	return string(data)
}

func stripeDiscountInvoiceItemFixture(itemID string, invoiceID string, amount int64, currency stripe.Currency, metadata map[string]string) *stripe.InvoiceItem {
	return &stripe.InvoiceItem{
		ID:       itemID,
		Amount:   amount,
		Currency: currency,
		Invoice:  &stripe.Invoice{ID: invoiceID},
		Metadata: metadata,
	}
}

func seedInitialOrderSnapshotForRenewal(t *testing.T, userID int, planID int, tradeNo string) int {
	t.Helper()
	order := model.SubscriptionOrder{
		UserId:          userID,
		PlanId:          planID,
		Money:           12.34,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodStripe,
		PaymentProvider: model.PaymentProviderStripe,
		Status:          common.TopUpStatusSuccess,
		CreateTime:      common.GetTimestamp(),
		CompleteTime:    common.GetTimestamp(),
		PaymentCurrency: "USD",
		PlanSnapshot:    `{"plan_id":` + strconv.Itoa(planID) + `,"title":"Renewal Plan","price_amount":12.34,"currency":"USD","stripe_price_id":"price_invoice_plan","duration_unit":"month","duration_value":1,"total_amount":1234}`,
	}
	require.NoError(t, model.DB.Create(&order).Error)
	return order.Id
}
