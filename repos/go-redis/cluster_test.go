package redis_test

import (
	"context"
	"fmt"
	"net"
	"strconv"
	"strings"
	"sync"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8"
	"github.com/go-redis/redis/v8/internal/hashtag"
)

type clusterScenario struct {
	ports     []string
	nodeIDs   []string
	processes map[string]*redisProcess
	clients   map[string]*redis.Client
}

func (s *clusterScenario) masters() []*redis.Client {
	result := make([]*redis.Client, 3)
	for pos, port := range s.ports[:3] {
		result[pos] = s.clients[port]
	}
	return result
}

func (s *clusterScenario) slaves() []*redis.Client {
	result := make([]*redis.Client, 3)
	for pos, port := range s.ports[3:] {
		result[pos] = s.clients[port]
	}
	return result
}

func (s *clusterScenario) addrs() []string {
	addrs := make([]string, len(s.ports))
	for i, port := range s.ports {
		addrs[i] = net.JoinHostPort("127.0.0.1", port)
	}
	return addrs
}

func (s *clusterScenario) newClusterClientUnstable(opt *redis.ClusterOptions) *redis.ClusterClient {
	opt.Addrs = s.addrs()
	return redis.NewClusterClient(opt)
}

func (s *clusterScenario) newClusterClient(
	ctx context.Context, opt *redis.ClusterOptions,
) *redis.ClusterClient {
	client := s.newClusterClientUnstable(opt)

	err := eventually(func() error {
		if opt.ClusterSlots != nil {
			return nil
		}

		state, err := client.LoadState(ctx)
		if err != nil {
			return err
		}

		if !state.IsConsistent(ctx) {
			return fmt.Errorf("cluster state is not consistent")
		}

		return nil
	}, 30*time.Second)
	if err != nil {
		panic(err)
	}

	return client
}

func (s *clusterScenario) Close() error {
	for _, port := range s.ports {
		processes[port].Close()
		delete(processes, port)
	}
	return nil
}

func startCluster(ctx context.Context, scenario *clusterScenario) error {
	// Start processes and collect node ids
	for pos, port := range scenario.ports {
		process, err := startRedis(port, "--cluster-enabled", "yes")
		if err != nil {
			return err
		}

		client := redis.NewClient(&redis.Options{
			Addr: ":" + port,
		})

		info, err := client.ClusterNodes(ctx).Result()
		if err != nil {
			return err
		}

		scenario.processes[port] = process
		scenario.clients[port] = client
		scenario.nodeIDs[pos] = info[:40]
	}

	// Meet cluster nodes.
	for _, client := range scenario.clients {
		err := client.ClusterMeet(ctx, "127.0.0.1", scenario.ports[0]).Err()
		if err != nil {
			return err
		}
	}

	// Bootstrap masters.
	slots := []int{0, 5000, 10000, 16384}
	for pos, master := range scenario.masters() {
		err := master.ClusterAddSlotsRange(ctx, slots[pos], slots[pos+1]-1).Err()
		if err != nil {
			return err
		}
	}

	// Bootstrap slaves.
	for idx, slave := range scenario.slaves() {
		masterID := scenario.nodeIDs[idx]

		// Wait until master is available
		err := eventually(func() error {
			s := slave.ClusterNodes(ctx).Val()
			wanted := masterID
			if !strings.Contains(s, wanted) {
				return fmt.Errorf("%q does not contain %q", s, wanted)
			}
			return nil
		}, 10*time.Second)
		if err != nil {
			return err
		}

		err = slave.ClusterReplicate(ctx, masterID).Err()
		if err != nil {
			return err
		}
	}

	// Wait until all nodes have consistent info.
	wanted := []redis.ClusterSlot{{
		Start: 0,
		End:   4999,
		Nodes: []redis.ClusterNode{{
			ID:   "",
			Addr: "127.0.0.1:8220",
		}, {
			ID:   "",
			Addr: "127.0.0.1:8223",
		}},
	}, {
		Start: 5000,
		End:   9999,
		Nodes: []redis.ClusterNode{{
			ID:   "",
			Addr: "127.0.0.1:8221",
		}, {
			ID:   "",
			Addr: "127.0.0.1:8224",
		}},
	}, {
		Start: 10000,
		End:   16383,
		Nodes: []redis.ClusterNode{{
			ID:   "",
			Addr: "127.0.0.1:8222",
		}, {
			ID:   "",
			Addr: "127.0.0.1:8225",
		}},
	}}
	for _, client := range scenario.clients {
		err := eventually(func() error {
			res, err := client.ClusterSlots(ctx).Result()
			if err != nil {
				return err
			}
			return assertSlotsEqual(res, wanted)
		}, 30*time.Second)
		if err != nil {
			return err
		}
	}

	return nil
}

