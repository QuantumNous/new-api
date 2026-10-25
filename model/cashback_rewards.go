package model

import (
	"errors"
	"fmt"
	"slices"
	"sort"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type cashbackDirectionConfig struct {
	Direction       CashbackDirection
	BeneficiaryID   int
	RateBPS         int
	Strategy        string
	FixedPerHundred int
	Tiers           []operation_setting.CashbackTier
}

func CompleteTopUpCashbackTx(tx *gorm.DB, topUp *TopUp, creditedQuota int, source CashbackCompletionSource, heldFences ...*userQuotaMutationFences) error {
	if tx == nil || topUp == nil || topUp.Id <= 0 {
		return errors.New("invalid cashback completion input")
	}
	if creditedQuota <= 0 || creditedQuota > common.MaxWalletQuota {
		return ErrInvalidTopUpQuota
	}
	if !validCashbackCompletionSource(source) || source == "" {
		return errors.New("invalid cashback completion source")
	}
	var orderContext CashbackOrderContext
	err := lockForUpdate(tx).Where("top_up_id = ?", topUp.Id).First(&orderContext).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		contextRequired, boundaryErr := cashbackOrderContextRequiredTx(tx, topUp)
		if boundaryErr != nil {
			return boundaryErr
		}
		if contextRequired {
			return ErrCashbackOrderContextMissing
		}
		// Historical orders predate order-local eligibility snapshots. They
		// settle normally and are never backfilled.
		return nil
	}
	if err != nil {
		return err
	}
	if orderContext.UserID != topUp.UserId || orderContext.TradeNo != topUp.TradeNo || orderContext.PaymentProvider != topUp.PaymentProvider {
		return ErrPaymentMethodMismatch
	}
	if orderContext.CompletionSource != "" && orderContext.CompletionSource != source {
		return ErrCashbackInvalidState
	}
	if orderContext.CreditedQuota != 0 && orderContext.CreditedQuota != creditedQuota {
		return ErrCashbackInvalidState
	}
	orderContext.CreditedQuota = creditedQuota
	orderContext.CompletionSource = source
	orderContext.CompletionProvider = topUp.PaymentProvider
	if err := tx.Save(&orderContext).Error; err != nil {
		return err
	}
	if !eligibleCashbackCompletionSource(source) || !orderContext.EligibleAfterFirstEnable || orderContext.IneligibleReason != "" {
		return nil
	}

	setting, err := loadCashbackSettingTx(tx)
	if err != nil {
		return err
	}
	if err := operation_setting.ValidateCashbackSetting(setting, operation_setting.IsPaymentComplianceConfirmed()); err != nil {
		if setting.AnyDirectionEnabled() {
			return err
		}
		return nil
	}
	if !setting.AnyDirectionEnabled() || !operation_setting.IsPaymentComplianceConfirmed() {
		return nil
	}
	if setting.FirstEnabledAt <= 0 || topUp.CreateTime < setting.FirstEnabledAt {
		return ErrCashbackInvalidState
	}
	if topUp.Status != common.TopUpStatusSuccess || topUp.CompleteTime <= 0 {
		return ErrTopUpStatusInvalid
	}

	var initialInvitee User
	if err := tx.Unscoped().Where("id = ?", topUp.UserId).First(&initialInvitee).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	var campaign CashbackCampaign
	if setting.InviteeEnabled && orderContext.CampaignID > 0 {
		// The payment path already owns this row; direct transaction callers
		// must also lock it before users so early stop cannot race eligibility.
		err := lockForUpdate(tx).Where("id = ?", orderContext.CampaignID).First(&campaign).Error
		if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		if err == nil {
			paymentCheckAt, clockErr := getDBTimestampOnStrict(tx)
			if clockErr != nil {
				return clockErr
			}
			if !campaign.activeAt(topUp.CompleteTime) || !campaign.activeAt(paymentCheckAt) {
				campaign = CashbackCampaign{}
			}
		}
	}
	users, err := lockCashbackUsersTx(tx, initialInvitee.Id, initialInvitee.InviterId)
	if err != nil {
		return err
	}
	invitee, inviteeOK := users[initialInvitee.Id]
	inviter, inviterOK := users[initialInvitee.InviterId]
	if !inviteeOK || invitee.DeletedAt.Valid || invitee.Status != common.UserStatusEnabled {
		return nil
	}
	validInviter := inviterOK && inviter.Id != invitee.Id && !inviter.DeletedAt.Valid &&
		inviter.Status == common.UserStatusEnabled && invitee.InviterId == inviter.Id
	if !validInviter {
		inviter = User{}
	}
	if !validInviter && campaign.ID == 0 {
		cashbackLogf("topup %d (user %d): no cashback, no valid inviter and no active payer campaign", topUp.Id, invitee.Id)
		return nil
	}

	configSnapshot, err := common.Marshal(struct {
		operation_setting.CashbackSetting
		PaymentComplianceConfirmed bool   `json:"payment_compliance_confirmed"`
		ComplianceTermsVersion     string `json:"compliance_terms_version"`
	}{
		CashbackSetting:            setting,
		PaymentComplianceConfirmed: operation_setting.IsPaymentComplianceConfirmed(),
		ComplianceTermsVersion:     operation_setting.CurrentComplianceTermsVersion,
	})
	if err != nil {
		return err
	}
	directions := make([]cashbackDirectionConfig, 0, 2)
	if setting.InviterEnabled && validInviter {
		directions = append(directions, cashbackDirectionConfig{
			Direction: CashbackDirectionInviter, BeneficiaryID: inviter.Id, RateBPS: setting.InviterRateBPS,
			Strategy: setting.InviterStrategy, FixedPerHundred: setting.InviterFixedPerHundred, Tiers: setting.InviterTiers,
		})
	}
	if setting.InviteeEnabled && campaign.ID > 0 {
		directions = append(directions, cashbackDirectionConfig{
			Direction: CashbackDirectionInvitee, BeneficiaryID: invitee.Id, RateBPS: setting.InviteeRateBPS,
			Strategy: setting.InviteeStrategy, FixedPerHundred: setting.InviteeFixedPerHundred, Tiers: setting.InviteeTiers,
		})
	}
	sort.Slice(directions, func(i, j int) bool {
		if directions[i].BeneficiaryID == directions[j].BeneficiaryID {
			return directions[i].Direction < directions[j].Direction
		}
		return directions[i].BeneficiaryID < directions[j].BeneficiaryID
	})

	for _, direction := range directions {
		var existing CashbackReward
		err := tx.Where("top_up_id = ? AND direction = ?", topUp.Id, direction.Direction).First(&existing).Error
		if err == nil {
			continue
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return err
		}
		err = nil

		calculatedQuota := 0
		faceBasisUnavailable := false
		notApplicable := false
		switch direction.Strategy {
		case operation_setting.CashbackStrategyPerHundred:
			if orderContext.FaceAmount == 0 && orderContext.QuotaPerFaceUnit == "" {
				faceBasisUnavailable = true
			} else {
				calculatedQuota, err = calculateCashbackFixedQuota(&orderContext, direction.FixedPerHundred)
			}
		case operation_setting.CashbackStrategyTiered:
			switch cashbackTieredFaceExclusion(&orderContext, topUp.PaymentProvider) {
			case "face_basis_unavailable":
				faceBasisUnavailable = true
			case "strategy_not_applicable":
				notApplicable = true
			default:
				calculatedQuota, _, err = calculateCashbackTieredQuota(&orderContext, direction.Tiers)
			}
		default:
			calculatedQuota, err = calculateCashbackQuota(orderContext.BaseQuota, direction.RateBPS)
		}
		if err != nil {
			return err
		}
		dailyUsed, err := cashbackDailyRewardUsedTx(tx, direction.BeneficiaryID, topUp.CompleteTime-cashbackRiskWindowSeconds)
		if err != nil {
			return err
		}
		rewardQuota, capReason := capCashbackQuota(calculatedQuota, dailyUsed, setting)
		notFirstTopUp := false
		if direction.Direction == CashbackDirectionInvitee && campaign.PayerScope == CashbackPayerScopeFirstTopUp {
			// The payer row is locked above, so concurrent completions for the
			// same payer serialize and see each other's committed success.
			notFirstTopUp, err = cashbackPayerHasPriorTopUpTx(tx, invitee.Id, topUp.Id)
			if err != nil {
				return err
			}
			if notFirstTopUp {
				rewardQuota = 0
				capReason = appendCashbackReason(capReason, "not_first_top_up")
			}
		}
		if faceBasisUnavailable {
			capReason = appendCashbackReason(capReason, "face_basis_unavailable")
		}
		if notApplicable {
			capReason = appendCashbackReason(capReason, "strategy_not_applicable")
		}
		if direction.Direction == CashbackDirectionInvitee && rewardQuota > 0 {
			used, err := cashbackCampaignPayerRewardsUsedTx(tx, campaign.ID, invitee.Id)
			if err != nil {
				return err
			}
			if used >= int64(campaign.MaxRewardsPerUser) {
				cashbackLogf("topup %d (user %d): payer cashback skipped, campaign %d limit of %d rewards reached",
					topUp.Id, invitee.Id, campaign.ID, campaign.MaxRewardsPerUser)
				continue
			}
		}
		blockedByDebt, err := cashbackHasOpenDebtTx(tx, direction.BeneficiaryID)
		if err != nil {
			return err
		}
		riskSnapshot, riskLevel, err := buildCashbackRiskSnapshotTx(tx, cashbackRiskInput{
			TopUp:           topUp,
			OrderContext:    &orderContext,
			Invitee:         invitee,
			Inviter:         inviter,
			BeneficiaryID:   direction.BeneficiaryID,
			CalculatedQuota: calculatedQuota,
			RewardQuota:     rewardQuota,
			CapReason:       capReason,
			DailyUsedQuota:  dailyUsed,
			Setting:         setting,
		})
		if err != nil {
			return err
		}

		settlementStatus := CashbackSettlementFrozen
		blockingReason := ""
		if blockedByDebt {
			rewardQuota = 0
			capReason = appendCashbackReason(capReason, "open_debt")
			blockingReason = "beneficiary_has_open_cashback_debt"
			settlementStatus = CashbackSettlementCanceled
			riskSnapshot.Flags = appendUniqueSorted(riskSnapshot.Flags, "open_debt")
			riskSnapshot.SignalCount = len(riskSnapshot.Flags)
			riskLevel = CashbackRiskSevere
		} else if rewardQuota == 0 {
			settlementStatus = CashbackSettlementCanceled
			if !faceBasisUnavailable && !notApplicable && !notFirstTopUp {
				if calculatedQuota == 0 {
					capReason = appendCashbackReason(capReason, "below_minimum")
				} else {
					capReason = appendCashbackReason(capReason, "daily_cap_exhausted")
				}
			}
			blockingReason = "no_payable_cashback_quota"
		}
		if direction.Direction == CashbackDirectionInvitee && rewardQuota > 0 {
			switch {
			case !setting.AutoReviewEnabled:
				riskSnapshot.AutoReviewDecision = "master_disabled"
			case setting.AutoReviewRiskFlags == nil:
				riskSnapshot.AutoReviewDecision = "policy_unconfigured"
			default:
				for _, flag := range riskSnapshot.Flags {
					if slices.Contains(setting.AutoReviewRiskFlags, flag) {
						riskSnapshot.AutoReviewMatchedFlags = append(riskSnapshot.AutoReviewMatchedFlags, flag)
					}
				}
				if len(riskSnapshot.AutoReviewMatchedFlags) > 0 {
					riskSnapshot.AutoReviewDecision = "selected_flags"
				} else {
					riskSnapshot.AutoReviewDecision = "automatic"
				}
			}
		}
		riskJSON, err := common.Marshal(riskSnapshot)
		if err != nil {
			return err
		}

		reward := CashbackReward{
			TopUpID:          topUp.Id,
			TradeNo:          topUp.TradeNo,
			Direction:        direction.Direction,
			InviteeID:        invitee.Id,
			InviterID:        inviter.Id,
			BeneficiaryID:    direction.BeneficiaryID,
			BaseQuota:        orderContext.BaseQuota,
			RateBPS:          direction.RateBPS,
			Strategy:         direction.Strategy,
			FixedPerHundred:  direction.FixedPerHundred,
			CalculatedQuota:  calculatedQuota,
			RewardQuota:      rewardQuota,
			CapReason:        capReason,
			SettlementDays:   setting.SettlementDays,
			ConfigVersion:    setting.Version,
			PaidAt:           topUp.CompleteTime,
			AvailableAt:      topUp.CompleteTime + int64(setting.SettlementDays)*24*60*60,
			ReviewStatus:     CashbackReviewPending,
			SettlementStatus: settlementStatus,
			RiskLevel:        riskLevel,
			RiskSnapshot:     string(riskJSON),
			ConfigSnapshot:   string(configSnapshot),
			BlockingReason:   blockingReason,
		}
		if direction.Strategy != operation_setting.CashbackStrategyRate {
			reward.RateBPS = 0
		}
		if direction.Strategy != operation_setting.CashbackStrategyPerHundred {
			reward.FixedPerHundred = 0
		}
		if riskSnapshot.AutoReviewDecision == "automatic" {
			reward.ReviewStatus = CashbackReviewApproved
			reward.ReviewSource = CashbackReviewAutomatic
			reward.ReviewedAt = topUp.CompleteTime
			if setting.AutoReviewImmediateIssue {
				reward.AvailableAt = topUp.CompleteTime
			}
		}
		if err := tx.Create(&reward).Error; err != nil {
			return err
		}
		cashbackLogf("reward %d recorded: topup=%d trade_no=%s direction=%s beneficiary=%d strategy=%s calculated=%d reward=%d cap_reason=%q review=%s risk=%s settlement=%s available_at=%s",
			reward.ID, topUp.Id, topUp.TradeNo, reward.Direction, reward.BeneficiaryID, reward.Strategy,
			reward.CalculatedQuota, reward.RewardQuota, reward.CapReason, reward.ReviewStatus, reward.RiskLevel,
			reward.SettlementStatus, cashbackTime(reward.AvailableAt))
		if reward.ReviewSource == CashbackReviewAutomatic && reward.AvailableAt == topUp.CompleteTime {
			issueImmediateCashbackRewardTx(tx, topUp, &orderContext, &reward, heldFences...)
		}
	}
	return nil
}

