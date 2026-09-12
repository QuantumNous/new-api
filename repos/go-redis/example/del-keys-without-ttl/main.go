package main

import (
	"context"
	"fmt"
	"sync"

	"github.com/go-redis/redis/v8"
)

func main() {
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})

	ch := make(chan string, 100)
	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		deleted, err := process(ctx, rdb, ch)
		if err != nil {
			panic(err)
		}
		fmt.Println("deleted", deleted, "keys")
	}()

	iter := rdb.Scan(ctx, 0, "", 0).Iterator()
	for iter.Next(ctx) {
		ch <- iter.Val()
	}
	if err := iter.Err(); err != nil {
		panic(err)
	}

	close(ch)
	wg.Wait()
}

func process(ctx context.Context, rdb *redis.Client, in <-chan string) (int, error) {
	var wg sync.WaitGroup

	out := make(chan string, 100)
	defer func() {
		close(out)
		wg.Wait()
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		if err := del(ctx, rdb, out); err != nil {
			panic(err)
		}
	}()

	var deleted int

	keys := make([]string, 0, 100)
	for key := range in {
		keys = append(keys, key)
		if len(keys) < 100 {
			continue
		}

		var err error
		keys, err = checkTTL(ctx, rdb, keys)
		if err != nil {
			return 0, err
		}

		for _, key := range keys {
			out <- key
		}
		deleted += len(keys)

		keys = keys[:0]
	}

	if len(keys) > 0 {
		keys, err := checkTTL(ctx, rdb, keys)
		if err != nil {
			return 0, err
		}

		for _, key := range keys {
			out <- key
		}
		deleted += len(keys)
	}

	return deleted, nil
}

func checkTTL(ctx context.Context, rdb *redis.Client, keys []string) ([]string, error) {
	cmds, err := rdb.Pipelined(ctx, func(pipe redis.Pipeliner) error {
		for _, key := range keys {
			pipe.TTL(ctx, key)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	for i := len(cmds) - 1; i >= 0; i-- {
		d, err := cmds[i].(*redis.DurationCmd).Result()
		if err != nil {
			return nil, err
		}
		if d != -1 {
			keys = append(keys[:i], keys[i+1:]...)
		}
	}

	return keys, nil
}

func del(ctx context.Context, rdb *redis.Client, in <-chan string) error {
	pipe := rdb.Pipeline()

	for key := range in {
		pipe.Del(ctx, key)

		if pipe.Len() < 100 {
			continue
		}

		if _, err := pipe.Exec(ctx); err != nil {
			return err
		}
	}

	if _, err := pipe.Exec(ctx); err != nil {
		return err
	}

	return nil
}
