package controller

import (
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func GetAllQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	username := c.Query("username")
	
	// 处理 days 参数
	days, err := strconv.Atoi(c.Query("days"))
	if err == nil && days > 0 {
		endTimestamp = time.Now().Unix()
		startTimestamp = endTimestamp - int64(days*24*3600)
	}
	
	dates, err := model.GetAllQuotaDates(startTimestamp, endTimestamp, username)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	
	// 转换数据格式，将 CreatedAt 转换为 date 字段
	result := make([]map[string]interface{}, len(dates))
	for i, d := range dates {
		t := time.Unix(d.CreatedAt, 0)
		result[i] = map[string]interface{}{
			"date":   t.Format("2006-01-02"),
			"quota":  d.Quota,
			"amount": d.Quota, // 为了兼容前端，添加 amount 字段
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
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
	
	// 处理 days 参数
	days, err := strconv.Atoi(c.Query("days"))
	if err == nil && days > 0 {
		endTimestamp = time.Now().Unix()
		startTimestamp = endTimestamp - int64(days*24*3600)
	}
	
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
		common.ApiError(c, err)
		return
	}
	
	// 转换数据格式，将 CreatedAt 转换为 date 字段
	result := make([]map[string]interface{}, len(dates))
	for i, d := range dates {
		t := time.Unix(d.CreatedAt, 0)
		result[i] = map[string]interface{}{
			"date":   t.Format("2006-01-02"),
			"quota":  d.Quota,
			"amount": d.Quota, // 为了兼容前端，添加 amount 字段
		}
	}
	
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    result,
	})
	return
}
