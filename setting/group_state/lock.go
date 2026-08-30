package group_state

import "sync"

var mutex sync.RWMutex

// Read runs fn while preventing a related group configuration snapshot from
// being replaced. Readers that need multiple values can use one callback to
// observe a consistent snapshot.
func Read[T any](fn func() T) T {
	mutex.RLock()
	defer mutex.RUnlock()
	return fn()
}

// Write runs fn while excluding all readers and other snapshot publishers.
func Write(fn func() error) error {
	mutex.Lock()
	defer mutex.Unlock()
	return fn()
}
