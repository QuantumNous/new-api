package redis_test

import (
	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8"
)

var _ = Describe("UniversalClient", func() {
	var client redis.UniversalClient

	AfterEach(func() {
		if client != nil {
			Expect(client.Close()).To(Succeed())
		}
	})

	It("should connect to failover servers", func() {
		client = redis.NewUniversalClient(&redis.UniversalOptions{
			MasterName: sentinelName,
			Addrs:      sentinelAddrs,
		})
		Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())
	})

	It("should connect to simple servers", func() {
		client = redis.NewUniversalClient(&redis.UniversalOptions{
			Addrs: []string{redisAddr},
		})
		Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())
	})

	It("should connect to clusters", func() {
		client = redis.NewUniversalClient(&redis.UniversalOptions{
			Addrs: cluster.addrs(),
		})
		Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())
	})
})
