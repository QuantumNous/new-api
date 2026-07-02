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
	SyncUsageReportPeriodToBaseWithDiagnostics(rp)
}

// SyncUsageReportPeriodToBaseWithDiagnostics 同步并返回诊断消息列表。
func SyncUsageReportPeriodToBaseWithDiagnostics(rp ReportPeriod) []string {
	var msgs []string
	settings := system_setting.GetFeishuSettings()
	baseToken := strings.TrimSpace(settings.StatsBaseToken)
	if baseToken == "" {
		msgs = append(msgs, "skip: stats_base_token is empty")
		common.SysLog("usage report base sync: stats_base_token is empty, skip")
		return msgs
	}
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		msgs = append(msgs, "skip: app_id or app_secret is empty")
		common.SysLog("usage report base sync: app_id/app_secret is empty, skip")
		return msgs
	}

	token, err := getFeishuTenantAccessToken(appID, appSecret)
	if err != nil {
		msg := fmt.Sprintf("get token failed: %s", err)
		msgs = append(msgs, msg)
		common.SysError("usage report base sync: " + msg)
		return msgs
	}

	if rp.PeriodType == "" {
		msgs = append(msgs, "skip: period_type is empty")
		return msgs
	}

	common.SysLog(fmt.Sprintf("usage report base sync: start syncing %s for %s", rp.PeriodType, rp.PeriodLabel))

	// 同步5张表，收集各表的诊断信息
	tableMsgs := syncTableWithDiagnostics("account", settings.ReportTableAccountID, func() {
		syncAccountTable(token, baseToken, settings.ReportTableAccountID, rp)
	})
	msgs = append(msgs, tableMsgs...)

	tableMsgs = syncTableWithDiagnostics("token", settings.ReportTableTokenID, func() {
		syncTokenTable(token, baseToken, settings.ReportTableTokenID, rp)
	})
	msgs = append(msgs, tableMsgs...)

	tableMsgs = syncTableWithDiagnostics("platform", settings.ReportTablePlatformID, func() {
		syncPlatformTable(token, baseToken, settings.ReportTablePlatformID, rp)
	})
	msgs = append(msgs, tableMsgs...)

	tableMsgs = syncTableWithDiagnostics("model", settings.ReportTableModelID, func() {
		syncModelTable(token, baseToken, settings.ReportTableModelID, rp)
	})
	msgs = append(msgs, tableMsgs...)

	tableMsgs = syncTableWithDiagnostics("anomaly", settings.ReportTableAnomalyID, func() {
		syncAnomalyTable(token, baseToken, settings.ReportTableAnomalyID, rp)
	})
	msgs = append(msgs, tableMsgs...)

	common.SysLog(fmt.Sprintf("usage report base sync: completed %s for %s", rp.PeriodType, rp.PeriodLabel))
	return msgs
}

// syncTableWithDiagnostics 执行单表同步并返回诊断消息。
func syncTableWithDiagnostics(tableName, tableID string, fn func()) []string {
	if tableID == "" {
		return []string{fmt.Sprintf("table %s: skipped (table_id is empty)")}
	}
	fn()
	return []string{fmt.Sprintf("table %s: synced (table_id=%s)", tableName, tableID)}
}

