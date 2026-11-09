package service

import (
	"cmp"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/setting/system_setting"
)

const (
	PluginLoginFlowTTL = 15 * time.Minute
	// pluginLoginClaimTTL bounds how long a submit holds its step; a submit
	// that never finished frees the step for a retry after it.
	pluginLoginClaimTTL          = pluginCredentialHookTimeout + 30*time.Second
	pluginLoginDefaultInterval   = 5
	maxPluginLoginCallbackParams = 64
	maxPluginLoginInputBytes     = 64 << 10
)

// PluginLoginIdentity is the administrator session a login flow is bound to.
type PluginLoginIdentity struct {
	UserID    int
	SessionID string
}

// PluginLoginStepView is the step the browser shows. It never holds the
// code verifier, the nonce, the plugin session or any credential data.
type PluginLoginStepView struct {
	Type                    string                 `json:"type"`
	URL                     string                 `json:"url,omitempty"`
	Hint                    jsplugin.LocalizedText `json:"hint,omitempty"`
	UserCode                string                 `json:"user_code,omitempty"`
	VerificationURI         string                 `json:"verification_uri,omitempty"`
	VerificationURIComplete string                 `json:"verification_uri_complete,omitempty"`
	Interval                int                    `json:"interval,omitempty"`
	ExpiresAt               int64                  `json:"expires_at,omitempty"`
	Fields                  []jsplugin.LoginField  `json:"fields,omitempty"`
	Credential              *PluginCredentialView  `json:"credential,omitempty"`
}

// PluginCredentialView is the non-secret summary of one credential line.
type PluginCredentialView struct {
	Index      int    `json:"index"`
	Label      string `json:"label"`
	AccountID  string `json:"account_id"`
	ExpiresAt  int64  `json:"expires_at"`
	NeedsLogin bool   `json:"needs_login"`
}

// PluginLoginInput is what the browser submits to continue a flow.
type PluginLoginInput struct {
	CallbackURL string            `json:"callback_url,omitempty"`
	Fields      map[string]string `json:"fields,omitempty"`
	Poll        bool              `json:"poll,omitempty"`
}

// PluginLoginResult is the outcome of one login call.
type PluginLoginResult struct {
	Flow        string
	ChannelID   int
	ChannelName string
	Plugin      string
	Step        PluginLoginStepView
}

// pluginLoginPayload is the server-side state of a flow. Seq changes with
// every write, so the compare-and-swap on the whole payload never confuses
// two states.
type pluginLoginPayload struct {
	Seq             int64               `json:"seq"`
	ChannelID       int                 `json:"channel_id"`
	KeyIndex        *int                `json:"key_index"`
	Add             bool                `json:"add,omitempty"`
	CodeVerifier    string              `json:"code_verifier"`
	Nonce           string              `json:"nonce"`
	Session         json.RawMessage     `json:"session,omitempty"`
	Step            string              `json:"step"`
	Issuer          string              `json:"issuer,omitempty"`
	Fields          []string            `json:"fields,omitempty"`
	Interval        int                 `json:"interval,omitempty"`
	NextPollAt      int64               `json:"next_poll_at,omitempty"`
	DeviceExpiresAt int64               `json:"device_expires_at,omitempty"`
	ClaimedUntil    int64               `json:"claimed_until,omitempty"`
	View            PluginLoginStepView `json:"view"`
}

var vendorErrorCodePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-]{1,64}$`)

// PluginLoginRedirectURI is the callback address of a plugin's logins. Each
// plugin has its own, so a callback cannot reach another plugin's flow.
func PluginLoginRedirectURI(pluginKey string) string {
	return strings.TrimRight(system_setting.ServerAddress, "/") + "/oauth/plugin/" + pluginKey + "/callback"
}

// loginPluginOfChannel returns the plugin of a task plugin channel when it
// exports login.
func loginPluginOfChannel(channel *model.Channel) (*jsplugin.LoadedPlugin, error) {
	plugin, ok := PluginOfChannel(channel)
	if !ok || !plugin.HasProviderHook("login") {
		return nil, common.NewMessage("This channel's plugin does not support login")
	}
	return plugin, nil
}

// ChannelSupportsPluginLogin reports a task plugin channel whose plugin
// exports login, which may be created without a key.
func ChannelSupportsPluginLogin(channel *model.Channel) bool {
	_, err := loginPluginOfChannel(channel)
	return err == nil
}

func randomURLToken() (string, error) {
	random := make([]byte, 32)
	if _, err := rand.Read(random); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(random), nil
}

// StartPluginLogin opens a login flow on a channel: keyIndex nil adds a
// credential, an index logs in again on that key line. add keeps the account
// of a single-key channel next to the new one; see StorePluginLoginCredential.
func StartPluginLogin(ctx context.Context, identity PluginLoginIdentity, channelID int, keyIndex *int, add bool) (PluginLoginResult, error) {
	if add && keyIndex != nil {
		return PluginLoginResult{}, common.NewMessage("Adding an account cannot target an existing credential")
	}
	channel, err := model.GetChannelById(channelID, true)
	if err != nil {
		return PluginLoginResult{}, common.NewMessage("Channel does not exist")
	}
	plugin, err := loginPluginOfChannel(channel)
	if err != nil {
		return PluginLoginResult{}, err
	}
	var credential json.RawMessage
	if keyIndex != nil {
		lines := pluginCredentialKeyLines(channel)
		if *keyIndex < 0 || *keyIndex >= len(lines) {
			return PluginLoginResult{}, common.NewMessage("Credential index out of range")
		}
		if stored, ok := jsplugin.ParseCredential(lines[*keyIndex]); ok && stored.Plugin == plugin.Meta.Key {
			credential = stored.Data
		}
	}
	verifier, err := randomURLToken()
	if err != nil {
		return PluginLoginResult{}, err
	}
	nonce, err := randomURLToken()
	if err != nil {
		return PluginLoginResult{}, err
	}
	now := time.Now()
	payload := pluginLoginPayload{
		ChannelID:    channelID,
		KeyIndex:     keyIndex,
		Add:          add,
		CodeVerifier: verifier,
		Nonce:        nonce,
		// The first call holds the flow until it returns its first step.
		ClaimedUntil: now.Add(pluginLoginClaimTTL).Unix(),
	}
	encoded, err := common.Marshal(payload)
	if err != nil {
		return PluginLoginResult{}, err
	}
	token, _, err := model.CreateAuthFlow(model.AuthFlowCreate{
		Purpose:   model.AuthFlowPurposePluginLogin,
		Provider:  plugin.Meta.Key,
		UserId:    identity.UserID,
		SessionId: identity.SessionID,
		Payload:   string(encoded),
		ExpiresAt: now.Add(PluginLoginFlowTTL),
	})
	if err != nil {
		return PluginLoginResult{}, err
	}
	flow := pluginLoginFlow{token: token, plugin: plugin, channel: channel, identity: identity, payload: payload, stored: string(encoded), credential: credential}
	step, err := flow.call(ctx, nil)
	if err != nil {
		return PluginLoginResult{}, err
	}
	return flow.result(step), nil
}

// ContinuePluginLogin submits the browser's input to the current step.
func ContinuePluginLogin(ctx context.Context, identity PluginLoginIdentity, channelID int, token string, input PluginLoginInput) (PluginLoginResult, error) {
	flow, err := loadPluginLoginFlow(identity, token, "")
	if err != nil {
		return PluginLoginResult{}, err
	}
	if flow.payload.ChannelID != channelID {
		return PluginLoginResult{}, common.NewMessage("Login flow is invalid or has expired")
	}
	var pluginInput any
	switch {
	case input.Poll && input.CallbackURL == "" && input.Fields == nil:
		if flow.payload.Step != jsplugin.LoginStepDevice && flow.payload.Step != jsplugin.LoginStepPending {
			return PluginLoginResult{}, common.NewMessage("This login step does not accept this input")
		}
		now := time.Now().Unix()
		if flow.payload.DeviceExpiresAt > 0 && now >= flow.payload.DeviceExpiresAt {
			return PluginLoginResult{}, common.NewMessage("The device code has expired")
		}
		if now < flow.payload.NextPollAt || flow.claimed() {
			// Too early, or a poll is running: the plugin is called at most
			// once per interval.
			return flow.result(PluginLoginStepView{Type: jsplugin.LoginStepPending, Interval: flow.payload.Interval}), nil
		}
		pluginInput = map[string]any{"poll": true}
	case input.CallbackURL != "" && !input.Poll && input.Fields == nil:
		if flow.payload.Step != jsplugin.LoginStepPaste {
			return PluginLoginResult{}, common.NewMessage("This login step does not accept this input")
		}
		params, parseErr := pastedCallbackParams(input.CallbackURL)
		if parseErr != nil {
			return PluginLoginResult{}, parseErr
		}
		if pluginInput, err = flow.callbackInput(params); err != nil {
			return PluginLoginResult{}, err
		}
	case input.Fields != nil && !input.Poll && input.CallbackURL == "":
		if flow.payload.Step != jsplugin.LoginStepFields {
			return PluginLoginResult{}, common.NewMessage("This login step does not accept this input")
		}
		if pluginInput, err = flow.fieldsInput(input.Fields); err != nil {
			return PluginLoginResult{}, err
		}
	default:
		return PluginLoginResult{}, common.NewMessage("This login step does not accept this input")
	}
	step, err := flow.claimAndCall(ctx, pluginInput)
	if err != nil {
		return PluginLoginResult{}, err
	}
	return flow.result(step), nil
}

// CompletePluginLoginCallback handles the redirect back from the vendor,
// which the callback page of the plugin posts.
func CompletePluginLoginCallback(ctx context.Context, identity PluginLoginIdentity, pluginKey string, params map[string]string) (PluginLoginResult, error) {
	if len(params) > maxPluginLoginCallbackParams {
		return PluginLoginResult{}, common.NewMessage("Login flow is invalid or has expired")
	}
	state := params["state"]
	if state == "" || pluginKey == "" {
		return PluginLoginResult{}, common.NewMessage("Login flow is invalid or has expired")
	}
	// The provider match ties the callback to the plugin whose address the
	// vendor redirected to, against mix-up attacks.
	flow, err := loadPluginLoginFlow(identity, state, pluginKey)
	if err != nil {
		return PluginLoginResult{}, err
	}
	if flow.payload.Step != jsplugin.LoginStepRedirect && flow.payload.Step != jsplugin.LoginStepPaste {
		return PluginLoginResult{}, common.NewMessage("This login step does not accept this input")
	}
	pluginInput, err := flow.callbackInput(params)
	if err != nil {
		return PluginLoginResult{}, err
	}
	step, err := flow.claimAndCall(ctx, pluginInput)
	if err != nil {
		return PluginLoginResult{}, err
	}
	return flow.result(step), nil
}

// PluginCredentialViews lists the credential lines of a channel without
// their secrets; a static key line has no label or account.
func PluginCredentialViews(channel *model.Channel) []PluginCredentialView {
	lines := pluginCredentialKeyLines(channel)
	views := make([]PluginCredentialView, 0, len(lines))
	for index, line := range lines {
		credential, ok := jsplugin.ParseCredential(line)
		if !ok {
			if strings.TrimSpace(line) != "" {
				views = append(views, PluginCredentialView{Index: index})
			}
			continue
		}
		views = append(views, PluginCredentialView{
			Index:      index,
			Label:      credential.Label,
			AccountID:  credential.AccountID,
			ExpiresAt:  credential.ExpiresAt,
			NeedsLogin: credential.NeedsLogin,
		})
	}
	return views
}

type pluginLoginFlow struct {
	token      string
	plugin     *jsplugin.LoadedPlugin
	channel    *model.Channel
	identity   PluginLoginIdentity
	payload    pluginLoginPayload
	stored     string
	credential json.RawMessage
}

func (f *pluginLoginFlow) match() model.AuthFlowMatch {
	return model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposePluginLogin,
		Provider:  f.plugin.Meta.Key,
		UserId:    f.identity.UserID,
		SessionId: f.identity.SessionID,
	}
}

func (f *pluginLoginFlow) result(step PluginLoginStepView) PluginLoginResult {
	return PluginLoginResult{Flow: f.token, ChannelID: f.payload.ChannelID, ChannelName: f.channel.Name, Plugin: f.plugin.Meta.Key, Step: step}
}

// loadPluginLoginFlow reads an unconsumed, unexpired flow of the same
// administrator and session; pluginKey, when set, must be its plugin.
func loadPluginLoginFlow(identity PluginLoginIdentity, token, pluginKey string) (*pluginLoginFlow, error) {
	invalid := common.NewMessage("Login flow is invalid or has expired")
	if token == "" || identity.UserID <= 0 || identity.SessionID == "" {
		return nil, invalid
	}
	stored, err := model.GetAuthFlow(token, model.AuthFlowMatch{
		Purpose:   model.AuthFlowPurposePluginLogin,
		Provider:  pluginKey,
		UserId:    identity.UserID,
		SessionId: identity.SessionID,
	})
	if err != nil {
		return nil, invalid
	}
	var payload pluginLoginPayload
	if err = common.UnmarshalJsonStr(stored.Payload, &payload); err != nil {
		return nil, invalid
	}
	channel, err := model.GetChannelById(payload.ChannelID, true)
	if err != nil {
		return nil, invalid
	}
	plugin, err := loginPluginOfChannel(channel)
	if err != nil {
		return nil, err
	}
	if plugin.Meta.Key != stored.Provider {
		return nil, invalid
	}
	flow := &pluginLoginFlow{token: token, plugin: plugin, channel: channel, identity: identity, payload: payload, stored: stored.Payload}
	if payload.KeyIndex != nil {
		lines := pluginCredentialKeyLines(channel)
		if *payload.KeyIndex < len(lines) {
			if credential, ok := jsplugin.ParseCredential(lines[*payload.KeyIndex]); ok && credential.Plugin == plugin.Meta.Key {
				flow.credential = credential.Data
			}
		}
	}
	return flow, nil
}

// pastedCallbackParams reads the query of the address an administrator
// pasted after the vendor redirected the browser.
func pastedCallbackParams(callbackURL string) (map[string]string, error) {
	invalid := common.NewMessage("The pasted address is not a valid callback address")
	if len(callbackURL) > maxPluginLoginInputBytes {
		return nil, invalid
	}
	parsed, err := url.Parse(strings.TrimSpace(callbackURL))
	if err != nil || parsed.RawQuery == "" {
		return nil, invalid
	}
	query := parsed.Query()
	if len(query) > maxPluginLoginCallbackParams {
		return nil, invalid
	}
	params := make(map[string]string, len(query))
	for name, values := range query {
		if len(values) > 0 {
			params[name] = values[0]
		}
	}
	return params, nil
}

// callbackInput checks callback parameters against the flow and returns the
// plugin input for them.
func (f *pluginLoginFlow) callbackInput(params map[string]string) (any, error) {
	// A vendor that returns no state relies on PKCE.
	if state, ok := params["state"]; ok && state != f.token {
		f.logFailure("state_mismatch")
		return nil, common.NewMessage("The callback does not belong to this login")
	}
	// The issuer is checked on error responses too (RFC 9207).
	if f.payload.Issuer != "" && params["iss"] != f.payload.Issuer {
		f.logFailure("issuer_mismatch")
		return nil, common.NewMessage("The callback issuer does not match")
	}
	if code, failed := params["error"]; failed {
		// The vendor refused; only its error code is shown and the plugin is
		// not called.
		if !vendorErrorCodePattern.MatchString(code) {
			code = "unknown_error"
		}
		f.logFailure("vendor_error")
		return nil, common.NewMessage("The login was refused: {{error}}", map[string]any{"error": code})
	}
	size := 0
	callback := make(map[string]any, len(params))
	for name, value := range params {
		size += len(name) + len(value)
		callback[name] = value
	}
	if size > maxPluginLoginInputBytes {
		return nil, common.NewMessage("The pasted address is not a valid callback address")
	}
	return map[string]any{"callback": callback}, nil
}

// fieldsInput checks submitted fields against the fields step.
func (f *pluginLoginFlow) fieldsInput(fields map[string]string) (any, error) {
	size := 0
	values := make(map[string]any, len(fields))
	for name, value := range fields {
		if !slices.Contains(f.payload.Fields, name) {
			return nil, common.NewMessage("Login field {{field}} is invalid", map[string]any{"field": name})
		}
		size += len(name) + len(value)
		values[name] = value
	}
	if size > maxPluginLoginInputBytes {
		return nil, common.NewMessage("This login step does not accept this input")
	}
	for _, field := range f.payload.View.Fields {
		if field.Required && strings.TrimSpace(fields[field.Name]) == "" {
			return nil, common.NewMessage("Login field {{field}} is required", map[string]any{"field": field.Name})
		}
	}
	return map[string]any{"fields": values}, nil
}

// claimAndCall takes the current step for this submit, so a repeated or
// concurrent submit of it cannot call the plugin again, and calls login.
func (f *pluginLoginFlow) claimAndCall(ctx context.Context, input any) (PluginLoginStepView, error) {
	if f.claimed() {
		return PluginLoginStepView{}, common.NewMessage("Login step is already in progress")
	}
	claimed := f.payload
	claimed.Seq++
	claimed.ClaimedUntil = time.Now().Add(pluginLoginClaimTTL).Unix()
	encoded, err := common.Marshal(claimed)
	if err != nil {
		return PluginLoginStepView{}, err
	}
	swapped, err := model.UpdateAuthFlowPayload(f.token, f.match(), f.stored, string(encoded))
	if err != nil {
		return PluginLoginStepView{}, err
	}
	if !swapped {
		return PluginLoginStepView{}, common.NewMessage("Login step is already in progress")
	}
	f.payload, f.stored = claimed, string(encoded)
	return f.call(ctx, input)
}

// claimed reports a submit that is still running on the current step.
func (f *pluginLoginFlow) claimed() bool {
	return f.payload.ClaimedUntil > time.Now().Unix()
}

// call runs login while the flow is claimed and stores its result.
func (f *pluginLoginFlow) call(ctx context.Context, input any) (PluginLoginStepView, error) {
	codeChallenge := sha256.Sum256([]byte(f.payload.CodeVerifier))
	hookCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), pluginCredentialHookTimeout)
	defer cancel()
	hookCtx = PluginCredentialHookContext(hookCtx, f.plugin, f.channel.GetBaseURL(), f.channel.GetSetting().Proxy)
	step, err := f.plugin.CallLogin(hookCtx, f.channel.GetBaseURL(), jsplugin.LoginContext{
		State:         f.token,
		Nonce:         f.payload.Nonce,
		CodeVerifier:  f.payload.CodeVerifier,
		CodeChallenge: base64.RawURLEncoding.EncodeToString(codeChallenge[:]),
		RedirectURI:   PluginLoginRedirectURI(f.plugin.Meta.Key),
		Session:       f.payload.Session,
		Config:        f.plugin.ChannelConfigFor(f.channel.GetOtherSettings().PluginConfig),
	}, f.credential, input)
	if err != nil {
		f.logFailure(pluginErrorCategory(err))
		// A throw fails this attempt only; the step can be submitted again.
		f.release(f.payload)
		var hookErr *jsplugin.HookError
		if errors.As(err, &hookErr) && hookErr.Message != "" {
			return PluginLoginStepView{}, common.NewMessage("Plugin login failed: {{error}}", map[string]any{"error": hookErr.Message})
		}
		return PluginLoginStepView{}, common.NewMessage("Plugin login failed: {{error}}", map[string]any{"error": "the plugin returned an invalid step"})
	}
	if step.Type == jsplugin.LoginStepDone {
		return f.finish(step)
	}
	next := f.payload
	next.Step = step.Type
	if step.Session != nil {
		next.Session = step.Session
		if string(step.Session) == "null" {
			next.Session = nil
		}
	}
	view := PluginLoginStepView{Type: step.Type}
	now := time.Now()
	switch step.Type {
	case jsplugin.LoginStepRedirect, jsplugin.LoginStepPaste:
		next.Issuer = step.Issuer
		view.URL, view.Hint = step.URL, step.Hint
	case jsplugin.LoginStepDevice:
		next.Interval = cmp.Or(step.Interval, pluginLoginDefaultInterval)
		next.NextPollAt = now.Add(time.Duration(next.Interval) * time.Second).Unix()
		next.DeviceExpiresAt = now.Add(PluginLoginFlowTTL).Unix()
		if step.ExpiresIn > 0 {
			next.DeviceExpiresAt = min(next.DeviceExpiresAt, now.Add(time.Duration(step.ExpiresIn)*time.Second).Unix())
		}
		view.UserCode, view.VerificationURI, view.VerificationURIComplete = step.UserCode, step.VerificationURI, step.VerificationURIComplete
		view.Interval, view.ExpiresAt = next.Interval, next.DeviceExpiresAt
	case jsplugin.LoginStepPending:
		next.Interval = cmp.Or(step.Interval, f.payload.Interval, pluginLoginDefaultInterval)
		next.NextPollAt = now.Add(time.Duration(next.Interval) * time.Second).Unix()
		view.Interval = next.Interval
	case jsplugin.LoginStepFields:
		next.Fields = next.Fields[:0]
		for _, field := range step.Fields {
			next.Fields = append(next.Fields, field.Name)
		}
		view.Fields = step.Fields
	}
	next.View = view
	if !f.release(next) {
		return PluginLoginStepView{}, common.NewMessage("Login flow is invalid or has expired")
	}
	return view, nil
}

// release stores the next state of the flow and frees it for the next
// submit.
func (f *pluginLoginFlow) release(next pluginLoginPayload) bool {
	next.Seq = f.payload.Seq + 1
	next.ClaimedUntil = 0
	encoded, err := common.Marshal(next)
	if err != nil {
		return false
	}
	swapped, err := model.UpdateAuthFlowPayload(f.token, f.match(), f.stored, string(encoded))
	if err != nil || !swapped {
		return false
	}
	f.payload, f.stored = next, string(encoded)
	return true
}

// finish consumes the flow and stores the credential login returned. A
// credential the channel cannot keep is revoked, so the vendor's grant is not
// left behind, unless its account is logged in on a credential of the plugin
// already: a vendor whose revoke ends every session of the account would log
// that login out too.
func (f *pluginLoginFlow) finish(step jsplugin.LoginStep) (PluginLoginStepView, error) {
	revoke := func() {
		if step.Result.AccountID != "" && pluginAccountLoggedIn(f.plugin.Meta.Key, step.Result.AccountID) {
			return
		}
		revokePluginCredentialData(f.plugin.Meta.Key, f.channel.GetBaseURL(), f.channel.GetSetting().Proxy, f.payload.ChannelID, f.channel.GetOtherSettings().PluginConfig, []json.RawMessage{step.Result.Credential})
	}
	if _, err := model.ConsumeAuthFlow(f.token, f.match()); err != nil {
		revoke()
		return PluginLoginStepView{}, common.NewMessage("Login flow is invalid or has expired")
	}
	view, err := StorePluginLoginCredential(f.payload.ChannelID, f.plugin.Meta.Key, f.payload.KeyIndex, f.payload.Add, *step.Result)
	if err != nil {
		f.logFailure("store_failed")
		revoke()
		return PluginLoginStepView{}, err
	}
	return PluginLoginStepView{Type: jsplugin.LoginStepDone, Credential: &view}, nil
}

func (f *pluginLoginFlow) logFailure(category string) {
	common.SysLog(common.LogText("plugin login failed: plugin=%s channel_id=%d step=%s category=%s", f.plugin.Meta.Key, f.payload.ChannelID, f.payload.Step, category))
}

// pluginAccountLoggedIn reports whether a credential of the plugin on any
// channel holds accountID. A failed read counts as logged in, so a doubt
// never revokes a grant.
func pluginAccountLoggedIn(pluginKey, accountID string) bool {
	var channels []*model.Channel
	if err := model.DB.Where("type = ?", constant.ChannelTypeTaskPlugin).Find(&channels).Error; err != nil {
		return true
	}
	for _, channel := range channels {
		for _, line := range pluginCredentialKeyLines(channel) {
			if stored, ok := jsplugin.ParseCredential(line); ok && stored.Plugin == pluginKey && stored.AccountID == accountID {
				return true
			}
		}
	}
	return false
}

// StorePluginLoginCredential writes the credential of a finished login: it
// replaces the line at keyIndex, or adds one (a new line in multi-key mode,
// otherwise the key), and re-enables what the host disabled for want of a
// login. add on a single-key channel holding one line keeps that line as the
// first key and turns the channel multi-key: a plugin credential is always
// one line, so no key is split or dropped.
func StorePluginLoginCredential(channelID int, pluginKey string, keyIndex *int, add bool, result jsplugin.CredentialResult) (PluginCredentialView, error) {
	var view PluginCredentialView
	err := model.UpdateTaskPluginChannelLocked(channelID, func(channel *model.Channel, others []*model.Channel) error {
		if channel.GetSetting().TaskPluginKey != pluginKey {
			return common.NewMessage("This channel's plugin does not support login")
		}
		if strings.HasPrefix(strings.TrimSpace(channel.Key), "[") {
			return common.NewMessage("This channel's key format cannot hold plugin credentials")
		}
		lines := pluginCredentialKeyLines(channel)
		index := len(lines)
		toMultiKey := false
		switch {
		case keyIndex != nil:
			if *keyIndex < 0 || *keyIndex >= len(lines) {
				return common.NewMessage("Credential index out of range")
			}
			index = *keyIndex
			if stored, ok := jsplugin.ParseCredential(lines[index]); ok && stored.Plugin == pluginKey &&
				stored.AccountID != "" && result.AccountID != "" && stored.AccountID != result.AccountID {
				return common.NewMessage("Logged in to a different account than the credential being replaced")
			}
		case channel.ChannelInfo.IsMultiKey:
			// The credential becomes a new line.
		case add && len(lines) == 1:
			// Multi-key mode splits the key by line, so a key of several
			// lines would fall apart.
			lines[0] = strings.TrimSpace(lines[0])
			if strings.Contains(lines[0], "\n") {
				return common.NewMessage("This channel's key cannot hold another account")
			}
			toMultiKey = true
		default:
			index = 0
		}
		if result.AccountID != "" {
			for _, candidate := range append([]*model.Channel{channel}, others...) {
				if candidate.GetSetting().TaskPluginKey != pluginKey {
					continue
				}
				for lineIndex, line := range pluginCredentialKeyLines(candidate) {
					if candidate.Id == channel.Id && lineIndex == index {
						continue
					}
					if stored, ok := jsplugin.ParseCredential(line); ok && stored.Plugin == pluginKey && stored.AccountID == result.AccountID {
						return common.NewMessage("This account is already logged in on another credential of this plugin")
					}
				}
			}
		}
		credential := jsplugin.Credential{
			Plugin:    pluginKey,
			Data:      result.Credential,
			Headers:   result.Headers,
			Query:     result.Query,
			ExpiresAt: result.ExpiresAt,
			AccountID: result.AccountID,
			Label:     result.Label,
		}
		line, err := credential.Line()
		if err != nil {
			return err
		}
		if index == len(lines) {
			lines = append(lines, line)
		} else {
			lines[index] = line
		}
		if toMultiKey {
			info := &channel.ChannelInfo
			info.IsMultiKey = true
			info.MultiKeyMode = cmp.Or(info.MultiKeyMode, constant.MultiKeyModeRandom)
			info.MultiKeyStatusList = map[int]int{}
			info.MultiKeyDisabledReason = map[int]string{}
			info.MultiKeyDisabledTime = map[int]int64{}
			// A credential only a new login restores keeps its key disabled,
			// as a multi-key channel's relay would on its first use.
			if stored, ok := jsplugin.ParseCredential(lines[0]); ok && stored.NeedsLogin {
				info.MultiKeyStatusList[0] = common.ChannelStatusAutoDisabled
				info.MultiKeyDisabledReason[0] = model.ChannelStatusReasonPluginNeedsLogin
				info.MultiKeyDisabledTime[0] = common.GetTimestamp()
			}
		}
		channel.Key = strings.Join(lines, "\n")
		enablePluginLoginChannel(channel, index, len(lines))
		view = PluginCredentialView{Index: index, Label: credential.Label, AccountID: credential.AccountID, ExpiresAt: credential.ExpiresAt}
		return nil
	})
	return view, err
}

// enablePluginLoginChannel re-enables the key line at index, and the
// channel, when the host disabled them for a missing or expired login. A
// manual disable stays.
func enablePluginLoginChannel(channel *model.Channel, index, size int) {
	hostReasons := []string{model.ChannelStatusReasonPluginLoginRequired, model.ChannelStatusReasonPluginNeedsLogin}
	info := &channel.ChannelInfo
	if info.IsMultiKey {
		info.MultiKeySize = size
		if info.MultiKeyStatusList[index] == common.ChannelStatusAutoDisabled && slices.Contains(hostReasons, info.MultiKeyDisabledReason[index]) {
			delete(info.MultiKeyStatusList, index)
			delete(info.MultiKeyDisabledReason, index)
			delete(info.MultiKeyDisabledTime, index)
		}
		hostReasons = append(hostReasons, model.ChannelStatusReasonAllKeysDisabled)
		if _, disabled := info.MultiKeyStatusList[index]; disabled {
			return
		}
	}
	otherInfo := channel.GetOtherInfo()
	reason, _ := otherInfo["status_reason"].(string)
	if channel.Status != common.ChannelStatusAutoDisabled || !slices.Contains(hostReasons, reason) {
		return
	}
	channel.Status = common.ChannelStatusEnabled
	delete(otherInfo, "status_reason")
	otherInfo["status_time"] = common.GetTimestamp()
	channel.SetOtherInfo(otherInfo)
}

// PluginLoginNeededStatus marks a new task plugin channel that has no
// credential yet as disabled until a login stores one.
func PluginLoginNeededStatus(channel *model.Channel) {
	if channel.Type != constant.ChannelTypeTaskPlugin {
		return
	}
	channel.Status = common.ChannelStatusAutoDisabled
	otherInfo := channel.GetOtherInfo()
	otherInfo["status_reason"] = model.ChannelStatusReasonPluginLoginRequired
	otherInfo["status_time"] = common.GetTimestamp()
	channel.SetOtherInfo(otherInfo)
}
