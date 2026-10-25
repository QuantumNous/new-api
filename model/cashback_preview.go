package model

import (
	"errors"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"
)

// CashbackPayerPreview is display-only. It is never accepted by checkout or settlement.
type CashbackPayerPreview struct {
	Status          string                           `json:"status"`
	Strategy        string                           `json:"strategy,omitempty"`
	RateBPS         int                              `json:"rate_bps,omitempty"`
	FixedPerHundred int                              `json:"fixed_per_hundred,omitempty"`
	Tiers           []operation_setting.CashbackTier `json:"tiers,omitempty"`
	MatchedTier     *operation_setting.CashbackTier  `json:"matched_tier,omitempty"`
	CalculatedQuota int                              `json:"calculated_quota,omitempty"`
	RewardQuota     int                              `json:"reward_quota"`
	CapReason       string                           `json:"cap_reason,omitempty"` // limits that reduced the estimate: single_cap, daily_cap
	AsOf            int64                            `json:"as_of"`
	ConfigVersion   int64                            `json:"config_version,omitempty"`
}

// PreviewPayerCashback reads the same face-value and cap logic as payment
// completion, without reserving a campaign slot or writing a reward.
func PreviewPayerCashback(userID, baseQuota int, faceAmount int64, factor string) (CashbackPayerPreview, error) {
	if userID <= 0 || baseQuota < 0 || baseQuota > common.MaxWalletQuota || faceAmount < 0 {
		return CashbackPayerPreview{}, ErrCashbackInvalidInput
	}
	preview := CashbackPayerPreview{Status: "inactive"}
	err := DB.Transaction(func(tx *gorm.DB) error {
		var err error
		preview.AsOf, err = getDBTimestampOnStrict(tx)
		if err != nil {
			return err
		}
		setting, err := loadCashbackSettingTx(tx)
		if err != nil {
			return err
		}
		if !setting.InviteeEnabled || !operation_setting.IsPaymentComplianceConfirmed() || setting.FirstEnabledAt <= 0 || preview.AsOf < setting.FirstEnabledAt {
			return nil
		}
		if err := operation_setting.ValidateCashbackSetting(setting, true); err != nil {
			return err
		}
		if baseQuota == 0 {
			preview.Status = "select_amount"
			return nil
		}
		var campaign CashbackCampaign
		err = tx.Where("start_at <= ? AND end_at > ? AND (stopped_at = 0 OR stopped_at > ?)", preview.AsOf, preview.AsOf, preview.AsOf).
			Order("id desc").First(&campaign).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			preview.Status = "no_campaign"
			return nil
		}
		if err != nil {
			return err
		}
		preview.Strategy = setting.InviteeStrategy
		preview.ConfigVersion = setting.Version
		context := CashbackOrderContext{BaseQuota: baseQuota, FaceAmount: faceAmount, QuotaPerFaceUnit: factor}
		switch preview.Strategy {
		case operation_setting.CashbackStrategyPerHundred:
			preview.FixedPerHundred = setting.InviteeFixedPerHundred
		case operation_setting.CashbackStrategyTiered:
			if reason := cashbackTieredFaceExclusion(&context, ""); reason != "" {
				if reason == "face_basis_unavailable" {
					return ErrCashbackInvalidInput
				}
				preview.Status = "not_applicable"
				return nil
			}
			preview.Tiers = setting.InviteeTiers
		default:
			preview.RateBPS = setting.InviteeRateBPS
		}
		var user User
		if err := tx.Select("id", "status", "deleted_at").Where("id = ?", userID).First(&user).Error; err != nil {
			return err
		}
		if user.Status != common.UserStatusEnabled {
			preview.Status = "ineligible"
			return nil
		}
		blocked, err := cashbackHasOpenDebtTx(tx, userID)
		if err != nil {
			return err
		}
		if blocked {
			preview.Status = "ineligible"
			return nil
		}
		if campaign.PayerScope == CashbackPayerScopeFirstTopUp {
			hasPrior, err := cashbackPayerHasPriorTopUpTx(tx, userID, 0)
			if err != nil {
				return err
			}
			if hasPrior {
				preview.Status = "not_first_top_up"
				return nil
			}
		}
		used, err := cashbackCampaignPayerRewardsUsedTx(tx, campaign.ID, userID)
		if err != nil {
			return err
		}
		if used >= int64(campaign.MaxRewardsPerUser) {
			preview.Status = "limit_reached"
			return nil
		}
		var calculated int
		switch preview.Strategy {
		case operation_setting.CashbackStrategyPerHundred:
			calculated, err = calculateCashbackFixedQuota(&context, preview.FixedPerHundred)
		case operation_setting.CashbackStrategyTiered:
			calculated, preview.MatchedTier, err = calculateCashbackTieredQuota(&context, preview.Tiers)
		default:
			calculated, err = calculateCashbackQuota(baseQuota, preview.RateBPS)
		}
		if err != nil {
			return err
		}
		if calculated == 0 {
			preview.Status = "below_minimum"
			if preview.Strategy == operation_setting.CashbackStrategyTiered && preview.MatchedTier != nil {
				preview.Status = "rounds_to_zero"
			}
			return nil
		}
		dailyUsed, err := cashbackDailyRewardUsedTx(tx, userID, preview.AsOf-cashbackRiskWindowSeconds)
		if err != nil {
			return err
		}
		preview.CalculatedQuota = calculated
		preview.RewardQuota, preview.CapReason = capCashbackQuota(calculated, dailyUsed, setting)
		if preview.RewardQuota == 0 {
			preview.Status = "cap_exhausted"
		} else {
			preview.Status = "estimated"
		}
		return nil
	})
	return preview, err
}

