package model

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/stretchr/testify/require"
)

// setupBalancePurchaseTest prepares the invite-reward fixtures plus the
// subscription tables the balance-purchase path touches.
func setupBalancePurchaseTest(t *testing.T) *SubscriptionPlan {
	t.Helper()
	setupInviteSubRewardTest(t)
	require.NoError(t, DB.AutoMigrate(&SubscriptionPlan{}, &UserSubscription{}, &TopUp{}, &RecallLifecycleEvent{}, &QuotaLifecycleState{}))

	plan := &SubscriptionPlan{
		Title:         "Go",
		PriceAmount:   10,
		Currency:      "USD",
		DurationUnit:  "month",
		DurationValue: 1,
		Enabled:       true,
		TotalAmount:   int64(45 * common.QuotaPerUnit),
	}
	require.NoError(t, DB.Create(plan).Error)
	return plan
}

func fundUser(t *testing.T, userId int, usd float64) {
	t.Helper()
	require.NoError(t, DB.Model(&User{}).Where("id = ?", userId).
		Update("quota", int(usd*common.QuotaPerUnit)).Error)
}

// Balance-funded subscription purchases bypass CompleteSubscriptionOrder, so
// they must trigger the same referral-reward bookkeeping themselves.
func TestBalancePurchaseGrantsInviteSubscriptionReward(t *testing.T) {
	plan := setupBalancePurchaseTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	fundUser(t, invitee.Id, 100)

	require.NoError(t, PurchaseSubscriptionWithBalance(invitee.Id, plan.Id))

	var reward InviteSubscriptionReward
	require.NoError(t, DB.First(&reward, "invitee_id = ?", invitee.Id).Error)
	require.Equal(t, InviteSubRewardStatusGranted, reward.Status)
	require.Equal(t, inviter.Id, reward.InviterId)
	require.Equal(t, common.QuotaForInviter, reward.RewardQuota)
	requireInviteSubRewardLedger(t, inviter.Id, invitee.Id, 750)
}

func TestCompleteSubscriptionOrderRewardFailureDoesNotRollbackOrder(t *testing.T) {
	plan := setupBalancePurchaseTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	order := &SubscriptionOrder{
		UserId:          invitee.Id,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         "sub-reward-failure-complete",
		PaymentMethod:   PaymentMethodStripe,
		PaymentProvider: PaymentProviderStripe,
		Status:          common.TopUpStatusPending,
	}
	require.NoError(t, order.Insert())

	common.QuotaForInviter = -1
	require.NoError(t, CompleteSubscriptionOrder(order.TradeNo, "{}", PaymentProviderStripe, PaymentMethodStripe))

	var stored SubscriptionOrder
	require.NoError(t, DB.First(&stored, "trade_no = ?", order.TradeNo).Error)
	require.Equal(t, common.TopUpStatusSuccess, stored.Status)
	var subs int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", invitee.Id, plan.Id).Count(&subs).Error)
	require.EqualValues(t, 1, subs)
	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)

	common.QuotaForInviter = 750
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	requireInviteSubRewardLedger(t, inviter.Id, invitee.Id, 750)
}

func TestBalancePurchaseRewardFailureDoesNotRollbackOrder(t *testing.T) {
	plan := setupBalancePurchaseTest(t)

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	fundUser(t, invitee.Id, 100)

	common.QuotaForInviter = -1
	require.NoError(t, PurchaseSubscriptionWithBalance(invitee.Id, plan.Id))

	var order SubscriptionOrder
	require.NoError(t, DB.First(&order, "user_id = ? AND payment_provider = ?", invitee.Id, PaymentProviderBalance).Error)
	require.Equal(t, common.TopUpStatusSuccess, order.Status)
	var subs int64
	require.NoError(t, DB.Model(&UserSubscription{}).Where("user_id = ? AND plan_id = ?", invitee.Id, plan.Id).Count(&subs).Error)
	require.EqualValues(t, 1, subs)
	var rewards int64
	require.NoError(t, DB.Model(&InviteSubscriptionReward{}).Where("invitee_id = ?", invitee.Id).Count(&rewards).Error)
	require.Zero(t, rewards)

	common.QuotaForInviter = 750
	require.NoError(t, TryGrantInviteSubscriptionRewardAfterOrderCompleted(order.TradeNo))
	requireInviteSubRewardLedger(t, inviter.Id, invitee.Id, 750)
}

