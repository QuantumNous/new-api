package redis_test

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8"
	"github.com/go-redis/redis/v8/internal/proto"
)

var _ = Describe("Commands", func() {
	ctx := context.TODO()
	var client *redis.Client

	BeforeEach(func() {
		client = redis.NewClient(redisOptions())
		Expect(client.FlushDB(ctx).Err()).NotTo(HaveOccurred())
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	Describe("server", func() {
		It("should Auth", func() {
			cmds, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Auth(ctx, "password")
				pipe.Auth(ctx, "")
				return nil
			})
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("ERR AUTH"))
			Expect(cmds[0].Err().Error()).To(ContainSubstring("ERR AUTH"))
			Expect(cmds[1].Err().Error()).To(ContainSubstring("ERR AUTH"))

			stats := client.PoolStats()
			Expect(stats.Hits).To(Equal(uint32(1)))
			Expect(stats.Misses).To(Equal(uint32(1)))
			Expect(stats.Timeouts).To(Equal(uint32(0)))
			Expect(stats.TotalConns).To(Equal(uint32(1)))
			Expect(stats.IdleConns).To(Equal(uint32(1)))
		})

		It("should Echo", func() {
			pipe := client.Pipeline()
			echo := pipe.Echo(ctx, "hello")
			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())

			Expect(echo.Err()).NotTo(HaveOccurred())
			Expect(echo.Val()).To(Equal("hello"))
		})

		It("should Ping", func() {
			ping := client.Ping(ctx)
			Expect(ping.Err()).NotTo(HaveOccurred())
			Expect(ping.Val()).To(Equal("PONG"))
		})

		It("should Wait", func() {
			const wait = 3 * time.Second

			// assume testing on single redis instance
			start := time.Now()
			val, err := client.Wait(ctx, 1, wait).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal(int64(0)))
			Expect(time.Now()).To(BeTemporally("~", start.Add(wait), 3*time.Second))
		})

		It("should Select", func() {
			pipe := client.Pipeline()
			sel := pipe.Select(ctx, 1)
			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())

			Expect(sel.Err()).NotTo(HaveOccurred())
			Expect(sel.Val()).To(Equal("OK"))
		})

		It("should SwapDB", func() {
			pipe := client.Pipeline()
			sel := pipe.SwapDB(ctx, 1, 2)
			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())

			Expect(sel.Err()).NotTo(HaveOccurred())
			Expect(sel.Val()).To(Equal("OK"))
		})

		It("should BgRewriteAOF", func() {
			Skip("flaky test")

			val, err := client.BgRewriteAOF(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(ContainSubstring("Background append only file rewriting"))
		})

		It("should BgSave", func() {
			Skip("flaky test")

			// workaround for "ERR Can't BGSAVE while AOF log rewriting is in progress"
			Eventually(func() string {
				return client.BgSave(ctx).Val()
			}, "30s").Should(Equal("Background saving started"))
		})

		It("should ClientKill", func() {
			r := client.ClientKill(ctx, "1.1.1.1:1111")
			Expect(r.Err()).To(MatchError("ERR No such client"))
			Expect(r.Val()).To(Equal(""))
		})

		It("should ClientKillByFilter", func() {
			r := client.ClientKillByFilter(ctx, "TYPE", "test")
			Expect(r.Err()).To(MatchError("ERR Unknown client type 'test'"))
			Expect(r.Val()).To(Equal(int64(0)))
		})

		It("should ClientID", func() {
			err := client.ClientID(ctx).Err()
			Expect(err).NotTo(HaveOccurred())
			Expect(client.ClientID(ctx).Val()).To(BeNumerically(">=", 0))
		})

		It("should ClientUnblock", func() {
			id := client.ClientID(ctx).Val()
			r, err := client.ClientUnblock(ctx, id).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(r).To(Equal(int64(0)))
		})

		It("should ClientUnblockWithError", func() {
			id := client.ClientID(ctx).Val()
			r, err := client.ClientUnblockWithError(ctx, id).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(r).To(Equal(int64(0)))
		})

		It("should ClientPause", func() {
			err := client.ClientPause(ctx, time.Second).Err()
			Expect(err).NotTo(HaveOccurred())

			start := time.Now()
			err = client.Ping(ctx).Err()
			Expect(err).NotTo(HaveOccurred())
			Expect(time.Now()).To(BeTemporally("~", start.Add(time.Second), 800*time.Millisecond))
		})

		It("should ClientSetName and ClientGetName", func() {
			pipe := client.Pipeline()
			set := pipe.ClientSetName(ctx, "theclientname")
			get := pipe.ClientGetName(ctx)
			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())

			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(BeTrue())

			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("theclientname"))
		})

		It("should ConfigGet", func() {
			val, err := client.ConfigGet(ctx, "*").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).NotTo(BeEmpty())
		})

		It("should ConfigResetStat", func() {
			r := client.ConfigResetStat(ctx)
			Expect(r.Err()).NotTo(HaveOccurred())
			Expect(r.Val()).To(Equal("OK"))
		})

		It("should ConfigSet", func() {
			configGet := client.ConfigGet(ctx, "maxmemory")
			Expect(configGet.Err()).NotTo(HaveOccurred())
			Expect(configGet.Val()).To(HaveLen(2))
			Expect(configGet.Val()[0]).To(Equal("maxmemory"))

			configSet := client.ConfigSet(ctx, "maxmemory", configGet.Val()[1].(string))
			Expect(configSet.Err()).NotTo(HaveOccurred())
			Expect(configSet.Val()).To(Equal("OK"))
		})

		It("should ConfigRewrite", func() {
			configRewrite := client.ConfigRewrite(ctx)
			Expect(configRewrite.Err()).NotTo(HaveOccurred())
			Expect(configRewrite.Val()).To(Equal("OK"))
		})

		It("should DBSize", func() {
			size, err := client.DBSize(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(0)))
		})

		It("should Info", func() {
			info := client.Info(ctx)
			Expect(info.Err()).NotTo(HaveOccurred())
			Expect(info.Val()).NotTo(Equal(""))
		})

		It("should Info cpu", func() {
			info := client.Info(ctx, "cpu")
			Expect(info.Err()).NotTo(HaveOccurred())
			Expect(info.Val()).NotTo(Equal(""))
			Expect(info.Val()).To(ContainSubstring(`used_cpu_sys`))
		})

		It("should LastSave", func() {
			lastSave := client.LastSave(ctx)
			Expect(lastSave.Err()).NotTo(HaveOccurred())
			Expect(lastSave.Val()).NotTo(Equal(0))
		})

		It("should Save", func() {
			// workaround for "ERR Background save already in progress"
			Eventually(func() string {
				return client.Save(ctx).Val()
			}, "10s").Should(Equal("OK"))
		})

		It("should SlaveOf", func() {
			slaveOf := client.SlaveOf(ctx, "localhost", "8888")
			Expect(slaveOf.Err()).NotTo(HaveOccurred())
			Expect(slaveOf.Val()).To(Equal("OK"))

			slaveOf = client.SlaveOf(ctx, "NO", "ONE")
			Expect(slaveOf.Err()).NotTo(HaveOccurred())
			Expect(slaveOf.Val()).To(Equal("OK"))
		})

		It("should Time", func() {
			tm, err := client.Time(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(tm).To(BeTemporally("~", time.Now(), 3*time.Second))
		})

		It("should Command", func() {
			cmds, err := client.Command(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(cmds)).To(BeNumerically("~", 200, 25))

			cmd := cmds["mget"]
			Expect(cmd.Name).To(Equal("mget"))
			Expect(cmd.Arity).To(Equal(int8(-2)))
			Expect(cmd.Flags).To(ContainElement("readonly"))
			Expect(cmd.FirstKeyPos).To(Equal(int8(1)))
			Expect(cmd.LastKeyPos).To(Equal(int8(-1)))
			Expect(cmd.StepCount).To(Equal(int8(1)))

			cmd = cmds["ping"]
			Expect(cmd.Name).To(Equal("ping"))
			Expect(cmd.Arity).To(Equal(int8(-1)))
			Expect(cmd.Flags).To(ContainElement("stale"))
			Expect(cmd.Flags).To(ContainElement("fast"))
			Expect(cmd.FirstKeyPos).To(Equal(int8(0)))
			Expect(cmd.LastKeyPos).To(Equal(int8(0)))
			Expect(cmd.StepCount).To(Equal(int8(0)))
		})
	})

	Describe("debugging", func() {
		It("should DebugObject", func() {
			err := client.DebugObject(ctx, "foo").Err()
			Expect(err).To(MatchError("ERR no such key"))

			err = client.Set(ctx, "foo", "bar", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			s, err := client.DebugObject(ctx, "foo").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(s).To(ContainSubstring("serializedlength:4"))
		})

		It("should MemoryUsage", func() {
			err := client.MemoryUsage(ctx, "foo").Err()
			Expect(err).To(Equal(redis.Nil))

			err = client.Set(ctx, "foo", "bar", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.MemoryUsage(ctx, "foo").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).NotTo(BeZero())

			n, err = client.MemoryUsage(ctx, "foo", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).NotTo(BeZero())
		})
	})

	Describe("keys", func() {
		It("should Del", func() {
			err := client.Set(ctx, "key1", "Hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.Set(ctx, "key2", "World", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.Del(ctx, "key1", "key2", "key3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))
		})

		It("should Unlink", func() {
			err := client.Set(ctx, "key1", "Hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.Set(ctx, "key2", "World", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.Unlink(ctx, "key1", "key2", "key3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))
		})

		It("should Dump", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			dump := client.Dump(ctx, "key")
			Expect(dump.Err()).NotTo(HaveOccurred())
			Expect(dump.Val()).NotTo(BeEmpty())
		})

		It("should Exists", func() {
			set := client.Set(ctx, "key1", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			n, err := client.Exists(ctx, "key1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(1)))

			n, err = client.Exists(ctx, "key2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))

			n, err = client.Exists(ctx, "key1", "key2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(1)))

			n, err = client.Exists(ctx, "key1", "key1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))
		})

		It("should Expire", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expire := client.Expire(ctx, "key", 10*time.Second)
			Expect(expire.Err()).NotTo(HaveOccurred())
			Expect(expire.Val()).To(Equal(true))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(10 * time.Second))

			set = client.Set(ctx, "key", "Hello World", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			ttl = client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(time.Duration(-1)))

			ttl = client.TTL(ctx, "nonexistent_key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(time.Duration(-2)))
		})

		It("should ExpireAt", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			n, err := client.Exists(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(1)))

			expireAt := client.ExpireAt(ctx, "key", time.Now().Add(-time.Hour))
			Expect(expireAt.Err()).NotTo(HaveOccurred())
			Expect(expireAt.Val()).To(Equal(true))

			n, err = client.Exists(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))
		})

		It("should Keys", func() {
			mset := client.MSet(ctx, "one", "1", "two", "2", "three", "3", "four", "4")
			Expect(mset.Err()).NotTo(HaveOccurred())
			Expect(mset.Val()).To(Equal("OK"))

			keys := client.Keys(ctx, "*o*")
			Expect(keys.Err()).NotTo(HaveOccurred())
			Expect(keys.Val()).To(ConsistOf([]string{"four", "one", "two"}))

			keys = client.Keys(ctx, "t??")
			Expect(keys.Err()).NotTo(HaveOccurred())
			Expect(keys.Val()).To(Equal([]string{"two"}))

			keys = client.Keys(ctx, "*")
			Expect(keys.Err()).NotTo(HaveOccurred())
			Expect(keys.Val()).To(ConsistOf([]string{"four", "one", "three", "two"}))
		})

		It("should Migrate", func() {
			migrate := client.Migrate(ctx, "localhost", redisSecondaryPort, "key", 0, 0)
			Expect(migrate.Err()).NotTo(HaveOccurred())
			Expect(migrate.Val()).To(Equal("NOKEY"))

			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			migrate = client.Migrate(ctx, "localhost", redisSecondaryPort, "key", 0, 0)
			Expect(migrate.Err()).To(MatchError("IOERR error or timeout writing to target instance"))
			Expect(migrate.Val()).To(Equal(""))
		})

		It("should Move", func() {
			move := client.Move(ctx, "key", 2)
			Expect(move.Err()).NotTo(HaveOccurred())
			Expect(move.Val()).To(Equal(false))

			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			move = client.Move(ctx, "key", 2)
			Expect(move.Err()).NotTo(HaveOccurred())
			Expect(move.Val()).To(Equal(true))

			get := client.Get(ctx, "key")
			Expect(get.Err()).To(Equal(redis.Nil))
			Expect(get.Val()).To(Equal(""))

			pipe := client.Pipeline()
			pipe.Select(ctx, 2)
			get = pipe.Get(ctx, "key")
			pipe.FlushDB(ctx)

			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should Object", func() {
			start := time.Now()
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			refCount := client.ObjectRefCount(ctx, "key")
			Expect(refCount.Err()).NotTo(HaveOccurred())
			Expect(refCount.Val()).To(Equal(int64(1)))

			err := client.ObjectEncoding(ctx, "key").Err()
			Expect(err).NotTo(HaveOccurred())

			idleTime := client.ObjectIdleTime(ctx, "key")
			Expect(idleTime.Err()).NotTo(HaveOccurred())

			// Redis returned milliseconds/1000, which may cause ObjectIdleTime to be at a critical value,
			// should be +1s to deal with the critical value problem.
			// if too much time (>1s) is used during command execution, it may also cause the test to fail.
			// so the ObjectIdleTime result should be <=now-start+1s
			// link: https://github.com/redis/redis/blob/5b48d900498c85bbf4772c1d466c214439888115/src/object.c#L1265-L1272
			Expect(idleTime.Val()).To(BeNumerically("<=", time.Now().Sub(start)+time.Second))
		})

		It("should Persist", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expire := client.Expire(ctx, "key", 10*time.Second)
			Expect(expire.Err()).NotTo(HaveOccurred())
			Expect(expire.Val()).To(Equal(true))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(10 * time.Second))

			persist := client.Persist(ctx, "key")
			Expect(persist.Err()).NotTo(HaveOccurred())
			Expect(persist.Val()).To(Equal(true))

			ttl = client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val() < 0).To(Equal(true))
		})

		It("should PExpire", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expiration := 900 * time.Millisecond
			pexpire := client.PExpire(ctx, "key", expiration)
			Expect(pexpire.Err()).NotTo(HaveOccurred())
			Expect(pexpire.Val()).To(Equal(true))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(time.Second))

			pttl := client.PTTL(ctx, "key")
			Expect(pttl.Err()).NotTo(HaveOccurred())
			Expect(pttl.Val()).To(BeNumerically("~", expiration, 100*time.Millisecond))
		})

		It("should PExpireAt", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expiration := 900 * time.Millisecond
			pexpireat := client.PExpireAt(ctx, "key", time.Now().Add(expiration))
			Expect(pexpireat.Err()).NotTo(HaveOccurred())
			Expect(pexpireat.Val()).To(Equal(true))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(time.Second))

			pttl := client.PTTL(ctx, "key")
			Expect(pttl.Err()).NotTo(HaveOccurred())
			Expect(pttl.Val()).To(BeNumerically("~", expiration, 100*time.Millisecond))
		})

		It("should PTTL", func() {
			set := client.Set(ctx, "key", "Hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expiration := time.Second
			expire := client.Expire(ctx, "key", expiration)
			Expect(expire.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			pttl := client.PTTL(ctx, "key")
			Expect(pttl.Err()).NotTo(HaveOccurred())
			Expect(pttl.Val()).To(BeNumerically("~", expiration, 100*time.Millisecond))
		})

		It("should RandomKey", func() {
			randomKey := client.RandomKey(ctx)
			Expect(randomKey.Err()).To(Equal(redis.Nil))
			Expect(randomKey.Val()).To(Equal(""))

			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			randomKey = client.RandomKey(ctx)
			Expect(randomKey.Err()).NotTo(HaveOccurred())
			Expect(randomKey.Val()).To(Equal("key"))
		})

		It("should Rename", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			status := client.Rename(ctx, "key", "key1")
			Expect(status.Err()).NotTo(HaveOccurred())
			Expect(status.Val()).To(Equal("OK"))

			get := client.Get(ctx, "key1")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should RenameNX", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			renameNX := client.RenameNX(ctx, "key", "key1")
			Expect(renameNX.Err()).NotTo(HaveOccurred())
			Expect(renameNX.Val()).To(Equal(true))

			get := client.Get(ctx, "key1")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should Restore", func() {
			err := client.Set(ctx, "key", "hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			dump := client.Dump(ctx, "key")
			Expect(dump.Err()).NotTo(HaveOccurred())

			err = client.Del(ctx, "key").Err()
			Expect(err).NotTo(HaveOccurred())

			restore, err := client.Restore(ctx, "key", 0, dump.Val()).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(restore).To(Equal("OK"))

			type_, err := client.Type(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(type_).To(Equal("string"))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))
		})

		It("should RestoreReplace", func() {
			err := client.Set(ctx, "key", "hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			dump := client.Dump(ctx, "key")
			Expect(dump.Err()).NotTo(HaveOccurred())

			restore, err := client.RestoreReplace(ctx, "key", 0, dump.Val()).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(restore).To(Equal("OK"))

			type_, err := client.Type(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(type_).To(Equal("string"))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))
		})

		It("should Sort", func() {
			size, err := client.LPush(ctx, "list", "1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(1)))

			size, err = client.LPush(ctx, "list", "3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(2)))

			size, err = client.LPush(ctx, "list", "2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(3)))

			els, err := client.Sort(ctx, "list", &redis.Sort{
				Offset: 0,
				Count:  2,
				Order:  "ASC",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(els).To(Equal([]string{"1", "2"}))
		})

		It("should Sort and Get", func() {
			size, err := client.LPush(ctx, "list", "1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(1)))

			size, err = client.LPush(ctx, "list", "3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(2)))

			size, err = client.LPush(ctx, "list", "2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(3)))

			err = client.Set(ctx, "object_2", "value2", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			{
				els, err := client.Sort(ctx, "list", &redis.Sort{
					Get: []string{"object_*"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(els).To(Equal([]string{"", "value2", ""}))
			}

			{
				els, err := client.SortInterfaces(ctx, "list", &redis.Sort{
					Get: []string{"object_*"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(els).To(Equal([]interface{}{nil, "value2", nil}))
			}
		})

		It("should Sort and Store", func() {
			size, err := client.LPush(ctx, "list", "1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(1)))

			size, err = client.LPush(ctx, "list", "3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(2)))

			size, err = client.LPush(ctx, "list", "2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(3)))

			n, err := client.SortStore(ctx, "list", "list2", &redis.Sort{
				Offset: 0,
				Count:  2,
				Order:  "ASC",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))

			els, err := client.LRange(ctx, "list2", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(els).To(Equal([]string{"1", "2"}))
		})

		It("should Touch", func() {
			set1 := client.Set(ctx, "touch1", "hello", 0)
			Expect(set1.Err()).NotTo(HaveOccurred())
			Expect(set1.Val()).To(Equal("OK"))

			set2 := client.Set(ctx, "touch2", "hello", 0)
			Expect(set2.Err()).NotTo(HaveOccurred())
			Expect(set2.Val()).To(Equal("OK"))

			touch := client.Touch(ctx, "touch1", "touch2", "touch3")
			Expect(touch.Err()).NotTo(HaveOccurred())
			Expect(touch.Val()).To(Equal(int64(2)))
		})

		It("should TTL", func() {
			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val() < 0).To(Equal(true))

			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			expire := client.Expire(ctx, "key", 60*time.Second)
			Expect(expire.Err()).NotTo(HaveOccurred())
			Expect(expire.Val()).To(Equal(true))

			ttl = client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(Equal(60 * time.Second))
		})

		It("should Type", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			type_ := client.Type(ctx, "key")
			Expect(type_.Err()).NotTo(HaveOccurred())
			Expect(type_.Val()).To(Equal("string"))
		})
	})

	Describe("scanning", func() {
		It("should Scan", func() {
			for i := 0; i < 1000; i++ {
				set := client.Set(ctx, fmt.Sprintf("key%d", i), "hello", 0)
				Expect(set.Err()).NotTo(HaveOccurred())
			}

			keys, cursor, err := client.Scan(ctx, 0, "", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).NotTo(BeEmpty())
			Expect(cursor).NotTo(BeZero())
		})

		It("should ScanType", func() {
			for i := 0; i < 1000; i++ {
				set := client.Set(ctx, fmt.Sprintf("key%d", i), "hello", 0)
				Expect(set.Err()).NotTo(HaveOccurred())
			}

			keys, cursor, err := client.ScanType(ctx, 0, "", 0, "string").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).NotTo(BeEmpty())
			Expect(cursor).NotTo(BeZero())
		})

		It("should SScan", func() {
			for i := 0; i < 1000; i++ {
				sadd := client.SAdd(ctx, "myset", fmt.Sprintf("member%d", i))
				Expect(sadd.Err()).NotTo(HaveOccurred())
			}

			keys, cursor, err := client.SScan(ctx, "myset", 0, "", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).NotTo(BeEmpty())
			Expect(cursor).NotTo(BeZero())
		})

		It("should HScan", func() {
			for i := 0; i < 1000; i++ {
				sadd := client.HSet(ctx, "myhash", fmt.Sprintf("key%d", i), "hello")
				Expect(sadd.Err()).NotTo(HaveOccurred())
			}

			keys, cursor, err := client.HScan(ctx, "myhash", 0, "", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).NotTo(BeEmpty())
			Expect(cursor).NotTo(BeZero())
		})

		It("should ZScan", func() {
			for i := 0; i < 1000; i++ {
				err := client.ZAdd(ctx, "myset", &redis.Z{
					Score:  float64(i),
					Member: fmt.Sprintf("member%d", i),
				}).Err()
				Expect(err).NotTo(HaveOccurred())
			}

			keys, cursor, err := client.ZScan(ctx, "myset", 0, "", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).NotTo(BeEmpty())
			Expect(cursor).NotTo(BeZero())
		})
	})

	Describe("strings", func() {
		It("should Append", func() {
			n, err := client.Exists(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))

			append := client.Append(ctx, "key", "Hello")
			Expect(append.Err()).NotTo(HaveOccurred())
			Expect(append.Val()).To(Equal(int64(5)))

			append = client.Append(ctx, "key", " World")
			Expect(append.Err()).NotTo(HaveOccurred())
			Expect(append.Val()).To(Equal(int64(11)))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("Hello World"))
		})

		It("should BitCount", func() {
			set := client.Set(ctx, "key", "foobar", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			bitCount := client.BitCount(ctx, "key", nil)
			Expect(bitCount.Err()).NotTo(HaveOccurred())
			Expect(bitCount.Val()).To(Equal(int64(26)))

			bitCount = client.BitCount(ctx, "key", &redis.BitCount{
				Start: 0,
				End:   0,
			})
			Expect(bitCount.Err()).NotTo(HaveOccurred())
			Expect(bitCount.Val()).To(Equal(int64(4)))

			bitCount = client.BitCount(ctx, "key", &redis.BitCount{
				Start: 1,
				End:   1,
			})
			Expect(bitCount.Err()).NotTo(HaveOccurred())
			Expect(bitCount.Val()).To(Equal(int64(6)))
		})

		It("should BitOpAnd", func() {
			set := client.Set(ctx, "key1", "1", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			set = client.Set(ctx, "key2", "0", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			bitOpAnd := client.BitOpAnd(ctx, "dest", "key1", "key2")
			Expect(bitOpAnd.Err()).NotTo(HaveOccurred())
			Expect(bitOpAnd.Val()).To(Equal(int64(1)))

			get := client.Get(ctx, "dest")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("0"))
		})

		It("should BitOpOr", func() {
			set := client.Set(ctx, "key1", "1", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			set = client.Set(ctx, "key2", "0", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			bitOpOr := client.BitOpOr(ctx, "dest", "key1", "key2")
			Expect(bitOpOr.Err()).NotTo(HaveOccurred())
			Expect(bitOpOr.Val()).To(Equal(int64(1)))

			get := client.Get(ctx, "dest")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("1"))
		})

		It("should BitOpXor", func() {
			set := client.Set(ctx, "key1", "\xff", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			set = client.Set(ctx, "key2", "\x0f", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			bitOpXor := client.BitOpXor(ctx, "dest", "key1", "key2")
			Expect(bitOpXor.Err()).NotTo(HaveOccurred())
			Expect(bitOpXor.Val()).To(Equal(int64(1)))

			get := client.Get(ctx, "dest")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("\xf0"))
		})

		It("should BitOpNot", func() {
			set := client.Set(ctx, "key1", "\x00", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			bitOpNot := client.BitOpNot(ctx, "dest", "key1")
			Expect(bitOpNot.Err()).NotTo(HaveOccurred())
			Expect(bitOpNot.Val()).To(Equal(int64(1)))

			get := client.Get(ctx, "dest")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("\xff"))
		})

		It("should BitPos", func() {
			err := client.Set(ctx, "mykey", "\xff\xf0\x00", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			pos, err := client.BitPos(ctx, "mykey", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(12)))

			pos, err = client.BitPos(ctx, "mykey", 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(0)))

			pos, err = client.BitPos(ctx, "mykey", 0, 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(16)))

			pos, err = client.BitPos(ctx, "mykey", 1, 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(-1)))

			pos, err = client.BitPos(ctx, "mykey", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(16)))

			pos, err = client.BitPos(ctx, "mykey", 1, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(-1)))

			pos, err = client.BitPos(ctx, "mykey", 0, 2, 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(-1)))

			pos, err = client.BitPos(ctx, "mykey", 0, 0, -3).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(-1)))

			pos, err = client.BitPos(ctx, "mykey", 0, 0, 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(Equal(int64(-1)))
		})

		It("should BitField", func() {
			nn, err := client.BitField(ctx, "mykey", "INCRBY", "i5", 100, 1, "GET", "u4", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(nn).To(Equal([]int64{1, 0}))
		})

		It("should Decr", func() {
			set := client.Set(ctx, "key", "10", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			decr := client.Decr(ctx, "key")
			Expect(decr.Err()).NotTo(HaveOccurred())
			Expect(decr.Val()).To(Equal(int64(9)))

			set = client.Set(ctx, "key", "234293482390480948029348230948", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			decr = client.Decr(ctx, "key")
			Expect(decr.Err()).To(MatchError("ERR value is not an integer or out of range"))
			Expect(decr.Val()).To(Equal(int64(0)))
		})

		It("should DecrBy", func() {
			set := client.Set(ctx, "key", "10", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			decrBy := client.DecrBy(ctx, "key", 5)
			Expect(decrBy.Err()).NotTo(HaveOccurred())
			Expect(decrBy.Val()).To(Equal(int64(5)))
		})

		It("should Get", func() {
			get := client.Get(ctx, "_")
			Expect(get.Err()).To(Equal(redis.Nil))
			Expect(get.Val()).To(Equal(""))

			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			get = client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should GetBit", func() {
			setBit := client.SetBit(ctx, "key", 7, 1)
			Expect(setBit.Err()).NotTo(HaveOccurred())
			Expect(setBit.Val()).To(Equal(int64(0)))

			getBit := client.GetBit(ctx, "key", 0)
			Expect(getBit.Err()).NotTo(HaveOccurred())
			Expect(getBit.Val()).To(Equal(int64(0)))

			getBit = client.GetBit(ctx, "key", 7)
			Expect(getBit.Err()).NotTo(HaveOccurred())
			Expect(getBit.Val()).To(Equal(int64(1)))

			getBit = client.GetBit(ctx, "key", 100)
			Expect(getBit.Err()).NotTo(HaveOccurred())
			Expect(getBit.Val()).To(Equal(int64(0)))
		})

		It("should GetRange", func() {
			set := client.Set(ctx, "key", "This is a string", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			getRange := client.GetRange(ctx, "key", 0, 3)
			Expect(getRange.Err()).NotTo(HaveOccurred())
			Expect(getRange.Val()).To(Equal("This"))

			getRange = client.GetRange(ctx, "key", -3, -1)
			Expect(getRange.Err()).NotTo(HaveOccurred())
			Expect(getRange.Val()).To(Equal("ing"))

			getRange = client.GetRange(ctx, "key", 0, -1)
			Expect(getRange.Err()).NotTo(HaveOccurred())
			Expect(getRange.Val()).To(Equal("This is a string"))

			getRange = client.GetRange(ctx, "key", 10, 100)
			Expect(getRange.Err()).NotTo(HaveOccurred())
			Expect(getRange.Val()).To(Equal("string"))
		})

		It("should GetSet", func() {
			incr := client.Incr(ctx, "key")
			Expect(incr.Err()).NotTo(HaveOccurred())
			Expect(incr.Val()).To(Equal(int64(1)))

			getSet := client.GetSet(ctx, "key", "0")
			Expect(getSet.Err()).NotTo(HaveOccurred())
			Expect(getSet.Val()).To(Equal("1"))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("0"))
		})

		It("should GetEX", func() {
			set := client.Set(ctx, "key", "value", 100*time.Second)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(BeNumerically("~", 100*time.Second, 3*time.Second))

			getEX := client.GetEx(ctx, "key", 200*time.Second)
			Expect(getEX.Err()).NotTo(HaveOccurred())
			Expect(getEX.Val()).To(Equal("value"))

			ttl = client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).To(BeNumerically("~", 200*time.Second, 3*time.Second))
		})

		It("should GetDel", func() {
			set := client.Set(ctx, "key", "value", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			getDel := client.GetDel(ctx, "key")
			Expect(getDel.Err()).NotTo(HaveOccurred())
			Expect(getDel.Val()).To(Equal("value"))

			get := client.Get(ctx, "key")
			Expect(get.Err()).To(Equal(redis.Nil))
		})

		It("should Incr", func() {
			set := client.Set(ctx, "key", "10", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			incr := client.Incr(ctx, "key")
			Expect(incr.Err()).NotTo(HaveOccurred())
			Expect(incr.Val()).To(Equal(int64(11)))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("11"))
		})

		It("should IncrBy", func() {
			set := client.Set(ctx, "key", "10", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			incrBy := client.IncrBy(ctx, "key", 5)
			Expect(incrBy.Err()).NotTo(HaveOccurred())
			Expect(incrBy.Val()).To(Equal(int64(15)))
		})

		It("should IncrByFloat", func() {
			set := client.Set(ctx, "key", "10.50", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			incrByFloat := client.IncrByFloat(ctx, "key", 0.1)
			Expect(incrByFloat.Err()).NotTo(HaveOccurred())
			Expect(incrByFloat.Val()).To(Equal(10.6))

			set = client.Set(ctx, "key", "5.0e3", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			incrByFloat = client.IncrByFloat(ctx, "key", 2.0e2)
			Expect(incrByFloat.Err()).NotTo(HaveOccurred())
			Expect(incrByFloat.Val()).To(Equal(float64(5200)))
		})

		It("should IncrByFloatOverflow", func() {
			incrByFloat := client.IncrByFloat(ctx, "key", 996945661)
			Expect(incrByFloat.Err()).NotTo(HaveOccurred())
			Expect(incrByFloat.Val()).To(Equal(float64(996945661)))
		})

		It("should MSetMGet", func() {
			mSet := client.MSet(ctx, "key1", "hello1", "key2", "hello2")
			Expect(mSet.Err()).NotTo(HaveOccurred())
			Expect(mSet.Val()).To(Equal("OK"))

			mGet := client.MGet(ctx, "key1", "key2", "_")
			Expect(mGet.Err()).NotTo(HaveOccurred())
			Expect(mGet.Val()).To(Equal([]interface{}{"hello1", "hello2", nil}))
		})

		It("should scan Mget", func() {
			err := client.MSet(ctx, "key1", "hello1", "key2", 123).Err()
			Expect(err).NotTo(HaveOccurred())

			res := client.MGet(ctx, "key1", "key2", "_")
			Expect(res.Err()).NotTo(HaveOccurred())

			type data struct {
				Key1 string `redis:"key1"`
				Key2 int    `redis:"key2"`
			}
			var d data
			Expect(res.Scan(&d)).NotTo(HaveOccurred())
			Expect(d).To(Equal(data{Key1: "hello1", Key2: 123}))
		})

		It("should MSetNX", func() {
			mSetNX := client.MSetNX(ctx, "key1", "hello1", "key2", "hello2")
			Expect(mSetNX.Err()).NotTo(HaveOccurred())
			Expect(mSetNX.Val()).To(Equal(true))

			mSetNX = client.MSetNX(ctx, "key2", "hello1", "key3", "hello2")
			Expect(mSetNX.Err()).NotTo(HaveOccurred())
			Expect(mSetNX.Val()).To(Equal(false))
		})

		It("should SetWithArgs with TTL", func() {
			args := redis.SetArgs{
				TTL: 500 * time.Millisecond,
			}
			err := client.SetArgs(ctx, "key", "hello", args).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))

			Eventually(func() error {
				return client.Get(ctx, "key").Err()
			}, "2s", "100ms").Should(Equal(redis.Nil))
		})

		It("should SetWithArgs with expiration date", func() {
			expireAt := time.Now().AddDate(1, 1, 1)
			args := redis.SetArgs{
				ExpireAt: expireAt,
			}
			err := client.SetArgs(ctx, "key", "hello", args).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))

			// check the key has an expiration date
			// (so a TTL value different of -1)
			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val()).ToNot(Equal(-1))
		})

		It("should SetWithArgs with negative expiration date", func() {
			args := redis.SetArgs{
				ExpireAt: time.Now().AddDate(-3, 1, 1),
			}
			// redis accepts a timestamp less than the current date
			// but returns nil when trying to get the key
			err := client.SetArgs(ctx, "key", "hello", args).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.Get(ctx, "key").Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with keepttl", func() {
			// Set with ttl
			argsWithTTL := redis.SetArgs{
				TTL: 5 * time.Second,
			}
			set := client.SetArgs(ctx, "key", "hello", argsWithTTL)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Result()).To(Equal("OK"))

			// Set with keepttl
			argsWithKeepTTL := redis.SetArgs{
				KeepTTL: true,
			}
			set = client.SetArgs(ctx, "key", "hello", argsWithKeepTTL)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Result()).To(Equal("OK"))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			// set keepttl will Retain the ttl associated with the key
			Expect(ttl.Val().Nanoseconds()).NotTo(Equal(-1))
		})

		It("should SetWithArgs with NX mode and key exists", func() {
			err := client.Set(ctx, "key", "hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			args := redis.SetArgs{
				Mode: "nx",
			}
			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with NX mode and key does not exist", func() {
			args := redis.SetArgs{
				Mode: "nx",
			}
			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("OK"))
		})

		It("should SetWithArgs with NX mode and GET option", func() {
			args := redis.SetArgs{
				Mode: "nx",
				Get:  true,
			}
			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).To(Equal(proto.RedisError("ERR syntax error")))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with expiration, NX mode, and key does not exist", func() {
			args := redis.SetArgs{
				TTL:  500 * time.Millisecond,
				Mode: "nx",
			}
			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("OK"))

			Eventually(func() error {
				return client.Get(ctx, "key").Err()
			}, "1s", "100ms").Should(Equal(redis.Nil))
		})

		It("should SetWithArgs with expiration, NX mode, and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0)
			Expect(e.Err()).NotTo(HaveOccurred())

			args := redis.SetArgs{
				TTL:  500 * time.Millisecond,
				Mode: "nx",
			}
			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with expiration, NX mode, and GET option", func() {
			args := redis.SetArgs{
				TTL:  500 * time.Millisecond,
				Mode: "nx",
				Get:  true,
			}
			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).To(Equal(proto.RedisError("ERR syntax error")))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with XX mode and key does not exist", func() {
			args := redis.SetArgs{
				Mode: "xx",
			}
			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with XX mode and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0).Err()
			Expect(e).NotTo(HaveOccurred())

			args := redis.SetArgs{
				Mode: "xx",
			}
			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("OK"))
		})

		It("should SetWithArgs with XX mode and GET option, and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0).Err()
			Expect(e).NotTo(HaveOccurred())

			args := redis.SetArgs{
				Mode: "xx",
				Get:  true,
			}
			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))
		})

		It("should SetWithArgs with XX mode and GET option, and key does not exist", func() {
			args := redis.SetArgs{
				Mode: "xx",
				Get:  true,
			}

			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with expiration, XX mode, GET option, and key does not exist", func() {
			args := redis.SetArgs{
				TTL:  500 * time.Millisecond,
				Mode: "xx",
				Get:  true,
			}

			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with expiration, XX mode, GET option, and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0)
			Expect(e.Err()).NotTo(HaveOccurred())

			args := redis.SetArgs{
				TTL:  500 * time.Millisecond,
				Mode: "xx",
				Get:  true,
			}

			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))

			Eventually(func() error {
				return client.Get(ctx, "key").Err()
			}, "1s", "100ms").Should(Equal(redis.Nil))
		})

		It("should SetWithArgs with Get and key does not exist yet", func() {
			args := redis.SetArgs{
				Get: true,
			}

			val, err := client.SetArgs(ctx, "key", "hello", args).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(Equal(""))
		})

		It("should SetWithArgs with Get and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0)
			Expect(e.Err()).NotTo(HaveOccurred())

			args := redis.SetArgs{
				Get: true,
			}

			val, err := client.SetArgs(ctx, "key", "world", args).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))
		})

		It("should Pipelined SetArgs with Get and key exists", func() {
			e := client.Set(ctx, "key", "hello", 0)
			Expect(e.Err()).NotTo(HaveOccurred())

			args := redis.SetArgs{
				Get: true,
			}

			pipe := client.Pipeline()
			setArgs := pipe.SetArgs(ctx, "key", "world", args)
			_, err := pipe.Exec(ctx)
			Expect(err).NotTo(HaveOccurred())

			Expect(setArgs.Err()).NotTo(HaveOccurred())
			Expect(setArgs.Val()).To(Equal("hello"))
		})

		It("should Set with expiration", func() {
			err := client.Set(ctx, "key", "hello", 100*time.Millisecond).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))

			Eventually(func() error {
				return client.Get(ctx, "key").Err()
			}, "1s", "100ms").Should(Equal(redis.Nil))
		})

		It("should Set with keepttl", func() {
			// set with ttl
			set := client.Set(ctx, "key", "hello", 5*time.Second)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			// set with keepttl
			set = client.Set(ctx, "key", "hello1", redis.KeepTTL)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			// set keepttl will Retain the ttl associated with the key
			Expect(ttl.Val().Nanoseconds()).NotTo(Equal(-1))
		})

		It("should SetGet", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should SetEX", func() {
			err := client.SetEX(ctx, "key", "hello", 1*time.Second).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))

			Eventually(func() error {
				return client.Get(ctx, "foo").Err()
			}, "2s", "100ms").Should(Equal(redis.Nil))
		})

		It("should SetNX", func() {
			setNX := client.SetNX(ctx, "key", "hello", 0)
			Expect(setNX.Err()).NotTo(HaveOccurred())
			Expect(setNX.Val()).To(Equal(true))

			setNX = client.SetNX(ctx, "key", "hello2", 0)
			Expect(setNX.Err()).NotTo(HaveOccurred())
			Expect(setNX.Val()).To(Equal(false))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("hello"))
		})

		It("should SetNX with expiration", func() {
			isSet, err := client.SetNX(ctx, "key", "hello", time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			isSet, err = client.SetNX(ctx, "key", "hello2", time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(false))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello"))
		})

		It("should SetNX with keepttl", func() {
			isSet, err := client.SetNX(ctx, "key", "hello1", redis.KeepTTL).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			ttl := client.TTL(ctx, "key")
			Expect(ttl.Err()).NotTo(HaveOccurred())
			Expect(ttl.Val().Nanoseconds()).To(Equal(int64(-1)))
		})

		It("should SetXX", func() {
			isSet, err := client.SetXX(ctx, "key", "hello2", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(false))

			err = client.Set(ctx, "key", "hello", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			isSet, err = client.SetXX(ctx, "key", "hello2", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello2"))
		})

		It("should SetXX with expiration", func() {
			isSet, err := client.SetXX(ctx, "key", "hello2", time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(false))

			err = client.Set(ctx, "key", "hello", time.Second).Err()
			Expect(err).NotTo(HaveOccurred())

			isSet, err = client.SetXX(ctx, "key", "hello2", time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello2"))
		})

		It("should SetXX with keepttl", func() {
			isSet, err := client.SetXX(ctx, "key", "hello2", time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(false))

			err = client.Set(ctx, "key", "hello", time.Second).Err()
			Expect(err).NotTo(HaveOccurred())

			isSet, err = client.SetXX(ctx, "key", "hello2", 5*time.Second).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			isSet, err = client.SetXX(ctx, "key", "hello3", redis.KeepTTL).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(isSet).To(Equal(true))

			val, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal("hello3"))

			// set keepttl will Retain the ttl associated with the key
			ttl, err := client.TTL(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(ttl).NotTo(Equal(-1))
		})

		It("should SetRange", func() {
			set := client.Set(ctx, "key", "Hello World", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			range_ := client.SetRange(ctx, "key", 6, "Redis")
			Expect(range_.Err()).NotTo(HaveOccurred())
			Expect(range_.Val()).To(Equal(int64(11)))

			get := client.Get(ctx, "key")
			Expect(get.Err()).NotTo(HaveOccurred())
			Expect(get.Val()).To(Equal("Hello Redis"))
		})

		It("should StrLen", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			strLen := client.StrLen(ctx, "key")
			Expect(strLen.Err()).NotTo(HaveOccurred())
			Expect(strLen.Val()).To(Equal(int64(5)))

			strLen = client.StrLen(ctx, "_")
			Expect(strLen.Err()).NotTo(HaveOccurred())
			Expect(strLen.Val()).To(Equal(int64(0)))
		})

		It("should Copy", func() {
			set := client.Set(ctx, "key", "hello", 0)
			Expect(set.Err()).NotTo(HaveOccurred())
			Expect(set.Val()).To(Equal("OK"))

			copy := client.Copy(ctx, "key", "newKey", redisOptions().DB, false)
			Expect(copy.Err()).NotTo(HaveOccurred())
			Expect(copy.Val()).To(Equal(int64(1)))

			// Value is available by both keys now
			getOld := client.Get(ctx, "key")
			Expect(getOld.Err()).NotTo(HaveOccurred())
			Expect(getOld.Val()).To(Equal("hello"))
			getNew := client.Get(ctx, "newKey")
			Expect(getNew.Err()).NotTo(HaveOccurred())
			Expect(getNew.Val()).To(Equal("hello"))

			// Overwriting an existing key should not succeed
			overwrite := client.Copy(ctx, "newKey", "key", redisOptions().DB, false)
			Expect(overwrite.Val()).To(Equal(int64(0)))

			// Overwrite is allowed when replace=rue
			replace := client.Copy(ctx, "newKey", "key", redisOptions().DB, true)
			Expect(replace.Val()).To(Equal(int64(1)))
		})
	})

	Describe("hashes", func() {
		It("should HDel", func() {
			hSet := client.HSet(ctx, "hash", "key", "hello")
			Expect(hSet.Err()).NotTo(HaveOccurred())

			hDel := client.HDel(ctx, "hash", "key")
			Expect(hDel.Err()).NotTo(HaveOccurred())
			Expect(hDel.Val()).To(Equal(int64(1)))

			hDel = client.HDel(ctx, "hash", "key")
			Expect(hDel.Err()).NotTo(HaveOccurred())
			Expect(hDel.Val()).To(Equal(int64(0)))
		})

		It("should HExists", func() {
			hSet := client.HSet(ctx, "hash", "key", "hello")
			Expect(hSet.Err()).NotTo(HaveOccurred())

			hExists := client.HExists(ctx, "hash", "key")
			Expect(hExists.Err()).NotTo(HaveOccurred())
			Expect(hExists.Val()).To(Equal(true))

			hExists = client.HExists(ctx, "hash", "key1")
			Expect(hExists.Err()).NotTo(HaveOccurred())
			Expect(hExists.Val()).To(Equal(false))
		})

		It("should HGet", func() {
			hSet := client.HSet(ctx, "hash", "key", "hello")
			Expect(hSet.Err()).NotTo(HaveOccurred())

			hGet := client.HGet(ctx, "hash", "key")
			Expect(hGet.Err()).NotTo(HaveOccurred())
			Expect(hGet.Val()).To(Equal("hello"))

			hGet = client.HGet(ctx, "hash", "key1")
			Expect(hGet.Err()).To(Equal(redis.Nil))
			Expect(hGet.Val()).To(Equal(""))
		})

		It("should HGetAll", func() {
			err := client.HSet(ctx, "hash", "key1", "hello1").Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.HSet(ctx, "hash", "key2", "hello2").Err()
			Expect(err).NotTo(HaveOccurred())

			m, err := client.HGetAll(ctx, "hash").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(m).To(Equal(map[string]string{"key1": "hello1", "key2": "hello2"}))
		})

		It("should scan", func() {
			err := client.HMSet(ctx, "hash", "key1", "hello1", "key2", 123).Err()
			Expect(err).NotTo(HaveOccurred())

			res := client.HGetAll(ctx, "hash")
			Expect(res.Err()).NotTo(HaveOccurred())

			type data struct {
				Key1 string `redis:"key1"`
				Key2 int    `redis:"key2"`
			}
			var d data
			Expect(res.Scan(&d)).NotTo(HaveOccurred())
			Expect(d).To(Equal(data{Key1: "hello1", Key2: 123}))
		})

		It("should HIncrBy", func() {
			hSet := client.HSet(ctx, "hash", "key", "5")
			Expect(hSet.Err()).NotTo(HaveOccurred())

			hIncrBy := client.HIncrBy(ctx, "hash", "key", 1)
			Expect(hIncrBy.Err()).NotTo(HaveOccurred())
			Expect(hIncrBy.Val()).To(Equal(int64(6)))

			hIncrBy = client.HIncrBy(ctx, "hash", "key", -1)
			Expect(hIncrBy.Err()).NotTo(HaveOccurred())
			Expect(hIncrBy.Val()).To(Equal(int64(5)))

			hIncrBy = client.HIncrBy(ctx, "hash", "key", -10)
			Expect(hIncrBy.Err()).NotTo(HaveOccurred())
			Expect(hIncrBy.Val()).To(Equal(int64(-5)))
		})

		It("should HIncrByFloat", func() {
			hSet := client.HSet(ctx, "hash", "field", "10.50")
			Expect(hSet.Err()).NotTo(HaveOccurred())
			Expect(hSet.Val()).To(Equal(int64(1)))

			hIncrByFloat := client.HIncrByFloat(ctx, "hash", "field", 0.1)
			Expect(hIncrByFloat.Err()).NotTo(HaveOccurred())
			Expect(hIncrByFloat.Val()).To(Equal(10.6))

			hSet = client.HSet(ctx, "hash", "field", "5.0e3")
			Expect(hSet.Err()).NotTo(HaveOccurred())
			Expect(hSet.Val()).To(Equal(int64(0)))

			hIncrByFloat = client.HIncrByFloat(ctx, "hash", "field", 2.0e2)
			Expect(hIncrByFloat.Err()).NotTo(HaveOccurred())
			Expect(hIncrByFloat.Val()).To(Equal(float64(5200)))
		})

		It("should HKeys", func() {
			hkeys := client.HKeys(ctx, "hash")
			Expect(hkeys.Err()).NotTo(HaveOccurred())
			Expect(hkeys.Val()).To(Equal([]string{}))

			hset := client.HSet(ctx, "hash", "key1", "hello1")
			Expect(hset.Err()).NotTo(HaveOccurred())
			hset = client.HSet(ctx, "hash", "key2", "hello2")
			Expect(hset.Err()).NotTo(HaveOccurred())

			hkeys = client.HKeys(ctx, "hash")
			Expect(hkeys.Err()).NotTo(HaveOccurred())
			Expect(hkeys.Val()).To(Equal([]string{"key1", "key2"}))
		})

		It("should HLen", func() {
			hSet := client.HSet(ctx, "hash", "key1", "hello1")
			Expect(hSet.Err()).NotTo(HaveOccurred())
			hSet = client.HSet(ctx, "hash", "key2", "hello2")
			Expect(hSet.Err()).NotTo(HaveOccurred())

			hLen := client.HLen(ctx, "hash")
			Expect(hLen.Err()).NotTo(HaveOccurred())
			Expect(hLen.Val()).To(Equal(int64(2)))
		})

		It("should HMGet", func() {
			err := client.HSet(ctx, "hash", "key1", "hello1", "key2", "hello2").Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.HMGet(ctx, "hash", "key1", "key2", "_").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]interface{}{"hello1", "hello2", nil}))
		})

		It("should HSet", func() {
			ok, err := client.HSet(ctx, "hash", map[string]interface{}{
				"key1": "hello1",
				"key2": "hello2",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(ok).To(Equal(int64(2)))

			v, err := client.HGet(ctx, "hash", "key1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal("hello1"))

			v, err = client.HGet(ctx, "hash", "key2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal("hello2"))

			keys, err := client.HKeys(ctx, "hash").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(keys).To(ConsistOf([]string{"key1", "key2"}))
		})

		It("should HSet", func() {
			hSet := client.HSet(ctx, "hash", "key", "hello")
			Expect(hSet.Err()).NotTo(HaveOccurred())
			Expect(hSet.Val()).To(Equal(int64(1)))

			hGet := client.HGet(ctx, "hash", "key")
			Expect(hGet.Err()).NotTo(HaveOccurred())
			Expect(hGet.Val()).To(Equal("hello"))
		})

		It("should HSetNX", func() {
			hSetNX := client.HSetNX(ctx, "hash", "key", "hello")
			Expect(hSetNX.Err()).NotTo(HaveOccurred())
			Expect(hSetNX.Val()).To(Equal(true))

			hSetNX = client.HSetNX(ctx, "hash", "key", "hello")
			Expect(hSetNX.Err()).NotTo(HaveOccurred())
			Expect(hSetNX.Val()).To(Equal(false))

			hGet := client.HGet(ctx, "hash", "key")
			Expect(hGet.Err()).NotTo(HaveOccurred())
			Expect(hGet.Val()).To(Equal("hello"))
		})

		It("should HVals", func() {
			err := client.HSet(ctx, "hash", "key1", "hello1").Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.HSet(ctx, "hash", "key2", "hello2").Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.HVals(ctx, "hash").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]string{"hello1", "hello2"}))

			var slice []string
			err = client.HVals(ctx, "hash").ScanSlice(&slice)
			Expect(err).NotTo(HaveOccurred())
			Expect(slice).To(Equal([]string{"hello1", "hello2"}))
		})

		It("should HRandField", func() {
			err := client.HSet(ctx, "hash", "key1", "hello1").Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.HSet(ctx, "hash", "key2", "hello2").Err()
			Expect(err).NotTo(HaveOccurred())

			v := client.HRandField(ctx, "hash", 1, false)
			Expect(v.Err()).NotTo(HaveOccurred())
			Expect(v.Val()).To(Or(Equal([]string{"key1"}), Equal([]string{"key2"})))

			v = client.HRandField(ctx, "hash", 0, false)
			Expect(v.Err()).NotTo(HaveOccurred())
			Expect(v.Val()).To(HaveLen(0))

			var slice []string
			err = client.HRandField(ctx, "hash", 1, true).ScanSlice(&slice)
			Expect(err).NotTo(HaveOccurred())
			Expect(slice).To(Or(Equal([]string{"key1", "hello1"}), Equal([]string{"key2", "hello2"})))
		})
	})

	Describe("hyperloglog", func() {
		It("should PFMerge", func() {
			pfAdd := client.PFAdd(ctx, "hll1", "1", "2", "3", "4", "5")
			Expect(pfAdd.Err()).NotTo(HaveOccurred())

			pfCount := client.PFCount(ctx, "hll1")
			Expect(pfCount.Err()).NotTo(HaveOccurred())
			Expect(pfCount.Val()).To(Equal(int64(5)))

			pfAdd = client.PFAdd(ctx, "hll2", "a", "b", "c", "d", "e")
			Expect(pfAdd.Err()).NotTo(HaveOccurred())

			pfMerge := client.PFMerge(ctx, "hllMerged", "hll1", "hll2")
			Expect(pfMerge.Err()).NotTo(HaveOccurred())

			pfCount = client.PFCount(ctx, "hllMerged")
			Expect(pfCount.Err()).NotTo(HaveOccurred())
			Expect(pfCount.Val()).To(Equal(int64(10)))

			pfCount = client.PFCount(ctx, "hll1", "hll2")
			Expect(pfCount.Err()).NotTo(HaveOccurred())
			Expect(pfCount.Val()).To(Equal(int64(10)))
		})
	})

	Describe("lists", func() {
		It("should BLPop", func() {
			rPush := client.RPush(ctx, "list1", "a", "b", "c")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			bLPop := client.BLPop(ctx, 0, "list1", "list2")
			Expect(bLPop.Err()).NotTo(HaveOccurred())
			Expect(bLPop.Val()).To(Equal([]string{"list1", "a"}))
		})

		It("should BLPopBlocks", func() {
			started := make(chan bool)
			done := make(chan bool)
			go func() {
				defer GinkgoRecover()

				started <- true
				bLPop := client.BLPop(ctx, 0, "list")
				Expect(bLPop.Err()).NotTo(HaveOccurred())
				Expect(bLPop.Val()).To(Equal([]string{"list", "a"}))
				done <- true
			}()
			<-started

			select {
			case <-done:
				Fail("BLPop is not blocked")
			case <-time.After(time.Second):
				// ok
			}

			rPush := client.RPush(ctx, "list", "a")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			select {
			case <-done:
				// ok
			case <-time.After(time.Second):
				Fail("BLPop is still blocked")
			}
		})

		It("should BLPop timeout", func() {
			val, err := client.BLPop(ctx, time.Second, "list1").Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(BeNil())

			Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())

			stats := client.PoolStats()
			Expect(stats.Hits).To(Equal(uint32(2)))
			Expect(stats.Misses).To(Equal(uint32(1)))
			Expect(stats.Timeouts).To(Equal(uint32(0)))
		})

		It("should BRPop", func() {
			rPush := client.RPush(ctx, "list1", "a", "b", "c")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			bRPop := client.BRPop(ctx, 0, "list1", "list2")
			Expect(bRPop.Err()).NotTo(HaveOccurred())
			Expect(bRPop.Val()).To(Equal([]string{"list1", "c"}))
		})

		It("should BRPop blocks", func() {
			started := make(chan bool)
			done := make(chan bool)
			go func() {
				defer GinkgoRecover()

				started <- true
				brpop := client.BRPop(ctx, 0, "list")
				Expect(brpop.Err()).NotTo(HaveOccurred())
				Expect(brpop.Val()).To(Equal([]string{"list", "a"}))
				done <- true
			}()
			<-started

			select {
			case <-done:
				Fail("BRPop is not blocked")
			case <-time.After(time.Second):
				// ok
			}

			rPush := client.RPush(ctx, "list", "a")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			select {
			case <-done:
				// ok
			case <-time.After(time.Second):
				Fail("BRPop is still blocked")
				// ok
			}
		})

		It("should BRPopLPush", func() {
			_, err := client.BRPopLPush(ctx, "list1", "list2", time.Second).Result()
			Expect(err).To(Equal(redis.Nil))

			err = client.RPush(ctx, "list1", "a", "b", "c").Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.BRPopLPush(ctx, "list1", "list2", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal("c"))
		})

		It("should LIndex", func() {
			lPush := client.LPush(ctx, "list", "World")
			Expect(lPush.Err()).NotTo(HaveOccurred())
			lPush = client.LPush(ctx, "list", "Hello")
			Expect(lPush.Err()).NotTo(HaveOccurred())

			lIndex := client.LIndex(ctx, "list", 0)
			Expect(lIndex.Err()).NotTo(HaveOccurred())
			Expect(lIndex.Val()).To(Equal("Hello"))

			lIndex = client.LIndex(ctx, "list", -1)
			Expect(lIndex.Err()).NotTo(HaveOccurred())
			Expect(lIndex.Val()).To(Equal("World"))

			lIndex = client.LIndex(ctx, "list", 3)
			Expect(lIndex.Err()).To(Equal(redis.Nil))
			Expect(lIndex.Val()).To(Equal(""))
		})

		It("should LInsert", func() {
			rPush := client.RPush(ctx, "list", "Hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "World")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lInsert := client.LInsert(ctx, "list", "BEFORE", "World", "There")
			Expect(lInsert.Err()).NotTo(HaveOccurred())
			Expect(lInsert.Val()).To(Equal(int64(3)))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"Hello", "There", "World"}))
		})

		It("should LLen", func() {
			lPush := client.LPush(ctx, "list", "World")
			Expect(lPush.Err()).NotTo(HaveOccurred())
			lPush = client.LPush(ctx, "list", "Hello")
			Expect(lPush.Err()).NotTo(HaveOccurred())

			lLen := client.LLen(ctx, "list")
			Expect(lLen.Err()).NotTo(HaveOccurred())
			Expect(lLen.Val()).To(Equal(int64(2)))
		})

		It("should LPop", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lPop := client.LPop(ctx, "list")
			Expect(lPop.Err()).NotTo(HaveOccurred())
			Expect(lPop.Val()).To(Equal("one"))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"two", "three"}))
		})

		It("should LPopCount", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "four")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lPopCount := client.LPopCount(ctx, "list", 2)
			Expect(lPopCount.Err()).NotTo(HaveOccurred())
			Expect(lPopCount.Val()).To(Equal([]string{"one", "two"}))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"three", "four"}))
		})

		It("should LPos", func() {
			rPush := client.RPush(ctx, "list", "a")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "b")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "c")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "b")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lPos := client.LPos(ctx, "list", "b", redis.LPosArgs{})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal(int64(1)))

			lPos = client.LPos(ctx, "list", "b", redis.LPosArgs{Rank: 2})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal(int64(3)))

			lPos = client.LPos(ctx, "list", "b", redis.LPosArgs{Rank: -2})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal(int64(1)))

			lPos = client.LPos(ctx, "list", "b", redis.LPosArgs{Rank: 2, MaxLen: 1})
			Expect(lPos.Err()).To(Equal(redis.Nil))

			lPos = client.LPos(ctx, "list", "z", redis.LPosArgs{})
			Expect(lPos.Err()).To(Equal(redis.Nil))
		})

		It("should LPosCount", func() {
			rPush := client.RPush(ctx, "list", "a")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "b")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "c")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "b")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lPos := client.LPosCount(ctx, "list", "b", 2, redis.LPosArgs{})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal([]int64{1, 3}))

			lPos = client.LPosCount(ctx, "list", "b", 2, redis.LPosArgs{Rank: 2})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal([]int64{3}))

			lPos = client.LPosCount(ctx, "list", "b", 1, redis.LPosArgs{Rank: 1, MaxLen: 1})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal([]int64{}))

			lPos = client.LPosCount(ctx, "list", "b", 1, redis.LPosArgs{Rank: 1, MaxLen: 0})
			Expect(lPos.Err()).NotTo(HaveOccurred())
			Expect(lPos.Val()).To(Equal([]int64{1}))
		})

		It("should LPush", func() {
			lPush := client.LPush(ctx, "list", "World")
			Expect(lPush.Err()).NotTo(HaveOccurred())
			lPush = client.LPush(ctx, "list", "Hello")
			Expect(lPush.Err()).NotTo(HaveOccurred())

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"Hello", "World"}))
		})

		It("should LPushX", func() {
			lPush := client.LPush(ctx, "list", "World")
			Expect(lPush.Err()).NotTo(HaveOccurred())

			lPushX := client.LPushX(ctx, "list", "Hello")
			Expect(lPushX.Err()).NotTo(HaveOccurred())
			Expect(lPushX.Val()).To(Equal(int64(2)))

			lPush = client.LPush(ctx, "list1", "three")
			Expect(lPush.Err()).NotTo(HaveOccurred())
			Expect(lPush.Val()).To(Equal(int64(1)))

			lPushX = client.LPushX(ctx, "list1", "two", "one")
			Expect(lPushX.Err()).NotTo(HaveOccurred())
			Expect(lPushX.Val()).To(Equal(int64(3)))

			lPushX = client.LPushX(ctx, "list2", "Hello")
			Expect(lPushX.Err()).NotTo(HaveOccurred())
			Expect(lPushX.Val()).To(Equal(int64(0)))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"Hello", "World"}))

			lRange = client.LRange(ctx, "list1", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two", "three"}))

			lRange = client.LRange(ctx, "list2", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{}))
		})

		It("should LRange", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lRange := client.LRange(ctx, "list", 0, 0)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one"}))

			lRange = client.LRange(ctx, "list", -3, 2)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two", "three"}))

			lRange = client.LRange(ctx, "list", -100, 100)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two", "three"}))

			lRange = client.LRange(ctx, "list", 5, 10)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{}))
		})

		It("should LRem", func() {
			rPush := client.RPush(ctx, "list", "hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "key")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lRem := client.LRem(ctx, "list", -2, "hello")
			Expect(lRem.Err()).NotTo(HaveOccurred())
			Expect(lRem.Val()).To(Equal(int64(2)))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"hello", "key"}))
		})

		It("should LSet", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lSet := client.LSet(ctx, "list", 0, "four")
			Expect(lSet.Err()).NotTo(HaveOccurred())
			Expect(lSet.Val()).To(Equal("OK"))

			lSet = client.LSet(ctx, "list", -2, "five")
			Expect(lSet.Err()).NotTo(HaveOccurred())
			Expect(lSet.Val()).To(Equal("OK"))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"four", "five", "three"}))
		})

		It("should LTrim", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			lTrim := client.LTrim(ctx, "list", 1, -1)
			Expect(lTrim.Err()).NotTo(HaveOccurred())
			Expect(lTrim.Val()).To(Equal("OK"))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"two", "three"}))
		})

		It("should RPop", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			rPop := client.RPop(ctx, "list")
			Expect(rPop.Err()).NotTo(HaveOccurred())
			Expect(rPop.Val()).To(Equal("three"))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two"}))
		})

		It("should RPopCount", func() {
			rPush := client.RPush(ctx, "list", "one", "two", "three", "four")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(4)))

			rPopCount := client.RPopCount(ctx, "list", 2)
			Expect(rPopCount.Err()).NotTo(HaveOccurred())
			Expect(rPopCount.Val()).To(Equal([]string{"four", "three"}))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two"}))
		})

		It("should RPopLPush", func() {
			rPush := client.RPush(ctx, "list", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "two")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			rPush = client.RPush(ctx, "list", "three")
			Expect(rPush.Err()).NotTo(HaveOccurred())

			rPopLPush := client.RPopLPush(ctx, "list", "list2")
			Expect(rPopLPush.Err()).NotTo(HaveOccurred())
			Expect(rPopLPush.Val()).To(Equal("three"))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two"}))

			lRange = client.LRange(ctx, "list2", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"three"}))
		})

		It("should RPush", func() {
			rPush := client.RPush(ctx, "list", "Hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(1)))

			rPush = client.RPush(ctx, "list", "World")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(2)))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"Hello", "World"}))
		})

		It("should RPushX", func() {
			rPush := client.RPush(ctx, "list", "Hello")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(1)))

			rPushX := client.RPushX(ctx, "list", "World")
			Expect(rPushX.Err()).NotTo(HaveOccurred())
			Expect(rPushX.Val()).To(Equal(int64(2)))

			rPush = client.RPush(ctx, "list1", "one")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(1)))

			rPushX = client.RPushX(ctx, "list1", "two", "three")
			Expect(rPushX.Err()).NotTo(HaveOccurred())
			Expect(rPushX.Val()).To(Equal(int64(3)))

			rPushX = client.RPushX(ctx, "list2", "World")
			Expect(rPushX.Err()).NotTo(HaveOccurred())
			Expect(rPushX.Val()).To(Equal(int64(0)))

			lRange := client.LRange(ctx, "list", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"Hello", "World"}))

			lRange = client.LRange(ctx, "list1", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"one", "two", "three"}))

			lRange = client.LRange(ctx, "list2", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{}))
		})

		It("should LMove", func() {
			rPush := client.RPush(ctx, "lmove1", "ichi")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(1)))

			rPush = client.RPush(ctx, "lmove1", "ni")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(2)))

			rPush = client.RPush(ctx, "lmove1", "san")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(3)))

			lMove := client.LMove(ctx, "lmove1", "lmove2", "RIGHT", "LEFT")
			Expect(lMove.Err()).NotTo(HaveOccurred())
			Expect(lMove.Val()).To(Equal("san"))

			lRange := client.LRange(ctx, "lmove2", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"san"}))
		})

		It("should BLMove", func() {
			rPush := client.RPush(ctx, "blmove1", "ichi")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(1)))

			rPush = client.RPush(ctx, "blmove1", "ni")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(2)))

			rPush = client.RPush(ctx, "blmove1", "san")
			Expect(rPush.Err()).NotTo(HaveOccurred())
			Expect(rPush.Val()).To(Equal(int64(3)))

			blMove := client.BLMove(ctx, "blmove1", "blmove2", "RIGHT", "LEFT", time.Second)
			Expect(blMove.Err()).NotTo(HaveOccurred())
			Expect(blMove.Val()).To(Equal("san"))

			lRange := client.LRange(ctx, "blmove2", 0, -1)
			Expect(lRange.Err()).NotTo(HaveOccurred())
			Expect(lRange.Val()).To(Equal([]string{"san"}))
		})
	})

	Describe("sets", func() {
		It("should SAdd", func() {
			sAdd := client.SAdd(ctx, "set", "Hello")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(1)))

			sAdd = client.SAdd(ctx, "set", "World")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(1)))

			sAdd = client.SAdd(ctx, "set", "World")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(0)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"Hello", "World"}))
		})

		It("should SAdd strings", func() {
			set := []string{"Hello", "World", "World"}
			sAdd := client.SAdd(ctx, "set", set)
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(2)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"Hello", "World"}))
		})

		It("should SCard", func() {
			sAdd := client.SAdd(ctx, "set", "Hello")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(1)))

			sAdd = client.SAdd(ctx, "set", "World")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			Expect(sAdd.Val()).To(Equal(int64(1)))

			sCard := client.SCard(ctx, "set")
			Expect(sCard.Err()).NotTo(HaveOccurred())
			Expect(sCard.Val()).To(Equal(int64(2)))
		})

		It("should SDiff", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sDiff := client.SDiff(ctx, "set1", "set2")
			Expect(sDiff.Err()).NotTo(HaveOccurred())
			Expect(sDiff.Val()).To(ConsistOf([]string{"a", "b"}))
		})

		It("should SDiffStore", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sDiffStore := client.SDiffStore(ctx, "set", "set1", "set2")
			Expect(sDiffStore.Err()).NotTo(HaveOccurred())
			Expect(sDiffStore.Val()).To(Equal(int64(2)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"a", "b"}))
		})

		It("should SInter", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sInter := client.SInter(ctx, "set1", "set2")
			Expect(sInter.Err()).NotTo(HaveOccurred())
			Expect(sInter.Val()).To(Equal([]string{"c"}))
		})

		It("should SInterStore", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sInterStore := client.SInterStore(ctx, "set", "set1", "set2")
			Expect(sInterStore.Err()).NotTo(HaveOccurred())
			Expect(sInterStore.Val()).To(Equal(int64(1)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(Equal([]string{"c"}))
		})

		It("should IsMember", func() {
			sAdd := client.SAdd(ctx, "set", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sIsMember := client.SIsMember(ctx, "set", "one")
			Expect(sIsMember.Err()).NotTo(HaveOccurred())
			Expect(sIsMember.Val()).To(Equal(true))

			sIsMember = client.SIsMember(ctx, "set", "two")
			Expect(sIsMember.Err()).NotTo(HaveOccurred())
			Expect(sIsMember.Val()).To(Equal(false))
		})

		It("should SMIsMember", func() {
			sAdd := client.SAdd(ctx, "set", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sMIsMember := client.SMIsMember(ctx, "set", "one", "two")
			Expect(sMIsMember.Err()).NotTo(HaveOccurred())
			Expect(sMIsMember.Val()).To(Equal([]bool{true, false}))
		})

		It("should SMembers", func() {
			sAdd := client.SAdd(ctx, "set", "Hello")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "World")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"Hello", "World"}))
		})

		It("should SMembersMap", func() {
			sAdd := client.SAdd(ctx, "set", "Hello")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "World")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sMembersMap := client.SMembersMap(ctx, "set")
			Expect(sMembersMap.Err()).NotTo(HaveOccurred())
			Expect(sMembersMap.Val()).To(Equal(map[string]struct{}{"Hello": {}, "World": {}}))
		})

		It("should SMove", func() {
			sAdd := client.SAdd(ctx, "set1", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "two")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "three")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sMove := client.SMove(ctx, "set1", "set2", "two")
			Expect(sMove.Err()).NotTo(HaveOccurred())
			Expect(sMove.Val()).To(Equal(true))

			sMembers := client.SMembers(ctx, "set1")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(Equal([]string{"one"}))

			sMembers = client.SMembers(ctx, "set2")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"three", "two"}))
		})

		It("should SPop", func() {
			sAdd := client.SAdd(ctx, "set", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "two")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "three")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sPop := client.SPop(ctx, "set")
			Expect(sPop.Err()).NotTo(HaveOccurred())
			Expect(sPop.Val()).NotTo(Equal(""))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(HaveLen(2))
		})

		It("should SPopN", func() {
			sAdd := client.SAdd(ctx, "set", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "two")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "three")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "four")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sPopN := client.SPopN(ctx, "set", 1)
			Expect(sPopN.Err()).NotTo(HaveOccurred())
			Expect(sPopN.Val()).NotTo(Equal([]string{""}))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(HaveLen(3))

			sPopN = client.SPopN(ctx, "set", 4)
			Expect(sPopN.Err()).NotTo(HaveOccurred())
			Expect(sPopN.Val()).To(HaveLen(3))

			sMembers = client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(HaveLen(0))
		})

		It("should SRandMember and SRandMemberN", func() {
			err := client.SAdd(ctx, "set", "one").Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.SAdd(ctx, "set", "two").Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.SAdd(ctx, "set", "three").Err()
			Expect(err).NotTo(HaveOccurred())

			members, err := client.SMembers(ctx, "set").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(HaveLen(3))

			member, err := client.SRandMember(ctx, "set").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(member).NotTo(Equal(""))

			members, err = client.SRandMemberN(ctx, "set", 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(HaveLen(2))
		})

		It("should SRem", func() {
			sAdd := client.SAdd(ctx, "set", "one")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "two")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set", "three")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sRem := client.SRem(ctx, "set", "one")
			Expect(sRem.Err()).NotTo(HaveOccurred())
			Expect(sRem.Val()).To(Equal(int64(1)))

			sRem = client.SRem(ctx, "set", "four")
			Expect(sRem.Err()).NotTo(HaveOccurred())
			Expect(sRem.Val()).To(Equal(int64(0)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(ConsistOf([]string{"three", "two"}))
		})

		It("should SUnion", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sUnion := client.SUnion(ctx, "set1", "set2")
			Expect(sUnion.Err()).NotTo(HaveOccurred())
			Expect(sUnion.Val()).To(HaveLen(5))
		})

		It("should SUnionStore", func() {
			sAdd := client.SAdd(ctx, "set1", "a")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "b")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set1", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sAdd = client.SAdd(ctx, "set2", "c")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "d")
			Expect(sAdd.Err()).NotTo(HaveOccurred())
			sAdd = client.SAdd(ctx, "set2", "e")
			Expect(sAdd.Err()).NotTo(HaveOccurred())

			sUnionStore := client.SUnionStore(ctx, "set", "set1", "set2")
			Expect(sUnionStore.Err()).NotTo(HaveOccurred())
			Expect(sUnionStore.Val()).To(Equal(int64(5)))

			sMembers := client.SMembers(ctx, "set")
			Expect(sMembers.Err()).NotTo(HaveOccurred())
			Expect(sMembers.Val()).To(HaveLen(5))
		})
	})

	Describe("sorted sets", func() {
		It("should BZPopMax", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			member, err := client.BZPopMax(ctx, 0, "zset1", "zset2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(member).To(Equal(&redis.ZWithKey{
				Z: redis.Z{
					Score:  3,
					Member: "three",
				},
				Key: "zset1",
			}))
		})

		It("should BZPopMax blocks", func() {
			started := make(chan bool)
			done := make(chan bool)
			go func() {
				defer GinkgoRecover()

				started <- true
				bZPopMax := client.BZPopMax(ctx, 0, "zset")
				Expect(bZPopMax.Err()).NotTo(HaveOccurred())
				Expect(bZPopMax.Val()).To(Equal(&redis.ZWithKey{
					Z: redis.Z{
						Member: "a",
						Score:  1,
					},
					Key: "zset",
				}))
				done <- true
			}()
			<-started

			select {
			case <-done:
				Fail("BZPopMax is not blocked")
			case <-time.After(time.Second):
				// ok
			}

			zAdd := client.ZAdd(ctx, "zset", &redis.Z{
				Member: "a",
				Score:  1,
			})
			Expect(zAdd.Err()).NotTo(HaveOccurred())

			select {
			case <-done:
				// ok
			case <-time.After(time.Second):
				Fail("BZPopMax is still blocked")
			}
		})

		It("should BZPopMax timeout", func() {
			val, err := client.BZPopMax(ctx, time.Second, "zset1").Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(BeNil())

			Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())

			stats := client.PoolStats()
			Expect(stats.Hits).To(Equal(uint32(2)))
			Expect(stats.Misses).To(Equal(uint32(1)))
			Expect(stats.Timeouts).To(Equal(uint32(0)))
		})

		It("should BZPopMin", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			member, err := client.BZPopMin(ctx, 0, "zset1", "zset2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(member).To(Equal(&redis.ZWithKey{
				Z: redis.Z{
					Score:  1,
					Member: "one",
				},
				Key: "zset1",
			}))
		})

		It("should BZPopMin blocks", func() {
			started := make(chan bool)
			done := make(chan bool)
			go func() {
				defer GinkgoRecover()

				started <- true
				bZPopMin := client.BZPopMin(ctx, 0, "zset")
				Expect(bZPopMin.Err()).NotTo(HaveOccurred())
				Expect(bZPopMin.Val()).To(Equal(&redis.ZWithKey{
					Z: redis.Z{
						Member: "a",
						Score:  1,
					},
					Key: "zset",
				}))
				done <- true
			}()
			<-started

			select {
			case <-done:
				Fail("BZPopMin is not blocked")
			case <-time.After(time.Second):
				// ok
			}

			zAdd := client.ZAdd(ctx, "zset", &redis.Z{
				Member: "a",
				Score:  1,
			})
			Expect(zAdd.Err()).NotTo(HaveOccurred())

			select {
			case <-done:
				// ok
			case <-time.After(time.Second):
				Fail("BZPopMin is still blocked")
			}
		})

		It("should BZPopMin timeout", func() {
			val, err := client.BZPopMin(ctx, time.Second, "zset1").Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(val).To(BeNil())

			Expect(client.Ping(ctx).Err()).NotTo(HaveOccurred())

			stats := client.PoolStats()
			Expect(stats.Hits).To(Equal(uint32(2)))
			Expect(stats.Misses).To(Equal(uint32(1)))
			Expect(stats.Timeouts).To(Equal(uint32(0)))
		})

		It("should ZAdd", func() {
			added, err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "uno",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "two",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  1,
				Member: "uno",
			}, {
				Score:  3,
				Member: "two",
			}}))
		})

		It("should ZAdd bytes", func() {
			added, err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: []byte("one"),
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: []byte("uno"),
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: []byte("two"),
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: []byte("two"),
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  1,
				Member: "uno",
			}, {
				Score:  3,
				Member: "two",
			}}))
		})

		It("should ZAddArgs", func() {
			// Test only the GT+LT options.
			added, err := client.ZAddArgs(ctx, "zset", redis.ZAddArgs{
				GT:      true,
				Members: []redis.Z{{Score: 1, Member: "one"}},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			added, err = client.ZAddArgs(ctx, "zset", redis.ZAddArgs{
				GT:      true,
				Members: []redis.Z{{Score: 2, Member: "one"}},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "one"}}))

			added, err = client.ZAddArgs(ctx, "zset", redis.ZAddArgs{
				LT:      true,
				Members: []redis.Z{{Score: 1, Member: "one"}},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))
		})

		It("should ZAddNX", func() {
			added, err := client.ZAddNX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			added, err = client.ZAddNX(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))
		})

		It("should ZAddXX", func() {
			added, err := client.ZAddXX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(BeEmpty())

			added, err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			added, err = client.ZAddXX(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "one"}}))
		})

		// TODO: remove in v9.
		It("should ZAddCh", func() {
			changed, err := client.ZAddCh(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(1)))

			changed, err = client.ZAddCh(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(0)))
		})

		// TODO: remove in v9.
		It("should ZAddNXCh", func() {
			changed, err := client.ZAddNXCh(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			changed, err = client.ZAddNXCh(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}}))
		})

		// TODO: remove in v9.
		It("should ZAddXXCh", func() {
			changed, err := client.ZAddXXCh(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(0)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(BeEmpty())

			added, err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			changed, err = client.ZAddXXCh(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(changed).To(Equal(int64(1)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "one"}}))
		})

		// TODO: remove in v9.
		It("should ZIncr", func() {
			score, err := client.ZIncr(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(score).To(Equal(float64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			score, err = client.ZIncr(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(score).To(Equal(float64(2)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "one"}}))
		})

		// TODO: remove in v9.
		It("should ZIncrNX", func() {
			score, err := client.ZIncrNX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(score).To(Equal(float64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			score, err = client.ZIncrNX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(score).To(Equal(float64(0)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))
		})

		// TODO: remove in v9.
		It("should ZIncrXX", func() {
			score, err := client.ZIncrXX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).To(Equal(redis.Nil))
			Expect(score).To(Equal(float64(0)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(BeEmpty())

			added, err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(1)))

			score, err = client.ZIncrXX(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(score).To(Equal(float64(2)))

			vals, err = client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "one"}}))
		})

		It("should ZCard", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			card, err := client.ZCard(ctx, "zset").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(card).To(Equal(int64(2)))
		})

		It("should ZCount", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			count, err := client.ZCount(ctx, "zset", "-inf", "+inf").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(3)))

			count, err = client.ZCount(ctx, "zset", "(1", "3").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(2)))

			count, err = client.ZLexCount(ctx, "zset", "-", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(count).To(Equal(int64(3)))
		})

		It("should ZIncrBy", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.ZIncrBy(ctx, "zset", 2, "one").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(float64(3)))

			val, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.Z{{
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "one",
			}}))
		})

		It("should ZInterStore", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset3", &redis.Z{Score: 3, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.ZInterStore(ctx, "out", &redis.ZStore{
				Keys:    []string{"zset1", "zset2"},
				Weights: []float64{2, 3},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))

			vals, err := client.ZRangeWithScores(ctx, "out", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  5,
				Member: "one",
			}, {
				Score:  10,
				Member: "two",
			}}))
		})

		It("should ZMScore", func() {
			zmScore := client.ZMScore(ctx, "zset", "one", "three")
			Expect(zmScore.Err()).NotTo(HaveOccurred())
			Expect(zmScore.Val()).To(HaveLen(2))
			Expect(zmScore.Val()[0]).To(Equal(float64(0)))

			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zmScore = client.ZMScore(ctx, "zset", "one", "three")
			Expect(zmScore.Err()).NotTo(HaveOccurred())
			Expect(zmScore.Val()).To(HaveLen(2))
			Expect(zmScore.Val()[0]).To(Equal(float64(1)))

			zmScore = client.ZMScore(ctx, "zset", "four")
			Expect(zmScore.Err()).NotTo(HaveOccurred())
			Expect(zmScore.Val()).To(HaveLen(1))

			zmScore = client.ZMScore(ctx, "zset", "four", "one")
			Expect(zmScore.Err()).NotTo(HaveOccurred())
			Expect(zmScore.Val()).To(HaveLen(2))
		})

		It("should ZPopMax", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			members, err := client.ZPopMax(ctx, "zset").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}}))

			// adding back 3
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			members, err = client.ZPopMax(ctx, "zset", 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}, {
				Score:  2,
				Member: "two",
			}}))

			// adding back 2 & 3
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			members, err = client.ZPopMax(ctx, "zset", 10).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  1,
				Member: "one",
			}}))
		})

		It("should ZPopMin", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  3,
				Member: "three",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			members, err := client.ZPopMin(ctx, "zset").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}}))

			// adding back 1
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			members, err = client.ZPopMin(ctx, "zset", 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  2,
				Member: "two",
			}}))

			// adding back 1 & 2
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  1,
				Member: "one",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  2,
				Member: "two",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			members, err = client.ZPopMin(ctx, "zset", 10).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(members).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "three",
			}}))
		})

		It("should ZRange", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRange := client.ZRange(ctx, "zset", 0, -1)
			Expect(zRange.Err()).NotTo(HaveOccurred())
			Expect(zRange.Val()).To(Equal([]string{"one", "two", "three"}))

			zRange = client.ZRange(ctx, "zset", 2, 3)
			Expect(zRange.Err()).NotTo(HaveOccurred())
			Expect(zRange.Val()).To(Equal([]string{"three"}))

			zRange = client.ZRange(ctx, "zset", -2, -1)
			Expect(zRange.Err()).NotTo(HaveOccurred())
			Expect(zRange.Val()).To(Equal([]string{"two", "three"}))
		})

		It("should ZRangeWithScores", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "three",
			}}))

			vals, err = client.ZRangeWithScores(ctx, "zset", 2, 3).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 3, Member: "three"}}))

			vals, err = client.ZRangeWithScores(ctx, "zset", -2, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "three",
			}}))
		})

		It("should ZRangeArgs", func() {
			added, err := client.ZAddArgs(ctx, "zset", redis.ZAddArgs{
				Members: []redis.Z{
					{Score: 1, Member: "one"},
					{Score: 2, Member: "two"},
					{Score: 3, Member: "three"},
					{Score: 4, Member: "four"},
				},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(4)))

			zRange, err := client.ZRangeArgs(ctx, redis.ZRangeArgs{
				Key:     "zset",
				Start:   1,
				Stop:    4,
				ByScore: true,
				Rev:     true,
				Offset:  1,
				Count:   2,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(zRange).To(Equal([]string{"three", "two"}))

			zRange, err = client.ZRangeArgs(ctx, redis.ZRangeArgs{
				Key:    "zset",
				Start:  "-",
				Stop:   "+",
				ByLex:  true,
				Rev:    true,
				Offset: 2,
				Count:  2,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(zRange).To(Equal([]string{"two", "one"}))

			zRange, err = client.ZRangeArgs(ctx, redis.ZRangeArgs{
				Key:     "zset",
				Start:   "(1",
				Stop:    "(4",
				ByScore: true,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(zRange).To(Equal([]string{"two", "three"}))

			// withScores.
			zSlice, err := client.ZRangeArgsWithScores(ctx, redis.ZRangeArgs{
				Key:     "zset",
				Start:   1,
				Stop:    4,
				ByScore: true,
				Rev:     true,
				Offset:  1,
				Count:   2,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(zSlice).To(Equal([]redis.Z{
				{Score: 3, Member: "three"},
				{Score: 2, Member: "two"},
			}))
		})

		It("should ZRangeByScore", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRangeByScore := client.ZRangeByScore(ctx, "zset", &redis.ZRangeBy{
				Min: "-inf",
				Max: "+inf",
			})
			Expect(zRangeByScore.Err()).NotTo(HaveOccurred())
			Expect(zRangeByScore.Val()).To(Equal([]string{"one", "two", "three"}))

			zRangeByScore = client.ZRangeByScore(ctx, "zset", &redis.ZRangeBy{
				Min: "1",
				Max: "2",
			})
			Expect(zRangeByScore.Err()).NotTo(HaveOccurred())
			Expect(zRangeByScore.Val()).To(Equal([]string{"one", "two"}))

			zRangeByScore = client.ZRangeByScore(ctx, "zset", &redis.ZRangeBy{
				Min: "(1",
				Max: "2",
			})
			Expect(zRangeByScore.Err()).NotTo(HaveOccurred())
			Expect(zRangeByScore.Val()).To(Equal([]string{"two"}))

			zRangeByScore = client.ZRangeByScore(ctx, "zset", &redis.ZRangeBy{
				Min: "(1",
				Max: "(2",
			})
			Expect(zRangeByScore.Err()).NotTo(HaveOccurred())
			Expect(zRangeByScore.Val()).To(Equal([]string{}))
		})

		It("should ZRangeByLex", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{
				Score:  0,
				Member: "a",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  0,
				Member: "b",
			}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{
				Score:  0,
				Member: "c",
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRangeByLex := client.ZRangeByLex(ctx, "zset", &redis.ZRangeBy{
				Min: "-",
				Max: "+",
			})
			Expect(zRangeByLex.Err()).NotTo(HaveOccurred())
			Expect(zRangeByLex.Val()).To(Equal([]string{"a", "b", "c"}))

			zRangeByLex = client.ZRangeByLex(ctx, "zset", &redis.ZRangeBy{
				Min: "[a",
				Max: "[b",
			})
			Expect(zRangeByLex.Err()).NotTo(HaveOccurred())
			Expect(zRangeByLex.Val()).To(Equal([]string{"a", "b"}))

			zRangeByLex = client.ZRangeByLex(ctx, "zset", &redis.ZRangeBy{
				Min: "(a",
				Max: "[b",
			})
			Expect(zRangeByLex.Err()).NotTo(HaveOccurred())
			Expect(zRangeByLex.Val()).To(Equal([]string{"b"}))

			zRangeByLex = client.ZRangeByLex(ctx, "zset", &redis.ZRangeBy{
				Min: "(a",
				Max: "(b",
			})
			Expect(zRangeByLex.Err()).NotTo(HaveOccurred())
			Expect(zRangeByLex.Val()).To(Equal([]string{}))
		})

		It("should ZRangeByScoreWithScoresMap", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRangeByScoreWithScores(ctx, "zset", &redis.ZRangeBy{
				Min: "-inf",
				Max: "+inf",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "three",
			}}))

			vals, err = client.ZRangeByScoreWithScores(ctx, "zset", &redis.ZRangeBy{
				Min: "1",
				Max: "2",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  2,
				Member: "two",
			}}))

			vals, err = client.ZRangeByScoreWithScores(ctx, "zset", &redis.ZRangeBy{
				Min: "(1",
				Max: "2",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "two"}}))

			vals, err = client.ZRangeByScoreWithScores(ctx, "zset", &redis.ZRangeBy{
				Min: "(1",
				Max: "(2",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{}))
		})

		It("should ZRangeStore", func() {
			added, err := client.ZAddArgs(ctx, "zset", redis.ZAddArgs{
				Members: []redis.Z{
					{Score: 1, Member: "one"},
					{Score: 2, Member: "two"},
					{Score: 3, Member: "three"},
					{Score: 4, Member: "four"},
				},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(added).To(Equal(int64(4)))

			rangeStore, err := client.ZRangeStore(ctx, "new-zset", redis.ZRangeArgs{
				Key:     "zset",
				Start:   1,
				Stop:    4,
				ByScore: true,
				Rev:     true,
				Offset:  1,
				Count:   2,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(rangeStore).To(Equal(int64(2)))

			zRange, err := client.ZRange(ctx, "new-zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(zRange).To(Equal([]string{"two", "three"}))
		})

		It("should ZRank", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRank := client.ZRank(ctx, "zset", "three")
			Expect(zRank.Err()).NotTo(HaveOccurred())
			Expect(zRank.Val()).To(Equal(int64(2)))

			zRank = client.ZRank(ctx, "zset", "four")
			Expect(zRank.Err()).To(Equal(redis.Nil))
			Expect(zRank.Val()).To(Equal(int64(0)))
		})

		It("should ZRem", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRem := client.ZRem(ctx, "zset", "two")
			Expect(zRem.Err()).NotTo(HaveOccurred())
			Expect(zRem.Val()).To(Equal(int64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  1,
				Member: "one",
			}, {
				Score:  3,
				Member: "three",
			}}))
		})

		It("should ZRemRangeByRank", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRemRangeByRank := client.ZRemRangeByRank(ctx, "zset", 0, 1)
			Expect(zRemRangeByRank.Err()).NotTo(HaveOccurred())
			Expect(zRemRangeByRank.Val()).To(Equal(int64(2)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}}))
		})

		It("should ZRemRangeByScore", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRemRangeByScore := client.ZRemRangeByScore(ctx, "zset", "-inf", "(2")
			Expect(zRemRangeByScore.Err()).NotTo(HaveOccurred())
			Expect(zRemRangeByScore.Val()).To(Equal(int64(1)))

			vals, err := client.ZRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  2,
				Member: "two",
			}, {
				Score:  3,
				Member: "three",
			}}))
		})

		It("should ZRemRangeByLex", func() {
			zz := []*redis.Z{
				{Score: 0, Member: "aaaa"},
				{Score: 0, Member: "b"},
				{Score: 0, Member: "c"},
				{Score: 0, Member: "d"},
				{Score: 0, Member: "e"},
				{Score: 0, Member: "foo"},
				{Score: 0, Member: "zap"},
				{Score: 0, Member: "zip"},
				{Score: 0, Member: "ALPHA"},
				{Score: 0, Member: "alpha"},
			}
			for _, z := range zz {
				err := client.ZAdd(ctx, "zset", z).Err()
				Expect(err).NotTo(HaveOccurred())
			}

			n, err := client.ZRemRangeByLex(ctx, "zset", "[alpha", "[omega").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(6)))

			vals, err := client.ZRange(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{"ALPHA", "aaaa", "zap", "zip"}))
		})

		It("should ZRevRange", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRevRange := client.ZRevRange(ctx, "zset", 0, -1)
			Expect(zRevRange.Err()).NotTo(HaveOccurred())
			Expect(zRevRange.Val()).To(Equal([]string{"three", "two", "one"}))

			zRevRange = client.ZRevRange(ctx, "zset", 2, 3)
			Expect(zRevRange.Err()).NotTo(HaveOccurred())
			Expect(zRevRange.Val()).To(Equal([]string{"one"}))

			zRevRange = client.ZRevRange(ctx, "zset", -2, -1)
			Expect(zRevRange.Err()).NotTo(HaveOccurred())
			Expect(zRevRange.Val()).To(Equal([]string{"two", "one"}))
		})

		It("should ZRevRangeWithScoresMap", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			val, err := client.ZRevRangeWithScores(ctx, "zset", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  1,
				Member: "one",
			}}))

			val, err = client.ZRevRangeWithScores(ctx, "zset", 2, 3).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.Z{{Score: 1, Member: "one"}}))

			val, err = client.ZRevRangeWithScores(ctx, "zset", -2, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.Z{{
				Score:  2,
				Member: "two",
			}, {
				Score:  1,
				Member: "one",
			}}))
		})

		It("should ZRevRangeByScore", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRevRangeByScore(
				ctx, "zset", &redis.ZRangeBy{Max: "+inf", Min: "-inf"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{"three", "two", "one"}))

			vals, err = client.ZRevRangeByScore(
				ctx, "zset", &redis.ZRangeBy{Max: "2", Min: "(1"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{"two"}))

			vals, err = client.ZRevRangeByScore(
				ctx, "zset", &redis.ZRangeBy{Max: "(2", Min: "(1"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{}))
		})

		It("should ZRevRangeByLex", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 0, Member: "a"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 0, Member: "b"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 0, Member: "c"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRevRangeByLex(
				ctx, "zset", &redis.ZRangeBy{Max: "+", Min: "-"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{"c", "b", "a"}))

			vals, err = client.ZRevRangeByLex(
				ctx, "zset", &redis.ZRangeBy{Max: "[b", Min: "(a"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{"b"}))

			vals, err = client.ZRevRangeByLex(
				ctx, "zset", &redis.ZRangeBy{Max: "(b", Min: "(a"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]string{}))
		})

		It("should ZRevRangeByScoreWithScores", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRevRangeByScoreWithScores(
				ctx, "zset", &redis.ZRangeBy{Max: "+inf", Min: "-inf"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  1,
				Member: "one",
			}}))
		})

		It("should ZRevRangeByScoreWithScoresMap", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.ZRevRangeByScoreWithScores(
				ctx, "zset", &redis.ZRangeBy{Max: "+inf", Min: "-inf"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}, {
				Score:  2,
				Member: "two",
			}, {
				Score:  1,
				Member: "one",
			}}))

			vals, err = client.ZRevRangeByScoreWithScores(
				ctx, "zset", &redis.ZRangeBy{Max: "2", Min: "(1"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{Score: 2, Member: "two"}}))

			vals, err = client.ZRevRangeByScoreWithScores(
				ctx, "zset", &redis.ZRangeBy{Max: "(2", Min: "(1"}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{}))
		})

		It("should ZRevRank", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			zRevRank := client.ZRevRank(ctx, "zset", "one")
			Expect(zRevRank.Err()).NotTo(HaveOccurred())
			Expect(zRevRank.Val()).To(Equal(int64(2)))

			zRevRank = client.ZRevRank(ctx, "zset", "four")
			Expect(zRevRank.Err()).To(Equal(redis.Nil))
			Expect(zRevRank.Val()).To(Equal(int64(0)))
		})

		It("should ZScore", func() {
			zAdd := client.ZAdd(ctx, "zset", &redis.Z{Score: 1.001, Member: "one"})
			Expect(zAdd.Err()).NotTo(HaveOccurred())

			zScore := client.ZScore(ctx, "zset", "one")
			Expect(zScore.Err()).NotTo(HaveOccurred())
			Expect(zScore.Val()).To(Equal(float64(1.001)))
		})

		It("should ZUnion", func() {
			err := client.ZAddArgs(ctx, "zset1", redis.ZAddArgs{
				Members: []redis.Z{
					{Score: 1, Member: "one"},
					{Score: 2, Member: "two"},
				},
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ZAddArgs(ctx, "zset2", redis.ZAddArgs{
				Members: []redis.Z{
					{Score: 1, Member: "one"},
					{Score: 2, Member: "two"},
					{Score: 3, Member: "three"},
				},
			}).Err()
			Expect(err).NotTo(HaveOccurred())

			union, err := client.ZUnion(ctx, redis.ZStore{
				Keys:      []string{"zset1", "zset2"},
				Weights:   []float64{2, 3},
				Aggregate: "sum",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(union).To(Equal([]string{"one", "three", "two"}))

			unionScores, err := client.ZUnionWithScores(ctx, redis.ZStore{
				Keys:      []string{"zset1", "zset2"},
				Weights:   []float64{2, 3},
				Aggregate: "sum",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(unionScores).To(Equal([]redis.Z{
				{Score: 5, Member: "one"},
				{Score: 9, Member: "three"},
				{Score: 10, Member: "two"},
			}))
		})

		It("should ZUnionStore", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			n, err := client.ZUnionStore(ctx, "out", &redis.ZStore{
				Keys:    []string{"zset1", "zset2"},
				Weights: []float64{2, 3},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))

			val, err := client.ZRangeWithScores(ctx, "out", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.Z{{
				Score:  5,
				Member: "one",
			}, {
				Score:  9,
				Member: "three",
			}, {
				Score:  10,
				Member: "two",
			}}))
		})

		It("should ZRandMember", func() {
			err := client.ZAdd(ctx, "zset", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())

			v := client.ZRandMember(ctx, "zset", 1, false)
			Expect(v.Err()).NotTo(HaveOccurred())
			Expect(v.Val()).To(Or(Equal([]string{"one"}), Equal([]string{"two"})))

			v = client.ZRandMember(ctx, "zset", 0, false)
			Expect(v.Err()).NotTo(HaveOccurred())
			Expect(v.Val()).To(HaveLen(0))

			var slice []string
			err = client.ZRandMember(ctx, "zset", 1, true).ScanSlice(&slice)
			Expect(err).NotTo(HaveOccurred())
			Expect(slice).To(Or(Equal([]string{"one", "1"}), Equal([]string{"two", "2"})))
		})

		It("should ZDiff", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.ZDiff(ctx, "zset1", "zset2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]string{"two", "three"}))
		})

		It("should ZDiffWithScores", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.ZDiffWithScores(ctx, "zset1", "zset2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]redis.Z{
				{
					Member: "two",
					Score:  2,
				},
				{
					Member: "three",
					Score:  3,
				},
			}))
		})

		It("should ZInter", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.ZInter(ctx, &redis.ZStore{
				Keys: []string{"zset1", "zset2"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]string{"one", "two"}))
		})

		It("should ZInterWithScores", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.ZInterWithScores(ctx, &redis.ZStore{
				Keys:      []string{"zset1", "zset2"},
				Weights:   []float64{2, 3},
				Aggregate: "Max",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]redis.Z{
				{
					Member: "one",
					Score:  3,
				},
				{
					Member: "two",
					Score:  6,
				},
			}))
		})

		It("should ZDiffStore", func() {
			err := client.ZAdd(ctx, "zset1", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset1", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 1, Member: "one"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 2, Member: "two"}).Err()
			Expect(err).NotTo(HaveOccurred())
			err = client.ZAdd(ctx, "zset2", &redis.Z{Score: 3, Member: "three"}).Err()
			Expect(err).NotTo(HaveOccurred())
			v, err := client.ZDiffStore(ctx, "out1", "zset1", "zset2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal(int64(0)))
			v, err = client.ZDiffStore(ctx, "out1", "zset2", "zset1").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal(int64(1)))
			vals, err := client.ZRangeWithScores(ctx, "out1", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.Z{{
				Score:  3,
				Member: "three",
			}}))
		})
	})

	Describe("streams", func() {
		BeforeEach(func() {
			id, err := client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				ID:     "1-0",
				Values: map[string]interface{}{"uno": "un"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(id).To(Equal("1-0"))

			// Values supports []interface{}.
			id, err = client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				ID:     "2-0",
				Values: []interface{}{"dos", "deux"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(id).To(Equal("2-0"))

			// Value supports []string.
			id, err = client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				ID:     "3-0",
				Values: []string{"tres", "troix"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(id).To(Equal("3-0"))
		})

		// TODO remove in v9.
		It("should XTrim", func() {
			n, err := client.XTrim(ctx, "stream", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		// TODO remove in v9.
		It("should XTrimApprox", func() {
			n, err := client.XTrimApprox(ctx, "stream", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		// TODO XTrimMaxLenApprox/XTrimMinIDApprox There is a bug in the limit parameter.
		// TODO Don't test it for now.
		// TODO link: https://github.com/redis/redis/issues/9046
		It("should XTrimMaxLen", func() {
			n, err := client.XTrimMaxLen(ctx, "stream", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XTrimMaxLenApprox", func() {
			n, err := client.XTrimMaxLenApprox(ctx, "stream", 0, 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XTrimMinID", func() {
			n, err := client.XTrimMinID(ctx, "stream", "4-0").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XTrimMinIDApprox", func() {
			n, err := client.XTrimMinIDApprox(ctx, "stream", "4-0", 0).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XAdd", func() {
			id, err := client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				Values: map[string]interface{}{"quatro": "quatre"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.XRange(ctx, "stream", "-", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.XMessage{
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
				{ID: id, Values: map[string]interface{}{"quatro": "quatre"}},
			}))
		})

		// TODO XAdd There is a bug in the limit parameter.
		// TODO Don't test it for now.
		// TODO link: https://github.com/redis/redis/issues/9046
		It("should XAdd with MaxLen", func() {
			id, err := client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				MaxLen: 1,
				Values: map[string]interface{}{"quatro": "quatre"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())

			vals, err := client.XRange(ctx, "stream", "-", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]redis.XMessage{
				{ID: id, Values: map[string]interface{}{"quatro": "quatre"}},
			}))
		})

		It("should XAdd with MinID", func() {
			id, err := client.XAdd(ctx, &redis.XAddArgs{
				Stream: "stream",
				MinID:  "5-0",
				ID:     "4-0",
				Values: map[string]interface{}{"quatro": "quatre"},
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(id).To(Equal("4-0"))

			vals, err := client.XRange(ctx, "stream", "-", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(HaveLen(0))
		})

		It("should XDel", func() {
			n, err := client.XDel(ctx, "stream", "1-0", "2-0", "3-0").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XLen", func() {
			n, err := client.XLen(ctx, "stream").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(3)))
		})

		It("should XRange", func() {
			msgs, err := client.XRange(ctx, "stream", "-", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
			}))

			msgs, err = client.XRange(ctx, "stream", "2", "+").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
			}))

			msgs, err = client.XRange(ctx, "stream", "-", "2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
			}))
		})

		It("should XRangeN", func() {
			msgs, err := client.XRangeN(ctx, "stream", "-", "+", 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
			}))

			msgs, err = client.XRangeN(ctx, "stream", "2", "+", 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
			}))

			msgs, err = client.XRangeN(ctx, "stream", "-", "2", 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
			}))
		})

		It("should XRevRange", func() {
			msgs, err := client.XRevRange(ctx, "stream", "+", "-").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
				{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
			}))

			msgs, err = client.XRevRange(ctx, "stream", "+", "2").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
			}))
		})

		It("should XRevRangeN", func() {
			msgs, err := client.XRevRangeN(ctx, "stream", "+", "-", 2).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
				{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
			}))

			msgs, err = client.XRevRangeN(ctx, "stream", "+", "2", 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(msgs).To(Equal([]redis.XMessage{
				{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
			}))
		})

		It("should XRead", func() {
			res, err := client.XReadStreams(ctx, "stream", "0").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(Equal([]redis.XStream{
				{
					Stream: "stream",
					Messages: []redis.XMessage{
						{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
						{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
						{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
					},
				},
			}))

			_, err = client.XReadStreams(ctx, "stream", "3").Result()
			Expect(err).To(Equal(redis.Nil))
		})

		It("should XRead", func() {
			res, err := client.XRead(ctx, &redis.XReadArgs{
				Streams: []string{"stream", "0"},
				Count:   2,
				Block:   100 * time.Millisecond,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(Equal([]redis.XStream{
				{
					Stream: "stream",
					Messages: []redis.XMessage{
						{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
						{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
					},
				},
			}))

			_, err = client.XRead(ctx, &redis.XReadArgs{
				Streams: []string{"stream", "3"},
				Count:   1,
				Block:   100 * time.Millisecond,
			}).Result()
			Expect(err).To(Equal(redis.Nil))
		})

		Describe("group", func() {
			BeforeEach(func() {
				err := client.XGroupCreate(ctx, "stream", "group", "0").Err()
				Expect(err).NotTo(HaveOccurred())

				res, err := client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    "group",
					Consumer: "consumer",
					Streams:  []string{"stream", ">"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XStream{
					{
						Stream: "stream",
						Messages: []redis.XMessage{
							{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
							{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
							{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
						},
					},
				}))
			})

			AfterEach(func() {
				n, err := client.XGroupDestroy(ctx, "stream", "group").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))
			})

			It("should XReadGroup skip empty", func() {
				n, err := client.XDel(ctx, "stream", "2-0").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))

				res, err := client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    "group",
					Consumer: "consumer",
					Streams:  []string{"stream", "0"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XStream{
					{
						Stream: "stream",
						Messages: []redis.XMessage{
							{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
							{ID: "2-0", Values: nil},
							{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
						},
					},
				}))
			})

			It("should XGroupCreateMkStream", func() {
				err := client.XGroupCreateMkStream(ctx, "stream2", "group", "0").Err()
				Expect(err).NotTo(HaveOccurred())

				err = client.XGroupCreateMkStream(ctx, "stream2", "group", "0").Err()
				Expect(err).To(Equal(proto.RedisError("BUSYGROUP Consumer Group name already exists")))

				n, err := client.XGroupDestroy(ctx, "stream2", "group").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))

				n, err = client.Del(ctx, "stream2").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))
			})

			It("should XPending", func() {
				info, err := client.XPending(ctx, "stream", "group").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(info).To(Equal(&redis.XPending{
					Count:     3,
					Lower:     "1-0",
					Higher:    "3-0",
					Consumers: map[string]int64{"consumer": 3},
				}))
				args := &redis.XPendingExtArgs{
					Stream:   "stream",
					Group:    "group",
					Start:    "-",
					End:      "+",
					Count:    10,
					Consumer: "consumer",
				}
				infoExt, err := client.XPendingExt(ctx, args).Result()
				Expect(err).NotTo(HaveOccurred())
				for i := range infoExt {
					infoExt[i].Idle = 0
				}
				Expect(infoExt).To(Equal([]redis.XPendingExt{
					{ID: "1-0", Consumer: "consumer", Idle: 0, RetryCount: 1},
					{ID: "2-0", Consumer: "consumer", Idle: 0, RetryCount: 1},
					{ID: "3-0", Consumer: "consumer", Idle: 0, RetryCount: 1},
				}))

				args.Idle = 72 * time.Hour
				infoExt, err = client.XPendingExt(ctx, args).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(infoExt).To(HaveLen(0))
			})

			It("should XGroup Create Delete Consumer", func() {
				n, err := client.XGroupCreateConsumer(ctx, "stream", "group", "c1").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))

				n, err = client.XGroupDelConsumer(ctx, "stream", "group", "consumer").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(3)))
			})

			It("should XAutoClaim", func() {
				xca := &redis.XAutoClaimArgs{
					Stream:   "stream",
					Group:    "group",
					Consumer: "consumer",
					Start:    "-",
					Count:    2,
				}
				msgs, start, err := client.XAutoClaim(ctx, xca).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(start).To(Equal("3-0"))
				Expect(msgs).To(Equal([]redis.XMessage{{
					ID:     "1-0",
					Values: map[string]interface{}{"uno": "un"},
				}, {
					ID:     "2-0",
					Values: map[string]interface{}{"dos": "deux"},
				}}))

				xca.Start = start
				msgs, start, err = client.XAutoClaim(ctx, xca).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(start).To(Equal("0-0"))
				Expect(msgs).To(Equal([]redis.XMessage{{
					ID:     "3-0",
					Values: map[string]interface{}{"tres": "troix"},
				}}))

				ids, start, err := client.XAutoClaimJustID(ctx, xca).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(start).To(Equal("0-0"))
				Expect(ids).To(Equal([]string{"3-0"}))
			})

			It("should XClaim", func() {
				msgs, err := client.XClaim(ctx, &redis.XClaimArgs{
					Stream:   "stream",
					Group:    "group",
					Consumer: "consumer",
					Messages: []string{"1-0", "2-0", "3-0"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(msgs).To(Equal([]redis.XMessage{{
					ID:     "1-0",
					Values: map[string]interface{}{"uno": "un"},
				}, {
					ID:     "2-0",
					Values: map[string]interface{}{"dos": "deux"},
				}, {
					ID:     "3-0",
					Values: map[string]interface{}{"tres": "troix"},
				}}))

				ids, err := client.XClaimJustID(ctx, &redis.XClaimArgs{
					Stream:   "stream",
					Group:    "group",
					Consumer: "consumer",
					Messages: []string{"1-0", "2-0", "3-0"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(ids).To(Equal([]string{"1-0", "2-0", "3-0"}))
			})

			It("should XAck", func() {
				n, err := client.XAck(ctx, "stream", "group", "1-0", "2-0", "4-0").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(2)))
			})
		})

		Describe("xinfo", func() {
			BeforeEach(func() {
				err := client.XGroupCreate(ctx, "stream", "group1", "0").Err()
				Expect(err).NotTo(HaveOccurred())

				res, err := client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    "group1",
					Consumer: "consumer1",
					Streams:  []string{"stream", ">"},
					Count:    2,
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XStream{
					{
						Stream: "stream",
						Messages: []redis.XMessage{
							{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
							{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
						},
					},
				}))

				res, err = client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    "group1",
					Consumer: "consumer2",
					Streams:  []string{"stream", ">"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XStream{
					{
						Stream: "stream",
						Messages: []redis.XMessage{
							{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
						},
					},
				}))

				err = client.XGroupCreate(ctx, "stream", "group2", "1-0").Err()
				Expect(err).NotTo(HaveOccurred())

				res, err = client.XReadGroup(ctx, &redis.XReadGroupArgs{
					Group:    "group2",
					Consumer: "consumer1",
					Streams:  []string{"stream", ">"},
				}).Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XStream{
					{
						Stream: "stream",
						Messages: []redis.XMessage{
							{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
							{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
						},
					},
				}))
			})

			AfterEach(func() {
				n, err := client.XGroupDestroy(ctx, "stream", "group1").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))
				n, err = client.XGroupDestroy(ctx, "stream", "group2").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(1)))
			})

			It("should XINFO STREAM", func() {
				res, err := client.XInfoStream(ctx, "stream").Result()
				Expect(err).NotTo(HaveOccurred())
				res.RadixTreeKeys = 0
				res.RadixTreeNodes = 0

				Expect(res).To(Equal(&redis.XInfoStream{
					Length:          3,
					RadixTreeKeys:   0,
					RadixTreeNodes:  0,
					Groups:          2,
					LastGeneratedID: "3-0",
					FirstEntry:      redis.XMessage{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
					LastEntry:       redis.XMessage{ID: "3-0", Values: map[string]interface{}{"tres": "troix"}},
				}))

				// stream is empty
				n, err := client.XDel(ctx, "stream", "1-0", "2-0", "3-0").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(n).To(Equal(int64(3)))

				res, err = client.XInfoStream(ctx, "stream").Result()
				Expect(err).NotTo(HaveOccurred())
				res.RadixTreeKeys = 0
				res.RadixTreeNodes = 0

				Expect(res).To(Equal(&redis.XInfoStream{
					Length:          0,
					RadixTreeKeys:   0,
					RadixTreeNodes:  0,
					Groups:          2,
					LastGeneratedID: "3-0",
					FirstEntry:      redis.XMessage{},
					LastEntry:       redis.XMessage{},
				}))
			})

			It("should XINFO STREAM FULL", func() {
				res, err := client.XInfoStreamFull(ctx, "stream", 2).Result()
				Expect(err).NotTo(HaveOccurred())
				res.RadixTreeKeys = 0
				res.RadixTreeNodes = 0

				// Verify DeliveryTime
				now := time.Now()
				maxElapsed := 10 * time.Minute
				for k, g := range res.Groups {
					for k2, p := range g.Pending {
						Expect(now.Sub(p.DeliveryTime)).To(BeNumerically("<=", maxElapsed))
						res.Groups[k].Pending[k2].DeliveryTime = time.Time{}
					}
					for k3, c := range g.Consumers {
						Expect(now.Sub(c.SeenTime)).To(BeNumerically("<=", maxElapsed))
						res.Groups[k].Consumers[k3].SeenTime = time.Time{}

						for k4, p := range c.Pending {
							Expect(now.Sub(p.DeliveryTime)).To(BeNumerically("<=", maxElapsed))
							res.Groups[k].Consumers[k3].Pending[k4].DeliveryTime = time.Time{}
						}
					}
				}

				Expect(res).To(Equal(&redis.XInfoStreamFull{
					Length:          3,
					RadixTreeKeys:   0,
					RadixTreeNodes:  0,
					LastGeneratedID: "3-0",
					Entries: []redis.XMessage{
						{ID: "1-0", Values: map[string]interface{}{"uno": "un"}},
						{ID: "2-0", Values: map[string]interface{}{"dos": "deux"}},
					},
					Groups: []redis.XInfoStreamGroup{
						{
							Name:            "group1",
							LastDeliveredID: "3-0",
							PelCount:        3,
							Pending: []redis.XInfoStreamGroupPending{
								{
									ID:            "1-0",
									Consumer:      "consumer1",
									DeliveryTime:  time.Time{},
									DeliveryCount: 1,
								},
								{
									ID:            "2-0",
									Consumer:      "consumer1",
									DeliveryTime:  time.Time{},
									DeliveryCount: 1,
								},
							},
							Consumers: []redis.XInfoStreamConsumer{
								{
									Name:     "consumer1",
									SeenTime: time.Time{},
									PelCount: 2,
									Pending: []redis.XInfoStreamConsumerPending{
										{
											ID:            "1-0",
											DeliveryTime:  time.Time{},
											DeliveryCount: 1,
										},
										{
											ID:            "2-0",
											DeliveryTime:  time.Time{},
											DeliveryCount: 1,
										},
									},
								},
								{
									Name:     "consumer2",
									SeenTime: time.Time{},
									PelCount: 1,
									Pending: []redis.XInfoStreamConsumerPending{
										{
											ID:            "3-0",
											DeliveryTime:  time.Time{},
											DeliveryCount: 1,
										},
									},
								},
							},
						},
						{
							Name:            "group2",
							LastDeliveredID: "3-0",
							PelCount:        2,
							Pending: []redis.XInfoStreamGroupPending{
								{
									ID:            "2-0",
									Consumer:      "consumer1",
									DeliveryTime:  time.Time{},
									DeliveryCount: 1,
								},
								{
									ID:            "3-0",
									Consumer:      "consumer1",
									DeliveryTime:  time.Time{},
									DeliveryCount: 1,
								},
							},
							Consumers: []redis.XInfoStreamConsumer{
								{
									Name:     "consumer1",
									SeenTime: time.Time{},
									PelCount: 2,
									Pending: []redis.XInfoStreamConsumerPending{
										{
											ID:            "2-0",
											DeliveryTime:  time.Time{},
											DeliveryCount: 1,
										},
										{
											ID:            "3-0",
											DeliveryTime:  time.Time{},
											DeliveryCount: 1,
										},
									},
								},
							},
						},
					},
				}))
			})

			It("should XINFO GROUPS", func() {
				res, err := client.XInfoGroups(ctx, "stream").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(res).To(Equal([]redis.XInfoGroup{
					{Name: "group1", Consumers: 2, Pending: 3, LastDeliveredID: "3-0"},
					{Name: "group2", Consumers: 1, Pending: 2, LastDeliveredID: "3-0"},
				}))
			})

			It("should XINFO CONSUMERS", func() {
				res, err := client.XInfoConsumers(ctx, "stream", "group1").Result()
				Expect(err).NotTo(HaveOccurred())
				for i := range res {
					res[i].Idle = 0
				}
				Expect(res).To(Equal([]redis.XInfoConsumer{
					{Name: "consumer1", Pending: 2, Idle: 0},
					{Name: "consumer2", Pending: 1, Idle: 0},
				}))
			})
		})
	})

	Describe("Geo add and radius search", func() {
		BeforeEach(func() {
			n, err := client.GeoAdd(
				ctx,
				"Sicily",
				&redis.GeoLocation{Longitude: 13.361389, Latitude: 38.115556, Name: "Palermo"},
				&redis.GeoLocation{Longitude: 15.087269, Latitude: 37.502669, Name: "Catania"},
			).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))
		})

		It("should not add same geo location", func() {
			geoAdd := client.GeoAdd(
				ctx,
				"Sicily",
				&redis.GeoLocation{Longitude: 13.361389, Latitude: 38.115556, Name: "Palermo"},
			)
			Expect(geoAdd.Err()).NotTo(HaveOccurred())
			Expect(geoAdd.Val()).To(Equal(int64(0)))
		})

		It("should search geo radius", func() {
			res, err := client.GeoRadius(ctx, "Sicily", 15, 37, &redis.GeoRadiusQuery{
				Radius: 200,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(2))
			Expect(res[0].Name).To(Equal("Palermo"))
			Expect(res[1].Name).To(Equal("Catania"))
		})

		It("should geo radius and store the result", func() {
			n, err := client.GeoRadiusStore(ctx, "Sicily", 15, 37, &redis.GeoRadiusQuery{
				Radius: 200,
				Store:  "result",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))

			res, err := client.ZRangeWithScores(ctx, "result", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(ContainElement(redis.Z{
				Score:  3.479099956230698e+15,
				Member: "Palermo",
			}))
			Expect(res).To(ContainElement(redis.Z{
				Score:  3.479447370796909e+15,
				Member: "Catania",
			}))
		})

		It("should geo radius and store dist", func() {
			n, err := client.GeoRadiusStore(ctx, "Sicily", 15, 37, &redis.GeoRadiusQuery{
				Radius:    200,
				StoreDist: "result",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(2)))

			res, err := client.ZRangeWithScores(ctx, "result", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(ContainElement(redis.Z{
				Score:  190.44242984775784,
				Member: "Palermo",
			}))
			Expect(res).To(ContainElement(redis.Z{
				Score:  56.4412578701582,
				Member: "Catania",
			}))
		})

		It("should search geo radius with options", func() {
			res, err := client.GeoRadius(ctx, "Sicily", 15, 37, &redis.GeoRadiusQuery{
				Radius:      200,
				Unit:        "km",
				WithGeoHash: true,
				WithCoord:   true,
				WithDist:    true,
				Count:       2,
				Sort:        "ASC",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(2))
			Expect(res[1].Name).To(Equal("Palermo"))
			Expect(res[1].Dist).To(Equal(190.4424))
			Expect(res[1].GeoHash).To(Equal(int64(3479099956230698)))
			Expect(res[1].Longitude).To(Equal(13.361389338970184))
			Expect(res[1].Latitude).To(Equal(38.115556395496299))
			Expect(res[0].Name).To(Equal("Catania"))
			Expect(res[0].Dist).To(Equal(56.4413))
			Expect(res[0].GeoHash).To(Equal(int64(3479447370796909)))
			Expect(res[0].Longitude).To(Equal(15.087267458438873))
			Expect(res[0].Latitude).To(Equal(37.50266842333162))
		})

		It("should search geo radius with WithDist=false", func() {
			res, err := client.GeoRadius(ctx, "Sicily", 15, 37, &redis.GeoRadiusQuery{
				Radius:      200,
				Unit:        "km",
				WithGeoHash: true,
				WithCoord:   true,
				Count:       2,
				Sort:        "ASC",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(2))
			Expect(res[1].Name).To(Equal("Palermo"))
			Expect(res[1].Dist).To(Equal(float64(0)))
			Expect(res[1].GeoHash).To(Equal(int64(3479099956230698)))
			Expect(res[1].Longitude).To(Equal(13.361389338970184))
			Expect(res[1].Latitude).To(Equal(38.115556395496299))
			Expect(res[0].Name).To(Equal("Catania"))
			Expect(res[0].Dist).To(Equal(float64(0)))
			Expect(res[0].GeoHash).To(Equal(int64(3479447370796909)))
			Expect(res[0].Longitude).To(Equal(15.087267458438873))
			Expect(res[0].Latitude).To(Equal(37.50266842333162))
		})

		It("should search geo radius by member with options", func() {
			res, err := client.GeoRadiusByMember(ctx, "Sicily", "Catania", &redis.GeoRadiusQuery{
				Radius:      200,
				Unit:        "km",
				WithGeoHash: true,
				WithCoord:   true,
				WithDist:    true,
				Count:       2,
				Sort:        "ASC",
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(2))
			Expect(res[0].Name).To(Equal("Catania"))
			Expect(res[0].Dist).To(Equal(0.0))
			Expect(res[0].GeoHash).To(Equal(int64(3479447370796909)))
			Expect(res[0].Longitude).To(Equal(15.087267458438873))
			Expect(res[0].Latitude).To(Equal(37.50266842333162))
			Expect(res[1].Name).To(Equal("Palermo"))
			Expect(res[1].Dist).To(Equal(166.2742))
			Expect(res[1].GeoHash).To(Equal(int64(3479099956230698)))
			Expect(res[1].Longitude).To(Equal(13.361389338970184))
			Expect(res[1].Latitude).To(Equal(38.115556395496299))
		})

		It("should search geo radius with no results", func() {
			res, err := client.GeoRadius(ctx, "Sicily", 99, 37, &redis.GeoRadiusQuery{
				Radius:      200,
				Unit:        "km",
				WithGeoHash: true,
				WithCoord:   true,
				WithDist:    true,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(0))
		})

		It("should get geo distance with unit options", func() {
			// From Redis CLI, note the difference in rounding in m vs
			// km on Redis itself.
			//
			// GEOADD Sicily 13.361389 38.115556 "Palermo" 15.087269 37.502669 "Catania"
			// GEODIST Sicily Palermo Catania m
			// "166274.15156960033"
			// GEODIST Sicily Palermo Catania km
			// "166.27415156960032"
			dist, err := client.GeoDist(ctx, "Sicily", "Palermo", "Catania", "km").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(dist).To(BeNumerically("~", 166.27, 0.01))

			dist, err = client.GeoDist(ctx, "Sicily", "Palermo", "Catania", "m").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(dist).To(BeNumerically("~", 166274.15, 0.01))
		})

		It("should get geo hash in string representation", func() {
			hashes, err := client.GeoHash(ctx, "Sicily", "Palermo", "Catania").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(hashes).To(ConsistOf([]string{"sqc8b49rny0", "sqdtr74hyu0"}))
		})

		It("should return geo position", func() {
			pos, err := client.GeoPos(ctx, "Sicily", "Palermo", "Catania", "NonExisting").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(pos).To(ConsistOf([]*redis.GeoPos{
				{
					Longitude: 13.361389338970184,
					Latitude:  38.1155563954963,
				},
				{
					Longitude: 15.087267458438873,
					Latitude:  37.50266842333162,
				},
				nil,
			}))
		})

		It("should geo search", func() {
			q := &redis.GeoSearchQuery{
				Member:    "Catania",
				BoxWidth:  400,
				BoxHeight: 100,
				BoxUnit:   "km",
				Sort:      "asc",
			}
			val, err := client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.BoxHeight = 400
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania", "Palermo"}))

			q.Count = 1
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.CountAny = true
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Palermo"}))

			q = &redis.GeoSearchQuery{
				Member:     "Catania",
				Radius:     100,
				RadiusUnit: "km",
				Sort:       "asc",
			}
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.Radius = 400
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania", "Palermo"}))

			q.Count = 1
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.CountAny = true
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Palermo"}))

			q = &redis.GeoSearchQuery{
				Longitude: 15,
				Latitude:  37,
				BoxWidth:  200,
				BoxHeight: 200,
				BoxUnit:   "km",
				Sort:      "asc",
			}
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.BoxWidth, q.BoxHeight = 400, 400
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania", "Palermo"}))

			q.Count = 1
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.CountAny = true
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Palermo"}))

			q = &redis.GeoSearchQuery{
				Longitude:  15,
				Latitude:   37,
				Radius:     100,
				RadiusUnit: "km",
				Sort:       "asc",
			}
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.Radius = 200
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania", "Palermo"}))

			q.Count = 1
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Catania"}))

			q.CountAny = true
			val, err = client.GeoSearch(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]string{"Palermo"}))
		})

		It("should geo search with options", func() {
			q := &redis.GeoSearchLocationQuery{
				GeoSearchQuery: redis.GeoSearchQuery{
					Longitude:  15,
					Latitude:   37,
					Radius:     200,
					RadiusUnit: "km",
					Sort:       "asc",
				},
				WithHash:  true,
				WithDist:  true,
				WithCoord: true,
			}
			val, err := client.GeoSearchLocation(ctx, "Sicily", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal([]redis.GeoLocation{
				{
					Name:      "Catania",
					Longitude: 15.08726745843887329,
					Latitude:  37.50266842333162032,
					Dist:      56.4413,
					GeoHash:   3479447370796909,
				},
				{
					Name:      "Palermo",
					Longitude: 13.36138933897018433,
					Latitude:  38.11555639549629859,
					Dist:      190.4424,
					GeoHash:   3479099956230698,
				},
			}))
		})

		It("should geo search store", func() {
			q := &redis.GeoSearchStoreQuery{
				GeoSearchQuery: redis.GeoSearchQuery{
					Longitude:  15,
					Latitude:   37,
					Radius:     200,
					RadiusUnit: "km",
					Sort:       "asc",
				},
				StoreDist: false,
			}

			val, err := client.GeoSearchStore(ctx, "Sicily", "key1", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal(int64(2)))

			q.StoreDist = true
			val, err = client.GeoSearchStore(ctx, "Sicily", "key2", q).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(val).To(Equal(int64(2)))

			loc, err := client.GeoSearchLocation(ctx, "key1", &redis.GeoSearchLocationQuery{
				GeoSearchQuery: q.GeoSearchQuery,
				WithCoord:      true,
				WithDist:       true,
				WithHash:       true,
			}).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(loc).To(Equal([]redis.GeoLocation{
				{
					Name:      "Catania",
					Longitude: 15.08726745843887329,
					Latitude:  37.50266842333162032,
					Dist:      56.4413,
					GeoHash:   3479447370796909,
				},
				{
					Name:      "Palermo",
					Longitude: 13.36138933897018433,
					Latitude:  38.11555639549629859,
					Dist:      190.4424,
					GeoHash:   3479099956230698,
				},
			}))

			v, err := client.ZRangeWithScores(ctx, "key2", 0, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal([]redis.Z{
				{
					Score:  56.441257870158204,
					Member: "Catania",
				},
				{
					Score:  190.44242984775784,
					Member: "Palermo",
				},
			}))
		})
	})

	Describe("marshaling/unmarshaling", func() {
		type convTest struct {
			value  interface{}
			wanted string
			dest   interface{}
		}

		convTests := []convTest{
			{nil, "", nil},
			{"hello", "hello", new(string)},
			{[]byte("hello"), "hello", new([]byte)},
			{int(1), "1", new(int)},
			{int8(1), "1", new(int8)},
			{int16(1), "1", new(int16)},
			{int32(1), "1", new(int32)},
			{int64(1), "1", new(int64)},
			{uint(1), "1", new(uint)},
			{uint8(1), "1", new(uint8)},
			{uint16(1), "1", new(uint16)},
			{uint32(1), "1", new(uint32)},
			{uint64(1), "1", new(uint64)},
			{float32(1.0), "1", new(float32)},
			{float64(1.0), "1", new(float64)},
			{true, "1", new(bool)},
			{false, "0", new(bool)},
		}

		It("should convert to string", func() {
			for _, test := range convTests {
				err := client.Set(ctx, "key", test.value, 0).Err()
				Expect(err).NotTo(HaveOccurred())

				s, err := client.Get(ctx, "key").Result()
				Expect(err).NotTo(HaveOccurred())
				Expect(s).To(Equal(test.wanted))

				if test.dest == nil {
					continue
				}

				err = client.Get(ctx, "key").Scan(test.dest)
				Expect(err).NotTo(HaveOccurred())
				Expect(deref(test.dest)).To(Equal(test.value))
			}
		})
	})

	Describe("json marshaling/unmarshaling", func() {
		BeforeEach(func() {
			value := &numberStruct{Number: 42}
			err := client.Set(ctx, "key", value, 0).Err()
			Expect(err).NotTo(HaveOccurred())
		})

		It("should marshal custom values using json", func() {
			s, err := client.Get(ctx, "key").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(s).To(Equal(`{"Number":42}`))
		})

		It("should scan custom values using json", func() {
			value := &numberStruct{}
			err := client.Get(ctx, "key").Scan(value)
			Expect(err).NotTo(HaveOccurred())
			Expect(value.Number).To(Equal(42))
		})
	})

	Describe("Eval", func() {
		It("returns keys and values", func() {
			vals, err := client.Eval(
				ctx,
				"return {KEYS[1],ARGV[1]}",
				[]string{"key"},
				"hello",
			).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]interface{}{"key", "hello"}))
		})

		It("returns all values after an error", func() {
			vals, err := client.Eval(
				ctx,
				`return {12, {err="error"}, "abc"}`,
				nil,
			).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(vals).To(Equal([]interface{}{int64(12), proto.RedisError("error"), "abc"}))
		})
	})

	Describe("SlowLogGet", func() {
		It("returns slow query result", func() {
			const key = "slowlog-log-slower-than"

			old := client.ConfigGet(ctx, key).Val()
			client.ConfigSet(ctx, key, "0")
			defer client.ConfigSet(ctx, key, old[1].(string))

			err := client.Do(ctx, "slowlog", "reset").Err()
			Expect(err).NotTo(HaveOccurred())

			client.Set(ctx, "test", "true", 0)

			result, err := client.SlowLogGet(ctx, -1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(result)).NotTo(BeZero())
		})
	})
})

type numberStruct struct {
	Number int
}

func (s *numberStruct) MarshalBinary() ([]byte, error) {
	return json.Marshal(s)
}

func (s *numberStruct) UnmarshalBinary(b []byte) error {
	return json.Unmarshal(b, s)
}

func deref(viface interface{}) interface{} {
	v := reflect.ValueOf(viface)
	for v.Kind() == reflect.Ptr {
		v = v.Elem()
	}
	return v.Interface()
}