// syncAccountTable 同步账号周期统计表
func syncAccountTable(tenantToken, baseToken, tableID string, rp ReportPeriod) {
	if tableID == "" {
		return
	}

	// 按周期覆盖：先删除同 period_type + period_label 的旧记录
	deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, rp.PeriodLabel)

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAccount)
	if err != nil {
		common.SysError(fmt.Sprintf("usage report base sync: query account snapshots failed: %s", err))
		return
	}
	if len(items) == 0 {
		return
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		accountTypeLabel := "个人用户"
		if it.AccountType != nil && *it.AccountType == 1 {
			accountTypeLabel = "组织类智能体账号"
		}

		record := map[string]any{
			"统计周期类型":     rp.PeriodType,
			"统计周期":       rp.PeriodLabel,
			"周期开始":       formatUnix(rp.StartTimestamp),
			"周期结束":       formatUnix(rp.EndTimestamp),
			"账号类型":       accountTypeLabel,
			"用户ID":       it.UserId,
			"用户名":        it.Username,
			"显示名称":       it.DisplayName,
			"用户分组":       it.UserGroup,
			"接收人类型":      it.ReceiverType,
			"接收人姓名":      it.ReceiverName,
			"接收人open_id": it.ReceiverFeishuOpenId,
			"一级组织":       it.OrgLevel1Name,
			"二级组织":       it.OrgLevel2Name,
			"完整组织路径":     it.OrgPath,
			"请求次数":       it.RequestCount,
			"总Tokens":    it.TokenUsed,
			"Tokens(M)":  tokenToM(it.TokenUsed),
			"额度消耗":       it.Quota,
			"额度USD":      it.QuotaUSD,
			"额度CNY":      it.QuotaCNY,
			"上周期额度":      it.PreviousQuota,
			"额度环比(%)":    it.QuotaGrowthRate,
			"是否异常":       it.IsAnomaly,
			"异常类型":       it.AnomalyType,
			"异常原因":       it.AnomalyReason,
			"预警等级":       it.WarningLevel,
		}

		// 飞书人员字段（用 open_id 关联）
		if it.ReceiverFeishuOpenId != "" {
			record["接收人员"] = []map[string]string{
				{"id": it.ReceiverFeishuOpenId},
			}
		} else {
			record["接收人员"] = ""
		}

		records = append(records, record)
	}

	batchCreateBaseRecords(tenantToken, baseToken, tableID, records)

	// 回写同步状态
	for _, it := range items {
		model.UpdateReportSnapshotSyncStatus(it.Id, model.SyncStatusSuccess, "")
	}
}

// syncTokenTable 同步Token周期统计表
func syncTokenTable(tenantToken, baseToken, tableID string, rp ReportPeriod) {
	if tableID == "" {
		return
	}
	deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, rp.PeriodLabel)

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeToken)
	if err != nil || len(items) == 0 {
		return
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		accountTypeLabel := "个人用户"
		if it.AccountType != nil && *it.AccountType == 1 {
			accountTypeLabel = "组织类智能体账号"
		}

		record := map[string]any{
			"统计周期类型":    rp.PeriodType,
			"统计周期":      rp.PeriodLabel,
			"账号类型":      accountTypeLabel,
			"用户ID":      it.UserId,
			"用户名":       it.Username,
			"模型名称":      it.ModelName,
			"请求次数":      it.RequestCount,
			"总Tokens":   it.TokenUsed,
			"Tokens(M)": tokenToM(it.TokenUsed),
			"额度消耗":      it.Quota,
			"额度USD":     it.QuotaUSD,
			"额度CNY":     it.QuotaCNY,
			"上周期额度":     it.PreviousQuota,
			"额度环比(%)":   it.QuotaGrowthRate,
		}

		if it.ReceiverFeishuOpenId != "" {
			record["接收人员"] = []map[string]string{
				{"id": it.ReceiverFeishuOpenId},
			}
		} else {
			record["接收人员"] = ""
		}

		records = append(records, record)
	}

	batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
}

// syncPlatformTable 同步平台总览表
func syncPlatformTable(tenantToken, baseToken, tableID string, rp ReportPeriod) {
	if tableID == "" {
		return
	}
	deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, rp.PeriodLabel)

	item, err := model.GetPlatformSnapshot(rp.PeriodType, rp.StartTimestamp)
	if err != nil || item == nil {
		return
	}

	record := map[string]any{
		"统计周期类型":      rp.PeriodType,
		"统计周期":        rp.PeriodLabel,
		"周期开始":        formatUnix(rp.StartTimestamp),
		"周期结束":        formatUnix(rp.EndTimestamp),
		"总请求次数":       item.RequestCount,
		"总Tokens":     item.TokenUsed,
		"总额度消耗":       item.Quota,
		"总额度USD":      item.QuotaUSD,
		"总额度CNY":      item.QuotaCNY,
		"上周期额度":       item.PreviousQuota,
		"额度环比(%)":     item.QuotaGrowthRate,
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

	batchCreateBaseRecords(tenantToken, baseToken, tableID, []map[string]any{record})

	model.UpdateReportSnapshotSyncStatus(item.Id, model.SyncStatusSuccess, "")
}

