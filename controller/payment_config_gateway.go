package controller

import (
	"fmt"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
)

func getDecryptedPaymentConfig(provider string) (*model.PaymentConfig, error) {
	config, err := model.GetEnabledPaymentConfigByProvider(provider)
	if err != nil {
		return nil, err
	}
	if err := decryptPaymentConfigSensitiveFields(config); err != nil {
		return nil, err
	}
	return config, nil
}

func decryptPaymentConfigSensitiveFields(config *model.PaymentConfig) error {
	if config == nil {
		return fmt.Errorf("payment config is nil")
	}
	var err error
	if config.AppPrivateKey != "" && !common.IsMaskedSecret(config.AppPrivateKey) {
		config.AppPrivateKey, err = common.DecryptPaymentSecret(config.AppPrivateKey)
		if err != nil {
			return err
		}
	}
	if config.AlipayPublicKey != "" && !common.IsMaskedSecret(config.AlipayPublicKey) {
		config.AlipayPublicKey, err = common.DecryptPaymentSecret(config.AlipayPublicKey)
		if err != nil {
			return err
		}
	}
	if config.WechatAPIKey != "" && !common.IsMaskedSecret(config.WechatAPIKey) {
		config.WechatAPIKey, err = common.DecryptPaymentSecret(config.WechatAPIKey)
		if err != nil {
			return err
		}
	}
	if config.WechatPrivateKey != "" && !common.IsMaskedSecret(config.WechatPrivateKey) {
		config.WechatPrivateKey, err = common.DecryptPaymentSecret(config.WechatPrivateKey)
		if err != nil {
			return err
		}
	}
	return nil
}

func yuanToFen(amount float64) int64 {
	return int64(amount*100 + 0.5)
}
