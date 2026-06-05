package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type SecureVerificationSettings struct {
	SensitiveOperationsRequired bool `json:"sensitive_operations_required"`
}

var secureVerificationSettings = SecureVerificationSettings{
	SensitiveOperationsRequired: false,
}

func init() {
	config.GlobalConfig.Register("secure_verification", &secureVerificationSettings)
}

func GetSecureVerificationSettings() *SecureVerificationSettings {
	return &secureVerificationSettings
}
