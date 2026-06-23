package model

type PaymentMetadata struct {
	Id                int    `json:"id"`
	TradeNo           string `json:"trade_no" gorm:"unique;type:varchar(255);index"`
	PaymentProvider   string `json:"payment_provider" gorm:"type:varchar(50);index"`
	ExternalPaymentID string `json:"external_payment_id" gorm:"type:varchar(255);index"`
	Metadata          string `json:"metadata" gorm:"type:text"`
	CreateTime        int64  `json:"create_time"`
	UpdateTime        int64  `json:"update_time"`
}

func (paymentMetadata *PaymentMetadata) Insert() error {
	return DB.Create(paymentMetadata).Error
}

func (paymentMetadata *PaymentMetadata) Update() error {
	return DB.Save(paymentMetadata).Error
}

func GetPaymentMetadataByTradeNo(tradeNo string) *PaymentMetadata {
	var paymentMetadata PaymentMetadata
	err := DB.Where("trade_no = ?", tradeNo).First(&paymentMetadata).Error
	if err != nil {
		return nil
	}
	return &paymentMetadata
}

func GetPaymentMetadataByExternalPaymentID(provider string, externalPaymentID string) *PaymentMetadata {
	var paymentMetadata PaymentMetadata
	err := DB.Where("payment_provider = ? AND external_payment_id = ?", provider, externalPaymentID).First(&paymentMetadata).Error
	if err != nil {
		return nil
	}
	return &paymentMetadata
}
