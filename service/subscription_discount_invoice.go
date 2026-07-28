package service

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/stripe/stripe-go/v86"
	"gorm.io/gorm"
)

const stripeInvoiceDiscountReservePrefix = "stripe-invoice:"

type stripeSubscriptionDiscountInvoiceSnapshot struct {
	Version                           int    `json:"version"`
	Source                            string `json:"source"`
	InvoiceID                         string `json:"invoice_id"`
	SubscriptionID                    string `json:"subscription_id"`
	BindingID                         int64  `json:"binding_id"`
	ContractID                        int64  `json:"contract_id"`
	PlanID                            int    `json:"plan_id"`
	UserID                            int    `json:"user_id"`
	Currency                          string `json:"currency"`
	CanonicalUSDMinor                 int64  `json:"canonical_usd_minor"`
	OriginalSubtotalMinor             int64  `json:"original_subtotal_minor"`
	ExistingDiscountMinor             int64  `json:"existing_discount_minor"`
	SelectedInvitationUSDMinor        int64  `json:"selected_invitation_usd_minor"`
	SelectedInvitationLocalMinor      int64  `json:"selected_invitation_local_minor"`
	IncrementalItemMinor              int64  `json:"incremental_item_minor"`
	ExpectedFinalPaymentMinor         int64  `json:"expected_final_payment_minor"`
	AccountAvailableBeforeUSDMinor    int64  `json:"account_available_before"`
	AccountAvailableRemainingUSDMinor int64  `json:"account_available_remaining"`
	AccountReservedBeforeUSDMinor     int64  `json:"account_reserved_before"`
	AccountReservedAfterUSDMinor      int64  `json:"account_reserved_after"`
	ReservationKey                    string `json:"reservation_key"`
	ItemIdempotencyKey                string `json:"item_idempotency_key"`
}

func PrepareStripeSubscriptionDiscountInvoice(ctx context.Context, invoiceID string) (err error) {
	invoiceID = strings.TrimSpace(invoiceID)
	if invoiceID == "" {
		return PermanentPaidInvoiceError(errors.New("Stripe invoice id is required"))
	}
	inv, err := stripeInvoiceGetter(ctx, invoiceID)
	if err != nil {
		return err
	}
	if !stripeInvoiceEligibleForDiscountPreparation(inv) {
		return nil
	}
	subscriptionID := stripeInvoiceSubscriptionID(inv)
	if subscriptionID == "" {
		return PermanentPaidInvoiceError(errors.New("Stripe invoice subscription id is missing"))
	}
	sub, err := stripeSubscriptionGetter(ctx, subscriptionID)
	if err != nil {
		return err
	}
	facts, err := validateStripeDiscountInvoiceFacts(inv, sub)
	if err != nil {
		return err
	}
	if err := pauseStripeSubscriptionInvoice(ctx, invoiceID); err != nil {
		return err
	}
	resume := true
	var prepare stripeSubscriptionDiscountInvoicePrepare
	defer func() {
		if resume {
			if resumeErr := resumeStripeSubscriptionInvoice(ctx, invoiceID, stripeSubscriptionDiscountInvoiceMetadata(prepare.SnapshotFacts)); resumeErr != nil {
				err = resumeErr
			}
		}
	}()

	prepare, err = buildStripeSubscriptionDiscountInvoicePrepareTx(facts, stripeInvoiceExistingDiscountMinor(inv))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) || errors.Is(err, model.ErrSubscriptionDiscountInsufficient) {
			return nil
		}
		return err
	}
	if prepare.IncrementalAmountMinor <= 0 {
		return nil
	}
	if err := createStripeSubscriptionDiscountInvoiceItem(ctx, prepare); err != nil {
		resume = false
		return err
	}
	return nil
}

type stripeSubscriptionDiscountInvoicePrepare struct {
	InvoiceID              string
	SubscriptionID         string
	CustomerID             string
	Currency               string
	IncrementalAmountMinor int64
	ReservationKey         string
	Snapshot               string
	SnapshotFacts          stripeSubscriptionDiscountInvoiceSnapshot
}

