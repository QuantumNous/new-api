package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

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
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    dates,
	})
	return
}

// 令牌看板查询单次窗口上限：90 天（管理员）/ 30 天（普通用户）。
const (
	tokenQuotaAdminMaxRangeSec = 90 * 24 * 3600
	tokenQuotaUserMaxRangeSec  = 30 * 24 * 3600
)

func validateTokenQuotaRange(start, end int64, maxRange int64) (bool, string) {
	if start <= 0 || end <= 0 || end < start {
		return false, "时间范围参数无效"
	}
	if end-start > maxRange {
		return false, "时间跨度超过限制"
	}
	return true, ""
}

// GetTokenQuotaDates 管理员：按令牌维度统计的看板数据
func GetTokenQuotaDates(c *gin.Context) {
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if ok, msg := validateTokenQuotaRange(startTimestamp, endTimestamp, tokenQuotaAdminMaxRangeSec); !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}
	username := c.Query("username")
	tokenName := c.Query("token_name")
	dates, err := model.GetTokenQuotaDates(startTimestamp, endTimestamp, username, tokenName)
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

// GetUserTokenQuotaDates 普通用户：查询自己的令牌维度看板数据
func GetUserTokenQuotaDates(c *gin.Context) {
	userId := c.GetInt("id")
	startTimestamp, _ := strconv.ParseInt(c.Query("start_timestamp"), 10, 64)
	endTimestamp, _ := strconv.ParseInt(c.Query("end_timestamp"), 10, 64)
	if ok, msg := validateTokenQuotaRange(startTimestamp, endTimestamp, tokenQuotaUserMaxRangeSec); !ok {
		c.JSON(http.StatusOK, gin.H{"success": false, "message": msg})
		return
	}
	tokenName := c.Query("token_name")
	dates, err := model.GetUserTokenQuotaDates(userId, startTimestamp, endTimestamp, tokenName)
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
