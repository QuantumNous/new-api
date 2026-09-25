package pool_test

import (
	"context"
	"net"
	"sync"
	"testing"
	"time"

	. "github.com/onsi/ginkgo"
	. "github.com/onsi/gomega"

	"github.com/go-redis/redis/v8/internal/pool"
)

var _ = Describe("ConnPool", func() {
	ctx := context.Background()
	var connPool *pool.ConnPool

	BeforeEach(func() {
		connPool = pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           10,
			PoolTimeout:        time.Hour,
			IdleTimeout:        time.Millisecond,
			IdleCheckFrequency: time.Millisecond,
		})
	})

	AfterEach(func() {
		connPool.Close()
	})

	It("should safe close", func() {
		const minIdleConns = 10

		var (
			wg         sync.WaitGroup
			closedChan = make(chan struct{})
		)
		wg.Add(minIdleConns)
		connPool = pool.NewConnPool(&pool.Options{
			Dialer: func(ctx context.Context) (net.Conn, error) {
				wg.Done()
				<-closedChan
				return &net.TCPConn{}, nil
			},
			PoolSize:           10,
			PoolTimeout:        time.Hour,
			IdleTimeout:        time.Millisecond,
			IdleCheckFrequency: time.Millisecond,
			MinIdleConns:       minIdleConns,
		})
		wg.Wait()
		Expect(connPool.Close()).NotTo(HaveOccurred())
		close(closedChan)

		// We wait for 1 second and believe that checkMinIdleConns has been executed.
		time.Sleep(time.Second)

		Expect(connPool.Stats()).To(Equal(&pool.Stats{
			Hits:       0,
			Misses:     0,
			Timeouts:   0,
			TotalConns: 0,
			IdleConns:  0,
			StaleConns: 0,
		}))
	})

	It("should unblock client when conn is removed", func() {
		// Reserve one connection.
		cn, err := connPool.Get(ctx)
		Expect(err).NotTo(HaveOccurred())

		// Reserve all other connections.
		var cns []*pool.Conn
		for i := 0; i < 9; i++ {
			cn, err := connPool.Get(ctx)
			Expect(err).NotTo(HaveOccurred())
			cns = append(cns, cn)
		}

		started := make(chan bool, 1)
		done := make(chan bool, 1)
		go func() {
			defer GinkgoRecover()

			started <- true
			_, err := connPool.Get(ctx)
			Expect(err).NotTo(HaveOccurred())
			done <- true

			connPool.Put(ctx, cn)
		}()
		<-started

		// Check that Get is blocked.
		select {
		case <-done:
			Fail("Get is not blocked")
		case <-time.After(time.Millisecond):
			// ok
		}

		connPool.Remove(ctx, cn, nil)

		// Check that Get is unblocked.
		select {
		case <-done:
			// ok
		case <-time.After(time.Second):
			Fail("Get is not unblocked")
		}

		for _, cn := range cns {
			connPool.Put(ctx, cn)
		}
	})
})

var _ = Describe("MinIdleConns", func() {
	const poolSize = 100
	ctx := context.Background()
	var minIdleConns int
	var connPool *pool.ConnPool

	newConnPool := func() *pool.ConnPool {
		connPool := pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           poolSize,
			MinIdleConns:       minIdleConns,
			PoolTimeout:        100 * time.Millisecond,
			IdleTimeout:        -1,
			IdleCheckFrequency: -1,
		})
		Eventually(func() int {
			return connPool.Len()
		}).Should(Equal(minIdleConns))
		return connPool
	}

	assert := func() {
		It("has idle connections when created", func() {
			Expect(connPool.Len()).To(Equal(minIdleConns))
			Expect(connPool.IdleLen()).To(Equal(minIdleConns))
		})

		Context("after Get", func() {
			var cn *pool.Conn

			BeforeEach(func() {
				var err error
				cn, err = connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())

				Eventually(func() int {
					return connPool.Len()
				}).Should(Equal(minIdleConns + 1))
			})

			It("has idle connections", func() {
				Expect(connPool.Len()).To(Equal(minIdleConns + 1))
				Expect(connPool.IdleLen()).To(Equal(minIdleConns))
			})

			Context("after Remove", func() {
				BeforeEach(func() {
					connPool.Remove(ctx, cn, nil)
				})

				It("has idle connections", func() {
					Expect(connPool.Len()).To(Equal(minIdleConns))
					Expect(connPool.IdleLen()).To(Equal(minIdleConns))
				})
			})
		})

		Describe("Get does not exceed pool size", func() {
			var mu sync.RWMutex
			var cns []*pool.Conn

			BeforeEach(func() {
				cns = make([]*pool.Conn, 0)

				perform(poolSize, func(_ int) {
					defer GinkgoRecover()

					cn, err := connPool.Get(ctx)
					Expect(err).NotTo(HaveOccurred())
					mu.Lock()
					cns = append(cns, cn)
					mu.Unlock()
				})

				Eventually(func() int {
					return connPool.Len()
				}).Should(BeNumerically(">=", poolSize))
			})

			It("Get is blocked", func() {
				done := make(chan struct{})
				go func() {
					connPool.Get(ctx)
					close(done)
				}()

				select {
				case <-done:
					Fail("Get is not blocked")
				case <-time.After(time.Millisecond):
					// ok
				}

				select {
				case <-done:
					// ok
				case <-time.After(time.Second):
					Fail("Get is not unblocked")
				}
			})

			Context("after Put", func() {
				BeforeEach(func() {
					perform(len(cns), func(i int) {
						mu.RLock()
						connPool.Put(ctx, cns[i])
						mu.RUnlock()
					})

					Eventually(func() int {
						return connPool.Len()
					}).Should(Equal(poolSize))
				})

				It("pool.Len is back to normal", func() {
					Expect(connPool.Len()).To(Equal(poolSize))
					Expect(connPool.IdleLen()).To(Equal(poolSize))
				})
			})

			Context("after Remove", func() {
				BeforeEach(func() {
					perform(len(cns), func(i int) {
						mu.RLock()
						connPool.Remove(ctx, cns[i], nil)
						mu.RUnlock()
					})

					Eventually(func() int {
						return connPool.Len()
					}).Should(Equal(minIdleConns))
				})

				It("has idle connections", func() {
					Expect(connPool.Len()).To(Equal(minIdleConns))
					Expect(connPool.IdleLen()).To(Equal(minIdleConns))
				})
			})
		})
	}

	Context("minIdleConns = 1", func() {
		BeforeEach(func() {
			minIdleConns = 1
			connPool = newConnPool()
		})

		AfterEach(func() {
			connPool.Close()
		})

		assert()
	})

	Context("minIdleConns = 32", func() {
		BeforeEach(func() {
			minIdleConns = 32
			connPool = newConnPool()
		})

		AfterEach(func() {
			connPool.Close()
		})

		assert()
	})
})