func buildStripeSubscriptionDiscountInvoicePrepareTx(facts stripeInvoiceCommonFacts, existingDiscount int64) (stripeSubscriptionDiscountInvoicePrepare, error) {
	var prepare stripeSubscriptionDiscountInvoicePrepare
	err := model.DB.Transaction(func(tx *gorm.DB) error {
		// Lock order: local renewal binding facts first, then the discount account
		// inside ReserveSubscriptionDiscountTx. Stripe invoice updates and item
		// creation happen outside this transaction.
		existingPrepare, found, err := existingStripeSubscriptionDiscountInvoicePrepareTx(tx, facts)
		if err != nil {
			return err
		}
		if found {
			prepare = existingPrepare
			return nil
		}
		binding, contract, plan, user, err := lockRenewalBindingFactsTx(tx, facts)
		if err != nil {
			return err
		}
		planSnapshot, err := recurringPlanSnapshotFromBindingTx(tx, binding)
		if err != nil {
			return PermanentPaidInvoiceError(err)
		}
		if err := validateRenewalInvoiceFactsTx(tx, facts, binding, contract, plan, user, planSnapshot); err != nil {
			return PermanentPaidInvoiceError(err)
		}
		account, err := model.GetSubscriptionDiscountAccountTx(tx, binding.UserId)
		if err != nil {
			return err
		}
		canonicalUSDMinor, err := canonicalRenewalUSDMinor(plan, planSnapshot)
		if err != nil {
			return err
		}
		quote, err := BuildSubscriptionDiscountQuote(SubscriptionDiscountQuoteInput{
			Currency:                 facts.Currency,
			OriginalAmountMinor:      facts.Amount,
			OriginalUSDMinor:         canonicalUSDMinor,
			AvailableUSDMinor:        account.AvailableUSDMinor,
			OtherDiscountKind:        "stripe_existing",
			OtherDiscountAmountMinor: existingDiscount,
		})
		if err != nil {
			return err
		}
		if quote.SelectedKind != SubscriptionDiscountKindInvitation || quote.InvitationDiscountAmountMinor <= existingDiscount {
			return nil
		}
		incremental := quote.InvitationDiscountAmountMinor - existingDiscount
		if incremental <= 0 || incremental > facts.Amount {
			return nil
		}
		reservationKey := stripeSubscriptionDiscountInvoiceReservationKey(facts.InvoiceID)
		expectedFinal := facts.Amount - existingDiscount - incremental
		if expectedFinal < 0 {
			expectedFinal = 0
		}
		snapshotFacts := stripeSubscriptionDiscountInvoiceSnapshot{
			Version:                           1,
			Source:                            "stripe_renewal_invoice_discount",
			InvoiceID:                         facts.InvoiceID,
			SubscriptionID:                    facts.SubscriptionID,
			BindingID:                         binding.Id,
			ContractID:                        binding.ContractId,
			PlanID:                            plan.Id,
			UserID:                            binding.UserId,
			Currency:                          facts.Currency,
			CanonicalUSDMinor:                 canonicalUSDMinor,
			OriginalSubtotalMinor:             facts.Amount,
			ExistingDiscountMinor:             existingDiscount,
			SelectedInvitationUSDMinor:        quote.InvitationDiscountUSDMinor,
			SelectedInvitationLocalMinor:      quote.InvitationDiscountAmountMinor,
			IncrementalItemMinor:              incremental,
			ExpectedFinalPaymentMinor:         expectedFinal,
			AccountAvailableBeforeUSDMinor:    account.AvailableUSDMinor,
			AccountAvailableRemainingUSDMinor: quote.InvitationRemainingUSDMinor,
			AccountReservedBeforeUSDMinor:     account.ReservedUSDMinor,
			AccountReservedAfterUSDMinor:      account.ReservedUSDMinor + quote.InvitationDiscountUSDMinor,
			ReservationKey:                    reservationKey,
			ItemIdempotencyKey:                stripeSubscriptionDiscountInvoiceAdjustmentKey(facts.InvoiceID),
		}
		snapshot, err := stripeSubscriptionDiscountInvoiceSnapshotJSON(snapshotFacts)
		if err != nil {
			return err
		}
		_, err = model.ReserveSubscriptionDiscountTx(tx, model.SubscriptionDiscountReservationInput{
			UserID:             binding.UserId,
			USDMinor:           quote.InvitationDiscountUSDMinor,
			TradeNo:            facts.InvoiceID,
			PaymentCurrency:    facts.Currency,
			AppliedAmountMinor: incremental,
			PricingSnapshot:    snapshot,
			IdempotencyKey:     reservationKey,
			ExpiresAt:          common.GetTimestamp() + int64((7 * 24 * time.Hour).Seconds()),
		})
		if err != nil {
			return err
		}
		prepare = stripeSubscriptionDiscountInvoicePrepare{
			InvoiceID:              facts.InvoiceID,
			SubscriptionID:         facts.SubscriptionID,
			CustomerID:             facts.CustomerID,
			Currency:               facts.Currency,
			IncrementalAmountMinor: incremental,
			ReservationKey:         reservationKey,
			Snapshot:               snapshot,
			SnapshotFacts:          snapshotFacts,
		}
		return nil
	})
	return prepare, err
}

