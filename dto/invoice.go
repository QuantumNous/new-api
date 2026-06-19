package dto

import "time"

// 增值税发票 DTO（docs/enterprise-features-design.md §三）。
// 金额字段单位「分」（D1），字段名带 Fen 后缀。

type InvoiceSubmitRequest struct {
	AmountFen   int64  `json:"amount_fen"   binding:"required,gt=0"`
	InvoiceType int    `json:"invoice_type" binding:"required,oneof=1 2"` // 1=增值税普通发票 2=增值税专用发票
	Title       string `json:"title"        binding:"required,max=128"`
	TaxNo       string `json:"tax_no"       binding:"required,max=32"`
	Email       string `json:"email"        binding:"required,email,max=128"`
	Remark      string `json:"remark"       binding:"max=255"`
}

type InvoiceRejectRequest struct {
	Reason string `json:"reason" binding:"required,max=255"`
}

// InvoiceIssueRequest 管理员开具：上传发票文件（base64）。
type InvoiceIssueRequest struct {
	FileName string `json:"file_name" binding:"required,max=128"`
	FileData string `json:"file_data" binding:"required"` // base64（PDF/JPG/PNG）
}

// InvoiceQuotaResponse 可开票额度 + 抬头预填信息。
type InvoiceQuotaResponse struct {
	AvailableFen int64  `json:"available_fen"`
	CompanyName  string `json:"company_name,omitempty"` // 企业认证的公司名称，前端预填抬头
	// 上次提交的开票信息（按用户隔离、跨登录持久），供前端默认填入；无历史时各字段为空
	LastInvoiceType int    `json:"last_invoice_type,omitempty"`
	LastTitle       string `json:"last_title,omitempty"`
	LastTaxNo       string `json:"last_tax_no,omitempty"`
	LastEmail       string `json:"last_email,omitempty"`
}

type InvoiceAdminItem struct {
	Id           int        `json:"id"`
	UserId       int        `json:"user_id"`
	Username     string     `json:"username"`
	AmountFen    int64      `json:"amount_fen"`
	InvoiceType  int        `json:"invoice_type"`
	Title        string     `json:"title"`
	TaxNo        string     `json:"tax_no"`
	Email        string     `json:"email"`
	Remark       string     `json:"remark,omitempty"`
	Status       int        `json:"status"`
	RejectReason string     `json:"reject_reason,omitempty"`
	ReviewedBy   int        `json:"reviewed_by,omitempty"`
	ReviewerName string     `json:"reviewer_name,omitempty"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
}

type InvoiceFileResponse struct {
	FileName string `json:"file_name"`
	FileData string `json:"file_data"` // base64
}