// issueImmediateCashbackRewardTx tries to issue an automatically approved
// reward inside the payment transaction. It never fails the purchase: every
// mutation runs in a savepoint, and on any failure the reward stays approved
// and frozen with available_at already reached, so the settlement system task
// issues it on its next run (which also enforces reconciliation health).
func issueImmediateCashbackRewardTx(tx *gorm.DB, topUp *TopUp, orderContext *CashbackOrderContext, reward *CashbackReward, heldFences ...*userQuotaMutationFences) {
	var fences *userQuotaMutationFences
	if len(heldFences) > 0 {
		fences = heldFences[0]
	}
	if common.RedisEnabled && (fences == nil || !fences.owns(reward.BeneficiaryID)) {
		deferImmediateCashbackRewardTx(tx, reward.ID, ErrUserQuotaMutationFenceLost)
		return
	}
	issued := *reward
	err := tx.Transaction(func(sp *gorm.DB) error {
		if fences != nil {
			if err := fences.verify(); err != nil {
				return err
			}
		}
		blockingReason, currentUsers, err := cashbackHardBlockReasonTx(sp, topUp, orderContext, &issued)
		if err != nil {
			return err
		}
		if blockingReason != "" {
			return fmt.Errorf("%w: %s", ErrCashbackHardBlocked, blockingReason)
		}
		_, err = issueLockedCashbackRewardTx(sp, &issued, currentUsers[issued.BeneficiaryID], topUp.CompleteTime)
		return err
	})
	if err != nil {
		deferImmediateCashbackRewardTx(tx, reward.ID, err)
		return
	}
	*reward = issued
	if fences != nil {
		fences.cashbackIssued = true
		fences.cashbackRewardID = reward.ID
		fences.cashbackQuota = reward.RewardQuota
	}
}

