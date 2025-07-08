package volcengine

import (
	"context"
	"encoding/json"
	"fmt"
	"one-api/common"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// Redis 客户端
var (
	redisClient *redis.Client
	redisOnce   sync.Once
)

// BatchResultData 批量推理结果数据结构
type BatchResultData struct {
	Result    string `json:"result"`
	Timestamp int64  `json:"timestamp"`
	Status    string `json:"status"`
	RequestID string `json:"request_id"`
	Error     string `json:"error,omitempty"`
}

// getRedisClient 获取Redis客户端实例
func getRedisClient() *redis.Client {
	redisOnce.Do(func() {
		// 使用项目统一的Redis客户端
		if common.RedisEnabled && common.RDB != nil {
			redisClient = common.RDB
		} else {
			// 如果项目Redis未启用，创建一个默认的本地Redis客户端
			redisClient = redis.NewClient(&redis.Options{
				Addr:     "localhost:6379",
				Password: "",
				DB:       0,
			})
		}
	})
	return redisClient
}

// CreateBatchRequestKey 在发起请求前预先创建Redis key
func CreateBatchRequestKey(requestID string) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 设置过期时间为10分钟
	expiration := 10 * time.Minute

	// 创建初始状态的数据结构
	resultData := BatchResultData{
		Result:    "",
		Timestamp: time.Now().Unix(),
		Status:    "pending",
		RequestID: requestID,
	}

	resultDataJson, err := json.Marshal(resultData)
	if err != nil {
		return fmt.Errorf("failed to marshal initial data: %w", err)
	}

	// 写入Redis
	key := "batch_result:" + requestID
	err = redisClient.Set(ctx, key, string(resultDataJson), expiration).Err()
	if err != nil {
		return fmt.Errorf("failed to create initial key in Redis: %w", err)
	}

	// 将key添加到保活管理器
	if err := AddBatchResultKey(requestID); err != nil {
		// 即使添加到保活管理器失败，也不影响Redis key的创建
		fmt.Printf("Warning: Failed to add key %s to keep-alive manager: %v\n", key, err)
	}

	fmt.Printf("Successfully created initial Redis key for request %s with status: pending\n", requestID)
	return nil
}

// SaveBatchResultToRedis 保存批量推理结果到Redis
func SaveBatchResultToRedis(requestID string, result interface{}, status string) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 设置过期时间为24小时
	expiration := 24 * time.Hour

	// 将结果转换为JSON
	var resultJson []byte
	var err error

	if result == nil {
		// 如果结果为nil，使用空字符串
		resultJson = []byte("")
	} else {
		resultJson, err = json.Marshal(result)
		if err != nil {
			return fmt.Errorf("failed to marshal result: %w", err)
		}
	}

	// 创建结果数据结构
	resultData := BatchResultData{
		Result:    string(resultJson),
		Timestamp: time.Now().Unix(),
		Status:    status,
		RequestID: requestID,
	}

	resultDataJson, err := json.Marshal(resultData)
	if err != nil {
		return fmt.Errorf("failed to marshal result data: %w", err)
	}

	// 写入Redis
	key := "batch_result:" + requestID
	err = redisClient.Set(ctx, key, string(resultDataJson), expiration).Err()
	if err != nil {
		return fmt.Errorf("failed to write result to Redis: %w", err)
	}

	fmt.Printf("Successfully wrote result to Redis for request %s with status: %s\n", requestID, status)
	return nil
}

// SaveBatchErrorToRedis 保存批量推理错误到Redis
func SaveBatchErrorToRedis(requestID string, errorMsg string) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 设置过期时间为24小时
	expiration := 24 * time.Hour

	// 创建错误数据结构
	resultData := BatchResultData{
		Result:    "",
		Timestamp: time.Now().Unix(),
		Status:    "error",
		RequestID: requestID,
		Error:     errorMsg,
	}

	resultDataJson, err := json.Marshal(resultData)
	if err != nil {
		return fmt.Errorf("failed to marshal error data: %w", err)
	}

	// 写入Redis
	key := "batch_result:" + requestID
	err = redisClient.Set(ctx, key, string(resultDataJson), expiration).Err()
	if err != nil {
		return fmt.Errorf("failed to write error to Redis: %w", err)
	}

	fmt.Printf("Successfully wrote error to Redis for request %s\n", requestID)
	return nil
}

