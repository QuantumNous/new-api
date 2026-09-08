package main

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

const legacyAgentCreditLogTable = "agent_credit_logs_legacy"

const (
	legacyRedemptionCodeTypeQuota        = 1
	legacyRedemptionCodeTypeSubscription = 2
)

type legacyUserState struct {
	Id    int    `gorm:"column:id"`
	Quota int    `gorm:"column:quota"`
	Group string `gorm:"column:group"`
}

type legacyDataset struct {
	Users        []legacyUserState
	Packages     []SourcePackage
	Offers       []SourceOffer
	UserPackages []SourceUserPackage
	QuotaGrants  []SourceQuotaGrant
	Credits      []SourceAgentCredit
	CreditLogs   []SourceAgentCreditLog
	Redemptions  []SourceRedemption
}

type legacyOrder struct {
	Order               model.AgentPurchaseOrder
	SourceCreditLogID   int
	SourceRedemptionIDs []int
}

type legacyMigration struct {
	Plans               []model.SubscriptionPlan
	Offers              []model.AgentPlanOffer
	Subscriptions       []model.UserSubscription
	Accounts            []model.AgentAccount
	Orders              []legacyOrder
	CreditLogs          []MigrationCreditLog
	WalletQuotaByUser   map[int]int64
	RedemptionPlanByID  map[int]int
	RedemptionAgentByID map[int]int
}

type legacyMigrationReport struct {
	Users         int
	Plans         int
	Offers        int
	Subscriptions int
	Accounts      int
	Orders        int
	CreditLogs    int
	Redemptions   int
}

