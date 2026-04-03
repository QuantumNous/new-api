package system_setting

import "github.com/QuantumNous/new-api/setting/config"

type SmsSettings struct {
	Enabled         bool   `json:"enabled"`
	Provider        string `json:"provider"`           // "aliyun", "aliyun_pnvs", "tencent"
	AccessKeyId     string `json:"access_key_id"`
	AccessKeySecret string `json:"access_key_secret"`
	SignName        string `json:"sign_name"`
	TemplateCode    string `json:"template_code"`
	AppId           string `json:"app_id"`      // Tencent Cloud specific
	SchemeCode      string `json:"scheme_code"` // Aliyun PNVS specific (optional)
}

var defaultSmsSettings = SmsSettings{}

func init() {
	config.GlobalConfig.Register("sms", &defaultSmsSettings)
}

func GetSmsSettings() *SmsSettings {
	return &defaultSmsSettings
}
