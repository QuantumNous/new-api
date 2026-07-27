package service

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/QuantumNous/new-api/setting/system_setting"

	"github.com/bytedance/gopkg/util/gopool"
)

const (
	statsPushTickInterval = 1 * time.Minute
)

var statsPushOnce sync.Once

// 飞书多维表格 table_id 映射
var statsTables = map[string]map[string]string{
	"daily": {
		"user":  "tblh99epOroWLR5r",
		"model": "tblEscSQZy3DhIo0",
		"org":   "tblXNHmTbqeoeZPF",
	},
	"weekly": {
		"user":  "tblNafpc5kJfq9nB",
		"model": "tbl7EcnkHcJqvzmt",
		"org":   "tblRbzIvh6UG4Gub",
	},
	"monthly": {
		"user":  "tbl27p9Uo1EQcg1r",
		"model": "tblShRXIJD13NdfA",
		"org":   "tblpR0qquv8LTUA1",
	},
}

func StartFeishuStatsPushTask() {
	statsPushOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(statsPushTickInterval)
			defer ticker.Stop()
			for range ticker.C {
				runFeishuStatsPushIfNeeded()
			}
		})
	})
}

func runFeishuStatsPushIfNeeded() {
	now := time.Now()
	hour, minute, weekday := now.Hour(), now.Minute(), now.Weekday()
	day := now.Day()

	settings := system_setting.GetFeishuSettings()

	// 新快照体系：生成快照 -> 同步多维表格 -> 推送管理群
	// 个人/组织账号推送交给多维表格自动化（基于人员字段）
	if settings.UsageReportEnabled {
		// 每天凌晨 3:00 生成日报
		if hour == 3 && minute == 0 {
			RunUsageReportFullPipeline(model.ReportPeriodDaily)
		}

		// 周一凌晨 3:30 生成周报
		if weekday == time.Monday && hour == 3 && minute == 30 {
			RunUsageReportFullPipeline(model.ReportPeriodWeekly)
		}

		// 每月 1 号凌晨 4:00 生成月报
		if day == 1 && hour == 4 && minute == 0 {
			RunUsageReportFullPipeline(model.ReportPeriodMonthly)
		}
	}
}

type FeishuStatsPushRequest struct {
	Period         string `json:"period"`
	Label          string `json:"label"`
	StartTimestamp int64  `json:"start_timestamp"`
	EndTimestamp   int64  `json:"end_timestamp"`
	StartTime      string `json:"start_time"`
	EndTime        string `json:"end_time"`
}

func BuildFeishuStatsPushRequest(period string, now time.Time) FeishuStatsPushRequest {
	switch period {
	case "daily":
		yesterday := now.AddDate(0, 0, -1)
		start := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, now.Location())
		end := start.AddDate(0, 0, 1).Add(-time.Second)
		return newFeishuStatsPushRequest(period, start.Format("2006-01-02"), start, end)
	case "weekly":
		thisMonday := startOfWeek(now)
		lastMonday := thisMonday.AddDate(0, 0, -7)
		lastSunday := thisMonday.Add(-time.Second)
		label := lastMonday.Format("2006-01-02") + " ~ " + lastSunday.Format("2006-01-02")
		return newFeishuStatsPushRequest(period, label, lastMonday, lastSunday)
	case "monthly":
		thisMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastMonthStart := thisMonthStart.AddDate(0, -1, 0)
		lastMonthEnd := thisMonthStart.Add(-time.Second)
		return newFeishuStatsPushRequest(period, lastMonthStart.Format("2006-01"), lastMonthStart, lastMonthEnd)
	default:
		return FeishuStatsPushRequest{Period: period}
	}
}

func ManualPushFeishuStats(period string) FeishuStatsPushRequest {
	req := BuildFeishuStatsPushRequest(period, time.Now())
	pushStatsToFeishu(req.Period, req.Label, req.StartTimestamp, req.EndTimestamp)
	return req
}

func newFeishuStatsPushRequest(period, label string, start, end time.Time) FeishuStatsPushRequest {
	return FeishuStatsPushRequest{
		Period:         period,
		Label:          label,
		StartTimestamp: start.Unix(),
		EndTimestamp:   end.Unix(),
		StartTime:      start.Format(time.RFC3339),
		EndTime:        end.Format(time.RFC3339),
	}
}

