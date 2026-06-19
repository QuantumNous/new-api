package dto

import "time"

// 对公转账充值 DTO（docs/enterprise-features-design.md §2.4）。
// 所有金额字段单位为「分」（D1），字段名一律带 Fen 后缀。

type BankTransferSubmitRequest struct {
	AmountFen int64  `json:"amount_fen" binding:"required,gt=0"`
	Remark    string `json:"remark"     binding:"max=255"`
	Receipt   string `json:"receipt"` // 转账回执图片 base64（必传，handler 校验）
}

type BankTransferApproveRequest struct {
	CreditedFen  int64  `json:"credited_fen"`                          // 实际到账金额（分）；0/缺省 = 按申报金额入账
	ReviewRemark string `json:"review_remark" binding:"max=255"`       // 入账备注（如 BD/合同/折扣约定）
}

type BankTransferRejectRequest struct {
	Reason string `json:"reason" binding:"required,max=255"`
}

// BankTransferConfigResponse 用户侧收款信息。未启用或用户未通过企业认证时仅返回 enabled=false。
type BankTransferConfigResponse struct {
	Enabled       bool   `json:"enabled"`
	CompanyName   string `json:"company_name,omitempty"`
	PayeeName     string `json:"payee_name,omitempty"`
	AccountNumber string `json:"account_number,omitempty"`
	BankName      string `json:"bank_name,omitempty"`
	MinAmountFen  int64  `json:"min_amount_fen,omitempty"`
	Tips          string `json:"tips,omitempty"`
}

type BankTransferAdminItem struct {
	Id           int        `json:"id"`
	UserId       int        `json:"user_id"`
	Username     string     `json:"username"`
	AmountFen    int64      `json:"amount_fen"`
	CreditedFen  int64      `json:"credited_fen"`
	QuotaGranted int64      `json:"quota_granted"`
	Remark       string     `json:"remark,omitempty"`
	TradeNo      string     `json:"trade_no"`
	Status       int        `json:"status"`
	ReviewRemark string     `json:"review_remark,omitempty"`
	RejectReason string     `json:"reject_reason,omitempty"`
	ReviewedBy   int        `json:"reviewed_by,omitempty"`
	ReviewerName string     `json:"reviewer_name,omitempty"`
	HasReceipt   bool       `json:"has_receipt"`
	SubmittedAt  *time.Time `json:"submitted_at,omitempty"`
	ReviewedAt   *time.Time `json:"reviewed_at,omitempty"`
}

type BankTransferReceiptResponse struct {
	ReceiptImage string `json:"receipt_image"` // data:image/jpeg;base64,...
}
