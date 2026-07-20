package model

import (
	"crypto/sha256"
	"sync"
	"time"
)

type channelCooldown struct {
	reason  string
	expires time.Time
}

var channelCooldowns = struct {
	sync.RWMutex
	items map[int]channelCooldown
}{items: make(map[int]channelCooldown)}

type channelKeyCooldownID struct {
	channelId int
	keyHash   [sha256.Size]byte
}

var channelKeyCooldowns = struct {
	sync.RWMutex
	items map[channelKeyCooldownID]channelCooldown
}{items: make(map[channelKeyCooldownID]channelCooldown)}

func newChannelKeyCooldownID(channelId int, key string) channelKeyCooldownID {
	return channelKeyCooldownID{channelId: channelId, keyHash: sha256.Sum256([]byte(key))}
}

func CooldownChannel(channelId int, reason string, duration time.Duration) {
	channelCooldowns.Lock()
	defer channelCooldowns.Unlock()

	expires := time.Now().Add(duration)
	if current, ok := channelCooldowns.items[channelId]; ok && current.expires.After(expires) {
		return
	}
	channelCooldowns.items[channelId] = channelCooldown{
		reason:  reason,
		expires: expires,
	}
}

// GetChannelCooldown returns the active cooldown reason and expiry (unix seconds)
// for a channel. cooling is false when the channel is not currently cooling down
// (no record, or the record has already expired).
func GetChannelCooldown(channelId int) (reason string, expiresUnix int64, cooling bool) {
	channelCooldowns.RLock()
	cd, ok := channelCooldowns.items[channelId]
	channelCooldowns.RUnlock()
	if !ok || !time.Now().Before(cd.expires) {
		return "", 0, false
	}
	return cd.reason, cd.expires.Unix(), true
}

func IsChannelCoolingDown(channelId int) bool {
	channelCooldowns.RLock()
	cooldown, ok := channelCooldowns.items[channelId]
	channelCooldowns.RUnlock()
	if !ok {
		return false
	}
	if time.Now().Before(cooldown.expires) {
		return true
	}

	channelCooldowns.Lock()
	if current, ok := channelCooldowns.items[channelId]; ok && !time.Now().Before(current.expires) {
		delete(channelCooldowns.items, channelId)
	}
	channelCooldowns.Unlock()
	return false
}

func CooldownChannelKey(channelId int, key, reason string, duration time.Duration) {
	if key == "" {
		return
	}
	cooldownId := newChannelKeyCooldownID(channelId, key)
	channelKeyCooldowns.Lock()
	defer channelKeyCooldowns.Unlock()

	expires := time.Now().Add(duration)
	if current, ok := channelKeyCooldowns.items[cooldownId]; ok && current.expires.After(expires) {
		return
	}
	channelKeyCooldowns.items[cooldownId] = channelCooldown{
		reason:  reason,
		expires: expires,
	}
}

func GetChannelKeyCooldown(channelId int, key string) (reason string, expiresUnix int64, cooling bool) {
	if key == "" {
		return "", 0, false
	}
	cooldownId := newChannelKeyCooldownID(channelId, key)
	channelKeyCooldowns.RLock()
	cd, ok := channelKeyCooldowns.items[cooldownId]
	channelKeyCooldowns.RUnlock()
	if !ok || !time.Now().Before(cd.expires) {
		return "", 0, false
	}
	return cd.reason, cd.expires.Unix(), true
}

func IsChannelKeyCoolingDown(channelId int, key string) bool {
	if key == "" {
		return false
	}
	cooldownId := newChannelKeyCooldownID(channelId, key)
	channelKeyCooldowns.RLock()
	cooldown, ok := channelKeyCooldowns.items[cooldownId]
	channelKeyCooldowns.RUnlock()
	if !ok {
		return false
	}
	if time.Now().Before(cooldown.expires) {
		return true
	}

	channelKeyCooldowns.Lock()
	if current, ok := channelKeyCooldowns.items[cooldownId]; ok && !time.Now().Before(current.expires) {
		delete(channelKeyCooldowns.items, cooldownId)
	}
	channelKeyCooldowns.Unlock()
	return false
}

func clearChannelCooldownsForTest() {
	channelCooldowns.Lock()
	channelCooldowns.items = make(map[int]channelCooldown)
	channelCooldowns.Unlock()

	channelKeyCooldowns.Lock()
	channelKeyCooldowns.items = make(map[channelKeyCooldownID]channelCooldown)
	channelKeyCooldowns.Unlock()
}

func ClearChannelCooldownsForTest() {
	clearChannelCooldownsForTest()
}
