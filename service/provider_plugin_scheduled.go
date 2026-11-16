package service

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"math/rand/v2"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
)

const pluginScheduledFailureDelay = 15 * time.Minute

// The scheduler keeps timing and execution flags; credentials stay in channels.
type pluginScheduledKey struct {
	channelID int
	index     int
}

type pluginScheduledEntry struct {
	identity        uint64
	next            time.Time
	lastDisabled    time.Time
	lastStatus      int
	disabledPending bool
	running         bool
	seen            bool
}

type pluginScheduler struct {
	mu      sync.Mutex
	entries map[pluginScheduledKey]*pluginScheduledEntry
	slots   chan struct{}
	workers sync.WaitGroup
}

var scheduledPlugins = &pluginScheduler{}

// ScanScheduledPlugins scans plugin channels after a channels topic change.
func ScanScheduledPlugins(ctx context.Context) error {
	if !common.IsMasterNode {
		return nil
	}
	for _, plugin := range jsplugin.DefaultRegistry.Generation().Plugins() {
		if !plugin.HasProviderHook("scheduled") {
			continue
		}
		var channels []*model.Channel
		if err := model.DB.WithContext(ctx).Where("type = ?", constant.ChannelTypeTaskPlugin).Order("id").Find(&channels).Error; err != nil {
			return err
		}
		scheduledPlugins.scan(channels, time.Now())
		return nil
	}
	return nil
}

