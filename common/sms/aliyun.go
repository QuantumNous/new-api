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

// AliyunSender implements SmsSender using Alibaba Cloud SMS API.
type AliyunSender struct {
	AccessKeyId     string
	AccessKeySecret string
	SignName        string
	TemplateCode    string
}

func (s *AliyunSender) SendCode(phone string, code string) error {
	params := map[string]string{
		"AccessKeyId":      s.AccessKeyId,
		"Action":           "SendSms",
		"Format":           "JSON",
		"PhoneNumbers":     phone,
		"RegionId":         "cn-hangzhou",
		"SignName":         s.SignName,
		"SignatureMethod":  "HMAC-SHA1",
		"SignatureNonce":   uuid.New().String(),
		"SignatureVersion": "1.0",
		"TemplateCode":     s.TemplateCode,
		"TemplateParam":    fmt.Sprintf(`{"code":"%s"}`, code),
		"Timestamp":        time.Now().UTC().Format("2006-01-02T15:04:05Z"),
		"Version":          "2017-05-25",
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
		queryParts = append(queryParts, specialURLEncode(k)+"="+specialURLEncode(params[k]))
	}
	canonicalQueryString := strings.Join(queryParts, "&")

	// Build string to sign
	stringToSign := "GET&" + specialURLEncode("/") + "&" + specialURLEncode(canonicalQueryString)

	// Calculate signature
	mac := hmac.New(sha1.New, []byte(s.AccessKeySecret+"&"))
	mac.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// Build request URL
	reqURL := "https://dysmsapi.aliyuncs.com/?" + canonicalQueryString + "&Signature=" + url.QueryEscape(signature)

	resp, err := http.Get(reqURL)
	if err != nil {
		return fmt.Errorf("aliyun SMS request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("aliyun SMS read response failed: %w", err)
	}

	var result struct {
		Code    string `json:"Code"`
		Message string `json:"Message"`
	}
	if err := json.Unmarshal(body, &result); err != nil {
		return fmt.Errorf("aliyun SMS parse response failed: %w", err)
	}

	if result.Code != "OK" {
		return fmt.Errorf("aliyun SMS error: %s - %s", result.Code, result.Message)
	}

	return nil
}

func specialURLEncode(s string) string {
	encoded := url.QueryEscape(s)
	encoded = strings.ReplaceAll(encoded, "+", "%20")
	encoded = strings.ReplaceAll(encoded, "*", "%2A")
	encoded = strings.ReplaceAll(encoded, "%7E", "~")
	return encoded
}