func existingStripeSubscriptionDiscountInvoicePrepareTx(tx *gorm.DB, facts stripeInvoiceCommonFacts) (stripeSubscriptionDiscountInvoicePrepare, bool, error) {
	reservationKey := stripeSubscriptionDiscountInvoiceReservationKey(facts.InvoiceID)
	var reserve model.SubscriptionDiscountEntry
	err := tx.Where("idempotency_key = ? AND entry_type = ?", reservationKey, model.SubscriptionDiscountEntryTypeReserve).First(&reserve).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return stripeSubscriptionDiscountInvoicePrepare{}, false, nil
	}
	if err != nil {
		return stripeSubscriptionDiscountInvoicePrepare{}, false, err
	}
	closed, err := subscriptionDiscountReservationClosedTx(tx, reservationKey)
	if err != nil || closed {
		return stripeSubscriptionDiscountInvoicePrepare{}, closed, err
	}
	snapshot, err := parseStripeSubscriptionDiscountInvoiceSnapshot(reserve.PricingSnapshot)
	if err != nil {
		return stripeSubscriptionDiscountInvoicePrepare{}, false, err
	}
	return stripeSubscriptionDiscountInvoicePrepare{
		InvoiceID:              facts.InvoiceID,
		SubscriptionID:         facts.SubscriptionID,
		CustomerID:             facts.CustomerID,
		Currency:               facts.Currency,
		IncrementalAmountMinor: reserve.AppliedAmountMinor,
		ReservationKey:         reservationKey,
		Snapshot:               reserve.PricingSnapshot,
		SnapshotFacts:          snapshot,
	}, true, nil
}

func validateStripeDiscountInvoiceFacts(inv *stripe.Invoice, sub *stripe.Subscription) (stripeInvoiceCommonFacts, error) {
	facts, err := validateStripeInvoiceCommonFacts(inv, sub)
	if err != nil {
		return stripeInvoiceCommonFacts{}, err
	}
	if inv == nil || inv.Subtotal <= 0 {
		return stripeInvoiceCommonFacts{}, errors.New("Stripe invoice subtotal is invalid")
	}
	facts.Amount = inv.Subtotal
	return facts, nil
}

func stripeInvoiceExistingDiscountMinor(inv *stripe.Invoice) int64 {
	if inv == nil {
		return 0
	}
	var total int64
	for _, discount := range inv.TotalDiscountAmounts {
		if discount != nil && discount.Amount > 0 {
			total += discount.Amount
		}
	}
	return total
}

func stripeInvoiceEligibleForDiscountPreparation(inv *stripe.Invoice) bool {
	if inv == nil || strings.TrimSpace(inv.ID) == "" {
		return false
	}
	if inv.Status != stripe.InvoiceStatusDraft {
		return false
	}
	if inv.BillingReason == stripe.InvoiceBillingReasonSubscriptionCreate {
		return false
	}
	return inv.BillingReason == "" || inv.BillingReason == stripe.InvoiceBillingReasonSubscriptionCycle
}

func pauseStripeSubscriptionInvoice(ctx context.Context, invoiceID string) error {
	params := &stripe.InvoiceParams{AutoAdvance: stripe.Bool(false)}
	params.SetIdempotencyKey(stripeSubscriptionDiscountInvoiceReservationKey(invoiceID) + ":pause")
	_, err := stripeSubscriptionInvoiceUpdater(ctx, invoiceID, params)
	return err
}

func resumeStripeSubscriptionInvoice(ctx context.Context, invoiceID string, metadata map[string]string) error {
	params := &stripe.InvoiceParams{
		AutoAdvance: stripe.Bool(true),
		Metadata:    metadata,
	}
	params.SetIdempotencyKey(stripeSubscriptionDiscountInvoiceReservationKey(invoiceID) + ":resume")
	_, err := stripeSubscriptionInvoiceUpdater(ctx, invoiceID, params)
	return err
}

