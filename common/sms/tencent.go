package sms

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// TencentSender implements SmsSender using Tencent Cloud SMS API.
type TencentSender struct {
	SecretId     string
	SecretKey    string
	AppId        string
	SignName     string
	TemplateCode string
}

func (s *TencentSender) SendCode(phone string, code string) error {
	host := "sms.tencentcloudapi.com"
	service := "sms"
	action := "SendSms"
	version := "2021-01-11"
	timestamp := time.Now().Unix()
	dateStr := time.Unix(timestamp, 0).UTC().Format("2006-01-02")

	// Build request payload
	payload := map[string]interface{}{
		"SmsSdkAppId": s.AppId,
		"SignName":    s.SignName,
		"TemplateId":  s.TemplateCode,
		"PhoneNumberSet": []string{
			phone,
		},
		"TemplateParamSet": []string{
			code,
		},
	}

	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return fmt.Errorf("tencent SMS marshal payload failed: %w", err)
	}
	payloadStr := string(payloadBytes)

	// Step 1: Build canonical request
	httpRequestMethod := "POST"
	canonicalURI := "/"
	canonicalQueryString := ""
	canonicalHeaders := "content-type:application/json; charset=utf-8\nhost:" + host + "\nx-tc-action:" + strings.ToLower(action) + "\n"
	signedHeaders := "content-type;host;x-tc-action"
	hashedPayload := sha256hex(payloadStr)
	canonicalRequest := httpRequestMethod + "\n" + canonicalURI + "\n" + canonicalQueryString + "\n" + canonicalHeaders + "\n" + signedHeaders + "\n" + hashedPayload

	// Step 2: Build string to sign
	algorithm := "TC3-HMAC-SHA256"
	credentialScope := dateStr + "/" + service + "/tc3_request"
	stringToSign := algorithm + "\n" + fmt.Sprintf("%d", timestamp) + "\n" + credentialScope + "\n" + sha256hex(canonicalRequest)

	// Step 3: Calculate signature
	secretDate := hmacSha256([]byte("TC3"+s.SecretKey), dateStr)
	secretService := hmacSha256(secretDate, service)
	secretSigning := hmacSha256(secretService, "tc3_request")
	signature := hex.EncodeToString(hmacSha256(secretSigning, stringToSign))

	// Step 4: Build authorization header
	authorization := algorithm + " " +
		"Credential=" + s.SecretId + "/" + credentialScope + ", " +
		"SignedHeaders=" + signedHeaders + ", " +
		"Signature=" + signature

	// Send request
	req, err := http.NewRequest("POST", "https://"+host, strings.NewReader(payloadStr))
	if err != nil {
		return fmt.Errorf("tencent SMS create request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	req.Header.Set("Authorization", authorization)
	req.Header.Set("Host", host)
	req.Header.Set("X-TC-Action", action)
	req.Header.Set("X-TC-Version", version)
	req.Header.Set("X-TC-Timestamp", fmt.Sprintf("%d", timestamp))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("tencent SMS request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("tencent SMS read response failed: %w", err)
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
		return fmt.Errorf("tencent SMS parse response failed: %w", err)
	}

	if result.Response.Error != nil {
		return fmt.Errorf("tencent SMS error: %s - %s", result.Response.Error.Code, result.Response.Error.Message)
	}

	if len(result.Response.SendStatusSet) > 0 && result.Response.SendStatusSet[0].Code != "Ok" {
		return fmt.Errorf("tencent SMS send error: %s - %s", result.Response.SendStatusSet[0].Code, result.Response.SendStatusSet[0].Message)
	}

	return nil
}

func sha256hex(s string) string {
	h := sha256.New()
	h.Write([]byte(s))
	return hex.EncodeToString(h.Sum(nil))
}

func hmacSha256(key []byte, data string) []byte {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return mac.Sum(nil)
}
