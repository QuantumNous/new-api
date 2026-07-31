package model

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
)

type RecallRevenueCategory string

const (
	RecallRevenueCategoryDirectTopUp         RecallRevenueCategory = "direct_topup"
	RecallRevenueCategoryBalanceSubscription RecallRevenueCategory = "balance_subscription"
	RecallRevenueCategoryOnlineSubscription  RecallRevenueCategory = "online_subscription"
	RecallRevenueCategoryUnclassified        RecallRevenueCategory = "unclassified"

	recallRevenueFactTradeNoChunkSize = 400
)

type RecallRevenueTotals struct {
	Currency                 string
	AttributedSpendMinor     int64
	AttributedUsers          int64
	NewExternalCashMinor     int64
	ExternalCashUsers        int64
	DirectTopupMinor         int64
	DirectTopupUsers         int64
	BalanceSubscriptionMinor int64
	BalanceSubscriptionUsers int64
	OnlineSubscriptionMinor  int64
	OnlineSubscriptionUsers  int64
	UnclassifiedMinor        int64
	UnclassifiedUsers        int64
}

type recallRevenueFactKey struct {
	tradeNo string
	userID  int
}

type recallRevenueAggregate struct {
	totals                   RecallRevenueTotals
	attributedUsers          map[string]struct{}
	externalCashUsers        map[string]struct{}
	directTopUpUsers         map[string]struct{}
	balanceSubscriptionUsers map[string]struct{}
	onlineSubscriptionUsers  map[string]struct{}
	unclassifiedUsers        map[string]struct{}
}

func GetRecallRevenueTotals(ctx context.Context, campaignID int64) ([]RecallRevenueTotals, error) {
	return GetRecallRevenueTotalsWithContext(ctx, campaignID)
}

func GetRecallRevenueTotalsWithContext(ctx context.Context, campaignID int64) ([]RecallRevenueTotals, error) {
	recipients, err := listRecallRevenueRecipientsWithContext(ctx, campaignID)
	if err != nil {
		return nil, err
	}
	if len(recipients) == 0 {
		return []RecallRevenueTotals{}, nil
	}
	ordersByKey, topUpsByKey, err := recallRevenuePaymentFactsWithContext(ctx, recipients)
	if err != nil {
		return nil, err
	}
	aggregates := make(map[string]*recallRevenueAggregate)
	for _, recipient := range recipients {
		currency := strings.ToUpper(strings.TrimSpace(recipient.ConversionCurrency))
		if currency == "" {
			currency = "UNKNOWN"
		}
		aggregate := recallRevenueAggregateForCurrency(aggregates, currency)
		category := classifyRecallRevenueRecipient(recipient, ordersByKey, topUpsByKey)
		aggregate.add(recipient, category)
	}
	currencies := make([]string, 0, len(aggregates))
	for currency := range aggregates {
		currencies = append(currencies, currency)
	}
	sort.Strings(currencies)
	totals := make([]RecallRevenueTotals, 0, len(currencies))
	for _, currency := range currencies {
		aggregate := aggregates[currency]
		aggregate.finalizeUserCounts()
		totals = append(totals, aggregate.totals)
	}
	return totals, nil
}

func listRecallRevenueRecipientsWithContext(ctx context.Context, campaignID int64) ([]RecallRecipient, error) {
	recipients := make([]RecallRecipient, 0)
	if campaignID <= 0 {
		return recipients, nil
	}
	err := DB.WithContext(ctx).
		Where("campaign_id = ? AND state = ?", campaignID, RecallRecipientConverted).
		Order("id ASC").
		Find(&recipients).Error
	return recipients, err
}

func recallRevenuePaymentFactsWithContext(ctx context.Context, recipients []RecallRecipient) (map[recallRevenueFactKey][]SubscriptionOrder, map[recallRevenueFactKey][]TopUp, error) {
	tradeNos := make([]string, 0, len(recipients))
	seenTradeNos := make(map[string]struct{}, len(recipients))
	validKeys := make(map[recallRevenueFactKey]struct{}, len(recipients))
	for _, recipient := range recipients {
		tradeNo := strings.TrimSpace(recipient.ConversionTradeNo)
		if tradeNo != "" {
			if _, seen := seenTradeNos[tradeNo]; !seen {
				seenTradeNos[tradeNo] = struct{}{}
				tradeNos = append(tradeNos, tradeNo)
			}
		}
		if tradeNo != "" && recipient.UserId > 0 {
			validKeys[recallRevenueFactKey{tradeNo: tradeNo, userID: recipient.UserId}] = struct{}{}
		}
	}
	ordersByKey := make(map[recallRevenueFactKey][]SubscriptionOrder)
	topUpsByKey := make(map[recallRevenueFactKey][]TopUp)
	if len(tradeNos) == 0 || len(validKeys) == 0 {
		return ordersByKey, topUpsByKey, nil
	}
	if err := loadRecallRevenueSubscriptionOrdersWithContext(ctx, tradeNos, validKeys, ordersByKey); err != nil {
		return nil, nil, err
	}
	if err := loadRecallRevenueTopUpsWithContext(ctx, tradeNos, validKeys, topUpsByKey); err != nil {
		return nil, nil, err
	}
	return ordersByKey, topUpsByKey, nil
}

