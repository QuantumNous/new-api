package controller

import (
	"context"
	"fmt"

	referralmodel "github.com/QuantumNous/new-api/internal/referral/model"
	referralservice "github.com/QuantumNous/new-api/internal/referral/service"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
)

func grantReferralForTopUp(ctx context.Context, tradeNo string) {
	topUp := model.GetTopUpByTradeNo(tradeNo)
	if topUp == nil {
		return
	}
	grantReferralForUser(ctx, topUp.UserId, referralmodel.ReferralConversionTopUp, tradeNo)
}

func grantReferralForSubscription(ctx context.Context, tradeNo string) {
	order := model.GetSubscriptionOrderByTradeNo(tradeNo)
	if order == nil {
		return
	}
	grantReferralForUser(ctx, order.UserId, referralmodel.ReferralConversionSubscription, tradeNo)
}

func grantReferralForUser(ctx context.Context, userID int, source string, reference string) {
	_, awarded, err := referralservice.GrantForConversion(model.DB, int64(userID), source, reference)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("referral reward grant failed user_id=%d source=%s reference=%s error=%q", userID, source, reference, err.Error()))
		return
	}
	if awarded {
		logger.LogInfo(ctx, fmt.Sprintf("referral reward granted user_id=%d source=%s reference=%s", userID, source, reference))
	}
}
