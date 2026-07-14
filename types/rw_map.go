package types

import (
	"strings"
	"sync"

	"github.com/QuantumNous/new-api/common"
)

// blankJSON reports whether a stored JSON option value carries no content.
// Option values are sometimes persisted as an empty/whitespace string when the
// setting was never configured; unmarshaling that yields "unexpected end of
// JSON input", which the periodic option sync would otherwise log on every
// pass. Treating blank input as a no-op keeps the map's current contents
// (defaults or the last good load). An explicit empty object "{}" is valid
// JSON and still clears the map as intended.
func blankJSON(jsonStr string) bool {
	return strings.TrimSpace(jsonStr) == ""
}

type RWMap[K comparable, V any] struct {
	data  map[K]V
	mutex sync.RWMutex
}

func (m *RWMap[K, V]) UnmarshalJSON(b []byte) error {
	var next map[K]V
	if err := common.Unmarshal(b, &next); err != nil {
		return err
	}
	if next == nil {
		next = make(map[K]V)
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data = next
	return nil
}

func (m *RWMap[K, V]) MarshalJSON() ([]byte, error) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return common.Marshal(m.data)
}

func NewRWMap[K comparable, V any]() *RWMap[K, V] {
	return &RWMap[K, V]{
		data: make(map[K]V),
	}
}

func (m *RWMap[K, V]) Get(key K) (V, bool) {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	value, exists := m.data[key]
	return value, exists
}

func (m *RWMap[K, V]) Set(key K, value V) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data[key] = value
}

func (m *RWMap[K, V]) AddAll(other map[K]V) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	for k, v := range other {
		m.data[k] = v
	}
}

func (m *RWMap[K, V]) Clear() {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data = make(map[K]V)
}

// ReadAll returns a copy of the entire map.
func (m *RWMap[K, V]) ReadAll() map[K]V {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	copiedMap := make(map[K]V)
	for k, v := range m.data {
		copiedMap[k] = v
	}
	return copiedMap
}

func (m *RWMap[K, V]) Len() int {
	m.mutex.RLock()
	defer m.mutex.RUnlock()
	return len(m.data)
}

func LoadFromJsonString[K comparable, V any](m *RWMap[K, V], jsonStr string) error {
	// Blank input means "not configured": keep current contents instead of
	// erroring on every option sync.
	if blankJSON(jsonStr) {
		return nil
	}
	var next map[K]V
	if err := common.Unmarshal([]byte(jsonStr), &next); err != nil {
		return err
	}
	if next == nil {
		next = make(map[K]V)
	}
	m.mutex.Lock()
	defer m.mutex.Unlock()
	m.data = next
	return nil
}

// LoadFromJsonStringWithCallback loads a JSON string into the RWMap and calls the callback on success.
func LoadFromJsonStringWithCallback[K comparable, V any](m *RWMap[K, V], jsonStr string, onSuccess func()) error {
	// Blank input is a no-op; skip the callback so cache invalidation does not
	// fire on every sync for an unset option.
	if blankJSON(jsonStr) {
		return nil
	}
	if err := LoadFromJsonString(m, jsonStr); err != nil {
		return err
	}
	if onSuccess != nil {
		onSuccess()
	}
	return nil
}

// MarshalJSONString returns the JSON string representation of the RWMap.
func (m *RWMap[K, V]) MarshalJSONString() string {
	bytes, err := m.MarshalJSON()
	if err != nil {
		return "{}"
	}
	return string(bytes)
}
