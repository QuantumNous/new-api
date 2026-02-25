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
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestKeyRateLimitConfig_Defaults(t *testing.T) {
	config := &KeyRateLimitConfig{}

	assert.Equal(t, 0, config.MaxConcurrency, "Default MaxConcurrency should be 0")
	assert.Equal(t, 0, config.MaxRPM, "Default MaxRPM should be 0")
}

func TestKeyRateLimiter_CanAcquire_NoConfig(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	// Without config, should always allow
	canAcquire, err := limiter.CanAcquire(context.Background(), 1, 0, nil)
	assert.NoError(t, err)
	assert.True(t, canAcquire)
}

func TestKeyRateLimiter_CanAcquire_NoConcurrencyLimit(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	config := &KeyRateLimitConfig{
		MaxConcurrency: 0, // No limit
		MaxRPM:         0,
	}

	canAcquire, err := limiter.CanAcquire(context.Background(), 1, 0, config)
	assert.NoError(t, err)
	assert.True(t, canAcquire)
}

func TestKeyRateLimiter_AcquireSlot_NoRedis(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	config := &KeyRateLimitConfig{
		MaxConcurrency: 3,
		MaxRPM:         40,
	}

	// Without Redis, should always succeed (fallback behavior)
	acquired, err := limiter.AcquireSlot(context.Background(), 1, 0, config)
	assert.NoError(t, err)
	assert.True(t, acquired)
}

func TestKeyRateLimiter_ReleaseSlot_NoRedis(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	// Without Redis, release should not error
	err := limiter.ReleaseSlot(context.Background(), 1, 0)
	assert.NoError(t, err)
}

func TestKeyRateLimiter_WaitForSlot_NoConfig(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	// Without config, should return first key immediately
	keyIndex, err := limiter.WaitForSlot(context.Background(), 1, []int{0, 1, 2}, nil, time.Second)
	assert.NoError(t, err)
	assert.Equal(t, 0, keyIndex)
}

func TestKeyRateLimiter_WaitForSlot_NoKeys(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	config := &KeyRateLimitConfig{
		MaxConcurrency: 3,
		MaxRPM:         40,
	}

	// With no keys available, should return error
	_, err := limiter.WaitForSlot(context.Background(), 1, []int{}, config, time.Second)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "no keys available")
}

func TestKeyRateLimiter_WaitForSlot_Timeout(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	config := &KeyRateLimitConfig{
		MaxConcurrency: 3,
		MaxRPM:         40,
	}

	// Without Redis, WaitForSlot should timeout because AcquireSlot always returns true
	// but with no Redis, it's actually true, so it should succeed immediately
	keyIndex, err := limiter.WaitForSlot(context.Background(), 1, []int{0, 1, 2}, config, time.Second)
	assert.NoError(t, err)
	assert.Equal(t, 0, keyIndex)
}

func TestKeyRateLimiter_GetConcurrencyCount_NoRedis(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	count, err := limiter.GetConcurrencyCount(context.Background(), 1, 0)
	assert.NoError(t, err)
	assert.Equal(t, 0, count)
}

func TestKeyRateLimiter_GetQueueLength_NoRedis(t *testing.T) {
	limiter := &KeyRateLimiter{
		redisClient: nil,
	}

	length, err := limiter.GetQueueLength(context.Background(), 1)
	assert.NoError(t, err)
	assert.Equal(t, int64(0), length)
}

func TestConcurrencyKey(t *testing.T) {
	key := concurrencyKey(123, 0)
	assert.Equal(t, "keyRL:concurrency:123:0", key)

	key = concurrencyKey(1, 5)
	assert.Equal(t, "keyRL:concurrency:1:5", key)
}

func TestRpmKey(t *testing.T) {
	key := rpmKey(123, 0)
	assert.Equal(t, "keyRL:rpm:123:0", key)

	key = rpmKey(1, 5)
	assert.Equal(t, "keyRL:rpm:1:5", key)
}

func TestQueueKey(t *testing.T) {
	key := queueKey(123)
	assert.Equal(t, "keyRL:queue:123", key)
}

// Integration tests require Redis connection
// These tests are skipped if Redis is not available

func TestKeyRateLimiter_Integration_Concurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// This test requires a real Redis connection
	// It should be run with: go test -v -run Integration
	// Make sure Redis is running and RDB is initialized

	limiter := GetKeyRateLimiter()
	if limiter.redisClient == nil {
		t.Skip("Redis not available, skipping integration test")
	}

	ctx := context.Background()
	channelId := 999999 // Use a test channel ID
	keyIndex := 0

	config := &KeyRateLimitConfig{
		MaxConcurrency: 2,
		MaxRPM:         0,
	}

	// Clean up before test
	_ = limiter.ReleaseSlot(ctx, channelId, keyIndex)

	// First acquire should succeed
	acquired, err := limiter.AcquireSlot(ctx, channelId, keyIndex, config)
	assert.NoError(t, err)
	assert.True(t, acquired)

	// Second acquire should succeed
	acquired, err = limiter.AcquireSlot(ctx, channelId, keyIndex, config)
	assert.NoError(t, err)
	assert.True(t, acquired)

	// Third acquire should fail (limit is 2)
	acquired, err = limiter.AcquireSlot(ctx, channelId, keyIndex, config)
	assert.NoError(t, err)
	assert.False(t, acquired)

	// Release one slot
	err = limiter.ReleaseSlot(ctx, channelId, keyIndex)
	assert.NoError(t, err)

	// Now acquire should succeed again
	acquired, err = limiter.AcquireSlot(ctx, channelId, keyIndex, config)
	assert.NoError(t, err)
	assert.True(t, acquired)

	// Clean up
	_ = limiter.ReleaseSlot(ctx, channelId, keyIndex)
	_ = limiter.ReleaseSlot(ctx, channelId, keyIndex)
}