func deferImmediateCashbackRewardTx(tx *gorm.DB, rewardID int64, cause error) {
	common.SysError(fmt.Sprintf("immediate cashback reward %d deferred to settlement task: %v", rewardID, cause))
	err := tx.Transaction(func(sp *gorm.DB) error {
		return sp.Session(&gorm.Session{SkipHooks: true}).Model(&CashbackReward{}).
			Where("id = ?", rewardID).
			Update("last_settlement_error", "immediate issue deferred: "+cause.Error()).Error
	})
	if err != nil {
		common.SysError(fmt.Sprintf("failed to record deferred cashback reward %d: %v", rewardID, err))
	}
}

func MarkManualTopUpCashbackCompletionTx(tx *gorm.DB, topUp *TopUp, creditedQuota int) error {
	return CompleteTopUpCashbackTx(tx, topUp, creditedQuota, CashbackCompletionAdminManual)
}

func calculateCashbackQuota(baseQuota, rateBPS int) (int, error) {
	if baseQuota <= 0 || baseQuota > common.MaxWalletQuota || rateBPS < 0 || rateBPS > operation_setting.CashbackRateBasisPoints {
		return 0, errors.New("invalid cashback calculation input")
	}
	value := decimal.NewFromInt(int64(baseQuota)).
		Mul(decimal.NewFromInt(int64(rateBPS))).
		Div(decimal.NewFromInt(operation_setting.CashbackRateBasisPoints)).
		Floor()
	return common.WalletQuotaFromDecimalStrict(value)
}

