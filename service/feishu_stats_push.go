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

	// 每天凌晨 3:00 推送前一天日报
	if hour == 3 && minute == 0 {
		yesterday := now.AddDate(0, 0, -1)
		start := time.Date(yesterday.Year(), yesterday.Month(), yesterday.Day(), 0, 0, 0, 0, now.Location())
		end := start.AddDate(0, 0, 1).Add(-time.Second)
		dateLabel := start.Format("2006-01-02")
		pushStatsToFeishu("daily", dateLabel, start.Unix(), end.Unix())
	}

	// 周一凌晨 3:30 推送上周周报
	if weekday == time.Monday && hour == 3 && minute == 30 {
		// 上周一 00:00 ~ 上周日 23:59:59
		thisMonday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
		lastMonday := thisMonday.AddDate(0, 0, -7)
		lastSunday := thisMonday.Add(-time.Second)
		dateLabel := lastMonday.Format("2006-01-02") + " ~ " + lastSunday.Format("2006-01-02")
		pushStatsToFeishu("weekly", dateLabel, lastMonday.Unix(), lastSunday.Unix())
	}

	// 每月 1 号凌晨 4:00 推送上月月报
	if day == 1 && hour == 4 && minute == 0 {
		thisMonthStart := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, now.Location())
		lastMonthStart := thisMonthStart.AddDate(0, -1, 0)
		lastMonthEnd := thisMonthStart.Add(-time.Second)
		dateLabel := lastMonthStart.Format("2006-01")
		pushStatsToFeishu("monthly", dateLabel, lastMonthStart.Unix(), lastMonthEnd.Unix())
	}
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
	items, _, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, nil, nil, "", 1, 5000)
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
	batchCreateBaseRecords(token, baseToken, tableID, records)
}

func pushModelStats(token, baseToken, tableID, dateLabel string, startTimestamp, endTimestamp int64) {
	items, _, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, nil, nil, "", 1, 5000)
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
	batchCreateBaseRecords(token, baseToken, tableID, records)
}

func pushOrgStats(token, baseToken, tableID, dateLabel string, startTimestamp, endTimestamp int64) {
	items, _, err := model.GetUserModelStatsByDepartment(startTimestamp, endTimestamp, nil, nil, "", 1, 5000)
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
	batchCreateBaseRecords(token, baseToken, tableID, records)
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

func listAllBaseRecords(token, baseToken, tableID string) ([]map[string]any, error) {
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/bitable/v1/apps/%s/tables/%s/records?page_size=200", baseToken, tableID)
	var allRecords []map[string]any
	pageToken := ""

	for {
		reqURL := url
		if pageToken != "" {
			reqURL += "&page_token=" + pageToken
		}
		body, err := feishuAPIGet(token, reqURL)
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
	respBody, err := feishuAPIPost(token, url, body)
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

func batchCreateBaseRecords(token, baseToken, tableID string, records []map[string]any) {
	url := fmt.Sprintf("https://open.feishu.cn/open-apis/bitable/v1/apps/%s/tables/%s/records/batch_create", baseToken, tableID)

	for i := 0; i < len(records); i += 200 {
		end := i + 200
		if end > len(records) {
			end = len(records)
		}
		batch := records[i:end]

		var fields []map[string]any
		for _, r := range batch {
			fields = append(fields, map[string]any{"fields": r})
		}
		payload := map[string]any{"records": fields}
		body, err := common.Marshal(payload)
		if err != nil {
			common.SysLog(fmt.Sprintf("feishu stats push: marshal records failed: %s", err))
			continue
		}

		respBody, err := feishuAPIPost(token, url, body)
		if err != nil {
			common.SysLog(fmt.Sprintf("feishu stats push: create records failed: %s", err))
			continue
		}
		var resp struct {
			Code int    `json:"code"`
			Msg  string `json:"msg"`
		}
		if err := common.Unmarshal(respBody, &resp); err != nil {
			common.SysLog(fmt.Sprintf("feishu stats push: parse response failed: %s", err))
			continue
		}
		if resp.Code != 0 {
			common.SysLog(fmt.Sprintf("feishu stats push: create records error: code=%d msg=%s", resp.Code, resp.Msg))
		}
		time.Sleep(500 * time.Millisecond)
	}
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
