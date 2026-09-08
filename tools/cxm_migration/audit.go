package main

import (
	"fmt"
	"sort"

	"github.com/QuantumNous/new-api/model"
)

func printAudit(bundle TransformedBundle) {
	counts := bundleCounts(bundle.Source)
	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		fmt.Printf("%s=%d\n", key, counts[key])
	}
	var ledger int64
	for _, entry := range bundle.CreditLogs {
		ledger += entry.Log.Delta
	}
	fmt.Printf("agent_balance=%d ledger_delta=%d transformed_orders=%d transformed_subscriptions=%d\n", bundle.AgentAccount.Balance, ledger, len(bundle.Orders), len(bundle.Subscriptions))
}

func reportTarget(targetDSN string, bundle TransformedBundle) error {
	db, err := openPostgres(targetDSN)
	if err != nil {
		return err
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	defer sqlDB.Close()
	var customers, logs, orders, redemptions, creditLogs, subscriptions int64
	if err := db.Model(&model.User{}).Where("bound_agent_id = ?", bundle.Source.AgentID).Count(&customers).Error; err != nil {
		return err
	}
	var boundIDs []int
	if err := db.Model(&model.User{}).Where("bound_agent_id = ?", bundle.Source.AgentID).Pluck("id", &boundIDs).Error; err != nil {
		return err
	}
	if err := db.Model(&model.Log{}).Where("user_id IN ?", boundIDs).Count(&logs).Error; err != nil {
		return err
	}
	if err := db.Model(&model.AgentPurchaseOrder{}).Where("agent_user_id = ?", bundle.Source.AgentID).Count(&orders).Error; err != nil {
		return err
	}
	if err := db.Model(&model.Redemption{}).Where("agent_user_id = ?", bundle.Source.AgentID).Count(&redemptions).Error; err != nil {
		return err
	}
	if err := db.Model(&model.AgentCreditLog{}).Where("agent_user_id = ?", bundle.Source.AgentID).Count(&creditLogs).Error; err != nil {
		return err
	}
	if err := db.Model(&model.UserSubscription{}).Where("source = ?", "legacy_agent_migration").Count(&subscriptions).Error; err != nil {
		return err
	}
	var account model.AgentAccount
	if err := db.Where("user_id = ?", bundle.Source.AgentID).First(&account).Error; err != nil {
		return err
	}
	var ledger int64
	if err := db.Model(&model.AgentCreditLog{}).Where("agent_user_id = ?", bundle.Source.AgentID).Select("COALESCE(SUM(delta), 0)").Scan(&ledger).Error; err != nil {
		return err
	}
	if account.Balance != ledger {
		return fmt.Errorf("target agent ledger mismatch: balance=%d ledger=%d", account.Balance, ledger)
	}
	if customers < int64(len(bundle.Source.Customers)) || logs < int64(len(bundle.Source.Logs)) || orders < int64(len(bundle.Orders)) || redemptions < int64(len(bundle.Source.Redemptions)) || creditLogs < int64(len(bundle.CreditLogs)) {
		return fmt.Errorf("target migrated counts are below source counts")
	}
	fmt.Printf("target_customers=%d target_logs=%d target_orders=%d target_redemptions=%d target_credit_logs=%d target_subscriptions=%d target_agent_balance=%d target_ledger_delta=%d source_agent_balance=%d\n", customers, logs, orders, redemptions, creditLogs, subscriptions, account.Balance, ledger, bundle.AgentAccount.Balance)
	return nil
}
