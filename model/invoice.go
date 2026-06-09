package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

const (
	PaymentOrderTypeTopUp         = "topup"
	PaymentInvoiceStatusRequested = "requested"
	PaymentInvoiceStatusPending   = "pending"
	PaymentInvoiceStatusPaid      = "paid"
	PaymentInvoiceStatusFailed    = "failed"
	PaymentInvoiceStatusExpired   = "expired"
)

var ErrPaymentInvoiceNotFound = errors.New("payment invoice not found")

type InvoiceProfileFields struct {
	CompanyName  string `json:"company_name" gorm:"type:varchar(255)"`
	BillingEmail string `json:"billing_email" gorm:"type:varchar(255)"`
	TaxIDType    string `json:"tax_id_type" gorm:"type:varchar(64)"`
	TaxID        string `json:"tax_id" gorm:"type:varchar(128)"`
	Country      string `json:"country" gorm:"type:varchar(64)"`
	State        string `json:"state" gorm:"type:varchar(128)"`
	City         string `json:"city" gorm:"type:varchar(128)"`
	AddressLine1 string `json:"address_line1" gorm:"type:varchar(255)"`
	AddressLine2 string `json:"address_line2" gorm:"type:varchar(255)"`
	PostalCode   string `json:"postal_code" gorm:"type:varchar(64)"`
	Phone        string `json:"phone" gorm:"type:varchar(64)"`
}

type UserInvoiceProfile struct {
	Id     int `json:"id"`
	UserId int `json:"user_id" gorm:"uniqueIndex"`
	InvoiceProfileFields
	CreatedAt int64 `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt int64 `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type PaymentInvoice struct {
	Id               int    `json:"id"`
	TradeNo          string `json:"trade_no" gorm:"uniqueIndex;type:varchar(255)"`
	UserId           int    `json:"user_id" gorm:"index"`
	OrderType        string `json:"order_type" gorm:"type:varchar(32);index"`
	PaymentProvider  string `json:"payment_provider" gorm:"type:varchar(50);index"`
	InvoiceRequested bool   `json:"invoice_requested" gorm:"default:false"`
	InvoiceProfileFields
	StripeCustomerId        string `json:"stripe_customer_id" gorm:"type:varchar(128);index"`
	StripeCheckoutSessionId string `json:"stripe_checkout_session_id" gorm:"type:varchar(128);index"`
	StripeInvoiceId         string `json:"stripe_invoice_id" gorm:"type:varchar(128);index"`
	StripeInvoiceNumber     string `json:"stripe_invoice_number" gorm:"type:varchar(128)"`
	StripeInvoiceUrl        string `json:"stripe_invoice_url" gorm:"type:text"`
	StripeInvoicePdf        string `json:"stripe_invoice_pdf" gorm:"type:text"`
	InvoiceStatus           string `json:"invoice_status" gorm:"type:varchar(32);index"`
	CreatedAt               int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt               int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func NormalizeInvoiceProfileFields(fields InvoiceProfileFields) InvoiceProfileFields {
	fields.CompanyName = strings.TrimSpace(fields.CompanyName)
	fields.BillingEmail = strings.TrimSpace(fields.BillingEmail)
	fields.TaxIDType = strings.TrimSpace(fields.TaxIDType)
	fields.TaxID = strings.TrimSpace(fields.TaxID)
	fields.Country = strings.TrimSpace(fields.Country)
	fields.State = strings.TrimSpace(fields.State)
	fields.City = strings.TrimSpace(fields.City)
	fields.AddressLine1 = strings.TrimSpace(fields.AddressLine1)
	fields.AddressLine2 = strings.TrimSpace(fields.AddressLine2)
	fields.PostalCode = strings.TrimSpace(fields.PostalCode)
	fields.Phone = strings.TrimSpace(fields.Phone)
	return fields
}

func GetUserInvoiceProfile(userId int) (*UserInvoiceProfile, error) {
	profile := &UserInvoiceProfile{}
	err := DB.Where("user_id = ?", userId).First(profile).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return profile, nil
}

func SaveUserInvoiceProfile(profile *UserInvoiceProfile) error {
	if profile == nil {
		return errors.New("invoice profile is required")
	}
	profile.InvoiceProfileFields = NormalizeInvoiceProfileFields(profile.InvoiceProfileFields)

	existing := &UserInvoiceProfile{}
	err := DB.Where("user_id = ?", profile.UserId).First(existing).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return DB.Create(profile).Error
	}
	if err != nil {
		return err
	}

	profile.Id = existing.Id
	profile.CreatedAt = existing.CreatedAt
	return DB.Save(profile).Error
}

func CreatePaymentInvoiceSnapshot(invoice *PaymentInvoice) error {
	if invoice == nil {
		return errors.New("payment invoice is required")
	}
	invoice.InvoiceProfileFields = NormalizeInvoiceProfileFields(invoice.InvoiceProfileFields)
	if invoice.InvoiceStatus == "" {
		invoice.InvoiceStatus = PaymentInvoiceStatusRequested
	}
	return DB.Create(invoice).Error
}

func GetPaymentInvoiceByTradeNo(tradeNo string) (*PaymentInvoice, error) {
	invoice := &PaymentInvoice{}
	err := DB.Where("trade_no = ?", tradeNo).First(invoice).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, ErrPaymentInvoiceNotFound
	}
	if err != nil {
		return nil, err
	}
	return invoice, nil
}

