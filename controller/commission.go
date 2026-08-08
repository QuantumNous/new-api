package controller

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// User-facing commission endpoints
// ============================================================================

// GetCommissionWallet returns the user's commission wallet info
func GetCommissionWallet(c *gin.Context) {
	userId := c.GetInt("id")

	wallet, err := model.GetCommissionWallet(userId)
	if err != nil {
		common.SysError("failed to get commission wallet: " + err.Error())
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取佣金钱包失败",
		})
		return
	}

	monthlyEarned, totalEarned, err := model.GetUserCommissionStats(userId)
	if err != nil {
		monthlyEarned = 0
		totalEarned = wallet.TotalEarned
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"balance":        wallet.Balance,
			"total_earned":   totalEarned,
			"total_withdrawn": wallet.TotalWithdrawn,
			"monthly_earned": monthlyEarned,
		},
	})
}

// GetCommissionTierInfo returns the user's current tier info
func GetCommissionTierInfo(c *gin.Context) {
	userId := c.GetInt("id")

	rate, activeCount, nextMin, nextRate, err := model.GetNextTierInfo(userId)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取阶梯信息失败",
		})
		return
	}

	var needForNext int
	if nextMin > 0 {
		needForNext = nextMin - activeCount
		if needForNext < 0 {
			needForNext = 0
		}
	}

	// Get all tiers for progress display
	config := model.GetDefaultCommissionConfig()
	if v, ok := common.OptionMap[model.CommissionConfigKey]; ok && v != "" {
		parsed := &model.CommissionConfig{}
		if err := common.UnmarshalJsonStr(v, parsed); err == nil {
			config = parsed
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"current_rate":   rate,
			"active_count":   activeCount,
			"next_min_users": nextMin,
			"next_rate":      nextRate,
			"need_for_next":  needForNext,
			"tiers":          config.Tiers,
			"default_rate":   config.DefaultRate,
		},
	})
}

// GetCommissionRecords returns the user's commission records
func GetCommissionRecords(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	records, total, err := model.GetUserCommissionRecords(userId, page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取佣金记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"records": records,
			"total":   total,
			"page":    page,
			"size":    pageSize,
		},
	})
}

// TransferCommissionToBalance transfers commission to main balance
func TransferCommissionToBalance(c *gin.Context) {
	userId := c.GetInt("id")

	var req struct {
		Amount float64 `json:"amount" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if req.Amount <= 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "划转金额必须大于0",
		})
		return
	}

	if err := model.TransferCommissionToBalance(userId, req.Amount); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "划转成功",
	})
}

// CreateWithdrawalRequest creates a withdrawal request
func CreateWithdrawalRequest(c *gin.Context) {
	userId := c.GetInt("id")

	var req struct {
		Amount  float64 `json:"amount" binding:"required"`
		PayInfo string  `json:"pay_info" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if err := model.CreateWithdrawalRequest(userId, req.Amount, req.PayInfo); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提现申请已提交，请等待管理员审核",
	})
}

// GetUserWithdrawals returns the user's withdrawal requests
func GetUserWithdrawals(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	withdrawals, total, err := model.GetUserWithdrawals(userId, page, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取提现记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"withdrawals": withdrawals,
			"total":       total,
			"page":        page,
			"size":        pageSize,
		},
	})
}

// GetDownlineUsers returns the user's downline (referrals) list
func GetDownlineUsers(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	downlines, total, err := model.GetUserDownline(userId, page, pageSize)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取下级列表失败",
		})
		return
	}

	// Mask usernames
	type DownlineItem struct {
		Id          int     `json:"id"`
		Username    string  `json:"username"`
		TotalTopUp  float64 `json:"total_topup"`
		CreatedAt   int64   `json:"created_at"`
		LastTopUpAt int64   `json:"last_topup_at"`
	}
	var items []DownlineItem
	for _, d := range downlines {
		username := maskUsername(d.Username)
		items = append(items, DownlineItem{
			Id:          d.Id,
			Username:    username,
			TotalTopUp:  d.TotalTopUp,
			CreatedAt:   d.CreatedAt,
			LastTopUpAt: d.LastTopUpAt,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"downlines": items,
			"total":     total,
			"page":      page,
			"size":      pageSize,
		},
	})
}