func startOfWeek(t time.Time) time.Time {
	dayStart := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	weekday := int(dayStart.Weekday())
	if weekday == 0 {
		weekday = 7
	}
	return dayStart.AddDate(0, 0, 1-weekday)
}

func pushStatsToFeishu(period, dateLabel string, startTimestamp, endTimestamp int64) {
	settings := system_setting.GetFeishuSettings()
	baseToken := strings.TrimSpace(settings.StatsBaseToken)
	if baseToken == "" {
		return
	}
	appID := strings.TrimSpace(settings.AppID)
	appSecret := strings.TrimSpace(settings.AppSecret)
	if appID == "" || appSecret == "" {
		return
	}

	token, err := getFeishuTenantAccessToken(appID, appSecret)
	if err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: get token failed: %s", err))
		return
	}

	tables, ok := statsTables[period]
	if !ok {
		return
	}

	common.SysLog(fmt.Sprintf("feishu stats push: start pushing %s stats for %s", period, dateLabel))

	// 1. 清空再写入
	if err := clearBaseTableRecords(token, baseToken, tables["user"]); err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: clear user table failed: %s", err))
	}
	if err := clearBaseTableRecords(token, baseToken, tables["model"]); err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: clear model table failed: %s", err))
	}
	if err := clearBaseTableRecords(token, baseToken, tables["org"]); err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: clear org table failed: %s", err))
	}

	// 2. 查询并写入用户用量
	pushUserStats(token, baseToken, tables["user"], dateLabel, startTimestamp, endTimestamp)
	// 3. 查询并写入模型用量
	pushModelStats(token, baseToken, tables["model"], dateLabel, startTimestamp, endTimestamp)
	// 4. 查询并写入组织用量
	pushOrgStats(token, baseToken, tables["org"], dateLabel, startTimestamp, endTimestamp)

	common.SysLog(fmt.Sprintf("feishu stats push: completed %s stats for %s", period, dateLabel))
}

func pushUserStats(token, baseToken, tableID, dateLabel string, startTimestamp, endTimestamp int64) {
	items, _, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, nil, nil, "", nil, 1, 5000)
	if err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: query user stats failed: %s", err))
		return
	}
	if len(items) == 0 {
		return
	}

	dateField := "统计日期"
	if strings.Contains(dateLabel, "~") {
		dateField = "统计周期"
	} else if len(dateLabel) == 7 {
		dateField = "统计月份"
	}

	var records []map[string]any
	for _, it := range items {
		records = append(records, map[string]any{
			dateField:   dateLabel,
			"用户名":       it.Username,
			"用户分组":      it.UserGroup,
			"完整组织路径":    it.OrgPath,
			"请求次数":      it.Count,
			"总Tokens":   it.TokenUsed,
			"Tokens(M)": tokenToM(it.TokenUsed),
			"额度消耗":      it.Quota,
			"额度USD":     quotaToUSD(it.Quota),
			"额度CNY":     quotaToCNY(it.Quota),
		})
	}
	if _, err := batchCreateBaseRecords(token, baseToken, tableID, records); err != nil {
		common.SysError(fmt.Sprintf("feishu stats push: create user records failed: %s", err))
	}
}

func pushModelStats(token, baseToken, tableID, dateLabel string, startTimestamp, endTimestamp int64) {
	items, _, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, nil, nil, "", nil, 1, 5000)
	if err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: query model stats failed: %s", err))
		return
	}
	if len(items) == 0 {
		return
	}

	dateField := "统计日期"
	if strings.Contains(dateLabel, "~") {
		dateField = "统计周期"
	} else if len(dateLabel) == 7 {
		dateField = "统计月份"
	}

	var records []map[string]any
	for _, it := range items {
		records = append(records, map[string]any{
			dateField:   dateLabel,
			"模型名称":      it.ModelName,
			"请求次数":      it.Count,
			"总Tokens":   it.TokenUsed,
			"Tokens(M)": tokenToM(it.TokenUsed),
			"额度消耗":      it.Quota,
			"额度USD":     quotaToUSD(it.Quota),
			"额度CNY":     quotaToCNY(it.Quota),
		})
	}
	if _, err := batchCreateBaseRecords(token, baseToken, tableID, records); err != nil {
		common.SysError(fmt.Sprintf("feishu stats push: create model records failed: %s", err))
	}
}

