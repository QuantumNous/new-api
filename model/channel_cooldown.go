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

	channelCooldowns.items[channelId] = channelCooldown{
		reason:  reason,
		expires: time.Now().Add(duration),
	}
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