func createStripeSubscriptionDiscountInvoiceItem(ctx context.Context, prepare stripeSubscriptionDiscountInvoicePrepare) error {
	if prepare.IncrementalAmountMinor <= 0 {
		return nil
	}
	exists, err := existingStripeSubscriptionDiscountInvoiceItem(ctx, prepare)
	if err != nil || exists {
		return err
	}
	params := &stripe.InvoiceItemParams{
		Amount:      stripe.Int64(-prepare.IncrementalAmountMinor),
		Currency:    stripe.String(strings.ToLower(prepare.Currency)),
		Customer:    stripe.String(prepare.CustomerID),
		Description: stripe.String("Flatkey invitation package credit"),
		Invoice:     stripe.String(prepare.InvoiceID),
		Metadata:    stripeSubscriptionDiscountInvoiceMetadata(prepare.SnapshotFacts),
	}
	params.SetIdempotencyKey(stripeSubscriptionDiscountInvoiceAdjustmentKey(prepare.InvoiceID))
	_, err = stripeSubscriptionInvoiceItemCreator(ctx, params)
	return err
}

func existingStripeSubscriptionDiscountInvoiceItem(ctx context.Context, prepare stripeSubscriptionDiscountInvoicePrepare) (bool, error) {
	params := &stripe.InvoiceItemListParams{
		Invoice: stripe.String(prepare.InvoiceID),
	}
	params.Limit = stripe.Int64(100)
	items, err := stripeSubscriptionInvoiceItemLister(ctx, params)
	if err != nil {
		return false, err
	}
	matches := make([]*stripe.InvoiceItem, 0, 1)
	for _, item := range items {
		if stripeSubscriptionDiscountInvoiceItemMatchesMetadata(item, prepare) {
			matches = append(matches, item)
		}
	}
	if len(matches) == 0 {
		return false, nil
	}
	if len(matches) > 1 {
		return false, errors.New("multiple subscription discount invoice items found")
	}
	item := matches[0]
	if item.Amount != -prepare.IncrementalAmountMinor ||
		strings.ToUpper(strings.TrimSpace(string(item.Currency))) != strings.ToUpper(strings.TrimSpace(prepare.Currency)) {
		return false, errors.New("conflicting subscription discount invoice item found")
	}
	return true, nil
}

func stripeSubscriptionDiscountInvoiceItemMatchesMetadata(item *stripe.InvoiceItem, prepare stripeSubscriptionDiscountInvoicePrepare) bool {
	if item == nil {
		return false
	}
	metadata := item.Metadata
	if metadata == nil {
		return false
	}
	return strings.TrimSpace(metadata["source"]) == "new-api" &&
		strings.TrimSpace(metadata["subscription_discount_version"]) == strconv.Itoa(prepare.SnapshotFacts.Version) &&
		strings.TrimSpace(metadata["subscription_discount_source"]) == strings.TrimSpace(prepare.SnapshotFacts.Source) &&
		strings.TrimSpace(metadata["subscription_discount_invoice_id"]) == strings.TrimSpace(prepare.InvoiceID) &&
		strings.TrimSpace(metadata["subscription_discount_reservation_key"]) == strings.TrimSpace(prepare.ReservationKey) &&
		strings.TrimSpace(metadata["subscription_discount_item_idempotency_key"]) == stripeSubscriptionDiscountInvoiceAdjustmentKey(prepare.InvoiceID)
}

func canonicalRenewalUSDMinor(plan *model.SubscriptionPlan, snapshot recurringInvoicePlanSnapshot) (int64, error) {
	if snapshot.Found {
		return stripeMinorUnitAmountForSubscription(snapshot.Snapshot.PriceAmount, "USD")
	}
	if plan == nil {
		return 0, errors.New("local subscription plan is missing")
	}
	return stripeMinorUnitAmountForSubscription(plan.PriceAmount, "USD")
}

