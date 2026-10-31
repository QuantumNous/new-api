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

	fmt.Printf("# INCR BY\n")
	for _, change := range []int{+1, +5, 0} {
		num, err := incrBy.Run(ctx, rdb, []string{"my_counter"}, change).Int()
		if err != nil {
			panic(err)
		}
		fmt.Printf("incr by %d: %d\n", change, num)
	}

	fmt.Printf("\n# SUM\n")
	sum, err := sum.Run(ctx, rdb, []string{"my_sum"}, 1, 2, 3).Int()
	if err != nil {
		panic(err)
	}
	fmt.Printf("sum is: %d\n", sum)
}

var incrBy = redis.NewScript(`
local key = KEYS[1]
local change = ARGV[1]

local value = redis.call("GET", key)
if not value then
  value = 0
end

value = value + change
redis.call("SET", key, value)

return value
`)

var sum = redis.NewScript(`
local key = KEYS[1]

local sum = redis.call("GET", key)
if not sum then
  sum = 0
end

local num_arg = #ARGV
for i = 1, num_arg do
  sum = sum + ARGV[i]
end

redis.call("SET", key, sum)

return sum
`)