// CashbackPublicOffer is a whitelist of currently available, non-personal rules.
// Fixed-per-hundred is in CNY yuan; tier amounts are CNY cents, never wallet quota.
type CashbackPublicOffer struct {
	Strategy        string                           `json:"strategy"`
	PayerScope      string                           `json:"payer_scope,omitempty"`
	RateBPS         int                              `json:"rate_bps,omitempty"`
	FixedPerHundred int                              `json:"fixed_per_hundred,omitempty"`
	Tiers           []operation_setting.CashbackTier `json:"tiers,omitempty"`
}

type CashbackPublicOffers struct {
	Active   bool                 `json:"active"`
	Currency string               `json:"currency"`
	Inviter  *CashbackPublicOffer `json:"inviter,omitempty"`
	Invitee  *CashbackPublicOffer `json:"invitee,omitempty"`
}

func GetCashbackPublicOffers() (CashbackPublicOffers, error) {
	result := CashbackPublicOffers{Currency: "CNY"}
	err := DB.Transaction(func(tx *gorm.DB) error {
		// Unlike checkout's pre-activation fallback, a public read must not
		// turn an unavailable configuration table into a valid inactive offer.
		if !tx.Migrator().HasTable(&Option{}) {
			return errors.New("cashback options table unavailable")
		}
		now, err := getDBTimestampOnStrict(tx)
		if err != nil {
			return err
		}
		setting, err := loadCashbackSettingTx(tx)
		if err != nil {
			return err
		}
		if !setting.AnyDirectionEnabled() || !operation_setting.IsPaymentComplianceConfirmed() || setting.FirstEnabledAt <= 0 || now < setting.FirstEnabledAt {
			return nil
		}
		if err := operation_setting.ValidateCashbackSetting(setting, true); err != nil {
			return err
		}
		if setting.InviterEnabled {
			result.Inviter = publicCashbackOffer(setting.InviterStrategy, setting.InviterRateBPS, setting.InviterFixedPerHundred, setting.InviterTiers)
		}
		if setting.InviteeEnabled {
			var campaign CashbackCampaign
			err := tx.Where("start_at <= ? AND end_at > ? AND (stopped_at = 0 OR stopped_at > ?)", now, now, now).Order("id desc").First(&campaign).Error
			if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
				return err
			}
			if err == nil {
				result.Invitee = publicCashbackOffer(setting.InviteeStrategy, setting.InviteeRateBPS, setting.InviteeFixedPerHundred, setting.InviteeTiers)
				result.Invitee.PayerScope = campaign.PayerScope
			}
		}
		result.Active = result.Inviter != nil || result.Invitee != nil
		return nil
	})
	return result, err
}

func publicCashbackOffer(strategy string, rateBPS, fixed int, tiers []operation_setting.CashbackTier) *CashbackPublicOffer {
	offer := &CashbackPublicOffer{Strategy: strategy}
	switch strategy {
	case operation_setting.CashbackStrategyTiered:
		offer.Tiers = tiers
	case operation_setting.CashbackStrategyPerHundred:
		offer.FixedPerHundred = fixed
	default:
		offer.RateBPS = rateBPS
	}
	return offer
}
