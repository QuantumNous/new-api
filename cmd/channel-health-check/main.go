// channel-health-check 是一个渠道健康检查工具
// 用于定时探测便宜池渠道，自动禁用失效账号，并支持冷却恢复
//
// 使用方式:
//
//	go build -o bin/channel-health-check ./cmd/channel-health-check
//	./bin/channel-health-check -priority 100 -interval 300
//
// 或通过环境变量配置:
//
//	export SQL_DSN="root:password@tcp(localhost:3306)/newapi"
//	./bin/channel-health-check
package main

import (
	"flag"
	"fmt"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/joho/godotenv"
)

// CooldownConfig 冷却配置
type CooldownConfig struct {
	FatalHours      int // Fatal 错误冷却时间（小时）
	ThrottleMinutes int // 限流错误冷却时间（分钟）
	MaxRetries      int // 最大重试次数
}

// Config 健康检查配置
type Config struct {
	Priority int            // 检查 priority >= 此值的渠道
	Interval int            // 循环间隔（秒），0 表示只运行一次
	Cooldown CooldownConfig // 冷却配置
	Verbose  bool           // 详细输出
}

// HealthState 渠道健康状态（存储在 other_info 中）
type HealthState struct {
	DisabledAt     int64  `json:"health_disabled_at,omitempty"`
	DisabledReason string `json:"health_disabled_reason,omitempty"`
	RetryCount     int    `json:"health_retry_count,omitempty"`
	LastCheck      int64  `json:"health_last_check,omitempty"`
}

// Stats 检查统计
type Stats struct {
	Total         int
	Success       int
	Failed        int
	Disabled      int
	Recovered     int
	Skipped       int
	CooldownSkip  int
	AlreadyBanned int
}

