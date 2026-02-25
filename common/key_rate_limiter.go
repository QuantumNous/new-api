/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

package common

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/go-redis/redis/v8"
)

// KeyRateLimitConfig 密钥限流配置
type KeyRateLimitConfig struct {
	MaxConcurrency int `json:"max_concurrency"` // 最大并发数 (0=无限制)
	MaxRPM         int `json:"max_rpm"`         // 每分钟最大请求数 (0=无限制)
}

// KeyRateLimiter 密钥级别限流管理器
type KeyRateLimiter struct {
	redisClient          *redis.Client
	concurrencyScriptSHA string
	rpmScriptSHA         string
}

var (
	keyRateLimiter     *KeyRateLimiter
	keyRateLimiterOnce sync.Once
)

//go:embed limiter/lua/key_concurrency.lua
var keyConcurrencyScript string

//go:embed limiter/lua/rate_limit.lua
var rpmLimitScript string

// GetKeyRateLimiter 获取密钥限流器单例
func GetKeyRateLimiter() *KeyRateLimiter {
	keyRateLimiterOnce.Do(func() {
		if RDB == nil {
			SysLog("Redis not initialized, key rate limiter will use in-memory fallback")
			keyRateLimiter = &KeyRateLimiter{
				redisClient: nil,
			}
			return
		}

		// 预加载脚本
		ctx := context.Background()
		concurrencySHA, err := RDB.ScriptLoad(ctx, keyConcurrencyScript).Result()
		if err != nil {
			SysError(fmt.Sprintf("Failed to load key concurrency script: %v", err))
		}

		rpmSHA, err := RDB.ScriptLoad(ctx, rpmLimitScript).Result()
		if err != nil {
			SysError(fmt.Sprintf("Failed to load RPM limit script: %v", err))
		}

		keyRateLimiter = &KeyRateLimiter{
			redisClient:          RDB,
			concurrencyScriptSHA: concurrencySHA,
			rpmScriptSHA:         rpmSHA,
		}
	})
	return keyRateLimiter
}

// 构建Redis键
func concurrencyKey(channelId, keyIndex int) string {
	return fmt.Sprintf("keyRL:concurrency:%d:%d", channelId, keyIndex)
}

func rpmKey(channelId, keyIndex int) string {
	return fmt.Sprintf("keyRL:rpm:%d:%d", channelId, keyIndex)
}

func queueKey(channelId int) string {
	return fmt.Sprintf("keyRL:queue:%d", channelId)
}

// checkRPM 检查RPM限制（使用令牌桶算法）
func (k *KeyRateLimiter) checkRPM(ctx context.Context, channelId, keyIndex int, maxRPM int) (bool, error) {
	if k.redisClient == nil || k.rpmScriptSHA == "" {
		return true, nil
	}

	key := rpmKey(channelId, keyIndex)
	// RPM = 请求/分钟, 转换为请求/秒
	// rate = 每秒生成的令牌数（使用浮点数表示）
	// capacity = 桶容量
	rate := float64(maxRPM) / 60.0
	capacity := int64(maxRPM)

	result, err := k.redisClient.EvalSha(
		ctx,
		k.rpmScriptSHA,
		[]string{key},
		1,        // requested tokens
		rate,     // rate per second
		capacity, // bucket capacity
	).Int()

	if err != nil {
		return false, fmt.Errorf("RPM check failed: %w", err)
	}

	return result == 1, nil
}

// CanAcquire 检查是否可以获取槽位（不实际获取）
func (k *KeyRateLimiter) CanAcquire(ctx context.Context, channelId, keyIndex int, config *KeyRateLimitConfig) (bool, error) {
	if config == nil {
		return true, nil
	}

	// 检查并发限制
	if config.MaxConcurrency > 0 && k.redisClient != nil {
		key := concurrencyKey(channelId, keyIndex)
		current, err := k.redisClient.Get(ctx, key).Int()
		if err != nil && err != redis.Nil {
			return false, fmt.Errorf("failed to get concurrency count: %w", err)
		}
		if current >= config.MaxConcurrency {
			return false, nil
		}
	}

	// 检查RPM限制
	if config.MaxRPM > 0 {
		allowed, err := k.checkRPM(ctx, channelId, keyIndex, config.MaxRPM)
		if err != nil {
			return false, err
		}
		if !allowed {
			return false, nil
		}
	}

	return true, nil
}