// calculateCashbackFixedQuota floors once after multiplying complete hundreds by
// the order-time conversion factor, never using payment price or current rates.
func calculateCashbackFixedQuota(context *CashbackOrderContext, fixed int) (int, error) {
	if context == nil || context.FaceAmount <= 0 || context.BaseQuota <= 0 || fixed < 1 || fixed > 100 {
		return 0, ErrCashbackInvalidInput
	}
	factor, err := decimal.NewFromString(context.QuotaPerFaceUnit)
	if err != nil || !factor.GreaterThan(decimal.Zero) {
		return 0, ErrCashbackInvalidInput
	}
	basis := decimal.NewFromInt(context.FaceAmount).Mul(factor)
	if basis.LessThan(decimal.NewFromInt(int64(context.BaseQuota-1))) || basis.GreaterThan(decimal.NewFromInt(int64(context.BaseQuota+1))) {
		return 0, ErrCashbackInvalidInput
	}
	value := decimal.NewFromInt(context.FaceAmount / 100).Mul(decimal.NewFromInt(int64(fixed))).Mul(factor).Floor()
	quota, err := common.WalletQuotaFromDecimalStrict(value)
	if err != nil || quota < 0 || quota > context.BaseQuota {
		return 0, ErrCashbackInvalidInput
	}
	return quota, nil
}

