package model

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/go-redis/redis/v8"
)

func setupRedisIntegrationTest(t *testing.T) {
	t.Helper()
	redisURL := os.Getenv("TEST_REDIS_DSN")
	if redisURL == "" {
		t.Skip("TEST_REDIS_DSN not set, skipping Redis integration test")
	}
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		t.Fatalf("failed to parse TEST_REDIS_DSN: %v", err)
	}
	client := redis.NewClient(opt)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	if err := client.Ping(ctx).Err(); err != nil {
		cancel()
		_ = client.Close()
		t.Fatalf("failed to ping Redis: %v", err)
	}
	if err := client.FlushDB(ctx).Err(); err != nil {
		cancel()
		_ = client.Close()
		t.Fatalf("failed to flush Redis test DB: %v", err)
	}

	prevRedisEnabled := common.RedisEnabled
	prevRDB := common.RDB
	prevDataExportInterval := common.DataExportInterval
	prevOptionMap := common.OptionMap
	common.RedisEnabled = true
	common.RDB = client
	common.DataExportInterval = 1
	common.OptionMap = make(map[string]string)

	t.Cleanup(func() {
		_ = client.FlushDB(context.Background()).Err()
		_ = client.Close()
		common.RedisEnabled = prevRedisEnabled
		common.RDB = prevRDB
		common.DataExportInterval = prevDataExportInterval
		common.OptionMap = prevOptionMap
		cancel()
	})
}

func TestRedisOptionReloadDoesNotPublish(t *testing.T) {
	setupRedisIntegrationTest(t)
	if err := DB.AutoMigrate(&Option{}); err != nil {
		t.Fatalf("failed to migrate options: %v", err)
	}

	key := fmt.Sprintf("RedisOptionSyncTest%d", time.Now().UnixNano())
	t.Cleanup(func() {
		_ = DB.Where(commonKeyCol+" = ?", key).Delete(&Option{}).Error
	})

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	sub := common.RDB.Subscribe(ctx, "option_updates")
	defer func() { _ = sub.Close() }()
	if _, err := sub.Receive(ctx); err != nil {
		t.Fatalf("failed to subscribe option_updates: %v", err)
	}
	ch := sub.Channel()

	if err := updateOptionMap(key, "local-only"); err != nil {
		t.Fatalf("updateOptionMap failed: %v", err)
	}
	assertNoRedisMessage(t, ch, 200*time.Millisecond)

	if err := UpdateOption(key, "published"); err != nil {
		t.Fatalf("UpdateOption failed: %v", err)
	}
	assertRedisMessage(t, ch, key, time.Second)

	loadOptionsFromDatabase()
	assertNoRedisMessage(t, ch, 300*time.Millisecond)
}

func TestRedisQuotaFlushKeepsPendingRetryData(t *testing.T) {
	setupRedisIntegrationTest(t)
	if err := DB.AutoMigrate(&QuotaData{}); err != nil {
		t.Fatalf("failed to migrate quota_data: %v", err)
	}

	ctx := context.Background()
	unique := time.Now().UnixNano()
	userID := int(unique%1000000) + 100000
	username := fmt.Sprintf("redis_quota_%d", unique)
	modelName := fmt.Sprintf("redis-model-%d", unique)
	createdAt := time.Now().Unix()
	createdAt -= createdAt % 3600
	suffix := fmt.Sprintf("%d|%s|%d", userID, modelName, createdAt)
	activeKey := quotaDataRedisPrefix + suffix
	pendingFlushKey := quotaDataFlushPrefix + suffix

	t.Cleanup(func() {
		_ = DB.Where("user_id = ? AND username = ? AND model_name = ? AND created_at = ?", userID, username, modelName, createdAt).Delete(&QuotaData{}).Error
	})

	setQuotaDataRedisHash(t, ctx, pendingFlushKey, userID, username, modelName, createdAt, 2, 30, 4)
	setQuotaDataRedisHash(t, ctx, activeKey, userID, username, modelName, createdAt, 3, 50, 6)

	saveQuotaDataFromRedis()

	var quotaData QuotaData
	if err := DB.Where("user_id = ? AND username = ? AND model_name = ? AND created_at = ?", userID, username, modelName, createdAt).First(&quotaData).Error; err != nil {
		t.Fatalf("failed to load saved quota data: %v", err)
	}
	if quotaData.Count != 5 || quotaData.Quota != 80 || quotaData.TokenUsed != 10 {
		t.Fatalf("quota data mismatch: count=%d quota=%d token_used=%d", quotaData.Count, quotaData.Quota, quotaData.TokenUsed)
	}
	keys, err := common.RDB.Keys(ctx, quotaDataFlushPrefix+suffix+"*").Result()
	if err != nil {
		t.Fatalf("failed to scan flush keys: %v", err)
	}
	if len(keys) != 0 {
		t.Fatalf("expected flush keys to be deleted after successful retry, got %v", keys)
	}
}

func assertRedisMessage(t *testing.T, ch <-chan *redis.Message, expected string, timeout time.Duration) {
	t.Helper()
	select {
	case msg := <-ch:
		if msg.Payload != expected {
			t.Fatalf("unexpected Redis message payload: got %q want %q", msg.Payload, expected)
		}
	case <-time.After(timeout):
		t.Fatalf("timed out waiting for Redis message %q", expected)
	}
}

func assertNoRedisMessage(t *testing.T, ch <-chan *redis.Message, wait time.Duration) {
	t.Helper()
	select {
	case msg := <-ch:
		t.Fatalf("unexpected Redis message: %q", msg.Payload)
	case <-time.After(wait):
	}
}

func setQuotaDataRedisHash(t *testing.T, ctx context.Context, key string, userID int, username string, modelName string, createdAt int64, count int, quota int, tokenUsed int) {
	t.Helper()
	fields := map[string]interface{}{
		"_user_id":    userID,
		"_username":   username,
		"_model_name": modelName,
		"_created_at": createdAt,
		"count":       count,
		"quota":       quota,
		"token_used":  tokenUsed,
	}
	if err := common.RDB.HSet(ctx, key, fields).Err(); err != nil {
		t.Fatalf("failed to set quota data Redis hash: %v", err)
	}
}
