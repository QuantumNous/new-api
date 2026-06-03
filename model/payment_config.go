package model

import "time"

type PaymentConfig struct {
	ID          int    `json:"id" gorm:"primaryKey"`
	Provider    string `json:"provider" gorm:"type:varchar(50);not null;uniqueIndex"`
	Name        string `json:"name" gorm:"type:varchar(100);not null"`
	DisplayName string `json:"display_name" gorm:"type:varchar(100)"`
	IconURL     string `json:"icon_url" gorm:"type:text"`
	Enabled     bool   `json:"enabled" gorm:"default:false"`
	SortOrder   int    `json:"sort_order" gorm:"default:0"`

	AppID               string `json:"app_id" gorm:"type:varchar(255)"`
	AppPrivateKey       string `json:"app_private_key" gorm:"type:text"`
	AlipayPublicKey     string `json:"alipay_public_key" gorm:"type:text"`
	AlipayAppPublicCert string `json:"alipay_app_public_cert" gorm:"type:text"`
	AlipayPublicCert    string `json:"alipay_public_cert" gorm:"type:text"`
	AlipayRootCert      string `json:"alipay_root_cert" gorm:"type:text"`

	WechatAppID      string `json:"wechat_app_id" gorm:"type:varchar(255)"`
	WechatMchID      string `json:"wechat_mch_id" gorm:"type:varchar(255)"`
	WechatAPIKey     string `json:"wechat_api_key" gorm:"type:varchar(255)"`
	WechatSerialNo   string `json:"wechat_serial_no" gorm:"type:varchar(255)"`
	WechatPrivateKey string `json:"wechat_private_key" gorm:"type:text"`
	WechatCert       string `json:"wechat_cert" gorm:"type:text"`

	GatewayURL  string `json:"gateway_url" gorm:"type:varchar(500)"`
	NotifyURL   string `json:"notify_url" gorm:"type:varchar(500)"`
	ReturnURL   string `json:"return_url" gorm:"type:varchar(500)"`
	ExtraConfig string `json:"extra_config" gorm:"type:text"`

	CreatedAt int64 `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt int64 `json:"updated_at" gorm:"autoUpdateTime"`
}

func (PaymentConfig) TableName() string {
	return "payment_configs"
}

func IsSupportedPaymentConfigProvider(provider string) bool {
	return provider == PaymentProviderAlipay || provider == PaymentProviderWechat
}

func CreatePaymentConfig(config *PaymentConfig) error {
	now := time.Now().Unix()
	config.CreatedAt = now
	config.UpdatedAt = now
	return DB.Create(config).Error
}

func GetPaymentConfigByID(id int) (*PaymentConfig, error) {
	var config PaymentConfig
	if err := DB.First(&config, id).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func GetPaymentConfigByProvider(provider string) (*PaymentConfig, error) {
	var config PaymentConfig
	if err := DB.Where("provider = ?", provider).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func GetEnabledPaymentConfigByProvider(provider string) (*PaymentConfig, error) {
	var config PaymentConfig
	if err := DB.Where("provider = ? AND enabled = ?", provider, true).First(&config).Error; err != nil {
		return nil, err
	}
	return &config, nil
}

func GetAllPaymentConfigs() ([]*PaymentConfig, error) {
	var configs []*PaymentConfig
	err := DB.Order("sort_order asc, id asc").Find(&configs).Error
	return configs, err
}

func GetEnabledPaymentConfigs() ([]*PaymentConfig, error) {
	var configs []*PaymentConfig
	err := DB.Where("enabled = ?", true).Order("sort_order asc, id asc").Find(&configs).Error
	return configs, err
}

func UpdatePaymentConfig(config *PaymentConfig) error {
	config.UpdatedAt = time.Now().Unix()
	return DB.Save(config).Error
}

func DeletePaymentConfig(id int) error {
	return DB.Delete(&PaymentConfig{}, id).Error
}
