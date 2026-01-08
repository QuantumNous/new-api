package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/model"
)

type GitHubUser struct {
	Id    int64  `json:"id"`
	Login string `json:"login"`
	Name  string `json:"name"`
}

// GitHubAPIClient GitHub API客户端，支持认证和速率限制
type GitHubAPIClient struct {
	client    *http.Client
	token     string // GitHub Personal Access Token
	userAgent string
}

// NewGitHubAPIClient 创建GitHub API客户端
func NewGitHubAPIClient(token string) *GitHubAPIClient {
	return &GitHubAPIClient{
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
		token:     token,
		userAgent: "New-API-Migration-Tool/1.0",
	}
}

// getGitHubNumericId 从GitHub API获取用户数字ID
// 支持认证和速率限制处理
func (c *GitHubAPIClient) getGitHubNumericId(username string) (*GitHubUser, error) {
	return c.getGitHubNumericIdWithRetry(username, 3)
}

// getGitHubNumericIdWithRetry 带重试的GitHub API调用
func (c *GitHubAPIClient) getGitHubNumericIdWithRetry(username string, maxRetries int) (*GitHubUser, error) {
	var lastErr error

	for attempt := 0; attempt < maxRetries; attempt++ {
		if attempt > 0 {
			// 指数退避：2^attempt 秒
			waitTime := time.Duration(1<<uint(attempt)) * time.Second
			if waitTime > 60*time.Second {
				waitTime = 60 * time.Second
			}
			fmt.Printf("  [重试 %d/%d] 等待 %v 后重试...\n", attempt, maxRetries, waitTime)
			time.Sleep(waitTime)
		}

		githubUser, err := c.fetchGitHubUser(username)
		if err == nil {
			return githubUser, nil
		}

		lastErr = err

		// 检查是否是速率限制错误
		if strings.Contains(err.Error(), "rate limit") {
			fmt.Printf("  [警告] GitHub API速率限制，等待60秒后重试...\n")
			time.Sleep(60 * time.Second)
			continue
		}

		// 其他错误（如404）不重试
		if strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "Not Found") {
			return nil, err
		}
	}

	return nil, fmt.Errorf("重试 %d 次后仍失败: %w", maxRetries, lastErr)
}

// fetchGitHubUser 实际执行GitHub API调用
func (c *GitHubAPIClient) fetchGitHubUser(username string) (*GitHubUser, error) {
	// 对username进行URL编码以防止路径遍历攻击
	encodedUsername := url.PathEscape(username)
	apiURL := fmt.Sprintf("https://api.github.com/users/%s", encodedUsername)

	req, err := http.NewRequest("GET", apiURL, nil)
	if err != nil {
		return nil, fmt.Errorf("创建请求失败: %w", err)
	}

	// 设置User-Agent
	req.Header.Set("User-Agent", c.userAgent)
	req.Header.Set("Accept", "application/json")

	// 如果有token，添加认证头
	if c.token != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", strings.TrimSpace(c.token)))
	}

	resp, err := c.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求GitHub API失败: %w", err)
	}
	defer resp.Body.Close()

	// 检查速率限制
	c.checkRateLimit(resp)

	// 处理错误响应
	if resp.StatusCode == 404 {
		return nil, fmt.Errorf("GitHub用户不存在: %s (404)", username)
	}

	if resp.StatusCode == 401 || resp.StatusCode == 403 {
		// 可能是token无效或权限不足
		return nil, fmt.Errorf("GitHub API认证失败 (HTTP %d)，请检查token是否有效", resp.StatusCode)
	}

	if resp.StatusCode == 429 {
		// 速率限制
		return nil, fmt.Errorf("GitHub API速率限制 (429 Too Many Requests)")
	}

	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("GitHub API返回错误: HTTP %d", resp.StatusCode)
	}

	var githubUser GitHubUser
	if err := json.NewDecoder(resp.Body).Decode(&githubUser); err != nil {
		return nil, fmt.Errorf("解析GitHub响应失败: %w", err)
	}

	if githubUser.Id == 0 {
		return nil, fmt.Errorf("GitHub用户不存在: %s", username)
	}

	return &githubUser, nil
}