func buildLegacyMigration(dataset legacyDataset, now time.Time) (legacyMigration, error) {
	result := legacyMigration{
		WalletQuotaByUser:   make(map[int]int64, len(dataset.Users)),
		RedemptionPlanByID:  make(map[int]int, len(dataset.Redemptions)),
		RedemptionAgentByID: make(map[int]int, len(dataset.Redemptions)),
	}

	usersByID := make(map[int]legacyUserState, len(dataset.Users))
	for _, user := range dataset.Users {
		usersByID[user.Id] = user
		result.WalletQuotaByUser[user.Id] = 0
	}

	packageByID := make(map[int]SourcePackage, len(dataset.Packages))
	for _, sourcePackage := range dataset.Packages {
		packageByID[sourcePackage.Id] = sourcePackage
		plan := model.SubscriptionPlan{
			Id:               sourcePackage.Id,
			Title:            sourcePackage.Name,
			Subtitle:         sourcePackage.CustomMessage,
			PriceAmount:      float64(sourcePackage.RetailPrice) / 100,
			Currency:         "CNY",
			DurationUnit:     normalizeDurationUnit(sourcePackage.DurationUnit),
			DurationValue:    sourcePackage.Duration,
			Enabled:          legacyPlanCanBeSold(sourcePackage),
			SortOrder:        sourcePackage.Id,
			UpgradeGroup:     sourcePackage.Group,
			DowngradeGroup:   sourcePackage.ExpireGroup,
			TotalAmount:      int64(quotaFromUSD(sourcePackage.QuotaUSD)),
			QuotaResetPeriod: model.SubscriptionResetNever,
			CreatedAt:        now.Unix(),
			UpdatedAt:        now.Unix(),
		}
		result.Plans = append(result.Plans, plan)
	}
	sort.Slice(result.Plans, func(i, j int) bool { return result.Plans[i].Id < result.Plans[j].Id })

	planByID := make(map[int]model.SubscriptionPlan, len(result.Plans))
	for _, plan := range result.Plans {
		planByID[plan.Id] = plan
	}

	offersByPackage := make(map[int][]SourceOffer)
	for _, offer := range dataset.Offers {
		if offer.OfferType == "agent" && offer.Status == 1 {
			offersByPackage[offer.PackageId] = append(offersByPackage[offer.PackageId], offer)
		}
	}
	for _, plan := range result.Plans {
		candidates := offersByPackage[plan.Id]
		if len(candidates) == 0 {
			continue
		}
		sort.Slice(candidates, func(i, j int) bool { return candidates[i].Id < candidates[j].Id })
		selected := candidates[0]
		for _, candidate := range candidates {
			if candidate.Amount == packageByID[plan.Id].AgentPrice {
				selected = candidate
				break
			}
		}
		result.Offers = append(result.Offers, model.AgentPlanOffer{
			Id:            selected.Id,
			PlanId:        plan.Id,
			Enabled:       plan.Enabled,
			UnitPrice:     selected.Amount,
			CodeValidDays: codeValidDays(dataset.Redemptions, plan.Id),
			RefundFeeBps:  legacyRefundFeeBPS(selected.RefundFeeType, selected.Amount, selected.RefundFeeValue),
			CreatedAt:     offerTimeUnix(selected.ValidFrom, now.Unix()),
			UpdatedAt:     offerTimeUnix(selected.ValidTo, now.Unix()),
		})
	}
	sort.Slice(result.Offers, func(i, j int) bool { return result.Offers[i].PlanId < result.Offers[j].PlanId })

	grantRemainingByPackage := make(map[int]int64)
	subscriptionRemainingByUser := make(map[int]int64)
	for _, grant := range dataset.QuotaGrants {
		active := grant.Status == 1 && grant.Remaining > 0 && (grant.ExpireAt == nil || grant.ExpireAt.After(now))
		if !active {
			continue
		}
		if grant.SourceType == "user_package" {
			grantRemainingByPackage[grant.SourceId] += int64(grant.Remaining)
			subscriptionRemainingByUser[grant.UserId] += int64(grant.Remaining)
			continue
		}
		result.WalletQuotaByUser[grant.UserId] += int64(grant.Remaining)
	}
	for _, user := range dataset.Users {
		remaining := result.WalletQuotaByUser[user.Id] + subscriptionRemainingByUser[user.Id]
		if remaining != int64(user.Quota) {
			return legacyMigration{}, fmt.Errorf("user %d quota mismatch: wallet=%d subscriptions=%d source=%d", user.Id, result.WalletQuotaByUser[user.Id], subscriptionRemainingByUser[user.Id], user.Quota)
		}
	}

	for _, sourcePackage := range dataset.UserPackages {
		plan, ok := planByID[sourcePackage.PackageId]
		if !ok {
			return legacyMigration{}, fmt.Errorf("user package %d references missing plan %d", sourcePackage.Id, sourcePackage.PackageId)
		}
		total := int64(maxInt(sourcePackage.QuotaAllocated, 0))
		remaining := grantRemainingByPackage[sourcePackage.Id]
		if remaining > total {
			return legacyMigration{}, fmt.Errorf("user package %d remaining quota exceeds total", sourcePackage.Id)
		}
		start := sourcePackage.AppliedAt.Unix()
		end := packageEndTime(sourcePackage, plan)
		status := "expired"
		if sourcePackage.ClearedAt == nil && sourcePackage.ActivatedAt != nil && end > now.Unix() {
			status = "active"
		} else if sourcePackage.ClearedAt == nil && sourcePackage.ActivatedAt == nil {
			status = "cancelled"
		}
		result.Subscriptions = append(result.Subscriptions, model.UserSubscription{
			UserId:              sourcePackage.UserId,
			PlanId:              plan.Id,
			AmountTotal:         total,
			AmountUsed:          total - remaining,
			StartTime:           start,
			EndTime:             end,
			Status:              status,
			Source:              "legacy_agent_migration",
			UpgradeGroup:        plan.UpgradeGroup,
			PrevUserGroup:       usersByID[sourcePackage.UserId].Group,
			DowngradeGroup:      plan.DowngradeGroup,
			AllowWalletOverflow: true,
			CreatedAt:           start,
			UpdatedAt:           start,
		})
	}

	creditByUser := make(map[int]SourceAgentCredit, len(dataset.Credits))
	for _, sourceCredit := range dataset.Credits {
		if sourceCredit.Balance < 0 {
			return legacyMigration{}, fmt.Errorf("agent %d has negative balance", sourceCredit.UserId)
		}
		creditByUser[sourceCredit.UserId] = sourceCredit
		status := model.AgentAccountStatusActive
		if sourceCredit.Status == 2 {
			status = model.AgentAccountStatusDisabled
		}
		dailyLimit := sourceCredit.DailyGenLimit
		if dailyLimit <= 0 {
			dailyLimit = model.DefaultAgentDailyCodeLimit
		}
		result.Accounts = append(result.Accounts, model.AgentAccount{
			UserId:         sourceCredit.UserId,
			Status:         status,
			Balance:        sourceCredit.Balance,
			DailyCodeLimit: dailyLimit,
			DailyCountDate: "",
			DailyCodeCount: 0,
			Version:        1,
			CreatedAt:      sourceCredit.CreatedAt,
			UpdatedAt:      sourceCredit.UpdatedAt,
		})
	}
	sort.Slice(result.Accounts, func(i, j int) bool { return result.Accounts[i].UserId < result.Accounts[j].UserId })

	creditLogsByUser := make(map[int][]SourceAgentCreditLog)
	ledgerByUser := make(map[int]int64)
	for _, creditLog := range dataset.CreditLogs {
		if _, ok := creditByUser[creditLog.UserId]; !ok {
			return legacyMigration{}, fmt.Errorf("credit log %d references missing agent account %d", creditLog.Id, creditLog.UserId)
		}
		creditLogsByUser[creditLog.UserId] = append(creditLogsByUser[creditLog.UserId], creditLog)
		ledgerByUser[creditLog.UserId] += creditLog.Delta
		mappedType, ok := mapCreditEvent(creditLog.ChangeType)
		if !ok {
			return legacyMigration{}, fmt.Errorf("unsupported credit event %q", creditLog.ChangeType)
		}
		result.CreditLogs = append(result.CreditLogs, MigrationCreditLog{
			Log: model.AgentCreditLog{
				AgentUserId:    creditLog.UserId,
				Delta:          creditLog.Delta,
				BalanceBefore:  creditLog.Before,
				BalanceAfter:   creditLog.After,
				EventType:      mappedType,
				BusinessKey:    fmt.Sprintf("legacy-agent-credit:%d", creditLog.Id),
				OperatorUserId: creditLog.OperatorId,
				Remark:         creditLog.Remark,
				CreatedAt:      creditLog.CreatedAt,
			},
			SourceID:               creditLog.Id,
			SourceRedemptionSource: creditLog.SourceId,
		})
	}
	for userID, sourceCredit := range creditByUser {
		if ledgerByUser[userID] != sourceCredit.Balance {
			return legacyMigration{}, fmt.Errorf("agent %d ledger mismatch: balance=%d ledger=%d", userID, sourceCredit.Balance, ledgerByUser[userID])
		}
	}
	sort.Slice(result.CreditLogs, func(i, j int) bool { return result.CreditLogs[i].SourceID < result.CreditLogs[j].SourceID })

	codesByAgent := make(map[int][]SourceRedemption)
	for _, redemption := range dataset.Redemptions {
		if redemption.Type != legacyRedemptionCodeTypeSubscription {
			return legacyMigration{}, fmt.Errorf("redemption %d is not a package code", redemption.Id)
		}
		if _, ok := planByID[redemption.PackageId]; !ok {
			return legacyMigration{}, fmt.Errorf("redemption %d references missing plan %d", redemption.Id, redemption.PackageId)
		}
		result.RedemptionPlanByID[redemption.Id] = redemption.PackageId
		result.RedemptionAgentByID[redemption.Id] = redemption.AgentId
		if redemption.AgentId > 0 {
			codesByAgent[redemption.AgentId] = append(codesByAgent[redemption.AgentId], redemption)
		}
	}

	assignedCodes := make(map[int]bool, len(dataset.Redemptions))
	for agentID, creditLogs := range creditLogsByUser {
		sort.Slice(creditLogs, func(i, j int) bool { return creditLogs[i].Id < creditLogs[j].Id })
		for _, creditLog := range creditLogs {
			if strings.ToLower(creditLog.ChangeType) != "purchase" {
				continue
			}
			quantity, err := purchaseQuantity(creditLog.Remark)
			if err != nil {
				return legacyMigration{}, fmt.Errorf("purchase credit log %d: %w", creditLog.Id, err)
			}
			codes := selectPurchaseCodes(codesByAgent[agentID], assignedCodes, creditLog.CreatedAt, quantity)
			if len(codes) != quantity {
				return legacyMigration{}, fmt.Errorf("purchase credit log %d matched %d/%d redemption codes", creditLog.Id, len(codes), quantity)
			}
			planID := codes[0].PackageId
			for _, code := range codes[1:] {
				if code.PackageId != planID {
					return legacyMigration{}, fmt.Errorf("purchase credit log %d matched multiple plans", creditLog.Id)
				}
			}
			if creditLog.Delta >= 0 || (-creditLog.Delta)%int64(quantity) != 0 {
				return legacyMigration{}, fmt.Errorf("purchase credit log %d has invalid total", creditLog.Id)
			}
			plan := planByID[planID]
			snapshot, err := model.BuildSubscriptionEntitlementSnapshot(&plan)
			if err != nil {
				return legacyMigration{}, err
			}
			snapshotJSON, err := common.Marshal(snapshot)
			if err != nil {
				return legacyMigration{}, err
			}
			unitPrice := -creditLog.Delta / int64(quantity)
			feeBPS := legacyRefundFeeBPS(codes[0].OfferRefundFeeType, unitPrice, codes[0].OfferRefundFeeValue)
			if feeBPS == 0 {
				feeBPS = findOffer(result.Offers, planID).RefundFeeBps
			}
			refundedCount := 0
			sourceIDs := make([]int, 0, len(codes))
			for _, code := range codes {
				sourceIDs = append(sourceIDs, code.Id)
				if code.Status == common.RedemptionCodeStatusRefunded {
					refundedCount++
				}
			}
			status := model.AgentPurchaseOrderStatusCompleted
			if refundedCount == len(codes) {
				status = model.AgentPurchaseOrderStatusRefunded
			} else if refundedCount > 0 {
				status = model.AgentPurchaseOrderStatusPartiallyRefunded
			}
			result.Orders = append(result.Orders, legacyOrder{
				SourceCreditLogID:   creditLog.Id,
				SourceRedemptionIDs: sourceIDs,
				Order: model.AgentPurchaseOrder{
					OrderNo:             fmt.Sprintf("legacy-agent-credit-%d", creditLog.Id),
					AgentUserId:         agentID,
					PlanId:              planID,
					PlanTitle:           plan.Title,
					Quantity:            quantity,
					UnitPrice:           unitPrice,
					TotalPrice:          -creditLog.Delta,
					CodeValidDays:       codeValidDays(codes, planID),
					RefundFeeBps:        feeBPS,
					EntitlementSnapshot: string(snapshotJSON),
					IdempotencyKey:      fmt.Sprintf("legacy-agent:%d:%d", agentID, creditLog.Id),
					RefundedCount:       refundedCount,
					RefundedAmount:      int64(refundedCount) * refundAmount(unitPrice, feeBPS),
					Status:              status,
					CreatedAt:           creditLog.CreatedAt,
					UpdatedAt:           creditLog.CreatedAt,
				},
			})
		}
	}
	for agentID, codes := range codesByAgent {
		for _, code := range codes {
			if !assignedCodes[code.Id] {
				return legacyMigration{}, fmt.Errorf("agent %d redemption %d has no purchase order", agentID, code.Id)
			}
		}
	}
	sort.Slice(result.Orders, func(i, j int) bool { return result.Orders[i].SourceCreditLogID < result.Orders[j].SourceCreditLogID })

	return result, nil
}

