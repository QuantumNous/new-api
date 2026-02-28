package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type ProxySetting struct {
	DefaultTLSFingerprint string `json:"default_tls_fingerprint"`
	DefaultTLSCustom      string `json:"default_tls_custom"`
}

var defaultProxySetting = ProxySetting{
	DefaultTLSFingerprint: "",
	DefaultTLSCustom:      "",
}

func init() {
	config.GlobalConfig.Register("proxy_setting", &defaultProxySetting)
}

func GetProxySetting() *ProxySetting {
	return &defaultProxySetting
}
