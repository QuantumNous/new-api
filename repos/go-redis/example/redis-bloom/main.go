package main

import (
	"context"
	"fmt"
	"math/rand"

	"github.com/go-redis/redis/v8"
)

func main() {
	ctx := context.Background()

	rdb := redis.NewClient(&redis.Options{
		Addr: ":6379",
	})
	_ = rdb.FlushDB(ctx).Err()

	fmt.Printf("# BLOOM\n")
	bloomFilter(ctx, rdb)

	fmt.Printf("\n# CUCKOO\n")
	cuckooFilter(ctx, rdb)

	fmt.Printf("\n# COUNT-MIN\n")
	countMinSketch(ctx, rdb)

	fmt.Printf("\n# TOP-K\n")
	topK(ctx, rdb)
}

func bloomFilter(ctx context.Context, rdb *redis.Client) {
	inserted, err := rdb.Do(ctx, "BF.ADD", "bf_key", "item0").Bool()
	if err != nil {
		panic(err)
	}
	if inserted {
		fmt.Println("item0 was inserted")
	} else {
		fmt.Println("item0 already exists")
	}

	for _, item := range []string{"item0", "item1"} {
		exists, err := rdb.Do(ctx, "BF.EXISTS", "bf_key", item).Bool()
		if err != nil {
			panic(err)
		}
		if exists {
			fmt.Printf("%s does exist\n", item)
		} else {
			fmt.Printf("%s does not exist\n", item)
		}
	}

	bools, err := rdb.Do(ctx, "BF.MADD", "bf_key", "item1", "item2", "item3").BoolSlice()
	if err != nil {
		panic(err)
	}
	fmt.Println("adding multiple items:", bools)
}

func cuckooFilter(ctx context.Context, rdb *redis.Client) {
	inserted, err := rdb.Do(ctx, "CF.ADDNX", "cf_key", "item0").Bool()
	if err != nil {
		panic(err)
	}
	if inserted {
		fmt.Println("item0 was inserted")
	} else {
		fmt.Println("item0 already exists")
	}

	for _, item := range []string{"item0", "item1"} {
		exists, err := rdb.Do(ctx, "CF.EXISTS", "cf_key", item).Bool()
		if err != nil {
			panic(err)
		}
		if exists {
			fmt.Printf("%s does exist\n", item)
		} else {
			fmt.Printf("%s does not exist\n", item)
		}
	}

	deleted, err := rdb.Do(ctx, "CF.DEL", "cf_key", "item0").Bool()
	if err != nil {
		panic(err)
	}
	if deleted {
		fmt.Println("item0 was deleted")
	}
}

func countMinSketch(ctx context.Context, rdb *redis.Client) {
	if err := rdb.Do(ctx, "CMS.INITBYPROB", "count_min", 0.001, 0.01).Err(); err != nil {
		panic(err)
	}

	items := []string{"item1", "item2", "item3", "item4", "item5"}
	counts := make(map[string]int, len(items))

	for i := 0; i < 10000; i++ {
		n := rand.Intn(len(items))
		item := items[n]

		if err := rdb.Do(ctx, "CMS.INCRBY", "count_min", item, 1).Err(); err != nil {
			panic(err)
		}
		counts[item]++
	}

	for item, count := range counts {
		ns, err := rdb.Do(ctx, "CMS.QUERY", "count_min", item).Int64Slice()
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s: count-min=%d actual=%d\n", item, ns[0], count)
	}
}

func topK(ctx context.Context, rdb *redis.Client) {
	if err := rdb.Do(ctx, "TOPK.RESERVE", "top_items", 3).Err(); err != nil {
		panic(err)
	}

	counts := map[string]int{
		"item1": 1000,
		"item2": 2000,
		"item3": 3000,
		"item4": 4000,
		"item5": 5000,
		"item6": 6000,
	}

	for item, count := range counts {
		for i := 0; i < count; i++ {
			if err := rdb.Do(ctx, "TOPK.INCRBY", "top_items", item, 1).Err(); err != nil {
				panic(err)
			}
		}
	}

	items, err := rdb.Do(ctx, "TOPK.LIST", "top_items").StringSlice()
	if err != nil {
		panic(err)
	}

	for _, item := range items {
		ns, err := rdb.Do(ctx, "TOPK.COUNT", "top_items", item).Int64Slice()
		if err != nil {
			panic(err)
		}
		fmt.Printf("%s: top-k=%d actual=%d\n", item, ns[0], counts[item])
	}
}