func pushOrgStats(token, baseToken, tableID, dateLabel string, startTimestamp, endTimestamp int64) {
	items, _, err := model.GetUserModelStatsByDepartment(startTimestamp, endTimestamp, nil, nil, "", nil, 1, 5000)
	if err != nil {
		common.SysLog(fmt.Sprintf("feishu stats push: query org stats failed: %s", err))
		return
	}
	if len(items) == 0 {
		return
	}

	dateField := "统计日期"
	if strings.Contains(dateLabel, "~") {
		dateField = "统计周期"
	} else if len(dateLabel) == 7 {
		dateField = "统计月份"
	}

	var records []map[string]any
	for _, it := range items {
		records = append(records, map[string]any{
			dateField:   dateLabel,
			"一级组织":      it.OrgLevel1Name,
			"二级组织":      it.OrgLevel2Name,
			"请求次数":      it.Count,
			"总Tokens":   it.TokenUsed,
			"Tokens(M)": tokenToM(it.TokenUsed),
			"额度消耗":      it.Quota,
			"额度USD":     quotaToUSD(it.Quota),
			"额度CNY":     quotaToCNY(it.Quota),
		})
	}
	if _, err := batchCreateBaseRecords(token, baseToken, tableID, records); err != nil {
		common.SysError(fmt.Sprintf("feishu stats push: create org records failed: %s", err))
	}
}

func quotaToUSD(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func quotaToCNY(quota int) float64 {
	return quotaToUSD(quota) * operation_setting.USDExchangeRate
}

func tokenToM(tokens int) float64 {
	return float64(tokens) / 1_000_000
}

// --- 飞书多维表格 API 操作 ---

func clearBaseTableRecords(token, baseToken, tableID string) error {
	// 先列出所有记录
	records, err := listAllBaseRecords(token, baseToken, tableID)
	if err != nil {
		return err
	}
	if len(records) == 0 {
		return nil
	}

	// 批量删除，每批 200 条
	for i := 0; i < len(records); i += 200 {
		end := i + 200
		if end > len(records) {
			end = len(records)
		}
		var ids []string
		for _, r := range records[i:end] {
			if id, ok := r["record_id"].(string); ok {
				ids = append(ids, id)
			}
		}
		if err := deleteBaseRecords(token, baseToken, tableID, ids); err != nil {
			return err
		}
		time.Sleep(300 * time.Millisecond)
	}
	return nil
}

var feishuStatsAPIGet = feishuAPIGet

func listAllBaseRecords(token, baseToken, tableID string) ([]map[string]any, error) {
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/bitable/v1/apps/%s/tables/%s/records?page_size=200", baseToken, tableID)
	var allRecords []map[string]any
	pageToken := ""

	for {
		reqURL := url
		if pageToken != "" {
			reqURL += "&page_token=" + pageToken
		}
		body, err := feishuStatsAPIGet(token, reqURL)
		if err != nil {
			return nil, err
		}

		var resp struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
			Data struct {
				Items     []map[string]any `json:"items"`
				Total     int              `json:"total"`
				HasMore   bool             `json:"has_more"`
				PageToken string           `json:"page_token"`
			} `json:"data"`
		}
		if err := common.Unmarshal(body, &resp); err != nil {
			return nil, err
		}
		if resp.Code != 0 {
			return nil, fmt.Errorf("list records error: code=%d msg=%s", resp.Code, resp.Msg)
		}

		allRecords = append(allRecords, resp.Data.Items...)
		if !resp.Data.HasMore {
			break
		}
		pageToken = resp.Data.PageToken
	}
	return allRecords, nil
}

func deleteBaseRecords(token, baseToken, tableID string, recordIDs []string) error {
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/bitable/v1/apps/%s/tables/%s/records/batch_delete", baseToken, tableID)
	payload := map[string]any{"records": recordIDs}
	body, err := common.Marshal(payload)
	if err != nil {
		return err
	}
	respBody, err := feishuStatsAPIPost(token, url, body)
	if err != nil {
		return err
	}
	var resp struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		return err
	}
	if resp.Code != 0 {
		return fmt.Errorf("delete records error: code=%d msg=%s", resp.Code, resp.Msg)
	}
	return nil
}