// Without an additional provenance column, a factor of one cannot distinguish
// token/product quota from a CNY face. Exclude it conservatively; Creem is
// independently excluded by the existing payment provider on the order.
func cashbackTieredFaceExclusion(context *CashbackOrderContext, provider string) string {
	if context == nil || context.FaceAmount <= 0 || context.QuotaPerFaceUnit == "" {
		return "face_basis_unavailable"
	}
	if provider == PaymentProviderCreem {
		return "strategy_not_applicable"
	}
	factor, err := decimal.NewFromString(context.QuotaPerFaceUnit)
	if err != nil || !factor.GreaterThan(decimal.Zero) {
		return "face_basis_unavailable"
	}
	if !factor.GreaterThan(decimal.NewFromInt(1)) {
		return "strategy_not_applicable"
	}
	return ""
}

// calculateCashbackTieredQuota chooses the last reached threshold of this
// order only. Cents and checkout factor stay exact until the single floor.
func calculateCashbackTieredQuota(context *CashbackOrderContext, tiers []operation_setting.CashbackTier) (int, *operation_setting.CashbackTier, error) {
	if context == nil || context.FaceAmount <= 0 ||
		context.FaceAmount > common.MaxWalletQuota || context.BaseQuota <= 0 || context.BaseQuota > common.MaxWalletQuota {
		return 0, nil, ErrCashbackInvalidInput
	}
	factor, err := decimal.NewFromString(context.QuotaPerFaceUnit)
	if err != nil || !factor.GreaterThan(decimal.Zero) {
		return 0, nil, ErrCashbackInvalidInput
	}
	basis := decimal.NewFromInt(context.FaceAmount).Mul(factor)
	if basis.LessThan(decimal.NewFromInt(int64(context.BaseQuota-1))) || basis.GreaterThan(decimal.NewFromInt(int64(context.BaseQuota+1))) {
		return 0, nil, ErrCashbackInvalidInput
	}
	faceCents := context.FaceAmount * 100 // FaceAmount <= MaxWalletQuota (2^53-1).
	var matched *operation_setting.CashbackTier
	for i := range tiers {
		if tiers[i].ThresholdCents > faceCents {
			break
		}
		matched = &tiers[i]
	}
	if matched == nil {
		return 0, nil, nil
	}
	if matched.RewardCents <= 0 || matched.RewardCents > common.MaxWalletQuota {
		return 0, nil, ErrCashbackInvalidInput
	}
	value := decimal.NewFromInt(matched.RewardCents).Div(decimal.NewFromInt(100)).Mul(factor).Floor()
	quota, err := common.WalletQuotaFromDecimalStrict(value)
	if err != nil || quota > context.BaseQuota {
		return 0, nil, ErrCashbackInvalidInput
	}
	return quota, matched, nil
}

