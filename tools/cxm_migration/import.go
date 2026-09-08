package main

import (
	"database/sql"
	"errors"
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"
)

func validateTarget(targetDSN string, bundle TransformedBundle) error {
	if targetDSN == "" {
		return errors.New("target DSN is required")
	}
	db, err := openPostgres(targetDSN)
	if err != nil {
		return fmt.Errorf("open target database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	return checkTargetConflicts(db, bundle)
}

func checkTargetConflicts(db *gorm.DB, bundle TransformedBundle) error {
	userIDs := make([]int, 0, len(bundle.Users))
	usernames := make([]string, 0, len(bundle.Users))
	for _, user := range bundle.Users {
		userIDs = append(userIDs, user.Id)
		usernames = append(usernames, user.Username)
	}
	var count int64
	if err := db.Model(&model.User{}).Where("id IN ?", userIDs).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return fmt.Errorf("target already contains %d migrated user IDs", count)
	}
	if err := db.Model(&model.User{}).Where("username IN ?", usernames).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return fmt.Errorf("target already contains %d migrated usernames", count)
	}
	affCodes := make([]string, 0, len(bundle.Users))
	accessTokens := make([]string, 0, len(bundle.Users))
	emails := make([]string, 0, len(bundle.Users))
	for _, user := range bundle.Users {
		if user.AffCode != "" {
			affCodes = append(affCodes, user.AffCode)
		}
		if user.AccessToken != nil && *user.AccessToken != "" {
			accessTokens = append(accessTokens, *user.AccessToken)
		}
		if user.Email != "" {
			emails = append(emails, user.Email)
		}
	}
	if len(affCodes) > 0 {
		if err := db.Model(&model.User{}).Where("aff_code IN ?", affCodes).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target already contains %d migrated invitation codes", count)
		}
	}
	if len(accessTokens) > 0 {
		if err := db.Model(&model.User{}).Where("access_token IN ?", accessTokens).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target already contains %d migrated access tokens", count)
		}
	}
	if len(emails) > 0 {
		if err := db.Model(&model.User{}).Where("email IN ?", emails).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target already contains %d migrated email addresses", count)
		}
	}
	if err := db.Model(&model.AgentAccount{}).Where("user_id = ?", bundle.Source.AgentID).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return fmt.Errorf("target already contains an agent account for %d", bundle.Source.AgentID)
	}
	planIDs := make([]int, 0, len(bundle.Plans))
	for _, plan := range bundle.Plans {
		planIDs = append(planIDs, plan.Id)
	}
	if err := db.Model(&model.SubscriptionPlan{}).Where("id IN ?", planIDs).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return fmt.Errorf("target already contains %d migrated plan IDs", count)
	}
	offerIDs := make([]int, 0, len(bundle.Offers))
	for _, offer := range bundle.Offers {
		offerIDs = append(offerIDs, offer.Id)
	}
	if err := db.Model(&model.AgentPlanOffer{}).Where("id IN ?", offerIDs).Count(&count).Error; err != nil {
		return err
	}
	if count != 0 {
		return fmt.Errorf("target already contains %d migrated offer IDs", count)
	}
	keys := make([]string, 0, len(bundle.Source.Redemptions))
	for _, redemption := range bundle.Source.Redemptions {
		keys = append(keys, redemption.Key)
	}
	if len(keys) > 0 {
		if err := db.Model(&model.Redemption{}).Where("key IN ?", keys).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target already contains %d migrated redemption keys", count)
		}
	}
	for _, token := range bundle.Tokens {
		if token.Key == "" {
			continue
		}
		if err := db.Model(&model.Token{}).Where("key = ?", token.Key).Count(&count).Error; err != nil {
			return err
		}
		if count != 0 {
			return fmt.Errorf("target already contains token key for source user %d", token.UserId)
		}
	}
	return nil
}

