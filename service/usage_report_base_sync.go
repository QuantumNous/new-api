package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// SyncUsageReportToBase 将用量报表快照同步到飞书多维表格。
func SyncUsageReportToBase(periodType string) {
	SyncUsageReportPeriodToBase(BuildReportPeriod(periodType, time.Now()))
}

// SyncUsageReportPeriodToBase 将指定周期快照同步到飞书多维表格。
func SyncUsageReportPeriodToBase(rp ReportPeriod) {
	if _, err := SyncUsageReportPeriodToBaseWithDiagnostics(rp); err != nil {
		common.SysError(fmt.Sprintf("usage report base sync failed: %s", err))
	}
}

// SyncUsageReportPeriodToBaseWithDiagnostics 同步并返回诊断消息列表。
func SyncUsageReportPeriodToBaseWithDiagnostics(rp ReportPeriod) ([]string, error) {
	var msgs []string
	settings := system_setting.GetFeishuSettings()
	baseToken := strings.TrimSpace(settings.StatsBaseToken)
	if baseToken == "" {
		msgs = append(msgs, "skip: stats_base_token is empty")
		common.SysLog("usage report base sync: stats_base_token is empty, skip")
		return msgs, nil
	}
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		msgs = append(msgs, "skip: app_id or app_secret is empty")
		common.SysLog("usage report base sync: app_id/app_secret is empty, skip")
		return msgs, nil
	}

	token, err := getFeishuTenantAccessToken(appID, appSecret)
	if err != nil {
		msg := fmt.Sprintf("get token failed: %s", err)
		msgs = append(msgs, msg)
		common.SysError("usage report base sync: " + msg)
		return msgs, fmt.Errorf("get tenant access token: %w", err)
	}

	if rp.PeriodType == "" {
		msgs = append(msgs, "skip: period_type is empty")
		return msgs, fmt.Errorf("period_type is empty")
	}

	common.SysLog(fmt.Sprintf("usage report base sync: start syncing %s for %s", rp.PeriodType, rp.PeriodLabel))

	// 同步5张表，收集各表的诊断信息
	tables := []struct {
		name string
		id   string
		sync func() error
	}{
		{"account", settings.ReportTableAccountID, func() error { return syncAccountTable(token, baseToken, settings.ReportTableAccountID, rp) }},
		{"org", settings.ReportTableOrgID, func() error { return syncOrgTable(token, baseToken, settings.ReportTableOrgID, rp) }},
		{"platform", settings.ReportTablePlatformID, func() error { return syncPlatformTable(token, baseToken, settings.ReportTablePlatformID, rp) }},
		{"model", settings.ReportTableModelID, func() error { return syncModelTable(token, baseToken, settings.ReportTableModelID, rp) }},
		{"anomaly", settings.ReportTableAnomalyID, func() error { return syncAnomalyTable(token, baseToken, settings.ReportTableAnomalyID, rp) }},
	}
	var syncErrs []string
	for _, table := range tables {
		tableMsgs, tableErr := syncTableWithDiagnostics(table.name, table.id, table.sync)
		msgs = append(msgs, tableMsgs...)
		if tableErr != nil {
			syncErrs = append(syncErrs, tableErr.Error())
		}
	}
	if len(syncErrs) > 0 {
		return msgs, fmt.Errorf("usage report base sync failed: %s", strings.Join(syncErrs, "; "))
	}
	common.SysLog(fmt.Sprintf("usage report base sync: completed %s for %s", rp.PeriodType, rp.PeriodLabel))
	return msgs, nil
}

type partialSyncError struct {
	skipped int
}

func (e *partialSyncError) Error() string {
	return fmt.Sprintf("skipped %d records", e.skipped)
}

