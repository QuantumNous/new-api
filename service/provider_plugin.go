package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/bytedance/gopkg/util/gopool"
	"golang.org/x/sync/singleflight"
)

const (
	// PluginCredentialRequestMargin is how close to its expiry a credential is
	// refreshed before a request uses it.
	PluginCredentialRequestMargin = 30 * time.Second
	pluginCredentialScanInterval  = time.Minute
	pluginCredentialScanWindow    = 10 * time.Minute
	pluginCredentialHookTimeout   = 60 * time.Second
)

var (
	ErrPluginCredentialNeedsLogin = errors.New("plugin credential needs a new login")
	ErrPluginCredentialRemoved    = errors.New("plugin credential was removed from the channel")
	// ErrPluginCredentialRefreshFailed stands for a failed refresh of an
	// expired credential; the plugin's own message may quote the vendor.
	ErrPluginCredentialRefreshFailed = errors.New("plugin credential refresh failed")
)

// PluginOfChannel returns the plugin a task plugin channel is bound to. Its
// credential hooks serve the channel whatever parts the plugin has.
func PluginOfChannel(channel *model.Channel) (*jsplugin.LoadedPlugin, bool) {
	if channel == nil || channel.Type != constant.ChannelTypeTaskPlugin {
		return nil, false
	}
	return jsplugin.DefaultRegistry.Get(channel.GetSetting().TaskPluginKey)
}

// PluginFetcher returns the utils.fetch of a plugin's hooks on a channel: the
// base URL host and the plugin's allowedHosts only, through the channel proxy,
// with a redirect returned to the plugin as it is. setting decides TLS
// verification; credential hooks pass none, so they always verify TLS.
func PluginFetcher(plugin *jsplugin.LoadedPlugin, baseURL, proxy string, setting dto.ChannelSettings) jsplugin.Fetcher {
	return func(ctx context.Context, request jsplugin.FetchRequest) (jsplugin.FetchResponse, error) {
		if err := jsplugin.ValidateRequestURL(request.URL, baseURL, plugin.Meta.AllowedHosts); err != nil {
			return jsplugin.FetchResponse{}, err
		}
		client, err := GetHttpClientWithProxySettings(proxy, setting)
		if err != nil {
			return jsplugin.FetchResponse{}, err
		}
		return sendPluginFetch(ctx, plugin, client, request)
	}
}

// RequestPluginFetcher returns the utils.fetch of a request processing
// instance's ingress, egress and report hooks: the plugin's allowedHosts and
// the hosts of the instance's url config values only. The destination is the
// instance's own service, not a channel's upstream, so requests use no
// channel proxy and always verify TLS; a redirect reaches the plugin as it is.
func RequestPluginFetcher(plugin *jsplugin.LoadedPlugin, config json.RawMessage) jsplugin.Fetcher {
	return func(ctx context.Context, request jsplugin.FetchRequest) (jsplugin.FetchResponse, error) {
		hosts := append(slices.Clone(plugin.Meta.AllowedHosts), plugin.ConfigURLHosts(config)...)
		if err := jsplugin.ValidateServiceURL(request.URL, hosts); err != nil {
			return jsplugin.FetchResponse{}, err
		}
		client, err := GetHttpClientWithProxySettings("", dto.ChannelSettings{})
		if err != nil {
			return jsplugin.FetchResponse{}, err
		}
		return sendPluginFetch(ctx, plugin, client, request)
	}
}

