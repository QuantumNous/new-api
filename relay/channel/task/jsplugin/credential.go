package jsplugin

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	pluginruntime "github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
)

// A key line of a task plugin channel may be a credential its plugin's login
// stored. Task requests then carry the credential's headers and query instead
// of meta.auth, and the plugin's signRequest signs every task request of the
// channel.

// parseTaskCredential returns the plugin credential a key line holds on a
// task plugin channel, nil for a static key. A credential on another channel
// type or of another plugin is an error, so it never reaches meta.auth as an
// API key.
func (a *TaskAdaptor) parseTaskCredential(channelType int, key string) (*pluginruntime.Credential, error) {
	credential, ok := pluginruntime.ParseCredential(key)
	if !ok {
		return nil, nil
	}
	if channelType != constant.ChannelTypeTaskPlugin {
		return nil, errors.New("a plugin credential is only valid on a task plugin channel")
	}
	if credential.Plugin != a.plugin.Meta.Key {
		return nil, fmt.Errorf("channel credential belongs to plugin %s", credential.Plugin)
	}
	return credential, nil
}

// useFreshSubmitCredential refreshes the submission's credential line when it
// is about to expire and keeps the credential for the submit request.
func (a *TaskAdaptor) useFreshSubmitCredential(c *gin.Context, info *relaycommon.RelayInfo) error {
	credential, err := a.parseTaskCredential(info.ChannelType, info.ApiKey)
	if err != nil || credential == nil {
		return err
	}
	if credential.NeedsLogin {
		// Only a login restores the key, even after an administrator enabled
		// it again: disable it for the reason a login clears.
		service.DisablePluginCredentialForLogin(info.ChannelId, common.GetContextKeyString(c, constant.ContextKeyChannelName), info.ChannelIsMultiKey, common.GetContextKeyBool(c, constant.ContextKeyChannelAutoBan), info.ApiKey)
		return service.ErrPluginCredentialNeedsLogin
	}
	index := 0
	if info.ChannelIsMultiKey {
		index = info.ChannelMultiKeyIndex
	}
	line, err := service.FreshPluginCredentialLine(c.Request.Context(), a.plugin, info.ChannelId, index, info.ApiKey)
	if err != nil {
		return err
	}
	if line != info.ApiKey {
		info.ApiKey = line
		common.SetContextKey(c, constant.ContextKeyChannelKey, line)
	}
	a.credential, err = a.parseTaskCredential(info.ChannelType, line)
	return err
}

// taskCredentialLine picks, from a task plugin channel's whole key, the line
// polling and content requests of task use: the credential of the account
// that submitted it, or the plugin's first credential for a task without an
// account. A task whose account left the channel gets no other account's
// credential, whose answer could report the task missing. A key without
// credentials is returned as it is.
func (a *TaskAdaptor) taskCredentialLine(ctx context.Context, key string, task *model.Task) (string, error) {
	if a.channelType() != constant.ChannelTypeTaskPlugin || !strings.Contains(key, pluginruntime.CredentialType) {
		return key, nil
	}
	account := ""
	if task != nil {
		account = task.PrivateData.CredentialAccount
	}
	lines := strings.Split(strings.Trim(key, "\n"), "\n")
	for index, line := range lines {
		credential, ok := pluginruntime.ParseCredential(line)
		if ok && credential.Plugin == a.plugin.Meta.Key && (account == "" || credential.AccountID == account) {
			return service.FreshPluginCredentialLine(ctx, a.plugin, a.info.ChannelId, index, line)
		}
	}
	if account != "" {
		return "", errors.New("channel key no longer holds the credential of the account that submitted the task")
	}
	return "", fmt.Errorf("channel key holds no credential of plugin %s", a.plugin.Meta.Key)
}

// applyTaskCredential puts a credential's headers and query on a task request.
func applyTaskCredential(credential *pluginruntime.Credential, target *url.URL, header http.Header) {
	if credential == nil {
		return
	}
	for name, value := range credential.Headers {
		header.Set(name, value)
	}
	if len(credential.Query) > 0 {
		query := target.Query()
		for name, value := range credential.Query {
			query.Set(name, value)
		}
		target.RawQuery = query.Encode()
	}
}

// overrideKey is the value {api_key} stands for in header overrides: a
// credential line is no API key.
func overrideKey(key string, credential *pluginruntime.Credential) string {
	if credential != nil {
		return ""
	}
	return key
}

// signTaskRequest runs the plugin's signRequest on a task request of a task
// plugin channel, after its header overrides.
func (a *TaskAdaptor) signTaskRequest(ctx context.Context, channelType int, baseURL, key string, credential *pluginruntime.Credential, method string, target *url.URL, header http.Header, bodySHA256 string) error {
	if channelType != constant.ChannelTypeTaskPlugin || !a.plugin.HasProviderHook("signRequest") {
		return nil
	}
	config := json.RawMessage(nil)
	if a.info != nil && a.info.HasChannelMeta() && a.info.ChannelId != 0 {
		if channel, err := model.CacheGetChannel(a.info.ChannelId); err == nil {
			config = a.plugin.ChannelConfigFor(channel.GetOtherSettings().PluginConfig)
		}
	}
	hookCtx := pluginruntime.CredentialContext{BaseURL: baseURL, APIKey: key, Config: config}
	if credential != nil {
		hookCtx = pluginruntime.CredentialContext{BaseURL: baseURL, Credential: credential.Data, Config: config}
	}
	headers := make(map[string]string, len(header))
	for name := range header {
		headers[name] = header.Get(name)
	}
	signed, err := a.plugin.CallSignRequest(ctx, hookCtx, method, target.String(), headers, bodySHA256)
	if err != nil {
		return err
	}
	for name, value := range signed.Headers {
		header.Set(name, value)
	}
	if len(signed.Query) > 0 {
		query := target.Query()
		for name, value := range signed.Query {
			query.Set(name, value)
		}
		target.RawQuery = query.Encode()
	}
	return nil
}

// SignUpstreamRequest signs the submit request.
func (a *TaskAdaptor) SignUpstreamRequest(c *gin.Context, info *relaycommon.RelayInfo, method string, target *url.URL, header http.Header) error {
	return a.signTaskRequest(c.Request.Context(), info.ChannelType, info.ChannelBaseUrl, info.ApiKey, a.credential, method, target, header, a.bodySHA256)
}

func bodySHA256(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

// credentialAuthorization is a credential's Authorization header value.
func credentialAuthorization(credential *pluginruntime.Credential) string {
	for name, value := range credential.Headers {
		if strings.EqualFold(name, "Authorization") {
			return value
		}
	}
	return ""
}