// syncTableWithDiagnostics 执行单表同步并返回诊断消息。
func syncTableWithDiagnostics(tableName, tableID string, fn func() error) ([]string, error) {
	if tableID == "" {
		return []string{fmt.Sprintf("table %s: skipped (table_id is empty)", tableName)}, nil
	}
	if err := fn(); err != nil {
		if partial, ok := err.(*partialSyncError); ok {
			return []string{fmt.Sprintf("table %s: partial success (table_id=%s, skipped %d records)", tableName, tableID, partial.skipped)}, nil
		}
		common.SysError(fmt.Sprintf("usage report base sync: table %s failed: %s; remote table may be partially synchronized and requires rerun", tableName, err))
		return []string{fmt.Sprintf("table %s: failed (table_id=%s): %s", tableName, tableID, err)}, fmt.Errorf("table %s: %w", tableName, err)
	}
	return []string{fmt.Sprintf("table %s: synced (table_id=%s)", tableName, tableID)}, nil
}

// syncAccountTable 同步账号周期统计表
func syncAccountTable(tenantToken, baseToken, tableID string, rp ReportPeriod) error {
	if tableID == "" {
		return nil
	}

	// 按周期类型覆盖：先删除同 period_type 的所有旧记录
	if err := deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, rp.PeriodType); err != nil {
		return err
	}

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAccount)
	if err != nil {
		return fmt.Errorf("query account snapshots: %w", err)
	}
	if len(items) == 0 {
		return nil
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		accountTypeLabel := "个人用户"
		if it.AccountType != nil && *it.AccountType == 1 {
			accountTypeLabel = "组织类智能体账号"
		}

		record := map[string]any{
			"__snapshot_id": it.Id,
			"统计周期类型":        rp.PeriodType,
			"统计周期":          rp.PeriodLabel,
			"周期开始":          formatUnix(rp.StartTimestamp),
			"周期结束":          formatUnix(rp.EndTimestamp),
			"账号类型":          accountTypeLabel,
			"用户名":           it.Username,
			"显示名称":          it.DisplayName,
			"用户分组":          it.UserGroup,
			"一级组织":          it.OrgLevel1Name,
			"二级组织":          it.OrgLevel2Name,
			"完整组织路径":        it.OrgPath,
			"请求次数":          it.RequestCount,
			"总Tokens":       it.TokenUsed,
			"Tokens(M)":     tokenToM(it.TokenUsed),
			"额度消耗":          it.Quota,
			"额度CNY":         it.QuotaCNY,
			"上周期Tokens":     it.PreviousTokenUsed,
			"Token环比(%)":    it.TokenGrowthRate,
			"是否异常":          it.IsAnomaly,
			"异常类型":          it.AnomalyType,
			"异常原因":          it.AnomalyReason,
			"预警等级":          it.WarningLevel,
		}

		// 飞书人员字段（仅当 open_id 合法时写入，避免 UserFieldConvFail）
		if isValidFeishuOpenID(it.ReceiverFeishuOpenId) {
			record["接收人员"] = []map[string]string{
				{"id": it.ReceiverFeishuOpenId},
			}
		}

		records = append(records, record)
	}

	results, err := batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
	if statusErr := applySnapshotSyncResults(items, results); statusErr != nil {
		return fmt.Errorf("update account snapshot sync status: %w", statusErr)
	}
	if err != nil {
		return err
	}
	skipped := countSkippedSyncResults(results)
	if skipped > 0 {
		return &partialSyncError{skipped: skipped}
	}
	return nil
}

func applyAccountSyncResults(items []*model.UsageReportSnapshot, results []baseRecordCreateResult) {
	_ = applySnapshotSyncResults(items, results)
}

func applySnapshotSyncResults(items []*model.UsageReportSnapshot, results []baseRecordCreateResult) error {
	for i, it := range items {
		if i >= len(results) || !results[i].Attempted {
			continue
		}
		status := model.SyncStatusFailed
		errMsg := results[i].Error
		if results[i].Success {
			status = model.SyncStatusSuccess
			errMsg = ""
		}
		if err := model.UpdateReportSnapshotSyncStatus(it.Id, status, errMsg); err != nil {
			return err
		}
	}
	return nil
}

func countSkippedSyncResults(results []baseRecordCreateResult) int {
	count := 0
	for _, result := range results {
		if result.Attempted && !result.Success && strings.Contains(result.Error, "UserFieldConvFail") {
			count++
		}
	}
	return count
}