// sendPluginFetch sends one checked utils.fetch request with client. A
// redirect reaches the plugin as it is; fetching its location is a new
// request, checked and counted again.
func sendPluginFetch(ctx context.Context, plugin *jsplugin.LoadedPlugin, client *http.Client, request jsplugin.FetchRequest) (jsplugin.FetchResponse, error) {
	noRedirects := *client
	noRedirects.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	var body io.Reader
	if request.Method == http.MethodPost {
		body = strings.NewReader(request.Body)
		if request.BodyStream != nil {
			// The body names media of the request, streamed as data URLs.
			body = request.BodyStream
		}
	}
	req, err := http.NewRequestWithContext(ctx, request.Method, request.URL, body)
	if err != nil {
		return jsplugin.FetchResponse{}, err
	}
	if request.Method == http.MethodPost && request.BodyStream != nil {
		req.ContentLength = request.BodySize
	}
	for name, value := range request.Headers {
		req.Header.Set(name, value)
	}
	started := time.Now()
	resp, err := noRedirects.Do(req)
	if err != nil {
		logger.LogDebug(ctx, "task_plugin subsystem=fetch event=failed plugin=%q hook=%q method=%q host=%q reason=transport_error elapsed_ms=%d",
			plugin.Meta.Key, request.Hook, request.Method, req.URL.Host, time.Since(started).Milliseconds())
		return jsplugin.FetchResponse{}, err
	}
	defer resp.Body.Close()
	responseBody, err := io.ReadAll(io.LimitReader(resp.Body, jsplugin.MaxFetchBodyBytes+1))
	if err != nil {
		return jsplugin.FetchResponse{}, err
	}
	headers := make(map[string]string, len(resp.Header))
	for name, values := range resp.Header {
		if len(values) > 0 {
			headers[name] = values[0]
		}
	}
	logger.LogDebug(ctx, "task_plugin subsystem=fetch event=done plugin=%q hook=%q method=%q host=%q status=%d bytes=%d elapsed_ms=%d",
		plugin.Meta.Key, request.Hook, request.Method, req.URL.Host, resp.StatusCode, len(responseBody), time.Since(started).Milliseconds())
	return jsplugin.FetchResponse{Status: resp.StatusCode, Headers: headers, Body: responseBody}, nil
}

// PluginCredentialHookContext is the context of a login, refresh or revoke
// call on a channel: utils.fetch may POST, through the channel proxy, and
// always verifies TLS whatever the channel's TLS setting is.
func PluginCredentialHookContext(ctx context.Context, plugin *jsplugin.LoadedPlugin, baseURL, proxy string) context.Context {
	return jsplugin.WithFetcher(ctx, PluginFetcher(plugin, baseURL, proxy, dto.ChannelSettings{}))
}

// PluginCredentialRefresher refreshes plugin credentials with one plugin call
// per credential at a time: single-flight on this node, and the channel row
// lock held across the call for every node.
type PluginCredentialRefresher struct {
	group singleflight.Group
}

var pluginCredentialRefresher = &PluginCredentialRefresher{}

// RefreshPluginCredential refreshes the credential line a request or the
// background scan used, at keyIndex of the channel's keys. It returns the line
// to use from now on: the refreshed one, or the one another node stored
// meanwhile.
func RefreshPluginCredential(ctx context.Context, channelID, keyIndex int, line string) (string, error) {
	return pluginCredentialRefresher.Refresh(ctx, channelID, keyIndex, line)
}

// Refresh is RefreshPluginCredential on this refresher's single-flight group.
func (r *PluginCredentialRefresher) Refresh(ctx context.Context, channelID, keyIndex int, line string) (string, error) {
	sum := sha256.Sum256([]byte(line))
	flight := r.group.DoChan(strconv.Itoa(channelID)+":"+hex.EncodeToString(sum[:]), func() (any, error) {
		// The call is shared, so no single caller's cancellation ends it.
		return refreshPluginCredentialLine(channelID, keyIndex, line)
	})
	select {
	case result := <-flight:
		if result.Err != nil {
			return "", result.Err
		}
		return result.Val.(string), nil
	case <-ctx.Done():
		return "", ctx.Err()
	}
}