type baseRecordCreateResult struct {
	Index     int
	Attempted bool
	Success   bool
	Error     string
}

var feishuStatsAPIPost = feishuAPIPost

func batchCreateBaseRecords(token, baseToken, tableID string, records []map[string]any) ([]baseRecordCreateResult, error) {
	results := make([]baseRecordCreateResult, len(records))
	for i := range results {
		results[i].Index = i
	}
	for i := 0; i < len(records); i += 200 {
		end := i + 200
		if end > len(records) {
			end = len(records)
		}
		if err := createBaseRecordBatch(token, baseToken, tableID, records[i:end], i, results); err != nil {
			return results, err
		}
		time.Sleep(500 * time.Millisecond)
	}
	return results, nil
}

func createBaseRecordBatch(token, baseToken, tableID string, records []map[string]any, offset int, results []baseRecordCreateResult) error {
	for i := range records {
		results[offset+i].Attempted = true
	}
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/bitable/v1/apps/%s/tables/%s/records/batch_create", baseToken, tableID)
	fields := make([]map[string]any, 0, len(records))
	for _, record := range records {
		publicRecord := make(map[string]any, len(record))
		for key, value := range record {
			if !strings.HasPrefix(key, "__") {
				publicRecord[key] = value
			}
		}
		fields = append(fields, map[string]any{"fields": publicRecord})
	}
	body, err := common.Marshal(map[string]any{"records": fields})
	if err != nil {
		batchErr := fmt.Errorf("marshal records: %w", err)
		setBaseRecordBatchError(results, offset, len(records), batchErr)
		return batchErr
	}
	respBody, err := feishuStatsAPIPost(token, url, body)
	if err != nil {
		batchErr := fmt.Errorf("create records: %w", err)
		setBaseRecordBatchError(results, offset, len(records), batchErr)
		return batchErr
	}
	var resp struct {
		Code int    `json:"code"`
		Msg  string `json:"msg"`
	}
	if err := common.Unmarshal(respBody, &resp); err != nil {
		batchErr := fmt.Errorf("parse create records response: %w", err)
		setBaseRecordBatchError(results, offset, len(records), batchErr)
		return batchErr
	}
	if resp.Code == 0 {
		for i := range records {
			results[offset+i].Success = true
		}
		return nil
	}
	if resp.Code != 1254066 || resp.Msg != "UserFieldConvFail" {
		batchErr := fmt.Errorf("create records error: code=%d msg=%s", resp.Code, resp.Msg)
		setBaseRecordBatchError(results, offset, len(records), batchErr)
		return batchErr
	}
	if len(records) == 1 {
		result := &results[offset]
		result.Error = fmt.Sprintf("code=%d msg=%s", resp.Code, resp.Msg)
		common.SysError(fmt.Sprintf("feishu stats push: skip invalid user record: table_id=%s snapshot=%v username=%v open_id=%v error=%s", tableID, records[0]["__snapshot_id"], records[0]["用户名"], recordFeishuOpenID(records[0]), result.Error))
		return nil
	}
	mid := len(records) / 2
	if err := createBaseRecordBatch(token, baseToken, tableID, records[:mid], offset, results); err != nil {
		return err
	}
	return createBaseRecordBatch(token, baseToken, tableID, records[mid:], offset+mid, results)
}

func setBaseRecordBatchError(results []baseRecordCreateResult, offset, count int, err error) {
	for i := 0; i < count; i++ {
		results[offset+i].Error = err.Error()
	}
}

func recordFeishuOpenID(record map[string]any) string {
	for _, fieldName := range []string{"接收人员", "人员"} {
		people, ok := record[fieldName].([]map[string]string)
		if ok && len(people) > 0 {
			return people[0]["id"]
		}
	}
	return ""
}

func feishuAPIGet(token, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(context.Background(), "GET", url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func feishuAPIPost(token, url string, body []byte) ([]byte, error) {
	req, err := http.NewRequestWithContext(context.Background(), "POST", url, bytes.NewBuffer(body))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	client := http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
