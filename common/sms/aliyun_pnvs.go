package sms

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
	"strings"
	"time"

	"github.com/google/uuid"
)

// AliyunPnvsSender implements SmsSender using Alibaba Cloud PNVS (号码认证服务) SMS Auth API.
// This is designed for individual developers — no enterprise qualification, signature or template approval needed.
// Uses the system-provided (赠送) signatures and templates from the PNVS console.
type AliyunPnvsSender struct {
	AccessKeyId     string
	AccessKeySecret string
	SignName        string // 系统赠送签名，从 PNVS 控制台获取
	TemplateCode    string // 系统赠送模板，从 PNVS 控制台获取
	SchemeCode      string // 方案Code（可选，融合认证方式不需要）
}

func (s *AliyunPnvsSender) SendCode(phone string, code string) error {
	// TemplateParam: 模板变量，赠送模板通常包含 code 和 min(有效期) 两个变量
	templateParam := fmt.Sprintf(`{"code":"%s","min":"10"}`, code)

	params := map[string]string{
		"AccessKeyId":      s.AccessKeyId,
		"Action":           "SendSmsVerifyCode",
		"Format":           "JSON",
		"PhoneNumber":      phone,
		"RegionId":         "cn-hangzhou",
		"SignName":         s.SignName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   uuid.New().String(),
		"SignatureVersion": "1.0",
		"TemplateCode":     s.TemplateCode,
		"TemplateParam":    templateParam,
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
		"CodeLength":       fmt.Sprintf("%d", len(code)),
		"CodeType":         "1", // 1=纯数字
		"Code":             code,
	}

	if s.SchemeCode != "" {
		params["SchemeCode"] = s.SchemeCode
	}

	// Sort keys
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Build canonical query string
	var queryParts []string
	for _, k := range keys {
		queryParts = append(queryParts, pnvsSpecialURLEncode(k)+"="+pnvsSpecialURLEncode(params[k]))
	}
	canonicalQueryString := strings.Join(queryParts, "&")

	// Build string to sign
	stringToSign := "GET&" + pnvsSpecialURLEncode("/") + "&" + pnvsSpecialURLEncode(canonicalQueryString)

	// Calculate signature
	mac := hmac.New(sha1.New, []byte(s.AccessKeySecret+"&"))
	mac.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// Build request URL — note: PNVS uses dypnsapi.aliyuncs.com, NOT dysmsapi.aliyuncs.com
	reqURL := "https://dypnsapi.aliyuncs.com/?" + canonicalQueryString + "&Signature=" + url.QueryEscape(signature)

	resp, err := http.Get(reqURL)
	if err != nil {
		return fmt.Errorf("aliyun PNVS SMS request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("aliyun PNVS SMS read response failed: %w", err)
	}

	var result struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
		Model   *struct {
			BizId    string `json:"BizId"`
			VerifyCode string `json:"VerifyCode"`
		} `json:"Model"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("aliyun PNVS SMS parse response failed: %w", err)
	}

	if result.Code != "OK" {
		return fmt.Errorf("aliyun PNVS SMS error: %s - %s", result.Code, result.Message)
	}

	return nil
}

func pnvsSpecialURLEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}
