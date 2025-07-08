package volcengine

import (
	"context"
	"fmt"
	"math/rand"
	"one-api/common"
	"one-api/middleware"
	"strings"
	"sync"
	"time"
)

// KeepAliveManager 保活管理器
type KeepAliveManager struct {
	keys       map[string]*KeepAliveKey
	mutex      sync.RWMutex
	ctx        context.Context
	cancel     context.CancelFunc
	isRunning  bool
	interval   time.Duration
	expiration time.Duration
}

// KeepAliveKey 保活key的信息
type KeepAliveKey struct {
	Key        string        `json:"key"`
	CreatedAt  time.Time     `json:"created_at"`  // 创建时间
	LastTouch  time.Time     `json:"last_touch"`  // 最后触摸时间
	Expiration time.Duration `json:"expiration"`  // 过期时间
	Status     string        `json:"status"`      // active, inactive, error
	ErrorCount int           `json:"error_count"` // 错误计数
}

// 全局保活管理器实例
var (
	keepAliveManager *KeepAliveManager
	keepAliveOnce    sync.Once
)

// 默认配置
const (
	DefaultKeepAliveInterval   = 10 * time.Second // 默认保活间隔：10分钟
	DefaultKeepAliveExpiration = 10 * time.Minute // 默认过期时间：4小时
	MaxKeepAliveDuration       = 10 * time.Minute // 最大保活时间：4小时
	MaxErrorCount              = 5                // 最大错误次数
	KeepAliveTriggerTime       = 5 * time.Minute  // 保活触发时间：在key过期前5分钟开始保活
	MinKeepAliveInterval       = 30 * time.Second // 随机保活时间范围
	MaxKeepAliveInterval       = 2 * time.Minute  // 随机保活时间范围
)

// GetKeepAliveManager 获取全局保活管理器实例（单例模式）
func GetKeepAliveManager() *KeepAliveManager {
	keepAliveOnce.Do(func() {
		keepAliveManager = NewKeepAliveManager(DefaultKeepAliveInterval, DefaultKeepAliveExpiration)
	})
	return keepAliveManager
}

// NewKeepAliveManager 创建新的保活管理器
func NewKeepAliveManager(interval, expiration time.Duration) *KeepAliveManager {
	ctx, cancel := context.WithCancel(context.Background())

	manager := &KeepAliveManager{
		keys:       make(map[string]*KeepAliveKey),
		ctx:        ctx,
		cancel:     cancel,
		isRunning:  false,
		interval:   interval,
		expiration: expiration,
	}

	return manager
}

// Start 启动保活管理器
func (kam *KeepAliveManager) Start() error {
	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	if kam.isRunning {
		return fmt.Errorf("keep-alive manager is already running")
	}

	kam.isRunning = true

	// 启动保活协程
	go kam.keepAliveLoop()

	common.LogInfo(kam.ctx, fmt.Sprintf("Keep-alive manager started with interval: %v, expiration: %v", kam.interval, kam.expiration))
	return nil
}

// Stop 停止保活管理器
func (kam *KeepAliveManager) Stop() error {
	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	if !kam.isRunning {
		return fmt.Errorf("keep-alive manager is not running")
	}

	kam.isRunning = false
	kam.cancel()

	common.LogInfo(kam.ctx, "Keep-alive manager stopped")
	return nil
}

// AddKey 添加key到保活列表
func (kam *KeepAliveManager) AddKey(key string, expiration time.Duration) error {
	if key == "" {
		return fmt.Errorf("key cannot be empty")
	}

	if expiration <= 0 {
		expiration = kam.expiration
	}

	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	// 检查key是否已存在
	if _, exists := kam.keys[key]; exists {
		return fmt.Errorf("key %s already exists in keep-alive list", key)
	}

	// 创建新的保活key
	keepAliveKey := &KeepAliveKey{
		Key:        key,
		CreatedAt:  time.Now(),
		LastTouch:  time.Now(),
		Expiration: expiration,
		Status:     "active",
		ErrorCount: 0,
	}

	kam.keys[key] = keepAliveKey

	common.LogInfo(kam.ctx, fmt.Sprintf("Added key %s to keep-alive list with expiration: %v", key, expiration))
	return nil
}

