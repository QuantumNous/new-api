package model

import (
	"errors"
	"fmt"
	"maps"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type TopUp struct {
	Id              int     `json:"id"`
	UserId          int     `json:"user_id" gorm:"index"`
	Amount          int64   `json:"amount"`
	Money           float64 `json:"money"`
	TradeNo         string  `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentMethod   string  `json:"payment_method" gorm:"type:varchar(50)"`
	PaymentProvider string  `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	OriginHost      string  `json:"-" gorm:"type:varchar(255);not null;default:''"`
	CreateTime      int64   `json:"create_time"`
	CompleteTime    int64   `json:"complete_time"`
	Status          string  `json:"status"`
}

const (
	PaymentMethodStripe       = "stripe"
	PaymentMethodCreem        = "creem"
	PaymentMethodWaffo        = "waffo"
	PaymentMethodWaffoPancake = "waffo_pancake"
	PaymentMethodBalance      = "balance"
)

const (
	PaymentProviderEpay         = "epay"
	PaymentProviderStripe       = "stripe"
	PaymentProviderCreem        = "creem"
	PaymentProviderWaffo        = "waffo"
	PaymentProviderWaffoPancake = "waffo_pancake"
	PaymentProviderBalance      = "balance"
)

var (
	ErrPaymentMethodMismatch     = errors.New("payment method mismatch")
	ErrTopUpNotFound             = errors.New("topup not found")
	ErrTopUpStatusInvalid        = errors.New("topup status invalid")
	ErrInvalidTopUpQuota         = errors.New("invalid top-up quota")
	ErrTopUpQuotaLimitExceeded   = errors.New("top-up quota limit exceeded")
	ErrWalletQuotaLimitExceeded  = errors.New("wallet quota limit exceeded")
	ErrEpayPaymentAmountInvalid  = errors.New("invalid epay payment amount")
	ErrEpayPaymentAmountMismatch = errors.New("epay payment amount mismatch")
	ErrEpayPaymentProofInvalid   = errors.New("invalid epay payment proof")
)

func (topUp *TopUp) Insert() error {
	var err error
	err = DB.Create(topUp).Error
	return err
}

func topUpQuotaMaxCurrent(creditedQuota int) (int, error) {
	if creditedQuota <= 0 || creditedQuota > common.MaxWalletQuota {
		return 0, ErrInvalidTopUpQuota
	}
	return common.MaxWalletQuota - creditedQuota, nil
}

// ValidateTopUpQuotaCapacity performs the user-facing pre-payment check. The
// settlement path repeats the same invariant with an atomic conditional
// update, because the wallet balance can change after checkout creation.
func ValidateTopUpQuotaCapacity(userId int, creditedQuota int) error {
	maxCurrentQuota, err := topUpQuotaMaxCurrent(creditedQuota)
	if err != nil {
		return err
	}

	var user User
	if err := DB.Select("quota").Where("id = ?", userId).First(&user).Error; err != nil {
		return err
	}
	if user.Quota > maxCurrentQuota {
		return ErrTopUpQuotaLimitExceeded
	}
	return nil
}

// creditTopUpQuota atomically enforces the wallet ceiling while adding quota.
// Keeping the predicate and increment in one UPDATE prevents two
// concurrent callbacks from both passing a separate read/check.
func creditTopUpQuota(tx *gorm.DB, userId int, creditedQuota int, updates map[string]any) error {
	maxCurrentQuota, err := topUpQuotaMaxCurrent(creditedQuota)
	if err != nil {
		return err
	}

	updateFields := make(map[string]any, len(updates)+1)
	maps.Copy(updateFields, updates)
	updateFields["quota"] = gorm.Expr("quota + ?", creditedQuota)

	result := tx.Model(&User{}).
		Where("id = ? AND quota <= ?", userId, maxCurrentQuota).
		Updates(updateFields)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 1 {
		return nil
	}

	var count int64
	if err := tx.Model(&User{}).Where("id = ?", userId).Count(&count).Error; err != nil {
		return err
	}
	if count == 0 {
		return gorm.ErrRecordNotFound
	}
	return ErrTopUpQuotaLimitExceeded
}

type topUpQuotaFenceCandidate struct {
	Id              int
	UserId          int
	Status          string
	PaymentProvider string
	PaymentMethod   string
}

const topUpQuotaFenceWaitTimeout = 5 * time.Second
const topUpQuotaFenceRetryInterval = 20 * time.Millisecond

func readTopUpQuotaFenceCandidate(refCol string, tradeNo string, expectedProvider string) (topUpQuotaFenceCandidate, error) {
	var candidate topUpQuotaFenceCandidate
	if err := DB.Model(&TopUp{}).
		Select("id", "user_id", "status", "payment_provider", "payment_method").
		Where(refCol+" = ?", tradeNo).
		Take(&candidate).Error; err != nil {
		return candidate, ErrTopUpNotFound
	}
	if expectedProvider != "" && candidate.PaymentProvider != expectedProvider {
		return candidate, ErrPaymentMethodMismatch
	}
	return candidate, nil
}

func prepareTopUpQuotaFence(refCol string, tradeNo string, expectedProvider string) (topUpQuotaFenceCandidate, *userQuotaMutationFences, error) {
	deadline := time.Now().Add(topUpQuotaFenceWaitTimeout)
	for {
		candidate, err := readTopUpQuotaFenceCandidate(refCol, tradeNo, expectedProvider)
		if err != nil {
			return candidate, nil, err
		}
		if candidate.Status != common.TopUpStatusPending {
			return candidate, nil, nil
		}
		fences, acquireErr := acquireUserQuotaMutationFences(candidate.UserId)
		if acquireErr == nil {
			return candidate, fences, nil
		}
		terminal := !errors.Is(acquireErr, ErrUserQuotaMutationPending) || time.Now().Add(topUpQuotaFenceRetryInterval).After(deadline)
		if terminal {
			// The acquisition reply or final contention response can race with the
			// winning callback's commit. Re-read once without holding a database
			// lock so an already-completed order still gets idempotent success.
			latest, latestErr := readTopUpQuotaFenceCandidate(refCol, tradeNo, expectedProvider)
			if latestErr == nil && latest.Status == common.TopUpStatusSuccess {
				return latest, nil, nil
			}
			return candidate, nil, acquireErr
		}
		time.Sleep(topUpQuotaFenceRetryInterval)
	}
}

func validateTopUpQuotaFenceCandidateIdentity(topUp *TopUp, candidate topUpQuotaFenceCandidate) error {
	if topUp.Id != candidate.Id || topUp.UserId != candidate.UserId || topUp.PaymentProvider != candidate.PaymentProvider {
		return ErrTopUpStatusInvalid
	}
	return nil
}

func validateTopUpQuotaFenceCandidatePaymentMethod(topUp *TopUp, candidate topUpQuotaFenceCandidate) error {
	if topUp.PaymentMethod != candidate.PaymentMethod {
		return ErrTopUpStatusInvalid
	}
	return nil
}

func creditTopUpQuotaProtected(tx *gorm.DB, userId int, creditedQuota int, updates map[string]any, fences *userQuotaMutationFences) error {
	if common.RedisEnabled && (fences == nil || !fences.owns(userId)) {
		return ErrUserQuotaMutationFenceLost
	}
	if err := fences.verify(); err != nil {
		return err
	}
	return creditTopUpQuota(tx, userId, creditedQuota, updates)
}

// creditOnlineTopUpWithCashbackTx serializes the payer and potential inviter in
// the same order as reward issuance before any wallet UPDATE. The payer lock
// also prevents the referral from changing between this check and completion.
func creditOnlineTopUpWithCashbackTx(tx *gorm.DB, topUp *TopUp, quota int, updates map[string]any, source CashbackCompletionSource, fences *userQuotaMutationFences) error {
	var payer User
	if err := tx.Unscoped().Select("id", "inviter_id").Where("id = ?", topUp.UserId).First(&payer).Error; err != nil {
		return err
	}
	// Lock the bound campaign before user rows. Early stop locks the config
	// version then this campaign; neither path may later acquire a user row
	// in the opposite order. Sample payment time only after the campaign lock.
	var context CashbackOrderContext
	err := tx.Select("campaign_id").Where("top_up_id = ?", topUp.Id).First(&context).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if err == nil && context.CampaignID > 0 {
		var campaign CashbackCampaign
		// A missing campaign cannot grant payer cashback, but must not
		// suppress an otherwise eligible inviter reward or the purchase.
		if err := lockForUpdate(tx).Where("id = ?", context.CampaignID).First(&campaign).Error; err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
	}
	ids := []int{payer.Id}
	if payer.InviterId > 0 && payer.InviterId != payer.Id {
		ids = append(ids, payer.InviterId)
	}
	users, err := lockCashbackUsersTx(tx, ids...)
	if err != nil {
		return err
	}
	lockedPayer, ok := users[payer.Id]
	if !ok || lockedPayer.InviterId != payer.InviterId {
		return ErrCashbackInvalidState // Referral changed while acquiring locks; retry from a new transaction.
	}
	paidAt, err := getDBTimestampOnStrict(tx)
	if err != nil {
		return err
	}
	topUp.CompleteTime = paidAt
	topUp.Status = common.TopUpStatusSuccess
	if err := tx.Save(topUp).Error; err != nil {
		return err
	}
	if err := recordWalletRefundCreditTx(tx, lockedPayer, walletRefundPurchase, "topup", int64(topUp.Id), int64(quota), ""); err != nil {
		return err
	}
	if err := creditTopUpQuotaProtected(tx, topUp.UserId, quota, updates, fences); err != nil {
		return err
	}
	if err := CompleteTopUpCashbackTx(tx, topUp, quota, source, fences); err != nil {
		return err
	}
	// The completion may later issue cashback in this transaction. Ownership
	// verified only before the purchase UPDATE is not sufficient at commit.
	return fences.verify()
}

func (topUp *TopUp) Update() error {
	var err error
	err = DB.Save(topUp).Error
	return err
}

func GetTopUpById(id int) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("id = ?", id).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func GetTopUpByTradeNo(tradeNo string) *TopUp {
	var topUp *TopUp
	var err error
	err = DB.Where("trade_no = ?", tradeNo).First(&topUp).Error
	if err != nil {
		return nil
	}
	return topUp
}

func UpdatePendingTopUpStatus(tradeNo string, expectedPaymentProvider string, targetStatus string) error {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return ErrTopUpNotFound
		}
		if expectedPaymentProvider != "" && topUp.PaymentProvider != expectedPaymentProvider {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}

		topUp.Status = targetStatus
		return tx.Save(topUp).Error
	})
}

