package service

import (
	"fmt"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

// PushUsageReportToAdminGroup 兼容旧调用：不再直接发群，改为写入管理推送任务表。
func PushUsageReportToAdminGroup(periodType string) {
	PushUsageReportAdminTaskToBase(BuildReportPeriod(periodType, time.Now()))
}

// PushUsageReportAdminTaskToBase 将平台报表摘要写入多维表格，由飞书自动化决定推送目标。
func PushUsageReportAdminTaskToBase(rp ReportPeriod) {
	settings := system_setting.GetFeishuSettings()
	baseToken := strings.TrimSpace(settings.StatsBaseToken)
	tableID := strings.TrimSpace(settings.ReportTableAdminPushID)
	if baseToken == "" || tableID == "" {
		common.SysLog("usage report admin push task: base token or table id is empty, skip")
		return
	}
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		common.SysLog("usage report admin push task: app_id/app_secret is empty, skip")
		return
	}
	token, err := getFeishuTenantAccessToken(appID, appSecret)
	if err != nil {
		common.SysError(fmt.Sprintf("usage report admin push task: get token failed: %s", err))
		return
	}
	text := buildAdminGroupMessage(rp)
	if text == "" {
		return
	}
	deleteBaseRecordsByPeriod(token, baseToken, tableID, rp.PeriodLabel)
	batchCreateBaseRecords(token, baseToken, tableID, []map[string]any{buildAdminPushTaskRecord(rp, text, settings.StatsAdminChatID)})
	if plat, _ := model.GetPlatformSnapshot(rp.PeriodType, rp.StartTimestamp); plat != nil {
		model.UpdateReportSnapshotAdminPushStatus(plat.Id, model.SyncStatusSuccess, "")
	}
	common.SysLog(fmt.Sprintf("usage report admin push task: wrote %s report task for %s", rp.PeriodType, rp.PeriodLabel))
}