func refreshPluginCredentialLine(channelID, keyIndex int, used string) (string, error) {
	usedCredential, ok := jsplugin.ParseCredential(used)
	if !ok {
		return "", errors.New("channel key is not a plugin credential")
	}
	var current string
	var channelName string
	multiKey, autoBan := false, false
	needsLogin := false
	storedElsewhere := false
	stored, err := model.UpdateChannelLocked(channelID, func(channel *model.Channel) error {
		channelName, multiKey, autoBan = channel.Name, channel.ChannelInfo.IsMultiKey, channel.GetAutoBan()
		plugin, ok := PluginOfChannel(channel)
		if !ok || plugin.Meta.Key != usedCredential.Plugin {
			return fmt.Errorf("channel #%d is not bound to plugin %s", channelID, usedCredential.Plugin)
		}
		if !plugin.HasProviderHook("refresh") {
			return fmt.Errorf("plugin %s does not export refresh", plugin.Meta.Key)
		}
		lines := pluginCredentialKeyLines(channel)
		index := locatePluginCredentialLine(lines, keyIndex, used, usedCredential)
		if index < 0 {
			return ErrPluginCredentialRemoved
		}
		if lines[index] != used {
			// Another node refreshed or a login replaced it meanwhile.
			current, storedElsewhere = lines[index], true
			return nil
		}
		ctx, cancel := context.WithTimeout(context.Background(), pluginCredentialHookTimeout)
		defer cancel()
		ctx = PluginCredentialHookContext(ctx, plugin, channel.GetBaseURL(), channel.GetSetting().Proxy)
		result, err := plugin.CallRefresh(ctx, jsplugin.CredentialContext{BaseURL: channel.GetBaseURL(), Credential: usedCredential.Data, Config: plugin.ChannelConfigFor(channel.GetOtherSettings().PluginConfig)})
		if err != nil {
			return err
		}
		next := *usedCredential
		if result.Relogin {
			next.NeedsLogin = true
			needsLogin = true
		} else {
			if result.AccountID != "" && usedCredential.AccountID != "" && result.AccountID != usedCredential.AccountID {
				return fmt.Errorf("plugin %s refresh returned another account", plugin.Meta.Key)
			}
			next = refreshedPluginCredential(*usedCredential, result)
		}
		if current, err = next.Line(); err != nil {
			return err
		}
		lines[index] = current
		channel.Key = strings.Join(lines, "\n")
		return nil
	})
	if err != nil {
		return "", err
	}
	if storedElsewhere {
		// This node's cache may still hold the line the request used, and
		// would send every request here until the next cache sync.
		model.CacheUpdateChannelKey(channelID, stored.Key)
	}
	if needsLogin {
		DisablePluginCredentialForLogin(channelID, channelName, multiKey, autoBan, current)
		return "", ErrPluginCredentialNeedsLogin
	}
	if credential, ok := jsplugin.ParseCredential(current); ok && credential.NeedsLogin {
		return "", ErrPluginCredentialNeedsLogin
	}
	return current, nil
}

// DisablePluginCredentialForLogin disables the key holding line, a
// credential only a new login restores, for the reason a successful login
// clears. Like any channel error it disables only under the automatic
// disabling setting and the channel's own switch, autoBan.
func DisablePluginCredentialForLogin(channelID int, channelName string, multiKey, autoBan bool, line string) {
	DisableChannel(types.ChannelError{
		ChannelId:   channelID,
		ChannelType: constant.ChannelTypeTaskPlugin,
		ChannelName: channelName,
		IsMultiKey:  multiKey,
		AutoBan:     autoBan && common.AutomaticDisableChannelEnabled,
		UsingKey:    line,
	}, model.ChannelStatusReasonPluginNeedsLogin)
}

// ErrPluginKeyExchangeFailed stands for an exchangeKey call that threw or
// returned no valid result; the plugin's own message may quote the vendor.
var ErrPluginKeyExchangeFailed = errors.New("plugin key exchange failed")

// pluginTokenCacheLimit bounds the tokens a node keeps; past it the cache
// starts over.
const pluginTokenCacheLimit = 10_000

// pluginTokens caches the exchangeKey tokens of static key lines on this
// node, by channel, key line, plugin version, plugin config and base URL.
var pluginTokens = &pluginTokenCache{tokens: map[string]jsplugin.ExchangedToken{}}