func stripeSubscriptionDiscountInvoiceSnapshotJSON(snapshot stripeSubscriptionDiscountInvoiceSnapshot) (string, error) {
	data, err := common.Marshal(snapshot)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func parseStripeSubscriptionDiscountInvoiceSnapshot(raw string) (stripeSubscriptionDiscountInvoiceSnapshot, error) {
	if strings.TrimSpace(raw) == "" {
		return stripeSubscriptionDiscountInvoiceSnapshot{}, errors.New("subscription discount invoice snapshot is missing")
	}
	var snapshot stripeSubscriptionDiscountInvoiceSnapshot
	if err := common.Unmarshal([]byte(raw), &snapshot); err != nil {
		return stripeSubscriptionDiscountInvoiceSnapshot{}, fmt.Errorf("subscription discount invoice snapshot is invalid: %w", err)
	}
	if snapshot.Version != 1 ||
		strings.TrimSpace(snapshot.Source) != "stripe_renewal_invoice_discount" ||
		strings.TrimSpace(snapshot.InvoiceID) == "" ||
		strings.TrimSpace(snapshot.SubscriptionID) == "" ||
		snapshot.BindingID <= 0 ||
		snapshot.ContractID <= 0 ||
		snapshot.PlanID <= 0 ||
		snapshot.UserID <= 0 ||
		strings.TrimSpace(snapshot.Currency) == "" ||
		snapshot.CanonicalUSDMinor <= 0 ||
		snapshot.OriginalSubtotalMinor <= 0 ||
		snapshot.ExistingDiscountMinor < 0 ||
		snapshot.SelectedInvitationUSDMinor <= 0 ||
		snapshot.SelectedInvitationLocalMinor <= 0 ||
		snapshot.IncrementalItemMinor <= 0 ||
		snapshot.ExpectedFinalPaymentMinor < 0 ||
		strings.TrimSpace(snapshot.ReservationKey) == "" ||
		strings.TrimSpace(snapshot.ItemIdempotencyKey) == "" {
		return stripeSubscriptionDiscountInvoiceSnapshot{}, errors.New("subscription discount invoice snapshot is incomplete")
	}
	return snapshot, nil
}

func stripeSubscriptionDiscountInvoiceMetadata(snapshot stripeSubscriptionDiscountInvoiceSnapshot) map[string]string {
	if snapshot.Version == 0 {
		return nil
	}
	return map[string]string{
		"source":                                       "new-api",
		"subscription_discount_version":                strconv.Itoa(snapshot.Version),
		"subscription_discount_source":                 strings.TrimSpace(snapshot.Source),
		"subscription_discount_invoice_id":             strings.TrimSpace(snapshot.InvoiceID),
		"subscription_discount_reservation_key":        strings.TrimSpace(snapshot.ReservationKey),
		"subscription_discount_item_idempotency_key":   strings.TrimSpace(snapshot.ItemIdempotencyKey),
		"subscription_discount_selected_usd_minor":     strconv.FormatInt(snapshot.SelectedInvitationUSDMinor, 10),
		"subscription_discount_selected_local_minor":   strconv.FormatInt(snapshot.SelectedInvitationLocalMinor, 10),
		"subscription_discount_existing_minor":         strconv.FormatInt(snapshot.ExistingDiscountMinor, 10),
		"subscription_discount_incremental_item_minor": strconv.FormatInt(snapshot.IncrementalItemMinor, 10),
		"subscription_discount_expected_final_minor":   strconv.FormatInt(snapshot.ExpectedFinalPaymentMinor, 10),
		"subscription_discount_binding_id":             strconv.FormatInt(snapshot.BindingID, 10),
		"subscription_discount_contract_id":            strconv.FormatInt(snapshot.ContractID, 10),
		"subscription_discount_plan_id":                strconv.Itoa(snapshot.PlanID),
		"subscription_discount_user_id":                strconv.Itoa(snapshot.UserID),
	}
}

func stripeSubscriptionDiscountInvoiceReservationKey(invoiceID string) string {
	return stripeInvoiceDiscountReservePrefix + strings.TrimSpace(invoiceID) + ":reserve"
}

func stripeSubscriptionDiscountInvoiceAdjustmentKey(invoiceID string) string {
	return stripeInvoiceDiscountReservePrefix + strings.TrimSpace(invoiceID) + ":adjustment"
}

func CommitStripeSubscriptionDiscountInvoiceTx(tx *gorm.DB, invoiceID string) error {
	skippedReleased, err := commitStripeSubscriptionDiscountInvoiceForPaidRenewalTx(tx, invoiceID)
	if err != nil {
		return err
	}
	if skippedReleased {
		return PermanentPaidInvoiceError(errors.New("subscription discount invoice reservation was already released"))
	}
	return nil
}

func commitStripeSubscriptionDiscountInvoiceForPaidRenewalTx(tx *gorm.DB, invoiceID string) (bool, error) {
	key := stripeSubscriptionDiscountInvoiceReservationKey(invoiceID)
	terminalType, err := stripeSubscriptionDiscountInvoiceTerminalTypeTx(tx, key)
	if err != nil {
		return false, err
	}
	switch terminalType {
	case model.SubscriptionDiscountEntryTypeCommit:
		return false, nil
	case model.SubscriptionDiscountEntryTypeRelease:
		return true, nil
	}
	_, err = model.CommitSubscriptionDiscountTx(tx, key)
	if errors.Is(err, model.ErrSubscriptionDiscountReservationNotFound) {
		return false, nil
	}
	return false, err
}

func ReleaseStripeSubscriptionDiscountInvoice(ctx context.Context, invoiceID string) error {
	return model.DB.Transaction(func(tx *gorm.DB) error {
		key := stripeSubscriptionDiscountInvoiceReservationKey(invoiceID)
		terminalType, err := stripeSubscriptionDiscountInvoiceTerminalTypeTx(tx, key)
		if err != nil {
			return err
		}
		if terminalType != "" {
			return nil
		}
		_, err = model.ReleaseSubscriptionDiscountTx(tx, key)
		if errors.Is(err, model.ErrSubscriptionDiscountReservationNotFound) {
			return nil
		}
		return err
	})
}

func ReconcileStaleStripeSubscriptionDiscountInvoices(ctx context.Context) (int, error) {
	if !stripeReconciliationTableAvailable(&model.SubscriptionDiscountEntry{}) {
		return 0, nil
	}
	now := common.GetTimestamp()
	var reserves []model.SubscriptionDiscountEntry
	if err := model.DB.
		Where("entry_type = ? AND idempotency_key LIKE ? AND expires_at > ? AND expires_at <= ?",
			model.SubscriptionDiscountEntryTypeReserve,
			stripeInvoiceDiscountReservePrefix+"%:reserve",
			0,
			now).
		Order("id asc").
		Limit(stripeSubscriptionReconciliationBatchSize).
		Find(&reserves).Error; err != nil {
		return 0, err
	}
	processed := 0
	for _, reserve := range reserves {
		closed, err := stripeSubscriptionDiscountReservationClosed(reserve.IdempotencyKey)
		if err != nil {
			return processed, err
		}
		if closed {
			continue
		}
		invoiceID := strings.TrimSpace(reserve.TradeNo)
		if invoiceID == "" {
			invoiceID = strings.TrimSuffix(strings.TrimPrefix(reserve.IdempotencyKey, stripeInvoiceDiscountReservePrefix), ":reserve")
		}
		inv, err := stripeInvoiceGetter(ctx, invoiceID)
		if err != nil {
			return processed, err
		}
		if inv == nil || strings.TrimSpace(inv.ID) == "" {
			return processed, errors.New("Stripe invoice is missing")
		}
		switch {
		case stripeInvoiceIsPaid(inv):
			if _, err := ReconcilePaidInvoice(ctx, invoiceID); err != nil {
				return processed, err
			}
			processed++
		case isTerminalStripeInvoiceStatus(inv.Status):
			if err := ReleaseStripeSubscriptionDiscountInvoice(ctx, invoiceID); err != nil {
				return processed, err
			}
			processed++
		default:
		}
	}
	return processed, nil
}

func stripeSubscriptionDiscountReservationClosed(reservationKey string) (bool, error) {
	return subscriptionDiscountReservationClosedTx(model.DB, reservationKey)
}

func subscriptionDiscountReservationClosedTx(tx *gorm.DB, reservationKey string) (bool, error) {
	terminalType, err := stripeSubscriptionDiscountInvoiceTerminalTypeTx(tx, reservationKey)
	return terminalType != "", err
}

func stripeSubscriptionDiscountInvoiceTerminalTypeTx(tx *gorm.DB, reservationKey string) (string, error) {
	if tx == nil || strings.TrimSpace(reservationKey) == "" {
		return "", nil
	}
	var entry model.SubscriptionDiscountEntry
	err := tx.Where("terminal_reservation_key = ?", strings.TrimSpace(reservationKey)).
		Order("id asc").
		First(&entry).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(entry.EntryType), nil
}