func UpdatePaymentInvoiceStripeSession(tradeNo string, stripeCustomerId string, stripeCheckoutSessionId string) error {
	updates := map[string]interface{}{}
	if strings.TrimSpace(stripeCustomerId) != "" {
		updates["stripe_customer_id"] = strings.TrimSpace(stripeCustomerId)
	}
	if strings.TrimSpace(stripeCheckoutSessionId) != "" {
		updates["stripe_checkout_session_id"] = strings.TrimSpace(stripeCheckoutSessionId)
	}
	if len(updates) == 0 {
		return nil
	}

	result := DB.Model(&PaymentInvoice{}).Where("trade_no = ?", tradeNo).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentInvoiceNotFound
	}
	return nil
}

func UpdatePaymentInvoiceStatus(tradeNo string, status string) error {
	result := DB.Model(&PaymentInvoice{}).Where("trade_no = ?", tradeNo).Update("invoice_status", status)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentInvoiceNotFound
	}
	return nil
}

type StripeInvoiceUpdate struct {
	StripeCustomerId        string
	StripeCheckoutSessionId string
	StripeInvoiceId         string
	StripeInvoiceNumber     string
	StripeInvoiceUrl        string
	StripeInvoicePdf        string
	InvoiceStatus           string
}

func UpdatePaymentInvoiceStripeInvoice(tradeNo string, update StripeInvoiceUpdate) error {
	updates := map[string]interface{}{}
	if strings.TrimSpace(update.StripeCustomerId) != "" {
		updates["stripe_customer_id"] = strings.TrimSpace(update.StripeCustomerId)
	}
	if strings.TrimSpace(update.StripeCheckoutSessionId) != "" {
		updates["stripe_checkout_session_id"] = strings.TrimSpace(update.StripeCheckoutSessionId)
	}
	if strings.TrimSpace(update.StripeInvoiceId) != "" {
		updates["stripe_invoice_id"] = strings.TrimSpace(update.StripeInvoiceId)
	}
	if strings.TrimSpace(update.StripeInvoiceNumber) != "" {
		updates["stripe_invoice_number"] = strings.TrimSpace(update.StripeInvoiceNumber)
	}
	if strings.TrimSpace(update.StripeInvoiceUrl) != "" {
		updates["stripe_invoice_url"] = strings.TrimSpace(update.StripeInvoiceUrl)
	}
	if strings.TrimSpace(update.StripeInvoicePdf) != "" {
		updates["stripe_invoice_pdf"] = strings.TrimSpace(update.StripeInvoicePdf)
	}
	if strings.TrimSpace(update.InvoiceStatus) != "" {
		updates["invoice_status"] = strings.TrimSpace(update.InvoiceStatus)
	}
	if len(updates) == 0 {
		return nil
	}

	result := DB.Model(&PaymentInvoice{}).Where("trade_no = ?", tradeNo).Updates(updates)
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return ErrPaymentInvoiceNotFound
	}
	return nil
}