type pluginTokenCache struct {
	mutex  sync.Mutex
	tokens map[string]jsplugin.ExchangedToken
	group  singleflight.Group
}

func pluginTokenKey(plugin *jsplugin.LoadedPlugin, channelID int, line string, config json.RawMessage, baseURL string) string {
	lineSum := sha256.Sum256([]byte(line))
	configSum := sha256.Sum256(append(append([]byte(baseURL), 0), config...))
	return strconv.Itoa(channelID) + ":" + plugin.Meta.Key + "@" + plugin.Meta.Version + ":" + hex.EncodeToString(lineSum[:]) + ":" + hex.EncodeToString(configSum[:])
}

// PluginKeyToken returns the exchangeKey token of the static key line of a
// channel: the cached one, or a new exchange when there is none or it
// expires within the request margin. Concurrent callers share one exchange.
// The exchange may POST through the channel proxy and always verifies TLS. A
// returned {error} is a *jsplugin.UpstreamError; a throw or an invalid result
// is ErrPluginKeyExchangeFailed, logged by category only.
func PluginKeyToken(ctx context.Context, plugin *jsplugin.LoadedPlugin, channelID int, line string, config json.RawMessage, baseURL, proxy string) (json.RawMessage, error) {
	key := pluginTokenKey(plugin, channelID, line, config, baseURL)
	pluginTokens.mutex.Lock()
	cached, ok := pluginTokens.tokens[key]
	pluginTokens.mutex.Unlock()
	if ok && (cached.ExpiresAt == 0 || !time.Unix(cached.ExpiresAt, 0).Before(time.Now().Add(PluginCredentialRequestMargin))) {
		return cached.Token, nil
	}
	flight := pluginTokens.group.DoChan(key, func() (any, error) {
		// The call is shared, so no single caller's cancellation ends it.
		hookCtx, cancel := context.WithTimeout(context.Background(), pluginCredentialHookTimeout)
		defer cancel()
		hookCtx = PluginCredentialHookContext(hookCtx, plugin, baseURL, proxy)
		exchanged, upstreamErr, err := plugin.CallExchangeKey(hookCtx, jsplugin.CredentialContext{BaseURL: baseURL, APIKey: line, Config: config})
		if err != nil {
			common.SysLog(common.LogText("plugin key exchange failed: plugin=%s channel_id=%d category=%s", plugin.Meta.Key, channelID, pluginErrorCategory(err)))
			return nil, ErrPluginKeyExchangeFailed
		}
		if upstreamErr != nil {
			return nil, upstreamErr
		}
		pluginTokens.mutex.Lock()
		if len(pluginTokens.tokens) >= pluginTokenCacheLimit {
			clear(pluginTokens.tokens)
		}
		pluginTokens.tokens[key] = exchanged
		pluginTokens.mutex.Unlock()
		return exchanged.Token, nil
	})
	select {
	case result := <-flight:
		if result.Err != nil {
			return nil, result.Err
		}
		return result.Val.(json.RawMessage), nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

// InvalidatePluginKeyToken drops the cached token of a key line after the
// upstream rejected it, unless another exchange replaced it meanwhile.
func InvalidatePluginKeyToken(plugin *jsplugin.LoadedPlugin, channelID int, line string, config json.RawMessage, baseURL string, used json.RawMessage) {
	key := pluginTokenKey(plugin, channelID, line, config, baseURL)
	pluginTokens.mutex.Lock()
	defer pluginTokens.mutex.Unlock()
	if cached, ok := pluginTokens.tokens[key]; ok && string(cached.Token) == string(used) {
		delete(pluginTokens.tokens, key)
	}
}

// FreshPluginCredentialLine returns the line a request about to use the
// credential line at keyIndex sends: the line, or its refresh when it expires
// within the request margin. A failed refresh keeps a credential that has not
// expired and is logged by category only, since the plugin's message may
// quote the vendor's answer. A credential only a new login restores reports
// ErrPluginCredentialNeedsLogin, an expired one whose refresh failed
// ErrPluginCredentialRefreshFailed. A static key is returned as it is.
func FreshPluginCredentialLine(ctx context.Context, plugin *jsplugin.LoadedPlugin, channelID, keyIndex int, line string) (string, error) {
	credential, ok := jsplugin.ParseCredential(line)
	if !ok {
		return line, nil
	}
	if credential.NeedsLogin {
		return "", ErrPluginCredentialNeedsLogin
	}
	now := time.Now()
	if !credential.ExpiresWithin(now, PluginCredentialRequestMargin) || !plugin.HasProviderHook("refresh") {
		return line, nil
	}
	refreshed, err := RefreshPluginCredential(ctx, channelID, keyIndex, line)
	if err == nil || errors.Is(err, ErrPluginCredentialNeedsLogin) {
		return refreshed, err
	}
	common.SysLog(common.LogText("plugin credential refresh failed: plugin=%s channel_id=%d key_index=%d category=%s", plugin.Meta.Key, channelID, keyIndex, pluginErrorCategory(err)))
	if credential.ExpiresWithin(now, 0) {
		return "", ErrPluginCredentialRefreshFailed
	}
	return line, nil
}

// refreshedPluginCredential is stored after a refresh: its result replaces
// the credential's data, headers, query and expiry; an omitted account id or
// label keeps the stored one.
func refreshedPluginCredential(stored jsplugin.Credential, result jsplugin.CredentialResult) jsplugin.Credential {
	stored.Data = result.Credential
	stored.Headers = result.Headers
	stored.Query = result.Query
	stored.ExpiresAt = result.ExpiresAt
	stored.NeedsLogin = false
	if result.AccountID != "" {
		stored.AccountID = result.AccountID
	}
	if result.Label != "" {
		stored.Label = result.Label
	}
	return stored
}

// pluginCredentialKeyLines splits a channel key into its lines: the whole key
// is the one line of a single-key channel. An empty key has none.
func pluginCredentialKeyLines(channel *model.Channel) []string {
	if strings.TrimSpace(channel.Key) == "" {
		return nil
	}
	if !channel.ChannelInfo.IsMultiKey {
		return []string{channel.Key}
	}
	return strings.Split(strings.Trim(channel.Key, "\n"), "\n")
}

// locatePluginCredentialLine finds the stored line of a used credential: at
// its index, the same line or a newer credential of the same plugin and
// account; otherwise the same line where it moved. It returns -1 when the
// credential is gone.
func locatePluginCredentialLine(lines []string, index int, used string, usedCredential *jsplugin.Credential) int {
	if index >= 0 && index < len(lines) {
		if lines[index] == used {
			return index
		}
		stored, ok := jsplugin.ParseCredential(lines[index])
		if ok && stored.Plugin == usedCredential.Plugin &&
			(stored.AccountID == "" || usedCredential.AccountID == "" || stored.AccountID == usedCredential.AccountID) {
			return index
		}
	}
	for candidate, line := range lines {
		if line == used {
			return candidate
		}
	}
	return -1
}

var (
	pluginCredentialScanOnce    sync.Once
	pluginCredentialScanRunning atomic.Bool
)

// StartPluginCredentialRefreshTask makes the master node refresh, every
// minute, the plugin credentials that expire within max(10 minutes, three
// channel cache sync intervals), so every node's cache holds a fresh one.
func StartPluginCredentialRefreshTask() {
	pluginCredentialScanOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		gopool.Go(func() {
			ticker := time.NewTicker(pluginCredentialScanInterval)
			defer ticker.Stop()
			for range ticker.C {
				RefreshExpiringPluginCredentials(time.Now())
			}
		})
	})
}

