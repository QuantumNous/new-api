package main

import (
	"context"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/clientcredentials"
)

func main() {
	// 测试 Client Credentials 流程
	//testClientCredentials()

	// 测试 Authorization Code + PKCE 流程（需要浏览器交互）
	testAuthorizationCode()
}

// testClientCredentials 测试服务对服务认证
func testClientCredentials() {
	fmt.Println("=== Testing Client Credentials Flow ===")

	cfg := clientcredentials.Config{
		ClientID:     "client_dsFyyoyNZWjhbNa2", // 需要先创建客户端
		ClientSecret: "hLLdn2Ia4UM7hcsJaSuUFDV0Px9BrkNq",
		TokenURL:     "http://localhost:3000/api/oauth/token",
		Scopes:       []string{"api:read", "api:write"},
		EndpointParams: map[string][]string{
			"audience": {"api://new-api"},
		},
	}

	// 创建HTTP客户端
	httpClient := cfg.Client(context.Background())

	// 调用受保护的API
	resp, err := httpClient.Get("http://localhost:3000/api/status")
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
		ClientID:     "client_dsFyyoyNZWjhbNa2", // 需要先创建客户端
		ClientSecret: "JHiugKf89OMmTLuZMZyA2sgZnO0Ioae3",
		RedirectURL:  "http://localhost:9999/callback",
		// 包含 openid/profile/email 以便调用 UserInfo
		Scopes: []string{"openid", "profile", "email", "api:read"},
		Endpoint: oauth2.Endpoint{
			AuthURL:  "http://localhost:3000/api/oauth/authorize",
			TokenURL: "http://localhost:3000/api/oauth/token",
		},
	}

	// 生成PKCE参数
	codeVerifier := oauth2.GenerateVerifier()
	state := fmt.Sprintf("state-%d", time.Now().Unix())

	// 构建授权URL
	url := conf.AuthCodeURL(
		state,
		oauth2.S256ChallengeOption(codeVerifier),
		//oauth2.SetAuthURLParam("audience", "api://new-api"),
	)

	fmt.Printf("Visit this URL to authorize:\n%s\n\n", url)
	fmt.Printf("A local server will listen on http://localhost:9999/callback to receive the code...\n")

	// 启动回调本地服务器，自动接收授权码
	codeCh := make(chan string, 1)
	srv := &http.Server{Addr: ":9999"}
	http.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		q := r.URL.Query()
		if errParam := q.Get("error"); errParam != "" {
			fmt.Fprintf(w, "Authorization failed: %s", errParam)
			return
		}
		gotState := q.Get("state")
		if gotState != state {
			http.Error(w, "state mismatch", http.StatusBadRequest)
			return
		}
		code := q.Get("code")
		if code == "" {
			http.Error(w, "missing code", http.StatusBadRequest)
			return
		}
		fmt.Fprintln(w, "Authorization received. You may close this window.")
		select {
		case codeCh <- code:
		default:
		}
		go func() {
			// 稍后关闭服务
			_ = srv.Shutdown(context.Background())
		}()
	})
	go func() {
		_ = srv.ListenAndServe()
	}()

	// 等待授权码
	var code string
	select {
	case code = <-codeCh:
	case <-time.After(5 * time.Minute):
		log.Println("Timeout waiting for authorization code")
		_ = srv.Shutdown(context.Background())
		return
	}

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

	// 使用令牌调用 UserInfo
	client := conf.Client(context.Background(), token)
	userInfoURL := buildUserInfoFromAuth(conf.Endpoint.AuthURL)
	resp, err := client.Get(userInfoURL)
	if err != nil {
		log.Printf("UserInfo request failed: %v", err)
		return
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Failed to read UserInfo response: %v", err)
		return
	}
	fmt.Printf("UserInfo: %s\n", string(body))
}

// buildUserInfoFromAuth 将授权端点URL转换为UserInfo端点URL
func buildUserInfoFromAuth(auth string) string {
	u, err := url.Parse(auth)
	if err != nil {
		return ""
	}
	// 将最后一个路径段 authorize 替换为 userinfo
	dir := path.Dir(u.Path)
	if strings.HasSuffix(u.Path, "/authorize") {
		u.Path = path.Join(dir, "userinfo")
	} else {
		// 回退：追加默认 /oauth/userinfo
		u.Path = path.Join(dir, "userinfo")
	}
	return u.String()
}
