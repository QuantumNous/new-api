package main

import (
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// auditToken mirrors the columns this proxy reads from new-api's tokens table.
// Lookups use struct-based GORM conditions rather than raw SQL so that `key` and
// `group` — reserved words in at least one supported database — are quoted
// correctly per dialect.
type auditToken struct {
	Id        int            `gorm:"column:id"`
	UserId    int            `gorm:"column:user_id"`
	Name      string         `gorm:"column:name"`
	Group     string         `gorm:"column:group"`
	Key       string         `gorm:"column:key"`
	DeletedAt gorm.DeletedAt `gorm:"column:deleted_at"`
}

func (auditToken) TableName() string {
	return "tokens"
}

type auditUser struct {
	Id       int    `gorm:"column:id"`
	Username string `gorm:"column:username"`
}

func (auditUser) TableName() string {
	return "users"
}

// Identity is the resolved caller behind a relay request.
type Identity struct {
	UserId     int
	Username   string
	TokenId    int
	TokenName  string
	TokenGroup string
}

type cachedIdentity struct {
	identity  Identity
	expiresAt time.Time
}

// IdentityResolver maps the API key of a relay request to its owning user by
// reading new-api's tokens and users tables. Both are read-only lookups, cached
// with a TTL so repeated calls from the same key cost nothing.
type IdentityResolver struct {
	db      *gorm.DB
	ttl     time.Duration
	maxSize int

	mu    sync.Mutex
	cache map[string]cachedIdentity
}

func NewIdentityResolver(db *gorm.DB, cfg IdentityConfig) *IdentityResolver {
	return &IdentityResolver{
		db:      db,
		ttl:     time.Duration(cfg.CacheTTLSeconds) * time.Second,
		maxSize: cfg.CacheSize,
		cache:   make(map[string]cachedIdentity),
	}
}

// extractAPIKey pulls the API key out of a relay request and normalises it the
// same way new-api's TokenAuth does (see middleware/auth.go): drop the Bearer
// prefix, drop the "sk-" prefix, then keep only the segment before the first
// "-", because trailing segments select a channel and are not part of the key.
func extractAPIKey(r *http.Request) string {
	raw := r.Header.Get("Authorization")
	if raw == "" {
		raw = r.Header.Get("x-api-key") // Claude
	}
	if raw == "" {
		raw = r.Header.Get("x-goog-api-key") // Gemini
	}
	if raw == "" {
		raw = r.URL.Query().Get("key") // Gemini query-parameter form
	}
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) > 7 && strings.EqualFold(raw[:7], "bearer ") {
		raw = strings.TrimSpace(raw[7:])
	}
	raw = strings.TrimPrefix(raw, "sk-")
	if index := strings.Index(raw, "-"); index >= 0 {
		raw = raw[:index]
	}
	return raw
}

// Resolve returns the caller behind key. An unknown key yields a zero Identity,
// which is also cached so unauthenticated traffic cannot cause a query storm.
func (r *IdentityResolver) Resolve(key string) Identity {
	if r == nil || key == "" {
		return Identity{}
	}
	if identity, ok := r.lookupCache(key); ok {
		return identity
	}

	var token auditToken
	if err := r.db.Where(&auditToken{Key: key}).Take(&token).Error; err != nil {
		r.storeCache(key, Identity{})
		return Identity{}
	}
	identity := Identity{
		UserId:     token.UserId,
		TokenId:    token.Id,
		TokenName:  token.Name,
		TokenGroup: token.Group,
	}
	var user auditUser
	if err := r.db.Where(&auditUser{Id: token.UserId}).Take(&user).Error; err == nil {
		identity.Username = user.Username
	}
	r.storeCache(key, identity)
	return identity
}

func (r *IdentityResolver) lookupCache(key string) (Identity, bool) {
	r.mu.Lock()
	defer r.mu.Unlock()
	entry, ok := r.cache[key]
	if !ok || time.Now().After(entry.expiresAt) {
		return Identity{}, false
	}
	return entry.identity, true
}

func (r *IdentityResolver) storeCache(key string, identity Identity) {
	r.mu.Lock()
	defer r.mu.Unlock()
	// A plain size cap: once the cache is full it is dropped wholesale rather
	// than maintaining LRU bookkeeping for what is a short-TTL lookup cache.
	if len(r.cache) >= r.maxSize {
		r.cache = make(map[string]cachedIdentity, r.maxSize)
	}
	r.cache[key] = cachedIdentity{identity: identity, expiresAt: time.Now().Add(r.ttl)}
}
