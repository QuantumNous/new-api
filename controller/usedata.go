package controller

import (
	"encoding/csv"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"

	"github.com/gin-gonic/gin"
)

func parseStringList(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	var res []string
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p != "" {
			res = append(res, p)
		}
	}
	return res
}

func validateTimeWindow(startTimestamp int64, endTimestamp int64) error {
	if endTimestamp < startTimestamp {
		return errors.New("结束时间不能早于开始时间")
	}
	startTime := time.Unix(startTimestamp, 0)
	endTime := time.Unix(endTimestamp, 0)
	if endTime.After(startTime.AddDate(1, 0, 0)) {
		return errors.New("时间跨度不能超过 1 年")
	}
	return nil
}

func getDefaultTodayTimeRange() (int64, int64) {
	now := time.Now()
	startOfDay := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
	return startOfDay.Unix(), now.Unix()
}

func parseUserModelStatsTimeRange(c *gin.Context) (int64, int64, error) {
	defaultStart, defaultEnd := getDefaultTodayTimeRange()
	startTimestamp := defaultStart
	endTimestamp := defaultEnd
	if startRaw := strings.TrimSpace(c.Query("start_timestamp")); startRaw != "" {
		parsedStart, err := strconv.ParseInt(startRaw, 10, 64)
		if err != nil {
			return 0, 0, errors.New("start_timestamp 参数格式错误")
		}
		startTimestamp = parsedStart
	}
	if endRaw := strings.TrimSpace(c.Query("end_timestamp")); endRaw != "" {
		parsedEnd, err := strconv.ParseInt(endRaw, 10, 64)
		if err != nil {
			return 0, 0, errors.New("end_timestamp 参数格式错误")
		}
		endTimestamp = parsedEnd
	}
	return startTimestamp, endTimestamp, nil
}

type userStatResponseItem struct {
	UserID         int     `json:"user_id"`
	Username       string  `json:"username"`
	UserGroup      string  `json:"user_group"`
	OrgPath        string  `json:"org_path"`
	Count          int     `json:"count"`
	TokenUsed      int     `json:"token_used"`
	Quota          int     `json:"quota"`
	QuotaAmountUSD float64 `json:"quota_amount_usd"`
	QuotaAmountCNY float64 `json:"quota_amount_cny"`
}

type modelStatResponseItem struct {
	ModelName      string  `json:"model_name"`
	UserGroup      string  `json:"user_group"`
	Count          int     `json:"count"`
	TokenUsed      int     `json:"token_used"`
	Quota          int     `json:"quota"`
	QuotaAmountUSD float64 `json:"quota_amount_usd"`
	QuotaAmountCNY float64 `json:"quota_amount_cny"`
}

type userModelStatResponseItem struct {
	UserID         int     `json:"user_id"`
	Username       string  `json:"username"`
	UserGroup      string  `json:"user_group"`
	ModelName      string  `json:"model_name"`
	Count          int     `json:"count"`
	TokenUsed      int     `json:"token_used"`
	Quota          int     `json:"quota"`
	QuotaAmountUSD float64 `json:"quota_amount_usd"`
	QuotaAmountCNY float64 `json:"quota_amount_cny"`
}

type departmentStatResponseItem struct {
	OrgLevel1Name  string  `json:"org_level1_name"`
	OrgLevel2Name  string  `json:"org_level2_name"`
	Count          int     `json:"count"`
	TokenUsed      int     `json:"token_used"`
	Quota          int     `json:"quota"`
	QuotaAmountUSD float64 `json:"quota_amount_usd"`
	QuotaAmountCNY float64 `json:"quota_amount_cny"`
}

func quotaToUSDAmount(quota int) float64 {
	if common.QuotaPerUnit <= 0 {
		return 0
	}
	return float64(quota) / common.QuotaPerUnit
}

func quotaToCNYAmount(quota int) float64 {
	return quotaToUSDAmount(quota) * operation_setting.USDExchangeRate
}

func buildUserStatResponseItems(items []*model.UserStatItem) []userStatResponseItem {
	res := make([]userStatResponseItem, 0, len(items))
	for _, it := range items {
		res = append(res, userStatResponseItem{
			UserID:         it.UserID,
			Username:       it.Username,
			UserGroup:      it.UserGroup,
			OrgPath:        it.OrgPath,
			Count:          it.Count,
			TokenUsed:      it.TokenUsed,
			Quota:          it.Quota,
			QuotaAmountUSD: quotaToUSDAmount(it.Quota),
			QuotaAmountCNY: quotaToCNYAmount(it.Quota),
		})
	}
	return res
}

func buildModelStatResponseItems(items []*model.ModelStatItem) []modelStatResponseItem {
	res := make([]modelStatResponseItem, 0, len(items))
	for _, it := range items {
		res = append(res, modelStatResponseItem{
			ModelName:      it.ModelName,
			Count:          it.Count,
			TokenUsed:      it.TokenUsed,
			Quota:          it.Quota,
			QuotaAmountUSD: quotaToUSDAmount(it.Quota),
			QuotaAmountCNY: quotaToCNYAmount(it.Quota),
		})
	}
	return res
}

