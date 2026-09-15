//go:build gofuzz
// +build gofuzz

package fuzz

import (
	"context"
	"time"

	"github.com/go-redis/redis/v8"
)

var (
	ctx = context.Background()
	rdb *redis.Client
)

func init() {
	rdb = redis.NewClient(&redis.Options{
		Addr:         ":6379",
		DialTimeout:  10 * time.Second,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		PoolSize:     10,
		PoolTimeout:  10 * time.Second,
	})
}

func Fuzz(data []byte) int {
	arrayLen := len(data)
	if arrayLen < 4 {
		return -1
	}
	maxIter := int(uint(data[0]))
	for i := 0; i < maxIter && i < arrayLen; i++ {
		n := i % arrayLen
		if n == 0 {
			_ = rdb.Set(ctx, string(data[i:]), string(data[i:]), 0).Err()
		} else if n == 1 {
			_, _ = rdb.Get(ctx, string(data[i:])).Result()
		} else if n == 2 {
			_, _ = rdb.Incr(ctx, string(data[i:])).Result()
		} else if n == 3 {
			var cursor uint64
			_, _, _ = rdb.Scan(ctx, cursor, string(data[i:]), 10).Result()
		}
	}
	return 1
}
