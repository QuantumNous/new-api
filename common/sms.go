package common

import (
	"errors"
	"fmt"
	"os"

	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi "github.com/alibabacloud-go/dysmsapi-20170525/v3/client"
	"github.com/alibabacloud-go/tea/tea"
)

// ErrSmsNotConfigured is returned when the Aliyun SMS credentials or template
// have not been configured yet.
var ErrSmsNotConfigured = errors.New("阿里云短信服务未配置")

// SendSmsCode sends a verification code to the given phone number via the
// Aliyun SMS platform. The code is inserted into the configured SMS template's
// ${code} variable.
//
// SMS_PROVIDER environment variable controls the provider:
//   - "" / "aliyun": send via Aliyun SMS (default)
//   - "mock": development mode — print the code to the console and succeed
//     without actually sending (useful for local testing without real SMS)
//   - "tencent": not supported yet
func SendSmsCode(phone string, code string) error {
	switch os.Getenv("SMS_PROVIDER") {
	case "mock":
		SysLog(fmt.Sprintf("[MOCK SMS] to=%s code=%s (开发模式，未实际发送)", phone, code))
		return nil
	case "tencent":
		return errors.New("腾讯云短信暂未支持，请使用 SMS_PROVIDER=aliyun")
	}
	if AliyunSMSAccessKeyId == "" || AliyunSMSAccessKeySecret == "" ||
		AliyunSMSSignName == "" || AliyunSMSTemplateCode == "" {
		return ErrSmsNotConfigured
	}
	client, err := dysmsapi.NewClient(&openapi.Config{
		AccessKeyId:     tea.String(AliyunSMSAccessKeyId),
		AccessKeySecret: tea.String(AliyunSMSAccessKeySecret),
		RegionId:        tea.String(AliyunSMSRegionId),
		Endpoint:        tea.String("dysmsapi.aliyuncs.com"),
	})
	if err != nil {
		return err
	}
	response, err := client.SendSms(&dysmsapi.SendSmsRequest{
		PhoneNumbers:  tea.String(phone),
		SignName:      tea.String(AliyunSMSSignName),
		TemplateCode:  tea.String(AliyunSMSTemplateCode),
		TemplateParam: tea.String(fmt.Sprintf(`{"code":"%s"}`, code)),
	})
	if err != nil {
		return err
	}
	if response.Body == nil || tea.StringValue(response.Body.Code) != "OK" {
		message := ""
		if response.Body != nil {
			message = tea.StringValue(response.Body.Message)
		}
		SysError(fmt.Sprintf("failed to send sms code to %s: %s", phone, message))
		return errors.New("短信发送失败: " + message)
	}
	return nil
}
