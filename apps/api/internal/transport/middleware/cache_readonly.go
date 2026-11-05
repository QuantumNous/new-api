package middleware

import (
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/samber/hot"
	"golang.org/x/sync/singleflight"

	"github.com/QuantumNous/new-api/internal/common"
	"github.com/QuantumNous/new-api/internal/common/cachex"
	"github.com/QuantumNous/new-api/internal/transport/contract"
)

// Response-cache TTL tiers. A cached response never outlives its tier: the cache
// absorbs repeated identical reads of a global aggregate, it does not serve
// stale data past a few seconds.
const (
	CacheTTLShort  = 5 * time.Second
	CacheTTLMedium = 10 * time.Second
	CacheTTLLong   = 15 * time.Second
)

// readonlyCacheMaxBody bounds what may be stored. A larger response is served
// but never cached, so one runaway payload cannot evict the rest.
const readonlyCacheMaxBody = 2 << 20

// readonlyCacheMaxKey bounds the key. A key over this size is served but not
// cached, which keeps a caller that varies query parameters from growing the
// key space without limit.
const readonlyCacheMaxKey = 512

// readonlyCacheEntry is the replayable form of a cached response.
type readonlyCacheEntry struct {
	Status      int    `json:"status"`
	ContentType string `json:"content_type"`
	Body        string `json:"body"`
}

// ReadOnlyCacheConfig describes one cached endpoint.
type ReadOnlyCacheConfig struct {
	// Namespace isolates this endpoint's keys; use one value per endpoint.
	Namespace string
	// TTL is the staleness bound. Use the CacheTTL* constants.
	TTL time.Duration
	// Params lists the query parameters the endpoint actually reads. The cache
	// key is built from these parameters only (sorted). A request carrying any
	// query parameter outside Params is served but never cached: unknown
	// parameters may change the response, so sharing an entry would be wrong.
	// An empty Params means the endpoint takes no query parameters: a request
	// with any query string is then served but not cached.
	Params []string
}

var (
	readonlyResponseCacheOnce sync.Once
	readonlyResponseCache     *cachex.HybridCache[readonlyCacheEntry]
)

// Read-only cache circuit breaker. Trips on consecutive cache (Get /
// SetWithTTL) errors so a slow or failed Redis cannot add per-request latency.
const (
	readonlyBreakerThreshold = 3
	readonlyBreakerOpenFor   = 30 * time.Second
)

var (
	readonlyBreakerMu        sync.Mutex
	readonlyBreakerErrors    int
	readonlyBreakerOpenUntil time.Time

	// readonlyCacheSingleflight dedupes concurrent cache misses for the same key
	// so the handler runs once per key per flight. Only the produced entry is
	// shared; the leader's contract.Context is never used by another request.
	readonlyCacheSingleflight singleflight.Group
)

// getReadonlyResponseCache builds the cache lazily: common.RDB is assigned
// during startup, after package initialization, so a cache constructed at init
// time would pin a nil client and silently stay memory-only.
func getReadonlyResponseCache() *cachex.HybridCache[readonlyCacheEntry] {
	readonlyResponseCacheOnce.Do(func() {
		readonlyResponseCache = cachex.NewHybridCache[readonlyCacheEntry](cachex.HybridCacheConfig[readonlyCacheEntry]{
			Namespace:    cachex.Namespace("http_readonly:v1"),
			Redis:        common.RDB,
			RedisEnabled: func() bool { return common.RedisEnabled && common.RDB != nil },
			RedisCodec:   cachex.JSONCodec[readonlyCacheEntry]{},
			Memory: func() *hot.HotCache[string, readonlyCacheEntry] {
				return hot.NewHotCache[string, readonlyCacheEntry](hot.LRU, 4096).
					WithTTL(CacheTTLLong).
					WithJanitor().
					Build()
			},
		})
	})
	return readonlyResponseCache
}

