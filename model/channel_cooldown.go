package model

import (
	"sync"
	"time"
)

type channelCooldown struct {
	reason                string
	expires               time.Time
	fallbackBlockedReason string
	fallbackBlockedUntil  time.Time
}

type channelCooldownState struct {
	reason                string
	expires               time.Time
	fallbackBlockedReason string
	fallbackBlockedUntil  time.Time
	active                bool
	allowFallback         bool
}

var channelCooldowns = struct {
	sync.RWMutex
	items map[int]channelCooldown
}{items: make(map[int]channelCooldown)}

func CooldownChannel(channelId int, reason string, duration time.Duration) {
	setChannelCooldown(channelId, reason, duration, false)
}

func CooldownChannelWithoutFallback(channelId int, reason string, duration time.Duration) {
	setChannelCooldown(channelId, reason, duration, true)
}

func setChannelCooldown(channelId int, reason string, duration time.Duration, blockFallback bool) {
	channelCooldowns.Lock()
	defer channelCooldowns.Unlock()

	now := time.Now()
	expires := now.Add(duration)
	current, ok := channelCooldowns.items[channelId]
	if !ok || !now.Before(current.expires) {
		current = channelCooldown{}
	}
	if current.expires.Before(expires) {
		current.reason = reason
		current.expires = expires
	}
	if blockFallback && current.fallbackBlockedUntil.Before(expires) {
		current.fallbackBlockedReason = reason
		current.fallbackBlockedUntil = expires
	}
	channelCooldowns.items[channelId] = current
}

// GetChannelCooldown returns the active cooldown reason and expiry (unix seconds)
// for a channel. cooling is false when the channel is not currently cooling down
// (no record, or the record has already expired).
func GetChannelCooldown(channelId int) (reason string, expiresUnix int64, cooling bool) {
	state := getChannelCooldownState(channelId)
	if !state.active {
		return "", 0, false
	}
	if !state.allowFallback {
		return state.fallbackBlockedReason, state.fallbackBlockedUntil.Unix(), true
	}
	return state.reason, state.expires.Unix(), true
}

func IsChannelCoolingDown(channelId int) bool {
	return getChannelCooldownState(channelId).active
}

func IsChannelCoolingFallbackAllowed(channelId int) bool {
	return getChannelCooldownState(channelId).allowFallback
}

func getChannelCooldownState(channelId int) channelCooldownState {
	now := time.Now()
	channelCooldowns.RLock()
	cooldown, ok := channelCooldowns.items[channelId]
	channelCooldowns.RUnlock()
	if !ok {
		return channelCooldownState{}
	}
	if now.Before(cooldown.expires) {
		return channelCooldownState{
			reason:                cooldown.reason,
			expires:               cooldown.expires,
			fallbackBlockedReason: cooldown.fallbackBlockedReason,
			fallbackBlockedUntil:  cooldown.fallbackBlockedUntil,
			active:                true,
			allowFallback:         !now.Before(cooldown.fallbackBlockedUntil),
		}
	}

	channelCooldowns.Lock()
	if current, ok := channelCooldowns.items[channelId]; ok && !now.Before(current.expires) {
		delete(channelCooldowns.items, channelId)
	}
	channelCooldowns.Unlock()
	return channelCooldownState{}
}

func clearChannelCooldownsForTest() {
	channelCooldowns.Lock()
	defer channelCooldowns.Unlock()
	channelCooldowns.items = make(map[int]channelCooldown)
}

func ClearChannelCooldownsForTest() {
	clearChannelCooldownsForTest()
}