func maskUsername(username string) string {
	if len(username) <= 2 {
		return username[:1] + "***"
	}
	return string(username[0]) + "***" + string(username[len(username)-1])
}

// ============================================================================
// Admin commission endpoints
// ============================================================================

// GetCommissionConfig returns the commission tier configuration
func GetCommissionConfig(c *gin.Context) {
	config := model.GetDefaultCommissionConfig()
	if v, ok := common.OptionMap[model.CommissionConfigKey]; ok && v != "" {
		parsed := &model.CommissionConfig{}
		if err := common.UnmarshalJsonStr(v, parsed); err == nil {
			config = parsed
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    config,
	})
}

// UpdateCommissionConfig updates the commission tier configuration
func UpdateCommissionConfig(c *gin.Context) {
	var config model.CommissionConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	// Validate
	if config.DefaultRate < 0 || config.DefaultRate > 1 {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "默认比例必须在0-1之间",
		})
		return
	}
	for _, tier := range config.Tiers {
		if tier.Rate < 0 || tier.Rate > 1 {
			c.JSON(http.StatusOK, gin.H{
				"success": false,
				"message": "阶梯比例必须在0-1之间",
			})
			return
		}
	}

	jsonBytes, err := common.Marshal(config)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "序列化失败",
		})
		return
	}

	if err := model.UpdateOption(model.CommissionConfigKey, string(jsonBytes)); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "保存失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "佣金配置已更新",
	})
}

// GetAllCommissionRecords returns all commission records (admin)
func GetAllCommissionRecords(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	userId, _ := strconv.Atoi(c.Query("user_id"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	records, total, err := model.GetAllCommissionRecords(page, pageSize, userId, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取佣金记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"records": records,
			"total":   total,
			"page":    page,
			"size":    pageSize,
		},
	})
}

// AdjustCommission manually adjusts a user's commission
func AdjustCommission(c *gin.Context) {
	var req struct {
		UserId int     `json:"user_id" binding:"required"`
		Amount float64 `json:"amount" binding:"required"`
		Remark string  `json:"remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	if err := model.AdjustCommission(req.UserId, req.Amount, req.Remark); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "调整成功",
	})
}

// GetAllWithdrawals returns all withdrawal requests (admin)
func GetAllWithdrawals(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	status := c.Query("status")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	withdrawals, total, err := model.GetAllWithdrawals(page, pageSize, status)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取提现记录失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"withdrawals": withdrawals,
			"total":       total,
			"page":        page,
			"size":        pageSize,
		},
	})
}

// ReviewWithdrawal approves or rejects a withdrawal request
func ReviewWithdrawal(c *gin.Context) {
	adminId := c.GetInt("id")

	var req struct {
		Id     int    `json:"id" binding:"required"`
		Action string `json:"action" binding:"required"` // "approve" or "reject"
		Note   string `json:"note"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	var err error
	switch req.Action {
	case "approve":
		err = model.ApproveWithdrawal(req.Id, adminId)
	case "reject":
		err = model.RejectWithdrawal(req.Id, adminId, req.Note)
	default:
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的操作",
		})
		return
	}

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "操作成功",
	})
}

// BatchApproveWithdrawals batch approves withdrawal requests
func BatchApproveWithdrawals(c *gin.Context) {
	adminId := c.GetInt("id")

	var req struct {
		Ids []int `json:"ids" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "无效的参数",
		})
		return
	}

	var failed []int
	for _, id := range req.Ids {
		if err := model.ApproveWithdrawal(id, adminId); err != nil {
			failed = append(failed, id)
		}
	}

	if len(failed) > 0 {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("批量操作完成，%d个成功，%d个失败", len(req.Ids)-len(failed), len(failed)),
			"data":    gin.H{"failed_ids": failed},
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("批量审核通过成功，共%d个", len(req.Ids)),
	})
}

// GetPromoterList returns all promoters data (admin)
func GetPromoterList(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	keyword := c.Query("keyword")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// Get users with commission wallets
	items, total, err := model.GetPromoterList(page, pageSize, keyword)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取推广用户列表失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"promoters": items,
			"total":     total,
			"page":      page,
			"size":      pageSize,
		},
	})
}

// GetCommissionDashboard returns dashboard statistics
func GetCommissionDashboard(c *gin.Context) {
	stats, err := model.GetCommissionDashboardStats()
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "获取统计数据失败",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    stats,
	})
}