func assertSlotsEqual(slots, wanted []redis.ClusterSlot) error {
outerLoop:
	for _, s2 := range wanted {
		for _, s1 := range slots {
			if slotEqual(s1, s2) {
				continue outerLoop
			}
		}
		return fmt.Errorf("%v not found in %v", s2, slots)
	}
	return nil
}

func slotEqual(s1, s2 redis.ClusterSlot) bool {
	if s1.Start != s2.Start {
		return false
	}
	if s1.End != s2.End {
		return false
	}
	if len(s1.Nodes) != len(s2.Nodes) {
		return false
	}
	for i, n1 := range s1.Nodes {
		if n1.Addr != s2.Nodes[i].Addr {
			return false
		}
	}
	return true
}

//------------------------------------------------------------------------------

var _ = Describe("ClusterClient", func() {
	var failover bool
	var opt *redis.ClusterOptions
	var client *redis.ClusterClient

	assertClusterClient := func() {
		It("supports WithContext", func() {
			ctx, cancel := context.WithCancel(ctx)
			cancel()

			err := client.Ping(ctx).Err()
			Expect(err).To(MatchError("context canceled"))
		})

		It("should GET/SET/DEL", func() {
			err := client.Get(ctx, "A").Err()
			Expect(err).To(Equal(redis.Nil))

			err = client.Set(ctx, "A", "VALUE", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			Eventually(func() string {
				return client.Get(ctx, "A").Val()
			}, 30*time.Second).Should(Equal("VALUE"))

			cnt, err := client.Del(ctx, "A").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(cnt).To(Equal(int64(1)))
		})

		It("GET follows redirects", func() {
			err := client.Set(ctx, "A", "VALUE", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			if !failover {
				Eventually(func() int64 {
					nodes, err := client.Nodes(ctx, "A")
					if err != nil {
						return 0
					}
					return nodes[1].Client.DBSize(ctx).Val()
				}, 30*time.Second).Should(Equal(int64(1)))

				Eventually(func() error {
					return client.SwapNodes(ctx, "A")
				}, 30*time.Second).ShouldNot(HaveOccurred())
			}

			v, err := client.Get(ctx, "A").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal("VALUE"))
		})

		It("SET follows redirects", func() {
			if !failover {
				Eventually(func() error {
					return client.SwapNodes(ctx, "A")
				}, 30*time.Second).ShouldNot(HaveOccurred())
			}

			err := client.Set(ctx, "A", "VALUE", 0).Err()
			Expect(err).NotTo(HaveOccurred())

			v, err := client.Get(ctx, "A").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(v).To(Equal("VALUE"))
		})

		It("distributes keys", func() {
			for i := 0; i < 100; i++ {
				err := client.Set(ctx, fmt.Sprintf("key%d", i), "value", 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}

			client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				defer GinkgoRecover()
				Eventually(func() string {
					return master.Info(ctx, "keyspace").Val()
				}, 30*time.Second).Should(Or(
					ContainSubstring("keys=31"),
					ContainSubstring("keys=29"),
					ContainSubstring("keys=40"),
				))
				return nil
			})
		})

		It("distributes keys when using EVAL", func() {
			script := redis.NewScript(`
				local r = redis.call('SET', KEYS[1], ARGV[1])
				return r
			`)

			var key string
			for i := 0; i < 100; i++ {
				key = fmt.Sprintf("key%d", i)
				err := script.Run(ctx, client, []string{key}, "value").Err()
				Expect(err).NotTo(HaveOccurred())
			}

			client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				defer GinkgoRecover()
				Eventually(func() string {
					return master.Info(ctx, "keyspace").Val()
				}, 30*time.Second).Should(Or(
					ContainSubstring("keys=31"),
					ContainSubstring("keys=29"),
					ContainSubstring("keys=40"),
				))
				return nil
			})
		})

		It("distributes scripts when using Script Load", func() {
			client.ScriptFlush(ctx)

			script := redis.NewScript(`return 'Unique script'`)

			script.Load(ctx, client)

			client.ForEachShard(ctx, func(ctx context.Context, shard *redis.Client) error {
				defer GinkgoRecover()

				val, _ := script.Exists(ctx, shard).Result()
				Expect(val[0]).To(Equal(true))
				return nil
			})
		})

		It("checks all shards when using Script Exists", func() {
			client.ScriptFlush(ctx)

			script := redis.NewScript(`return 'First script'`)
			lostScriptSrc := `return 'Lost script'`
			lostScript := redis.NewScript(lostScriptSrc)

			script.Load(ctx, client)
			client.Do(ctx, "script", "load", lostScriptSrc)

			val, _ := client.ScriptExists(ctx, script.Hash(), lostScript.Hash()).Result()

			Expect(val).To(Equal([]bool{true, false}))
		})

		It("flushes scripts from all shards when using ScriptFlush", func() {
			script := redis.NewScript(`return 'Unnecessary script'`)
			script.Load(ctx, client)

			val, _ := client.ScriptExists(ctx, script.Hash()).Result()
			Expect(val).To(Equal([]bool{true}))

			client.ScriptFlush(ctx)

			val, _ = client.ScriptExists(ctx, script.Hash()).Result()
			Expect(val).To(Equal([]bool{false}))
		})

		It("supports Watch", func() {
			var incr func(string) error

			// Transactionally increments key using GET and SET commands.
			incr = func(key string) error {
				err := client.Watch(ctx, func(tx *redis.Tx) error {
					n, err := tx.Get(ctx, key).Int64()
					if err != nil && err != redis.Nil {
						return err
					}

					_, err = tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
						pipe.Set(ctx, key, strconv.FormatInt(n+1, 10), 0)
						return nil
					})
					return err
				}, key)
				if err == redis.TxFailedErr {
					return incr(key)
				}
				return err
			}

			var wg sync.WaitGroup
			for i := 0; i < 100; i++ {
				wg.Add(1)
				go func() {
					defer GinkgoRecover()
					defer wg.Done()

					err := incr("key")
					Expect(err).NotTo(HaveOccurred())
				}()
			}
			wg.Wait()

			Eventually(func() string {
				return client.Get(ctx, "key").Val()
			}, 30*time.Second).Should(Equal("100"))
		})

		Describe("pipelining", func() {
			var pipe *redis.Pipeline

			assertPipeline := func() {
				keys := []string{"A", "B", "C", "D", "E", "F", "G"}

				It("follows redirects", func() {
					if !failover {
						for _, key := range keys {
							Eventually(func() error {
								return client.SwapNodes(ctx, key)
							}, 30*time.Second).ShouldNot(HaveOccurred())
						}
					}

					for i, key := range keys {
						pipe.Set(ctx, key, key+"_value", 0)
						pipe.Expire(ctx, key, time.Duration(i+1)*time.Hour)
					}
					cmds, err := pipe.Exec(ctx)
					Expect(err).NotTo(HaveOccurred())
					Expect(cmds).To(HaveLen(14))

					_ = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
						defer GinkgoRecover()
						Eventually(func() int64 {
							return node.DBSize(ctx).Val()
						}, 30*time.Second).ShouldNot(BeZero())
						return nil
					})

					if !failover {
						for _, key := range keys {
							Eventually(func() error {
								return client.SwapNodes(ctx, key)
							}, 30*time.Second).ShouldNot(HaveOccurred())
						}
					}

					for _, key := range keys {
						pipe.Get(ctx, key)
						pipe.TTL(ctx, key)
					}
					cmds, err = pipe.Exec(ctx)
					Expect(err).NotTo(HaveOccurred())
					Expect(cmds).To(HaveLen(14))

					for i, key := range keys {
						get := cmds[i*2].(*redis.StringCmd)
						Expect(get.Val()).To(Equal(key + "_value"))

						ttl := cmds[(i*2)+1].(*redis.DurationCmd)
						dur := time.Duration(i+1) * time.Hour
						Expect(ttl.Val()).To(BeNumerically("~", dur, 30*time.Second))
					}
				})

				It("works with missing keys", func() {
					pipe.Set(ctx, "A", "A_value", 0)
					pipe.Set(ctx, "C", "C_value", 0)
					_, err := pipe.Exec(ctx)
					Expect(err).NotTo(HaveOccurred())

					a := pipe.Get(ctx, "A")
					b := pipe.Get(ctx, "B")
					c := pipe.Get(ctx, "C")
					cmds, err := pipe.Exec(ctx)
					Expect(err).To(Equal(redis.Nil))
					Expect(cmds).To(HaveLen(3))

					Expect(a.Err()).NotTo(HaveOccurred())
					Expect(a.Val()).To(Equal("A_value"))

					Expect(b.Err()).To(Equal(redis.Nil))
					Expect(b.Val()).To(Equal(""))

					Expect(c.Err()).NotTo(HaveOccurred())
					Expect(c.Val()).To(Equal("C_value"))
				})
			}

			Describe("with Pipeline", func() {
				BeforeEach(func() {
					pipe = client.Pipeline().(*redis.Pipeline)
				})

				AfterEach(func() {
					Expect(pipe.Close()).NotTo(HaveOccurred())
				})

				assertPipeline()
			})

			Describe("with TxPipeline", func() {
				BeforeEach(func() {
					pipe = client.TxPipeline().(*redis.Pipeline)
				})

				AfterEach(func() {
					Expect(pipe.Close()).NotTo(HaveOccurred())
				})

				assertPipeline()
			})
		})

		It("supports PubSub", func() {
			pubsub := client.Subscribe(ctx, "mychannel")
			defer pubsub.Close()

			Eventually(func() error {
				_, err := client.Publish(ctx, "mychannel", "hello").Result()
				if err != nil {
					return err
				}

				msg, err := pubsub.ReceiveTimeout(ctx, time.Second)
				if err != nil {
					return err
				}

				_, ok := msg.(*redis.Message)
				if !ok {
					return fmt.Errorf("got %T, wanted *redis.Message", msg)
				}

				return nil
			}, 30*time.Second).ShouldNot(HaveOccurred())
		})

		It("supports PubSub.Ping without channels", func() {
			pubsub := client.Subscribe(ctx)
			defer pubsub.Close()

			err := pubsub.Ping(ctx)
			Expect(err).NotTo(HaveOccurred())
		})
	}

	Describe("ClusterClient", func() {
		BeforeEach(func() {
			opt = redisClusterOptions()
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			_ = client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(client.Close()).NotTo(HaveOccurred())
		})

		It("returns pool stats", func() {
			stats := client.PoolStats()
			Expect(stats).To(BeAssignableToTypeOf(&redis.PoolStats{}))
		})

		It("returns an error when there are no attempts left", func() {
			opt := redisClusterOptions()
			opt.MaxRedirects = -1
			client := cluster.newClusterClient(ctx, opt)

			Eventually(func() error {
				return client.SwapNodes(ctx, "A")
			}, 30*time.Second).ShouldNot(HaveOccurred())

			err := client.Get(ctx, "A").Err()
			Expect(err).To(HaveOccurred())
			Expect(err.Error()).To(ContainSubstring("MOVED"))

			Expect(client.Close()).NotTo(HaveOccurred())
		})

		It("calls fn for every master node", func() {
			for i := 0; i < 10; i++ {
				Expect(client.Set(ctx, strconv.Itoa(i), "", 0).Err()).NotTo(HaveOccurred())
			}

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			size, err := client.DBSize(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(size).To(Equal(int64(0)))
		})

		It("should CLUSTER SLOTS", func() {
			res, err := client.ClusterSlots(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(HaveLen(3))

			wanted := []redis.ClusterSlot{{
				Start: 0,
				End:   4999,
				Nodes: []redis.ClusterNode{{
					ID:   "",
					Addr: "127.0.0.1:8220",
				}, {
					ID:   "",
					Addr: "127.0.0.1:8223",
				}},
			}, {
				Start: 5000,
				End:   9999,
				Nodes: []redis.ClusterNode{{
					ID:   "",
					Addr: "127.0.0.1:8221",
				}, {
					ID:   "",
					Addr: "127.0.0.1:8224",
				}},
			}, {
				Start: 10000,
				End:   16383,
				Nodes: []redis.ClusterNode{{
					ID:   "",
					Addr: "127.0.0.1:8222",
				}, {
					ID:   "",
					Addr: "127.0.0.1:8225",
				}},
			}}
			Expect(assertSlotsEqual(res, wanted)).NotTo(HaveOccurred())
		})

		It("should CLUSTER NODES", func() {
			res, err := client.ClusterNodes(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(res)).To(BeNumerically(">", 400))
		})

		It("should CLUSTER INFO", func() {
			res, err := client.ClusterInfo(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(ContainSubstring("cluster_known_nodes:6"))
		})

		It("should CLUSTER KEYSLOT", func() {
			hashSlot, err := client.ClusterKeySlot(ctx, "somekey").Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(hashSlot).To(Equal(int64(hashtag.Slot("somekey"))))
		})

		It("should CLUSTER GETKEYSINSLOT", func() {
			keys, err := client.ClusterGetKeysInSlot(ctx, hashtag.Slot("somekey"), 1).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(len(keys)).To(Equal(0))
		})

		It("should CLUSTER COUNT-FAILURE-REPORTS", func() {
			n, err := client.ClusterCountFailureReports(ctx, cluster.nodeIDs[0]).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))
		})

		It("should CLUSTER COUNTKEYSINSLOT", func() {
			n, err := client.ClusterCountKeysInSlot(ctx, 10).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(int64(0)))
		})

		It("should CLUSTER SAVECONFIG", func() {
			res, err := client.ClusterSaveConfig(ctx).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(res).To(Equal("OK"))
		})

		It("should CLUSTER SLAVES", func() {
			nodesList, err := client.ClusterSlaves(ctx, cluster.nodeIDs[0]).Result()
			Expect(err).NotTo(HaveOccurred())
			Expect(nodesList).Should(ContainElement(ContainSubstring("slave")))
			Expect(nodesList).Should(HaveLen(1))
		})

		It("should RANDOMKEY", func() {
			const nkeys = 100

			for i := 0; i < nkeys; i++ {
				err := client.Set(ctx, fmt.Sprintf("key%d", i), "value", 0).Err()
				Expect(err).NotTo(HaveOccurred())
			}

			var keys []string
			addKey := func(key string) {
				for _, k := range keys {
					if k == key {
						return
					}
				}
				keys = append(keys, key)
			}

			for i := 0; i < nkeys*10; i++ {
				key := client.RandomKey(ctx).Val()
				addKey(key)
			}

			Expect(len(keys)).To(BeNumerically("~", nkeys, nkeys/10))
		})

		It("supports Process hook", func() {
			err := client.Ping(ctx).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				return node.Ping(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			var stack []string

			clusterHook := &hook{
				beforeProcess: func(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
					Expect(cmd.String()).To(Equal("ping: "))
					stack = append(stack, "cluster.BeforeProcess")
					return ctx, nil
				},
				afterProcess: func(ctx context.Context, cmd redis.Cmder) error {
					Expect(cmd.String()).To(Equal("ping: PONG"))
					stack = append(stack, "cluster.AfterProcess")
					return nil
				},
			}
			client.AddHook(clusterHook)

			nodeHook := &hook{
				beforeProcess: func(ctx context.Context, cmd redis.Cmder) (context.Context, error) {
					Expect(cmd.String()).To(Equal("ping: "))
					stack = append(stack, "shard.BeforeProcess")
					return ctx, nil
				},
				afterProcess: func(ctx context.Context, cmd redis.Cmder) error {
					Expect(cmd.String()).To(Equal("ping: PONG"))
					stack = append(stack, "shard.AfterProcess")
					return nil
				},
			}

			_ = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				node.AddHook(nodeHook)
				return nil
			})

			err = client.Ping(ctx).Err()
			Expect(err).NotTo(HaveOccurred())
			Expect(stack).To(Equal([]string{
				"cluster.BeforeProcess",
				"shard.BeforeProcess",
				"shard.AfterProcess",
				"cluster.AfterProcess",
			}))

			clusterHook.beforeProcess = nil
			clusterHook.afterProcess = nil
			nodeHook.beforeProcess = nil
			nodeHook.afterProcess = nil
		})

		It("supports Pipeline hook", func() {
			err := client.Ping(ctx).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				return node.Ping(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			var stack []string

			client.AddHook(&hook{
				beforeProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
					Expect(cmds).To(HaveLen(1))
					Expect(cmds[0].String()).To(Equal("ping: "))
					stack = append(stack, "cluster.BeforeProcessPipeline")
					return ctx, nil
				},
				afterProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) error {
					Expect(cmds).To(HaveLen(1))
					Expect(cmds[0].String()).To(Equal("ping: PONG"))
					stack = append(stack, "cluster.AfterProcessPipeline")
					return nil
				},
			})

			_ = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				node.AddHook(&hook{
					beforeProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
						Expect(cmds).To(HaveLen(1))
						Expect(cmds[0].String()).To(Equal("ping: "))
						stack = append(stack, "shard.BeforeProcessPipeline")
						return ctx, nil
					},
					afterProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) error {
						Expect(cmds).To(HaveLen(1))
						Expect(cmds[0].String()).To(Equal("ping: PONG"))
						stack = append(stack, "shard.AfterProcessPipeline")
						return nil
					},
				})
				return nil
			})

			_, err = client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Ping(ctx)
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(stack).To(Equal([]string{
				"cluster.BeforeProcessPipeline",
				"shard.BeforeProcessPipeline",
				"shard.AfterProcessPipeline",
				"cluster.AfterProcessPipeline",
			}))
		})

		It("supports TxPipeline hook", func() {
			err := client.Ping(ctx).Err()
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				return node.Ping(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			var stack []string

			client.AddHook(&hook{
				beforeProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
					Expect(cmds).To(HaveLen(3))
					Expect(cmds[1].String()).To(Equal("ping: "))
					stack = append(stack, "cluster.BeforeProcessPipeline")
					return ctx, nil
				},
				afterProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) error {
					Expect(cmds).To(HaveLen(3))
					Expect(cmds[1].String()).To(Equal("ping: PONG"))
					stack = append(stack, "cluster.AfterProcessPipeline")
					return nil
				},
			})

			_ = client.ForEachShard(ctx, func(ctx context.Context, node *redis.Client) error {
				node.AddHook(&hook{
					beforeProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) (context.Context, error) {
						Expect(cmds).To(HaveLen(3))
						Expect(cmds[1].String()).To(Equal("ping: "))
						stack = append(stack, "shard.BeforeProcessPipeline")
						return ctx, nil
					},
					afterProcessPipeline: func(ctx context.Context, cmds []redis.Cmder) error {
						Expect(cmds).To(HaveLen(3))
						Expect(cmds[1].String()).To(Equal("ping: PONG"))
						stack = append(stack, "shard.AfterProcessPipeline")
						return nil
					},
				})
				return nil
			})

			_, err = client.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Ping(ctx)
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
			Expect(stack).To(Equal([]string{
				"cluster.BeforeProcessPipeline",
				"shard.BeforeProcessPipeline",
				"shard.AfterProcessPipeline",
				"cluster.AfterProcessPipeline",
			}))
		})

		It("should return correct replica for key", func() {
			client, err := client.SlaveForKey(ctx, "test")
			Expect(err).ToNot(HaveOccurred())
			info := client.Info(ctx, "server")
			Expect(info.Val()).Should(ContainSubstring("tcp_port:8224"))
		})

		It("should return correct master for key", func() {
			client, err := client.MasterForKey(ctx, "test")
			Expect(err).ToNot(HaveOccurred())
			info := client.Info(ctx, "server")
			Expect(info.Val()).Should(ContainSubstring("tcp_port:8221"))
		})

		assertClusterClient()
	})

	Describe("ClusterClient with RouteByLatency", func() {
		BeforeEach(func() {
			opt = redisClusterOptions()
			opt.RouteByLatency = true
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachSlave(ctx, func(ctx context.Context, slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize(ctx).Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			err := client.ForEachSlave(ctx, func(ctx context.Context, slave *redis.Client) error {
				return slave.ReadWrite(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			err = client.Close()
			Expect(err).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})

	Describe("ClusterClient with ClusterSlots", func() {
		BeforeEach(func() {
			failover = true

			opt = redisClusterOptions()
			opt.ClusterSlots = func(ctx context.Context) ([]redis.ClusterSlot, error) {
				slots := []redis.ClusterSlot{{
					Start: 0,
					End:   4999,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard1Port,
					}},
				}, {
					Start: 5000,
					End:   9999,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard2Port,
					}},
				}, {
					Start: 10000,
					End:   16383,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard3Port,
					}},
				}}
				return slots, nil
			}
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachSlave(ctx, func(ctx context.Context, slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize(ctx).Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			failover = false

			err := client.Close()
			Expect(err).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})

	Describe("ClusterClient with RouteRandomly and ClusterSlots", func() {
		BeforeEach(func() {
			failover = true

			opt = redisClusterOptions()
			opt.RouteRandomly = true
			opt.ClusterSlots = func(ctx context.Context) ([]redis.ClusterSlot, error) {
				slots := []redis.ClusterSlot{{
					Start: 0,
					End:   4999,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard1Port,
					}},
				}, {
					Start: 5000,
					End:   9999,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard2Port,
					}},
				}, {
					Start: 10000,
					End:   16383,
					Nodes: []redis.ClusterNode{{
						Addr: ":" + ringShard3Port,
					}},
				}}
				return slots, nil
			}
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachSlave(ctx, func(ctx context.Context, slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize(ctx).Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			failover = false

			err := client.Close()
			Expect(err).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})

	Describe("ClusterClient with ClusterSlots with multiple nodes per slot", func() {
		BeforeEach(func() {
			failover = true

			opt = redisClusterOptions()
			opt.ReadOnly = true
			opt.ClusterSlots = func(ctx context.Context) ([]redis.ClusterSlot, error) {
				slots := []redis.ClusterSlot{{
					Start: 0,
					End:   4999,
					Nodes: []redis.ClusterNode{{
						Addr: ":8220",
					}, {
						Addr: ":8223",
					}},
				}, {
					Start: 5000,
					End:   9999,
					Nodes: []redis.ClusterNode{{
						Addr: ":8221",
					}, {
						Addr: ":8224",
					}},
				}, {
					Start: 10000,
					End:   16383,
					Nodes: []redis.ClusterNode{{
						Addr: ":8222",
					}, {
						Addr: ":8225",
					}},
				}}
				return slots, nil
			}
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachMaster(ctx, func(ctx context.Context, master *redis.Client) error {
				return master.FlushDB(ctx).Err()
			})
			Expect(err).NotTo(HaveOccurred())

			err = client.ForEachSlave(ctx, func(ctx context.Context, slave *redis.Client) error {
				Eventually(func() int64 {
					return client.DBSize(ctx).Val()
				}, 30*time.Second).Should(Equal(int64(0)))
				return nil
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			failover = false

			err := client.Close()
			Expect(err).NotTo(HaveOccurred())
		})

		assertClusterClient()
	})
})

var _ = Describe("ClusterClient without nodes", func() {
	var client *redis.ClusterClient

	BeforeEach(func() {
		client = redis.NewClusterClient(&redis.ClusterOptions{})
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("Ping returns an error", func() {
		err := client.Ping(ctx).Err()
		Expect(err).To(MatchError("redis: cluster has no nodes"))
	})

	It("pipeline returns an error", func() {
		_, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Ping(ctx)
			return nil
		})
		Expect(err).To(MatchError("redis: cluster has no nodes"))
	})
})

var _ = Describe("ClusterClient without valid nodes", func() {
	var client *redis.ClusterClient

	BeforeEach(func() {
		client = redis.NewClusterClient(&redis.ClusterOptions{
			Addrs: []string{redisAddr},
		})
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("returns an error", func() {
		err := client.Ping(ctx).Err()
		Expect(err).To(MatchError("ERR This instance has cluster support disabled"))
	})

	It("pipeline returns an error", func() {
		_, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
			pipe.Ping(ctx)
			return nil
		})
		Expect(err).To(MatchError("ERR This instance has cluster support disabled"))
	})
})

var _ = Describe("ClusterClient with unavailable Cluster", func() {
	var client *redis.ClusterClient

	BeforeEach(func() {
		for _, node := range cluster.clients {
			err := node.ClientPause(ctx, 5*time.Second).Err()
			Expect(err).NotTo(HaveOccurred())
		}

		opt := redisClusterOptions()
		opt.ReadTimeout = 250 * time.Millisecond
		opt.WriteTimeout = 250 * time.Millisecond
		opt.MaxRedirects = 1
		client = cluster.newClusterClientUnstable(opt)
	})

	AfterEach(func() {
		Expect(client.Close()).NotTo(HaveOccurred())
	})

	It("recovers when Cluster recovers", func() {
		err := client.Ping(ctx).Err()
		Expect(err).To(HaveOccurred())

		Eventually(func() error {
			return client.Ping(ctx).Err()
		}, "30s").ShouldNot(HaveOccurred())
	})
})

var _ = Describe("ClusterClient timeout", func() {
	var client *redis.ClusterClient

	AfterEach(func() {
		_ = client.Close()
	})

	testTimeout := func() {
		It("Ping timeouts", func() {
			err := client.Ping(ctx).Err()
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Pipeline timeouts", func() {
			_, err := client.Pipelined(ctx, func(pipe redis.Pipeliner) error {
				pipe.Ping(ctx)
				return nil
			})
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Tx timeouts", func() {
			err := client.Watch(ctx, func(tx *redis.Tx) error {
				return tx.Ping(ctx).Err()
			}, "foo")
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})

		It("Tx Pipeline timeouts", func() {
			err := client.Watch(ctx, func(tx *redis.Tx) error {
				_, err := tx.TxPipelined(ctx, func(pipe redis.Pipeliner) error {
					pipe.Ping(ctx)
					return nil
				})
				return err
			}, "foo")
			Expect(err).To(HaveOccurred())
			Expect(err.(net.Error).Timeout()).To(BeTrue())
		})
	}

	const pause = 5 * time.Second

	Context("read/write timeout", func() {
		BeforeEach(func() {
			opt := redisClusterOptions()
			opt.ReadTimeout = 250 * time.Millisecond
			opt.WriteTimeout = 250 * time.Millisecond
			opt.MaxRedirects = 1
			client = cluster.newClusterClient(ctx, opt)

			err := client.ForEachShard(ctx, func(ctx context.Context, client *redis.Client) error {
				return client.ClientPause(ctx, pause).Err()
			})
			Expect(err).NotTo(HaveOccurred())
		})

		AfterEach(func() {
			_ = client.ForEachShard(ctx, func(ctx context.Context, client *redis.Client) error {
				defer GinkgoRecover()
				Eventually(func() error {
					return client.Ping(ctx).Err()
				}, 2*pause).ShouldNot(HaveOccurred())
				return nil
			})
		})

		testTimeout()
	})
})
