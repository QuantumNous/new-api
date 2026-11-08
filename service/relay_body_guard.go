package service

import (
	"context"
	"errors"
	"io"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
)

// ErrUpstreamResponseTooLarge reports an upstream body that exceeded the
// configured relay response limit while it was being read.
var ErrUpstreamResponseTooLarge = errors.New("upstream response body exceeds the configured limit")

// RelayResponseGuard bounds one relay exchange. Streaming responses are allowed
// to stay open for as long as the provider keeps sending bytes, but are
// cancelled once the upstream goes silent for RELAY_STREAM_IDLE_TIMEOUT
// seconds. Non-streaming responses get a hard total deadline. Both kinds stop
// reading after RELAY_MAX_RESPONSE_BYTES so a broken or malicious upstream
// cannot exhaust process memory.
type RelayResponseGuard struct {
	ctx      context.Context
	cancel   context.CancelFunc
	idle     time.Duration
	maxBytes int64
}

// NewRelayResponseGuard derives the exchange context and its limits from the
// relay configuration. Call Abort when the request never produced a response,
// or Wrap the response body so the limits apply while it is read.
func NewRelayResponseGuard(parent context.Context, isStream bool) *RelayResponseGuard {
	if parent == nil {
		parent = context.Background()
	}
	maxBytes := common.RelayMaxResponseBytes
	if isStream {
		idle := time.Duration(min(max(common.RelayStreamIdleTimeout, 0), maxTimeoutSeconds)) * time.Second
		ctx, cancel := context.WithCancel(parent)
		return &RelayResponseGuard{ctx: ctx, cancel: cancel, idle: idle, maxBytes: maxBytes}
	}

	if common.RelayTimeout <= 0 {
		// RELAY_TIMEOUT is unset, so the shared client carries no total timeout:
		// without this deadline a provider that sends headers and then stalls
		// would hold the goroutine and its buffers forever.
		seconds := common.RelayNonStreamTimeout
		if seconds <= 0 {
			seconds = common.RelayResponseHeaderTimeout
		}
		if seconds <= 0 {
			seconds = 1800
		}
		ctx, cancel := context.WithTimeout(parent, time.Duration(min(seconds, maxTimeoutSeconds))*time.Second)
		return &RelayResponseGuard{ctx: ctx, cancel: cancel, maxBytes: maxBytes}
	}

	// The client timeout bounds this exchange; still hand out a cancelable
	// context so closing the body releases it immediately.
	ctx, cancel := context.WithCancel(parent)
	return &RelayResponseGuard{ctx: ctx, cancel: cancel, maxBytes: maxBytes}
}

// Context is the exchange context that must be attached to the upstream request.
func (g *RelayResponseGuard) Context() context.Context {
	return g.ctx
}

// Abort releases the exchange context when no response body will be read.
func (g *RelayResponseGuard) Abort() {
	if g.cancel != nil {
		g.cancel()
	}
}

// Wrap applies the idle watchdog and byte cap to a response body. Closing the
// returned body cancels the exchange context, so transports release the
// upstream connection immediately instead of waiting for a timeout.
func (g *RelayResponseGuard) Wrap(body io.ReadCloser) io.ReadCloser {
	if body == nil {
		return nil
	}
	guarded := &relayBodyGuard{body: body, cancel: g.cancel, idle: g.idle, maxBytes: g.maxBytes}
	if guarded.idle > 0 {
		guarded.startWatchdog()
	}
	return guarded
}

type relayBodyGuard struct {
	body     io.ReadCloser
	cancel   context.CancelFunc
	idle     time.Duration
	maxBytes int64
	read     int64
	nudge    chan struct{}
	stop     chan struct{}
	once     sync.Once
}

func (b *relayBodyGuard) startWatchdog() {
	b.nudge = make(chan struct{}, 1)
	b.stop = make(chan struct{})
	go func() {
		timer := time.NewTimer(b.idle)
		defer timer.Stop()
		for {
			select {
			case <-b.stop:
				return
			case <-b.nudge:
				if !timer.Stop() {
					select {
					case <-timer.C:
					default:
					}
				}
				timer.Reset(b.idle)
			case <-timer.C:
				// No bytes arrived within the idle window: cancel the request so
				// the pending Read returns instead of blocking forever.
				b.cancel()
				return
			}
		}
	}()
}

func (b *relayBodyGuard) Read(p []byte) (int, error) {
	n, err := b.body.Read(p)
	if n > 0 {
		b.read += int64(n)
		if b.nudge != nil {
			select {
			case b.nudge <- struct{}{}:
			default:
			}
		}
		if b.maxBytes > 0 && b.read > b.maxBytes {
			return n, ErrUpstreamResponseTooLarge
		}
	}
	return n, err
}

func (b *relayBodyGuard) Close() error {
	b.once.Do(func() {
		if b.stop != nil {
			close(b.stop)
		}
		if b.cancel != nil {
			b.cancel()
		}
	})
	return b.body.Close()
}