// RefreshExpiringPluginCredentials runs one background refresh scan.
func RefreshExpiringPluginCredentials(now time.Time) {
	if !pluginCredentialScanRunning.CompareAndSwap(false, true) {
		return
	}
	defer pluginCredentialScanRunning.Store(false)
	window := max(pluginCredentialScanWindow, 3*time.Duration(common.SyncFrequency)*time.Second)
	var channels []*model.Channel
	if err := model.DB.Where("type = ?", constant.ChannelTypeTaskPlugin).Order("id").Find(&channels).Error; err != nil {
		common.SysError(common.LogText("plugin credential refresh: query channels failed: %v", err))
		return
	}
	if common.IsMasterNode {
		scheduledPlugins.scan(channels, now)
	}
	for _, channel := range channels {
		plugin, ok := PluginOfChannel(channel)
		if !ok || !plugin.HasProviderHook("refresh") {
			continue
		}
		for index, line := range pluginCredentialKeyLines(channel) {
			credential, ok := jsplugin.ParseCredential(line)
			if !ok || credential.Plugin != plugin.Meta.Key || credential.NeedsLogin || !credential.ExpiresWithin(now, window) {
				continue
			}
			ctx, cancel := context.WithTimeout(context.Background(), pluginCredentialHookTimeout+5*time.Second)
			_, err := RefreshPluginCredential(ctx, channel.Id, index, line)
			cancel()
			if err != nil {
				common.SysLog(common.LogText("plugin credential refresh failed: plugin=%s channel_id=%d key_index=%d category=%s", plugin.Meta.Key, channel.Id, index, pluginErrorCategory(err)))
			}
		}
	}
}