// The invitee first-subscription discount must apply to balance purchases
// (first order discounted, second order back to full price).
func TestBalancePurchaseAppliesInviteeFirstSubDiscount(t *testing.T) {
	plan := setupBalancePurchaseTest(t)

	originalDiscount := common.InviteFirstSubDiscountUSD
	t.Cleanup(func() { common.InviteFirstSubDiscountUSD = originalDiscount })
	common.InviteFirstSubDiscountUSD = 5

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)
	fundUser(t, invitee.Id, 100)

	require.NoError(t, PurchaseSubscriptionWithBalance(invitee.Id, plan.Id))

	var first SubscriptionOrder
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).Order("id asc").First(&first).Error)
	require.InDelta(t, 5.0, first.Money, 1e-9)
	require.InDelta(t, 5.0, first.DiscountUSD, 1e-9)

	// Second purchase: no longer the first successful order — full price.
	require.NoError(t, PurchaseSubscriptionWithBalance(invitee.Id, plan.Id))
	var orders []SubscriptionOrder
	require.NoError(t, DB.Where("user_id = ?", invitee.Id).Order("id asc").Find(&orders).Error)
	require.Len(t, orders, 2)
	require.InDelta(t, 10.0, orders[1].Money, 1e-9)
	require.Zero(t, orders[1].DiscountUSD)

	// Non-invited users never get the discount.
	solo := createInviteRewardUser(t, "solo", 0)
	fundUser(t, solo.Id, 100)
	require.NoError(t, PurchaseSubscriptionWithBalance(solo.Id, plan.Id))
	var soloOrder SubscriptionOrder
	require.NoError(t, DB.Where("user_id = ?", solo.Id).First(&soloOrder).Error)
	require.InDelta(t, 10.0, soloOrder.Money, 1e-9)
	require.Zero(t, soloOrder.DiscountUSD)
}

// A live discounted order (pending or success) occupies the one-time slot;
// a failed/expired one releases it.
func TestInviteDiscountSlotHeldByLiveOrders(t *testing.T) {
	plan := setupBalancePurchaseTest(t)

	originalDiscount := common.InviteFirstSubDiscountUSD
	t.Cleanup(func() { common.InviteFirstSubDiscountUSD = originalDiscount })
	common.InviteFirstSubDiscountUSD = 5

	inviter := createInviteRewardUser(t, "inviter", 0)
	invitee := createInviteRewardUser(t, "invitee", inviter.Id)

	newOrder := func(tradeNo string) *SubscriptionOrder {
		return &SubscriptionOrder{
			UserId:          invitee.Id,
			PlanId:          plan.Id,
			TradeNo:         tradeNo,
			PaymentMethod:   PaymentMethodStripe,
			PaymentProvider: PaymentProviderStripe,
			Status:          common.TopUpStatusPending,
		}
	}

	// First checkout claims the discount.
	first := newOrder("disc-001")
	require.NoError(t, CreateSubscriptionOrderWithInviteDiscount(first, plan.PriceAmount, 0))
	require.InDelta(t, 5.0, first.DiscountUSD, 1e-9)
	require.InDelta(t, 5.0, first.Money, 1e-9)

	// A second concurrent checkout must NOT claim it again.
	second := newOrder("disc-002")
	require.NoError(t, CreateSubscriptionOrderWithInviteDiscount(second, plan.PriceAmount, 0))
	require.Zero(t, second.DiscountUSD)
	require.InDelta(t, 10.0, second.Money, 1e-9)

	// Expiring the discounted order releases the slot for a fresh attempt.
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("id = ?", first.Id).
		Update("status", common.TopUpStatusExpired).Error)
	third := newOrder("disc-003")
	require.NoError(t, CreateSubscriptionOrderWithInviteDiscount(third, plan.PriceAmount, 0))
	require.InDelta(t, 5.0, third.DiscountUSD, 1e-9)

	// minCharge keeps amount-based gateways above zero: price 10, discount 5
	// unaffected, but a discount >= price is clamped to price - minCharge.
	common.InviteFirstSubDiscountUSD = 50
	require.NoError(t, DB.Model(&SubscriptionOrder{}).Where("id = ?", third.Id).
		Update("status", common.TopUpStatusFailed).Error)
	fourth := newOrder("disc-004")
	require.NoError(t, CreateSubscriptionOrderWithInviteDiscount(fourth, plan.PriceAmount, 0.01))
	require.InDelta(t, plan.PriceAmount-0.01, fourth.DiscountUSD, 1e-9)
	require.InDelta(t, 0.01, fourth.Money, 1e-9)
}