// RechargeEpay 原子完成易支付订单：订单行锁、状态校验、成功更新与用户额度增加
// 在同一个事务内完成，因此同一订单的并发/重复回调（包括多实例部署下）最多充值一次。
// alreadyDone=true 表示订单此前已完成，本次为幂等重复回调。
// 进程内的 LockOrder 只是优化，正确性由本函数的数据库行锁保证。
// Pending orders require verified payment details; historical successful orders
// remain idempotent even when their original completion predates this evidence.
func RechargeEpay(tradeNo string, actualPaymentMethod string, signedMoney string, callerIp string, verifiedDetails EpayVerifiedDetails) (alreadyDone bool, err error) {
	return rechargeEpayWithSource(tradeNo, actualPaymentMethod, signedMoney, callerIp, CashbackCompletionProviderCallback, verifiedDetails)
}

func RechargeEpayVerifiedReturn(tradeNo string, actualPaymentMethod string, signedMoney string, callerIp string, verifiedDetails EpayVerifiedDetails) (alreadyDone bool, err error) {
	return rechargeEpayWithSource(tradeNo, actualPaymentMethod, signedMoney, callerIp, CashbackCompletionVerifiedReturn, verifiedDetails)
}

// epayAmountCents accepts only positive decimal amounts with at most two
// fractional digits. Parse in integer cents so callbacks cannot round a
// different signed amount into the checkout price. Epay does not sign a
// currency; this check alone cannot establish CNY settlement for refunds.
func epayAmountCents(money string) (int64, error) {
	whole, fraction, hasDot := strings.Cut(money, ".")
	if whole == "" || hasDot && (fraction == "" || len(fraction) > 2) {
		return 0, ErrEpayPaymentAmountInvalid
	}
	for _, part := range []string{whole, fraction} {
		for i := range len(part) {
			if part[i] < '0' || part[i] > '9' {
				return 0, ErrEpayPaymentAmountInvalid
			}
		}
	}
	units, err := strconv.ParseInt(whole, 10, 64)
	if err != nil || units > math.MaxInt64/100 {
		return 0, ErrEpayPaymentAmountInvalid
	}
	cents := units * 100
	if hasDot {
		minor, err := strconv.ParseInt(fraction, 10, 64)
		if err != nil {
			return 0, ErrEpayPaymentAmountInvalid
		}
		if len(fraction) == 1 {
			minor *= 10
		}
		if cents > math.MaxInt64-minor {
			return 0, ErrEpayPaymentAmountInvalid
		}
		cents += minor
	}
	if cents == 0 {
		return 0, ErrEpayPaymentAmountInvalid
	}
	return cents, nil
}