// RemoveKey 从保活列表中移除key
func (kam *KeepAliveManager) RemoveKey(key string) error {
	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	if _, exists := kam.keys[key]; !exists {
		return fmt.Errorf("key %s not found in keep-alive list", key)
	}

	delete(kam.keys, key)

	common.LogInfo(kam.ctx, fmt.Sprintf("Removed key %s from keep-alive list", key))
	return nil
}

// GetKey 获取key的信息
func (kam *KeepAliveManager) GetKey(key string) (*KeepAliveKey, error) {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	keepAliveKey, exists := kam.keys[key]
	if !exists {
		return nil, fmt.Errorf("key %s not found in keep-alive list", key)
	}

	return keepAliveKey, nil
}

// GetAllKeys 获取所有保活key的信息
func (kam *KeepAliveManager) GetAllKeys() map[string]*KeepAliveKey {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	// 创建副本以避免并发访问问题
	result := make(map[string]*KeepAliveKey)
	for key, value := range kam.keys {
		result[key] = &KeepAliveKey{
			Key:        value.Key,
			CreatedAt:  value.CreatedAt,
			LastTouch:  value.LastTouch,
			Expiration: value.Expiration,
			Status:     value.Status,
			ErrorCount: value.ErrorCount,
		}
	}

	return result
}

// GetKeyCount 获取保活key的数量
func (kam *KeepAliveManager) GetKeyCount() int {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	return len(kam.keys)
}

// IsRunning 检查保活管理器是否正在运行
func (kam *KeepAliveManager) IsRunning() bool {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	return kam.isRunning
}

// keepAliveLoop 保活循环
func (kam *KeepAliveManager) keepAliveLoop() {
	for {
		select {
		case <-kam.ctx.Done():
			common.LogInfo(kam.ctx, "Keep-alive loop stopped")
			return
		default:
			// 生成随机保活间隔时间
			randomInterval := kam.generateRandomInterval()
			common.LogInfo(kam.ctx, fmt.Sprintf("Next keep-alive in %v", randomInterval))

			// 等待随机时间
			select {
			case <-kam.ctx.Done():
				common.LogInfo(kam.ctx, "Keep-alive loop stopped")
				return
			case <-time.After(randomInterval):
				kam.performKeepAlive()
			}
		}
	}
}

// generateRandomInterval 生成随机保活间隔时间
func (kam *KeepAliveManager) generateRandomInterval() time.Duration {
	// 计算随机秒数
	minSeconds := int(MinKeepAliveInterval.Seconds())
	maxSeconds := int(MaxKeepAliveInterval.Seconds())
	randomSeconds := minSeconds + rand.Intn(maxSeconds-minSeconds+1)

	return time.Duration(randomSeconds) * time.Second
}

// performKeepAlive 执行保活操作
func (kam *KeepAliveManager) performKeepAlive() {
	// 使用现有的RequestId生成逻辑创建ctx
	requestID := middleware.GenerateUniqueRequestId()
	ctx := context.WithValue(context.Background(), common.RequestIdKey, requestID)

	kam.mutex.RLock()
	keys := make([]string, 0, len(kam.keys))
	for key := range kam.keys {
		keys = append(keys, key)
	}
	kam.mutex.RUnlock()

	// 记录本轮保活开始
	common.LogInfo(ctx, fmt.Sprintf("Keep-alive round started, total keys: %d", len(keys)))

	// 统计变量
	var (
		successCount int
		removedCount int
		errorCount   int
		skippedCount int
	)

	// 逐个处理每个key
	for i, key := range keys {
		keyRequestID := fmt.Sprintf("%s-key-%d", requestID, i+1)
		keyCtx := context.WithValue(ctx, "key_request_id", keyRequestID)

		result := kam.touchKey(keyCtx, key)
		switch result {
		case "success":
			successCount++
		case "removed":
			removedCount++
		case "error":
			errorCount++
		case "skipped":
			skippedCount++
		}
	}

	// 记录本轮保活结束
	common.LogInfo(ctx, fmt.Sprintf("Keep-alive round completed, success: %d, removed: %d, errors: %d, skipped: %d",
		successCount, removedCount, errorCount, skippedCount))
}