func importTarget(targetDSN string, bundle TransformedBundle) error {
	if err := validateTarget(targetDSN, bundle); err != nil {
		return err
	}
	db, err := openPostgres(targetDSN)
	if err != nil {
		return fmt.Errorf("open target database: %w", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	return db.Transaction(func(tx *gorm.DB) error {
		if err := resetTargetSequences(tx); err != nil {
			return err
		}
		if err := tx.Create(&bundle.Users).Error; err != nil {
			return fmt.Errorf("insert users: %w", err)
		}
		if err := tx.Create(&bundle.AgentAccount).Error; err != nil {
			return fmt.Errorf("insert agent account: %w", err)
		}
		if err := tx.Create(&bundle.Plans).Error; err != nil {
			return fmt.Errorf("insert subscription plans: %w", err)
		}
		if err := tx.Create(&bundle.Offers).Error; err != nil {
			return fmt.Errorf("insert agent offers: %w", err)
		}
		for i := range bundle.Subscriptions {
			subscription := &bundle.Subscriptions[i]
			if err := tx.Create(subscription).Error; err != nil {
				return fmt.Errorf("insert subscription user=%d: %w", subscription.UserId, err)
			}
			if err := tx.Model(&model.UserSubscription{}).Where("id = ?", subscription.Id).Updates(map[string]interface{}{
				"start_time": subscription.StartTime, "end_time": subscription.EndTime, "status": subscription.Status,
				"created_at": subscription.CreatedAt, "updated_at": subscription.UpdatedAt,
			}).Error; err != nil {
				return fmt.Errorf("restore subscription timestamps: %w", err)
			}
		}

		orderIDs := make(map[int]int)
		redemptionIDs := make(map[int]int)
		for i := range bundle.Orders {
			migrationOrder := &bundle.Orders[i]
			if err := tx.Create(&migrationOrder.Order).Error; err != nil {
				return fmt.Errorf("insert order %d: %w", migrationOrder.SourceCreditLogID, err)
			}
			orderIDs[migrationOrder.SourceCreditLogID] = migrationOrder.Order.Id
			for _, sourceCode := range migrationOrder.Codes {
				targetCode := model.Redemption{
					UserId:             bundle.Source.AgentID,
					Key:                sourceCode.Key,
					Status:             sourceCode.Status,
					Type:               common.RedemptionCodeTypeSubscription,
					Name:               sourceCode.Name,
					Quota:              0,
					CreatedTime:        sourceCode.CreatedTime,
					RedeemedTime:       sourceCode.RedeemedTime,
					UsedUserId:         sourceCode.UsedUserId,
					AgentUserId:        bundle.Source.AgentID,
					AgentOrderId:       migrationOrder.Order.Id,
					SubscriptionPlanId: sourceCode.PackageId,
					ExpiredTime:        sourceCode.ExpiredTime,
				}
				if err := tx.Create(&targetCode).Error; err != nil {
					return fmt.Errorf("insert redemption %d: %w", sourceCode.Id, err)
				}
				redemptionIDs[sourceCode.Id] = targetCode.Id
			}
		}
		for i := range bundle.CreditLogs {
			entry := &bundle.CreditLogs[i]
			if orderID := orderIDs[entry.SourceID]; orderID != 0 {
				entry.Log.OrderId = orderID
			}
			if entry.Log.EventType == model.AgentCreditEventRefund {
				if sourceID := entry.SourceRedemptionSource; sourceID != 0 {
					entry.Log.RedemptionId = redemptionIDs[sourceID]
				}
			}
			if err := tx.Create(&entry.Log).Error; err != nil {
				return fmt.Errorf("insert credit log %d: %w", entry.SourceID, err)
			}
		}
		if len(bundle.Tokens) > 0 {
			if err := tx.CreateInBatches(&bundle.Tokens, 100).Error; err != nil {
				return fmt.Errorf("insert tokens: %w", err)
			}
		}
		if len(bundle.Logs) > 0 {
			if err := tx.CreateInBatches(&bundle.Logs, 1000).Error; err != nil {
				return fmt.Errorf("insert logs: %w", err)
			}
		}
		return resetTargetSequences(tx)
	})
}

func resetTargetSequences(tx *gorm.DB) error {
	if tx.Dialector.Name() != "postgres" {
		return nil
	}
	for _, table := range []string{"agent_plan_offers", "users", "subscription_plans", "agent_purchase_orders", "redemptions", "agent_credit_logs", "user_subscriptions", "tokens", "logs"} {
		var sequenceName sql.NullString
		if err := tx.Raw("SELECT pg_get_serial_sequence(?, ?)", table, "id").Scan(&sequenceName).Error; err != nil {
			return fmt.Errorf("find sequence %s: %w", table, err)
		}
		if !sequenceName.Valid || sequenceName.String == "" {
			continue
		}
		query := fmt.Sprintf("SELECT setval('%s', GREATEST(COALESCE((SELECT MAX(id) FROM %s), 1), 1), true)", sequenceName.String, table)
		if err := tx.Exec(query).Error; err != nil {
			return fmt.Errorf("reset sequence %s: %w", table, err)
		}
	}
	return nil
}
