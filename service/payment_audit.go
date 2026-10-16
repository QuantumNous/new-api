package service

import (
	"context"
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

type paymentAuditChannel struct {
	order   any
	recheck func(context.Context, string) error
}

func paymentAuditChannels() []paymentAuditChannel {
	return []paymentAuditChannel{
		{&model.AlipayOrder{}, RecheckAlipayOrder},
		{&model.WechatPayOrder{}, RecheckWechatPayOrder},
		{&model.MixPayOrder{}, RecheckMixPayOrder},
		{&model.WebMoneyOrder{}, RecheckWebMoneyOrder},
		{&model.AntomOrder{}, RecheckAntomOrder},
	}
}

// Completed payments remain subject to reversals. Normal reconciliation stops
// after fulfillment, so a separate bounded sweep checks them at most daily.
// checked_at records an attempted verification, including failures; claiming it
// before network I/O prevents repeated requests after a worker crash.
func HasDuePaymentAudit() bool {
	for _, channel := range paymentAuditChannels() {
		var ids []int64
		if model.DB.Model(channel.order).Where("status = ? AND COALESCE(review_required, ?) = ? AND COALESCE(checked_at, 0) <= ?", "success", false, false, common.GetTimestamp()-86400).Limit(1).Pluck("id", &ids).Error == nil && len(ids) > 0 {
			return true
		}
	}
	return false
}

func RunPaymentAudit(ctx context.Context) error {
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	var result error
	// Round-robin across channels so one provider cannot consume the whole batch.
	for range 10 {
		found := false
		for _, channel := range paymentAuditChannels() {
			if ctx.Err() != nil {
				return errors.Join(result, ctx.Err())
			}
			var orders []struct {
				TradeNo   string
				CheckedAt int64
			}
			now := common.GetTimestamp()
			query := model.DB.WithContext(ctx).Model(channel.order)
			if err := query.Where("status = ? AND COALESCE(review_required, ?) = ? AND COALESCE(checked_at, 0) <= ?", "success", false, false, now-86400).Order("checked_at, id").Limit(1).Find(&orders).Error; err != nil {
				return err
			}
			if len(orders) == 0 {
				continue
			}
			found = true
			order := orders[0]
			claimed := model.DB.WithContext(ctx).Model(channel.order).Where("trade_no = ? AND status = ? AND COALESCE(review_required, ?) = ? AND COALESCE(checked_at, 0) = ?", order.TradeNo, "success", false, false, order.CheckedAt).Update("checked_at", now)
			if claimed.Error != nil {
				return claimed.Error
			}
			if claimed.RowsAffected == 0 {
				continue
			}
			// Recheck retains financial history and places contradictory gateway
			// evidence on review. It never automatically reverses a spent balance.
			if err := channel.recheck(ctx, order.TradeNo); err != nil && !errors.Is(err, model.ErrPaymentReviewRequired) {
				result = errors.New("completed payment audit has unresolved queries")
			}
		}
		if !found {
			break
		}
	}
	return result
}
