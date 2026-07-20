package model

import (
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

func clearChannelCooldownsForTest() {
	channelCooldowns.Lock()
	defer channelCooldowns.Unlock()
	channelCooldowns.items = make(map[int]channelCooldown)
}

func ClearChannelCooldownsForTest() {
	clearChannelCooldownsForTest()
}