func rechargeEpayWithSource(tradeNo string, actualPaymentMethod string, signedMoney string, callerIp string, completionSource CashbackCompletionSource, verifiedDetails EpayVerifiedDetails) (alreadyDone bool, err error) {
	if tradeNo == "" {
		return false, errors.New("payment order number not provided")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, tradeNo, PaymentProviderEpay)
	if err != nil {
		return false, err
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return true, nil
	}
	creditCommitted := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	var quotaToAdd int
	topUp := &TopUp{}
	err = cashbackTransaction(func(tx *gorm.DB) error {
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return ErrTopUpNotFound
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}
		if topUp.PaymentProvider != PaymentProviderEpay {
			return ErrPaymentMethodMismatch
		}
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return ErrTopUpStatusInvalid
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}
		if strings.TrimSpace(verifiedDetails.GatewayTradeNo) == "" || strings.TrimSpace(verifiedDetails.MerchantID) == "" || len(verifiedDetails.GatewayTradeNo) > 255 || len(verifiedDetails.MerchantID) > 255 {
			return ErrEpayPaymentProofInvalid
		}
		paidCents, err := epayAmountCents(signedMoney)
		if err != nil {
			return err
		}
		// RequestEpay sends FormatFloat(payMoney, 'f', 2, 64). Recreate
		// that exact checkout representation from the stored order, not
		// from the current (mutable) pricing configuration.
		expectedCents, err := epayAmountCents(strconv.FormatFloat(topUp.Money, 'f', 2, 64))
		if err != nil {
			return err
		}
		if paidCents != expectedCents {
			return ErrEpayPaymentAmountMismatch
		}
		if actualPaymentMethod != "" && topUp.PaymentMethod != actualPaymentMethod {
			topUp.PaymentMethod = actualPaymentMethod
		}
		var quotaErr error
		quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}
		if err := creditOnlineTopUpWithCashbackTx(tx, topUp, quotaToAdd, nil, completionSource, creditFences); err != nil {
			return err
		}
		if err := tx.Create(&EpayPaymentEvidence{
			TopUpID: topUp.Id, TradeNo: topUp.TradeNo,
			GatewayTradeNo: verifiedDetails.GatewayTradeNo, MerchantID: verifiedDetails.MerchantID,
			PaidCents: paidCents,
			Source:    completionSource, VerifiedAt: topUp.CompleteTime,
		}).Error; err != nil {
			return err
		}
		return creditFences.verify()
	})
	if err != nil {
		if !errors.Is(err, ErrTopUpNotFound) && !errors.Is(err, ErrPaymentMethodMismatch) && !errors.Is(err, ErrTopUpStatusInvalid) {
			common.SysError(common.LogText("epay topup failed: %s", err.Error()))
		}
		return false, err
	}
	if alreadyDone {
		return true, nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, topUp.UserId, quotaToAdd, "epay topup")

	common.SysLog(common.LogText("Epay top-up succeeded trade_no=%s user_id=%d quota_to_add=%d money=%.2f", topUp.TradeNo, topUp.UserId, quotaToAdd, topUp.Money))
	RecordTopupLog(topUp.UserId, common.NewMessage("Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentProviderEpay)
	return false, nil
}

func Recharge(referenceId string, customerId string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("payment order number not provided")
	}

	var quota int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, referenceId, PaymentProviderStripe)
	if err != nil {
		common.SysError("topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return nil
	}
	creditCommitted := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	err = cashbackTransaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("top-up order not found")
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}

		if topUp.PaymentProvider != PaymentProviderStripe {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("invalid top-up order status")
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}

		quota, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quota <= 0 {
			return ErrInvalidTopUpQuota
		}
		return creditOnlineTopUpWithCashbackTx(tx, topUp, quota, map[string]any{
			"stripe_customer": customerId,
		}, CashbackCompletionProviderCallback, creditFences)
	})

	if err != nil {
		common.SysError(common.LogText("topup failed: %s", err.Error()))
		return errors.New("top-up failed")
	}
	if alreadyDone {
		return nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, topUp.UserId, quota, "stripe topup")

	RecordTopupLog(topUp.UserId, common.NewMessage("Online top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.FormatQuota(quota), "amount": topUp.Amount}), callerIp, topUp.PaymentMethod, PaymentMethodStripe)

	return nil
}

// topUpQueryWindowSeconds 限制充值记录查询的时间窗口（秒）。
const topUpQueryWindowSeconds int64 = 30 * 24 * 60 * 60

// topUpQueryCutoff 返回允许查询的最早 create_time（秒级 Unix 时间戳）。
func topUpQueryCutoff() int64 {
	return common.GetTimestamp() - topUpQueryWindowSeconds
}

func GetUserTopUps(userId int, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	// Start transaction
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	cutoff := topUpQueryCutoff()

	// Get total count within transaction
	err = tx.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, cutoff).Count(&total).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Get paginated topups within same transaction
	err = tx.Where("user_id = ? AND create_time >= ?", userId, cutoff).Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error
	if err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	// Commit transaction
	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// TopUpListFilter optional filters for admin top-up listing / ledger sync.
type TopUpListFilter struct {
	Status         string // pending|success|failed|expired; empty = all
	StartTimestamp int64  // filter create_time >= ; 0 = no lower bound
	EndTimestamp   int64  // filter create_time <= ; 0 = no upper bound
	UserId         int    // 0 = all users
}

// GetAllTopUps 获取全平台的充值记录（管理员使用，不限制时间窗口）
func GetAllTopUps(pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	return GetAllTopUpsFiltered(pageInfo, TopUpListFilter{})
}

// GetAllTopUpsFiltered lists top-ups with optional status / time / user filters.
// Used by partnership ledger sync to pull successful topups for a period
// without paging through the entire history.
func GetAllTopUpsFiltered(pageInfo *common.PageInfo, filter TopUpListFilter) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{})
	if filter.Status != "" {
		query = query.Where("status = ?", filter.Status)
	}
	if filter.UserId != 0 {
		query = query.Where("user_id = ?", filter.UserId)
	}
	if filter.StartTimestamp != 0 {
		query = query.Where("create_time >= ?", filter.StartTimestamp)
	}
	if filter.EndTimestamp != 0 {
		query = query.Where("create_time <= ?", filter.EndTimestamp)
	}

	if err = query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}

	return topups, total, nil
}

