package main

import (
	"context"
	"fmt"

	"github.com/go-redis/redis/v8"
)

func main() {
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})
	_ = rdb.FlushDB(ctx).Err()

	for i := 0; i < 10; i++ {
		if err := rdb.PFAdd(ctx, "myset", fmt.Sprint(i)).Err(); err != nil {
			panic(err)
		}
	}

	card, err := rdb.PFCount(ctx, "myset").Result()
	if err != nil {
		panic(err)
	}

	fmt.Println("set cardinality", card)
}
