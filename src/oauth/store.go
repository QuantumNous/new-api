package oauth

import (
	"one-api/common"
	"sync"
	"time"
)

// KVStore is a minimal TTL key-value abstraction used by OAuth flows.
type KVStore interface {
	Set(key, value string, ttl time.Duration) error
	Get(key string) (string, bool)
	Del(key string) error
}

type redisStore struct{}

func (r *redisStore) Set(key, value string, ttl time.Duration) error {
	return common.RedisSet(key, value, ttl)
}
func (r *redisStore) Get(key string) (string, bool) {
	v, err := common.RedisGet(key)
	if err != nil || v == "" {
		return "", false
	}
	return v, true
}
func (r *redisStore) Del(key string) error {
	return common.RedisDel(key)
}

type memEntry struct {
	val string
	exp int64 // unix seconds, 0 means no expiry
}

type memoryStore struct {
	m sync.Map // key -> memEntry
}

func (m *memoryStore) Set(key, value string, ttl time.Duration) error {
	var exp int64
	if ttl > 0 {
		exp = time.Now().Add(ttl).Unix()
	}
	m.m.Store(key, memEntry{val: value, exp: exp})
	return nil
}

func (m *memoryStore) Get(key string) (string, bool) {
	v, ok := m.m.Load(key)
	if !ok {
		return "", false
	}
	e := v.(memEntry)
	if e.exp > 0 && time.Now().Unix() > e.exp {
		m.m.Delete(key)
		return "", false
	}
	return e.val, true
}

func (m *memoryStore) Del(key string) error {
	m.m.Delete(key)
	return nil
}

var (
	memStore = &memoryStore{}
	rdsStore = &redisStore{}
)

func getStore() KVStore {
	if common.RedisEnabled {
		return rdsStore
	}
	return memStore
}

func storeSet(key, val string, ttl time.Duration) error { return getStore().Set(key, val, ttl) }
func storeGet(key string) (string, bool)                { return getStore().Get(key) }
func storeDel(key string) error                         { return getStore().Del(key) }
