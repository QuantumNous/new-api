package service

import (
	"bytes"
	"crypto/hmac"
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

func sendSmsNotify(phoneNumber string, data dto.Notify) error {
	if phoneNumber == "" {
		return fmt.Errorf("sms phone number is empty")
	}

	provider := common.SMSProvider
	if provider == "" {
		return fmt.Errorf("SMS provider is not configured, please contact the administrator")
	}

	// 提取模板变量值列表（用于模板类短信服务商）
	var templateValues []string
	for _, v := range data.Values {
		templateValues = append(templateValues, fmt.Sprintf("%v", v))
	}

	// 生成纯文本 content（用于自定义HTTP接口）
	content := data.Content
	for _, value := range data.Values {
		content = strings.Replace(content, dto.ContentValueParam, fmt.Sprintf("%v", value), 1)
	}

	switch provider {
	case "aliyun":
		return sendAliyunSms(
			common.SMSAliyunAccessKeyId,
			common.SMSAliyunAccessKeySecret,
			common.SMSAliyunSignName,
			common.SMSAliyunTemplateCode,
			phoneNumber,
			templateValues,
		)
	case "sendcloud":
		return sendSendCloudSms(
			common.SMSSendCloudSmsUser,
			common.SMSSendCloudSmsKey,
			common.SMSSendCloudTemplateId,
			phoneNumber,
			templateValues,
		)
	case "tencent":
		return sendTencentSms(
			common.SMSTencentSecretId,
			common.SMSTencentSecretKey,
			common.SMSTencentSmsSdkAppId,
			common.SMSTencentSignName,
			common.SMSTencentTemplateId,
			phoneNumber,
			templateValues,
		)
	case "custom":
		return sendCustomSms(
			common.SMSCustomUrl,
			common.SMSCustomMethod,
			common.SMSCustomTemplate,
			phoneNumber,
			data.Title,
			content,
		)
	default:
		return fmt.Errorf("unsupported sms provider: %s", provider)
	}
}

// aliyunPercentEncode 阿里云专用的百分号编码
func aliyunPercentEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}

// sendAliyunSms 通过阿里云短信服务发送短信 (POP v1 签名, HMAC-SHA1)
// templateValues: 模板变量值列表，按顺序映射为 user_money, balance_warn
func sendAliyunSms(accessKeyId, accessKeySecret, signName, templateCode, phoneNumber string, templateValues []string) error {
	// 构建模板参数 JSON
	templateParamMap := map[string]string{}
	paramNames := []string{"user_money", "balance_warn"}
	for i, name := range paramNames {
		if i < len(templateValues) {
			templateParamMap[name] = templateValues[i]
		}
	}
	templateParam, _ := json.Marshal(templateParamMap)

	params := map[string]string{
		"AccessKeyId":      accessKeyId,
		"Action":           "SendSms",
		"Format":           "JSON",
		"PhoneNumbers":     phoneNumber,
		"SignName":         signName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   common.GetUUID(),
		"SignatureVersion": "1.0",
		"TemplateCode":     templateCode,
		"TemplateParam":    string(templateParam),
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
	}

	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var queryParts []string
	for _, k := range keys {
		queryParts = append(queryParts, aliyunPercentEncode(k)+"="+aliyunPercentEncode(params[k]))
	}
	canonicalizedQueryString := strings.Join(queryParts, "&")

	stringToSign := "GET&" + aliyunPercentEncode("/") + "&" + aliyunPercentEncode(canonicalizedQueryString)

	mac := hmac.New(sha1.New, []byte(accessKeySecret+"&"))
	mac.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	finalURL := "https://dysmsapi.aliyuncs.com/?Signature=" + url.QueryEscape(signature) + "&" + canonicalizedQueryString

	resp, err := GetHttpClient().Get(finalURL)
	if err != nil {
		return fmt.Errorf("failed to send aliyun sms: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read aliyun sms response: %v", err)
	}

	var result struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse aliyun sms response: %v", err)
	}

	if result.Code != "OK" {
		return fmt.Errorf("aliyun sms failed: %s - %s", result.Code, result.Message)
	}

	return nil
}