// scan examines a plugin-channel snapshot. Workers exist
// only while a hook is running; a busy key waits for the next scan.
func (s *pluginScheduler) scan(channels []*model.Channel, now time.Time) {
	if !common.IsMasterNode {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, entry := range s.entries {
		entry.seen = false
	}
	for _, channel := range channels {
		plugin, ok := PluginOfChannel(channel)
		if !ok || !plugin.HasProviderHook("scheduled") || !scheduledChannelEligible(channel) {
			continue
		}
		for index, line := range pluginCredentialKeyLines(channel) {
			if !scheduledKeyEligible(channel, plugin, index, line) {
				continue
			}
			key := pluginScheduledKey{channel.Id, index}
			if s.entries == nil {
				s.entries = make(map[pluginScheduledKey]*pluginScheduledEntry)
			}
			entry := s.entries[key]
			identity := scheduledKeyIdentity(plugin, line)
			status := scheduledKeyStatus(channel, index)
			if entry == nil || !entry.running && entry.identity != identity {
				entry = &pluginScheduledEntry{identity: identity, lastStatus: status, next: now.Add(time.Duration(rand.Int64N(int64(10 * time.Minute))))}
				s.entries[key] = entry
			} else if entry.lastStatus != common.ChannelStatusAutoDisabled && status == common.ChannelStatusAutoDisabled {
				entry.disabledPending = true
			}
			entry.lastStatus = status
			if status != common.ChannelStatusAutoDisabled {
				entry.disabledPending = false
			}
			entry.seen = true
			if entry.running {
				continue
			}
			reason := "timer"
			if entry.disabledPending {
				if !entry.lastDisabled.IsZero() && now.Sub(entry.lastDisabled) < time.Minute {
					continue
				}
				reason = "disabled"
			} else if now.Before(entry.next) {
				continue
			}
			if s.slots == nil {
				s.slots = make(chan struct{}, 4)
			}
			select {
			case s.slots <- struct{}{}:
				entry.running = true
				if reason == "disabled" {
					entry.disabledPending, entry.lastDisabled = false, now
				}
				s.workers.Go(func() {
					s.run(channel, plugin, key, entry, line, reason)
				})
			default:
			}
		}
	}
	for key, entry := range s.entries {
		if !entry.seen && !entry.running {
			delete(s.entries, key)
		}
	}
	if len(s.entries) == 0 {
		s.entries = nil
	}
}

// disabled receives the channel reread after UpdateChannelStatus succeeds.
// Checking the export table precedes all scheduler allocation and JS work.
func (s *pluginScheduler) disabled(channel *model.Channel, usingKey string, now time.Time) {
	if !common.IsMasterNode {
		return
	}
	plugin, ok := PluginOfChannel(channel)
	if !ok || !plugin.HasProviderHook("scheduled") || !scheduledChannelEligible(channel) {
		return
	}
	lines := pluginCredentialKeyLines(channel)
	index := 0
	if channel.ChannelInfo.IsMultiKey {
		index = slices.Index(lines, usingKey)
	}
	if index < 0 || index >= len(lines) || !scheduledKeyEligible(channel, plugin, index, lines[index]) {
		return
	}
	key, line := pluginScheduledKey{channel.Id, index}, lines[index]
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.entries == nil {
		s.entries = make(map[pluginScheduledKey]*pluginScheduledEntry)
	}
	entry := s.entries[key]
	identity := scheduledKeyIdentity(plugin, line)
	if entry == nil || !entry.running && entry.identity != identity {
		entry = &pluginScheduledEntry{identity: identity}
		s.entries[key] = entry
	}
	// A sync scan can see this disable before DisableChannel gets here and
	// start its run; the same disable must not queue a second one.
	if entry.lastStatus == common.ChannelStatusAutoDisabled && !entry.lastDisabled.IsZero() && now.Sub(entry.lastDisabled) < time.Minute {
		return
	}
	entry.lastStatus = common.ChannelStatusAutoDisabled
	entry.disabledPending = true
	if entry.running || (!entry.lastDisabled.IsZero() && now.Sub(entry.lastDisabled) < time.Minute) {
		return
	}
	entry.running, entry.lastDisabled, entry.disabledPending = true, now, false
	if s.slots == nil {
		s.slots = make(chan struct{}, 4)
	}
	s.workers.Go(func() {
		// A disable returns immediately, including when all four slots are busy.
		s.slots <- struct{}{}
		s.run(channel, plugin, key, entry, line, "disabled")
	})
}

func (s *pluginScheduler) run(channel *model.Channel, plugin *jsplugin.LoadedPlugin, key pluginScheduledKey, entry *pluginScheduledEntry, line, reason string) {
	delay := pluginScheduledFailureDelay
	status := 0
	disabledByHook := false
	defer func() {
		if recover() != nil {
			common.SysLog(common.LogText("plugin scheduled failed: plugin=%s channel_id=%d key_index=%d category=%s", plugin.Meta.Key, channel.Id, key.index, "panic"))
			delay = pluginScheduledFailureDelay
		}
		<-s.slots
		s.mu.Lock()
		defer s.mu.Unlock()
		entry.running = false
		if s.entries[key] != entry {
			return
		}
		if delay == 0 {
			delete(s.entries, key)
		} else {
			entry.next = time.Now().Add(delay)
		}
		if status != 0 {
			entry.lastStatus = status
			if status != common.ChannelStatusAutoDisabled || disabledByHook {
				entry.disabledPending = false
			}
		}
	}()
	ctx, cancel := context.WithTimeout(context.Background(), pluginCredentialHookTimeout)
	defer cancel()
	var err error
	delay, status, disabledByHook, err = runScheduledPlugin(ctx, channel, plugin, key.index, line, reason)
	if err != nil {
		delay = pluginScheduledFailureDelay
		common.SysLog(common.LogText("plugin scheduled failed: plugin=%s channel_id=%d key_index=%d category=%s", plugin.Meta.Key, channel.Id, key.index, pluginErrorCategory(err)))
	}
}

func scheduledChannelEligible(channel *model.Channel) bool {
	return channel.Status == common.ChannelStatusEnabled || channel.Status == common.ChannelStatusAutoDisabled
}

func scheduledKeyStatus(channel *model.Channel, index int) int {
	if !channel.ChannelInfo.IsMultiKey {
		return channel.Status
	}
	if status, ok := channel.ChannelInfo.MultiKeyStatusList[index]; ok {
		return status
	}
	return common.ChannelStatusEnabled
}

func scheduledKeyEligible(channel *model.Channel, plugin *jsplugin.LoadedPlugin, index int, line string) bool {
	status := scheduledKeyStatus(channel, index)
	if status != common.ChannelStatusEnabled && status != common.ChannelStatusAutoDisabled || strings.TrimSpace(line) == "" {
		return false
	}
	if credential, ok := jsplugin.ParseCredential(line); ok {
		return credential.Plugin == plugin.Meta.Key && !credential.NeedsLogin
	}
	return true
}

// runScheduledPlugin calls the hook without channel locks. Its result is
// applied only while the prepared key still matches the stored key.
func runScheduledPlugin(ctx context.Context, channel *model.Channel, plugin *jsplugin.LoadedPlugin, keyIndex int, line, reason string) (time.Duration, int, bool, error) {
	if !common.IsMasterNode {
		return 0, 0, false, nil
	}
	prepared, err := FreshPluginCredentialLine(ctx, plugin, channel.Id, keyIndex, line)
	if errors.Is(err, ErrPluginCredentialNeedsLogin) || errors.Is(err, ErrPluginCredentialRemoved) {
		return 0, 0, false, nil
	}
	if err != nil {
		return 0, 0, false, err
	}
	current, err := model.GetChannelById(channel.Id, true)
	if err != nil {
		return 0, 0, false, err
	}
	currentPlugin, ok := PluginOfChannel(current)
	if !ok || currentPlugin != plugin || !scheduledChannelEligible(current) {
		return 0, 0, false, nil
	}
	lines := pluginCredentialKeyLines(current)
	if keyIndex < 0 || keyIndex >= len(lines) {
		return 0, 0, false, nil
	}
	if lines[keyIndex] != prepared {
		return time.Minute, 0, false, nil
	}
	if !scheduledKeyEligible(current, plugin, keyIndex, prepared) {
		return 0, 0, false, nil
	}
	credential, isCredential := jsplugin.ParseCredential(prepared)
	hookCtx := jsplugin.CredentialContext{BaseURL: current.GetBaseURL(), Config: plugin.ChannelConfigFor(current.GetOtherSettings().PluginConfig)}
	proxy := current.GetSetting().Proxy
	if isCredential {
		hookCtx.Credential = credential.Data
	} else {
		hookCtx.APIKey = prepared
		if plugin.HasProviderHook("exchangeKey") {
			hookCtx.Token, err = PluginKeyToken(ctx, plugin, current.Id, prepared, hookCtx.Config, hookCtx.BaseURL, proxy)
			if err != nil {
				return 0, 0, false, err
			}
		}
	}
	callCtx := jsplugin.ScheduledContext{CredentialContext: hookCtx, Reason: reason, KeyStatus: "enabled"}
	if scheduledKeyStatus(current, keyIndex) == common.ChannelStatusAutoDisabled {
		callCtx.KeyStatus = "auto_disabled"
		if current.ChannelInfo.IsMultiKey {
			callCtx.DisabledReason = current.ChannelInfo.MultiKeyDisabledReason[keyIndex]
		} else {
			callCtx.DisabledReason, _ = current.GetOtherInfo()["status_reason"].(string)
		}
	}
	result, err := plugin.CallScheduled(PluginCredentialHookContext(ctx, plugin, hookCtx.BaseURL, proxy), callCtx)
	if err != nil {
		return 0, 0, false, err
	}
	nextLine := prepared
	if result.Credential != nil {
		if !isCredential {
			return 0, 0, false, errors.New("scheduled cannot replace a static key")
		}
		updated := *credential
		updated.Data = result.Credential
		if nextLine, err = updated.Line(); err != nil {
			return 0, 0, false, err
		}
	}
	statusReason := result.Notify.Text("en")
	if statusReason == "" {
		statusReason = "Disabled by plugin"
	}
	var statusChanged, applied bool
	var delay time.Duration
	stored, err := model.UpdateScheduledChannelLocked(ctx, channel.Id, func(current *model.Channel) error {
		currentPlugin, ok := PluginOfChannel(current)
		if !ok || currentPlugin != plugin || !scheduledChannelEligible(current) {
			return nil
		}
		lines := pluginCredentialKeyLines(current)
		if keyIndex >= len(lines) {
			return nil
		}
		if lines[keyIndex] != prepared || current.GetBaseURL() != hookCtx.BaseURL || current.GetSetting().Proxy != proxy ||
			!bytes.Equal(plugin.ChannelConfigFor(current.GetOtherSettings().PluginConfig), hookCtx.Config) {
			delay = time.Minute
			return nil
		}
		if !scheduledKeyEligible(current, plugin, keyIndex, prepared) {
			return nil
		}
		if nextLine != prepared {
			lines[keyIndex] = nextLine
			current.Key = strings.Join(lines, "\n")
			current.Keys = nil
		}
		switch result.KeyStatus {
		case "enabled":
			statusChanged = model.SetScheduledChannelKeyStatus(current, keyIndex, common.ChannelStatusEnabled, "")
		case "auto_disabled":
			statusChanged = model.SetScheduledChannelKeyStatus(current, keyIndex, common.ChannelStatusAutoDisabled, statusReason)
		}
		applied, delay = true, result.Next
		return nil
	})
	if err != nil || !applied {
		return delay, 0, false, err
	}
	status := scheduledKeyStatus(stored, keyIndex)
	var balanceErr error
	if result.Balance != nil {
		_, balanceErr = UpdatePluginKeyBalances(stored, map[int]model.ChannelBalanceDetail{keyIndex: {BalanceResult: *result.Balance}})
	}
	if statusChanged {
		params := map[string]any{"Name": stored.Name, "Id": stored.Id, "Reason": statusReason}
		subject, content := i18n.MsgChannelNotifyEnabledSubject, i18n.MsgChannelNotifyEnabledContent
		if status == common.ChannelStatusAutoDisabled {
			subject, content = i18n.MsgChannelNotifyDisabledSubject, i18n.MsgChannelNotifyDisabledContent
			if stored.Status == common.ChannelStatusAutoDisabled {
				CloseActiveWebSocketsForChannel(stored.Id, ChannelDisabledCloseReason)
			}
		}
		NotifyChannelWatchers(formatNotifyType(stored.Id, status), func(lang string) (string, string) {
			return i18n.Translate(lang, subject, params), i18n.Translate(lang, content, params)
		})
	}
	if len(result.Notify) > 0 {
		NotifyChannelWatchers(formatNotifyType(stored.Id, 0), func(lang string) (string, string) {
			if lang == "" {
				lang = common.DefaultLanguage
			}
			if strings.HasPrefix(strings.ToLower(lang), "zh") {
				lang = i18n.ParseAcceptLanguage(lang)
			}
			return i18n.Translate(lang, i18n.MsgChannelNotifyScheduledSubject, map[string]any{"Name": stored.Name, "Id": stored.Id}), result.Notify.Text(lang)
		})
	}
	return delay, status, statusChanged && status == common.ChannelStatusAutoDisabled, balanceErr
}

// scheduledKeyIdentity distinguishes replacement keys without retaining their
// secrets. Credential data changes on refresh; account identity stays stable.
func scheduledKeyIdentity(plugin *jsplugin.LoadedPlugin, line string) uint64 {
	identity := "key\x00" + line
	if credential, ok := jsplugin.ParseCredential(line); ok {
		identity = "account\x00" + credential.AccountID
	}
	sum := sha256.Sum256([]byte(plugin.Meta.Key + "\x00" + identity))
	return binary.LittleEndian.Uint64(sum[:8])
}
