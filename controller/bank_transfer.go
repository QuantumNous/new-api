package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

// 对公转账充值（docs/enterprise-features-design.md §二）。
// 提交/收款信息仅对已通过企业认证的用户开放；回执图片加密复用 KYC 加密
// （图片大小常量 maxImageBase64Len / maxImageDecodedBytes 同包共享自 controller/kyc.go）。

// requireEnterpriseApproved 校验当前用户已通过企业认证，未通过时写 403 并返回 false。
func requireEnterpriseApproved(c *gin.Context) bool {
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil || userCache.EnterpriseStatus != model.EnterpriseStatusApproved {
		c.JSON(http.StatusForbidden, gin.H{
			"success": false,
			"message": "该功能仅对已通过企业认证的用户开放",
		})
		return false
	}
	return true
}

// ─── User-side handlers ───────────────────────────────────────────────────────

// GetBankTransferConfig GET /api/user/bank_transfer/config
// 未启用或未通过企业认证时只返回 enabled=false，不下发收款信息。
func GetBankTransferConfig(c *gin.Context) {
	cfg := operation_setting.GetBankTransferSetting()
	if !cfg.IsAvailable() {
		common.ApiSuccess(c, dto.BankTransferConfigResponse{Enabled: false})
		return
	}
	userId := c.GetInt("id")
	userCache, err := model.GetUserCache(userId)
	if err != nil || userCache.EnterpriseStatus != model.EnterpriseStatusApproved {
		common.ApiSuccess(c, dto.BankTransferConfigResponse{Enabled: false})
		return
	}
	common.ApiSuccess(c, dto.BankTransferConfigResponse{
		Enabled:       true,
		CompanyName:   cfg.CompanyName,
		PayeeName:     cfg.PayeeName,
		AccountNumber: cfg.AccountNumber,
		BankName:      cfg.BankName,
		MinAmountFen:  cfg.MinAmountFen,
		Tips:          cfg.Tips,
	})
}

// GetUserBankTransfers GET /api/user/bank_transfer/self
// 历史订单对本人始终可查（即使企业认证后被重置）。
func GetUserBankTransfers(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	orders, total, err := model.GetUserBankTransferOrders(userId, pageInfo)
	if err != nil {
		common.ApiErrorMsg(c, "查询转账订单失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    orders,
		"total":   total,
	})
}

// SubmitBankTransfer POST /api/user/bank_transfer
func SubmitBankTransfer(c *gin.Context) {
	cfg := operation_setting.GetBankTransferSetting()
	if !cfg.IsAvailable() {
		common.ApiErrorMsg(c, "对公转账功能未开启")
		return
	}
	if !requireEnterpriseApproved(c) {
		return
	}

	var req dto.BankTransferSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	if cfg.MinAmountFen > 0 && req.AmountFen < cfg.MinAmountFen {
		common.ApiErrorMsg(c, fmt.Sprintf("转账金额不能低于 ¥%.2f", common.FenToYuan(cfg.MinAmountFen)))
		return
	}

	receiptEnc, err := encryptBankTransferReceipt(req.Receipt)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	userId := c.GetInt("id")
	order, err := model.CreateBankTransferOrderWithReceipt(userId, req.AmountFen, req.Remark, receiptEnc)
	if err != nil {
		if errors.Is(err, model.ErrBankTransferHasPending) || errors.Is(err, model.ErrBankTransferAmountTooLarge) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiErrorMsg(c, "提交失败，请稍后重试")
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "",
		"data":    order,
	})
}

// CancelBankTransfer DELETE /api/user/bank_transfer/:id
func CancelBankTransfer(c *gin.Context) {
	id, err := parseBankTransferId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	userId := c.GetInt("id")
	if err := model.CancelBankTransferOrder(userId, id); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// ─── Admin-side handlers ──────────────────────────────────────────────────────

// AdminGetBankTransferList GET /api/user/bank_transfer/admin?status=1&keyword=xxx&page=1&page_size=20
func AdminGetBankTransferList(c *gin.Context) {
	status, _ := strconv.Atoi(c.DefaultQuery("status", "0"))
	keyword := c.Query("keyword")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	rows, total, err := model.GetBankTransferList(status, keyword, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	items := make([]dto.BankTransferAdminItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, dto.BankTransferAdminItem{
			Id:           row.Id,
			UserId:       row.UserId,
			Username:     row.Username,
			AmountFen:    row.AmountFen,
			CreditedFen:  row.CreditedFen,
			QuotaGranted: row.QuotaGranted,
			Remark:       row.Remark,
			TradeNo:      row.TradeNo,
			Status:       row.Status,
			ReviewRemark: row.ReviewRemark,
			RejectReason: row.RejectReason,
			ReviewedBy:   row.ReviewedBy,
			ReviewerName: row.ReviewerName,
			HasReceipt:   true, // 提交时回执必传且与订单同事务写入
			SubmittedAt:  row.SubmittedAt,
			ReviewedAt:   row.ReviewedAt,
		})
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    items,
		"total":   total,
	})
}

