package selfupdate

import (
	"sync"
	"time"
)

// checkCache holds a single cached update-check snapshot.
type checkCache struct {
	mu        sync.Mutex
	info      *Info
	release   *ReleaseInfo
	fetchedAt time.Time
}

var globalCache checkCache

// get returns the cached Info if it was fetched within ttl, otherwise nil.
func (c *checkCache) get(ttl time.Duration) *Info {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.info == nil {
		return nil
	}
	if time.Since(c.fetchedAt) > ttl {
		return nil
	}
	return c.info
}

// set stores info as the current cached snapshot.
func (c *checkCache) set(info *Info) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.info = info
	c.fetchedAt = time.Now()
}
