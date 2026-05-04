package controller

import (
	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

// --- 用户端 API ---

type ApplyInvoiceRequest struct {
	TopUpId      int    `json:"topup_id"`
	InvoiceTitle string `json:"invoice_title"`
	TaxNumber    string `json:"tax_number"`
	Email        string `json:"email"`
	Remark       string `json:"remark"`
}

// ApplyInvoice 用户申请开票
func ApplyInvoice(c *gin.Context) {
	userId := c.GetInt("id")

	var req ApplyInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.TopUpId <= 0 {
		common.ApiErrorMsg(c, "请选择充值订单")
		return
	}
	if req.InvoiceTitle == "" {
		common.ApiErrorMsg(c, "请填写发票抬头")
		return
	}
	if req.Email == "" {
		common.ApiErrorMsg(c, "请填写接收邮箱")
		return
	}

	invoice, err := model.ApplyInvoice(userId, req.TopUpId, req.InvoiceTitle, req.TaxNumber, req.Email, req.Remark)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, invoice)
}

// GetUserInvoices 用户查看自己的开票记录
func GetUserInvoices(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	invoices, total, err := model.GetUserInvoices(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

// --- 管理员 API ---

// AdminGetAllInvoices 管理员查看所有开票申请
func AdminGetAllInvoices(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	pageInfo := common.GetPageQuery(c)

	invoices, total, err := model.GetAllInvoices(status, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(invoices)
	common.ApiSuccess(c, pageInfo)
}

type ProcessInvoiceRequest struct {
	Id          int    `json:"id"`
	Status      string `json:"status"`
	AdminRemark string `json:"admin_remark"`
}

// AdminProcessInvoice 管理员处理开票申请（确认开票/拒绝）
func AdminProcessInvoice(c *gin.Context) {
	var req ProcessInvoiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误")
		return
	}
	if req.Id <= 0 {
		common.ApiErrorMsg(c, "请选择开票申请")
		return
	}

	err := model.ProcessInvoice(req.Id, req.Status, req.AdminRemark)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}