// readonlyBreakerIsOpen reports whether the circuit breaker is open. When the
// open window has elapsed it allows a single probe by resetting to closed.
// Caller must hold readonlyBreakerMu.
func readonlyBreakerIsOpen() bool {
	if readonlyBreakerOpenUntil.IsZero() {
		return false
	}
	if time.Now().Before(readonlyBreakerOpenUntil) {
		return true
	}
	readonlyBreakerOpenUntil = time.Time{}
	readonlyBreakerErrors = 0
	return false
}

// readonlyBreakerRecordError increments consecutive cache errors and opens the
// breaker once the threshold is reached. Caller must hold readonlyBreakerMu.
func readonlyBreakerRecordError() {
	readonlyBreakerErrors++
	if readonlyBreakerErrors >= readonlyBreakerThreshold && readonlyBreakerOpenUntil.IsZero() {
		readonlyBreakerOpenUntil = time.Now().Add(readonlyBreakerOpenFor)
	}
}

// readonlyBreakerRecordSuccess resets the breaker after a successful cache op.
// Caller must hold readonlyBreakerMu.
func readonlyBreakerRecordSuccess() {
	readonlyBreakerErrors = 0
	readonlyBreakerOpenUntil = time.Time{}
}

// queryAllowed reports whether the request's query string only contains
// allowlisted parameters. An empty Params means the endpoint takes no query
// parameters: any query string is then disallowed (served but not cached).
func queryAllowed(rawQuery string, params []string) bool {
	if rawQuery == "" {
		return true
	}
	if len(params) == 0 {
		return false
	}
	allowed := make(map[string]struct{}, len(params))
	for _, p := range params {
		allowed[p] = struct{}{}
	}
	for _, p := range strings.Split(rawQuery, "&") {
		k, _, _ := strings.Cut(p, "=")
		if _, ok := allowed[k]; !ok {
			return false
		}
	}
	return true
}

// cacheKeyURI canonicalizes the request target so two spellings of one logical
// request share an entry: the query is sorted by name and the trailing slash is
// dropped. Without it "/api/data" and "/api/data/" (both routed, both served)
// occupy two entries and halve the hit rate.
func cacheKeyURI(requestURI string, params []string) string {
	path, rawQuery, _ := strings.Cut(requestURI, "?")
	if len(path) > 1 {
		path = strings.TrimSuffix(path, "/")
	}
	if rawQuery == "" || len(params) == 0 {
		return path
	}
	allowed := make(map[string]struct{}, len(params))
	for _, p := range params {
		allowed[p] = struct{}{}
	}
	// Keep raw key=value pairs (byte-exact, no decoding) but only the
	// allowlisted parameter names, then sort so equivalent spellings share a key.
	pairs := strings.Split(rawQuery, "&")
	var kept []string
	for _, p := range pairs {
		k, _, _ := strings.Cut(p, "=")
		if _, ok := allowed[k]; !ok {
			continue
		}
		kept = append(kept, p)
	}
	if len(kept) == 0 {
		return path
	}
	sort.Strings(kept)
	return path + "?" + strings.Join(kept, "&")
}

