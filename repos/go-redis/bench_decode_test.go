package redis

import (
	"context"
	"fmt"
	"io"
	"net"
	"testing"
	"time"

	"github.com/go-redis/redis/v8/internal/proto"
)

var ctx = context.TODO()

type ClientStub struct {
	Cmdable
	resp []byte
}

func NewClientStub(resp []byte) *ClientStub {
	stub := &ClientStub{
		resp: resp,
	}
	stub.Cmdable = NewClient(&Options{
		PoolSize: 128,
		Dialer: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return stub.stubConn(), nil
		},
	})
	return stub
}

func NewClusterClientStub(resp []byte) *ClientStub {
	stub := &ClientStub{
		resp: resp,
	}

	client := NewClusterClient(&ClusterOptions{
		PoolSize: 128,
		Addrs:    []string{"127.0.0.1:6379"},
		Dialer: func(ctx context.Context, network, addr string) (net.Conn, error) {
			return stub.stubConn(), nil
		},
		ClusterSlots: func(_ context.Context) ([]ClusterSlot, error) {
			return []ClusterSlot{
				{
					Start: 0,
					End:   16383,
					Nodes: []ClusterNode{{Addr: "127.0.0.1:6379"}},
				},
			}, nil
		},
	})

	// init command.
	tmpClient := NewClient(&Options{Addr: ":6379"})
	cmdsInfo, err := tmpClient.Command(ctx).Result()
	_ = tmpClient.Close()
	client.cmdsInfoCache = newCmdsInfoCache(func(_ context.Context) (map[string]*CommandInfo, error) {
		return cmdsInfo, err
	})

	stub.Cmdable = client
	return stub
}

func (c *ClientStub) stubConn() *ConnStub {
	return &ConnStub{
		resp: c.resp,
	}
}

type ConnStub struct {
	resp []byte
	pos  int
}

func (c *ConnStub) Read(b []byte) (n int, err error) {
	if len(c.resp) == 0 {
		return 0, io.EOF
	}

	if c.pos >= len(c.resp) {
		c.pos = 0
	}
	n = copy(b, c.resp[c.pos:])
	c.pos += n
	return n, nil
}

func (c *ConnStub) Write(b []byte) (n int, err error)  { return len(b), nil }
func (c *ConnStub) Close() error                       { return nil }
func (c *ConnStub) LocalAddr() net.Addr                { return nil }
func (c *ConnStub) RemoteAddr() net.Addr               { return nil }
func (c *ConnStub) SetDeadline(_ time.Time) error      { return nil }
func (c *ConnStub) SetReadDeadline(_ time.Time) error  { return nil }
func (c *ConnStub) SetWriteDeadline(_ time.Time) error { return nil }

type ClientStubFunc func([]byte) *ClientStub

func BenchmarkDecode(b *testing.B) {
	type Benchmark struct {
		name string
		stub ClientStubFunc
	}

	benchmarks := []Benchmark{
		{"single", NewClientStub},
		{"cluster", NewClusterClientStub},
	}

	for _, bench := range benchmarks {
		b.Run(fmt.Sprintf("RespError-%s", bench.name), func(b *testing.B) {
			respError(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespStatus-%s", bench.name), func(b *testing.B) {
			respStatus(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespInt-%s", bench.name), func(b *testing.B) {
			respInt(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespString-%s", bench.name), func(b *testing.B) {
			respString(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespArray-%s", bench.name), func(b *testing.B) {
			respArray(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespPipeline-%s", bench.name), func(b *testing.B) {
			respPipeline(b, bench.stub)
		})
		b.Run(fmt.Sprintf("RespTxPipeline-%s", bench.name), func(b *testing.B) {
			respTxPipeline(b, bench.stub)
		})

		// goroutine
		b.Run(fmt.Sprintf("DynamicGoroutine-%s-pool=5", bench.name), func(b *testing.B) {
			dynamicGoroutine(b, bench.stub, 5)
		})
		b.Run(fmt.Sprintf("DynamicGoroutine-%s-pool=20", bench.name), func(b *testing.B) {
			dynamicGoroutine(b, bench.stub, 20)
		})
		b.Run(fmt.Sprintf("DynamicGoroutine-%s-pool=50", bench.name), func(b *testing.B) {
			dynamicGoroutine(b, bench.stub, 50)
		})
		b.Run(fmt.Sprintf("DynamicGoroutine-%s-pool=100", bench.name), func(b *testing.B) {
			dynamicGoroutine(b, bench.stub, 100)
		})

		b.Run(fmt.Sprintf("StaticGoroutine-%s-pool=5", bench.name), func(b *testing.B) {
			staticGoroutine(b, bench.stub, 5)
		})
		b.Run(fmt.Sprintf("StaticGoroutine-%s-pool=20", bench.name), func(b *testing.B) {
			staticGoroutine(b, bench.stub, 20)
		})
		b.Run(fmt.Sprintf("StaticGoroutine-%s-pool=50", bench.name), func(b *testing.B) {
			staticGoroutine(b, bench.stub, 50)
		})
		b.Run(fmt.Sprintf("StaticGoroutine-%s-pool=100", bench.name), func(b *testing.B) {
			staticGoroutine(b, bench.stub, 100)
		})
	}
}

func respError(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("-ERR test error\r\n"))
	respErr := proto.RedisError("ERR test error")

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if err := rdb.Get(ctx, "key").Err(); err != respErr {
			b.Fatalf("response error, got %q, want %q", err, respErr)
		}
	}
}

func respStatus(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("+OK\r\n"))
	var val string

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if val = rdb.Set(ctx, "key", "value", 0).Val(); val != "OK" {
			b.Fatalf("response error, got %q, want OK", val)
		}
	}
}

func respInt(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte(":10\r\n"))
	var val int64

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if val = rdb.Incr(ctx, "key").Val(); val != 10 {
			b.Fatalf("response error, got %q, want 10", val)
		}
	}
}

