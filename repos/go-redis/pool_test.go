package redis_test

import (
	"context"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8"
)

var _ = Describe("pool", func() {
	var client *redis.Client

	BeforeEach(func() {
		opt := redisOptions()
		opt.MinIdleConns = 0
		opt.MaxConnAge = 0
		opt.IdleTimeout = time.Second
		client = redis.NewClient(opt)
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("respects max size", func() {
		perform(1000, func(id int) {
			val, err := client.Ping(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("PONG"))
		})

		pool := client.Pool()
		Expect(pool.Len()).To(BeNumerically("<=", 10))
		Expect(pool.IdleLen()).To(BeNumerically("<=", 10))
		Expect(pool.Len()).To(Equal(pool.IdleLen()))
	})

	It("respects max size on multi", func() {
		perform(1000, func(id int) {
			var ping *redis.StatusCmd

			err := client.Watch(ctx, func(tx *redis.Tx) error {
				cmds, err := tx.Pipelined(ctx, func(pipe redis.Pipeliner) error {
					ping = pipe.Ping(ctx)
					return nil
				})
				Expect(err).NotTo(HaveOccurred())
				Expect(cmds).To(HaveLen(1))
				return err
			})
			Expect(err).NotTo(HaveOccurred())

			Expect(ping.Err()).NotTo(HaveOccurred())
			Expect(ping.Val()).To(Equal("PONG"))
		})

		pool := client.Pool()
		Expect(pool.Len()).To(BeNumerically("<=", 10))
		Expect(pool.IdleLen()).To(BeNumerically("<=", 10))
		Expect(pool.Len()).To(Equal(pool.IdleLen()))
	})

	It("respects max size on pipelines", func() {
		perform(1000, func(id int) {
			pipe := client.Pipeline()
			ping := pipe.Ping(ctx)
			cmds, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(cmds).To(HaveLen(1))
			Expect(ping.Err()).NotTo(HaveOccurred())
			Expect(ping.Val()).To(Equal("PONG"))
			Expect(pipe.Close()).NotTo(HaveOccurred())
		})

		pool := client.Pool()
		Expect(pool.Len()).To(BeNumerically("<=", 10))
		Expect(pool.IdleLen()).To(BeNumerically("<=", 10))
		Expect(pool.Len()).To(Equal(pool.IdleLen()))
	})

	It("removes broken connections", func() {
		cn, err := client.Pool().Get(context.Background())
		Expect(err).NotTo(HaveOccurred())
		cn.SetNetConn(&badConn{})
		client.Pool().Put(ctx, cn)

		err = client.Ping(ctx).Err()
		Expect(err).To(MatchError("bad connection"))

		val, err := client.Ping(ctx).Result()
		Expect(err).NotTo(HaveOccurred())
		Expect(val).To(Equal("PONG"))

		pool := client.Pool()
		Expect(pool.Len()).To(Equal(1))
		Expect(pool.IdleLen()).To(Equal(1))

		stats := pool.Stats()
		Expect(stats.Hits).To(Equal(uint32(1)))
		Expect(stats.Misses).To(Equal(uint32(2)))
		Expect(stats.Timeouts).To(Equal(uint32(0)))
	})

	It("reuses connections", func() {
		// explain: https://github.com/go-redis/redis/pull/1675
		opt := redisOptions()
		opt.MinIdleConns = 0
		opt.MaxConnAge = 0
		opt.IdleTimeout = 2 * time.Second
		client = redis.NewClient(opt)

		for i := 0; i < 100; i++ {
			val, err := client.Ping(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("PONG"))
		}

		pool := client.Pool()
		Expect(pool.Len()).To(Equal(1))
		Expect(pool.IdleLen()).To(Equal(1))

		stats := pool.Stats()
		Expect(stats.Hits).To(Equal(uint32(99)))
		Expect(stats.Misses).To(Equal(uint32(1)))
		Expect(stats.Timeouts).To(Equal(uint32(0)))
	})

	It("removes idle connections", func() {
		err := client.Ping(ctx).Err()
		Expect(err).NotTo(HaveOccurred())

		stats := client.PoolStats()
		Expect(stats).To(Equal(&redis.PoolStats{
			Hits:       0,
			Misses:     1,
			Timeouts:   0,
			TotalConns: 1,
			IdleConns:  1,
			StaleConns: 0,
		}))

		time.Sleep(2 * time.Second)

		stats = client.PoolStats()
		Expect(stats).To(Equal(&redis.PoolStats{
			Hits:       0,
			Misses:     1,
			Timeouts:   0,
			TotalConns: 0,
			IdleConns:  0,
			StaleConns: 1,
		}))
	})
})