// ReadOnlyCache caches the response of a global, read-only GET endpoint.
//
// Mount it AFTER authentication: a hit replays whatever the first caller
// received, so an endpoint whose output depends on the caller must never be
// mounted here. Only GET is served from or stored into the cache; every other
// method passes through untouched, and only a 200 response is stored.
//
// Entries replay JSON: the stored content type is "application/json;
// charset=utf-8", which every mount point returns through c.JSON.
//
// Streamed responses are never cached. Server-Sent Events and raw response
// streams have no buffered body, so CaptureResponse reports empty and the entry
// is skipped. This middleware must not be mounted on a relay or streamed route.
func ReadOnlyCache(cfg ReadOnlyCacheConfig) contract.Middleware {
	if cfg.TTL <= 0 {
		cfg.TTL = CacheTTLMedium
	}
	return func(c contract.Context) {
		if c.Method() != http.MethodGet {
			c.Next()
			return
		}

		// The staleness window is decided here, not by a browser or an
		// intermediary: without this, a client is free to heuristically cache a
		// 200 and extend the entry past the TTL this middleware chose.
		c.SetHeader("Cache-Control", "no-store")

		// Query allowlist: only the listed parameters may vary a cached entry.
		// Any unlisted parameter means the response may differ, so the request
		// is served but never cached.
		if !queryAllowed(c.RawQuery(), cfg.Params) {
			c.Next()
			return
		}

		// "\x1f" cannot occur in a namespace or a request target, so a
		// namespace cannot be crafted to collide with another's key.
		key := cfg.Namespace + "\x1f" + cacheKeyURI(c.RequestURI(), cfg.Params)
		if len(key) > readonlyCacheMaxKey {
			// An oversized key (a caller varying parameters) is served but not
			// cached: it would otherwise be an unbounded key-space attacker.
			c.Next()
			return
		}
		cache := getReadonlyResponseCache()

		// Circuit breaker: while open, bypass the cache entirely (no Get, no
		// Set) so a slow or failed Redis cannot add latency to every request.
		readonlyBreakerMu.Lock()
		open := readonlyBreakerIsOpen()
		readonlyBreakerMu.Unlock()
		if open {
			c.Next()
			return
		}

		// Read from cache.
		if entry, found, err := cache.Get(key); err == nil && found {
			// Abort before writing: the chain loop keeps advancing after a
			// handler returns, so a hit that only wrote and returned would
			// still run the downstream handler and append its body.
			c.Abort()
			_ = c.Data(entry.Status, entry.ContentType, []byte(entry.Body))
			return
		} else if err != nil {
			readonlyBreakerMu.Lock()
			readonlyBreakerRecordError()
			readonlyBreakerMu.Unlock()
		}

		// Cold miss: run the handler under singleflight so concurrent misses
		// for the same key execute the handler exactly once. The flight covers
		// the handler run only — never the cache Get. The leader's
		// contract.Context is never used by another request; only the produced
		// entry is shared.
		// ran marks the goroutine that executed the flight. singleflight's own
		// `shared` return is true for the leader as well whenever duplicates
		// joined, so it cannot tell leader from follower: a leader that treated
		// itself as a follower would replay the entry over the response its
		// handler already wrote and append a second body.
		var ran bool
		result, _, _ := readonlyCacheSingleflight.Do(key, func() (interface{}, error) {
			ran = true
			capture := c.CaptureResponse(readonlyCacheMaxBody)
			c.Next()
			if capture == nil || c.ResponseStatus() != http.StatusOK {
				return nil, nil
			}
			body := capture.Body()
			// CaptureResponse truncates at the limit, so a body that filled the
			// buffer cannot be told apart from an oversized one. Skip both:
			// storing the truncated prefix would replay invalid JSON.
			if len(body) == 0 || len(body) >= readonlyCacheMaxBody {
				return nil, nil
			}
			entry := &readonlyCacheEntry{
				Status:      http.StatusOK,
				ContentType: "application/json; charset=utf-8",
				Body:        string(body),
			}
			if setErr := cache.SetWithTTL(key, *entry, cfg.TTL); setErr != nil {
				readonlyBreakerMu.Lock()
				readonlyBreakerRecordError()
				readonlyBreakerMu.Unlock()
			} else {
				readonlyBreakerMu.Lock()
				readonlyBreakerRecordSuccess()
				readonlyBreakerMu.Unlock()
			}
			return entry, nil
		})

		if ran {
			// Leader: the handler already ran inside the flight and wrote the
			// response. Nothing more to do.
			return
		}
		// Follower: replay the leader's entry through our own context, or run
		// our own chain if the leader produced nothing cacheable.
		if entry, ok := result.(*readonlyCacheEntry); ok && entry != nil {
			c.Abort()
			_ = c.Data(entry.Status, entry.ContentType, []byte(entry.Body))
			return
		}
		c.Next()
	}
}