// sendSendCloudSms 通过 SendCloud 短信服务发送短信
// 使用 MD5 签名: signature = MD5(smsKey + "&" + 排序参数串 + "&" + smsKey)
func sendSendCloudSms(smsUser, smsKey, templateId, phoneNumber string, templateValues []string) error {
	params := map[string]string{
		"smsUser":    smsUser,
		"templateId": templateId,
		"phone":      phoneNumber,
		"msgType":    "0",
	}

	// vars 传递模板变量
	varsMap := map[string]string{}
	paramNames := []string{"user_money", "balance_warn"}
	for i, name := range paramNames {
		if i < len(templateValues) {
			varsMap[name] = templateValues[i]
		}
	}
	varsJSON, _ := json.Marshal(varsMap)
	params["vars"] = string(varsJSON)

	// 按 key 排序生成签名字符串
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var paramParts []string
	for _, k := range keys {
		paramParts = append(paramParts, k+"="+params[k])
	}
	paramStr := strings.Join(paramParts, "&")

	// MD5 签名
	signStr := smsKey + "&" + paramStr + "&" + smsKey
	h := md5.New()
	h.Write([]byte(signStr))
	signature := hex.EncodeToString(h.Sum(nil))
	params["signature"] = signature

	// 构建 form data
	formValues := url.Values{}
	for k, v := range params {
		formValues.Set(k, v)
	}

	resp, err := GetHttpClient().PostForm("https://www.sendcloud.net/smsapi/send", formValues)
	if err != nil {
		return fmt.Errorf("failed to send sendcloud sms: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read sendcloud sms response: %v", err)
	}

	var result struct {
		Result     bool   `json:"result"`
		StatusCode int    `json:"statusCode"`
		Message    string `json:"message"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse sendcloud sms response: %v", err)
	}

	if !result.Result || result.StatusCode != 200 {
		return fmt.Errorf("sendcloud sms failed: %d - %s", result.StatusCode, result.Message)
	}

	return nil
}

func hmacSHA256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}

func sha256Hex(data string) string {
	h := sha256.New()
	h.Write([]byte(data))
	return hex.EncodeToString(h.Sum(nil))
}

// sendTencentSms 通过腾讯云短信服务发送短信 (TC3-HMAC-SHA256 签名)
// templateValues: 模板变量值列表，按顺序对应模板中的 {1}, {2}, ...
func sendTencentSms(secretId, secretKey, smsSdkAppId, signName, templateId, phoneNumber string, templateValues []string) error {
	host := "sms.tencentcloudapi.com"
	service := "sms"
	action := "SendSms"
	version := "2021-01-11"
	region := "ap-guangzhou"

	timestamp := time.Now().Unix()
	timestampStr := fmt.Sprintf("%d", timestamp)
	date := time.Unix(timestamp, 0).UTC().Format("2006-01-02")

	type SendSmsRequest struct {
		SmsSdkAppId      string   `json:"SmsSdkAppId"`
		SignName         string   `json:"SignName"`
		TemplateId       string   `json:"TemplateId"`
		PhoneNumberSet   []string `json:"PhoneNumberSet"`
		TemplateParamSet []string `json:"TemplateParamSet"`
	}

	payload := SendSmsRequest{
		SmsSdkAppId:      smsSdkAppId,
		SignName:         signName,
		TemplateId:       templateId,
		PhoneNumberSet:   []string{phoneNumber},
		TemplateParamSet: templateValues,
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("failed to marshal tencent sms payload: %v", err)
	}
	payloadStr := string(payloadBytes)

	contentType := "application/json; charset=utf-8"
	canonicalHeaders := "content-type:" + contentType + "\n" + "host:" + host + "\n"
	signedHeaders := "content-type;host"
	hashedPayload := sha256Hex(payloadStr)

	canonicalRequest := "POST\n/\n\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + hashedPayload

	credentialScope := date + "/" + service + "/tc3_request"
	stringToSign := "TC3-HMAC-SHA256\n" + timestampStr + "\n" + credentialScope + "\n" + sha256Hex(canonicalRequest)

	secretDate := hmacSHA256([]byte("TC3"+secretKey), date)
	secretService := hmacSHA256(secretDate, service)
	secretSigning := hmacSHA256(secretService, "tc3_request")
	signature := hex.EncodeToString(hmacSHA256(secretSigning, stringToSign))

	authorization := "TC3-HMAC-SHA256 " +
		"Credential=" + secretId + "/" + credentialScope + ", " +
		"SignedHeaders=" + signedHeaders + ", " +
		"Signature=" + signature

	req, err := http.NewRequest(http.MethodPost, "https://"+host, bytes.NewBufferString(payloadStr))
	if err != nil {
		return fmt.Errorf("failed to create tencent sms request: %v", err)
	}

	req.Header.Set("Content-Type", contentType)
	req.Header.Set("Host", host)
	req.Header.Set("Authorization", authorization)
	req.Header.Set("X-TC-Action", action)
	req.Header.Set("X-TC-Timestamp", timestampStr)
	req.Header.Set("X-TC-Version", version)
	req.Header.Set("X-TC-Region", region)

	resp, err := GetHttpClient().Do(req)
	if err != nil {
		return fmt.Errorf("failed to send tencent sms: %v", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read tencent sms response: %v", err)
	}

	var result struct {
		Response struct {
			SendStatusSet []struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"SendStatusSet"`
			Error *struct {
				Code    string `json:"Code"`
				Message string `json:"Message"`
			} `json:"Error"`
		} `json:"Response"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("failed to parse tencent sms response: %v", err)
	}

	if result.Response.Error != nil {
		return fmt.Errorf("tencent sms failed: %s - %s", result.Response.Error.Code, result.Response.Error.Message)
	}

	if len(result.Response.SendStatusSet) > 0 && result.Response.SendStatusSet[0].Code != "Ok" {
		return fmt.Errorf("tencent sms failed: %s - %s", result.Response.SendStatusSet[0].Code, result.Response.SendStatusSet[0].Message)
	}

	return nil
}

// jsonEscapeString 对字符串进行 JSON 转义，防止模板注入
func jsonEscapeString(s string) string {
	b, _ := json.Marshal(s)
	// json.Marshal 返回带引号的字符串，去掉首尾引号
	return string(b[1 : len(b)-1])
}

// sendCustomSms 通过通用HTTP接口发送短信
func sendCustomSms(smsUrl, method, template, phoneNumber, title, content string) error {
	if smsUrl == "" {
		return fmt.Errorf("custom sms url is empty")
	}
	if method == "" {
		method = "POST"
	}

	finalURL := strings.ReplaceAll(smsUrl, "{{phone}}", url.QueryEscape(phoneNumber))
	finalURL = strings.ReplaceAll(finalURL, "{{title}}", url.QueryEscape(title))
	finalURL = strings.ReplaceAll(finalURL, "{{content}}", url.QueryEscape(content))

	// body 模板中使用 JSON 转义，防止 JSON 注入
	finalBody := strings.ReplaceAll(template, "{{phone}}", jsonEscapeString(phoneNumber))
	finalBody = strings.ReplaceAll(finalBody, "{{title}}", jsonEscapeString(title))
	finalBody = strings.ReplaceAll(finalBody, "{{content}}", jsonEscapeString(content))

	var req *http.Request
	var resp *http.Response
	var err error

	if system_setting.EnableWorker() {
		workerReq := &WorkerRequest{
			URL:    finalURL,
			Key:    system_setting.WorkerValidKey,
			Method: method,
			Headers: map[string]string{
				"Content-Type": "application/json; charset=utf-8",
				"User-Agent":   "OneAPI-SMS-Notify/1.0",
			},
		}
		if method == "POST" {
			workerReq.Body = []byte(finalBody)
		}

		resp, err = DoWorkerRequest(workerReq)
		if err != nil {
			return fmt.Errorf("failed to send custom sms through worker: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("custom sms request failed with status code: %d", resp.StatusCode)
		}
	} else {
		fetchSetting := system_setting.GetFetchSetting()
		if err := common.ValidateURLWithFetchSetting(finalURL, fetchSetting.EnableSSRFProtection, fetchSetting.AllowPrivateIp, fetchSetting.DomainFilterMode, fetchSetting.IpFilterMode, fetchSetting.DomainList, fetchSetting.IpList, fetchSetting.AllowedPorts, fetchSetting.ApplyIPFilterForDomain); err != nil {
			return fmt.Errorf("request reject: %v", err)
		}

		if method == "POST" {
			req, err = http.NewRequest(http.MethodPost, finalURL, bytes.NewBufferString(finalBody))
		} else {
			req, err = http.NewRequest(http.MethodGet, finalURL, nil)
		}
		if err != nil {
			return fmt.Errorf("failed to create custom sms request: %v", err)
		}

		req.Header.Set("Content-Type", "application/json; charset=utf-8")
		req.Header.Set("User-Agent", "OneAPI-SMS-Notify/1.0")

		client := GetHttpClient()
		resp, err = client.Do(req)
		if err != nil {
			return fmt.Errorf("failed to send custom sms request: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return fmt.Errorf("custom sms request failed with status code: %d", resp.StatusCode)
		}
	}

	return nil
}
