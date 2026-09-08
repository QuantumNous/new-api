package main

import (
	"errors"
	"fmt"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/shopspring/decimal"
)

type MigrationOrder struct {
	Order             model.AgentPurchaseOrder
	SourceCreditLogID int
	Codes             []SourceRedemption
}

type MigrationCreditLog struct {
	Log                    model.AgentCreditLog
	SourceID               int
	SourceRedemptionSource int
	SourceOrderCreditLog   int
}

type TransformedBundle struct {
	Source              MigrationBundle
	Users               []model.User
	AgentAccount        model.AgentAccount
	Plans               []model.SubscriptionPlan
	Offers              []model.AgentPlanOffer
	Orders              []MigrationOrder
	Redemptions         []model.Redemption
	Subscriptions       []model.UserSubscription
	CreditLogs          []MigrationCreditLog
	Tokens              []model.Token
	Logs                []model.Log
	SourcePlanIDs       map[int]int
	SourceOfferIDs      map[int]int
	SourceOrderIDs      map[int]int
	SourceRedemptionIDs map[int]int
}

func transformBundle(bundle MigrationBundle) (TransformedBundle, error) {
	if bundle.Version != migrationBundleVersion || bundle.AgentID <= 0 {
		return TransformedBundle{}, errors.New("invalid migration bundle")
	}
	if bundle.Agent.Id != bundle.AgentID {
		return TransformedBundle{}, fmt.Errorf("bundle agent mismatch: %d != %d", bundle.Agent.Id, bundle.AgentID)
	}
	if len(bundle.Credits) != 1 || bundle.Credits[0].UserId != bundle.AgentID {
		return TransformedBundle{}, errors.New("expected one agent credit account")
	}

	result := TransformedBundle{
		Source: bundle,
		AgentAccount: model.AgentAccount{
			UserId:         bundle.AgentID,
			Status:         model.AgentAccountStatusActive,
			Balance:        bundle.Credits[0].Balance,
			DailyCodeLimit: model.DefaultAgentDailyCodeLimit,
			DailyCodeCount: 0,
			Version:        1,
			CreatedAt:      bundle.Credits[0].CreatedAt,
			UpdatedAt:      bundle.Credits[0].UpdatedAt,
		},
		SourcePlanIDs:       make(map[int]int),
		SourceOfferIDs:      make(map[int]int),
		SourceOrderIDs:      make(map[int]int),
		SourceRedemptionIDs: make(map[int]int),
	}
	if bundle.Credits[0].Status == 2 {
		result.AgentAccount.Status = model.AgentAccountStatusDisabled
	}
	if result.AgentAccount.Balance < 0 {
		return TransformedBundle{}, errors.New("agent balance cannot be negative")
	}

	packageByID := make(map[int]SourcePackage, len(bundle.Packages))
	for _, pkg := range bundle.Packages {
		packageByID[pkg.Id] = pkg
		if pkg.ProductType != "subscription" {
			continue
		}
		if pkg.Id != 8 && pkg.Id != 9 && pkg.Id != 10 && pkg.Id != 11 {
			continue
		}
		plan := model.SubscriptionPlan{
			Id:               pkg.Id,
			Title:            pkg.Name,
			Subtitle:         pkg.CustomMessage,
			PriceAmount:      float64(pkg.RetailPrice) / 100,
			Currency:         "CNY",
			DurationUnit:     normalizeDurationUnit(pkg.DurationUnit),
			DurationValue:    pkg.Duration,
			Enabled:          pkg.Status == 1,
			SortOrder:        pkg.Id,
			UpgradeGroup:     pkg.Group,
			DowngradeGroup:   pkg.ExpireGroup,
			TotalAmount:      int64(quotaFromUSD(pkg.QuotaUSD)),
			QuotaResetPeriod: model.SubscriptionResetNever,
			CreatedAt:        bundle.Agent.CreatedAt.Unix(),
			UpdatedAt:        bundle.Agent.CreatedAt.Unix(),
		}
		result.Plans = append(result.Plans, plan)
		result.SourcePlanIDs[pkg.Id] = pkg.Id
	}
	sort.Slice(result.Plans, func(i, j int) bool { return result.Plans[i].Id < result.Plans[j].Id })

	offersByPackage := make(map[int][]SourceOffer)
	for _, offer := range bundle.Offers {
		if offer.OfferType == "agent" && offer.Status == 1 {
			offersByPackage[offer.PackageId] = append(offersByPackage[offer.PackageId], offer)
		}
	}
	for _, plan := range result.Plans {
		offers := offersByPackage[plan.Id]
		if len(offers) == 0 {
			return TransformedBundle{}, fmt.Errorf("no active agent offer for package %d", plan.Id)
		}
		pkg := packageByID[plan.Id]
		offer := offers[0]
		for _, candidate := range offers {
			if candidate.Amount == pkg.AgentPrice {
				offer = candidate
				break
			}
		}
		sort.SliceStable(offers, func(i, j int) bool { return offers[i].Id < offers[j].Id })
		result.Offers = append(result.Offers, model.AgentPlanOffer{
			Id:            offer.Id,
			PlanId:        plan.Id,
			Enabled:       true,
			UnitPrice:     offer.Amount,
			CodeValidDays: codeValidDays(bundle.Redemptions, plan.Id),
			RefundFeeBps:  fixedFeeToBPS(offer.Amount, offer.RefundFeeValue),
			CreatedAt:     offerTimeUnix(offer.ValidFrom, bundle.Agent.CreatedAt.Unix()),
			UpdatedAt:     offerTimeUnix(offer.ValidTo, bundle.Agent.CreatedAt.Unix()),
		})
		result.SourceOfferIDs[offer.Id] = offer.Id
	}

	grantRemaining := make(map[int]int64)
	walletRemaining := make(map[int]int64)
	now := time.Now()
	for _, grant := range bundle.QuotaGrants {
		activeGrant := grant.Status == 1 && grant.Remaining > 0 && (grant.ExpireAt == nil || grant.ExpireAt.After(now))
		if activeGrant && grant.SourceType == "user_package" {
			grantRemaining[grant.SourceId] += int64(maxInt(grant.Remaining, 0))
		}
		if activeGrant && grant.SourceType != "user_package" {
			walletRemaining[grant.UserId] += int64(grant.Remaining)
		}
	}
	result.Users = append(result.Users, convertUser(bundle.Agent, int64(bundle.Agent.Quota), false))
	for _, sourceUser := range bundle.Customers {
		result.Users = append(result.Users, convertUser(sourceUser, walletRemaining[sourceUser.Id], true))
	}

	planByID := make(map[int]model.SubscriptionPlan)
	for _, plan := range result.Plans {
		planByID[plan.Id] = plan
	}
	for _, pkg := range bundle.UserPackages {
		plan, ok := planByID[pkg.PackageId]
		if !ok {
			return TransformedBundle{}, fmt.Errorf("user package %d references unmapped package %d", pkg.Id, pkg.PackageId)
		}
		total := int64(maxInt(pkg.QuotaAllocated, 0))
		remaining := grantRemaining[pkg.Id]
		if remaining > total {
			return TransformedBundle{}, fmt.Errorf("user package %d remaining quota exceeds total", pkg.Id)
		}
		start := pkg.AppliedAt.Unix()
		end := packageEndTime(pkg, plan)
		active := pkg.ClearedAt == nil && pkg.ActivatedAt != nil && end > now.Unix()
		status := "expired"
		if active {
			status = "active"
		}
		if pkg.ClearedAt == nil && pkg.ActivatedAt == nil {
			status = "cancelled"
		}
		result.Subscriptions = append(result.Subscriptions, model.UserSubscription{
			UserId:              pkg.UserId,
			PlanId:              plan.Id,
			AmountTotal:         total,
			AmountUsed:          total - remaining,
			StartTime:           start,
			EndTime:             end,
			Status:              status,
			Source:              "legacy_agent_migration",
			UpgradeGroup:        plan.UpgradeGroup,
			PrevUserGroup:       findSourceUserGroup(bundle, pkg.UserId),
			DowngradeGroup:      plan.DowngradeGroup,
			AllowWalletOverflow: true,
			CreatedAt:           start,
			UpdatedAt:           start,
		})
	}
	for _, sourceUser := range bundle.Customers {
		var activeSubscriptionRemaining int64
		for _, pkg := range bundle.UserPackages {
			if pkg.UserId == sourceUser.Id {
				activeSubscriptionRemaining += grantRemaining[pkg.Id]
			}
		}
		if walletRemaining[sourceUser.Id]+activeSubscriptionRemaining != int64(sourceUser.Quota) {
			return TransformedBundle{}, fmt.Errorf("customer %d quota mismatch: wallet=%d subscriptions=%d source=%d", sourceUser.Id, walletRemaining[sourceUser.Id], activeSubscriptionRemaining, sourceUser.Quota)
		}
	}

	for _, redemption := range bundle.Redemptions {
		if redemption.Type != 2 {
			return TransformedBundle{}, fmt.Errorf("redemption %d is not a package code", redemption.Id)
		}
	}
	assignedCodes := make(map[int]bool, len(bundle.Redemptions))
	for _, creditLog := range bundle.CreditLogs {
		if creditLog.ChangeType != "purchase" {
			continue
		}
		quantity, err := purchaseQuantity(creditLog.Remark)
		if err != nil {
			return TransformedBundle{}, fmt.Errorf("purchase credit log %d: %w", creditLog.Id, err)
		}
		codes := selectPurchaseCodes(bundle.Redemptions, assignedCodes, creditLog.CreatedAt, quantity)
		if len(codes) != quantity {
			return TransformedBundle{}, fmt.Errorf("purchase credit log %d matched %d/%d redemption codes", creditLog.Id, len(codes), quantity)
		}
		if creditLog.Delta >= 0 || (-creditLog.Delta)%int64(len(codes)) != 0 {
			return TransformedBundle{}, fmt.Errorf("purchase credit log %d has invalid total", creditLog.Id)
		}
		plan, ok := planByID[codes[0].PackageId]
		if !ok {
			return TransformedBundle{}, fmt.Errorf("purchase credit log %d references unmapped plan", creditLog.Id)
		}
		offer := findOffer(result.Offers, plan.Id)
		snapshot, err := model.BuildSubscriptionEntitlementSnapshot(&plan)
		if err != nil {
			return TransformedBundle{}, err
		}
		snapshotJSON, err := common.Marshal(snapshot)
		if err != nil {
			return TransformedBundle{}, err
		}
		refundedCount := 0
		for _, code := range codes {
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
		result.Orders = append(result.Orders, MigrationOrder{
			SourceCreditLogID: creditLog.Id,
			Codes:             codes,
			Order: model.AgentPurchaseOrder{
				OrderNo:             fmt.Sprintf("legacy-cxm-agent-credit-%d", creditLog.Id),
				AgentUserId:         bundle.AgentID,
				PlanId:              plan.Id,
				PlanTitle:           plan.Title,
				Quantity:            len(codes),
				UnitPrice:           -creditLog.Delta / int64(len(codes)),
				TotalPrice:          -creditLog.Delta,
				CodeValidDays:       offer.CodeValidDays,
				RefundFeeBps:        offer.RefundFeeBps,
				EntitlementSnapshot: string(snapshotJSON),
				IdempotencyKey:      fmt.Sprintf("legacy-cxm:%d", creditLog.Id),
				RefundedCount:       refundedCount,
				RefundedAmount:      int64(refundedCount) * refundAmount(offer.UnitPrice, offer.RefundFeeBps),
				Status:              status,
				CreatedAt:           creditLog.CreatedAt,
				UpdatedAt:           creditLog.CreatedAt,
			},
		})
	}
	for _, creditLog := range bundle.CreditLogs {
		mappedType, ok := mapCreditEvent(creditLog.ChangeType)
		if !ok {
			return TransformedBundle{}, fmt.Errorf("unsupported credit event %q", creditLog.ChangeType)
		}
		result.CreditLogs = append(result.CreditLogs, MigrationCreditLog{
			Log: model.AgentCreditLog{
				AgentUserId:    bundle.AgentID,
				Delta:          creditLog.Delta,
				BalanceBefore:  creditLog.Before,
				BalanceAfter:   creditLog.After,
				EventType:      mappedType,
				BusinessKey:    fmt.Sprintf("legacy-cxm:%d", creditLog.Id),
				OperatorUserId: creditLog.OperatorId,
				Remark:         creditLog.Remark,
				CreatedAt:      creditLog.CreatedAt,
			},
			SourceID: creditLog.Id,
		})
	}
	for _, sourceToken := range bundle.Tokens {
		result.Tokens = append(result.Tokens, model.Token{
			UserId: sourceToken.UserId, Key: sourceToken.Key, Status: sourceToken.Status, Name: sourceToken.Name,
			CreatedTime: sourceToken.CreatedTime, AccessedTime: sourceToken.AccessedTime, ExpiredTime: sourceToken.ExpiredTime,
			RemainQuota: sourceToken.RemainQuota, UnlimitedQuota: sourceToken.UnlimitedQuota, ModelLimitsEnabled: sourceToken.ModelLimitsEnabled,
			ModelLimits: sourceToken.ModelLimits, AllowIps: sourceToken.AllowIps, UsedQuota: sourceToken.UsedQuota,
			Group: sourceToken.Group, CrossGroupRetry: sourceToken.CrossGroupRetry,
		})
	}
	for _, sourceLog := range bundle.Logs {
		result.Logs = append(result.Logs, model.Log{
			UserId: sourceLog.UserId, CreatedAt: sourceLog.CreatedAt, Type: sourceLog.Type, Content: sourceLog.Content,
			Username: sourceLog.Username, TokenName: sourceLog.TokenName, ModelName: sourceLog.ModelName, Quota: sourceLog.Quota,
			PromptTokens: sourceLog.PromptTokens, CompletionTokens: sourceLog.CompletionTokens, UseTime: sourceLog.UseTime,
			IsStream: sourceLog.IsStream, ChannelId: sourceLog.ChannelId, TokenId: sourceLog.TokenId, Group: sourceLog.Group,
			Ip: sourceLog.Ip, RequestId: sourceLog.RequestId, Other: sourceLog.Other,
		})
	}
	return result, nil
}

func purchaseQuantity(remark string) (int, error) {
	index := strings.LastIndex(strings.ToLower(remark), "x")
	if index < 0 || index+1 >= len(remark) {
		return 0, errors.New("purchase remark has no quantity")
	}
	quantity, err := strconv.Atoi(strings.TrimSpace(remark[index+1:]))
	if err != nil || quantity <= 0 || quantity > 100 {
		return 0, fmt.Errorf("invalid purchase quantity in remark %q", remark)
	}
	return quantity, nil
}

func selectPurchaseCodes(codes []SourceRedemption, assigned map[int]bool, createdAt int64, quantity int) []SourceRedemption {
	candidates := make([]SourceRedemption, 0, quantity)
	for _, code := range codes {
		if assigned[code.Id] || code.Status == common.RedemptionCodeStatusRefunded && code.CreatedTime == 0 {
			continue
		}
		if absInt64(code.CreatedTime-createdAt) <= 10 {
			candidates = append(candidates, code)
		}
	}
	sort.Slice(candidates, func(i, j int) bool {
		left := absInt64(candidates[i].CreatedTime - createdAt)
		right := absInt64(candidates[j].CreatedTime - createdAt)
		if left != right {
			return left < right
		}
		return candidates[i].Id < candidates[j].Id
	})
	if len(candidates) > quantity {
		candidates = candidates[:quantity]
	}
	for _, code := range candidates {
		assigned[code.Id] = true
	}
	return candidates
}

func absInt64(value int64) int64 {
	if value < 0 {
		return -value
	}
	return value
}

func convertUser(source SourceUser, walletRemaining int64, customer bool) model.User {
	quota := source.Quota
	if customer {
		quota = int(walletRemaining)
	}
	return model.User{
		Id: source.Id, Username: source.Username, Password: source.Password, DisplayName: source.DisplayName,
		Role: source.Role, Status: source.Status, Email: source.Email, GitHubId: source.GitHubId, DiscordId: source.DiscordId,
		OidcId: source.OidcId, WeChatId: source.WeChatId, TelegramId: source.TelegramId, AccessToken: source.AccessToken,
		Quota: quota, UsedQuota: source.UsedQuota, RequestCount: source.RequestCount, Group: source.Group, AffCode: source.AffCode,
		AffCount: source.AffCount, AffQuota: source.AffQuota, AffHistoryQuota: source.AffHistoryQuota, InviterId: source.InviterId,
		BoundAgentId: source.BoundAgentId, BoundAt: unixOrZero(source.BoundAt), LinuxDOId: source.LinuxDOId, Setting: source.Setting,
		Remark: source.Remark, StripeCustomer: source.StripeCustomer, CreatedAt: unixOrZero(source.CreatedAt), LastLoginAt: unixOrZero(source.LastLoginAt),
	}
}

func unixOrZero(value *time.Time) int64 {
	if value == nil {
		return 0
	}
	return value.Unix()
}

func quotaFromUSD(value float64) int {
	if value <= 0 || math.IsNaN(value) || math.IsInf(value, 0) {
		return 0
	}
	return common.QuotaFromDecimal(decimal.NewFromFloat(value).Mul(decimal.NewFromFloat(common.QuotaPerUnit)))
}

func normalizeDurationUnit(value string) string {
	if value == "week" {
		return model.SubscriptionDurationDay
	}
	if value == model.SubscriptionDurationYear || value == model.SubscriptionDurationMonth || value == model.SubscriptionDurationDay || value == model.SubscriptionDurationHour || value == model.SubscriptionDurationCustom {
		return value
	}
	return model.SubscriptionDurationDay
}

func codeValidDays(codes []SourceRedemption, planID int) int {
	for _, code := range codes {
		if code.PackageId == planID && code.ExpiredTime > code.CreatedTime {
			days := int(math.Round(float64(code.ExpiredTime-code.CreatedTime) / 86400))
			if days > 0 && days <= 3650 {
				return days
			}
		}
	}
	return model.DefaultAgentCodeValidDays
}

func offerTimeUnix(value *time.Time, fallback int64) int64 {
	if value == nil {
		return fallback
	}
	return value.Unix()
}

func fixedFeeToBPS(unitPrice, fixedFee int64) int {
	if unitPrice <= 0 || fixedFee <= 0 {
		return 0
	}
	value := float64(fixedFee) * 10000 / float64(unitPrice)
	if value >= 10000 {
		return 10000
	}
	return int(math.Round(value))
}

func refundAmount(unitPrice int64, feeBPS int) int64 {
	fee := int64(math.Round(float64(unitPrice) * float64(feeBPS) / 10000))
	if fee < 0 || fee > unitPrice {
		return 0
	}
	return unitPrice - fee
}

func findOffer(offers []model.AgentPlanOffer, planID int) model.AgentPlanOffer {
	for _, offer := range offers {
		if offer.PlanId == planID {
			return offer
		}
	}
	return model.AgentPlanOffer{}
}

func packageEndTime(pkg SourceUserPackage, plan model.SubscriptionPlan) int64 {
	if pkg.ExpireAt != nil {
		return pkg.ExpireAt.Unix()
	}
	start := pkg.AppliedAt
	switch plan.DurationUnit {
	case model.SubscriptionDurationYear:
		return start.AddDate(plan.DurationValue, 0, 0).Unix()
	case model.SubscriptionDurationMonth:
		return start.AddDate(0, plan.DurationValue, 0).Unix()
	case model.SubscriptionDurationHour:
		return start.Add(time.Duration(plan.DurationValue) * time.Hour).Unix()
	default:
		return start.Add(time.Duration(plan.DurationValue) * 24 * time.Hour).Unix()
	}
}

func findSourceUserGroup(bundle MigrationBundle, userID int) string {
	if bundle.Agent.Id == userID {
		return bundle.Agent.Group
	}
	for _, user := range bundle.Customers {
		if user.Id == userID {
			return user.Group
		}
	}
	return "default"
}

func mapCreditEvent(value string) (string, bool) {
	switch strings.ToLower(value) {
	case "topup", "commission", "customer_purchase", "referral", "subscription_offset":
		return model.AgentCreditEventAdminCredit, true
	case "deduct":
		return model.AgentCreditEventAdminDebit, true
	case "purchase":
		return model.AgentCreditEventPurchase, true
	case "refund":
		return model.AgentCreditEventRefund, true
	default:
		return "", false
	}
}

func maxInt(value, floor int) int {
	if value < floor {
		return floor
	}
	return value
}