// pluginErrorCategory names a plugin call failure for logs without its
// message, which may quote a vendor response.
func pluginErrorCategory(err error) string {
	var hookErr *jsplugin.HookError
	switch {
	case errors.Is(err, ErrPluginCredentialNeedsLogin):
		return "needs_login"
	case errors.Is(err, ErrPluginCredentialRemoved):
		return "credential_removed"
	case errors.Is(err, model.ErrChannelKeyChanged):
		return "key_changed"
	case errors.Is(err, context.DeadlineExceeded):
		return "timeout"
	case errors.As(err, &hookErr):
		return "plugin_error"
	default:
		return "error"
	}
}

// RevokePluginCredentials calls the plugin's revoke for each removed
// credential line of the plugin, in the background. It never blocks the
// removal and only logs its failures.
func RevokePluginCredentials(pluginKey, baseURL, proxy string, channelID int, config json.RawMessage, lines []string) {
	var credentials []json.RawMessage
	for _, line := range lines {
		if credential, ok := jsplugin.ParseCredential(line); ok && credential.Plugin == pluginKey {
			credentials = append(credentials, credential.Data)
		}
	}
	revokePluginCredentialData(pluginKey, baseURL, proxy, channelID, config, credentials)
}

// revokePluginCredentialData calls the plugin's revoke for the data of each
// credential, in the background, and only logs its failures.
func revokePluginCredentialData(pluginKey, baseURL, proxy string, channelID int, storedConfig json.RawMessage, credentials []json.RawMessage) {
	plugin, ok := jsplugin.DefaultRegistry.Get(pluginKey)
	if !ok || !plugin.HasProviderHook("revoke") || len(credentials) == 0 {
		return
	}
	config := plugin.ChannelConfigFor(storedConfig)
	gopool.Go(func() {
		for _, credential := range credentials {
			ctx, cancel := context.WithTimeout(context.Background(), pluginCredentialHookTimeout)
			err := plugin.CallRevoke(PluginCredentialHookContext(ctx, plugin, baseURL, proxy), jsplugin.CredentialContext{BaseURL: baseURL, Credential: credential, Config: config})
			cancel()
			if err != nil {
				common.SysLog(common.LogText("plugin credential revoke failed: plugin=%s channel_id=%d category=%s", pluginKey, channelID, pluginErrorCategory(err)))
			}
		}
	})
}

