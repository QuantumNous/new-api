package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

func main() {
	// 测试 Client Credentials 流程
	testClientCredentials()

	// 测试 Authorization Code + PKCE 流程（需要浏览器交互）
	// testAuthorizationCode()
}

// testClientCredentials 测试服务对服务认证
func testClientCredentials() {
	fmt.Println("=== Testing Client Credentials Flow ===")

	cfg := clientcredentials.Config{
		ClientID:     "client_demo123456789", // 需要先创建客户端
		ClientSecret: "demo_secret_32_chars_long_123456",
		TokenURL:     "http://127.0.0.1:8080/api/oauth/token",
		Scopes:       []string{"api:read", "api:write"},
		EndpointParams: map[string][]string{
			"audience": {"api://new-api"},
		},
	}

	// 创建HTTP客户端
	httpClient := cfg.Client(context.Background())

	// 调用受保护的API
	resp, err := httpClient.Get("http://127.0.0.1:8080/api/status")
	if err != nil {
		log.Printf("Request failed: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read response: %v", err)
		return
	}

	fmt.Printf("Status: %s\n", resp.Status)
	fmt.Printf("Response: %s\n", string(body))
}

// testAuthorizationCode 测试授权码流程
func testAuthorizationCode() {
	fmt.Println("=== Testing Authorization Code + PKCE Flow ===")

	conf := oauth2.Config{
		ClientID:     "client_web123456789", // Web客户端
		ClientSecret: "web_secret_32_chars_long_123456",
		RedirectURL:  "http://localhost:9999/callback",
		Scopes:       []string{"api:read", "api:write"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "http://127.0.0.1:8080/api/oauth/authorize",
			TokenURL: "http://127.0.0.1:8080/api/oauth/token",
		},
	}

	// 生成PKCE参数
	codeVerifier := oauth2.GenerateVerifier()

	// 构建授权URL
	url := conf.AuthCodeURL(
		"random-state-string",
		oauth2.S256ChallengeOption(codeVerifier),
		oauth2.SetAuthURLParam("audience", "api://new-api"),
	)

	fmt.Printf("Visit this URL to authorize:\n%s\n\n", url)
	fmt.Printf("After authorization, you'll get a code. Use it to exchange for tokens.\n")

	// 在实际应用中，这里需要启动一个HTTP服务器来接收回调
	// 或者手动输入从回调URL中获取的授权码

	fmt.Print("Enter the authorization code: ")
	var code string
	fmt.Scanln(&code)

	if code != "" {
		// 交换令牌
		token, err := conf.Exchange(
			context.Background(),
			code,
			oauth2.VerifierOption(codeVerifier),
		)
		if err != nil {
			log.Printf("Token exchange failed: %v", err)
			return
		}

		fmt.Printf("Access Token: %s\n", token.AccessToken)
		fmt.Printf("Token Type: %s\n", token.TokenType)
		fmt.Printf("Expires In: %v\n", token.Expiry)

		// 使用令牌调用API
		client := conf.Client(context.Background(), token)
		resp, err := client.Get("http://127.0.0.1:8080/api/status")
		if err != nil {
			log.Printf("API request failed: %v", err)
			return
		}
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("Failed to read response: %v", err)
			return
		}

		fmt.Printf("API Response: %s\n", string(body))
	}
}