func loadRecallRevenueSubscriptionOrdersWithContext(ctx context.Context, tradeNos []string, validKeys map[recallRevenueFactKey]struct{}, ordersByKey map[recallRevenueFactKey][]SubscriptionOrder) error {
	for start := 0; start < len(tradeNos); start += recallRevenueFactTradeNoChunkSize {
		end := min(start+recallRevenueFactTradeNoChunkSize, len(tradeNos))
		var orders []SubscriptionOrder
		if err := DB.WithContext(ctx).
			Where("trade_no IN ? AND status = ?", tradeNos[start:end], common.TopUpStatusSuccess).
			Find(&orders).Error; err != nil {
			return err
		}
		for _, order := range orders {
			key := recallRevenueFactKey{tradeNo: strings.TrimSpace(order.TradeNo), userID: order.UserId}
			if _, ok := validKeys[key]; !ok {
				continue
			}
			ordersByKey[key] = append(ordersByKey[key], order)
		}
	}
	return nil
}

func loadRecallRevenueTopUpsWithContext(ctx context.Context, tradeNos []string, validKeys map[recallRevenueFactKey]struct{}, topUpsByKey map[recallRevenueFactKey][]TopUp) error {
	for start := 0; start < len(tradeNos); start += recallRevenueFactTradeNoChunkSize {
		end := min(start+recallRevenueFactTradeNoChunkSize, len(tradeNos))
		var topUps []TopUp
		if err := DB.WithContext(ctx).
			Where("trade_no IN ? AND status = ?", tradeNos[start:end], common.TopUpStatusSuccess).
			Find(&topUps).Error; err != nil {
			return err
		}
		for _, topUp := range topUps {
			key := recallRevenueFactKey{tradeNo: strings.TrimSpace(topUp.TradeNo), userID: topUp.UserId}
			if _, ok := validKeys[key]; !ok {
				continue
			}
			topUpsByKey[key] = append(topUpsByKey[key], topUp)
		}
	}
	return nil
}

func classifyRecallRevenueRecipient(recipient RecallRecipient, ordersByKey map[recallRevenueFactKey][]SubscriptionOrder, topUpsByKey map[recallRevenueFactKey][]TopUp) RecallRevenueCategory {
	key := recallRevenueFactKey{tradeNo: strings.TrimSpace(recipient.ConversionTradeNo), userID: recipient.UserId}
	orders := ordersByKey[key]
	if len(orders) == 1 {
		if orders[0].PaymentProvider == PaymentProviderBalance {
			return RecallRevenueCategoryBalanceSubscription
		}
		return RecallRevenueCategoryOnlineSubscription
	}
	if len(orders) > 1 {
		return RecallRevenueCategoryUnclassified
	}
	topUps := topUpsByKey[key]
	if len(topUps) == 1 {
		return RecallRevenueCategoryDirectTopUp
	}
	return RecallRevenueCategoryUnclassified
}

func recallRevenueAggregateForCurrency(aggregates map[string]*recallRevenueAggregate, currency string) *recallRevenueAggregate {
	aggregate := aggregates[currency]
	if aggregate != nil {
		return aggregate
	}
	aggregate = &recallRevenueAggregate{
		totals:                   RecallRevenueTotals{Currency: currency},
		attributedUsers:          make(map[string]struct{}),
		externalCashUsers:        make(map[string]struct{}),
		directTopUpUsers:         make(map[string]struct{}),
		balanceSubscriptionUsers: make(map[string]struct{}),
		onlineSubscriptionUsers:  make(map[string]struct{}),
		unclassifiedUsers:        make(map[string]struct{}),
	}
	aggregates[currency] = aggregate
	return aggregate
}

func (aggregate *recallRevenueAggregate) add(recipient RecallRecipient, category RecallRevenueCategory) {
	amount := recipient.ConversionAmount
	userKey := recallRevenueRecipientUserKey(recipient)
	aggregate.totals.AttributedSpendMinor += amount
	aggregate.attributedUsers[userKey] = struct{}{}
	switch category {
	case RecallRevenueCategoryDirectTopUp:
		aggregate.totals.DirectTopupMinor += amount
		aggregate.totals.NewExternalCashMinor += amount
		aggregate.directTopUpUsers[userKey] = struct{}{}
		aggregate.externalCashUsers[userKey] = struct{}{}
	case RecallRevenueCategoryBalanceSubscription:
		aggregate.totals.BalanceSubscriptionMinor += amount
		aggregate.balanceSubscriptionUsers[userKey] = struct{}{}
	case RecallRevenueCategoryOnlineSubscription:
		aggregate.totals.OnlineSubscriptionMinor += amount
		aggregate.totals.NewExternalCashMinor += amount
		aggregate.onlineSubscriptionUsers[userKey] = struct{}{}
		aggregate.externalCashUsers[userKey] = struct{}{}
	default:
		aggregate.totals.UnclassifiedMinor += amount
		aggregate.unclassifiedUsers[userKey] = struct{}{}
	}
}

func (aggregate *recallRevenueAggregate) finalizeUserCounts() {
	aggregate.totals.AttributedUsers = int64(len(aggregate.attributedUsers))
	aggregate.totals.ExternalCashUsers = int64(len(aggregate.externalCashUsers))
	aggregate.totals.DirectTopupUsers = int64(len(aggregate.directTopUpUsers))
	aggregate.totals.BalanceSubscriptionUsers = int64(len(aggregate.balanceSubscriptionUsers))
	aggregate.totals.OnlineSubscriptionUsers = int64(len(aggregate.onlineSubscriptionUsers))
	aggregate.totals.UnclassifiedUsers = int64(len(aggregate.unclassifiedUsers))
}

func recallRevenueRecipientUserKey(recipient RecallRecipient) string {
	if recipient.UserId > 0 {
		return fmt.Sprintf("user:%d", recipient.UserId)
	}
	if identity := strings.TrimSpace(recipient.RecipientIdentity); identity != "" {
		return identity
	}
	return fmt.Sprintf("recipient:%d", recipient.Id)
}
