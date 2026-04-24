package service

import (
	"context"
	"fmt"
	"time"

	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/types"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

const (
	BillingSourceWallet       = "wallet"
	BillingSourceSubscription = "subscription"
)

// GetUserOrgDiscountRate 获取用户的企业折扣率
// 如果用户不属于任何企业或没有折扣规则，返回1
func GetUserOrgDiscountRate(userID int, modelName string) (float64, error) {
	type userExt struct {
		OrgID uint `json:"org_id"`
	}
	var ext userExt
	err := model.DB.Table("lc_user_ext").Where("user_id = ?", userID).Select("org_id").Scan(&ext).Error
	if err != nil {
		return 1.0, err
	}
	if ext.OrgID == 0 {
		return 1.0, nil
	}

	type discountRule struct {
		DiscountRate float64 `json:"discount_rate"`
	}
	var rule discountRule
	now := time.Now().Unix()
	err = model.DB.Table("lc_business_discount_rules").
		Where("org_id = ? AND model_name = ? AND effective_from <= ? AND (effective_to = 0 OR effective_to >= ?)",
			ext.OrgID, modelName, now, now).
		Order("effective_from DESC").
		Select("discount_rate").
		Scan(&rule).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			return 1.0, nil
		}
		return 1.0, err
	}
	if rule.DiscountRate <= 0 {
		return 1.0, nil
	}
	return rule.DiscountRate, nil
}

// PreConsumeBilling 根据用户计费偏好创建 BillingSession 并执行预扣费。
// 会话存储在 relayInfo.Billing 上，供后续 Settle / Refund 使用。
// 企业折扣会在此处应用到 preConsumedQuota 上。
func PreConsumeBilling(c *gin.Context, preConsumedQuota int, relayInfo *relaycommon.RelayInfo) *types.NewAPIError {

	session, apiErr := NewBillingSession(c, relayInfo, preConsumedQuota, 1.0)
	if apiErr != nil {
		return apiErr
	}
	relayInfo.Billing = session
	return nil
}

// ---------------------------------------------------------------------------
// SettleBilling — 后结算辅助函数
// ---------------------------------------------------------------------------

// SettleBilling 执行计费结算。如果 RelayInfo 上有 BillingSession 则通过 session 结算，
// 否则回退到旧的 PostConsumeQuota 路径（兼容按次计费等场景）。
func SettleBilling(ctx *gin.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) error {
	if relayInfo.Billing != nil {
		normalizedActual := NormalizeRecordedQuota(ctx, relayInfo, actualQuota)
		preConsumed := relayInfo.Billing.GetPreConsumedQuota()
		delta := normalizedActual - preConsumed

		if delta > 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后补扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(delta),
				logger.FormatQuota(normalizedActual),
				logger.FormatQuota(preConsumed),
			))
		} else if delta < 0 {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费后返还扣费：%s（实际消耗：%s，预扣费：%s）",
				logger.FormatQuota(-delta),
				logger.FormatQuota(normalizedActual),
				logger.FormatQuota(preConsumed),
			))
		} else {
			logger.LogInfo(ctx, fmt.Sprintf("预扣费与实际消耗一致，无需调整：%s（按次计费）",
				logger.FormatQuota(normalizedActual),
			))
		}

		if err := relayInfo.Billing.Settle(actualQuota); err != nil {
			return err
		}

		// 发送额度通知（订阅计费使用订阅剩余额度）
		if normalizedActual != 0 {
			if relayInfo.BillingSource == BillingSourceSubscription {
				checkAndSendSubscriptionQuotaNotify(relayInfo)
			} else {
				checkAndSendQuotaNotify(relayInfo, delta, preConsumed)
			}
		}
		return nil
	}

	// 回退：无 BillingSession 时使用旧路径
	quotaDelta := actualQuota - relayInfo.FinalPreConsumedQuota
	if quotaDelta != 0 {
		return PostConsumeQuota(relayInfo, quotaDelta, relayInfo.FinalPreConsumedQuota, true)
	}
	return nil
}

// NormalizeRecordedQuota 返回应当写入日志/任务记录的最终额度。
// BillingSession 在结算时会对 actualQuota 应用企业折扣，但调用方保存任务/日志时
// 仍可能持有未折扣的原始额度。这里统一转换为折后值，避免后续轮询以未折扣额度作为基线
// 触发错误的补扣/退款。
func NormalizeRecordedQuota(ctx context.Context, relayInfo *relaycommon.RelayInfo, actualQuota int) int {
	if relayInfo == nil || actualQuota <= 0 {
		return actualQuota
	}
	logger.LogInfo(ctx, fmt.Sprintf("NormalizeRecordedQuota: billing_type=%T, billing_nil=%v, actual=%d",
		relayInfo.Billing, relayInfo.Billing == nil, actualQuota))
	session, ok := relayInfo.Billing.(*BillingSession)
	if !ok || session == nil {
		return actualQuota
	}
	if session.discountRate < 1.0 {
		discountedActual := int(float64(actualQuota) * session.discountRate)
		if discountedActual < 1 && actualQuota > 0 {
			discountedActual = 1
		}
		logger.LogInfo(ctx, fmt.Sprintf("用户 %d 应用企业折扣到记录额度：原始额度=%s，折扣率=%.4f，折后额度=%s",
			relayInfo.UserId, logger.LogQuota(actualQuota), session.discountRate, logger.LogQuota(discountedActual)))
		return discountedActual
	}
	return actualQuota
}
