package service

import (
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	openapi "github.com/alibabacloud-go/darabonba-openapi/v2/client"
	dysmsapi20170525 "github.com/alibabacloud-go/dysmsapi-20170525/v5/client"
	util "github.com/alibabacloud-go/tea-utils/v2/service"
	"github.com/alibabacloud-go/tea/tea"
)

const (
	smsSendCooldown       = time.Minute
	smsDailyMaxPerPhone   = 10
	smsDailyWindow        = 24 * time.Hour
	defaultAliyunEndpoint = "dysmsapi.aliyuncs.com"
)

type smsSendState struct {
	lastSentAt time.Time
	windowFrom time.Time
	count      int
}

var (
	smsSendMutex sync.Mutex
	smsSendMap   = make(map[string]smsSendState)
)

func SendSmsLoginCode(phone string, code string) error {
	if !common.SmsLoginEnabled {
		return errors.New("SMS login is not enabled")
	}
	if err := checkSmsSendLimit(phone); err != nil {
		return err
	}

	templateParamBytes, err := common.Marshal(map[string]string{"code": code})
	if err != nil {
		return err
	}
	err = sendAliyunSms(common.MainlandPhoneForSms(phone), string(templateParamBytes))
	if err != nil {
		rollbackSmsSendLimit(phone)
		return err
	}
	return nil
}

func checkSmsSendLimit(phone string) error {
	smsSendMutex.Lock()
	defer smsSendMutex.Unlock()

	now := time.Now()
	state := smsSendMap[phone]
	if !state.lastSentAt.IsZero() && now.Sub(state.lastSentAt) < smsSendCooldown {
		return fmt.Errorf("SMS verification code was sent recently, please try again later")
	}
	if state.windowFrom.IsZero() || now.Sub(state.windowFrom) >= smsDailyWindow {
		state.windowFrom = now
		state.count = 0
	}
	if state.count >= smsDailyMaxPerPhone {
		return fmt.Errorf("SMS verification code daily limit reached")
	}
	state.lastSentAt = now
	state.count++
	smsSendMap[phone] = state
	return nil
}

func rollbackSmsSendLimit(phone string) {
	smsSendMutex.Lock()
	defer smsSendMutex.Unlock()

	state, ok := smsSendMap[phone]
	if !ok {
		return
	}
	if state.count > 0 {
		state.count--
	}
	state.lastSentAt = time.Time{}
	smsSendMap[phone] = state
}

func sendAliyunSms(phoneNumbers string, templateParam string) error {
	accessKeyId := strings.TrimSpace(common.AliyunSmsAccessKeyId)
	accessKeySecret := strings.TrimSpace(common.AliyunSmsAccessKeySecret)
	signName := strings.TrimSpace(common.AliyunSmsSignName)
	templateCode := strings.TrimSpace(common.AliyunSmsTemplateCode)
	endpoint := strings.TrimSpace(common.AliyunSmsEndpoint)
	if endpoint == "" {
		endpoint = defaultAliyunEndpoint
	}

	if accessKeyId == "" || accessKeySecret == "" || signName == "" || templateCode == "" {
		return errors.New("Aliyun SMS is not configured")
	}

	config := &openapi.Config{
		AccessKeyId:     tea.String(accessKeyId),
		AccessKeySecret: tea.String(accessKeySecret),
		Endpoint:        tea.String(endpoint),
	}
	client, err := dysmsapi20170525.NewClient(config)
	if err != nil {
		return err
	}

	request := &dysmsapi20170525.SendSmsRequest{
		PhoneNumbers:  tea.String(phoneNumbers),
		SignName:      tea.String(signName),
		TemplateCode:  tea.String(templateCode),
		TemplateParam: tea.String(templateParam),
	}
	response, err := client.SendSmsWithOptions(request, &util.RuntimeOptions{})
	if err != nil {
		return err
	}
	if response == nil || response.Body == nil || response.Body.Code == nil {
		return errors.New("Aliyun SMS returned empty response")
	}
	if *response.Body.Code != "OK" {
		message := ""
		if response.Body.Message != nil {
			message = *response.Body.Message
		}
		return fmt.Errorf("Aliyun SMS failed: %s %s", *response.Body.Code, message)
	}
	return nil
}
