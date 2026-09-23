package model

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/ratio_setting"
)

const channelModelRouteQuarantineDuration = 10 * time.Minute

type channelModelRouteKey struct {
	channelID   int
	group       string
	model       string
	requestPath string
}

type channelModelRouteQuarantine struct {
	expiresAt time.Time
}

var channelModelRouteHealth = struct {
	sync.RWMutex
	entries map[channelModelRouteKey]channelModelRouteQuarantine
}{
	entries: make(map[channelModelRouteKey]channelModelRouteQuarantine),
}

func normalizeChannelModelRoutePart(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func channelModelRouteKeyFor(channelID int, group, modelName, requestPath string) channelModelRouteKey {
	return channelModelRouteKey{
		channelID:   channelID,
		group:       normalizeChannelModelRoutePart(group),
		model:       normalizeChannelModelRoutePart(ratio_setting.FormatMatchingModelName(modelName)),
		requestPath: strings.TrimSpace(requestPath),
	}
}

// QuarantineChannelModelRoute temporarily removes one channel/model/path
// combination from selection. A single upstream route error must not
// permanently mutate the administrator's model list or disable the channel.
func QuarantineChannelModelRoute(channelID int, group, modelName, requestPath, reason string) {
	if channelID <= 0 || strings.TrimSpace(modelName) == "" {
		return
	}

	key := channelModelRouteKeyFor(channelID, group, modelName, requestPath)
	channelModelRouteHealth.Lock()
	channelModelRouteHealth.entries[key] = channelModelRouteQuarantine{
		expiresAt: time.Now().Add(channelModelRouteQuarantineDuration),
	}
	channelModelRouteHealth.Unlock()

	common.SysLog(fmt.Sprintf("temporarily quarantined channel route: channel=%d group=%s model=%s path=%s reason=%s",
		channelID, key.group, key.model, key.requestPath, common.LocalLogPreview(reason)))
}

func IsChannelModelRouteQuarantined(channelID int, group, modelName, requestPath string) bool {
	if channelID <= 0 || strings.TrimSpace(modelName) == "" {
		return false
	}

	key := channelModelRouteKeyFor(channelID, group, modelName, requestPath)
	now := time.Now()
	channelModelRouteHealth.RLock()
	entry, ok := channelModelRouteHealth.entries[key]
	channelModelRouteHealth.RUnlock()
	if !ok {
		return false
	}
	if now.Before(entry.expiresAt) {
		return true
	}

	channelModelRouteHealth.Lock()
	if current, exists := channelModelRouteHealth.entries[key]; exists && !now.Before(current.expiresAt) {
		delete(channelModelRouteHealth.entries, key)
	}
	channelModelRouteHealth.Unlock()
	return false
}

func filterAbilitiesByChannelModelRoute(abilities []Ability, group, modelName, requestPath string) []Ability {
	if len(abilities) == 0 {
		return abilities
	}
	filtered := make([]Ability, 0, len(abilities))
	for _, ability := range abilities {
		if !IsChannelModelRouteQuarantined(ability.ChannelId, group, modelName, requestPath) {
			filtered = append(filtered, ability)
		}
	}
	return filtered
}

func filterChannelIDsByModelRoute(channelIDs []int, group, modelName, requestPath string) []int {
	if len(channelIDs) == 0 {
		return channelIDs
	}
	filtered := make([]int, 0, len(channelIDs))
	for _, channelID := range channelIDs {
		if !IsChannelModelRouteQuarantined(channelID, group, modelName, requestPath) {
			filtered = append(filtered, channelID)
		}
	}
	return filtered
}
