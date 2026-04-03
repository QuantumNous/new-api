package sms

import (
	"fmt"

	"github.com/QuantumNous/new-api/setting/system_setting"
)

// SmsSender defines the interface for sending SMS verification codes.
type SmsSender interface {
	SendCode(phone string, code string) error
}

// NewSender creates an SmsSender based on the current SMS provider configuration.
func NewSender() (SmsSender, error) {
	settings := system_setting.GetSmsSettings()
	switch settings.Provider {
	case "aliyun":
		return &AliyunSender{
			AccessKeyId:     settings.AccessKeyId,
			AccessKeySecret: settings.AccessKeySecret,
			SignName:        settings.SignName,
			TemplateCode:    settings.TemplateCode,
		}, nil
	case "aliyun_pnvs":
		return &AliyunPnvsSender{
			AccessKeyId:     settings.AccessKeyId,
			AccessKeySecret: settings.AccessKeySecret,
			SignName:        settings.SignName,
			TemplateCode:    settings.TemplateCode,
			SchemeCode:      settings.SchemeCode,
		}, nil
	case "tencent":
		return &TencentSender{
			SecretId:     settings.AccessKeyId,
			SecretKey:    settings.AccessKeySecret,
			AppId:        settings.AppId,
			SignName:     settings.SignName,
			TemplateCode: settings.TemplateCode,
		}, nil
	default:
		return nil, fmt.Errorf("unsupported SMS provider: %s", settings.Provider)
	}
}