// touchKey 触摸单个key以保持活跃（内部方法，带详细日志）
func (kam *KeepAliveManager) touchKey(ctx context.Context, key string) string {
	kam.mutex.Lock()
	keepAliveKey, exists := kam.keys[key]
	if !exists {
		kam.mutex.Unlock()
		common.LogInfo(ctx, fmt.Sprintf("Key %s not found in keep-alive list", key))
		return "removed"
	}
	kam.mutex.Unlock()

	// 记录开始处理key
	common.LogInfo(ctx, fmt.Sprintf("Processing key %s, age: %v, error_count: %d",
		key, time.Since(keepAliveKey.CreatedAt), keepAliveKey.ErrorCount))

	// 检查是否超过最大保活时间
	if time.Since(keepAliveKey.CreatedAt) > MaxKeepAliveDuration {
		common.LogInfo(ctx, fmt.Sprintf("Key %s has exceeded max keep-alive duration (%v), removing from keep-alive list",
			key, MaxKeepAliveDuration))
		kam.RemoveKey(key)
		return "removed"
	}

	// 检查是否需要保活：只在key快到期的最后5分钟进行保活
	remainingTime := keepAliveKey.Expiration - time.Since(keepAliveKey.CreatedAt)
	if remainingTime > KeepAliveTriggerTime {
		common.LogInfo(ctx, fmt.Sprintf("Key %s has %v remaining, skipping keep-alive (trigger time: %v)",
			key, remainingTime, KeepAliveTriggerTime))
		return "skipped"
	}

	// 尝试触摸key
	err := kam.touchRedisKey(key, keepAliveKey.Expiration)

	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	if err != nil {
		// 检查是否是key不存在的错误
		if strings.Contains(err.Error(), "does not exist in Redis") {
			common.LogInfo(ctx, fmt.Sprintf("Key %s no longer exists in Redis, removing from keep-alive list",
				key))
			delete(kam.keys, key)
			return "removed"
		}

		// 其他错误，增加错误计数
		keepAliveKey.ErrorCount++
		keepAliveKey.Status = "error"

		common.LogError(ctx, fmt.Sprintf("Failed to touch key %s: %v (error count: %d)",
			key, err, keepAliveKey.ErrorCount))

		// 如果错误次数超过阈值，移除key
		if keepAliveKey.ErrorCount >= MaxErrorCount {
			common.LogError(ctx, fmt.Sprintf("Key %s exceeded max error count, removing from keep-alive list",
				key))
			delete(kam.keys, key)
			return "removed"
		}

		return "error"
	} else {
		keepAliveKey.LastTouch = time.Now()
		keepAliveKey.ErrorCount = 0
		keepAliveKey.Status = "active"

		common.LogInfo(ctx, fmt.Sprintf("Successfully touched key %s, new expiration: %v",
			key, keepAliveKey.Expiration))

		return "success"
	}
}

// touchRedisKey 触摸Redis中的key
func (kam *KeepAliveManager) touchRedisKey(key string, expiration time.Duration) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 检查key是否存在
	exists, err := redisClient.Exists(ctx, key).Result()
	if err != nil {
		return fmt.Errorf("failed to check key existence: %w", err)
	}

	if exists == 0 {
		return fmt.Errorf("key %s does not exist in Redis, should be removed from keep-alive list", key)
	}

	// 更新key的过期时间
	err = redisClient.Expire(ctx, key, expiration).Err()
	if err != nil {
		return fmt.Errorf("failed to update key expiration: %w", err)
	}

	return nil
}

// CleanupExpiredKeys 清理过期的key
func (kam *KeepAliveManager) CleanupExpiredKeys() int {
	kam.mutex.Lock()
	defer kam.mutex.Unlock()

	now := time.Now()
	removedCount := 0

	for key, keepAliveKey := range kam.keys {
		if now.Sub(keepAliveKey.LastTouch) > keepAliveKey.Expiration {
			delete(kam.keys, key)
			removedCount++
			common.LogInfo(kam.ctx, fmt.Sprintf("Cleaned up expired key: %s", key))
		}
	}

	if removedCount > 0 {
		common.LogInfo(kam.ctx, fmt.Sprintf("Cleaned up %d expired keys", removedCount))
	}

	return removedCount
}