func legacyPlanCanBeSold(sourcePackage SourcePackage) bool {
	if sourcePackage.ProductType != "subscription" || sourcePackage.Status != 1 {
		return false
	}
	switch sourcePackage.Id {
	case 8, 10, 11:
		return true
	default:
		return false
	}
}

func legacyRefundFeeBPS(feeType string, unitPrice, feeValue int64) int {
	if strings.EqualFold(feeType, "percent") {
		if feeValue <= 0 {
			return 0
		}
		if feeValue >= 10000 {
			return 10000
		}
		return int(feeValue)
	}
	return fixedFeeToBPS(unitPrice, feeValue)
}

func loadLegacyDataset(tx *gorm.DB) (legacyDataset, error) {
	var dataset legacyDataset
	if err := tx.Table("users").Select("id, quota, \"group\"").Order("id ASC").Find(&dataset.Users).Error; err != nil {
		return legacyDataset{}, err
	}
	queries := []struct {
		table string
		out   interface{}
	}{
		{"packages", &dataset.Packages},
		{"offers", &dataset.Offers},
		{"user_packages", &dataset.UserPackages},
		{"quota_grants", &dataset.QuotaGrants},
		{"agent_credits", &dataset.Credits},
		{legacyAgentCreditLogTable, &dataset.CreditLogs},
	}
	for _, query := range queries {
		if err := tx.Table(query.table).Order("id ASC").Find(query.out).Error; err != nil {
			return legacyDataset{}, fmt.Errorf("load %s: %w", query.table, err)
		}
	}
	if err := tx.Table("redemptions").Where("type = ?", legacyRedemptionCodeTypeSubscription).Order("id ASC").Find(&dataset.Redemptions).Error; err != nil {
		return legacyDataset{}, fmt.Errorf("load package redemptions: %w", err)
	}
	return dataset, nil
}

