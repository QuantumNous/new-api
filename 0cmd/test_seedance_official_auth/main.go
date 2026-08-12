// 本地直连测试 BytePlus/火山官方素材 CreateAssetGroup 鉴权。
//
// 用法（PowerShell）:
//   $env:SEEDANCE_AK="你的AccessKeyID"
//   $env:SEEDANCE_SK="你的SecretAccessKey"
//   $env:SEEDANCE_PLATFORM="overseas"   # 或 cn
//   $env:SEEDANCE_PROXY="http://user:pass@host:port"  # 可选
//   go run ./cmd/test_seedance_official_auth
//
// 请勿把 AK/SK 写进代码或发到聊天里。
package main

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/volc/sign"
	"golang.org/x/net/proxy"
)

func main() {
	ak := strings.TrimSpace(os.Getenv("SEEDANCE_AK"))
	sk := strings.TrimSpace(os.Getenv("SEEDANCE_SK"))
	platform := strings.ToLower(strings.TrimSpace(os.Getenv("SEEDANCE_PLATFORM")))
	proxyURL := strings.TrimSpace(os.Getenv("SEEDANCE_PROXY"))
	if ak == "" || sk == "" {
		fmt.Println("请设置环境变量 SEEDANCE_AK / SEEDANCE_SK 后重试（不要把密钥写进代码）")
		os.Exit(2)
	}

	host := "ark.cn-beijing.volcengineapi.com"
	region := "cn-beijing"
	if platform == "overseas" || platform == "byteplus" {
		host = "ark.ap-southeast-1.byteplusapi.com"
		region = "ap-southeast-1"
	}
	if r := strings.TrimSpace(os.Getenv("SEEDANCE_REGION")); r != "" {
		region = r
	}

	project := strings.TrimSpace(os.Getenv("SEEDANCE_PROJECT"))
	if project == "" {
		project = "default"
	}
	action := strings.TrimSpace(os.Getenv("SEEDANCE_ACTION"))
	if action == "" {
		action = "CreateAssetGroup"
	}
	var bodyObj map[string]any
	switch action {
	case "GetAsset":
		assetID := strings.TrimSpace(os.Getenv("SEEDANCE_ASSET_ID"))
		if assetID == "" {
			fmt.Println("GetAsset 需要环境变量 SEEDANCE_ASSET_ID")
			os.Exit(2)
		}
		bodyObj = map[string]any{
			"Id":          assetID,
			"ProjectName": project,
		}
	default:
		bodyObj = map[string]any{
			"Name":        "debug-aigc",
			"GroupType":   "AIGC",
			"ProjectName": project,
		}
		action = "CreateAssetGroup"
	}
	body, err := common.Marshal(bodyObj)
	if err != nil {
		fatal(err)
	}
	q := url.Values{}
	q.Set("Action", action)
	q.Set("Version", "2024-01-01")
	fullURL := fmt.Sprintf("https://%s/?%s", host, q.Encode())

	req, err := http.NewRequest(http.MethodPost, fullURL, bytes.NewReader(body))
	if err != nil {
		fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Host = host

	if err = sign.SignRequest(req, sign.Credentials{
		AccessKeyID:     ak,
		SecretAccessKey: sk,
		Region:          region,
		Service:         "ark",
	}, body, time.Now().UTC()); err != nil {
		fatal(err)
	}

	client, err := buildClient(proxyURL)
	if err != nil {
		fatal(err)
	}

	fmt.Printf("POST %s\n", fullURL)
	fmt.Printf("platform=%s region=%s host=%s proxy=%v ak_prefix=%s...\n",
		platform, region, host, proxyURL != "", trimPrefix(ak, 8))

	resp, err := client.Do(req)
	if err != nil {
		fatal(err)
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(resp.Body)
	fmt.Printf("HTTP %d\n%s\n", resp.StatusCode, string(raw))

	var parsed map[string]any
	_ = common.Unmarshal(raw, &parsed)
	if meta, ok := parsed["ResponseMetadata"].(map[string]any); ok {
		if errObj, ok := meta["Error"].(map[string]any); ok {
			fmt.Printf("\n解析错误: Code=%v Message=%v\n", errObj["Code"], errObj["Message"])
			os.Exit(1)
		}
	}
	if resp.StatusCode >= 400 {
		os.Exit(1)
	}
	fmt.Println("\n鉴权看起来通过了（未返回 Error）")
}

func buildClient(proxyURL string) (*http.Client, error) {
	if proxyURL == "" {
		return &http.Client{Timeout: 30 * time.Second}, nil
	}
	u, err := url.Parse(proxyURL)
	if err != nil {
		return nil, err
	}
	switch strings.ToLower(u.Scheme) {
	case "http", "https":
		return &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				Proxy: http.ProxyURL(u),
			},
		}, nil
	case "socks5", "socks5h":
		var auth *proxy.Auth
		if u.User != nil {
			pass, _ := u.User.Password()
			auth = &proxy.Auth{User: u.User.Username(), Password: pass}
		}
		dialer, err := proxy.SOCKS5("tcp", u.Host, auth, proxy.Direct)
		if err != nil {
			return nil, err
		}
		return &http.Client{
			Timeout: 30 * time.Second,
			Transport: &http.Transport{
				Dial: dialer.Dial,
			},
		}, nil
	default:
		return nil, fmt.Errorf("unsupported proxy scheme: %s", u.Scheme)
	}
}

func trimPrefix(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n]
}

func fatal(err error) {
	fmt.Println("ERROR:", err)
	os.Exit(1)
}