// searchTopUpCountHardLimit 搜索充值记录时 COUNT 的安全上限，
// 防止对超大表执行无界 COUNT 触发 DoS。
const searchTopUpCountHardLimit = 10000

// SearchUserTopUps 按订单号搜索某用户的充值记录
func SearchUserTopUps(userId int, keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{}).Where("user_id = ? AND create_time >= ?", userId, topUpQueryCutoff())
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			tx.Rollback()
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		tx.Rollback()
		common.SysError(common.LogText("failed to count search topups: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search top-up records")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		common.SysError(common.LogText("failed to search topups: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search top-up records")
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return topups, total, nil
}

// SearchAllTopUps 按订单号搜索全平台充值记录（管理员使用，不限制时间窗口）
func SearchAllTopUps(keyword string, pageInfo *common.PageInfo) (topups []*TopUp, total int64, err error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&TopUp{})
	if keyword != "" {
		pattern, perr := sanitizeLikePattern(keyword)
		if perr != nil {
			tx.Rollback()
			return nil, 0, perr
		}
		query = query.Where("trade_no LIKE ? ESCAPE '!'", pattern)
	}

	if err = query.Limit(searchTopUpCountHardLimit).Count(&total).Error; err != nil {
		tx.Rollback()
		common.SysError(common.LogText("failed to count search topups: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search top-up records")
	}

	if err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&topups).Error; err != nil {
		tx.Rollback()
		common.SysError(common.LogText("failed to search topups: %s", err.Error()))
		return nil, 0, common.NewMessage("Failed to search top-up records")
	}

	if err = tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return topups, total, nil
}