// buildAdminGroupMessage 生成管理群推送文本
func buildAdminGroupMessage(rp ReportPeriod) string {
	var sb strings.Builder

	// 标题
	periodLabel := "日报"
	switch rp.PeriodType {
	case model.ReportPeriodWeekly:
		periodLabel = "周报"
	case model.ReportPeriodMonthly:
		periodLabel = "月报"
	}

	sb.WriteString(fmt.Sprintf("📊 平台 AI 用量%s\n", periodLabel))
	sb.WriteString(fmt.Sprintf("周期：%s\n\n", rp.PeriodLabel))

	// 平台总览
	platform, _ := model.GetPlatformSnapshot(rp.PeriodType, rp.StartTimestamp)
	if platform != nil {
		sb.WriteString("━━━ 平台整体 ━━━\n")
		sb.WriteString(fmt.Sprintf("总请求：%s 次\n", formatInt(platform.RequestCount)))
		sb.WriteString(fmt.Sprintf("总 Tokens：%s\n", formatTokens(platform.TokenUsed)))
		sb.WriteString(fmt.Sprintf("额度消耗：%.2f USD / %.2f CNY\n", platform.QuotaUSD, platform.QuotaCNY))
		if platform.PreviousQuota > 0 {
			sb.WriteString(fmt.Sprintf("较上周期：%.1f%%\n", platform.QuotaGrowthRate))
		}
		sb.WriteString("\n")

		// 人员
		sb.WriteString("━━━ 用户情况 ━━━\n")
		sb.WriteString(fmt.Sprintf("个人用户：活跃 %d / 总 %d（新增 %d）\n", platform.ActiveUsers, platform.TotalUsers, platform.NewUsers))
		sb.WriteString(fmt.Sprintf("组织类智能体账号：活跃 %d / 总 %d（新增 %d）\n", platform.ActiveOrgAccounts, platform.TotalOrgAccounts, platform.NewOrgAccounts))
		sb.WriteString(fmt.Sprintf("飞书已绑定：%d / 未绑定：%d\n", platform.BoundFeishuUsers, platform.UnboundFeishuUsers))
		sb.WriteString("\n")
	}

	// Top 用户/账号
	accountItems, _ := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeAccount)
	if len(accountItems) > 0 {
		sb.WriteString("━━━ Top 用户/账号 ━━━\n")
		limit := 5
		if len(accountItems) < limit {
			limit = len(accountItems)
		}
		for i := 0; i < limit; i++ {
			it := accountItems[i]
			typeLabel := ""
			if it.AccountType != nil && *it.AccountType == 1 {
				typeLabel = "[智能体] "
			}
			sb.WriteString(fmt.Sprintf("%d. %s%s：%s tokens，%.2f USD\n",
				i+1, typeLabel, displayName(it), formatTokens(it.TokenUsed), it.QuotaUSD))
		}
		sb.WriteString("\n")
	}

	// Top 模型
	modelItems, _ := model.GetReportSnapshots(rp.PeriodType, rp.StartTimestamp, model.ReportScopeModel)
	if len(modelItems) > 0 {
		sb.WriteString("━━━ Top 模型 ━━━\n")
		limit := 5
		if len(modelItems) < limit {
			limit = len(modelItems)
		}
		for i := 0; i < limit; i++ {
			it := modelItems[i]
			sb.WriteString(fmt.Sprintf("%d. %s：%.2f USD（占比 %.1f%%）\n",
				i+1, it.ModelName, it.QuotaUSD, it.UsageShare))
		}
		sb.WriteString("\n")
	}

	// 采购预警
	var warnings []*model.UsageReportSnapshot
	for _, it := range modelItems {
		if it.IsPurchaseWarning {
			warnings = append(warnings, it)
		}
	}
	if len(warnings) > 0 {
		sb.WriteString("━━━ ⚠️ 采购预警 ━━━\n")
		limit := 5
		if len(warnings) < limit {
			limit = len(warnings)
		}
		for i := 0; i < limit; i++ {
			it := warnings[i]
			sb.WriteString(fmt.Sprintf("%d. %s：%s\n", i+1, it.ModelName, it.PurchaseWarningReason))
		}
		sb.WriteString("\n")
	}

	// 异常用户
	var anomalies []*model.UsageReportSnapshot
	for _, it := range accountItems {
		if it.IsAnomaly {
			anomalies = append(anomalies, it)
		}
	}
	if len(anomalies) > 0 {
		sb.WriteString("━━━ 🔴 异常用量 ━━━\n")
		limit := 5
		if len(anomalies) < limit {
			limit = len(anomalies)
		}
		for i := 0; i < limit; i++ {
			it := anomalies[i]
			sb.WriteString(fmt.Sprintf("%d. %s：%s\n", i+1, displayName(it), it.AnomalyReason))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("━━━━━━━━━━━━━━━━\n")
	sb.WriteString(fmt.Sprintf("数据生成时间：%s\n", time.Now().Format("2006-01-02 15:04:05")))

	return sb.String()
}

func displayName(s *model.UsageReportSnapshot) string {
	if s.DisplayName != "" {
		return s.DisplayName
	}
	if s.Username != "" {
		return s.Username
	}
	if s.ReceiverName != "" {
		return s.ReceiverName
	}
	return fmt.Sprintf("用户#%d", s.UserId)
}

func formatInt(n int) string {
	if n >= 10000 {
		return fmt.Sprintf("%.1f万", float64(n)/10000)
	}
	return fmt.Sprintf("%d", n)
}

func formatTokens(n int) string {
	if n >= 1000000 {
		return fmt.Sprintf("%.1fM", float64(n)/1000000)
	}
	if n >= 1000 {
		return fmt.Sprintf("%.1fK", float64(n)/1000)
	}
	return fmt.Sprintf("%d", n)
}

func buildAdminPushTaskRecord(rp ReportPeriod, text, chatID string) map[string]any {
	return map[string]any{
		"统计周期类型":    rp.PeriodType,
		"统计周期":      rp.PeriodLabel,
		"周期开始":      formatUnix(rp.StartTimestamp),
		"周期结束":      formatUnix(rp.EndTimestamp),
		"推送标题":      adminPushTitle(rp),
		"推送内容":      text,
		"推送类型":      adminPushType(rp),
		"推送状态":      "待推送",
		"目标说明":      "由多维表格自动化决定推送目标",
		"目标chat_id": strings.TrimSpace(chatID),
		"是否启用":      true,
		"生成时间":      formatUnix(time.Now().Unix()),
		"错误信息":      "",
	}
}

func adminPushTitle(rp ReportPeriod) string {
	return fmt.Sprintf("平台 AI 用量%s（%s）", adminPushPeriodLabel(rp), rp.PeriodLabel)
}

func adminPushType(rp ReportPeriod) string {
	return "平台" + adminPushPeriodLabel(rp)
}

func adminPushPeriodLabel(rp ReportPeriod) string {
	switch rp.PeriodType {
	case model.ReportPeriodWeekly:
		return "周报"
	case model.ReportPeriodMonthly:
		return "月报"
	default:
		return "日报"
	}
}