// Any earlier successful wallet top-up, whatever its provider or completion
// source, uses up the payer's first top-up. Subscription purchases mirror into
// top_ups with a zero amount and are not wallet top-ups.
func cashbackPayerHasPriorTopUpTx(tx *gorm.DB, payerID, excludeTopUpID int) (bool, error) {
	var count int64
	err := tx.Model(&TopUp{}).
		Where("user_id = ? AND status = ? AND amount > 0 AND id <> ?", payerID, common.TopUpStatusSuccess, excludeTopUpID).
		Count(&count).Error
	return count > 0, err
}

// A positive reward consumes its campaign slot permanently, even if it is
// subsequently rejected, canceled by an incident, or recovered.
func cashbackCampaignPayerRewardsUsedTx(tx *gorm.DB, campaignID int64, payerID int) (int64, error) {
	orders := tx.Model(&CashbackOrderContext{}).Select("top_up_id").Where("campaign_id = ?", campaignID)
	var used int64
	err := tx.Model(&CashbackReward{}).
		Where("top_up_id IN (?) AND direction = ? AND beneficiary_id = ? AND reward_quota > 0",
			orders, CashbackDirectionInvitee, payerID).
		Count(&used).Error
	return used, err
}

// cashbackDailyRewardUsedTx sums rewards that were or still may be paid in the
// rolling window. The window uses paid_at, which shares the DB clock with the
// completion time used as the cutoff; rejected or canceled rewards were never
// payable and do not consume the allowance.
func cashbackDailyRewardUsedTx(tx *gorm.DB, beneficiaryID int, cutoff int64) (int, error) {
	var used int64
	if err := tx.Model(&CashbackReward{}).
		Where("beneficiary_id = ? AND paid_at >= ? AND review_status <> ? AND settlement_status <> ?",
			beneficiaryID, cutoff, CashbackReviewRejected, CashbackSettlementCanceled).
		Select("COALESCE(SUM(reward_quota), 0)").
		Scan(&used).Error; err != nil {
		return 0, err
	}
	if used < 0 || used > int64(common.MaxWalletQuota) {
		return 0, errors.New("cashback daily quota aggregate is invalid")
	}
	return int(used), nil
}

func capCashbackQuota(calculatedQuota, dailyUsed int, setting operation_setting.CashbackSetting) (int, string) {
	reward := calculatedQuota
	reasons := make([]string, 0, 2)
	if reward > setting.MaxRewardQuota {
		reward = setting.MaxRewardQuota
		reasons = append(reasons, "single_cap")
	}
	remaining := setting.DailyRewardQuota - dailyUsed
	if remaining < 0 {
		remaining = 0
	}
	if reward > remaining {
		reward = remaining
		reasons = append(reasons, "daily_cap")
	}
	return reward, strings.Join(reasons, ",")
}

func appendCashbackReason(current, reason string) string {
	if current == "" {
		return reason
	}
	for _, existing := range strings.Split(current, ",") {
		if existing == reason {
			return current
		}
	}
	return current + "," + reason
}

func appendUniqueSorted(values []string, value string) []string {
	for _, existing := range values {
		if existing == value {
			return values
		}
	}
	values = append(values, value)
	sort.Strings(values)
	return values
}