// ManualCompleteTopUp 管理员手动完成订单并给用户充值
func ManualCompleteTopUp(tradeNo string, callerIp string) error {
	if tradeNo == "" {
		return common.NewMessage("Order number not provided")
	}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}

	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, tradeNo, "")
	if err != nil {
		return errors.New("充值订单不存在")
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return nil
	}
	creditCommitted := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	var userId int
	var quotaToAdd int
	var payMoney float64
	var paymentMethod string
	alreadyDone := false

	err = cashbackTransaction(func(tx *gorm.DB) error {
		topUp := &TopUp{}
		// 行级锁，避免并发补单
		if err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error; err != nil {
			return common.NewMessage("Top-up order does not exist")
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}

		// 幂等处理：已成功直接返回
		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return common.NewMessage("Order is not pending payment and cannot be completed")
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}

		// 计算应充值额度：
		// - Stripe 订单：Money 代表经分组倍率换算后的美元数量，直接 * QuotaPerUnit
		// - 其他订单（如易支付）：Amount 为美元数量，* QuotaPerUnit
		var quotaErr error
		if topUp.PaymentProvider == PaymentProviderStripe {
			quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
				decimal.NewFromFloat(topUp.Money).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
			)
		} else {
			quotaToAdd, quotaErr = common.WalletQuotaFromDecimalStrict(
				decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
			)
		}
		if quotaErr != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		// 标记完成
		topUp.CompleteTime = common.GetTimestamp()
		topUp.Status = common.TopUpStatusSuccess
		if err := tx.Save(topUp).Error; err != nil {
			return err
		}

		if err := MarkManualTopUpCashbackCompletionTx(tx, topUp, quotaToAdd); err != nil {
			return err
		}

		// 人工补单也占一个真实购买批次，但没有验签实付证据。
		var payer User
		if err := lockForUpdate(tx).Select("id", "quota").Where("id = ?", topUp.UserId).First(&payer).Error; err != nil {
			return err
		}
		if err := recordWalletRefundCreditTx(tx, payer, walletRefundPurchase, "manual_topup", int64(topUp.Id), int64(quotaToAdd), ""); err != nil {
			return err
		}
		// 增加用户额度（立即写库，保持一致性）
		if err := creditTopUpQuotaProtected(tx, topUp.UserId, quotaToAdd, nil, creditFences); err != nil {
			return err
		}

		userId = topUp.UserId
		payMoney = topUp.Money
		paymentMethod = topUp.PaymentMethod
		return nil
	})

	if err != nil {
		return err
	}
	if alreadyDone {
		return nil
	}
	creditCommitted = true

	// 事务外记录日志，避免阻塞
	syncCreditUserQuotaCache(creditFences, userId, quotaToAdd, "manual topup")
	RecordTopupLog(userId, common.NewMessage("Administrator completed the order, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%f", payMoney)}), callerIp, paymentMethod, "admin")
	return nil
}
func RechargeCreem(referenceId string, customerEmail string, customerName string, callerIp string) (err error) {
	if referenceId == "" {
		return errors.New("payment order number not provided")
	}

	var quota int
	alreadyDone := false
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, referenceId, PaymentProviderCreem)
	if err != nil {
		common.SysError("creem topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return nil
	}
	creditCommitted := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	err = cashbackTransaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", referenceId).First(topUp).Error
		if err != nil {
			return errors.New("top-up order not found")
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}

		if topUp.PaymentProvider != PaymentProviderCreem {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}
		if topUp.Status != common.TopUpStatusPending {
			return errors.New("invalid top-up order status")
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}

		// Creem 直接使用 Amount 作为充值额度（整数）
		quota, err = common.WalletQuotaFromDecimalStrict(decimal.NewFromInt(topUp.Amount))
		if err != nil || quota <= 0 {
			return ErrInvalidTopUpQuota
		}

		// 构建更新字段，优先使用邮箱，如果邮箱为空则使用用户名
		updateFields := map[string]any{}

		// 如果有客户邮箱，尝试更新用户邮箱（仅当用户邮箱为空时）
		if customerEmail != "" {
			// 先检查用户当前邮箱是否为空
			var user User
			err = tx.Where("id = ?", topUp.UserId).First(&user).Error
			if err != nil {
				return err
			}

			// 如果用户邮箱为空，则更新为支付时使用的邮箱
			if user.Email == "" {
				updateFields["email"] = customerEmail
			}
		}

		return creditOnlineTopUpWithCashbackTx(tx, topUp, quota, updateFields, CashbackCompletionProviderCallback, creditFences)
	})

	if err != nil {
		common.SysError(common.LogText("creem topup failed: %s", err.Error()))
		return errors.New("top-up failed")
	}
	if alreadyDone {
		return nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, topUp.UserId, quota, "creem topup")

	RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Creem", "quota": quota, "amount": fmt.Sprintf("%.2f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentMethodCreem)

	return nil
}