// syncModelTable 同步模型趋势表
func syncModelTable(tenantToken, baseToken, tableID string, rp ReportPeriod) {
	if tableID == "" {
		return
	}
	deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, rp.PeriodLabel)

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeModel)
	if err != nil || len(items) == 0 {
		return
	}

	records := make([]map[string]any, 0, len(items))
	for _, it := range items {
		record := map[string]any{
			"统计周期类型":    rp.PeriodType,
			"统计周期":      rp.PeriodLabel,
			"模型名称":      it.ModelName,
			"请求次数":      it.RequestCount,
			"总Tokens":   it.TokenUsed,
			"Tokens(M)": tokenToM(it.TokenUsed),
			"额度消耗":      it.Quota,
			"额度USD":     it.QuotaUSD,
			"额度CNY":     it.QuotaCNY,
			"平台额度占比(%)": it.UsageShare,
			"上周期额度":     it.PreviousQuota,
			"额度环比(%)":   it.QuotaGrowthRate,
			"近7日均值":     it.Rolling7dAvgQuota,
			"近30日均值":    it.Rolling30dAvgQuota,
			"排名":        it.RankNo,
			"是否采购预警":    it.IsPurchaseWarning,
			"采购预警原因":    it.PurchaseWarningReason,
			"是否异常":      it.IsAnomaly,
			"异常原因":      it.AnomalyReason,
		}
		records = append(records, record)
	}

	batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
}

// syncAnomalyTable 同步异常预警表
func syncAnomalyTable(tenantToken, baseToken, tableID string, rp ReportPeriod) {
	if tableID == "" {
		return
	}
	deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, rp.PeriodLabel)

	items, err := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAnomaly)
	if err != nil || len(items) == 0 {
		return
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
			"统计周期类型":  rp.PeriodType,
			"统计周期":    rp.PeriodLabel,
			"异常对象类型":  anomalyObjectType(it),
			"账号类型":    accountTypeLabel,
			"用户ID":    it.UserId,
			"用户名":     it.Username,
			"模型名称":    it.ModelName,
			"请求次数":    it.RequestCount,
			"总Tokens": it.TokenUsed,
			"额度消耗":    it.Quota,
			"额度USD":   it.QuotaUSD,
			"增长率(%)":  it.QuotaGrowthRate,
			"异常类型":    it.AnomalyType,
			"异常原因":    it.AnomalyReason,
			"预警等级":    it.WarningLevel,
			"建议动作":    it.SuggestedAction,
		}

		// 人员字段
		if it.ReceiverFeishuOpenId != "" {
			record["人员"] = []map[string]string{
				{"id": it.ReceiverFeishuOpenId},
			}
		} else {
			record["人员"] = ""
		}

		records = append(records, record)
	}

	batchCreateBaseRecords(tenantToken, baseToken, tableID, records)
}

// deleteBaseRecordsByPeriod 按周期标签删除多维表格旧记录（覆盖式写入）
func deleteBaseRecordsByPeriod(tenantToken, baseToken, tableID, periodLabel string) {
	records, err := listAllBaseRecords(tenantToken, baseToken, tableID)
	if err != nil {
		common.SysError(fmt.Sprintf("usage report base sync: list records for cleanup failed: %s", err))
		return
	}

	var idsToDelete []string
	for _, r := range records {
		fields, ok := r["fields"].(map[string]any)
		if !ok {
			continue
		}
		val, _ := fields["统计周期"].(string)
		if val == periodLabel {
			if id, ok := r["record_id"].(string); ok {
				idsToDelete = append(idsToDelete, id)
			}
		}
	}

	if len(idsToDelete) == 0 {
		return
	}

	// 批量删除
	for i := 0; i < len(idsToDelete); i += 200 {
		end := i + 200
		if end > len(idsToDelete) {
			end = len(idsToDelete)
		}
		if err := deleteBaseRecords(tenantToken, baseToken, tableID, idsToDelete[i:end]); err != nil {
			common.SysError(fmt.Sprintf("usage report base sync: delete old records failed: %s", err))
		}
		time.Sleep(300 * time.Millisecond)
	}
}

// anomalyObjectType 判断异常对象类型
func anomalyObjectType(s *model.UsageReportSnapshot) string {
	if s.ModelName != "" && s.UserId == 0 {
		return "模型"
	}
	return "用户/账号"
}

func formatUnix(ts int64) string {
	return time.Unix(ts, 0).Format("2006-01-02 15:04:05")
}
