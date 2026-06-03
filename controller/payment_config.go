package controller

import (
	"strconv"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"

	"github.com/gin-gonic/gin"
)

func maskPaymentConfig(config *model.PaymentConfig) {
	if config.AppPrivateKey != "" {
		config.AppPrivateKey = common.MaskSecret(config.AppPrivateKey)
	}
	if config.AlipayPublicKey != "" {
		config.AlipayPublicKey = common.MaskSecret(config.AlipayPublicKey)
	}
	if config.WechatAPIKey != "" {
		config.WechatAPIKey = common.MaskSecret(config.WechatAPIKey)
	}
	if config.WechatPrivateKey != "" {
		config.WechatPrivateKey = common.MaskSecret(config.WechatPrivateKey)
	}
}

func shouldEncryptPaymentSecret(secret string) bool {
	if secret == "" || common.IsMaskedSecret(secret) {
		return false
	}
	_, err := common.DecryptPaymentSecret(secret)
	return err != nil
}

func encryptPaymentConfigSensitiveFields(config *model.PaymentConfig) error {
	if shouldEncryptPaymentSecret(config.AppPrivateKey) {
		encrypted, err := common.EncryptPaymentSecret(config.AppPrivateKey)
		if err != nil {
			return err
		}
		config.AppPrivateKey = encrypted
	}
	if shouldEncryptPaymentSecret(config.AlipayPublicKey) {
		encrypted, err := common.EncryptPaymentSecret(config.AlipayPublicKey)
		if err != nil {
			return err
		}
		config.AlipayPublicKey = encrypted
	}
	if shouldEncryptPaymentSecret(config.WechatAPIKey) {
		encrypted, err := common.EncryptPaymentSecret(config.WechatAPIKey)
		if err != nil {
			return err
		}
		config.WechatAPIKey = encrypted
	}
	if shouldEncryptPaymentSecret(config.WechatPrivateKey) {
		encrypted, err := common.EncryptPaymentSecret(config.WechatPrivateKey)
		if err != nil {
			return err
		}
		config.WechatPrivateKey = encrypted
	}
	return nil
}

func handleMaskedFieldsOnUpdate(config *model.PaymentConfig, existing *model.PaymentConfig) {
	if common.IsMaskedSecret(config.AppPrivateKey) {
		config.AppPrivateKey = existing.AppPrivateKey
	}
	if common.IsMaskedSecret(config.AlipayPublicKey) {
		config.AlipayPublicKey = existing.AlipayPublicKey
	}
	if common.IsMaskedSecret(config.WechatAPIKey) {
		config.WechatAPIKey = existing.WechatAPIKey
	}
	if common.IsMaskedSecret(config.WechatPrivateKey) {
		config.WechatPrivateKey = existing.WechatPrivateKey
	}
}

func GetPaymentConfigs(c *gin.Context) {
	configs, err := model.GetAllPaymentConfigs()
	if err != nil {
		common.ApiErrorMsg(c, "Failed to get payment configs")
		return
	}
	for _, config := range configs {
		maskPaymentConfig(config)
	}
	common.ApiSuccess(c, configs)
}

func GetPaymentConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid ID")
		return
	}
	config, err := model.GetPaymentConfigByID(id)
	if err != nil {
		common.ApiErrorMsg(c, "Payment config not found")
		return
	}
	maskPaymentConfig(config)
	common.ApiSuccess(c, config)
}

func GetPaymentConfigByProvider(c *gin.Context) {
	provider := c.Param("provider")
	config, err := model.GetPaymentConfigByProvider(provider)
	if err != nil {
		common.ApiSuccess(c, nil)
		return
	}
	maskPaymentConfig(config)
	common.ApiSuccess(c, config)
}

func CreatePaymentConfig(c *gin.Context) {
	var config model.PaymentConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	if !model.IsSupportedPaymentConfigProvider(config.Provider) {
		common.ApiErrorMsg(c, "Unsupported provider, only alipay and wxpay are allowed")
		return
	}
	if _, err := model.GetPaymentConfigByProvider(config.Provider); err == nil {
		common.ApiErrorMsg(c, "Payment config for this provider already exists")
		return
	}
	if err := encryptPaymentConfigSensitiveFields(&config); err != nil {
		common.ApiErrorMsg(c, "Failed to encrypt sensitive fields")
		return
	}
	if err := model.CreatePaymentConfig(&config); err != nil {
		common.ApiErrorMsg(c, "Failed to create payment config")
		return
	}
	maskPaymentConfig(&config)
	common.ApiSuccess(c, config)
}

func UpdatePaymentConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid ID")
		return
	}
	existing, err := model.GetPaymentConfigByID(id)
	if err != nil {
		common.ApiErrorMsg(c, "Payment config not found")
		return
	}
	var config model.PaymentConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		common.ApiErrorMsg(c, "Invalid request body")
		return
	}
	config.ID = id
	handleMaskedFieldsOnUpdate(&config, existing)
	if err := encryptPaymentConfigSensitiveFields(&config); err != nil {
		common.ApiErrorMsg(c, "Failed to encrypt sensitive fields")
		return
	}
	if err := model.UpdatePaymentConfig(&config); err != nil {
		common.ApiErrorMsg(c, "Failed to update payment config")
		return
	}
	maskPaymentConfig(&config)
	common.ApiSuccess(c, config)
}

func DeletePaymentConfig(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.Atoi(idStr)
	if err != nil {
		common.ApiErrorMsg(c, "Invalid ID")
		return
	}
	if err := model.DeletePaymentConfig(id); err != nil {
		common.ApiErrorMsg(c, "Failed to delete payment config")
		return
	}
	common.ApiSuccess(c, nil)
}
