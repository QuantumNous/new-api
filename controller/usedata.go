package controller

import (
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
	"sort"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	token_name := c.Query("token_name")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, token_name)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetBilling(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username, "")
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func GetUserQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	// 判断时间跨度是否超过 1 个月
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	dates, err := model.GetQuotaDataByUserId(userId, startTimestamp, endTimestamp)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

func ExportBillingExcel(c *gin.Context) {
	// 从查询参数获取时间范围
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("user_name")
	tokenname := c.Query("token_name")
	// 判断时间跨度是否超过 1 个月
	if endTimestamp-startTimestamp > 2592000 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "时间跨度不能超过 1 个月",
		})
		return
	}
	if tokenname != "" && username == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "令牌名称和用户名称需要同时填写",
		})
	}
	// 转换时间戳为时间格式
	startTime := time.Unix(startTimestamp, 0)
	if startTime.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的开始时间格式",
		})
		return
	}

	endTime := time.Unix(endTimestamp, 0)
	if endTime.IsZero() {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的结束时间格式",
		})
		return
	}

	// 获取Excel数据
	excelBytes, err := model.GetBillingAndExportExcel(startTime.Unix(), endTime.Unix(), username, tokenname)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}
	// 设置文件名
	filename := fmt.Sprintf("billing_%s_%s.xlsx",
		startTime.Format("20060102"),
		endTime.Format("20060102"))
	if username != "" {
		filename = fmt.Sprintf("%s_billing_%s_%s.xlsx",
			username,
			startTime.Format("20060102"),
			endTime.Format("20060102"))
		if tokenname != "" {
			filename = fmt.Sprintf("%s_%s_billing_%s_%s.xlsx",
				username,
				tokenname,
				startTime.Format("20060102"),
				endTime.Format("20060102"))
		}
	}

	// 设置响应头
	c.Header("Content-Description", "File Transfer")
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))
	c.Header("Content-Transfer-Encoding", "binary")
	c.Header("Expires", "0")
	c.Header("Cache-Control", "must-revalidate")
	c.Header("Pragma", "public")

	// 写入响应
	c.Data(http.StatusOK, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", excelBytes)
}

func GetQuotaDataByToken(c *gin.Context) {
	// 从 TokenAuth 中间件获取用户信息
	userId := c.GetInt("id")

	// 获取查询参数
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	queryTokenName := c.Query("token_name") // 从查询参数获取 token_name
	defaultTime := c.Query("default_time")

	// 只支持 day 聚合
	if defaultTime != "" && defaultTime != "day" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "只支持 day 聚合，其他聚合方式暂不支持",
		})
		return
	}

	// 参数验证
	if startTimestamp == 0 || endTimestamp == 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "开始时间和结束时间不能为空",
		})
		return
	}

	// 时间跨度验证（最多查询3个月）
	if endTimestamp-startTimestamp > 7776000 { // 3个月 = 90天 * 24小时 * 3600秒
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "时间跨度不能超过3个月",
		})
		return
	}

	// 权限验证：普通用户只能查询自己的数据
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser {
		// 普通用户只能查询自己的数据
		userCache, err := model.GetUserCache(userId)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"success": false,
				"message": "获取用户信息失败",
			})
			return
		}

		// 如果指定了用户名，验证是否为当前用户
		if username != "" && username != userCache.Username {
			c.JSON(http.StatusForbidden, gin.H{
				"success": false,
				"message": "普通用户只能查询自己的数据",
			})
			return
		}

		// 普通用户查询时，使用当前用户信息
		username = userCache.Username

	}

	// 查询数据
	var dates []*model.QuotaData
	var err error

	if username != "" && queryTokenName != "" {
		// 按用户名和指定token名称查询
		dates, err = model.GetQuotaDataByUsername(username, queryTokenName, startTimestamp, endTimestamp)
	} else if username != "" {
		// 按用户名查询所有token的数据
		dates, err = model.GetQuotaDataByUsername(username, "", startTimestamp, endTimestamp)
	} else {
		// 管理员可以查询所有数据
		dates, err = model.GetAllQuotaDates(startTimestamp, endTimestamp, "", "")
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "查询数据失败: " + err.Error(),
		})
		return
	}

	// 按天聚合数据
	aggregatedDates := aggregateQuotaDataByDay(dates)

	// 转换为简化的返回格式
	simplifiedData := make([]map[string]interface{}, 0, len(aggregatedDates))
	for _, item := range aggregatedDates {
		// 计算价格：quota / 50000
		price := float64(item.Quota) / 50000.0

		// 转换为当天日期字符串
		dateStr := time.Unix(item.CreatedAt, 0).Format("2006-01-02")

		simplifiedData = append(simplifiedData, map[string]interface{}{
			"token_name": item.TokenName,
			"username":   item.Username,
			"date":       dateStr,
			"price":      price,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    simplifiedData,
	})
}

// aggregateQuotaDataByDay 按天聚合数据
func aggregateQuotaDataByDay(data []*model.QuotaData) []*model.QuotaData {
	if len(data) == 0 {
		return data
	}

	// 创建聚合映射
	aggregated := make(map[string]*model.QuotaData)

	for _, item := range data {
		// 按天聚合：将时间戳向下取整到天
		dayStart := (item.CreatedAt / 86400) * 86400
		key := fmt.Sprintf("%s_%s_%d", item.Username, item.TokenName, dayStart)

		if existing, exists := aggregated[key]; exists {
			// 聚合数据
			existing.Count += item.Count
			existing.Quota += item.Quota
			existing.TokenUsed += item.TokenUsed
		} else {
			// 创建新记录
			aggregated[key] = &model.QuotaData{
				Username:  item.Username,
				TokenName: item.TokenName,
				Count:     item.Count,
				Quota:     item.Quota,
				TokenUsed: item.TokenUsed,
				CreatedAt: dayStart,
			}
		}
	}

	// 转换为切片并排序
	result := make([]*model.QuotaData, 0, len(aggregated))
	for _, item := range aggregated {
		result = append(result, item)
	}

	// 按时间排序
	sort.Slice(result, func(i, j int) bool {
		return result[i].CreatedAt < result[j].CreatedAt
	})

	return result
}
