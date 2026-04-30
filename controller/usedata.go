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

	items, total, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
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

	items, total, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"items":     items,
			"total":     total,
			"page":      page,
			"page_size": pageSize,
		},
	})
}

func GetUserModelStatsMatrix(c *gin.Context) {
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

	userPage, _ := strconv.Atoi(c.Query("user_page"))
	if userPage <= 0 {
		userPage = 1
	}
	modelPage, _ := strconv.Atoi(c.Query("model_page"))
	if modelPage <= 0 {
		modelPage = 1
	}
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	if pageSize <= 0 {
		pageSize = 20
	}
	if pageSize > 50 {
		pageSize = 50
	}

	matrix, err := model.GetUserModelMatrix(startTimestamp, endTimestamp, parseStringList(username), parseStringList(modelName), userPage, modelPage, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    matrix,
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
		writer.Write([]string{"模型名", "用户名", "请求次数", "总Tokens", "额度消耗"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByModel(startTimestamp, endTimestamp, usernames, modelNames, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{it.ModelName, it.Username, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	case "matrix":
		writer.Write([]string{"用户名", "模型名", "请求次数", "总Tokens", "额度消耗"})
		matrix, err := model.GetUserModelMatrix(startTimestamp, endTimestamp, usernames, modelNames, 1, 1, 50)
		if err != nil {
			common.SysError("csv export error: " + err.Error())
			writer.Write([]string{"error", err.Error()})
			return
		}
		for _, cell := range matrix.Cells {
			writer.Write([]string{cell.Username, cell.ModelName, strconv.Itoa(cell.Count), strconv.Itoa(cell.TokenUsed), strconv.Itoa(cell.Quota)})
		}
	default:
		writer.Write([]string{"用户名", "模型名", "请求次数", "总Tokens", "额度消耗"})
		page := 1
		pageSize := 1000
		for {
			items, _, err := model.GetUserModelStatsByUser(startTimestamp, endTimestamp, usernames, modelNames, page, pageSize)
			if err != nil {
				common.SysError("csv export error: " + err.Error())
				writer.Write([]string{"error", err.Error()})
				return
			}
			if len(items) == 0 {
				break
			}
			for _, it := range items {
				writer.Write([]string{it.Username, it.ModelName, strconv.Itoa(it.Count), strconv.Itoa(it.TokenUsed), strconv.Itoa(it.Quota)})
			}
			if len(items) < pageSize {
				break
			}
			page++
		}
	}
}