// checkRateLimit 检查并显示GitHub API速率限制信息
func (c *GitHubAPIClient) checkRateLimit(resp *http.Response) {
	remaining := resp.Header.Get("X-RateLimit-Remaining")
	reset := resp.Header.Get("X-RateLimit-Reset")

	if remaining != "" {
		remainingInt, _ := strconv.Atoi(remaining)
		if reset != "" {
			resetInt, _ := strconv.Atoi(reset)
			resetTime := time.Unix(int64(resetInt), 0)
			fmt.Printf("  [GitHub API] 剩余请求: %d, 重置时间: %v\n", remainingInt, resetTime.Format("15:04:05"))

			// 如果剩余请求数少于10，给出警告
			if remainingInt < 10 {
				fmt.Printf("  [警告] GitHub API剩余请求数不足 (%d)，建议等待到 %v 后继续\n", remainingInt, resetTime.Format("15:04:05"))
			}
		}
	}
}

// 迁移单个用户
func migrateUser(user model.User, dryRun bool, wg *sync.WaitGroup, results chan<- string, client *GitHubAPIClient) {
	defer wg.Done()

	// 跳过已经是数字ID的用户（通过ParseInt验证整个字符串）
	_, err := strconv.ParseInt(user.GitHubId, 10, 64)
	if err == nil {
		// 成功解析为整数，说明已经是数字ID
		results <- fmt.Sprintf("✓ 跳过: %s (ID: %d) - github_id已经是数字格式: %s", user.Username, user.Id, user.GitHubId)
		return
	}

	oldGitHubId := user.GitHubId

	// 调用GitHub API获取数字ID
	githubUser, err := client.getGitHubNumericId(user.GitHubId)
	if err != nil {
		results <- fmt.Sprintf("✗ 失败: %s (ID: %d) - 无法获取GitHub数字ID: %v", user.Username, user.Id, err)
		return
	}

	newGitHubId := fmt.Sprintf("%d", githubUser.Id)

	if !dryRun {
		// 更新数据库
		user.GitHubId = newGitHubId
		if err := model.DB.Model(&user).Update("github_id", newGitHubId).Error; err != nil {
			results <- fmt.Sprintf("✗ 失败: %s (ID: %d) - 数据库更新失败: %v", user.Username, user.Id, err)
			return
		}
		results <- fmt.Sprintf("✓ 成功: %s (ID: %d) - %s → %s", user.Username, user.Id, oldGitHubId, newGitHubId)
	} else {
		results <- fmt.Sprintf("[预览] %s (ID: %d) - %s → %s", user.Username, user.Id, oldGitHubId, newGitHubId)
	}
}