func respString(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("$5\r\nhello\r\n"))
	var val string

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if val = rdb.Get(ctx, "key").Val(); val != "hello" {
			b.Fatalf("response error, got %q, want hello", val)
		}
	}
}

func respArray(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("*3\r\n$5\r\nhello\r\n:10\r\n+OK\r\n"))
	var val []interface{}

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if val = rdb.MGet(ctx, "key").Val(); len(val) != 3 {
			b.Fatalf("response error, got len(%d), want len(3)", len(val))
		}
	}
}

func respPipeline(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("+OK\r\n$5\r\nhello\r\n:1\r\n"))
	var pipe Pipeliner

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		pipe = rdb.Pipeline()
		set := pipe.Set(ctx, "key", "value", 0)
		get := pipe.Get(ctx, "key")
		del := pipe.Del(ctx, "key")
		_, err := pipe.Exec(ctx)
		if err != nil {
			b.Fatalf("response error, got %q, want nil", err)
		}
		if set.Val() != "OK" || get.Val() != "hello" || del.Val() != 1 {
			b.Fatal("response error")
		}
	}
}

func respTxPipeline(b *testing.B, stub ClientStubFunc) {
	rdb := stub([]byte("+OK\r\n+QUEUED\r\n+QUEUED\r\n+QUEUED\r\n*3\r\n+OK\r\n$5\r\nhello\r\n:1\r\n"))

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		var set *StatusCmd
		var get *StringCmd
		var del *IntCmd
		_, err := rdb.TxPipelined(ctx, func(pipe Pipeliner) error {
			set = pipe.Set(ctx, "key", "value", 0)
			get = pipe.Get(ctx, "key")
			del = pipe.Del(ctx, "key")
			return nil
		})
		if err != nil {
			b.Fatalf("response error, got %q, want nil", err)
		}
		if set.Val() != "OK" || get.Val() != "hello" || del.Val() != 1 {
			b.Fatal("response error")
		}
	}
}

func dynamicGoroutine(b *testing.B, stub ClientStubFunc, concurrency int) {
	rdb := stub([]byte("$5\r\nhello\r\n"))
	c := make(chan struct{}, concurrency)

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		c <- struct{}{}
		go func() {
			if val := rdb.Get(ctx, "key").Val(); val != "hello" {
				panic(fmt.Sprintf("response error, got %q, want hello", val))
			}
			<-c
		}()
	}
	// Here no longer wait for all goroutines to complete, it will not affect the test results.
	close(c)
}

func staticGoroutine(b *testing.B, stub ClientStubFunc, concurrency int) {
	rdb := stub([]byte("$5\r\nhello\r\n"))
	c := make(chan struct{}, concurrency)

	b.ResetTimer()

	for i := 0; i < concurrency; i++ {
		go func() {
			for {
				_, ok := <-c
				if !ok {
					return
				}
				if val := rdb.Get(ctx, "key").Val(); val != "hello" {
					panic(fmt.Sprintf("response error, got %q, want hello", val))
				}
			}
		}()
	}
	for i := 0; i < b.N; i++ {
		c <- struct{}{}
	}
	close(c)
}