func migrateLegacyInPlace(targetDSN string, dryRun bool, now time.Time) (legacyMigrationReport, error) {
	db, err := openPostgres(targetDSN)
	if err != nil {
		return legacyMigrationReport{}, fmt.Errorf("open target database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return legacyMigrationReport{}, err
	}
	defer sqlDB.Close()

	var report legacyMigrationReport
	err = db.Transaction(func(tx *gorm.DB) error {
		dataset, err := loadLegacyDataset(tx)
		if err != nil {
			return err
		}
		migration, err := buildLegacyMigration(dataset, now)
		if err != nil {
			return err
		}
		report = legacyMigrationReport{
			Users:         len(dataset.Users),
			Plans:         len(migration.Plans),
			Offers:        len(migration.Offers),
			Subscriptions: len(migration.Subscriptions),
			Accounts:      len(migration.Accounts),
			Orders:        len(migration.Orders),
			CreditLogs:    len(migration.CreditLogs),
			Redemptions:   len(migration.RedemptionPlanByID),
		}
		if dryRun {
			return nil
		}
		if err := ensureLegacyDestinationEmpty(tx); err != nil {
			return err
		}
		session := tx.Session(&gorm.Session{SkipHooks: true})
		planEnabledByID := legacyPlanEnabledByID(migration.Plans)
		if err := session.Create(&migration.Plans).Error; err != nil {
			return fmt.Errorf("insert plans: %w", err)
		}
		if err := restoreLegacyPlanEnabled(tx, planEnabledByID); err != nil {
			return err
		}
		if len(migration.Offers) > 0 {
			if err := session.Create(&migration.Offers).Error; err != nil {
				return fmt.Errorf("insert offers: %w", err)
			}
		}
		if err := session.Create(&migration.Accounts).Error; err != nil {
			return fmt.Errorf("insert agent accounts: %w", err)
		}
		if len(migration.Subscriptions) > 0 {
			if err := session.CreateInBatches(&migration.Subscriptions, 200).Error; err != nil {
				return fmt.Errorf("insert subscriptions: %w", err)
			}
		}
		if err := tx.Table("redemptions").Where("type = ?", legacyRedemptionCodeTypeQuota).Update("type", common.RedemptionCodeTypeQuota).Error; err != nil {
			return fmt.Errorf("convert legacy quota redemption types: %w", err)
		}

		orderIDByCreditLog := make(map[int]int, len(migration.Orders))
		orderIDByRedemption := make(map[int]int, len(migration.RedemptionPlanByID))
		for i := range migration.Orders {
			order := &migration.Orders[i]
			if err := session.Create(&order.Order).Error; err != nil {
				return fmt.Errorf("insert order for credit log %d: %w", order.SourceCreditLogID, err)
			}
			orderIDByCreditLog[order.SourceCreditLogID] = order.Order.Id
			for _, redemptionID := range order.SourceRedemptionIDs {
				orderIDByRedemption[redemptionID] = order.Order.Id
			}
		}
		for redemptionID, planID := range migration.RedemptionPlanByID {
			updates := map[string]interface{}{
				"type":                 common.RedemptionCodeTypeSubscription,
				"subscription_plan_id": planID,
				"agent_user_id":        migration.RedemptionAgentByID[redemptionID],
				"agent_order_id":       orderIDByRedemption[redemptionID],
			}
			if err := tx.Model(&model.Redemption{}).Where("id = ?", redemptionID).Updates(updates).Error; err != nil {
				return fmt.Errorf("update redemption %d: %w", redemptionID, err)
			}
		}
		for i := range migration.CreditLogs {
			entry := &migration.CreditLogs[i]
			entry.Log.OrderId = orderIDByCreditLog[entry.SourceID]
			if entry.Log.EventType == model.AgentCreditEventRefund && entry.SourceRedemptionSource > 0 {
				entry.Log.RedemptionId = entry.SourceRedemptionSource
			}
			if err := session.Create(&entry.Log).Error; err != nil {
				return fmt.Errorf("insert credit log %d: %w", entry.SourceID, err)
			}
		}
		for userID, quota := range migration.WalletQuotaByUser {
			if err := tx.Model(&model.User{}).Where("id = ?", userID).Update("quota", quota).Error; err != nil {
				return fmt.Errorf("update user %d wallet quota: %w", userID, err)
			}
		}
		return resetTargetSequences(tx)
	})
	return report, err
}

func legacyPlanEnabledByID(plans []model.SubscriptionPlan) map[int]bool {
	enabledByID := make(map[int]bool, len(plans))
	for _, plan := range plans {
		enabledByID[plan.Id] = plan.Enabled
	}
	return enabledByID
}

func restoreLegacyPlanEnabled(tx *gorm.DB, enabledByID map[int]bool) error {
	for planID, enabled := range enabledByID {
		if err := tx.Model(&model.SubscriptionPlan{}).Where("id = ?", planID).Update("enabled", enabled).Error; err != nil {
			return fmt.Errorf("restore plan %d enabled state: %w", planID, err)
		}
	}
	return nil
}

func ensureLegacyDestinationEmpty(tx *gorm.DB) error {
	checks := []struct {
		model interface{}
		name  string
	}{
		{&model.SubscriptionPlan{}, "subscription_plans"},
		{&model.UserSubscription{}, "user_subscriptions"},
		{&model.AgentAccount{}, "agent_accounts"},
		{&model.AgentPlanOffer{}, "agent_plan_offers"},
		{&model.AgentPurchaseOrder{}, "agent_purchase_orders"},
		{&model.AgentCreditLog{}, "agent_credit_logs"},
	}
	for _, check := range checks {
		var count int64
		if err := tx.Model(check.model).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("destination table %s is not empty: %d rows", check.name, count)
		}
	}
	return nil
}

func printLegacyMigrationReport(report legacyMigrationReport, dryRun bool) error {
	if report.Users == 0 || report.Plans == 0 || report.Accounts == 0 {
		return errors.New("legacy migration report is incomplete")
	}
	fmt.Printf("legacy_in_place dry_run=%t users=%d plans=%d offers=%d subscriptions=%d accounts=%d orders=%d credit_logs=%d redemptions=%d\n",
		dryRun, report.Users, report.Plans, report.Offers, report.Subscriptions, report.Accounts, report.Orders, report.CreditLogs, report.Redemptions)
	return nil
}
