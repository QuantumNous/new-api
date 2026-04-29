package controller

import (
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// --- 用户端 API ---

// GetCommissionSummary 获取当前用户的返佣概览
func GetCommissionSummary(c *gin.Context) {
	userId := c.GetInt("id")
	summary, err := model.GetUserCommissionSummary(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    summary,
		"notice":  common.CommissionNotice,
	})
}

// GetCommissionRecords 获取当前用户的返佣记录
func GetCommissionRecords(c *gin.Context) {
	userId := c.GetInt("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	commissions, total, err := model.GetUserCommissions(userId, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  commissions,
			"total": total,
		},
	})
}

// GetWithdrawalRecords 获取当前用户的提现记录
func GetWithdrawalRecords(c *gin.Context) {
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
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  withdrawals,
			"total": total,
		},
	})
}

// RequestWithdrawal 用户申请提现
func RequestWithdrawal(c *gin.Context) {
	userId := c.GetInt("id")

	var req struct {
		Amount  int    `json:"amount"`  // 提现金额（分）
		Method  string `json:"method"`  // balance / cash
		Account string `json:"account"` // 提现账号
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Method != model.WithdrawalMethodBalance && req.Method != model.WithdrawalMethodCash {
		common.ApiErrorMsg(c, "无效的提现方式")
		return
	}
	if req.Method == model.WithdrawalMethodCash && req.Account == "" {
		common.ApiErrorMsg(c, "请填写提现账号")
		return
	}

	err := model.RequestWithdrawal(userId, req.Amount, req.Method, req.Account)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提现申请已提交",
	})
}

// --- 管理员 API ---

// AdminGetAllWithdrawals 管理员获取所有提现申请
func AdminGetAllWithdrawals(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	withdrawals, total, err := model.GetAllWithdrawals(status, page, pageSize)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data": gin.H{
			"list":  withdrawals,
			"total": total,
		},
	})
}

// AdminApproveWithdrawal 管理员审批通过提现
func AdminApproveWithdrawal(c *gin.Context) {
	var req struct {
		Id          int    `json:"id"`
		AdminRemark string `json:"admin_remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	err := model.ApproveWithdrawal(req.Id, req.AdminRemark)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提现审批通过",
	})
}

// AdminRejectWithdrawal 管理员拒绝提现
func AdminRejectWithdrawal(c *gin.Context) {
	var req struct {
		Id          int    `json:"id"`
		AdminRemark string `json:"admin_remark"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	err := model.RejectWithdrawal(req.Id, req.AdminRemark)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "提现已拒绝",
	})
}

// AdminManualIssueCommission 管理员手动发放佣金
func AdminManualIssueCommission(c *gin.Context) {
	var req struct {
		UserId    int    `json:"user_id"`    // 被邀请人
		InviterId int    `json:"inviter_id"` // 邀请人（佣金接收方）
		Amount    int    `json:"amount"`     // 金额（分）
		Remark    string `json:"remark"`     // 备注
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.InviterId <= 0 {
		common.ApiErrorMsg(c, "请指定佣金接收用户")
		return
	}
	if req.Amount <= 0 {
		common.ApiErrorMsg(c, "金额必须大于0")
		return
	}

	err := service.ManualIssueCommission(req.UserId, req.InviterId, req.Amount, req.Remark)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "佣金发放成功",
	})
}