// syncOrgTable 同步组织用量周期统计表
func syncOrgTable(tenantToken, baseToken, tableID string, rp ReportPeriod) error {
	if tableID == "" {
		return nil
	}
	if err := deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, rp.PeriodType); err != nil {
		return err
	}

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeOrgDept)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		record := map[string]any{
			"统计周期类型":     rp.PeriodType,
			"统计周期":       rp.PeriodLabel,
			"一级组织":       it.OrgLevel1Name,
			"二级组织":       it.OrgLevel2Name,
			"完整组织路径":     it.OrgPath,
			"组织内活跃用户数":   it.TotalUsers,
			"请求次数":       it.RequestCount,
			"总Tokens":    it.TokenUsed,
			"Tokens(M)":  tokenToM(it.TokenUsed),
			"额度消耗":       it.Quota,
			"额度CNY":      it.QuotaCNY,
			"上周期Tokens":  it.PreviousTokenUsed,
			"Token环比(%)": it.TokenGrowthRate,
		}
		records = append(records, record)
	}

	results, err := batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
	if statusErr := applySnapshotSyncResults(items, results); statusErr != nil {
		return fmt.Errorf("update org snapshot sync status: %w", statusErr)
	}
	return err
}

// syncPlatformTable 同步平台总览表
func syncPlatformTable(tenantToken, baseToken, tableID string, rp ReportPeriod) error {
	if tableID == "" {
		return nil
	}
	if err := deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, rp.PeriodType); err != nil {
		return err
	}

	item, err := model.GetPlatformSnapshot(rp.PeriodType, rp.StartTimestamp)
	if err != nil {
		return err
	}
	if item == nil {
		return nil
	}

	record := map[string]any{
		"统计周期类型":      rp.PeriodType,
		"统计周期":        rp.PeriodLabel,
		"周期开始":        formatUnix(rp.StartTimestamp),
		"周期结束":        formatUnix(rp.EndTimestamp),
		"总请求次数":       item.RequestCount,
		"总Tokens":     item.TokenUsed,
		"Tokens(M)":   tokenToM(item.TokenUsed),
		"总额度消耗":       item.Quota,
		"总额度CNY":      item.QuotaCNY,
		"上周期Tokens":   item.PreviousTokenUsed,
		"Token环比(%)":  item.TokenGrowthRate,
		"个人用户总数":      item.TotalUsers,
		"个人活跃用户数":     item.ActiveUsers,
		"个人未活跃用户数":    item.InactiveUsers,
		"个人新增用户数":     item.NewUsers,
		"飞书已绑定人数":     item.BoundFeishuUsers,
		"飞书未绑定人数":     item.UnboundFeishuUsers,
		"组织类智能体账号总数":  item.TotalOrgAccounts,
		"组织类智能体活跃账号数": item.ActiveOrgAccounts,
		"组织类智能体新增账号数": item.NewOrgAccounts,
	}

	results, err := batchCreateBaseRecords(tenantToken, baseToken, tableID, []map[string]any{record})
	if statusErr := applySnapshotSyncResults([]*model.UsageReportSnapshot{item}, results); statusErr != nil {
		return fmt.Errorf("update platform snapshot sync status: %w", statusErr)
	}
	return err
}

// syncModelTable 同步模型趋势表
func syncModelTable(tenantToken, baseToken, tableID string, rp ReportPeriod) error {
	if tableID == "" {
		return nil
	}
	if err := deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, rp.PeriodType); err != nil {
		return err
	}

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeModel)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		record := map[string]any{
			"统计周期类型":     rp.PeriodType,
			"统计周期":       rp.PeriodLabel,
			"模型名称":       it.ModelName,
			"请求次数":       it.RequestCount,
			"总Tokens":    it.TokenUsed,
			"Tokens(M)":  tokenToM(it.TokenUsed),
			"额度消耗":       it.Quota,
			"额度CNY":      it.QuotaCNY,
			"平台额度占比(%)":  it.UsageShare,
			"上周期Tokens":  it.PreviousTokenUsed,
			"Token环比(%)": it.TokenGrowthRate,
			"近7日均值":      it.Rolling7dAvgQuota,
			"近30日均值":     it.Rolling30dAvgQuota,
			"排名":         it.RankNo,
			"是否采购预警":     it.IsPurchaseWarning,
			"采购预警原因":     it.PurchaseWarningReason,
			"是否异常":       it.IsAnomaly,
			"异常原因":       it.AnomalyReason,
		}
		records = append(records, record)
	}

	results, err := batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
	if statusErr := applySnapshotSyncResults(items, results); statusErr != nil {
		return fmt.Errorf("update model snapshot sync status: %w", statusErr)
	}
	return err
}