// GetBatchResultFromRedis 从Redis获取批量推理结果
func GetBatchResultFromRedis(requestID string) (*BatchResultData, error) {
	redisClient := getRedisClient()
	ctx := context.Background()

	key := "batch_result:" + requestID
	result, err := redisClient.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("result not found for request ID: %s", requestID)
		}
		return nil, fmt.Errorf("failed to get result from Redis: %w", err)
	}

	var resultData BatchResultData
	if err := json.Unmarshal([]byte(result), &resultData); err != nil {
		return nil, fmt.Errorf("failed to unmarshal result data: %w", err)
	}

	return &resultData, nil
}

// DeleteBatchResultFromRedis 从Redis删除批量推理结果
func DeleteBatchResultFromRedis(requestID string) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	key := "batch_result:" + requestID
	err := redisClient.Del(ctx, key).Err()
	if err != nil {
		return fmt.Errorf("failed to delete result from Redis: %w", err)
	}

	fmt.Printf("Successfully deleted result from Redis for request %s\n", requestID)
	return nil
}

// ListBatchResultsFromRedis 列出所有批量推理结果
func ListBatchResultsFromRedis() ([]string, error) {
	redisClient := getRedisClient()
	ctx := context.Background()

	pattern := "batch_result:*"
	keys, err := redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return nil, fmt.Errorf("failed to list keys from Redis: %w", err)
	}

	return keys, nil
}

// GetBatchResultCount 获取批量推理结果数量
func GetBatchResultCount() (int64, error) {
	redisClient := getRedisClient()
	ctx := context.Background()

	pattern := "batch_result:*"
	count, err := redisClient.Keys(ctx, pattern).Result()
	if err != nil {
		return 0, fmt.Errorf("failed to count keys from Redis: %w", err)
	}

	return int64(len(count)), nil
}

// CleanExpiredBatchResults 清理过期的批量推理结果
func CleanExpiredBatchResults() error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 获取所有批量推理结果的key
	keys, err := ListBatchResultsFromRedis()
	if err != nil {
		return fmt.Errorf("failed to list keys: %w", err)
	}

	// 检查每个key的TTL，如果小于等于0则删除
	for _, key := range keys {
		ttl, err := redisClient.TTL(ctx, key).Result()
		if err != nil {
			fmt.Printf("Failed to get TTL for key %s: %v\n", key, err)
			continue
		}

		if ttl <= 0 {
			err := redisClient.Del(ctx, key).Err()
			if err != nil {
				fmt.Printf("Failed to delete expired key %s: %v\n", key, err)
			} else {
				fmt.Printf("Successfully deleted expired key %s\n", key)
			}
		}
	}

	return nil
}

// PingRedis 测试Redis连接
func PingRedis() error {
	redisClient := getRedisClient()
	ctx := context.Background()

	_, err := redisClient.Ping(ctx).Result()
	if err != nil {
		return fmt.Errorf("failed to ping Redis: %w", err)
	}

	return nil
}

// TryAcquireLock 尝试获取分布式锁
func TryAcquireLock(lockKey string, expiration time.Duration) (bool, error) {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 使用SET命令的NX和EX选项实现分布式锁
	result, err := redisClient.SetNX(ctx, "lock:"+lockKey, "locked", expiration).Result()
	if err != nil {
		return false, fmt.Errorf("failed to acquire lock: %w", err)
	}

	return result, nil
}

// ReleaseLock 释放分布式锁
func ReleaseLock(lockKey string) error {
	redisClient := getRedisClient()
	ctx := context.Background()

	// 删除锁
	err := redisClient.Del(ctx, "lock:"+lockKey).Err()
	if err != nil {
		return fmt.Errorf("failed to release lock: %w", err)
	}

	return nil
}