// AcquireSlot 获取并发槽位
func (k *KeyRateLimiter) AcquireSlot(ctx context.Context, channelId, keyIndex int, config *KeyRateLimitConfig) (bool, error) {
	if config == nil {
		return true, nil
	}

	// 先检查RPM限制
	if config.MaxRPM > 0 {
		allowed, err := k.checkRPM(ctx, channelId, keyIndex, config.MaxRPM)
		if err != nil {
			return false, fmt.Errorf("RPM check failed: %w", err)
		}
		if !allowed {
			return false, nil
		}
	}

	// 获取并发槽位
	if config.MaxConcurrency > 0 && k.redisClient != nil && k.concurrencyScriptSHA != "" {
		key := concurrencyKey(channelId, keyIndex)
		result, err := k.redisClient.EvalSha(
			ctx,
			k.concurrencyScriptSHA,
			[]string{key},
			config.MaxConcurrency,
			"acquire",
			300, // 5分钟过期
		).Int()

		if err != nil {
			return false, fmt.Errorf("concurrency acquire failed: %w", err)
		}

		return result == 1, nil
	}

	return true, nil
}

// ReleaseSlot 释放并发槽位
func (k *KeyRateLimiter) ReleaseSlot(ctx context.Context, channelId, keyIndex int) error {
	if k.redisClient == nil || k.concurrencyScriptSHA == "" {
		return nil
	}

	key := concurrencyKey(channelId, keyIndex)
	_, err := k.redisClient.EvalSha(
		ctx,
		k.concurrencyScriptSHA,
		[]string{key},
		0, // maxConcurrency not needed for release
		"release",
		300,
	).Result()

	if err != nil {
		return fmt.Errorf("concurrency release failed: %w", err)
	}

	return nil
}

// WaitForSlot 等待获取槽位，支持队列
func (k *KeyRateLimiter) WaitForSlot(ctx context.Context, channelId int, keyIndices []int, config *KeyRateLimitConfig, timeout time.Duration) (int, error) {
	if config == nil {
		if len(keyIndices) > 0 {
			return keyIndices[0], nil
		}
		return -1, errors.New("no keys available")
	}

	// 首先尝试立即获取
	for _, keyIndex := range keyIndices {
		acquired, err := k.AcquireSlot(ctx, channelId, keyIndex, config)
		if err != nil {
			continue
		}
		if acquired {
			return keyIndex, nil
		}
	}

	// 所有密钥都达到限制，进入队列等待
	requestID := fmt.Sprintf("%d-%d", channelId, time.Now().UnixNano())

	// 加入队列
	if k.redisClient != nil {
		queueK := queueKey(channelId)
		item := fmt.Sprintf("%s:%d", requestID, time.Now().Unix())
		err := k.redisClient.RPush(ctx, queueK, item).Err()
		if err != nil {
			return -1, fmt.Errorf("failed to join queue: %w", err)
		}
		defer func() {
			// 离开队列
			k.redisClient.LRem(ctx, queueK, 1, item)
		}()
	}

	// 轮询等待槽位
	deadline := time.Now().Add(timeout)
	pollInterval := time.Millisecond * 100

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return -1, ctx.Err()
		default:
		}

		// 尝试获取槽位
		for _, keyIndex := range keyIndices {
			acquired, err := k.AcquireSlot(ctx, channelId, keyIndex, config)
			if err != nil {
				continue
			}
			if acquired {
				return keyIndex, nil
			}
		}

		// 等待一段时间后重试
		time.Sleep(pollInterval)
	}

	return -1, errors.New("wait for slot timeout: all keys are rate limited")
}

// GetConcurrencyCount 获取当前并发数（用于监控）
func (k *KeyRateLimiter) GetConcurrencyCount(ctx context.Context, channelId, keyIndex int) (int, error) {
	if k.redisClient == nil {
		return 0, nil
	}

	key := concurrencyKey(channelId, keyIndex)
	count, err := k.redisClient.Get(ctx, key).Int()
	if err == redis.Nil {
		return 0, nil
	}
	return count, err
}

// GetQueueLength 获取队列长度（用于监控）
func (k *KeyRateLimiter) GetQueueLength(ctx context.Context, channelId int) (int64, error) {
	if k.redisClient == nil {
		return 0, nil
	}

	key := queueKey(channelId)
	return k.redisClient.LLen(ctx, key).Result()
}
