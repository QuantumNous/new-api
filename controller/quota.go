package controller

import (
	"errors"
	"math"
	"net/http"
	"strconv"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 治理域错误（用于审批事务内返回，并由 ApproveQuota 映射为 HTTP 响应）。
var (
	ErrAppNotFoundOrHandled = errors.New("申请单不存在或已处理")
	ErrSelfApprove          = errors.New("禁止自审批")
	ErrBudgetInsufficient   = errors.New("预算池余额不足")
)

// quotaApplyRequest 提交额度申请请求体。
type quotaApplyRequest struct {
	Amount float64 `json:"amount"`
	Reason string  `json:"reason"`
	Dept   string  `json:"dept"`
}

// ApplyQuota 提交额度申请：插入 quota_application(status=pending)，返回申请单号。
// 仅要求登录（普通用户/部门管理员/超管均可提交）。校验 amount > 0。
//
// POST /api/quota/apply
func ApplyQuota(c *gin.Context) {
	var req quotaApplyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if req.Amount <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "金额必须大于 0"})
		return
	}

	actorId := c.GetInt("id")
	actorName := c.GetString("username")
	dept := req.Dept
	if dept == "" {
		dept = c.GetString("department") // 未显式传 dept 时取当前用户部门
	}

	app := model.QuotaApplication{
		ApplicantId:   actorId,
		ApplicantName: actorName,
		Dept:          dept,
		Amount:        req.Amount,
		Reason:        req.Reason,
		Status:        "pending",
		CreatedAt:     time.Now().Unix(),
	}
	if err := model.DB.Create(&app).Error; err != nil {
		common.SysLog("ApplyQuota create failed: " + err.Error())
		c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "提交失败"})
		return
	}

	// 审计：提交申请（事务外，不阻塞）
	model.WriteAuditLog(actorId, actorName, "quota_apply",
		"quota_application", strconv.FormatInt(app.Id, 10),
		"提交额度申请 "+strconv.FormatFloat(req.Amount, 'f', 2, 64)+" 元", c.ClientIP())

	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"data":    gin.H{"application_id": app.Id, "status": "pending"},
	})
}

// quotaApproveRequest 审批请求体。
type quotaApproveRequest struct {
	ApplicationId int64  `json:"application_id"`
	Decision      string `json:"decision"` // approve | reject
	RejectReason  string `json:"reject_reason"`
}

// ApproveQuota 审批额度申请：批准时从事务内行锁预算池拨至申请人个人余额；
// 拒绝时仅落状态。禁止自审批（handler + 事务内双校验），部门管理员仅可审批本部门申请。
// 并发安全由 GORM 事务 + SELECT ... FOR UPDATE 行锁保证（详见研发任务卡 T5）。
//
// POST /api/quota/approve
func ApproveQuota(c *gin.Context) {
	var req quotaApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "参数错误"})
		return
	}
	if req.Decision != "approve" && req.Decision != "reject" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "decision 必须为 approve 或 reject"})
		return
	}

	actorId := c.GetInt("id")
	actorName := c.GetString("username")
	roleLevel := c.GetInt("role_level")
	actorDept := c.GetString("department")

	// 预校验（事务外）：存在性 / 是否已处理 / 自审批 / 部门范围。
	// 事务内会再次校验自审批与存在性，防止并发窗口绕过。
	app, err := model.GetQuotaApplicationById(req.ApplicationId)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": ErrAppNotFoundOrHandled.Error()})
		return
	}
	if app.Status != "pending" {
		c.JSON(http.StatusConflict, gin.H{"success": false, "message": "申请单已处理"})
		return
	}
	if app.ApplicantId == actorId {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "禁止自审批", "code": "self_approve_forbidden"})
		return
	}
	// 部门管理员仅可审批本部门；超级管理员不限部门。
	if roleLevel == model.RoleLevelDeptAdmin && app.Dept != actorDept {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "只能审批本部门申请"})
		return
	}

	txErr := model.DB.Transaction(func(tx *gorm.DB) error {
		var appTx model.QuotaApplication
		if e := tx.Where("id = ? AND status = ?", req.ApplicationId, "pending").First(&appTx).Error; e != nil {
			return ErrAppNotFoundOrHandled
		}
		// 事务内二次自审批校验（并发安全）
		if appTx.ApplicantId == actorId {
			return ErrSelfApprove
		}
		now := time.Now().Unix()
		if req.Decision == "reject" {
			appTx.Status = "rejected"
			appTx.ApproverId = actorId
			appTx.ApproverName = actorName
			appTx.DecidedAt = now
			appTx.RejectReason = req.RejectReason
			return tx.Save(&appTx).Error
		}
		// approve：行锁预算池（id=1）防止并发超拨
		var pool model.BudgetPool
		if e := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", 1).First(&pool).Error; e != nil {
			return e
		}
		// 货币单位=元：预算池(decimal)与个人余额(Quota int)统一以「元」记账。
		// 为与 User.Quota(int) 对齐，拨付按整元四舍五入（角分在 v1 暂不保留，待生产决策）。
		deltaYuan := int64(math.Round(appTx.Amount))
		if pool.TotalBalance < float64(deltaYuan) {
			return ErrBudgetInsufficient
		}
		if e := tx.Model(&model.User{}).Where("id = ?", appTx.ApplicantId).
			UpdateColumn("quota", gorm.Expr("quota + ?", deltaYuan)).Error; e != nil {
			return e
		}
		pool.TotalBalance -= float64(deltaYuan)
		appTx.Status = "approved"
		appTx.ApproverId = actorId
		appTx.ApproverName = actorName
		appTx.DecidedAt = now
		if e := tx.Save(&pool).Error; e != nil {
			return e
		}
		return tx.Save(&appTx).Error
	})

	if txErr != nil {
		switch txErr {
		case ErrBudgetInsufficient:
			c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "预算池余额不足", "code": "budget_insufficient"})
		case ErrSelfApprove:
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "禁止自审批", "code": "self_approve_forbidden"})
		case ErrAppNotFoundOrHandled:
			c.JSON(http.StatusConflict, gin.H{"success": false, "message": "申请单不存在或已处理"})
		default:
			common.SysLog("ApproveQuota tx failed: " + txErr.Error())
			c.JSON(http.StatusInternalServerError, gin.H{"success": false, "message": "审批失败"})
		}
		return
	}

	// 审计（事务外，不阻塞）
	detail := "批准额度申请 " + strconv.FormatFloat(app.Amount, 'f', 2, 64) + " 元"
	if req.Decision == "reject" {
		detail = "拒绝额度申请"
	}
	model.WriteAuditLog(actorId, actorName, "quota_approve",
		"quota_application", strconv.FormatInt(app.Id, 10), detail, c.ClientIP())

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    gin.H{"application_id": app.Id, "status": req.Decision},
	})
}