func buildUserModelStatResponseItems(items []*model.UserModelStatItem) []userModelStatResponseItem {
	res := make([]userModelStatResponseItem, 0, len(items))
	for _, it := range items {
		res = append(res, userModelStatResponseItem{
			UserID:         it.UserID,
			Username:       it.Username,
			UserGroup:      it.UserGroup,
			ModelName:      it.ModelName,
			Count:          it.Count,
			TokenUsed:      it.TokenUsed,
			Quota:          it.Quota,
			QuotaAmountUSD: quotaToUSDAmount(it.Quota),
			QuotaAmountCNY: quotaToCNYAmount(it.Quota),
		})
	}
	return res
}

func buildDepartmentStatResponseItems(items []*model.DepartmentStatItem) []departmentStatResponseItem {
	res := make([]departmentStatResponseItem, 0, len(items))
	for _, it := range items {
		res = append(res, departmentStatResponseItem{
			OrgLevel1Name:  it.OrgLevel1Name,
			OrgLevel2Name:  it.OrgLevel2Name,
			Count:          it.Count,
			TokenUsed:      it.TokenUsed,
			Quota:          it.Quota,
			QuotaAmountUSD: quotaToUSDAmount(it.Quota),
			QuotaAmountCNY: quotaToCNYAmount(it.Quota),
		})
	}
	return res
}

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetQuotaDatesByUser(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	dates, err := model.GetQuotaDataGroupByUser(startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
}

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetQuotaDataByUserId(userId, startTimestamp, endTimestamp)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetUserModelStatsByUser(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseUserModelStatsTimeRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTimeWindow(startTimestamp, endTimestamp); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	userGroup := strings.TrimSpace(c.Query("user_group"))
	page, _ := strconv.Atoi(c.Query("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items, total, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), userGroup, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     buildUserStatResponseItems(items),
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func GetUserModelStatsByModel(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseUserModelStatsTimeRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTimeWindow(startTimestamp, endTimestamp); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	userGroup := strings.TrimSpace(c.Query("user_group"))
	page, _ := strconv.Atoi(c.Query("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items, total, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), userGroup, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     buildModelStatResponseItems(items),
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func GetUserModelStatsByDepartment(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseUserModelStatsTimeRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTimeWindow(startTimestamp, endTimestamp); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	userGroup := strings.TrimSpace(c.Query("user_group"))
	page, _ := strconv.Atoi(c.Query("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items, total, err := model.GetUserModelStatsByDepartment(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), userGroup, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     buildDepartmentStatResponseItems(items),
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func GetUserModelStatsByDetail(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseUserModelStatsTimeRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTimeWindow(startTimestamp, endTimestamp); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	userGroup := strings.TrimSpace(c.Query("user_group"))
	page, _ := strconv.Atoi(c.Query("page"))
	if page <= 0 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}

	items, total, err := model.GetUserModelStatsByDetail(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), userGroup, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     buildUserModelStatResponseItems(items),
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func ExportUserModelStats(c *gin.Context) {
	startTimestamp, endTimestamp, err := parseUserModelStatsTimeRange(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := validateTimeWindow(startTimestamp, endTimestamp); err != nil {
		common.ApiError(c, err)
		return
	}
	username := c.Query("username")
	modelName := c.Query("model_name")
	userGroup := strings.TrimSpace(c.Query("user_group"))
	viewType := strings.TrimSpace(c.Query("view_type"))
	if viewType == "" {
		viewType = "by_user"
	}

	usernames := parseStringList(username)
	modelNames := parseStringList(modelName)

	filename := fmt.Sprintf("user-model-stats-%s-%s.csv", viewType, time.Now().Format("2006-01-02"))
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	switch viewType {
	case "by_model":
		writer.Write([]string{"模型名", "请求次数", "总Tokens", "额度消耗", "额度(USD)", "额度(CNY)"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, usernames, modelNames, userGroup, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{it.ModelName, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota), strconv.FormatFloat(quotaToUSDAmount(it.Quota), 'f', 6, 64), strconv.FormatFloat(quotaToCNYAmount(it.Quota), 'f', 6, 64)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	case "by_department":
		writer.Write([]string{"一级组织名称", "二级组织名称", "请求次数", "总Tokens", "额度消耗", "额度(USD)", "额度(CNY)"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByDepartment(startTimestamp, endTimestamp, usernames, modelNames, userGroup, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{it.OrgLevel1Name, it.OrgLevel2Name, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota), strconv.FormatFloat(quotaToUSDAmount(it.Quota), 'f', 6, 64), strconv.FormatFloat(quotaToCNYAmount(it.Quota), 'f', 6, 64)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	case "by_detail":
		writer.Write([]string{"用户ID", "用户名", "用户分组", "模型名", "请求次数", "总Tokens", "额度消耗", "额度(USD)", "额度(CNY)"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByDetail(startTimestamp, endTimestamp, usernames, modelNames, userGroup, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{strconv.Itoa(it.UserID), it.Username, it.UserGroup, it.ModelName, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota), strconv.FormatFloat(quotaToUSDAmount(it.Quota), 'f', 6, 64), strconv.FormatFloat(quotaToCNYAmount(it.Quota), 'f', 6, 64)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	default:
		writer.Write([]string{"用户ID", "用户名", "用户分组", "完整组织路径", "请求次数", "总Tokens", "额度消耗", "额度(USD)", "额度(CNY)"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, usernames, modelNames, userGroup, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{strconv.Itoa(it.UserID), it.Username, it.UserGroup, it.OrgPath, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota), strconv.FormatFloat(quotaToUSDAmount(it.Quota), 'f', 6, 64), strconv.FormatFloat(quotaToCNYAmount(it.Quota), 'f', 6, 64)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	}
}