// RemovedPluginCredentialLines returns the credential lines of before that
// after no longer holds.
func RemovedPluginCredentialLines(before, after string) []string {
	if !strings.Contains(before, jsplugin.CredentialType) {
		return nil
	}
	kept := make(map[string]struct{})
	for line := range strings.SplitSeq(after, "\n") {
		kept[strings.TrimSpace(line)] = struct{}{}
	}
	var removed []string
	for line := range strings.SplitSeq(before, "\n") {
		line = strings.TrimSpace(line)
		if _, ok := kept[line]; ok {
			continue
		}
		if _, ok := jsplugin.ParseCredential(line); ok {
			removed = append(removed, line)
		}
	}
	return removed
}

// PluginModelListKey returns the key line the model list request of a channel
// uses: its first enabled key that is a static key or a credential of the
// plugin that needs no login, with the credential fresh as before a relay
// request. A channel without keys has an empty one, for a route that needs
// none.
func PluginModelListKey(ctx context.Context, channel *model.Channel, plugin *jsplugin.LoadedPlugin) (string, error) {
	lines := pluginCredentialKeyLines(channel)
	for index, line := range lines {
		if status, ok := channel.ChannelInfo.MultiKeyStatusList[index]; ok && status != common.ChannelStatusEnabled {
			continue
		}
		credential, ok := jsplugin.ParseCredential(line)
		if !ok {
			if key := strings.TrimSpace(line); key != "" {
				return key, nil
			}
			continue
		}
		if credential.Plugin == plugin.Meta.Key && !credential.NeedsLogin {
			return FreshPluginCredentialLine(ctx, plugin, channel.Id, index, line)
		}
	}
	if len(lines) > 0 {
		return "", errors.New("channel has no usable key")
	}
	return "", nil
}

// CheckSubmittedPluginCredentials rejects a key an administrator submits for
// a channel when it holds a plugin credential only a login can create: one
// not stored on the channel already, or one the channel's plugin does not
// own, which would reach another upstream as an API key.
func CheckSubmittedPluginCredentials(channelType int, pluginKey, key, storedKey string) error {
	if !strings.Contains(key, jsplugin.CredentialType) {
		return nil
	}
	stored := make(map[string]struct{})
	for _, line := range keyCredentialCandidates(storedKey) {
		stored[strings.TrimSpace(line)] = struct{}{}
	}
	for _, line := range keyCredentialCandidates(key) {
		credential, ok := jsplugin.ParseCredential(line)
		if !ok {
			continue
		}
		if _, ok := stored[strings.TrimSpace(line)]; !ok {
			return common.NewMessage("Plugin credentials can only be added by logging in")
		}
		if channelType != constant.ChannelTypeTaskPlugin || pluginKey != credential.Plugin {
			return common.NewMessage("Replace the plugin credentials in the key before changing the channel type or plugin")
		}
	}
	return nil
}

// keyCredentialCandidates reads a key the ways a channel does: whole, by
// line or as a JSON array.
func keyCredentialCandidates(key string) []string {
	if key == "" {
		return nil
	}
	return append([]string{key}, (&model.Channel{Key: key}).GetKeys()...)
}

// DropPluginCredentials removes the credential lines from the key of a
// channel copy, since a credential belongs to the channel its login stored it
// on. A task plugin copy left without a key waits for a login.
func DropPluginCredentials(channel *model.Channel) {
	if !strings.Contains(channel.Key, jsplugin.CredentialType) {
		return
	}
	if !channel.ChannelInfo.IsMultiKey {
		if _, ok := jsplugin.ParseCredential(channel.Key); ok {
			channel.Key = ""
		}
	} else {
		info := channel.ChannelInfo
		keys := channel.GetKeys()
		kept := make([]string, 0, len(keys))
		statusList, reasons, times := map[int]int{}, map[int]string{}, map[int]int64{}
		for index, key := range keys {
			if _, ok := jsplugin.ParseCredential(key); ok {
				continue
			}
			next := len(kept)
			if status, ok := info.MultiKeyStatusList[index]; ok {
				statusList[next] = status
			}
			if reason, ok := info.MultiKeyDisabledReason[index]; ok {
				reasons[next] = reason
			}
			if at, ok := info.MultiKeyDisabledTime[index]; ok {
				times[next] = at
			}
			kept = append(kept, key)
		}
		if len(kept) == len(keys) {
			return
		}
		channel.Key = strings.Join(kept, "\n")
		channel.Keys = nil
		info.MultiKeySize = len(kept)
		info.MultiKeyStatusList, info.MultiKeyDisabledReason, info.MultiKeyDisabledTime = statusList, reasons, times
		info.MultiKeyPollingIndex = 0
		channel.ChannelInfo = info
	}
	if strings.TrimSpace(channel.Key) == "" {
		PluginLoginNeededStatus(channel)
	}
}