// syncAnomalyTable 同步异常预警表
func syncAnomalyTable(tenantToken, baseToken, tableID string, rp ReportPeriod) error {
	if tableID == "" {
		return nil
	}
	if err := deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, rp.PeriodType); err != nil {
		return err
	}

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAnomaly)
	if err != nil {
		return err
	}
	if len(items) == 0 {
		return nil
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		accountTypeLabel := ""
		if it.AccountType != nil {
			if *it.AccountType == 1 {
				accountTypeLabel = "组织类智能体账号"
			} else {
				accountTypeLabel = "个人用户"
			}
		}

		record := map[string]any{
			"统计周期类型":     rp.PeriodType,
			"统计周期":       rp.PeriodLabel,
			"异常对象类型":     anomalyObjectType(it),
			"账号类型":       accountTypeLabel,
			"用户名":        it.Username,
			"模型名称":       it.ModelName,
			"请求次数":       it.RequestCount,
			"总Tokens":    it.TokenUsed,
			"Tokens(M)":  tokenToM(it.TokenUsed),
			"额度消耗":       it.Quota,
			"额度CNY":      it.QuotaCNY,
			"Token环比(%)": it.TokenGrowthRate,
			"异常类型":       it.AnomalyType,
			"异常原因":       it.AnomalyReason,
			"预警等级":       it.WarningLevel,
			"建议动作":       it.SuggestedAction,
		}

		// 人员字段
		if isValidFeishuOpenID(it.ReceiverFeishuOpenId) {
			record["人员"] = []map[string]string{
				{"id": it.ReceiverFeishuOpenId},
			}
		} else {
			record["人员"] = nil
		}

		records = append(records, record)
	}

	results, err := batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
	if statusErr := applySnapshotSyncResults(items, results); statusErr != nil {
		return fmt.Errorf("update anomaly snapshot sync status: %w", statusErr)
	}
	if err != nil {
		return err
	}
	skipped := countSkippedSyncResults(results)
	if skipped > 0 {
		return &partialSyncError{skipped: skipped}
	}
	return nil
}

// deleteBaseRecordsByPeriodType 按周期类型删除多维表格旧记录（每个周期类型只保留最新一份）
func deleteBaseRecordsByPeriodType(tenantToken, baseToken, tableID, periodType string) error {
	records, err := listAllBaseRecords(tenantToken, baseToken, tableID)
	if err != nil {
		return fmt.Errorf("list records for cleanup: %w", err)
	}

	var idsToDelete []string
	for _, r := range records {
		fields, ok := r["fields"].(map[string]any)
		if !ok {
			continue
		}
		val, _ := fields["统计周期类型"].(string)
		if val == periodType {
			if id, ok := r["record_id"].(string); ok {
				idsToDelete = append(idsToDelete, id)
			}
		}
	}

	if len(idsToDelete) == 0 {
		return nil
	}

	// 批量删除
	for i := 0; i < len(idsToDelete); i += 200 {
		end := i + 200
		if end > len(idsToDelete) {
			end = len(idsToDelete)
		}
		if err := deleteBaseRecords(tenantToken, baseToken, tableID, idsToDelete[i:end]); err != nil {
			return fmt.Errorf("delete old records: %w", err)
		}
		time.Sleep(300 * time.Millisecond)
	}
	return nil
}

// anomalyObjectType 判断异常对象类型
func anomalyObjectType(s *model.UsageReportSnapshot) string {
	if s.ModelName != "" && s.UserId == 0 {
		return "模型"
	}
	return "用户/账号"
}

// isValidFeishuOpenID 检查是否为合法的飞书 open_id（ou_ 开头）。
func isValidFeishuOpenID(id string) bool {
	return strings.HasPrefix(id, "ou_")
}

func formatUnix(ts int64) int64 {
	return ts * 1000
}
