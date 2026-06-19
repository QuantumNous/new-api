package controller

import (
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/model"
	"gorm.io/gorm"

	"github.com/gin-gonic/gin"
)

// 增值税发票（docs/enterprise-features-design.md §三）。
// 申请仅对已通过企业认证的用户开放（requireEnterpriseApproved 与对公转账共用，
// 同包定义于 controller/bank_transfer.go）；文件大小复用 KYC 图片常量。

// invoiceAllowedFileExts 发票文件扩展名白名单（小写）。
var invoiceAllowedFileExts = map[string]bool{
	".pdf": true, ".jpg": true, ".jpeg": true, ".png": true,
}

// ─── User-side handlers ───────────────────────────────────────────────────────

// GetInvoiceQuota GET /api/user/invoice/quota
// 返回可开票额度与抬头预填（企业认证的公司名）。
func GetInvoiceQuota(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	userId := c.GetInt("id")
	available, err := model.GetUserInvoiceAvailableFen(userId)
	if err != nil {
		common.ApiErrorMsg(c, "查询可开票额度失败")
		return
	}
	companyName := ""
	if ent, err := model.GetEnterpriseByUserId(userId); err == nil && ent != nil {
		companyName = ent.CompanyName
	}
	resp := dto.InvoiceQuotaResponse{
		AvailableFen: available,
		CompanyName:  companyName,
	}
	// 带上上次提交的开票信息作默认值（按用户隔离、跨登录持久）
	if last, err := model.GetUserLastInvoiceRequest(userId); err == nil && last != nil {
		resp.LastInvoiceType = last.InvoiceType
		resp.LastTitle = last.Title
		resp.LastTaxNo = last.TaxNo
		resp.LastEmail = last.Email
	}
	common.ApiSuccess(c, resp)
}

// GetUserInvoices GET /api/user/invoice/self
// 历史申请对本人始终可查（即使企业认证后被重置）。
func GetUserInvoices(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)
	invoices, total, err := model.GetUserInvoices(userId, pageInfo)
	if err != nil {
		common.ApiErrorMsg(c, "查询发票申请失败")
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    invoices,
		"total":   total,
	})
}

// SubmitInvoice POST /api/user/invoice
func SubmitInvoice(c *gin.Context) {
	if !requireEnterpriseApproved(c) {
		return
	}
	var req dto.InvoiceSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}

	userId := c.GetInt("id")
	invoice, err := model.CreateInvoiceRequest(userId, req.AmountFen, req.InvoiceType,
		strings.TrimSpace(req.Title), strings.TrimSpace(req.TaxNo), strings.TrimSpace(req.Email), req.Remark)
	if err != nil {
		if errors.Is(err, model.ErrInvoiceHasPending) ||
			errors.Is(err, model.ErrInvoiceQuotaExceeded) ||
			errors.Is(err, model.ErrInvoiceInvalidAmount) {
			common.ApiErrorMsg(c, err.Error())
			return
		}
		common.ApiErrorMsg(c, "提交失败，请稍后重试")
		return
	}
	c.JSON(http.StatusCreated, gin.H{
		"success": true,
		"message": "",
		"data":    invoice,
	})
}

// CancelInvoice DELETE /api/user/invoice/:id
func CancelInvoice(c *gin.Context) {
	id, err := parseInvoiceId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	userId := c.GetInt("id")
	if err := model.CancelInvoiceRequest(userId, id); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	common.ApiSuccess(c, nil)
}

// GetUserInvoiceFile GET /api/user/invoice/:id/file — 仅本人可下载已开具的发票文件。
func GetUserInvoiceFile(c *gin.Context) {
	id, err := parseInvoiceId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	userId := c.GetInt("id")
	invoice, err := model.GetInvoiceById(id)
	if err != nil || invoice.UserId != userId {
		common.ApiErrorMsg(c, "发票申请不存在")
		return
	}
	if invoice.Status != model.InvoiceStatusIssued {
		common.ApiErrorMsg(c, "发票尚未开具")
		return
	}
	file, err := model.GetInvoiceFile(id)
	if err != nil {
		common.ApiErrorMsg(c, "发票文件不存在")
		return
	}
	common.ApiSuccess(c, dto.InvoiceFileResponse{
		FileName: file.FileName,
		FileData: file.FileData,
	})
}

// ─── Admin-side handlers ──────────────────────────────────────────────────────