func main() {
	// 检查参数
	dryRun := len(os.Args) > 1 && os.Args[1] == "--dry-run"
	token := ""

	// 检查环境变量中的GitHub token
	if envToken := os.Getenv("GITHUB_TOKEN"); envToken != "" {
		token = envToken
		fmt.Println("✓ 从环境变量 GITHUB_TOKEN 读取token")
	} else if envToken := os.Getenv("GITHUB_API_TOKEN"); envToken != "" {
		token = envToken
		fmt.Println("✓ 从环境变量 GITHUB_API_TOKEN 读取token")
	}

	// 检查命令行参数
	for i, arg := range os.Args {
		if arg == "--token" && i+1 < len(os.Args) {
			token = os.Args[i+1]
			break
		}
		if strings.HasPrefix(arg, "--token=") {
			token = strings.TrimPrefix(arg, "--token=")
			break
		}
	}

	if dryRun {
		fmt.Println("========================================")
		fmt.Println("预览模式：不会实际修改数据库")
		fmt.Println("========================================")
		fmt.Println()
	} else {
		fmt.Println("========================================")
		fmt.Println("GitHub OAuth数据迁移工具")
		fmt.Println("========================================")
		fmt.Println()
		fmt.Println("警告：此操作将修改数据库！")
		fmt.Println()
		fmt.Print("确认继续? (yes/no): ")
		var confirm string
		fmt.Scanln(&confirm)
		if confirm != "yes" && confirm != "y" {
			fmt.Println("取消操作")
			os.Exit(0)
		}
		fmt.Println()
	}

	// 创建GitHub API客户端
	client := NewGitHubAPIClient(token)

	if token == "" {
		fmt.Println("⚠️  未提供GitHub token，将使用未认证请求")
		fmt.Println("   GitHub API速率限制：60次/小时")
		fmt.Println()
		fmt.Println("建议使用token以提高速率限制（5000次/小时）：")
		fmt.Println("   1. 设置环境变量: export GITHUB_TOKEN=your_token")
		fmt.Println("   2. 或使用参数: go run migrate_github_ids.go --token=your_token")
		fmt.Println()
		fmt.Println("获取GitHub token:")
		fmt.Println("   GitHub Settings -> Developer settings -> Personal access tokens -> Tokens (classic)")
		fmt.Println("   只需要 public_repo 权限")
		fmt.Println()
	} else {
		fmt.Printf("✓ 使用GitHub token认证（速率限制：5000次/小时）\n")
		fmt.Println()
	}

	// 初始化数据库连接
	model.InitDB()

	// 查找所有需要迁移的用户
	var users []model.User
	err := model.DB.Where("github_id IS NOT NULL AND github_id != '' AND deleted_at IS NULL").Find(&users).Error
	if err != nil {
		fmt.Printf("❌ 查询用户失败: %v\n", err)
		os.Exit(1)
	}

	if len(users) == 0 {
		fmt.Println("没有找到需要迁移的用户")
		os.Exit(0)
	}

	fmt.Printf("找到 %d 个使用GitHub登录的用户\n", len(users))
	fmt.Println()

	// 使用并发处理（但限制并发数）
	const maxConcurrency = 5
	semaphore := make(chan struct{}, maxConcurrency)
	var wg sync.WaitGroup
	results := make(chan string, len(users))

	for _, user := range users {
		wg.Add(1)
		semaphore <- struct{}{} // 获取信号量

		go func(u model.User) {
			defer func() { <-semaphore }() // 释放信号量
			migrateUser(u, dryRun, &wg, results, client)
		}(user)
	}

	// 等待所有goroutine完成
	wg.Wait()
	close(results)

	// 输出结果
	fmt.Println("========================================")
	fmt.Println("迁移结果")
	fmt.Println("========================================")

	successCount := 0
	failCount := 0
	skipCount := 0

	for result := range results {
		fmt.Println(result)
		// 使用 Unicode 安全的方式检查前缀
		if strings.HasPrefix(result, "✓ ") {
			// "✓ " 表示成功迁移
			successCount++
		} else if strings.HasPrefix(result, "✓") {
			// "✓" 但后面不是空格，表示跳过
			skipCount++
		} else if strings.HasPrefix(result, "✗") {
			// "✗" 表示失败
			failCount++
		}
	}

	fmt.Println("========================================")
	fmt.Printf("总计: %d | 成功: %d | 跳过: %d | 失败: %d\n", len(users), successCount, skipCount, failCount)
	fmt.Println("========================================")

	if failCount > 0 && !dryRun {
		fmt.Println("\n⚠️  部分用户迁移失败，请查看上方错误信息")
		fmt.Println("可能的原因：")
		fmt.Println("  - GitHub用户名已被更改")
		fmt.Println("  - 网络问题导致无法访问GitHub API")
		fmt.Println("  - GitHub API速率限制")
		os.Exit(1)
	} else if dryRun {
		fmt.Println("\n[预览模式完成]")
		fmt.Println("\n如需实际执行迁移，请运行：")
		fmt.Println("  ./migrate_github_ids")
	} else {
		fmt.Println("\n✅ 迁移完成！")
		fmt.Println("\n后续步骤：")
		fmt.Println("  1. 重启应用服务")
		fmt.Println("  2. 通知用户可以正常登录")
		fmt.Println("  3. 监控系统日志确认无异常")
	}
}