func RechargeWaffo(tradeNo string, callerIp string) (err error) {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	var quotaToAdd int
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, tradeNo, PaymentProviderWaffo)
	if err != nil {
		common.SysError("waffo topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return nil
	}
	creditCommitted := false
	alreadyDone := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	err = cashbackTransaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("top-up order not found")
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}

		if topUp.PaymentProvider != PaymentProviderWaffo {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil // 幂等：已成功直接返回
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("invalid top-up order status")
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}

		quotaToAdd, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		return creditOnlineTopUpWithCashbackTx(tx, topUp, quotaToAdd, nil, CashbackCompletionProviderCallback, creditFences)
	})

	if err != nil {
		common.SysError(common.LogText("waffo topup failed: %s", err.Error()))
		return errors.New("top-up failed")
	}
	if alreadyDone {
		return nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, topUp.UserId, quotaToAdd, "waffo topup")

	if quotaToAdd > 0 {
		RecordTopupLog(topUp.UserId, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Waffo", "quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%.2f", topUp.Money)}), callerIp, topUp.PaymentMethod, PaymentMethodWaffo)
	}

	return nil
}

func RechargeWaffoPancake(tradeNo string) (err error) {
	if tradeNo == "" {
		return errors.New("payment order number not provided")
	}

	var quotaToAdd int
	topUp := &TopUp{}

	refCol := "`trade_no`"
	if common.UsingMainDatabase(common.DatabaseTypePostgreSQL) {
		refCol = `"trade_no"`
	}
	candidate, creditFences, err := prepareTopUpQuotaFence(refCol, tradeNo, PaymentProviderWaffoPancake)
	if err != nil {
		common.SysError("waffo pancake topup failed: " + err.Error())
		return errors.New("充值失败，请稍后重试")
	}
	if candidate.Status == common.TopUpStatusSuccess {
		return nil
	}
	creditCommitted := false
	alreadyDone := false
	defer func() { finalizeUserQuotaMutationFences(creditFences, creditCommitted) }()

	err = cashbackTransaction(func(tx *gorm.DB) error {
		err := lockForUpdate(tx).Where(refCol+" = ?", tradeNo).First(topUp).Error
		if err != nil {
			return errors.New("top-up order not found")
		}
		if err := validateTopUpQuotaFenceCandidateIdentity(topUp, candidate); err != nil {
			return err
		}

		if topUp.PaymentProvider != PaymentProviderWaffoPancake {
			return ErrPaymentMethodMismatch
		}

		if topUp.Status == common.TopUpStatusSuccess {
			alreadyDone = true
			return nil
		}

		if topUp.Status != common.TopUpStatusPending {
			return errors.New("invalid top-up order status")
		}
		if err := validateTopUpQuotaFenceCandidatePaymentMethod(topUp, candidate); err != nil {
			return err
		}

		quotaToAdd, err = common.WalletQuotaFromDecimalStrict(
			decimal.NewFromInt(topUp.Amount).Mul(decimal.NewFromFloat(common.QuotaPerUnit)),
		)
		if err != nil || quotaToAdd <= 0 {
			return ErrInvalidTopUpQuota
		}

		return creditOnlineTopUpWithCashbackTx(tx, topUp, quotaToAdd, nil, CashbackCompletionProviderCallback, creditFences)
	})

	if err != nil {
		common.SysError(common.LogText("waffo pancake topup failed: %s", err.Error()))
		return errors.New("top-up failed")
	}
	if alreadyDone {
		return nil
	}
	creditCommitted = true
	syncCreditUserQuotaCache(creditFences, topUp.UserId, quotaToAdd, "waffo pancake topup")

	if quotaToAdd > 0 {
		RecordLog(topUp.UserId, LogTypeTopup, common.NewMessage("{{provider}} top-up succeeded, amount added: {{quota}}, payment amount: {{amount}}", map[string]any{"provider": "Waffo Pancake", "quota": logger.FormatQuota(quotaToAdd), "amount": fmt.Sprintf("%.2f", topUp.Money)}))
	}

	return nil
}
