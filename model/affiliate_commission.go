package model

import (
	"errors"
	"fmt"
	"net/mail"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

const (
	AffiliateCommissionStatusPending = "pending"
	AffiliateCommissionStatusSettled = "settled"

	AffiliateCommissionLevel1 = 1
	AffiliateCommissionLevel2 = 2

	AffiliateCommissionSettlementTypeWallet          = "wallet"
	AffiliateCommissionSettlementTypeOffline         = "offline"
	AffiliateCommissionSettlementTypeOfflineCashback = "offline_cashback"

	legacyAffiliateWalletRedemptionRollbackMigrationKey = "migration:legacy_affiliate_wallet_redemption_rollback:v1"

	AffiliatePayoutMethodPayPal = "paypal"
)

type AffiliateCommission struct {
	Id                                 int    `json:"id"`
	TradeNo                            string `json:"trade_no" gorm:"type:varchar(255);not null;uniqueIndex:idx_affiliate_commission_trade_level;index"`
	TopUpId                            int    `json:"top_up_id" gorm:"index"`
	BuyerId                            int    `json:"buyer_id" gorm:"index"`
	PromoterId                         int    `json:"promoter_id" gorm:"index;index:idx_affiliate_commission_promoter_status_created,priority:1"`
	Level                              int    `json:"level" gorm:"not null;uniqueIndex:idx_affiliate_commission_trade_level;index"`
	BaseAmountMicros                   int64  `json:"base_amount_micros"`
	CommissionRateBps                  int    `json:"commission_rate_bps"`
	CommissionAmountMicros             int64  `json:"commission_amount_micros"`
	BaseQuota                          int    `json:"base_quota" gorm:"default:0"`
	RewardPoints                       int    `json:"reward_points" gorm:"default:0"`
	SettledPoints                      int    `json:"settled_points" gorm:"default:0"`
	WalletRedeemedPoints               int    `json:"wallet_redeemed_points" gorm:"default:0"`
	OfflineSettledPoints               int    `json:"offline_settled_points" gorm:"default:0"`
	OfflineCashbackPoints              int    `json:"offline_cashback_points" gorm:"-"`
	Currency                           string `json:"currency" gorm:"type:varchar(16);not null;default:'CNY'"`
	PaymentProvider                    string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	PaymentMethod                      string `json:"payment_method" gorm:"type:varchar(50);default:''"`
	Status                             string `json:"status" gorm:"type:varchar(20);not null;default:'pending';index:idx_affiliate_commission_promoter_status_created,priority:2;index"`
	SettlementType                     string `json:"settlement_type" gorm:"type:varchar(20);default:'';index"`
	SettledAt                          int64  `json:"settled_at" gorm:"default:0"`
	SettledBy                          int    `json:"settled_by" gorm:"default:0"`
	SettleRemark                       string `json:"settle_remark" gorm:"type:varchar(255);default:''"`
	SettledPayoutMethod                string `json:"settled_payout_method" gorm:"type:varchar(32);default:''"`
	SettledPayoutAccount               string `json:"settled_payout_account" gorm:"type:varchar(255);default:''"`
	SettledPayoutAccountName           string `json:"settled_payout_account_name" gorm:"type:varchar(255);default:''"`
	SettledCashValueMicros             int64  `json:"settled_cash_value_micros" gorm:"default:0"`
	SettledWalletQuota                 int    `json:"settled_wallet_quota" gorm:"default:0"`
	SettledWalletAmountMicros          int64  `json:"settled_wallet_amount_micros" gorm:"default:0"`
	SettledPricePerWalletUnitMicros    int64  `json:"settled_price_per_wallet_unit_micros" gorm:"default:0"`
	SettledPointsPerAmountUnit         int    `json:"settled_points_per_amount_unit" gorm:"default:0"`
	SettledOfflineAmountPerPointMicros int64  `json:"settled_offline_amount_per_point_micros" gorm:"default:0"`
	CreatedAt                          int64  `json:"created_at" gorm:"autoCreateTime;index:idx_affiliate_commission_promoter_status_created,priority:3"`
	UpdatedAt                          int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateCommissionSettlement struct {
	Id                          int    `json:"id"`
	CommissionId                int    `json:"commission_id" gorm:"index;not null"`
	PromoterId                  int    `json:"promoter_id" gorm:"index;not null"`
	SettlementType              string `json:"settlement_type" gorm:"type:varchar(20);not null;index"`
	SettledPoints               int    `json:"settled_points" gorm:"not null;default:0"`
	CashValueMicros             int64  `json:"cash_value_micros" gorm:"default:0"`
	WalletQuota                 int    `json:"wallet_quota" gorm:"default:0"`
	WalletAmountMicros          int64  `json:"wallet_amount_micros" gorm:"default:0"`
	PricePerWalletUnitMicros    int64  `json:"price_per_wallet_unit_micros" gorm:"default:0"`
	PointsPerAmountUnit         int    `json:"points_per_amount_unit" gorm:"default:0"`
	OfflineAmountPerPointMicros int64  `json:"offline_amount_per_point_micros" gorm:"default:0"`
	SettledBy                   int    `json:"settled_by" gorm:"default:0"`
	SettledAt                   int64  `json:"settled_at" gorm:"default:0;index"`
	Remark                      string `json:"remark" gorm:"type:varchar(255);default:''"`
	CreatedAt                   int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt                   int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliatePayoutProfile struct {
	Id          int    `json:"id"`
	UserId      int    `json:"user_id" gorm:"uniqueIndex;not null"`
	Method      string `json:"method" gorm:"type:varchar(32);not null;default:'paypal'"`
	Account     string `json:"account" gorm:"type:varchar(255);not null;default:''"`
	AccountName string `json:"account_name" gorm:"type:varchar(255);default:''"`
	CreatedAt   int64  `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt   int64  `json:"updated_at" gorm:"autoUpdateTime"`
}

type AffiliateCommissionRecord struct {
	AffiliateCommission
	BuyerUsername                         string  `json:"buyer_username"`
	PromoterUsername                      string  `json:"promoter_username"`
	PromoterPayoutMethod                  string  `json:"promoter_payout_method"`
	PromoterPayoutAccount                 string  `json:"promoter_payout_account"`
	PromoterPayoutAccountName             string  `json:"promoter_payout_account_name"`
	BuyerDirectInviterId                  *int    `json:"buyer_direct_inviter_id"`
	BuyerDirectInviterUsername            *string `json:"buyer_direct_inviter_username"`
	BuyerDirectInviterDistributionEnabled *bool   `json:"buyer_direct_inviter_distribution_enabled"`
	BuyerSecondInviterId                  *int    `json:"buyer_second_inviter_id"`
	BuyerSecondInviterUsername            *string `json:"buyer_second_inviter_username"`
	BuyerSecondInviterDistributionEnabled *bool   `json:"buyer_second_inviter_distribution_enabled"`
	SettledByUsername                     string  `json:"settled_by_username"`
	CashValueMicros                       int64   `json:"cash_value_micros" gorm:"-"`
	WalletQuota                           int64   `json:"wallet_quota" gorm:"-"`
	WalletAmountMicros                    int64   `json:"wallet_amount_micros" gorm:"-"`
	PricePerWalletUnitMicros              int64   `json:"price_per_wallet_unit_micros" gorm:"-"`
	PendingPoints                         int     `json:"pending_points" gorm:"-"`
}

type AffiliateCommissionQuery struct {
	Status     string
	Level      int
	PromoterId int
	BuyerId    int
	TradeNo    string
	StartTime  int64
	EndTime    int64
}

type AffiliateCommissionSummary struct {
	PendingAmountMicros       int64  `json:"pending_amount_micros"`
	SettledAmountMicros       int64  `json:"settled_amount_micros"`
	TotalAmountMicros         int64  `json:"total_amount_micros"`
	PendingPoints             int64  `json:"pending_points"`
	WalletRedeemedPoints      int64  `json:"wallet_redeemed_points"`
	OfflineSettledPoints      int64  `json:"offline_settled_points"`
	OfflineCashbackPoints     int64  `json:"offline_cashback_points"`
	SettledPoints             int64  `json:"settled_points"`
	RedeemedPoints            int64  `json:"redeemed_points"`
	TotalPoints               int64  `json:"total_points"`
	PendingCount              int64  `json:"pending_count"`
	SettledCount              int64  `json:"settled_count"`
	WalletRedeemedCount       int64  `json:"wallet_redeemed_count"`
	OfflineSettledCount       int64  `json:"offline_settled_count"`
	OfflineCashbackCount      int64  `json:"offline_cashback_count"`
	RedeemedCount             int64  `json:"redeemed_count"`
	TotalCount                int64  `json:"total_count"`
	PendingCashValueMicros    int64  `json:"pending_cash_value_micros"`
	PendingWalletQuota        int64  `json:"pending_wallet_quota"`
	PendingWalletAmountMicros int64  `json:"pending_wallet_amount_micros"`
	PricePerWalletUnitMicros  int64  `json:"price_per_wallet_unit_micros"`
	Currency                  string `json:"currency"`
}

type AffiliateRewardPointRedemptionResult struct {
	RedeemedPoints             int     `json:"redeemed_points"`
	RedeemedQuota              int     `json:"redeemed_quota"`
	RedeemedWalletAmount       float64 `json:"redeemed_wallet_amount"`
	RedeemedWalletAmountMicros int64   `json:"redeemed_wallet_amount_micros"`
	CashValueMicros            int64   `json:"cash_value_micros"`
	PricePerWalletUnitMicros   int64   `json:"price_per_wallet_unit_micros"`
}

type AffiliateRewardPointQuoteResult struct {
	RedeemablePoints           int     `json:"redeemable_points"`
	RedeemedQuota              int     `json:"redeemed_quota"`
	RedeemedWalletAmount       float64 `json:"redeemed_wallet_amount"`
	RedeemedWalletAmountMicros int64   `json:"redeemed_wallet_amount_micros"`
	CashValueMicros            int64   `json:"cash_value_micros"`
	PricePerWalletUnitMicros   int64   `json:"price_per_wallet_unit_micros"`
}

type AffiliateRewardPointOfflineCashbackResult struct {
	PromoterId int `json:"promoter_id"`
	Points     int `json:"points"`
}

type AffiliateRewardPointSettlementRecord struct {
	Id                 int    `json:"id"`
	CommissionId       int    `json:"commission_id"`
	PromoterId         int    `json:"promoter_id"`
	PromoterUsername   string `json:"promoter_username"`
	SettlementType     string `json:"settlement_type"`
	Points             int    `json:"points"`
	WalletQuota        int    `json:"wallet_quota"`
	WalletAmountMicros int64  `json:"wallet_amount_micros"`
	SettledBy          int    `json:"settled_by"`
	SettledByUsername  string `json:"settled_by_username"`
	SettledAt          int64  `json:"settled_at"`
	Remark             string `json:"remark"`
	TradeNo            string `json:"trade_no"`
	BuyerId            int    `json:"buyer_id"`
	BuyerUsername      string `json:"buyer_username"`
	Level              int    `json:"level"`
	CreatedAt          int64  `json:"created_at"`
	UpdatedAt          int64  `json:"updated_at"`
}

type AffiliateRewardPointSettlementQuery struct {
	PromoterId     int
	SettlementType string
	StartTime      int64
	EndTime        int64
}

type affiliateRewardPointQuote struct {
	RewardPoints                int64
	CashValueMicros             int64
	WalletQuota                 int64
	WalletAmountMicros          int64
	PricePerWalletUnitMicros    int64
	PointsPerAmountUnit         int
	OfflineAmountPerPointMicros int64
}

func normalizeAffiliatePayoutProfile(userId int, method string, account string, accountName string) (*AffiliatePayoutProfile, error) {
	method = strings.ToLower(strings.TrimSpace(method))
	if method == "" {
		method = AffiliatePayoutMethodPayPal
	}
	if method != AffiliatePayoutMethodPayPal {
		return nil, errors.New("暂仅支持 PayPal 收款方式")
	}
	account = strings.TrimSpace(account)
	accountName = strings.TrimSpace(accountName)
	if account == "" {
		return nil, errors.New("PayPal 收款邮箱不能为空")
	}
	parsed, err := mail.ParseAddress(account)
	if err != nil || !strings.EqualFold(parsed.Address, account) {
		return nil, errors.New("PayPal 收款邮箱格式无效")
	}
	account = strings.ToLower(parsed.Address)
	if len(account) > 255 {
		return nil, errors.New("PayPal 收款邮箱过长")
	}
	if len(accountName) > 255 {
		accountName = accountName[:255]
	}
	return &AffiliatePayoutProfile{
		UserId:      userId,
		Method:      method,
		Account:     account,
		AccountName: accountName,
	}, nil
}

func GetAffiliatePayoutProfile(userId int) (*AffiliatePayoutProfile, error) {
	if userId <= 0 {
		return nil, errors.New("用户 ID 参数无效")
	}
	var profile AffiliatePayoutProfile
	if err := DB.Where("user_id = ?", userId).First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &AffiliatePayoutProfile{
				UserId: userId,
				Method: AffiliatePayoutMethodPayPal,
			}, nil
		}
		return nil, err
	}
	return &profile, nil
}

func SaveAffiliatePayoutProfile(userId int, method string, account string, accountName string) (*AffiliatePayoutProfile, error) {
	if userId <= 0 {
		return nil, errors.New("用户 ID 参数无效")
	}
	profile, err := normalizeAffiliatePayoutProfile(userId, method, account, accountName)
	if err != nil {
		return nil, err
	}
	var existing AffiliatePayoutProfile
	if err := DB.Where("user_id = ?", userId).First(&existing).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, err
		}
		if err := DB.Create(profile).Error; err != nil {
			return nil, err
		}
		return profile, nil
	}
	existing.Method = profile.Method
	existing.Account = profile.Account
	existing.AccountName = profile.AccountName
	if err := DB.Save(&existing).Error; err != nil {
		return nil, err
	}
	return &existing, nil
}

func moneyToMicros(money float64) int64 {
	return decimal.NewFromFloat(money).
		Mul(decimal.NewFromInt(1000000)).
		Round(0).
		IntPart()
}

func commissionMicros(baseAmountMicros int64, rateBps int) int64 {
	if baseAmountMicros <= 0 || rateBps <= 0 {
		return 0
	}
	return decimal.NewFromInt(baseAmountMicros).
		Mul(decimal.NewFromInt(int64(rateBps))).
		Div(decimal.NewFromInt(10000)).
		Round(0).
		IntPart()
}

func affiliateRewardPoints(baseAmountMicros int64, rateBps int) int {
	return affiliateRewardPointsWithConfig(baseAmountMicros, rateBps, operation_setting.GetDistributionSetting().PointsPerAmountUnit)
}

func quotaToWalletAmountMicros(quota int) int64 {
	if quota <= 0 {
		return 0
	}
	return decimal.NewFromInt(int64(quota)).
		Mul(decimal.NewFromInt(1000000)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Round(0).
		IntPart()
}

func affiliateRewardPointsFromQuota(baseQuota int, rateBps int) int {
	if baseQuota <= 0 || rateBps <= 0 {
		return 0
	}
	points := decimal.NewFromInt(int64(baseQuota)).
		Mul(decimal.NewFromInt(int64(rateBps))).
		Div(decimal.NewFromInt(10000)).
		Div(decimal.NewFromFloat(common.QuotaPerUnit)).
		Round(0).
		IntPart()
	if points <= 0 {
		return 0
	}
	return int(points)
}

func affiliateRewardPointsWithConfig(baseAmountMicros int64, rateBps int, pointsPerAmountUnit int) int {
	if baseAmountMicros <= 0 || rateBps <= 0 {
		return 0
	}
	if pointsPerAmountUnit <= 0 {
		pointsPerAmountUnit = operation_setting.DefaultDistributionPointsPerAmountUnit
	}
	points := decimal.NewFromInt(baseAmountMicros).
		Mul(decimal.NewFromInt(int64(rateBps))).
		Mul(decimal.NewFromInt(int64(pointsPerAmountUnit))).
		Div(decimal.NewFromInt(10000)).
		Div(decimal.NewFromInt(1000000)).
		Round(0).
		IntPart()
	if points <= 0 {
		return 0
	}
	return int(points)
}

func rewardPointCashValueMicros(points int64) int64 {
	if points <= 0 {
		return 0
	}
	setting := operation_setting.GetDistributionSetting()
	amountPerPointMicros := setting.OfflineAmountPerPointMicros
	if amountPerPointMicros <= 0 {
		amountPerPointMicros = operation_setting.DefaultDistributionOfflineAmountPerPointMicros
	}
	return points * amountPerPointMicros
}

func currentWalletPriceMicros() int64 {
	return moneyToMicros(operation_setting.Price)
}

func quoteAffiliateRewardPoints(points int64) (affiliateRewardPointQuote, error) {
	if points <= 0 {
		return affiliateRewardPointQuote{}, errors.New("暂无可兑换的奖励积分")
	}
	walletAmountMicros := points * 1000000
	walletQuota := decimal.NewFromInt(points).
		Mul(decimal.NewFromFloat(common.QuotaPerUnit)).
		Round(0).
		IntPart()
	if walletQuota <= 0 {
		return affiliateRewardPointQuote{}, errors.New("奖励积分兑换额度过低")
	}

	return affiliateRewardPointQuote{
		RewardPoints:                points,
		CashValueMicros:             0,
		WalletQuota:                 walletQuota,
		WalletAmountMicros:          walletAmountMicros,
		PricePerWalletUnitMicros:    0,
		PointsPerAmountUnit:         0,
		OfflineAmountPerPointMicros: 0,
	}, nil
}

func pendingAffiliateRewardPoints(commission AffiliateCommission) int {
	pendingPoints := commission.RewardPoints - commission.SettledPoints
	if pendingPoints <= 0 {
		return 0
	}
	return pendingPoints
}

func affiliateQuoteToResult(points int, quote affiliateRewardPointQuote) AffiliateRewardPointQuoteResult {
	redeemedQuota := 0
	if quote.WalletQuota > 0 && quote.WalletQuota <= int64(int(^uint(0)>>1)) {
		redeemedQuota = int(quote.WalletQuota)
	}
	return AffiliateRewardPointQuoteResult{
		RedeemablePoints:           points,
		RedeemedQuota:              redeemedQuota,
		RedeemedWalletAmount:       decimal.NewFromInt(quote.WalletAmountMicros).Div(decimal.NewFromInt(1000000)).InexactFloat64(),
		RedeemedWalletAmountMicros: quote.WalletAmountMicros,
		CashValueMicros:            quote.CashValueMicros,
		PricePerWalletUnitMicros:   quote.PricePerWalletUnitMicros,
	}
}

func redeemResultFromQuoteResult(quoteResult AffiliateRewardPointQuoteResult) AffiliateRewardPointRedemptionResult {
	return AffiliateRewardPointRedemptionResult{
		RedeemedPoints:             quoteResult.RedeemablePoints,
		RedeemedQuota:              quoteResult.RedeemedQuota,
		RedeemedWalletAmount:       quoteResult.RedeemedWalletAmount,
		RedeemedWalletAmountMicros: quoteResult.RedeemedWalletAmountMicros,
		CashValueMicros:            quoteResult.CashValueMicros,
		PricePerWalletUnitMicros:   quoteResult.PricePerWalletUnitMicros,
	}
}

func CreateTopUpCommissionsWithTx(tx *gorm.DB, topUp *TopUp, baseQuota int) error {
	if tx == nil || topUp == nil {
		return nil
	}
	setting := operation_setting.GetDistributionSetting()
	if !setting.Enabled {
		return nil
	}
	if baseQuota <= 0 {
		return nil
	}

	baseAmountMicros := quotaToWalletAmountMicros(baseQuota)
	if baseAmountMicros <= 0 {
		return nil
	}

	var buyer User
	if err := tx.Where("id = ?", topUp.UserId).First(&buyer).Error; err != nil {
		return err
	}
	if buyer.InviterId == 0 {
		return nil
	}

	var level1Promoter User
	if err := tx.Where("id = ?", buyer.InviterId).First(&level1Promoter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	currency := operation_setting.NormalizeDistributionCurrency(setting.Currency)
	if err := createTopUpCommissionForPromoter(tx, topUp, &buyer, &level1Promoter, AffiliateCommissionLevel1, setting.Level1RateBps, baseAmountMicros, baseQuota, currency, 0); err != nil {
		return err
	}

	if level1Promoter.InviterId == 0 {
		return nil
	}

	var level2Promoter User
	if err := tx.Where("id = ?", level1Promoter.InviterId).First(&level2Promoter).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}

	return createTopUpCommissionForPromoter(tx, topUp, &buyer, &level2Promoter, AffiliateCommissionLevel2, setting.Level2RateBps, baseAmountMicros, baseQuota, currency, level1Promoter.Id)
}

func createTopUpCommissionForPromoter(tx *gorm.DB, topUp *TopUp, buyer *User, promoter *User, level int, rateBps int, baseAmountMicros int64, baseQuota int, currency string, excludedPromoterId int) error {
	if rateBps <= 0 || buyer == nil || promoter == nil {
		return nil
	}
	if promoter.Id == 0 || promoter.Id == buyer.Id || promoter.Id == excludedPromoterId {
		return nil
	}
	if promoter.Status != common.UserStatusEnabled || !promoter.DistributionEnabled {
		return nil
	}
	amountMicros := commissionMicros(baseAmountMicros, rateBps)
	if amountMicros <= 0 {
		return nil
	}
	rewardPoints := affiliateRewardPointsFromQuota(baseQuota, rateBps)
	if rewardPoints <= 0 {
		return nil
	}

	commission := &AffiliateCommission{
		TradeNo:                topUp.TradeNo,
		TopUpId:                topUp.Id,
		BuyerId:                buyer.Id,
		PromoterId:             promoter.Id,
		Level:                  level,
		BaseAmountMicros:       baseAmountMicros,
		CommissionRateBps:      rateBps,
		CommissionAmountMicros: amountMicros,
		BaseQuota:              baseQuota,
		RewardPoints:           rewardPoints,
		Currency:               currency,
		PaymentProvider:        topUp.PaymentProvider,
		PaymentMethod:          topUp.PaymentMethod,
		Status:                 AffiliateCommissionStatusPending,
	}
	return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(commission).Error
}

func buildAffiliateCommissionQuery(db *gorm.DB, query AffiliateCommissionQuery) *gorm.DB {
	if query.Status != "" {
		db = db.Where("affiliate_commissions.status = ?", query.Status)
	}
	if query.Level > 0 {
		db = db.Where("affiliate_commissions.level = ?", query.Level)
	}
	if query.PromoterId > 0 {
		db = db.Where("affiliate_commissions.promoter_id = ?", query.PromoterId)
	}
	if query.BuyerId > 0 {
		db = db.Where("affiliate_commissions.buyer_id = ?", query.BuyerId)
	}
	if strings.TrimSpace(query.TradeNo) != "" {
		db = db.Where("affiliate_commissions.trade_no = ?", strings.TrimSpace(query.TradeNo))
	}
	if query.StartTime > 0 {
		db = db.Where("affiliate_commissions.created_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		db = db.Where("affiliate_commissions.created_at <= ?", query.EndTime)
	}
	return db
}

func ListAffiliateCommissions(query AffiliateCommissionQuery, pageInfo *common.PageInfo) (records []*AffiliateCommissionRecord, total int64, err error) {
	db := buildAffiliateCommissionQuery(DB.Model(&AffiliateCommission{}), query)
	if err = db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	selectQuery := buildAffiliateCommissionQuery(DB.Model(&AffiliateCommission{}), query).
		Select(strings.Join([]string{
			"affiliate_commissions.*",
			"buyer.username AS buyer_username",
			"promoter.username AS promoter_username",
			"promoter_payout.method AS promoter_payout_method",
			"promoter_payout.account AS promoter_payout_account",
			"promoter_payout.account_name AS promoter_payout_account_name",
			"direct_inviter.id AS buyer_direct_inviter_id",
			"direct_inviter.username AS buyer_direct_inviter_username",
			"direct_inviter.distribution_enabled AS buyer_direct_inviter_distribution_enabled",
			"second_inviter.id AS buyer_second_inviter_id",
			"second_inviter.username AS buyer_second_inviter_username",
			"second_inviter.distribution_enabled AS buyer_second_inviter_distribution_enabled",
			"settler.username AS settled_by_username",
		}, ", ")).
		Joins("LEFT JOIN users AS buyer ON buyer.id = affiliate_commissions.buyer_id").
		Joins("LEFT JOIN users AS direct_inviter ON direct_inviter.id = buyer.inviter_id").
		Joins("LEFT JOIN users AS second_inviter ON second_inviter.id = direct_inviter.inviter_id").
		Joins("LEFT JOIN users AS promoter ON promoter.id = affiliate_commissions.promoter_id").
		Joins("LEFT JOIN affiliate_payout_profiles AS promoter_payout ON promoter_payout.user_id = affiliate_commissions.promoter_id").
		Joins("LEFT JOIN users AS settler ON settler.id = affiliate_commissions.settled_by").
		Order("affiliate_commissions.id desc")
	if pageInfo != nil {
		selectQuery = selectQuery.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx())
	}
	err = selectQuery.Scan(&records).Error
	if err == nil {
		enrichAffiliateCommissionRecords(records)
	}
	return records, total, err
}

func enrichAffiliateCommissionRecords(records []*AffiliateCommissionRecord) {
	for _, record := range records {
		if record == nil {
			continue
		}
		pendingPoints := pendingAffiliateRewardPoints(record.AffiliateCommission)
		record.PendingPoints = pendingPoints
		record.OfflineCashbackPoints = record.OfflineSettledPoints
		switch record.Status {
		case AffiliateCommissionStatusSettled:
			record.CashValueMicros = 0
			record.WalletQuota = int64(record.SettledWalletQuota)
			record.WalletAmountMicros = record.SettledWalletAmountMicros
			record.PricePerWalletUnitMicros = 0
		default:
			record.CashValueMicros = 0
			if quote, err := quoteAffiliateRewardPoints(int64(pendingPoints)); err == nil {
				record.WalletQuota = quote.WalletQuota
				record.WalletAmountMicros = quote.WalletAmountMicros
				record.PricePerWalletUnitMicros = quote.PricePerWalletUnitMicros
			} else {
				record.PricePerWalletUnitMicros = 0
			}
		}
	}
}

func ExportAffiliateCommissions(query AffiliateCommissionQuery, limit int) (records []*AffiliateCommissionRecord, err error) {
	if limit <= 0 || limit > 50000 {
		limit = 50000
	}
	records, _, err = ListAffiliateCommissions(query, &common.PageInfo{Page: 1, PageSize: limit})
	return records, err
}

func buildAffiliateRewardPointSettlementQuery(db *gorm.DB, query AffiliateRewardPointSettlementQuery) *gorm.DB {
	if query.PromoterId > 0 {
		db = db.Where("affiliate_commission_settlements.promoter_id = ?", query.PromoterId)
	}
	if strings.TrimSpace(query.SettlementType) != "" {
		db = db.Where("affiliate_commission_settlements.settlement_type = ?", strings.TrimSpace(query.SettlementType))
	}
	if query.StartTime > 0 {
		db = db.Where("affiliate_commission_settlements.settled_at >= ?", query.StartTime)
	}
	if query.EndTime > 0 {
		db = db.Where("affiliate_commission_settlements.settled_at <= ?", query.EndTime)
	}
	return db
}

func ListAffiliateRewardPointSettlements(query AffiliateRewardPointSettlementQuery, pageInfo *common.PageInfo) (records []*AffiliateRewardPointSettlementRecord, total int64, err error) {
	db := buildAffiliateRewardPointSettlementQuery(DB.Model(&AffiliateCommissionSettlement{}), query)
	if err = db.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	selectQuery := buildAffiliateRewardPointSettlementQuery(DB.Model(&AffiliateCommissionSettlement{}), query).
		Select(strings.Join([]string{
			"affiliate_commission_settlements.id",
			"affiliate_commission_settlements.commission_id",
			"affiliate_commission_settlements.promoter_id",
			"promoter.username AS promoter_username",
			"affiliate_commission_settlements.settlement_type",
			"affiliate_commission_settlements.settled_points AS points",
			"affiliate_commission_settlements.wallet_quota",
			"affiliate_commission_settlements.wallet_amount_micros",
			"affiliate_commission_settlements.settled_by",
			"settler.username AS settled_by_username",
			"affiliate_commission_settlements.settled_at",
			"affiliate_commission_settlements.remark",
			"affiliate_commissions.trade_no",
			"affiliate_commissions.buyer_id",
			"buyer.username AS buyer_username",
			"affiliate_commissions.level",
			"affiliate_commission_settlements.created_at",
			"affiliate_commission_settlements.updated_at",
		}, ", ")).
		Joins("LEFT JOIN affiliate_commissions ON affiliate_commissions.id = affiliate_commission_settlements.commission_id").
		Joins("LEFT JOIN users AS promoter ON promoter.id = affiliate_commission_settlements.promoter_id").
		Joins("LEFT JOIN users AS buyer ON buyer.id = affiliate_commissions.buyer_id").
		Joins("LEFT JOIN users AS settler ON settler.id = affiliate_commission_settlements.settled_by").
		Order("affiliate_commission_settlements.id desc")
	if pageInfo != nil {
		selectQuery = selectQuery.Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx())
	}
	err = selectQuery.Scan(&records).Error
	return records, total, err
}

func GetAffiliateCommissionSummary(query AffiliateCommissionQuery) (AffiliateCommissionSummary, error) {
	var commissions []AffiliateCommission
	if err := buildAffiliateCommissionQuery(DB.Model(&AffiliateCommission{}), query).Find(&commissions).Error; err != nil {
		return AffiliateCommissionSummary{}, err
	}

	summary := AffiliateCommissionSummary{
		Currency: operation_setting.NormalizeDistributionCurrency(operation_setting.GetDistributionSetting().Currency),
	}
	for _, commission := range commissions {
		pendingPoints := pendingAffiliateRewardPoints(commission)
		summary.TotalPoints += int64(commission.RewardPoints)
		summary.SettledPoints += int64(commission.SettledPoints)
		summary.WalletRedeemedPoints += int64(commission.WalletRedeemedPoints)
		summary.OfflineSettledPoints += int64(commission.OfflineSettledPoints)
		summary.OfflineCashbackPoints += int64(commission.OfflineSettledPoints)
		summary.TotalCount++
		if pendingPoints > 0 {
			summary.PendingPoints += int64(pendingPoints)
			summary.PendingCount++
		}
		if commission.SettledPoints > 0 && pendingPoints == 0 {
			summary.SettledCount++
		}
		if commission.SettledPoints > 0 {
			summary.RedeemedCount++
		}
		if commission.WalletRedeemedPoints > 0 {
			summary.WalletRedeemedCount++
		}
		if commission.OfflineSettledPoints > 0 {
			summary.OfflineSettledCount++
			summary.OfflineCashbackCount++
		}
	}
	summary.RedeemedPoints = summary.SettledPoints
	summary.PendingAmountMicros = 0
	summary.SettledAmountMicros = 0
	summary.TotalAmountMicros = 0
	summary.PendingCashValueMicros = 0
	if quote, err := quoteAffiliateRewardPoints(summary.PendingPoints); err == nil {
		summary.PendingWalletQuota = quote.WalletQuota
		summary.PendingWalletAmountMicros = quote.WalletAmountMicros
		summary.PricePerWalletUnitMicros = quote.PricePerWalletUnitMicros
	} else {
		summary.PricePerWalletUnitMicros = 0
	}
	return summary, nil
}

func normalizeAffiliateCommissionIds(ids []int) ([]int, error) {
	uniqueIds := make([]int, 0, len(ids))
	seen := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return nil, errors.New("奖励积分记录 ID 参数无效")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIds = append(uniqueIds, id)
	}
	return uniqueIds, nil
}

func quoteAffiliateRewardPointRedemption(userId int, ids []int, points *int) (AffiliateRewardPointQuoteResult, error) {
	if userId <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("用户 ID 参数无效")
	}
	uniqueIds, err := normalizeAffiliateCommissionIds(ids)
	if err != nil {
		return AffiliateRewardPointQuoteResult{}, err
	}
	if points != nil && *points <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("兑换积分必须大于 0")
	}

	var commissions []AffiliateCommission
	query := DB.Where("promoter_id = ? AND status = ?", userId, AffiliateCommissionStatusPending).
		Order("created_at asc, id asc")
	if len(uniqueIds) > 0 {
		query = query.Where("id IN ?", uniqueIds)
	}
	if err := query.Find(&commissions).Error; err != nil {
		return AffiliateRewardPointQuoteResult{}, err
	}
	if len(uniqueIds) > 0 && len(commissions) != len(uniqueIds) {
		return AffiliateRewardPointQuoteResult{}, errors.New("部分奖励积分记录不存在或不可兑换")
	}

	totalAvailablePoints := 0
	for _, commission := range commissions {
		totalAvailablePoints += pendingAffiliateRewardPoints(commission)
	}
	if totalAvailablePoints <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("暂无可兑换的奖励积分")
	}

	redeemPoints := totalAvailablePoints
	if points != nil {
		redeemPoints = *points
	}
	if redeemPoints > totalAvailablePoints {
		return AffiliateRewardPointQuoteResult{}, errors.New("兑换积分不能超过当前待兑换积分")
	}

	quote, err := quoteAffiliateRewardPoints(int64(redeemPoints))
	if err != nil {
		return AffiliateRewardPointQuoteResult{}, err
	}
	if quote.WalletQuota > int64(int(^uint(0)>>1)) {
		return AffiliateRewardPointQuoteResult{}, errors.New("奖励积分兑换额度过大")
	}
	return affiliateQuoteToResult(redeemPoints, quote), nil
}

func QuoteAffiliateRewardPointRedemption(userId int, points int) (AffiliateRewardPointQuoteResult, error) {
	return quoteAffiliateRewardPointRedemption(userId, nil, &points)
}

func consumeAffiliateRewardPointsWithTx(tx *gorm.DB, userId int, uniqueIds []int, requestedPoints *int, settlementType string, settledBy int, remark string) (AffiliateRewardPointQuoteResult, error) {
	if userId <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("用户 ID 参数无效")
	}
	if requestedPoints != nil && *requestedPoints <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("兑换积分必须大于 0")
	}
	if settlementType != AffiliateCommissionSettlementTypeWallet && settlementType != AffiliateCommissionSettlementTypeOfflineCashback {
		return AffiliateRewardPointQuoteResult{}, errors.New("奖励积分处理方式无效")
	}
	if strings.TrimSpace(remark) == "" {
		remark = settlementType
	}
	if len(remark) > 255 {
		remark = remark[:255]
	}

	var commissions []AffiliateCommission
	query := tx.Set("gorm:query_option", "FOR UPDATE").
		Where("promoter_id = ? AND status = ?", userId, AffiliateCommissionStatusPending).
		Order("created_at asc, id asc")
	if len(uniqueIds) > 0 {
		query = query.Where("id IN ?", uniqueIds)
	}
	if err := query.Find(&commissions).Error; err != nil {
		return AffiliateRewardPointQuoteResult{}, err
	}
	if len(uniqueIds) > 0 && len(commissions) != len(uniqueIds) {
		return AffiliateRewardPointQuoteResult{}, errors.New("部分奖励积分记录不存在或不可兑换")
	}

	totalAvailablePoints := 0
	for _, commission := range commissions {
		totalAvailablePoints += pendingAffiliateRewardPoints(commission)
	}
	if totalAvailablePoints <= 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("暂无可兑换的奖励积分")
	}

	redeemPoints := totalAvailablePoints
	if requestedPoints != nil {
		redeemPoints = *requestedPoints
	}
	if redeemPoints > totalAvailablePoints {
		return AffiliateRewardPointQuoteResult{}, errors.New("兑换积分不能超过当前待兑换积分")
	}

	quote, err := quoteAffiliateRewardPoints(int64(redeemPoints))
	if err != nil {
		return AffiliateRewardPointQuoteResult{}, err
	}
	if quote.WalletQuota > int64(int(^uint(0)>>1)) {
		return AffiliateRewardPointQuoteResult{}, errors.New("奖励积分兑换额度过大")
	}
	quoteResult := affiliateQuoteToResult(redeemPoints, quote)
	if settlementType == AffiliateCommissionSettlementTypeWallet {
		if err := tx.Model(&User{}).
			Where("id = ?", userId).
			Update("quota", gorm.Expr("quota + ?", quoteResult.RedeemedQuota)).Error; err != nil {
			return AffiliateRewardPointQuoteResult{}, err
		}
	} else {
		var user User
		if err := tx.Select("id").Where("id = ?", userId).First(&user).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return AffiliateRewardPointQuoteResult{}, errors.New("用户不存在")
			}
			return AffiliateRewardPointQuoteResult{}, err
		}
		quoteResult.RedeemedQuota = 0
		quoteResult.RedeemedWalletAmount = 0
		quoteResult.RedeemedWalletAmountMicros = 0
	}

	settledAt := common.GetTimestamp()
	remainingPoints := redeemPoints
	for _, commission := range commissions {
		if remainingPoints <= 0 {
			break
		}
		pendingPoints := pendingAffiliateRewardPoints(commission)
		if pendingPoints <= 0 {
			continue
		}
		pointsToSettle := pendingPoints
		if pointsToSettle > remainingPoints {
			pointsToSettle = remainingPoints
		}
		commissionQuote, err := quoteAffiliateRewardPoints(int64(pointsToSettle))
		if err != nil {
			return AffiliateRewardPointQuoteResult{}, err
		}
		if commissionQuote.WalletQuota > int64(int(^uint(0)>>1)) {
			return AffiliateRewardPointQuoteResult{}, errors.New("奖励积分兑换额度过大")
		}
		walletQuota := 0
		walletAmountMicros := int64(0)
		if settlementType == AffiliateCommissionSettlementTypeWallet {
			walletQuota = int(commissionQuote.WalletQuota)
			walletAmountMicros = commissionQuote.WalletAmountMicros
		}
		nextSettledPoints := commission.SettledPoints + pointsToSettle
		nextStatus := AffiliateCommissionStatusPending
		if nextSettledPoints >= commission.RewardPoints {
			nextStatus = AffiliateCommissionStatusSettled
		}
		updates := map[string]interface{}{
			"status":                                  nextStatus,
			"settlement_type":                         settlementType,
			"settled_at":                              settledAt,
			"settled_by":                              settledBy,
			"settle_remark":                           remark,
			"settled_points":                          gorm.Expr("settled_points + ?", pointsToSettle),
			"settled_cash_value_micros":               gorm.Expr("settled_cash_value_micros + ?", int64(0)),
			"settled_price_per_wallet_unit_micros":    0,
			"settled_points_per_amount_unit":          0,
			"settled_offline_amount_per_point_micros": 0,
		}
		if settlementType == AffiliateCommissionSettlementTypeWallet {
			updates["wallet_redeemed_points"] = gorm.Expr("wallet_redeemed_points + ?", pointsToSettle)
			updates["settled_wallet_quota"] = gorm.Expr("settled_wallet_quota + ?", walletQuota)
			updates["settled_wallet_amount_micros"] = gorm.Expr("settled_wallet_amount_micros + ?", walletAmountMicros)
		} else {
			updates["offline_settled_points"] = gorm.Expr("offline_settled_points + ?", pointsToSettle)
		}
		result := tx.Model(&AffiliateCommission{}).
			Where("id = ? AND status = ?", commission.Id, AffiliateCommissionStatusPending).
			Updates(updates)
		if result.Error != nil {
			return AffiliateRewardPointQuoteResult{}, result.Error
		}
		if result.RowsAffected != 1 {
			return AffiliateRewardPointQuoteResult{}, errors.New("部分奖励积分记录已被处理，请刷新后重试")
		}
		if err := tx.Create(&AffiliateCommissionSettlement{
			CommissionId:                commission.Id,
			PromoterId:                  userId,
			SettlementType:              settlementType,
			SettledPoints:               pointsToSettle,
			CashValueMicros:             0,
			WalletQuota:                 walletQuota,
			WalletAmountMicros:          walletAmountMicros,
			PricePerWalletUnitMicros:    0,
			PointsPerAmountUnit:         0,
			OfflineAmountPerPointMicros: 0,
			SettledBy:                   settledBy,
			SettledAt:                   settledAt,
			Remark:                      remark,
		}).Error; err != nil {
			return AffiliateRewardPointQuoteResult{}, err
		}
		remainingPoints -= pointsToSettle
	}

	if remainingPoints != 0 {
		return AffiliateRewardPointQuoteResult{}, errors.New("奖励积分兑换处理异常，请刷新后重试")
	}
	return quoteResult, nil
}

func RedeemAffiliateRewardPoints(userId int, ids []int, points ...int) (AffiliateRewardPointRedemptionResult, error) {
	var requestedPoints *int
	if len(points) > 0 {
		requestedPoints = &points[0]
	}
	uniqueIds, err := normalizeAffiliateCommissionIds(ids)
	if err != nil {
		return AffiliateRewardPointRedemptionResult{}, err
	}

	var redemption AffiliateRewardPointRedemptionResult
	err = DB.Transaction(func(tx *gorm.DB) error {
		quoteResult, err := consumeAffiliateRewardPointsWithTx(tx, userId, uniqueIds, requestedPoints, AffiliateCommissionSettlementTypeWallet, userId, "redeemed to wallet")
		if err != nil {
			return err
		}
		redemption = redeemResultFromQuoteResult(quoteResult)
		return nil
	})
	if err != nil {
		return AffiliateRewardPointRedemptionResult{}, err
	}
	RecordLog(userId, LogTypeSystem, fmt.Sprintf("充值奖励积分兑换到钱包：%d 点，到账额度 %d", redemption.RedeemedPoints, redemption.RedeemedQuota))
	return redemption, nil
}

func OfflineCashbackAffiliateRewardPoints(promoterId int, points int, settledBy int, remark string) (AffiliateRewardPointOfflineCashbackResult, error) {
	if promoterId <= 0 {
		return AffiliateRewardPointOfflineCashbackResult{}, errors.New("用户 ID 参数无效")
	}
	if points <= 0 {
		return AffiliateRewardPointOfflineCashbackResult{}, errors.New("线下返现积分必须大于 0")
	}
	requestedPoints := points
	err := DB.Transaction(func(tx *gorm.DB) error {
		_, err := consumeAffiliateRewardPointsWithTx(tx, promoterId, nil, &requestedPoints, AffiliateCommissionSettlementTypeOfflineCashback, settledBy, remark)
		return err
	})
	if err != nil {
		return AffiliateRewardPointOfflineCashbackResult{}, err
	}
	RecordLog(promoterId, LogTypeSystem, fmt.Sprintf("管理员记录线下返现扣除充值奖励积分：%d 点", points))
	return AffiliateRewardPointOfflineCashbackResult{PromoterId: promoterId, Points: points}, nil
}

func SettleAffiliateCommissions(ids []int, settledBy int, remark string) error {
	uniqueIds, err := normalizeAffiliateCommissionIds(ids)
	if err != nil {
		return err
	}
	if len(uniqueIds) == 0 {
		return errors.New("请选择要结算的奖励积分记录")
	}
	if len(remark) > 255 {
		remark = remark[:255]
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var commissions []AffiliateCommission
		if err := tx.Set("gorm:query_option", "FOR UPDATE").
			Where("id IN ?", uniqueIds).
			Order("created_at asc, id asc").
			Find(&commissions).Error; err != nil {
			return err
		}
		if len(commissions) != len(uniqueIds) {
			return errors.New("部分奖励积分记录不存在")
		}

		type promoterSettlement struct {
			ids    []int
			points int
		}
		settlementsByPromoter := make(map[int]*promoterSettlement)
		for _, commission := range commissions {
			if commission.Status != AffiliateCommissionStatusPending {
				return errors.New("只能结算待处理状态的奖励积分记录")
			}
			pendingPoints := pendingAffiliateRewardPoints(commission)
			if pendingPoints <= 0 {
				return errors.New("只能结算有剩余积分的奖励积分记录")
			}
			settlement := settlementsByPromoter[commission.PromoterId]
			if settlement == nil {
				settlement = &promoterSettlement{}
				settlementsByPromoter[commission.PromoterId] = settlement
			}
			settlement.ids = append(settlement.ids, commission.Id)
			settlement.points += pendingPoints
		}

		for promoterId, settlement := range settlementsByPromoter {
			requestedPoints := settlement.points
			if _, err := consumeAffiliateRewardPointsWithTx(
				tx,
				promoterId,
				settlement.ids,
				&requestedPoints,
				AffiliateCommissionSettlementTypeOfflineCashback,
				settledBy,
				remark,
			); err != nil {
				return err
			}
		}
		return nil
	})
}

func migrateAffiliateCommissionRewardPoints() error {
	if !DB.Migrator().HasTable(&AffiliateCommission{}) ||
		!DB.Migrator().HasTable(&TopUp{}) ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "reward_points") ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "base_quota") {
		return nil
	}

	var commissions []AffiliateCommission
	if err := DB.Where("status = ? OR reward_points = ? OR base_quota = ?", AffiliateCommissionStatusPending, 0, 0).Find(&commissions).Error; err != nil {
		return err
	}
	for _, commission := range commissions {
		var topUp TopUp
		query := DB
		if commission.TopUpId > 0 {
			query = query.Where("id = ?", commission.TopUpId)
		} else {
			query = query.Where("trade_no = ?", commission.TradeNo)
		}
		if err := query.First(&topUp).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return err
		}
		baseQuota := creditedQuotaFromTopUp(&topUp)
		baseAmountMicros := commission.BaseAmountMicros
		if baseAmountMicros <= 0 {
			baseAmountMicros = quotaToWalletAmountMicros(baseQuota)
		}
		rewardPoints := affiliateRewardPointsFromQuota(baseQuota, commission.CommissionRateBps)
		updates := map[string]interface{}{}
		if commission.BaseQuota == 0 && baseQuota > 0 {
			updates["base_quota"] = baseQuota
		}
		if commission.BaseAmountMicros == 0 && baseAmountMicros > 0 {
			updates["base_amount_micros"] = baseAmountMicros
		}
		if commission.Status == AffiliateCommissionStatusPending && commission.RewardPoints == 0 && rewardPoints > 0 {
			updates["reward_points"] = rewardPoints
		}
		if len(updates) == 0 {
			continue
		}
		if err := DB.Model(&AffiliateCommission{}).Where("id = ?", commission.Id).Updates(updates).Error; err != nil {
			return err
		}
	}
	return nil
}

func migrateLegacyAffiliateWalletRedemptions() error {
	if !DB.Migrator().HasTable(&AffiliateCommission{}) ||
		!DB.Migrator().HasTable(&User{}) ||
		!DB.Migrator().HasTable(&Option{}) ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "settled_wallet_quota") {
		return nil
	}

	var marker Option
	if err := DB.Where("key = ?", legacyAffiliateWalletRedemptionRollbackMigrationKey).First(&marker).Error; err == nil {
		return nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}

	var commissions []AffiliateCommission
	if err := DB.Where(
		"status = ? AND settlement_type = ? AND settled_wallet_quota = ? AND reward_points > ?",
		AffiliateCommissionStatusSettled,
		AffiliateCommissionSettlementTypeWallet,
		0,
		0,
	).Find(&commissions).Error; err != nil {
		return err
	}

	for _, commission := range commissions {
		oldQuotaAdded := commission.RewardPoints
		if oldQuotaAdded <= 0 {
			continue
		}
		err := DB.Transaction(func(tx *gorm.DB) error {
			userResult := tx.Model(&User{}).
				Where("id = ? AND quota >= ?", commission.PromoterId, oldQuotaAdded).
				Update("quota", gorm.Expr("quota - ?", oldQuotaAdded))
			if userResult.Error != nil {
				return userResult.Error
			}
			if userResult.RowsAffected != 1 {
				common.SysLog(fmt.Sprintf("skip legacy affiliate wallet redemption rollback: commission_id=%d promoter_id=%d old_quota=%d", commission.Id, commission.PromoterId, oldQuotaAdded))
				return nil
			}

			result := tx.Model(&AffiliateCommission{}).
				Where("id = ? AND status = ? AND settlement_type = ? AND settled_wallet_quota = ?", commission.Id, AffiliateCommissionStatusSettled, AffiliateCommissionSettlementTypeWallet, 0).
				Updates(map[string]interface{}{
					"status":                                  AffiliateCommissionStatusPending,
					"settlement_type":                         "",
					"settled_at":                              0,
					"settled_by":                              0,
					"settle_remark":                           "",
					"settled_points":                          0,
					"wallet_redeemed_points":                  0,
					"offline_settled_points":                  0,
					"settled_cash_value_micros":               0,
					"settled_wallet_quota":                    0,
					"settled_wallet_amount_micros":            0,
					"settled_price_per_wallet_unit_micros":    0,
					"settled_points_per_amount_unit":          0,
					"settled_offline_amount_per_point_micros": 0,
				})
			if result.Error != nil {
				return result.Error
			}
			if result.RowsAffected == 1 {
				common.SysLog(fmt.Sprintf("rolled back legacy affiliate wallet redemption: commission_id=%d promoter_id=%d old_quota=%d", commission.Id, commission.PromoterId, oldQuotaAdded))
			}
			return nil
		})
		if err != nil {
			return err
		}
	}
	if err := DB.Create(&Option{
		Key:   legacyAffiliateWalletRedemptionRollbackMigrationKey,
		Value: "done",
	}).Error; err != nil {
		return err
	}
	return nil
}

func migrateAffiliateCommissionSettlements() error {
	if !DB.Migrator().HasTable(&AffiliateCommission{}) ||
		!DB.Migrator().HasTable(&AffiliateCommissionSettlement{}) ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "settled_points") ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "wallet_redeemed_points") ||
		!DB.Migrator().HasColumn(&AffiliateCommission{}, "offline_settled_points") {
		return nil
	}

	var commissions []AffiliateCommission
	if err := DB.Where("status = ? AND reward_points > ? AND settled_points = ?", AffiliateCommissionStatusSettled, 0, 0).Find(&commissions).Error; err != nil {
		return err
	}
	for _, commission := range commissions {
		settlementType := commission.SettlementType
		if settlementType != AffiliateCommissionSettlementTypeWallet {
			settlementType = AffiliateCommissionSettlementTypeOfflineCashback
		}
		walletPoints := 0
		offlinePoints := commission.RewardPoints
		if settlementType == AffiliateCommissionSettlementTypeWallet {
			walletPoints = commission.RewardPoints
			offlinePoints = 0
		}

		err := DB.Transaction(func(tx *gorm.DB) error {
			updates := map[string]interface{}{
				"settled_points":         commission.RewardPoints,
				"wallet_redeemed_points": walletPoints,
				"offline_settled_points": offlinePoints,
				"settlement_type":        settlementType,
			}
			if commission.SettledCashValueMicros <= 0 {
				updates["settled_cash_value_micros"] = rewardPointCashValueMicros(int64(commission.RewardPoints))
			}
			if err := tx.Model(&AffiliateCommission{}).Where("id = ?", commission.Id).Updates(updates).Error; err != nil {
				return err
			}

			var settlementCount int64
			if err := tx.Model(&AffiliateCommissionSettlement{}).Where("commission_id = ?", commission.Id).Count(&settlementCount).Error; err != nil {
				return err
			}
			if settlementCount > 0 {
				return nil
			}

			cashValueMicros := commission.SettledCashValueMicros
			if cashValueMicros <= 0 {
				cashValueMicros = rewardPointCashValueMicros(int64(commission.RewardPoints))
			}
			settlement := &AffiliateCommissionSettlement{
				CommissionId:                commission.Id,
				PromoterId:                  commission.PromoterId,
				SettlementType:              settlementType,
				SettledPoints:               commission.RewardPoints,
				CashValueMicros:             cashValueMicros,
				WalletQuota:                 commission.SettledWalletQuota,
				WalletAmountMicros:          commission.SettledWalletAmountMicros,
				PricePerWalletUnitMicros:    commission.SettledPricePerWalletUnitMicros,
				PointsPerAmountUnit:         commission.SettledPointsPerAmountUnit,
				OfflineAmountPerPointMicros: commission.SettledOfflineAmountPerPointMicros,
				SettledBy:                   commission.SettledBy,
				SettledAt:                   commission.SettledAt,
				Remark:                      commission.SettleRemark,
			}
			if settlementType == AffiliateCommissionSettlementTypeOfflineCashback {
				settlement.WalletQuota = 0
				settlement.WalletAmountMicros = 0
				settlement.PricePerWalletUnitMicros = 0
			}
			return tx.Create(settlement).Error
		})
		if err != nil {
			return err
		}
	}
	return nil
}