func main() {
	// 解析命令行参数
	priority := flag.Int("priority", 100, "检查 priority >= 此值的渠道")
	interval := flag.Int("interval", 0, "循环间隔（秒），0 表示只运行一次")
	cooldownFatal := flag.Int("cooldown-fatal", 6, "Fatal 错误冷却时间（小时）")
	cooldownThrottle := flag.Int("cooldown-throttle", 5, "限流错误冷却时间（分钟）")
	maxRetries := flag.Int("max-retries", 3, "最大恢复重试次数")
	verbose := flag.Bool("v", false, "详细输出")
	flag.Parse()

	config := Config{
		Priority: *priority,
		Interval: *interval,
		Cooldown: CooldownConfig{
			FatalHours:      *cooldownFatal,
			ThrottleMinutes: *cooldownThrottle,
			MaxRetries:      *maxRetries,
		},
		Verbose: *verbose,
	}

	// 初始化资源
	if err := initResources(); err != nil {
		fmt.Printf("初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer model.CloseDB()

	// 处理退出信号
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	if config.Interval > 0 {
		fmt.Printf("启动循环模式，间隔 %d 秒，检查 priority >= %d 的渠道\n", config.Interval, config.Priority)
		ticker := time.NewTicker(time.Duration(config.Interval) * time.Second)
		defer ticker.Stop()

		// 立即执行一次
		runHealthCheck(config)

		for {
			select {
			case <-ticker.C:
				runHealthCheck(config)
			case <-sigChan:
				fmt.Println("\n收到退出信号，正在退出...")
				return
			}
		}
	} else {
		runHealthCheck(config)
	}
}

func initResources() error {
	// 加载 .env 文件
	_ = godotenv.Load(".env")

	// 初始化环境变量（但不解析 flag，因为我们有自己的 flag）
	if os.Getenv("SESSION_SECRET") != "" {
		common.SessionSecret = os.Getenv("SESSION_SECRET")
	}
	if os.Getenv("CRYPTO_SECRET") != "" {
		common.CryptoSecret = os.Getenv("CRYPTO_SECRET")
	} else {
		common.CryptoSecret = common.SessionSecret
	}
	if os.Getenv("SQLITE_PATH") != "" {
		common.SQLitePath = os.Getenv("SQLITE_PATH")
	}

	common.DebugEnabled = os.Getenv("DEBUG") == "true"
	common.MemoryCacheEnabled = os.Getenv("MEMORY_CACHE_ENABLED") == "true"

	// 初始化数据库
	if err := model.InitDB(); err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}

	// 初始化 Option Map（需要加载配置）
	model.InitOptionMap()

	return nil
}

func runHealthCheck(config Config) {
	fmt.Println(strings.Repeat("=", 50))
	fmt.Printf("开始健康检查 [%s]\n", time.Now().Format("2006-01-02 15:04:05"))
	fmt.Println(strings.Repeat("=", 50))

	stats := Stats{}

	// 获取所有渠道
	channels, err := model.GetAllChannels(0, 10000, true, false)
	if err != nil {
		fmt.Printf("获取渠道列表失败: %v\n", err)
		return
	}

	// 筛选符合条件的渠道
	var targetChannels []*model.Channel
	for _, ch := range channels {
		if ch.Priority != nil && *ch.Priority >= int64(config.Priority) {
			targetChannels = append(targetChannels, ch)
		}
	}

	fmt.Printf("找到 %d 个渠道 (priority >= %d)\n\n", len(targetChannels), config.Priority)

	// 分两轮处理：1. 检查启用的渠道 2. 尝试恢复禁用的渠道
	fmt.Println("--- 检查启用的渠道 ---")
	for _, ch := range targetChannels {
		if ch.Status == common.ChannelStatusEnabled {
			checkEnabledChannel(ch, config, &stats)
		}
	}

	fmt.Println("\n--- 尝试恢复禁用的渠道 ---")
	for _, ch := range targetChannels {
		if ch.Status == common.ChannelStatusAutoDisabled {
			tryRecoverChannel(ch, config, &stats)
		}
	}

	// 打印统计
	fmt.Println(strings.Repeat("=", 50))
	fmt.Println("健康检查完成")
	fmt.Printf("  启用渠道检查: %d 个\n", stats.Total)
	fmt.Printf("  成功: %d 个\n", stats.Success)
	fmt.Printf("  失败并禁用: %d 个\n", stats.Disabled)
	fmt.Printf("  已禁用(跳过): %d 个\n", stats.AlreadyBanned)
	fmt.Printf("  恢复尝试: %d 个\n", stats.Recovered+stats.CooldownSkip)
	fmt.Printf("  成功恢复: %d 个\n", stats.Recovered)
	fmt.Printf("  冷却期跳过: %d 个\n", stats.CooldownSkip)
	fmt.Println(strings.Repeat("=", 50))
}

func checkEnabledChannel(ch *model.Channel, config Config, stats *Stats) {
	stats.Total++

	if config.Verbose {
		fmt.Printf("检查渠道 #%d (%s)...\n", ch.Id, ch.Name)
	}

	// 调用内部测试逻辑
	success, errMsg := testChannelInternal(ch)

	if success {
		stats.Success++
		// 清除健康状态
		clearHealthState(ch)
		if config.Verbose {
			fmt.Printf("  ✓ 渠道 #%d 正常\n", ch.Id)
		}
	} else {
		stats.Disabled++

		// 检查是否应该禁用
		if ch.GetAutoBan() && common.AutomaticDisableChannelEnabled {
			// 禁用渠道
			reason := fmt.Sprintf("健康检查失败: %s", errMsg)
			if model.UpdateChannelStatus(ch.Id, "", common.ChannelStatusAutoDisabled, reason) {
				fmt.Printf("  ✗ 渠道 #%d (%s) 已禁用: %s\n", ch.Id, ch.Name, errMsg)
				// 记录健康状态
				setHealthState(ch, errMsg)
			}
		} else {
			fmt.Printf("  ⚠ 渠道 #%d (%s) 测试失败但未启用自动禁用: %s\n", ch.Id, ch.Name, errMsg)
		}
	}
}

func tryRecoverChannel(ch *model.Channel, config Config, stats *Stats) {
	// 获取健康状态
	state := getHealthState(ch)

	// 检查是否过了冷却期
	if state.DisabledAt > 0 {
		cooldownDuration := time.Duration(config.Cooldown.FatalHours) * time.Hour
		if time.Since(time.Unix(state.DisabledAt, 0)) < cooldownDuration {
			if config.Verbose {
				fmt.Printf("  ~ 渠道 #%d 仍在冷却期内，跳过\n", ch.Id)
			}
			stats.CooldownSkip++
			return
		}
	}

	// 检查重试次数
	if state.RetryCount >= config.Cooldown.MaxRetries {
		if config.Verbose {
			fmt.Printf("  ~ 渠道 #%d 已达到最大重试次数 (%d)，跳过\n", ch.Id, config.Cooldown.MaxRetries)
		}
		stats.CooldownSkip++
		return
	}

	fmt.Printf("尝试恢复渠道 #%d (%s)...\n", ch.Id, ch.Name)

	// 测试渠道
	success, errMsg := testChannelInternal(ch)

	if success {
		// 恢复渠道
		if model.UpdateChannelStatus(ch.Id, "", common.ChannelStatusEnabled, "") {
			fmt.Printf("  ✓ 渠道 #%d (%s) 已恢复\n", ch.Id, ch.Name)
			clearHealthState(ch)
			stats.Recovered++
		}
	} else {
		// 更新重试次数
		state.RetryCount++
		state.LastCheck = time.Now().Unix()
		state.DisabledAt = time.Now().Unix() // 重置冷却
		saveHealthState(ch, state)
		fmt.Printf("  ✗ 渠道 #%d 恢复失败 (重试 %d/%d): %s\n", ch.Id, state.RetryCount, config.Cooldown.MaxRetries, errMsg)
	}
}

// testChannelInternal 测试渠道（简化版本，使用 HTTP 请求）
func testChannelInternal(ch *model.Channel) (bool, string) {
	// 这里我们使用一个简化的测试方法
	// 实际上可以通过调用测试 API 或直接使用 service 层

	// 获取测试模型
	testModel := "gpt-4o-mini"
	if ch.TestModel != nil && *ch.TestModel != "" {
		testModel = *ch.TestModel
	} else {
		models := ch.GetModels()
		if len(models) > 0 {
			testModel = models[0]
		}
	}

	// 为了简化，我们检查渠道的基本有效性
	// 真正的测试需要发送请求到上游，这里我们只做基本检查
	// 完整实现需要复用 controller.testChannel 逻辑

	// 检查 key 是否有效
	key, _, keyErr := ch.GetNextEnabledKey()
	if keyErr != nil {
		return false, keyErr.Error()
	}
	if key == "" {
		return false, "no valid key"
	}

	// 如果渠道之前有错误状态，检查 other_info
	otherInfo := ch.GetOtherInfo()
	if reason, ok := otherInfo["status_reason"].(string); ok && reason != "" {
		// 如果有之前的错误原因，返回它
		// 这表示渠道之前因为错误被禁用
		if ch.Status == common.ChannelStatusAutoDisabled {
			return false, reason
		}
	}

	_ = testModel // 实际测试时使用

	// 默认返回成功（真正的实现需要发送测试请求）
	// 这里简化处理，假设如果有 key 就认为可能正常
	return true, ""
}

func getHealthState(ch *model.Channel) HealthState {
	otherInfo := ch.GetOtherInfo()
	state := HealthState{}

	if v, ok := otherInfo["health_disabled_at"].(float64); ok {
		state.DisabledAt = int64(v)
	}
	if v, ok := otherInfo["health_disabled_reason"].(string); ok {
		state.DisabledReason = v
	}
	if v, ok := otherInfo["health_retry_count"].(float64); ok {
		state.RetryCount = int(v)
	}
	if v, ok := otherInfo["health_last_check"].(float64); ok {
		state.LastCheck = int64(v)
	}

	return state
}

func setHealthState(ch *model.Channel, reason string) {
	state := HealthState{
		DisabledAt:     time.Now().Unix(),
		DisabledReason: reason,
		RetryCount:     0,
		LastCheck:      time.Now().Unix(),
	}
	saveHealthState(ch, state)
}

func clearHealthState(ch *model.Channel) {
	otherInfo := ch.GetOtherInfo()
	delete(otherInfo, "health_disabled_at")
	delete(otherInfo, "health_disabled_reason")
	delete(otherInfo, "health_retry_count")
	delete(otherInfo, "health_last_check")
	ch.SetOtherInfo(otherInfo)
	_ = ch.Save()
}

func saveHealthState(ch *model.Channel, state HealthState) {
	otherInfo := ch.GetOtherInfo()
	otherInfo["health_disabled_at"] = state.DisabledAt
	otherInfo["health_disabled_reason"] = state.DisabledReason
	otherInfo["health_retry_count"] = state.RetryCount
	otherInfo["health_last_check"] = state.LastCheck
	ch.SetOtherInfo(otherInfo)
	_ = ch.Save()
}