// RevokeDeletedChannelCredentials revokes the plugin credentials of deleted
// task plugin channels, in the background.
func RevokeDeletedChannelCredentials(channels []*model.Channel) {
	for _, channel := range channels {
		if channel == nil || channel.Type != constant.ChannelTypeTaskPlugin {
			continue
		}
		RevokePluginCredentials(channel.GetSetting().TaskPluginKey, channel.GetBaseURL(), channel.GetSetting().Proxy, channel.Id, channel.GetOtherSettings().PluginConfig, pluginCredentialKeyLines(channel))
	}
}

// RevokeRemovedChannelCredentials revokes the credential lines of a task
// plugin channel's key before an edit that its key after it no longer holds.
// stored gives the plugin, base URL and proxy the credentials were used with.
func RevokeRemovedChannelCredentials(stored *model.Channel, before, after string) {
	if stored.Type != constant.ChannelTypeTaskPlugin {
		return
	}
	RevokePluginCredentials(stored.GetSetting().TaskPluginKey, stored.GetBaseURL(), stored.GetSetting().Proxy, stored.Id, stored.GetOtherSettings().PluginConfig, RemovedPluginCredentialLines(before, after))
}

// PluginCredentialPreview names a credential line for key lists without its
// secrets: its label, or its account id.
func PluginCredentialPreview(line string) (string, bool) {
	credential, ok := jsplugin.ParseCredential(line)
	if !ok {
		return "", false
	}
	if credential.Label != "" {
		return credential.Label, true
	}
	return credential.AccountID, true
}

// CheckPluginKeys runs the plugin's checkKey on every static key line of key
// that storedKey does not hold: the lines an administrator typed in, not the
// credentials a login stored. The plugin's message, in lang, rejects the
// save, with the line number when the key has several lines.
func CheckPluginKeys(ctx context.Context, plugin *jsplugin.LoadedPlugin, baseURL string, config json.RawMessage, key, storedKey, lang string) error {
	if plugin == nil || !plugin.HasProviderHook("checkKey") {
		return nil
	}
	stored := make(map[string]bool)
	for line := range strings.SplitSeq(storedKey, "\n") {
		stored[strings.TrimSpace(line)] = true
	}
	lines := strings.Split(strings.Trim(key, "\n"), "\n")
	for index, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || stored[line] {
			continue
		}
		if _, isCredential := jsplugin.ParseCredential(line); isCredential {
			continue
		}
		hookCtx, cancel := context.WithTimeout(ctx, pluginCredentialHookTimeout)
		message, err := plugin.CallCheckKey(hookCtx, baseURL, config, line)
		cancel()
		text := message.Text(lang)
		if err != nil {
			var hookErr *jsplugin.HookError
			text = "checkKey failed"
			if errors.As(err, &hookErr) {
				text = truncateText(hookErr.Message, jsplugin.MaxCheckKeyMessageRunes)
			}
		} else if message == nil {
			continue
		}
		if len(lines) == 1 {
			return common.NewMessage("The plugin rejected the key: {{error}}", map[string]any{"error": text})
		}
		return common.NewMessage("The plugin rejected key line {{line}}: {{error}}", map[string]any{"line": index + 1, "error": text})
	}
	return nil
}

func truncateText(text string, limit int) string {
	if runes := []rune(text); len(runes) > limit {
		return string(runes[:limit])
	}
	return text
}