// GetStats 获取保活管理器的统计信息
func (kam *KeepAliveManager) GetStats() map[string]interface{} {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	stats := make(map[string]interface{})
	stats["is_running"] = kam.isRunning
	stats["total_keys"] = len(kam.keys)
	stats["interval"] = kam.interval.String()
	stats["expiration"] = kam.expiration.String()
	stats["max_keep_alive_duration"] = MaxKeepAliveDuration.String()

	// 统计不同状态的key数量
	statusCount := make(map[string]int)
	// 统计保活时间分布
	ageDistribution := make(map[string]int)
	now := time.Now()

	for _, key := range kam.keys {
		statusCount[key.Status]++

		// 计算key的年龄并分类
		age := now.Sub(key.CreatedAt)
		switch {
		case age < 1*time.Hour:
			ageDistribution["<1h"]++
		case age < 2*time.Hour:
			ageDistribution["1-2h"]++
		case age < 3*time.Hour:
			ageDistribution["2-3h"]++
		case age < 4*time.Hour:
			ageDistribution["3-4h"]++
		default:
			ageDistribution[">4h"]++
		}
	}
	stats["status_count"] = statusCount
	stats["age_distribution"] = ageDistribution

	return stats
}

// 便捷函数，用于快速添加batch_result类型的key
func AddBatchResultKey(requestID string) error {
	manager := GetKeepAliveManager()
	key := "batch_result:" + requestID
	return manager.AddKey(key, DefaultKeepAliveExpiration)
}

// 便捷函数，用于快速移除batch_result类型的key
func RemoveBatchResultKey(requestID string) error {
	manager := GetKeepAliveManager()
	key := "batch_result:" + requestID
	return manager.RemoveKey(key)
}

// 便捷函数，用于获取batch_result类型key的剩余保活时间
func GetBatchResultKeyRemainingTime(requestID string) (time.Duration, error) {
	manager := GetKeepAliveManager()
	key := "batch_result:" + requestID
	return manager.GetKeyRemainingKeepAliveTime(key)
}

// 便捷函数，用于获取batch_result类型key的年龄
func GetBatchResultKeyAge(requestID string) (time.Duration, error) {
	manager := GetKeepAliveManager()
	key := "batch_result:" + requestID
	return manager.GetKeyAge(key)
}

// InitKeepAliveManager 初始化并启动保活管理器
func InitKeepAliveManager() error {
	manager := GetKeepAliveManager()

	// 如果已经运行，直接返回
	if manager.IsRunning() {
		return nil
	}

	// 启动保活管理器
	if err := manager.Start(); err != nil {
		return fmt.Errorf("failed to start keep-alive manager: %w", err)
	}

	common.LogInfo(context.Background(), "Keep-alive manager initialized and started successfully")
	return nil
}

// ShutdownKeepAliveManager 关闭保活管理器
func ShutdownKeepAliveManager() error {
	manager := GetKeepAliveManager()

	if !manager.IsRunning() {
		return nil
	}

	if err := manager.Stop(); err != nil {
		return fmt.Errorf("failed to stop keep-alive manager: %w", err)
	}

	common.LogInfo(context.Background(), "Keep-alive manager shutdown successfully")
	return nil
}

// GetKeyRemainingKeepAliveTime 获取key的剩余保活时间
func (kam *KeepAliveManager) GetKeyRemainingKeepAliveTime(key string) (time.Duration, error) {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	keepAliveKey, exists := kam.keys[key]
	if !exists {
		return 0, fmt.Errorf("key %s not found in keep-alive list", key)
	}

	elapsed := time.Since(keepAliveKey.CreatedAt)
	remaining := MaxKeepAliveDuration - elapsed

	if remaining <= 0 {
		return 0, nil
	}

	return remaining, nil
}

// GetKeyAge 获取key的年龄（从创建到现在的时间）
func (kam *KeepAliveManager) GetKeyAge(key string) (time.Duration, error) {
	kam.mutex.RLock()
	defer kam.mutex.RUnlock()

	keepAliveKey, exists := kam.keys[key]
	if !exists {
		return 0, fmt.Errorf("key %s not found in keep-alive list", key)
	}

	return time.Since(keepAliveKey.CreatedAt), nil
}