var _ = Describe("conns reaper", func() {
	const idleTimeout = time.Minute
	const maxAge = time.Hour

	ctx := context.Background()
	var connPool *pool.ConnPool
	var conns, staleConns, closedConns []*pool.Conn

	assert := func(typ string) {
		BeforeEach(func() {
			closedConns = nil
			connPool = pool.NewConnPool(&pool.Options{
				Dialer:             dummyDialer,
				PoolSize:           10,
				IdleTimeout:        idleTimeout,
				MaxConnAge:         maxAge,
				PoolTimeout:        time.Second,
				IdleCheckFrequency: time.Hour,
				OnClose: func(cn *pool.Conn) error {
					closedConns = append(closedConns, cn)
					return nil
				},
			})

			conns = nil

			// add stale connections
			staleConns = nil
			for i := 0; i < 3; i++ {
				cn, err := connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())
				switch typ {
				case "idle":
					cn.SetUsedAt(time.Now().Add(-2 * idleTimeout))
				case "aged":
					cn.SetCreatedAt(time.Now().Add(-2 * maxAge))
				}
				conns = append(conns, cn)
				staleConns = append(staleConns, cn)
			}

			// add fresh connections
			for i := 0; i < 3; i++ {
				cn, err := connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())
				conns = append(conns, cn)
			}

			for _, cn := range conns {
				connPool.Put(ctx, cn)
			}

			Expect(connPool.Len()).To(Equal(6))
			Expect(connPool.IdleLen()).To(Equal(6))

			n, err := connPool.ReapStaleConns()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(3))
		})

		AfterEach(func() {
			_ = connPool.Close()
			Expect(connPool.Len()).To(Equal(0))
			Expect(connPool.IdleLen()).To(Equal(0))
			Expect(len(closedConns)).To(Equal(len(conns)))
			Expect(closedConns).To(ConsistOf(conns))
		})

		It("reaps stale connections", func() {
			Expect(connPool.Len()).To(Equal(3))
			Expect(connPool.IdleLen()).To(Equal(3))
		})

		It("does not reap fresh connections", func() {
			n, err := connPool.ReapStaleConns()
			Expect(err).NotTo(HaveOccurred())
			Expect(n).To(Equal(0))
		})

		It("stale connections are closed", func() {
			Expect(len(closedConns)).To(Equal(len(staleConns)))
			Expect(closedConns).To(ConsistOf(staleConns))
		})

		It("pool is functional", func() {
			for j := 0; j < 3; j++ {
				var freeCns []*pool.Conn
				for i := 0; i < 3; i++ {
					cn, err := connPool.Get(ctx)
					Expect(err).NotTo(HaveOccurred())
					Expect(cn).NotTo(BeNil())
					freeCns = append(freeCns, cn)
				}

				Expect(connPool.Len()).To(Equal(3))
				Expect(connPool.IdleLen()).To(Equal(0))

				cn, err := connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())
				Expect(cn).NotTo(BeNil())
				conns = append(conns, cn)

				Expect(connPool.Len()).To(Equal(4))
				Expect(connPool.IdleLen()).To(Equal(0))

				connPool.Remove(ctx, cn, nil)

				Expect(connPool.Len()).To(Equal(3))
				Expect(connPool.IdleLen()).To(Equal(0))

				for _, cn := range freeCns {
					connPool.Put(ctx, cn)
				}

				Expect(connPool.Len()).To(Equal(3))
				Expect(connPool.IdleLen()).To(Equal(3))
			}
		})
	}

	assert("idle")
	assert("aged")
})

var _ = Describe("race", func() {
	ctx := context.Background()
	var connPool *pool.ConnPool
	var C, N int

	BeforeEach(func() {
		C, N = 10, 1000
		if testing.Short() {
			C = 4
			N = 100
		}
	})

	AfterEach(func() {
		connPool.Close()
	})

	It("does not happen on Get, Put, and Remove", func() {
		connPool = pool.NewConnPool(&pool.Options{
			Dialer:             dummyDialer,
			PoolSize:           10,
			PoolTimeout:        time.Minute,
			IdleTimeout:        time.Millisecond,
			IdleCheckFrequency: time.Millisecond,
		})

		perform(C, func(id int) {
			for i := 0; i < N; i++ {
				cn, err := connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())
				if err == nil {
					connPool.Put(ctx, cn)
				}
			}
		}, func(id int) {
			for i := 0; i < N; i++ {
				cn, err := connPool.Get(ctx)
				Expect(err).NotTo(HaveOccurred())
				if err == nil {
					connPool.Remove(ctx, cn, nil)
				}
			}
		})
	})
})