// AdminGetInvoiceList GET /api/user/invoice/admin?status=1&keyword=xxx&page=1&page_size=20
func AdminGetInvoiceList(c *gin.Context) {
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

	rows, total, err := model.GetInvoiceList(status, keyword, page, pageSize)
	if err != nil {
		common.ApiErrorMsg(c, "查询失败")
		return
	}

	items := make([]dto.InvoiceAdminItem, 0, len(rows))
	for _, row := range rows {
		items = append(items, dto.InvoiceAdminItem{
			Id:           row.Id,
			UserId:       row.UserId,
			Username:     row.Username,
			AmountFen:    row.AmountFen,
			InvoiceType:  row.InvoiceType,
			Title:        row.Title,
			TaxNo:        row.TaxNo,
			Email:        row.Email,
			Remark:       row.Remark,
			Status:       row.Status,
			RejectReason: row.RejectReason,
			ReviewedBy:   row.ReviewedBy,
			ReviewerName: row.ReviewerName,
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

// AdminIssueInvoice PUT /api/user/invoice/admin/:id/issue — 上传发票文件并标记已开具。
func AdminIssueInvoice(c *gin.Context) {
	id, err := parseInvoiceId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.InvoiceIssueRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	fileName, err := validateInvoiceFile(req.FileName, req.FileData)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	invoice, err := model.GetInvoiceById(id)
	if err != nil {
		common.ApiErrorMsg(c, "发票申请不存在")
		return
	}

	reviewerId := c.GetInt("id")
	if err := model.IssueInvoice(id, reviewerId, fileName, req.FileData); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("开具用户 %d 增值税发票 [issue] (invoice_id=%d, 金额 ¥%.2f, 抬头: %s)",
			invoice.UserId, invoice.Id, common.FenToYuan(invoice.AmountFen), invoice.Title))

	common.ApiSuccess(c, nil)
}

// AdminRejectInvoice PUT /api/user/invoice/admin/:id/reject
func AdminRejectInvoice(c *gin.Context) {
	id, err := parseInvoiceId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	var req dto.InvoiceRejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "参数错误："+err.Error())
		return
	}
	invoice, err := model.GetInvoiceById(id)
	if err != nil {
		common.ApiErrorMsg(c, "发票申请不存在")
		return
	}

	reviewerId := c.GetInt("id")
	if err := model.RejectInvoice(id, reviewerId, req.Reason); err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}

	model.RecordLog(reviewerId, model.LogTypeManage,
		fmt.Sprintf("拒绝用户 %d 增值税发票申请 [reject] (invoice_id=%d, 原因: %s)",
			invoice.UserId, invoice.Id, req.Reason))

	common.ApiSuccess(c, nil)
}

// AdminGetInvoiceFile GET /api/user/invoice/admin/:id/file — 管理员查看已开具的发票文件。
func AdminGetInvoiceFile(c *gin.Context) {
	id, err := parseInvoiceId(c)
	if err != nil {
		common.ApiErrorMsg(c, err.Error())
		return
	}
	file, err := model.GetInvoiceFile(id)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			common.ApiErrorMsg(c, "发票文件不存在")
			return
		}
		common.ApiErrorMsg(c, "查询失败")
		return
	}
	common.ApiSuccess(c, dto.InvoiceFileResponse{
		FileName: file.FileName,
		FileData: file.FileData,
	})
}

// ─── helpers ──────────────────────────────────────────────────────────────────

// validateInvoiceFile 校验扩展名白名单与大小，返回净化后的文件名。
// 大小限制复用 KYC 图片常量（base64 ≤ 7MB / 解码 ≤ 5MB），PDF 同样适用。
func validateInvoiceFile(fileName string, fileData string) (string, error) {
	name := strings.TrimSpace(fileName)
	// 去除路径成分，防目录穿越类脏数据入库
	if idx := strings.LastIndexAny(name, "/\\"); idx >= 0 {
		name = name[idx+1:]
	}
	if name == "" {
		return "", errors.New("文件名无效")
	}
	dot := strings.LastIndex(name, ".")
	if dot < 0 || !invoiceAllowedFileExts[strings.ToLower(name[dot:])] {
		return "", errors.New("仅支持 PDF/JPG/PNG 格式的发票文件")
	}
	if len(fileData) > maxImageBase64Len {
		return "", errors.New("发票文件过大")
	}
	decoded, err := base64.StdEncoding.DecodeString(fileData)
	if err != nil {
		return "", errors.New("发票文件格式无效")
	}
	if len(decoded) > maxImageDecodedBytes {
		return "", errors.New("发票文件过大")
	}
	return name, nil
}

func parseInvoiceId(c *gin.Context) (int, error) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil || id <= 0 {
		return 0, fmt.Errorf("无效的发票申请 ID")
	}
	return id, nil
}