// AdminGetBankTransferReceipt GET /api/user/bank_transfer/admin/:id/receipt
// 回执含银行账号信息，每次查看写审计日志。
func AdminGetBankTransferReceipt(c *gin.Context) {
	id, err := parseBankTransferId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	order, err := model.GetBankTransferOrderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}
	receipt, err := model.GetBankTransferReceipt(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "回执不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	image, err := common.DecryptIDNumber(receipt.ReceiptEnc)
	if err != nil {
		common.ApiErrorMsg(c, "回执解密失败")
		return
	}

	adminId := c.GetInt("id")
	model.RecordLog(adminId, model.LogTypeManage,
		fmt.Sprintf("查看用户 %d 对公转账回执 [receipt] (order_id=%d, trade_no=%s)", order.UserId, order.Id, order.TradeNo))

	common.ApiSuccess(c, dto.BankTransferReceiptResponse{
		ReceiptImage: "data:image/jpeg;base64," + image,
	})
}

// AdminApproveBankTransfer PUT /api/user/bank_transfer/admin/:id/approve
// 请求体可带 credited_fen 修正实际到账金额，缺省按申报金额入账（D3）。
func AdminApproveBankTransfer(c *gin.Context) {
	id, err := parseBankTransferId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.BankTransferApproveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	order, err := model.GetBankTransferOrderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	creditedFen := req.CreditedFen
	if creditedFen <= 0 {
		creditedFen = order.AmountFen
	}

	reviewerId := c.GetInt("id")
	if err := model.ApproveBankTransferOrder(id, reviewerId, creditedFen, req.ReviewRemark, c.ClientIP()); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("审批通过用户 %d 对公转账订单 [approve] (order_id=%d, trade_no=%s, 到账 ¥%.2f)",
			order.UserId, order.Id, order.TradeNo, common.FenToYuan(creditedFen)))

	common.ApiSuccess(c, nil)
}

// AdminRejectBankTransfer PUT /api/user/bank_transfer/admin/:id/reject
func AdminRejectBankTransfer(c *gin.Context) {
	id, err := parseBankTransferId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.BankTransferRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	order, err := model.GetBankTransferOrderById(id)
	if err != nil {
		common.ApiErrorMsg(c, "订单不存在")
		return
	}

	reviewerId := c.GetInt("id")
	if err := model.RejectBankTransferOrder(id, reviewerId, req.Reason); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("拒绝用户 %d 对公转账订单 [reject] (order_id=%d, trade_no=%s, 原因: %s)",
			order.UserId, order.Id, order.TradeNo, req.Reason))

	common.ApiSuccess(c, nil)
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// encryptBankTransferReceipt 校验并加密回执图片（必传），返回密文。
func encryptBankTransferReceipt(receipt string) (string, error) {
	if receipt == "" {
		return "", errors.New("请上传转账回执")
	}
	if len(receipt) > maxImageBase64Len {
		return "", errors.New("回执图片过大")
	}
	decoded, err := base64.StdEncoding.DecodeString(receipt)
	if err != nil {
		return "", errors.New("回执图片格式无效")
	}
	if len(decoded) > maxImageDecodedBytes {
		return "", errors.New("回执图片过大")
	}
	enc, err := common.EncryptIDNumber(receipt)
	if err != nil {
		return "", errors.New("回执图片处理失败")
	}
	return enc, nil
}

func parseBankTransferId(c *gin.Context) (int, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("无效的转账订单 ID")
	}
	return id, nil
}

// GetReviewPendingCounts 返回管理员待处理审核计数（实名认证 / 企业认证 / 对公转账+发票），
// 供侧边栏与页签红点提醒。任一计数查询失败按 0 处理，红点非关键路径不阻断页面。
func GetReviewPendingCounts(c *gin.Context) {
	kyc, _ := model.CountPendingKYC()
	enterprise, _ := model.CountPendingEnterprise()
	transfer, _ := model.CountPendingBankTransfer()
	invoice, _ := model.CountPendingInvoice()
	common.ApiSuccess(c, gin.H{
		"kyc":                 kyc,
		"enterprise":          enterprise,
		"bank_transfer":       transfer,
		"invoice":             invoice,
		"bank_transfer_total": transfer + invoice, // 侧边栏「对公转账」合计
	})
}
