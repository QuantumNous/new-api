package controller

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/model"
)

type AliQueryAccountBalanceResponse struct {
	RequestId string `json:"RequestId"`
	Success   bool   `json:"Success"`
	Code      string `json:"Code"`
	Message   string `json:"Message"`
	Data      struct {
		AvailableAmount string `json:"AvailableAmount"`
		Currency        string `json:"Currency"`
	} `json:"Data"`
}

func buildAliQueryAccountBalanceURL(accessKeyId, accessKeySecret, regionId string) (string, error) {
	params := url.Values{
		"AccessKeyId":      []string{accessKeyId},
		"Action":           []string{"QueryAccountBalance"},
		"Format":           []string{"JSON"},
		"SignatureMethod":  []string{"HMAC-SHA1"},
		"SignatureVersion": []string{"1.0"},
		"SignatureNonce":   []string{fmt.Sprintf("%d", time.Now().UnixNano())},
		"Timestamp":        []string{time.Now().UTC().Format("2006-01-02T15:04:05Z")},
		"Version":          []string{"2017-12-14"},
	}
	if regionId != "" {
		params.Set("RegionId", regionId)
	}

	canonicalQuery := params.Encode()
	stringToSign := "GET&" + url.QueryEscape("/") + "&" + url.QueryEscape(canonicalQuery)

	mac := hmac.New(sha1.New, []byte(accessKeySecret+"&"))
	_, err := mac.Write([]byte(stringToSign))
	if err != nil {
		return "", err
	}
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	params.Set("Signature", signature)
	finalQuery := params.Encode()

	return "https://business.aliyuncs.com/?" + finalQuery, nil
}

func splitAliKey(key string) (apiKey, accessKeyId, accessKeySecret, region string, err error) {
	parts := strings.Split(key, "|")
	if len(parts) < 3 {
		err = errors.New("阿里渠道密钥格式应为 apiKey|AccessKeyId|AccessKeySecret")
		return
	}
	apiKey = strings.TrimSpace(parts[0])
	accessKeyId = strings.TrimSpace(parts[1])
	accessKeySecret = strings.TrimSpace(parts[2])
	region = "cn-hangzhou"
	return
}

func updateChannelAliBalance(channel *model.Channel) (float64, error) {
	_, accessKeyId, accessKeySecret, region, err := splitAliKey(channel.Key)
	if err != nil {
		return 0, err
	}

	signedURL, err := buildAliQueryAccountBalanceURL(accessKeyId, accessKeySecret, region)
	if err != nil {
		return 0, err
	}

	body, err := GetResponseBody("GET", signedURL, channel, http.Header{})
	if err != nil {
		return 0, err
	}

	var resp AliQueryAccountBalanceResponse
	if err = json.Unmarshal(body, &resp); err != nil {
		return 0, err
	}
	if !resp.Success {
		return 0, fmt.Errorf("ali balance query failed: %s %s", resp.Code, resp.Message)
	}
	if resp.Data.AvailableAmount == "" {
		return 0, errors.New("ali balance empty response")
	}

	balance, err := strconv.ParseFloat(resp.Data.AvailableAmount, 64)
	if err != nil {
		return 0, err
	}
	channel.UpdateBalance(balance)
	return balance, nil
}
