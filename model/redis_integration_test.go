package model

import (
	"context"
	"fmt"
	"os"
	"strconv"
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

func TestSubscriptionRedisBucketReserveAndRollback(t *testing.T) {
	setupTimeQuotaTestDB(t)
	setupRedisIntegrationTest(t)
	t.Setenv("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", "redis_bucket")
	t.Setenv("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", "300")
	t.Setenv("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", "deny")

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "Redis bucket window plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		WindowLimit5h:  1000,
		WindowLimit24h: 1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := DB.Create(plan).Error; err != nil {
		t.Fatalf("failed to create subscription plan: %v", err)
	}
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "redis-bucket-order")
	if err != nil {
		t.Fatalf("failed to create user subscription: %v", err)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-over", userId, "gpt-4", 0, 1200, ""); err == nil {
		t.Fatalf("expected over-window pre-consume to fail")
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 0 {
		t.Fatalf("expected Redis bucket rollback to leave 0, got %d", got)
	}

	res, err := PreConsumeUserSubscription("redis-bucket-ok", userId, "gpt-4", 0, 1000, "")
	if err != nil {
		t.Fatalf("expected exact-window pre-consume to succeed: %v", err)
	}
	if res == nil || res.PreConsumed != 1000 {
		t.Fatalf("unexpected pre-consume result: %+v", res)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 1000 {
		t.Fatalf("expected Redis bucket amount 1000, got %d", got)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-over-2", userId, "gpt-4", 0, 1, ""); err == nil {
		t.Fatalf("expected exhausted-window pre-consume to fail")
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 1000 {
		t.Fatalf("expected exhausted attempt to keep Redis bucket at 1000, got %d", got)
	}
}

func TestSubscriptionRedisBucketRefundSync(t *testing.T) {
	setupTimeQuotaTestDB(t)
	setupRedisIntegrationTest(t)
	t.Setenv("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", "redis_bucket")
	t.Setenv("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", "300")
	t.Setenv("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", "deny")

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "Redis bucket refund plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		WindowLimit5h:  1000,
		WindowLimit24h: 1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := DB.Create(plan).Error; err != nil {
		t.Fatalf("failed to create subscription plan: %v", err)
	}
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "redis-bucket-refund-order")
	if err != nil {
		t.Fatalf("failed to create user subscription: %v", err)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-refund", userId, "gpt-4", 0, 600, ""); err != nil {
		t.Fatalf("expected pre-consume to succeed: %v", err)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 600 {
		t.Fatalf("expected Redis bucket amount 600 before refund, got %d", got)
	}
	if err := RefundSubscriptionPreConsume("redis-bucket-refund"); err != nil {
		t.Fatalf("expected refund to succeed: %v", err)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 0 {
		t.Fatalf("expected Redis bucket amount 0 after refund, got %d", got)
	}
}

func TestSubscriptionRedisBucketRebuildsAfterDBFallback(t *testing.T) {
	setupTimeQuotaTestDB(t)
	setupRedisIntegrationTest(t)
	t.Setenv("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", "redis_bucket")
	t.Setenv("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", "300")
	t.Setenv("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", "db")

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "Redis bucket fallback rebuild plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		WindowLimit5h:  1000,
		WindowLimit24h: 1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := DB.Create(plan).Error; err != nil {
		t.Fatalf("failed to create subscription plan: %v", err)
	}
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "redis-bucket-fallback-order")
	if err != nil {
		t.Fatalf("failed to create user subscription: %v", err)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-before-fallback", userId, "gpt-4", 0, 300, ""); err != nil {
		t.Fatalf("expected initial Redis pre-consume to succeed: %v", err)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 300 {
		t.Fatalf("expected Redis bucket amount 300 before fallback, got %d", got)
	}

	common.RedisEnabled = false
	if _, err := PreConsumeUserSubscription("redis-bucket-db-fallback", userId, "gpt-4", 0, 400, ""); err != nil {
		t.Fatalf("expected DB fallback pre-consume to succeed: %v", err)
	}
	common.RedisEnabled = true
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 300 {
		t.Fatalf("expected Redis bucket to remain stale at 300 during fallback, got %d", got)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-after-fallback-over", userId, "gpt-4", 0, 350, ""); err == nil {
		t.Fatalf("expected post-recovery over-window pre-consume to fail after rebuild")
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 700 {
		t.Fatalf("expected Redis bucket rebuild to DB ledger amount 700 after failed over-window attempt, got %d", got)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-after-fallback-ok", userId, "gpt-4", 0, 300, ""); err != nil {
		t.Fatalf("expected remaining post-recovery pre-consume to succeed: %v", err)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 1000 {
		t.Fatalf("expected Redis bucket amount 1000 after recovery consume, got %d", got)
	}
}

func TestSubscriptionRedisBucketRebuildsStaleBucketWhenDBEmpty(t *testing.T) {
	setupTimeQuotaTestDB(t)
	setupRedisIntegrationTest(t)
	t.Setenv("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", "redis_bucket")
	t.Setenv("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", "300")
	t.Setenv("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", "deny")

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "Redis bucket stale empty plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		WindowLimit5h:  1000,
		WindowLimit24h: 1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := DB.Create(plan).Error; err != nil {
		t.Fatalf("failed to create subscription plan: %v", err)
	}
	userId := createTestUser(t, "default", "default")
	sub, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "redis-bucket-stale-empty-order")
	if err != nil {
		t.Fatalf("failed to create user subscription: %v", err)
	}

	watermark, hasRows, err := subscriptionWindowRedisWatermarkTx(DB, sub.Id, now)
	if err != nil {
		t.Fatalf("failed to compute empty watermark: %v", err)
	}
	if hasRows {
		t.Fatalf("expected no DB window rows for new subscription")
	}
	idxKey, amtKey := subscriptionWindowRedisKeys(sub.Id)
	metaKey := subscriptionWindowRedisMetaKey(sub.Id)
	staleBucket := subscriptionWindowBucketStart(now, subscriptionWindowBucketSeconds())
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := common.RDB.ZAdd(ctx, idxKey, &redis.Z{Score: float64(staleBucket), Member: strconv.FormatInt(staleBucket, 10)}).Err(); err != nil {
		t.Fatalf("failed to seed stale Redis index: %v", err)
	}
	if err := common.RDB.HSet(ctx, amtKey, strconv.FormatInt(staleBucket, 10), 900).Err(); err != nil {
		t.Fatalf("failed to seed stale Redis amount: %v", err)
	}
	if err := common.RDB.Set(ctx, metaKey, watermark, time.Hour).Err(); err != nil {
		t.Fatalf("failed to seed stale Redis meta: %v", err)
	}

	if _, err := PreConsumeUserSubscription("redis-bucket-stale-empty", userId, "gpt-4", 0, 200, ""); err != nil {
		t.Fatalf("expected stale empty Redis bucket to rebuild and allow consume: %v", err)
	}
	if got := subscriptionRedisBucketAmount(t, sub.Id); got != 200 {
		t.Fatalf("expected Redis bucket amount 200 after stale empty rebuild, got %d", got)
	}
}

func TestSubscriptionRedisBucketFallbackSurvivesRefreshError(t *testing.T) {
	setupTimeQuotaTestDB(t)
	setupRedisIntegrationTest(t)
	t.Setenv("SUBSCRIPTION_WINDOW_COUNTER_BACKEND", "redis_bucket")
	t.Setenv("SUBSCRIPTION_WINDOW_BUCKET_SECONDS", "300")
	t.Setenv("SUBSCRIPTION_WINDOW_REDIS_FALLBACK", "db")

	now := common.GetTimestamp()
	plan := &SubscriptionPlan{
		Title:          "Redis bucket refresh fallback plan",
		DurationUnit:   SubscriptionDurationDay,
		DurationValue:  30,
		TotalAmount:    0,
		WindowLimit5h:  1000,
		WindowLimit24h: 1000,
		WindowLimit7d:  1000,
		WindowLimit30d: 1000,
		ActivationMode: SubscriptionActivationImmediate,
		Enabled:        true,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	if err := DB.Create(plan).Error; err != nil {
		t.Fatalf("failed to create subscription plan: %v", err)
	}
	userId := createTestUser(t, "default", "default")
	if _, err := CreateUserSubscriptionFromPlanTx(DB, userId, plan, "rb-refresh"); err != nil {
		t.Fatalf("failed to create user subscription: %v", err)
	}

	previousRDB := common.RDB
	deadClient := redis.NewClient(&redis.Options{Addr: "127.0.0.1:1", DialTimeout: 50 * time.Millisecond, ReadTimeout: 50 * time.Millisecond, WriteTimeout: 50 * time.Millisecond})
	common.RDB = deadClient
	t.Cleanup(func() {
		_ = deadClient.Close()
		common.RDB = previousRDB
	})

	if _, err := PreConsumeUserSubscription("redis-bucket-refresh-fallback", userId, "gpt-4", 0, 200, ""); err != nil {
		t.Fatalf("expected DB fallback to survive Redis refresh error: %v", err)
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

func subscriptionRedisBucketAmount(t *testing.T, userSubscriptionId int) int64 {
	t.Helper()
	_, amtKey := subscriptionWindowRedisKeys(userSubscriptionId)
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	values, err := common.RDB.HVals(ctx, amtKey).Result()
	if err != nil {
		t.Fatalf("failed to read subscription Redis bucket: %v", err)
	}
	total := int64(0)
	for _, value := range values {
		amount, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			t.Fatalf("failed to parse subscription Redis bucket amount %q: %v", value, err)
		}
		total += amount
	}
	return total
}
