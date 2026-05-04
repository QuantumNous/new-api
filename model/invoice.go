package model

import (
	"errors"
	"time"

	"github.com/QuantumNous/new-api/common"
)

const (
	InvoiceStatusPending  = "pending"
	InvoiceStatusIssued   = "issued"
	InvoiceStatusRejected = "rejected"
)

type Invoice struct {
	Id           int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId       int     `json:"user_id" gorm:"index"`
	TopUpId      int     `json:"topup_id" gorm:"index"`
	TradeNo      string  `json:"trade_no" gorm:"type:varchar(255);index"`
	Amount       float64 `json:"amount"`
	TaxAmount    float64 `json:"tax_amount"`
	InvoiceTitle string  `json:"invoice_title" gorm:"type:varchar(255)"`
	TaxNumber    string  `json:"tax_number" gorm:"type:varchar(50)"`
	Email        string  `json:"email" gorm:"type:varchar(255)"`
	Remark       string  `json:"remark" gorm:"type:text"`
	Status       string  `json:"status" gorm:"type:varchar(20);default:'pending'"`
	AdminRemark  string  `json:"admin_remark" gorm:"type:text"`
	CreatedAt    int64   `json:"created_at"`
	UpdatedAt    int64   `json:"updated_at"`
}

func (invoice *Invoice) Insert() error {
	invoice.CreatedAt = time.Now().Unix()
	invoice.UpdatedAt = invoice.CreatedAt
	return DB.Create(invoice).Error
}

func GetInvoiceById(id int) (*Invoice, error) {
	var invoice Invoice
	err := DB.Where("id = ?", id).First(&invoice).Error
	if err != nil {
		return nil, err
	}
	return &invoice, nil
}

func GetUserInvoices(userId int, pageInfo *common.PageInfo) (invoices []*Invoice, total int64, err error) {
	query := DB.Model(&Invoice{}).Where("user_id = ?", userId)
	err = query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	if err != nil {
		return nil, 0, err
	}
	return invoices, total, nil
}

func GetAllInvoices(status string, pageInfo *common.PageInfo) (invoices []*Invoice, total int64, err error) {
	query := DB.Model(&Invoice{})
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err = query.Count(&total).Error
	if err != nil {
		return nil, 0, err
	}
	err = query.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&invoices).Error
	if err != nil {
		return nil, 0, err
	}
	return invoices, total, nil
}

func ApplyInvoice(userId int, topUpId int, invoiceTitle string, taxNumber string, email string, remark string) (*Invoice, error) {
	// 查找 TopUp 订单
	topUp := GetTopUpById(topUpId)
	if topUp == nil {
		return nil, errors.New("充值订单不存在")
	}
	if topUp.UserId != userId {
		return nil, errors.New("无权操作该订单")
	}
	if topUp.Status != common.TopUpStatusSuccess {
		return nil, errors.New("该订单尚未支付成功")
	}
	if topUp.InvoiceStatus == InvoiceStatusPending || topUp.InvoiceStatus == InvoiceStatusIssued {
		return nil, errors.New("该订单已申请过开票")
	}
	if !topUp.IncludeTax {
		return nil, errors.New("不含税订单不支持在线开票")
	}

	// 计算开票金额
	invoiceAmount := topUp.Money
	taxAmount := topUp.TaxAmount

	invoice := &Invoice{
		UserId:       userId,
		TopUpId:      topUpId,
		TradeNo:      topUp.TradeNo,
		Amount:       invoiceAmount,
		TaxAmount:    taxAmount,
		InvoiceTitle: invoiceTitle,
		TaxNumber:    taxNumber,
		Email:        email,
		Remark:       remark,
		Status:       InvoiceStatusPending,
	}

	err := invoice.Insert()
	if err != nil {
		return nil, err
	}

	// 更新 TopUp 的开票状态
	DB.Model(&TopUp{}).Where("id = ?", topUpId).Update("invoice_status", InvoiceStatusPending)

	return invoice, nil
}

func ProcessInvoice(invoiceId int, status string, adminRemark string) error {
	if status != InvoiceStatusIssued && status != InvoiceStatusRejected {
		return errors.New("无效的状态")
	}

	invoice, err := GetInvoiceById(invoiceId)
	if err != nil {
		return errors.New("开票申请不存在")
	}
	if invoice.Status != InvoiceStatusPending {
		return errors.New("该申请已处理")
	}

	now := time.Now().Unix()
	err = DB.Model(&Invoice{}).Where("id = ?", invoiceId).Updates(map[string]interface{}{
		"status":       status,
		"admin_remark": adminRemark,
		"updated_at":   now,
	}).Error
	if err != nil {
		return err
	}

	// 同步更新 TopUp 的开票状态和管理员备注
	DB.Model(&TopUp{}).Where("id = ?", invoice.TopUpId).Updates(map[string]interface{}{
		"invoice_status":       status,
		"invoice_admin_remark": adminRemark,
	})

	return nil
}
