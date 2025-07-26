package controller

import (
	"fmt"
	"net/http"
	"one-api/common"
	"one-api/model"
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

	// 直接使用按天聚合查询
	dates, err := model.GetAllQuotaDatesByDay(startTimestamp, endTimestamp, username, queryTokenName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "查询数据失败: " + err.Error(),
		})
		return
	}

	// 转换为简化的返回格式
	simplifiedData := make([]map[string]interface{}, 0, len(dates))
	for _, item := range dates {

		simplifiedData = append(simplifiedData, map[string]interface{}{
			"token_name": item.TokenName,
			"username":   item.Username,
			"model_name": item.ModelName,
			"date":       item.DateStr, // 直接使用FROM_UNIXTIME返回的日期字符串
			"price":      item.Price,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    simplifiedData,
	})
}
