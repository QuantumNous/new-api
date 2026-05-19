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

	AffiliatePayoutMethodPayPal = "paypal"
)

type AffiliateCommission struct {
	Id                       int    `json:"id"`
	TradeNo                  string `json:"trade_no" gorm:"type:varchar(255);not null;uniqueIndex:idx_affiliate_commission_trade_level;index"`
	TopUpId                  int    `json:"top_up_id" gorm:"index"`
	BuyerId                  int    `json:"buyer_id" gorm:"index"`
	PromoterId               int    `json:"promoter_id" gorm:"index;index:idx_affiliate_commission_promoter_status_created,priority:1"`
	Level                    int    `json:"level" gorm:"not null;uniqueIndex:idx_affiliate_commission_trade_level;index"`
	BaseAmountMicros         int64  `json:"base_amount_micros"`
	CommissionRateBps        int    `json:"commission_rate_bps"`
	CommissionAmountMicros   int64  `json:"commission_amount_micros"`
	Currency                 string `json:"currency" gorm:"type:varchar(16);not null;default:'CNY'"`
	PaymentProvider          string `json:"payment_provider" gorm:"type:varchar(50);default:''"`
	PaymentMethod            string `json:"payment_method" gorm:"type:varchar(50);default:''"`
	Status                   string `json:"status" gorm:"type:varchar(20);not null;default:'pending';index:idx_affiliate_commission_promoter_status_created,priority:2;index"`
	SettledAt                int64  `json:"settled_at" gorm:"default:0"`
	SettledBy                int    `json:"settled_by" gorm:"default:0"`
	SettleRemark             string `json:"settle_remark" gorm:"type:varchar(255);default:''"`
	SettledPayoutMethod      string `json:"settled_payout_method" gorm:"type:varchar(32);default:''"`
	SettledPayoutAccount     string `json:"settled_payout_account" gorm:"type:varchar(255);default:''"`
	SettledPayoutAccountName string `json:"settled_payout_account_name" gorm:"type:varchar(255);default:''"`
	CreatedAt                int64  `json:"created_at" gorm:"autoCreateTime;index:idx_affiliate_commission_promoter_status_created,priority:3"`
	UpdatedAt                int64  `json:"updated_at" gorm:"autoUpdateTime"`
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
	PendingAmountMicros int64  `json:"pending_amount_micros"`
	SettledAmountMicros int64  `json:"settled_amount_micros"`
	TotalAmountMicros   int64  `json:"total_amount_micros"`
	PendingCount        int64  `json:"pending_count"`
	SettledCount        int64  `json:"settled_count"`
	TotalCount          int64  `json:"total_count"`
	Currency            string `json:"currency"`
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

func CreateTopUpCommissionsWithTx(tx *gorm.DB, topUp *TopUp) error {
	if tx == nil || topUp == nil {
		return nil
	}
	setting := operation_setting.GetDistributionSetting()
	if !setting.Enabled {
		return nil
	}

	baseAmountMicros := moneyToMicros(topUp.Money)
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
	if err := createTopUpCommissionForPromoter(tx, topUp, &buyer, &level1Promoter, AffiliateCommissionLevel1, setting.Level1RateBps, baseAmountMicros, currency, 0); err != nil {
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

	return createTopUpCommissionForPromoter(tx, topUp, &buyer, &level2Promoter, AffiliateCommissionLevel2, setting.Level2RateBps, baseAmountMicros, currency, level1Promoter.Id)
}

func createTopUpCommissionForPromoter(tx *gorm.DB, topUp *TopUp, buyer *User, promoter *User, level int, rateBps int, baseAmountMicros int64, currency string, excludedPromoterId int) error {
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

	commission := &AffiliateCommission{
		TradeNo:                topUp.TradeNo,
		TopUpId:                topUp.Id,
		BuyerId:                buyer.Id,
		PromoterId:             promoter.Id,
		Level:                  level,
		BaseAmountMicros:       baseAmountMicros,
		CommissionRateBps:      rateBps,
		CommissionAmountMicros: amountMicros,
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
	return records, total, err
}

func ExportAffiliateCommissions(query AffiliateCommissionQuery, limit int) (records []*AffiliateCommissionRecord, err error) {
	if limit <= 0 || limit > 50000 {
		limit = 50000
	}
	records, _, err = ListAffiliateCommissions(query, &common.PageInfo{Page: 1, PageSize: limit})
	return records, err
}

func GetAffiliateCommissionSummary(query AffiliateCommissionQuery) (AffiliateCommissionSummary, error) {
	type summaryRow struct {
		Status string
		Amount int64
		Count  int64
	}
	rows := make([]summaryRow, 0, 2)
	db := buildAffiliateCommissionQuery(DB.Model(&AffiliateCommission{}), query).
		Select("status, COALESCE(SUM(commission_amount_micros), 0) AS amount, COUNT(*) AS count").
		Group("status")
	if err := db.Scan(&rows).Error; err != nil {
		return AffiliateCommissionSummary{}, err
	}

	summary := AffiliateCommissionSummary{
		Currency: operation_setting.NormalizeDistributionCurrency(operation_setting.GetDistributionSetting().Currency),
	}
	for _, row := range rows {
		switch row.Status {
		case AffiliateCommissionStatusPending:
			summary.PendingAmountMicros = row.Amount
			summary.PendingCount = row.Count
		case AffiliateCommissionStatusSettled:
			summary.SettledAmountMicros = row.Amount
			summary.SettledCount = row.Count
		}
	}
	summary.TotalAmountMicros = summary.PendingAmountMicros + summary.SettledAmountMicros
	summary.TotalCount = summary.PendingCount + summary.SettledCount
	return summary, nil
}

func SettleAffiliateCommissions(ids []int, settledBy int, remark string) error {
	uniqueIds := make([]int, 0, len(ids))
	seen := make(map[int]struct{}, len(ids))
	for _, id := range ids {
		if id <= 0 {
			return errors.New("佣金 ID 参数无效")
		}
		if _, ok := seen[id]; ok {
			continue
		}
		seen[id] = struct{}{}
		uniqueIds = append(uniqueIds, id)
	}
	if len(uniqueIds) == 0 {
		return errors.New("请选择要结算的佣金记录")
	}
	if len(remark) > 255 {
		remark = remark[:255]
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var commissions []AffiliateCommission
		if err := tx.Where("id IN ?", uniqueIds).Find(&commissions).Error; err != nil {
			return err
		}
		if len(commissions) != len(uniqueIds) {
			return errors.New("部分佣金记录不存在")
		}
		for _, commission := range commissions {
			if commission.Status != AffiliateCommissionStatusPending {
				return errors.New("只能结算待结算状态的佣金记录")
			}
		}

		promoterIds := make([]int, 0, len(commissions))
		promoterSeen := make(map[int]struct{}, len(commissions))
		for _, commission := range commissions {
			if _, ok := promoterSeen[commission.PromoterId]; ok {
				continue
			}
			promoterSeen[commission.PromoterId] = struct{}{}
			promoterIds = append(promoterIds, commission.PromoterId)
		}

		var payoutProfiles []AffiliatePayoutProfile
		if err := tx.Where("user_id IN ?", promoterIds).Find(&payoutProfiles).Error; err != nil {
			return err
		}
		payoutByPromoter := make(map[int]*AffiliatePayoutProfile, len(payoutProfiles))
		for _, payoutProfile := range payoutProfiles {
			normalized, err := normalizeAffiliatePayoutProfile(payoutProfile.UserId, payoutProfile.Method, payoutProfile.Account, payoutProfile.AccountName)
			if err != nil {
				continue
			}
			payoutByPromoter[payoutProfile.UserId] = normalized
		}

		missingPromoterIds := make([]string, 0)
		for _, promoterId := range promoterIds {
			if _, ok := payoutByPromoter[promoterId]; !ok {
				missingPromoterIds = append(missingPromoterIds, fmt.Sprintf("#%d", promoterId))
			}
		}
		if len(missingPromoterIds) > 0 {
			return fmt.Errorf("推广人 %s 未填写 PayPal 收款账号，暂不可结算", strings.Join(missingPromoterIds, ", "))
		}

		settledAt := common.GetTimestamp()
		for _, commission := range commissions {
			payoutProfile := payoutByPromoter[commission.PromoterId]
			if err := tx.Model(&AffiliateCommission{}).
				Where("id = ?", commission.Id).
				Updates(map[string]interface{}{
					"status":                      AffiliateCommissionStatusSettled,
					"settled_at":                  settledAt,
					"settled_by":                  settledBy,
					"settle_remark":               remark,
					"settled_payout_method":       payoutProfile.Method,
					"settled_payout_account":      payoutProfile.Account,
					"settled_payout_account_name": payoutProfile.AccountName,
				}).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
