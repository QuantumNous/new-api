package jsplugin

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math"
	"net/url"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

// CredentialType marks a channel key line that holds a plugin credential.
const CredentialType = "plugin_credential"

const (
	// MaxLoginSessionBytes bounds the session a login step hands to the next
	// call. The host keeps it in the login flow; it never reaches the browser.
	MaxLoginSessionBytes = 16 << 10
	// MaxCredentialBytes bounds one stored credential line.
	MaxCredentialBytes = 64 << 10
	// MaxRejectedBodyBytes is how much of an upstream error body
	// credentialRejected reads.
	MaxRejectedBodyBytes = 64 << 10
	maxLoginFields       = 32
	maxLoginURLBytes     = 8 << 10
	maxLoginTextRunes    = 512
	maxStreamEvents      = 1024
	// maxWebSocketMessages bounds the messages one result sends upstream.
	maxWebSocketMessages = 1024
	// maxNextDelay bounds the wait a chained request asks for.
	maxNextDelay = 10 * time.Second
	// maxToolNames and maxToolCount bound the tool counts of one result; the
	// host caps the sum of a request as the built-in tool usage does.
	maxToolNames = 64
	maxToolCount = 10_000
	// maxBalanceWindows bounds the windows of a parseBalance result.
	maxBalanceWindows = 32
	// MaxCheckKeyMessageRunes bounds the message checkKey shows the
	// administrator saving a channel.
	MaxCheckKeyMessageRunes = 512
	maxScheduledNotifyBytes = 1 << 10
	// maxUpstreamErrorMessageRunes and maxUpstreamErrorCodeRunes cut the
	// message, and the type and code, of an error a converter hook returns.
	maxUpstreamErrorMessageRunes = 4096
	maxUpstreamErrorCodeRunes    = 256
)

// Credential is one plugin credential, stored as a compact JSON line of a
// channel key. Data is opaque to the host and reaches only the plugin's own
// credential hooks; Headers and Query go upstream with every request.
type Credential struct {
	Type       string            `json:"type"`
	Plugin     string            `json:"plugin"`
	Data       json.RawMessage   `json:"data"`
	Headers    map[string]string `json:"headers"`
	Query      map[string]string `json:"query"`
	ExpiresAt  int64             `json:"expires_at"`
	AccountID  string            `json:"account_id"`
	Label      string            `json:"label"`
	NeedsLogin bool              `json:"needs_login"`
}

// ParseCredential reads one channel key line as a plugin credential. Any
// other line is a static key.
func ParseCredential(line string) (*Credential, bool) {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "{") || !strings.Contains(trimmed, CredentialType) {
		return nil, false
	}
	var credential Credential
	if err := common.Unmarshal([]byte(trimmed), &credential); err != nil {
		return nil, false
	}
	if credential.Type != CredentialType || credential.Plugin == "" {
		return nil, false
	}
	return &credential, true
}

// Line encodes the credential as one compact JSON line.
func (c Credential) Line() (string, error) {
	c.Type = CredentialType
	if c.Headers == nil {
		c.Headers = map[string]string{}
	}
	if c.Query == nil {
		c.Query = map[string]string{}
	}
	if len(c.Data) == 0 {
		c.Data = json.RawMessage("null")
	}
	encoded, err := common.Marshal(c)
	if err != nil {
		return "", err
	}
	if len(encoded) > MaxCredentialBytes {
		return "", fmt.Errorf("plugin credential exceeds %d bytes", MaxCredentialBytes)
	}
	return string(encoded), nil
}

// ExpiresWithin reports whether the credential has an expiry and reaches it
// within margin of now.
func (c Credential) ExpiresWithin(now time.Time, margin time.Duration) bool {
	return c.ExpiresAt > 0 && time.Unix(c.ExpiresAt, 0).Before(now.Add(margin))
}

// CredentialSummary is the part of a credential an administrator may see.
type CredentialSummary struct {
	Type       string `json:"type"`
	Plugin     string `json:"plugin"`
	AccountID  string `json:"account_id"`
	Label      string `json:"label"`
	ExpiresAt  int64  `json:"expires_at"`
	NeedsLogin bool   `json:"needs_login"`
}

// Summary returns the credential without its data, headers and query.
func (c Credential) Summary() CredentialSummary {
	return CredentialSummary{
		Type:       CredentialType,
		Plugin:     c.Plugin,
		AccountID:  c.AccountID,
		Label:      c.Label,
		ExpiresAt:  c.ExpiresAt,
		NeedsLogin: c.NeedsLogin,
	}
}

// RedactCredentialLines replaces every credential line of a channel key with
// its summary, so the key can be shown to an administrator.
func RedactCredentialLines(key string) string {
	if !strings.Contains(key, CredentialType) {
		return key
	}
	lines := strings.Split(key, "\n")
	for index, line := range lines {
		credential, ok := ParseCredential(line)
		if !ok {
			continue
		}
		encoded, err := common.Marshal(credential.Summary())
		if err != nil {
			lines[index] = ""
			continue
		}
		lines[index] = string(encoded)
	}
	return strings.Join(lines, "\n")
}

// HasProviderHook reports whether the plugin exports a provider hook. It
// runs no JavaScript.
func (p *LoadedPlugin) HasProviderHook(name string) bool {
	return p != nil && p.Engine != nil && p.Engine.HasExport(name)
}

// CredentialResult is what a finished login and refresh return.
type CredentialResult struct {
	Credential json.RawMessage
	Headers    map[string]string
	Query      map[string]string
	ExpiresAt  int64
	AccountID  string
	Label      string
	// Relogin is refresh's answer that only a new login can restore access.
	Relogin bool
}

// LoginField is one input of a fields step.
type LoginField struct {
	Name        string        `json:"name"`
	Label       LocalizedText `json:"label"`
	Type        string        `json:"type"`
	Required    bool          `json:"required"`
	Placeholder LocalizedText `json:"placeholder,omitempty"`
	Description LocalizedText `json:"description,omitempty"`
}

// LoginStep is one result of login: the next step, or done with the
// credential.
type LoginStep struct {
	Type                    string
	URL                     string
	Issuer                  string
	Hint                    LocalizedText
	UserCode                string
	VerificationURI         string
	VerificationURIComplete string
	Interval                int
	ExpiresIn               int
	Fields                  []LoginField
	// Session is nil when the step returned none, which keeps the current
	// session; JSON null clears it.
	Session json.RawMessage
	Result  *CredentialResult
}

// Login step types.
const (
	LoginStepRedirect = "redirect"
	LoginStepPaste    = "paste"
	LoginStepDevice   = "device"
	LoginStepPending  = "pending"
	LoginStepFields   = "fields"
	LoginStepDone     = "done"
)

// LoginContext is ctx.login: the values the host generated for this login.
// Config is not part of it: it is ctx.config, the channel's plugin config.
type LoginContext struct {
	State         string
	Nonce         string
	CodeVerifier  string
	CodeChallenge string
	RedirectURI   string
	Session       json.RawMessage
	Config        json.RawMessage
}

// CredentialContext is the ctx of a hook that may read the channel's
// credential: Credential is the wrapper's data, or APIKey a static key line.
// Config is the channel's plugin config as ChannelConfigFor returns it, and
// Token the exchangeKey token of a static key line, nil without one.
type CredentialContext struct {
	BaseURL    string
	Credential json.RawMessage
	APIKey     string
	Config     json.RawMessage
	Token      json.RawMessage
}

func (c CredentialContext) value() map[string]any {
	ctx := map[string]any{"baseUrl": c.BaseURL, "credential": nil, "apiKey": c.APIKey, "config": configValue(c.Config)}
	if len(c.Credential) > 0 {
		ctx["credential"] = RawJSON(c.Credential)
	}
	if len(c.Token) > 0 {
		ctx["token"] = RawJSON(c.Token)
	}
	return ctx
}

// HookContext is the ctx of a relay hook: the channel base URL, the client
// path of the route, the channel's plugin config, the exchangeKey token of a
// static key line and, for the hooks that read a response, the state the
// plugin carries through a chain or a stream.
type HookContext struct {
	BaseURL string
	Path    string
	Config  json.RawMessage
	Token   json.RawMessage
	State   json.RawMessage
}

func (c HookContext) value() map[string]any {
	ctx := map[string]any{"baseUrl": c.BaseURL, "config": configValue(c.Config)}
	if c.Path != "" {
		ctx["path"] = c.Path
	}
	if len(c.Token) > 0 {
		ctx["token"] = RawJSON(c.Token)
	}
	return ctx
}

// stateValue is value with ctx.state, null when the plugin has set none.
func (c HookContext) stateValue() map[string]any {
	ctx := c.value()
	ctx["state"] = rawOrNull(c.State)
	return ctx
}

func configValue(config json.RawMessage) any {
	if len(config) == 0 {
		return map[string]any{}
	}
	return RawJSON(config)
}

func rawOrNull(raw json.RawMessage) any {
	if len(raw) == 0 {
		return nil
	}
	return RawJSON(raw)
}

// CallLogin runs login(ctx, input). credential is the wrapper data when the
// administrator logs in again on an existing credential.
func (p *LoadedPlugin) CallLogin(ctx context.Context, baseURL string, login LoginContext, credential json.RawMessage, input any) (LoginStep, error) {
	hookCtx := map[string]any{
		"baseUrl": baseURL,
		"config":  configValue(login.Config),
		"login": map[string]any{
			"state":               login.State,
			"nonce":               login.Nonce,
			"codeVerifier":        login.CodeVerifier,
			"codeChallenge":       login.CodeChallenge,
			"codeChallengeMethod": "S256",
			"redirectUri":         login.RedirectURI,
			"session":             rawOrNull(login.Session),
		},
	}
	if len(credential) > 0 {
		hookCtx["credential"] = RawJSON(credential)
	}
	result, err := p.Engine.Call(ctx, "login", hookCtx, input)
	if err != nil {
		return LoginStep{}, err
	}
	step, err := decodeLoginStep(result)
	if err != nil {
		return LoginStep{}, fmt.Errorf("plugin %s login result: %w", p.Meta.Key, err)
	}
	return step, nil
}

// CallRefresh runs refresh(ctx).
func (p *LoadedPlugin) CallRefresh(ctx context.Context, hookCtx CredentialContext) (CredentialResult, error) {
	result, err := p.Engine.Call(ctx, "refresh", hookCtx.value())
	if err != nil {
		return CredentialResult{}, err
	}
	object, err := resultObject(result, "refresh result")
	if err != nil {
		return CredentialResult{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	if relogin, exists := object["relogin"]; exists {
		if relogin != true || len(object) != 1 {
			return CredentialResult{}, fmt.Errorf("plugin %s refresh result with relogin must be exactly {relogin: true}", p.Meta.Key)
		}
		return CredentialResult{Relogin: true}, nil
	}
	credential, err := decodeCredentialResult(object, "refresh result")
	if err != nil {
		return CredentialResult{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return credential, nil
}

// ScheduledContext is the current key and the trigger of scheduled.
type ScheduledContext struct {
	CredentialContext
	Reason         string
	KeyStatus      string
	DisabledReason string
}

// ScheduledResult is the next interval and the changes scheduled requests
// for its current key. A nil Credential keeps its data; JSON null replaces it.
type ScheduledResult struct {
	Next       time.Duration
	Credential json.RawMessage
	Balance    *BalanceResult
	KeyStatus  string
	Notify     LocalizedText
}

// CallScheduled runs scheduled(ctx). The caller checks the stored credential
// line's size and applies the result while holding the channel lock.
func (p *LoadedPlugin) CallScheduled(ctx context.Context, hookCtx ScheduledContext) (ScheduledResult, error) {
	value := hookCtx.CredentialContext.value()
	value["reason"] = hookCtx.Reason
	value["keyStatus"] = hookCtx.KeyStatus
	if hookCtx.KeyStatus == "auto_disabled" {
		value["disabledReason"] = hookCtx.DisabledReason
	}
	result, err := p.Engine.Call(ctx, "scheduled", value)
	if err != nil {
		return ScheduledResult{}, err
	}
	subject := "plugin " + p.Meta.Key + " scheduled result"
	object, err := resultObject(result, subject)
	if err != nil {
		return ScheduledResult{}, err
	}
	if err = allowMembers(object, subject, "next", "credential", "balance", "keyStatus", "notify"); err != nil {
		return ScheduledResult{}, err
	}
	scheduled := ScheduledResult{Next: time.Hour}
	if raw, exists := object["next"]; exists {
		seconds, ok := floatValue(raw)
		if !ok || math.IsNaN(seconds) || math.IsInf(seconds, 0) {
			return ScheduledResult{}, fmt.Errorf("%s next must be finite seconds", subject)
		}
		scheduled.Next = time.Duration(max(60, min(86400, seconds)) * float64(time.Second))
	}
	if raw, exists := object["credential"]; exists {
		if len(hookCtx.Credential) == 0 {
			return ScheduledResult{}, fmt.Errorf("%s credential requires a plugin credential", subject)
		}
		scheduled.Credential, err = common.Marshal(raw)
		if err != nil || len(scheduled.Credential) > MaxCredentialBytes {
			return ScheduledResult{}, fmt.Errorf("%s credential must be JSON of at most %d bytes", subject, MaxCredentialBytes)
		}
	}
	if raw, exists := object["balance"]; exists {
		balanceObject, err := resultObject(raw, subject+" balance")
		if err != nil {
			return ScheduledResult{}, err
		}
		balance, err := decodeBalanceResult(balanceObject, subject+" balance")
		if err != nil {
			return ScheduledResult{}, err
		}
		scheduled.Balance = &balance
	}
	if raw, exists := object["keyStatus"]; exists {
		status, ok := raw.(string)
		if !ok || (status != "enabled" && status != "auto_disabled") {
			return ScheduledResult{}, fmt.Errorf("%s keyStatus must be enabled or auto_disabled", subject)
		}
		scheduled.KeyStatus = status
	}
	if raw, exists := object["notify"]; exists {
		scheduled.Notify, err = decodeLocalizedText(raw, subject+" notify", maxScheduledNotifyBytes)
		if err != nil {
			return ScheduledResult{}, err
		}
		encoded, err := common.Marshal(scheduled.Notify)
		if err != nil || len(encoded) > maxScheduledNotifyBytes {
			return ScheduledResult{}, fmt.Errorf("%s notify must be at most %d bytes", subject, maxScheduledNotifyBytes)
		}
	}
	return scheduled, nil
}

// CallRevoke runs revoke(ctx). Its result is ignored.
func (p *LoadedPlugin) CallRevoke(ctx context.Context, hookCtx CredentialContext) error {
	_, err := p.Engine.Call(ctx, "revoke", hookCtx.value())
	return err
}

// SignResult is what signRequest adds to a request.
type SignResult struct {
	Headers map[string]string
	Query   map[string]string
}

// CallSignRequest runs signRequest(ctx, {method, url, headers, bodySha256}).
func (p *LoadedPlugin) CallSignRequest(ctx context.Context, hookCtx CredentialContext, method, requestURL string, headers map[string]string, bodySHA256 string) (SignResult, error) {
	result, err := p.Engine.Call(ctx, "signRequest", hookCtx.value(), map[string]any{
		"method":     method,
		"url":        requestURL,
		"headers":    headers,
		"bodySha256": bodySHA256,
	})
	if err != nil {
		return SignResult{}, err
	}
	object, err := resultObject(result, "signRequest result")
	if err == nil {
		err = allowMembers(object, "signRequest result", "headers", "query")
	}
	var signed SignResult
	if err == nil {
		signed.Headers, err = requestHeadersMember(object, "headers", "signRequest result")
	}
	if err == nil {
		signed.Query, err = queryMember(object, "query", "signRequest result")
	}
	if err != nil {
		return SignResult{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return signed, nil
}

// PrepareInput is the request prepareRequest sees.
type PrepareInput struct {
	Path         string
	UpstreamPath string
	Model        string
	Stream       bool
	Body         []byte
	Headers      map[string]string
}

// PreparedRequest is a prepareRequest result: the JSON text of its effects,
// nil when it returned none, and the path or address the request goes to in
// place of the route's, both empty to keep it.
type PreparedRequest struct {
	Effects json.RawMessage
	Path    string
	URL     string
}

// CallPrepareRequest runs prepareRequest(ctx, req).
func (p *LoadedPlugin) CallPrepareRequest(ctx context.Context, hookCtx HookContext, input PrepareInput) (PreparedRequest, error) {
	result, effects, err := p.Engine.CallPathWithMemberJSON(ctx, 0, "effects", "prepareRequest", nil,
		hookCtx.value(),
		map[string]any{
			"path":         input.Path,
			"upstreamPath": input.UpstreamPath,
			"model":        input.Model,
			"stream":       input.Stream,
			"body":         RawJSON(input.Body),
			"headers":      input.Headers,
		})
	if err != nil {
		return PreparedRequest{}, err
	}
	if result == nil {
		return PreparedRequest{}, nil
	}
	const subject = "prepareRequest result"
	object, err := resultObject(result, subject)
	if err == nil {
		err = allowMembers(object, subject, "effects", "path", "url")
	}
	var prepared PreparedRequest
	if err == nil {
		prepared.Path, prepared.URL, err = requestTarget(object, subject)
	}
	if err != nil {
		return PreparedRequest{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	if object["effects"] != nil {
		prepared.Effects = effects
	}
	return prepared, nil
}

// CallCredentialRejected runs credentialRejected(ctx, {status, headers,
// body}) for a non-2xx response.
func (p *LoadedPlugin) CallCredentialRejected(ctx context.Context, hookCtx HookContext, status int, headers map[string]string, body string) (bool, error) {
	result, err := p.Engine.Call(ctx, "credentialRejected", hookCtx.value(), map[string]any{
		"status":  status,
		"headers": headers,
		"body":    body,
	})
	if err != nil {
		return false, err
	}
	rejected, ok := result.(bool)
	if !ok {
		return false, fmt.Errorf("plugin %s credentialRejected must return a boolean", p.Meta.Key)
	}
	return rejected, nil
}

// ConvertInput is the client request convertRequest converts: its JSON
// body, or Form for a multipart form. Path is the client path of its route.
type ConvertInput struct {
	Path   string
	Body   []byte
	Form   *RequestForm
	Model  string
	Stream bool
}

// RequestForm is a multipart client request as convertRequest sees it: its
// fields, and its files without their content.
type RequestForm struct {
	Fields map[string][]string
	Files  []RequestFile
}

// RequestFile is one uploaded file of a multipart client request.
type RequestFile struct {
	Field       string
	Filename    string
	ContentType string
	Size        int64
}

func (f *RequestForm) value() map[string]any {
	fields := make(map[string]any, len(f.Fields))
	for name, values := range f.Fields {
		if len(values) == 1 {
			fields[name] = values[0]
		} else {
			fields[name] = values
		}
	}
	files := make([]any, 0, len(f.Files))
	for _, file := range f.Files {
		files = append(files, map[string]any{"field": file.Field, "filename": file.Filename, "contentType": file.ContentType, "size": file.Size})
	}
	return map[string]any{"fields": fields, "files": files}
}

// ConvertedRequest is a request a hook asks the host to send: the first
// request of a convertRequest result, a next request of a chain, or the
// buildBalanceRequest result. At most one of Body, Form, File and WebSocket is
// set: the upstream body, a multipart form the host writes, the reference of
// the client file that is the whole body, or an upstream WebSocket session.
// ContentType is empty for the default; Path or URL replaces the route's
// upstream address, both empty to keep it.
type ConvertedRequest struct {
	Body        []byte
	Form        *ConvertedForm
	File        string
	ContentType string
	Path        string
	URL         string
	// Method is empty for the default: the client's method for the first
	// request, POST for a next request with a body and GET for one without.
	Method  string
	Headers map[string]string
	// Stream is the plugin's choice of reading the response as a stream, nil
	// when it leaves it to the host.
	Stream *bool
	// NativeResponse hands a 2xx response to the route's handler as it came,
	// as a response of the route's upstream protocol, without convertResponse
	// or convertStreamEvent.
	NativeResponse bool
	// State is the ctx.state of the hooks that read the response, nil when
	// the result sets none.
	State     json.RawMessage
	WebSocket *WebSocketRequest
	// Delay is the wait before a next request is sent.
	Delay time.Duration
}

// HasBody reports whether the request carries a body, a form or a file.
func (r ConvertedRequest) HasBody() bool {
	return r.Body != nil || r.Form != nil || r.File != ""
}

// WebSocketRequest is the upstream WebSocket session of a convertRequest
// result: the address, as Path or URL, the handshake headers and
// subprotocols, and the messages sent once it is open.
type WebSocketRequest struct {
	Path      string
	URL       string
	Headers   map[string]string
	Protocols []string
	Messages  []WebSocketMessage
}

// WebSocketMessage is one message sent upstream: text, or Binary when
// IsBinary is set.
type WebSocketMessage struct {
	Text     string
	Binary   []byte
	IsBinary bool
}

// ConvertedForm is the multipart form of a convertRequest result.
type ConvertedForm struct {
	Fields map[string][]string
	Files  []ConvertedFormFile
}

// ConvertedFormFile is a client file sent as Field of a converted form. From
// is the file's reference; an empty Filename or ContentType keeps the client
// file's.
type ConvertedFormFile struct {
	Field       string
	From        string
	Filename    string
	ContentType string
}

// CallConvertRequest runs convertRequest(ctx, {body, model, stream}), or
// convertRequest(ctx, {form, model, stream}) for a multipart client request.
func (p *LoadedPlugin) CallConvertRequest(ctx context.Context, hookCtx HookContext, input ConvertInput) (ConvertedRequest, error) {
	request := map[string]any{"model": input.Model, "stream": input.Stream}
	if input.Form != nil {
		request["form"] = input.Form.value()
	} else {
		request["body"] = RawJSON(input.Body)
	}
	if hookCtx.Path == "" {
		hookCtx.Path = input.Path
	}
	result, text, err := p.Engine.CallPathWithMemberJSON(ctx, 0, "body", "convertRequest", nil, hookCtx.value(), request)
	if err != nil {
		return ConvertedRequest{}, err
	}
	object, err := resultObject(result, "convertRequest result")
	var converted ConvertedRequest
	if err == nil {
		converted, err = decodeConvertedRequest(object, text, "convertRequest result", requestFirst)
	}
	if err != nil {
		return ConvertedRequest{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return converted, nil
}

// The kinds of request decodeConvertedRequest reads.
const (
	requestFirst   = iota // a convertRequest result
	requestNext           // the next of a convertResponse or parseBalance result
	requestBalance        // a buildBalanceRequest result
)

// decodeConvertedRequest reads a request a hook returns: body, form, file
// or, for the first request, websocket; contentType, path or url, method,
// headers, stream and nativeResponse; state on a first or balance request,
// delayMs on a next one. text is the JSON text of the body member. A first
// request needs one of body, form, file and websocket unless its method is
// GET, HEAD or DELETE; GET and HEAD take no body.
func decodeConvertedRequest(object map[string]any, text json.RawMessage, subject string, kind int) (ConvertedRequest, error) {
	allowed := []string{"body", "contentType", "path", "url", "method", "headers"}
	switch kind {
	case requestFirst:
		allowed = append(allowed, "form", "file", "stream", "nativeResponse", "state", "websocket")
	case requestNext:
		allowed = append(allowed, "form", "file", "stream", "nativeResponse", "delayMs")
	case requestBalance:
		allowed = append(allowed, "state")
	}
	if err := allowMembers(object, subject, allowed...); err != nil {
		return ConvertedRequest{}, err
	}
	shapes := 0
	for _, name := range []string{"body", "form", "file", "websocket"} {
		if object[name] != nil {
			shapes++
		}
	}
	if shapes > 1 {
		return ConvertedRequest{}, fmt.Errorf("%s must have only one of body, form, file and websocket", subject)
	}
	var converted ConvertedRequest
	var err error
	if converted.Method, err = optionalString(object, "method", subject); err != nil {
		return ConvertedRequest{}, err
	}
	if converted.Method != "" {
		converted.Method = strings.ToUpper(converted.Method)
		if !slices.Contains([]string{"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"}, converted.Method) {
			return ConvertedRequest{}, fmt.Errorf("%s method must be GET, HEAD, POST, PUT, PATCH, DELETE or OPTIONS", subject)
		}
	}
	bodyless := converted.Method == "GET" || converted.Method == "HEAD"
	switch {
	case bodyless && shapes > 0 && object["websocket"] == nil:
		return ConvertedRequest{}, fmt.Errorf("%s with method %s has no body, form or file", subject, converted.Method)
	case kind == requestFirst && shapes == 0 && !bodyless && converted.Method != "DELETE":
		return ConvertedRequest{}, fmt.Errorf("%s must have exactly one of body, form and file", subject)
	}
	if converted.ContentType, err = optionalString(object, "contentType", subject); err != nil {
		return ConvertedRequest{}, err
	}
	if strings.ContainsAny(converted.ContentType, "\r\n") {
		return ConvertedRequest{}, fmt.Errorf("%s contentType is invalid", subject)
	}
	if converted.Path, converted.URL, err = requestTarget(object, subject); err != nil {
		return ConvertedRequest{}, err
	}
	if converted.Headers, err = requestHeadersMember(object, "headers", subject); err != nil {
		return ConvertedRequest{}, err
	}
	if value, exists := object["stream"]; exists && value != nil {
		stream, isBool := value.(bool)
		if !isBool {
			return ConvertedRequest{}, fmt.Errorf("%s stream must be a boolean", subject)
		}
		converted.Stream = &stream
	}
	if value, exists := object["nativeResponse"]; exists && value != nil {
		native, isBool := value.(bool)
		if !isBool {
			return ConvertedRequest{}, fmt.Errorf("%s nativeResponse must be a boolean", subject)
		}
		converted.NativeResponse = native
	}
	if converted.State, err = stateMember(object, subject); err != nil {
		return ConvertedRequest{}, err
	}
	if value, exists := object["delayMs"]; exists && value != nil {
		milliseconds, isInteger := integerValue(value)
		if !isInteger || milliseconds < 0 || time.Duration(milliseconds)*time.Millisecond > maxNextDelay {
			return ConvertedRequest{}, fmt.Errorf("%s delayMs must be an integer from 0 to %d", subject, maxNextDelay.Milliseconds())
		}
		converted.Delay = time.Duration(milliseconds) * time.Millisecond
	}
	switch {
	case object["websocket"] != nil:
		if converted.ContentType != "" || converted.Path != "" || converted.URL != "" || converted.Headers != nil || converted.Method != "" || converted.Stream != nil || converted.NativeResponse {
			return ConvertedRequest{}, fmt.Errorf("%s with websocket has only websocket and state", subject)
		}
		converted.WebSocket, err = decodeWebSocketRequest(object["websocket"], subject+" websocket")
	case object["form"] != nil:
		if converted.ContentType != "" {
			return ConvertedRequest{}, fmt.Errorf("%s with a form has no contentType: the host writes the multipart boundary", subject)
		}
		converted.Form, err = decodeConvertedForm(object["form"])
	case object["file"] != nil:
		file, isString := object["file"].(string)
		if !isString || file == "" {
			err = fmt.Errorf("%s file must name a client file", subject)
		}
		converted.File = file
	case object["body"] != nil:
		converted.Body, err = convertedBody(object, text, subject, maxConvertedBodyBytes())
	}
	if err != nil {
		return ConvertedRequest{}, err
	}
	return converted, nil
}

// requestTarget reads the path or url member of a request result: path
// replaces the route's upstream path on its origin, url the whole address.
func requestTarget(object map[string]any, subject string) (path, target string, err error) {
	if value, exists := object["path"]; exists && value != nil {
		text, isString := value.(string)
		if !isString || !originRelativePath(text) {
			return "", "", fmt.Errorf("%s path must start with a single / and have no scheme, host, fragment or .. segment", subject)
		}
		path = text
	}
	if value, exists := object["url"]; exists && value != nil {
		text, isString := value.(string)
		if !isString || !absoluteRequestURL(text) {
			return "", "", fmt.Errorf("%s url must be an absolute http(s) URL without credentials or fragment", subject)
		}
		if path != "" {
			return "", "", fmt.Errorf("%s must not have both path and url", subject)
		}
		target = text
	}
	return path, target, nil
}

// absoluteRequestURL reports whether text is an address a hook may send a
// request to: an absolute http(s) URL with a host, without credentials or
// fragment, and no longer than a utils.fetch URL.
func absoluteRequestURL(text string) bool {
	if len(text) > maxFetchURLBytes || strings.ContainsAny(text, "#") || strings.IndexFunc(text, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) >= 0 {
		return false
	}
	parsed, err := url.Parse(text)
	return err == nil && (parsed.Scheme == "http" || parsed.Scheme == "https") && parsed.Host != "" && parsed.User == nil
}

// stateMember reads the state member of a result as JSON text, nil when the
// result has none.
func stateMember(object map[string]any, subject string) (json.RawMessage, error) {
	value, exists := object["state"]
	if !exists {
		return nil, nil
	}
	state, err := common.Marshal(value)
	if err != nil {
		return nil, fmt.Errorf("%s state must be JSON: %v", subject, err)
	}
	if len(state) > maxConvertedEventBytes() {
		return nil, fmt.Errorf("%s state exceeds %d bytes", subject, maxConvertedEventBytes())
	}
	return state, nil
}

// decodeWebSocketRequest reads {url | path, headers?, protocols?, messages?}.
func decodeWebSocketRequest(value any, subject string) (*WebSocketRequest, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an object", subject)
	}
	if err := allowMembers(object, subject, "url", "path", "headers", "protocols", "messages"); err != nil {
		return nil, err
	}
	request := &WebSocketRequest{}
	var err error
	if request.Path, request.URL, err = requestTarget(object, subject); err != nil {
		return nil, err
	}
	if request.Headers, err = requestHeadersMember(object, "headers", subject); err != nil {
		return nil, err
	}
	if protocols, exists := object["protocols"]; exists && protocols != nil {
		items, isArray := protocols.([]any)
		if !isArray || len(items) > 16 {
			return nil, fmt.Errorf("%s protocols must be an array of at most 16 tokens", subject)
		}
		for _, item := range items {
			protocol, isString := item.(string)
			if !isString || protocol == "" || len(protocol) > 256 || strings.ContainsAny(protocol, " ,\t\r\n") {
				return nil, fmt.Errorf("%s protocols must be an array of at most 16 tokens", subject)
			}
			request.Protocols = append(request.Protocols, protocol)
		}
	}
	if request.Messages, err = decodeWebSocketMessages(object["messages"], subject+" messages"); err != nil {
		return nil, err
	}
	return request, nil
}

// decodeWebSocketMessages reads an array of text messages and {bodyBase64}
// binary ones.
func decodeWebSocketMessages(value any, subject string) ([]WebSocketMessage, error) {
	if value == nil {
		return nil, nil
	}
	items, ok := value.([]any)
	if !ok || len(items) > maxWebSocketMessages {
		return nil, fmt.Errorf("%s must be an array of at most %d messages", subject, maxWebSocketMessages)
	}
	messages := make([]WebSocketMessage, 0, len(items))
	total := 0
	for index, item := range items {
		var message WebSocketMessage
		switch typed := item.(type) {
		case string:
			message.Text = typed
			total += len(typed)
		case map[string]any:
			encoded, isString := typed["bodyBase64"].(string)
			if len(typed) != 1 || !isString {
				return nil, fmt.Errorf("%s[%d] must be a string or {bodyBase64}", subject, index)
			}
			binary, err := base64.StdEncoding.DecodeString(encoded)
			if err != nil {
				return nil, fmt.Errorf("%s[%d] bodyBase64 is not base64", subject, index)
			}
			message.Binary, message.IsBinary = binary, true
			total += len(binary)
		default:
			return nil, fmt.Errorf("%s[%d] must be a string or {bodyBase64}", subject, index)
		}
		if total > maxConvertedBodyBytes() {
			return nil, fmt.Errorf("%s exceed %d bytes", subject, maxConvertedBodyBytes())
		}
		messages = append(messages, message)
	}
	return messages, nil
}

// decodeConvertedForm reads {fields?: {name: string | string[]}, files?:
// [{field, from, filename?, contentType?}]}. Names and values that end up in
// part headers cannot break a line.
func decodeConvertedForm(value any) (*ConvertedForm, error) {
	const subject = "convertRequest result form"
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an object", subject)
	}
	if err := allowMembers(object, "convertRequest form", "fields", "files"); err != nil {
		return nil, err
	}
	form := &ConvertedForm{}
	if fields, exists := object["fields"]; exists && fields != nil {
		items, isObject := fields.(map[string]any)
		if !isObject {
			return nil, fmt.Errorf("%s fields must be an object", subject)
		}
		form.Fields = make(map[string][]string, len(items))
		for name, item := range items {
			if name == "" || strings.ContainsAny(name, "\r\n") {
				return nil, fmt.Errorf("%s field name %q is invalid", subject, name)
			}
			switch typed := item.(type) {
			case string:
				form.Fields[name] = []string{typed}
			case []any:
				for _, element := range typed {
					text, isString := element.(string)
					if !isString {
						return nil, fmt.Errorf("%s field %q must be a string or an array of strings", subject, name)
					}
					form.Fields[name] = append(form.Fields[name], text)
				}
			default:
				return nil, fmt.Errorf("%s field %q must be a string or an array of strings", subject, name)
			}
		}
	}
	if files, exists := object["files"]; exists && files != nil {
		items, isArray := files.([]any)
		if !isArray {
			return nil, fmt.Errorf("%s files must be an array", subject)
		}
		for index, item := range items {
			fileSubject := fmt.Sprintf("%s files[%d]", subject, index)
			fileObject, isObject := item.(map[string]any)
			if !isObject {
				return nil, fmt.Errorf("%s must be an object", fileSubject)
			}
			if err := allowMembers(fileObject, fmt.Sprintf("convertRequest form files[%d]", index), "field", "from", "filename", "contentType"); err != nil {
				return nil, err
			}
			var file ConvertedFormFile
			for _, member := range []struct {
				name     string
				target   *string
				required bool
			}{{"field", &file.Field, true}, {"from", &file.From, true}, {"filename", &file.Filename, false}, {"contentType", &file.ContentType, false}} {
				text, err := optionalString(fileObject, member.name, fileSubject)
				if err != nil {
					return nil, err
				}
				if (member.required && text == "") || strings.ContainsAny(text, "\r\n") {
					return nil, fmt.Errorf("%s %s is invalid", fileSubject, member.name)
				}
				*member.target = text
			}
			form.Files = append(form.Files, file)
		}
	}
	return form, nil
}

// originRelativePath reports whether path addresses the origin it is sent
// to: it starts with a single /, may have a query and has no fragment and no
// .. segment, also when percent-encoded.
func originRelativePath(path string) bool {
	if !strings.HasPrefix(path, "/") || strings.HasPrefix(path, "//") || strings.Contains(path, "#") {
		return false
	}
	parsed, err := url.Parse(path)
	if err != nil || parsed.Scheme != "" || parsed.Host != "" {
		return false
	}
	for segment := range strings.SplitSeq(parsed.Path, "/") {
		if segment == ".." {
			return false
		}
	}
	return true
}

// UpstreamError is the gateway error convertResponse or convertStreamEvent
// made of a vendor error. Status is 0 when the hook left it to the host.
type UpstreamError struct {
	Status  int
	Message string
	Type    string
	Code    string
}

func (e *UpstreamError) Error() string {
	return e.Message
}

// ConvertedResponse is a convertResponse result: the body the client gets
// and its content type, or the Next request of a chain with the State the
// next call reads. Tools are the tool calls the response counts.
type ConvertedResponse struct {
	Body        []byte
	ContentType string
	Next        *ConvertedRequest
	State       json.RawMessage
	Tools       map[string]int
}

// UpstreamResponse is an upstream response as a response hook reads it.
type UpstreamResponse struct {
	Status  int
	Headers map[string]string
	Body    []byte
}

func (r UpstreamResponse) value() map[string]any {
	response := map[string]any{"status": r.Status, "headers": r.Headers}
	contentType := ""
	for name, value := range r.Headers {
		if strings.EqualFold(name, "Content-Type") {
			contentType = value
		}
	}
	if textualBody(contentType, r.Body) {
		response["body"] = string(r.Body)
	} else {
		response["bodyBase64"] = base64.StdEncoding.EncodeToString(r.Body)
	}
	return response
}

// CallConvertResponse runs convertResponse(ctx, {status, headers, body}) on an
// upstream response of the route at hookCtx.Path, with bodyBase64 in place of
// body when the body is not text, and hookCtx.State as ctx.state. It returns
// the reply in the client protocol, the next request of a chain, or the error
// the plugin made of the response.
func (p *LoadedPlugin) CallConvertResponse(ctx context.Context, hookCtx HookContext, status int, headers map[string]string, body []byte) (ConvertedResponse, *UpstreamError, error) {
	response := UpstreamResponse{Status: status, Headers: headers, Body: body}.value()
	result, text, err := p.Engine.CallPathWithMembersJSON(ctx, 0, []string{"body", "next.body"}, "convertResponse", nil, hookCtx.stateValue(), response)
	if err != nil {
		return ConvertedResponse{}, nil, err
	}
	const subject = "convertResponse result"
	object, err := resultObject(result, subject)
	if err == nil {
		err = allowMembers(object, subject, "body", "bodyBase64", "contentType", "error", "next", "state", "tools")
	}
	var upstreamErr *UpstreamError
	if err == nil {
		upstreamErr, err = resultUpstreamError(object, "convertResponse")
	}
	converted := ConvertedResponse{ContentType: "application/json"}
	if err == nil && upstreamErr == nil {
		converted, err = decodeConvertedResponse(object, text)
	}
	if err != nil {
		return ConvertedResponse{}, nil, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return converted, upstreamErr, nil
}

// textualBody reports whether convertResponse gets a body as text: a JSON,
// XML, NDJSON, form-encoded or text/* content type, or none and valid UTF-8.
func textualBody(contentType string, body []byte) bool {
	mediaType, _, _ := strings.Cut(contentType, ";")
	mediaType = strings.ToLower(strings.TrimSpace(mediaType))
	switch mediaType {
	case "":
		return utf8.Valid(body)
	case "application/json", "application/xml", "application/x-ndjson", "application/x-www-form-urlencoded":
		return true
	}
	return strings.HasPrefix(mediaType, "text/") || strings.HasSuffix(mediaType, "+json") || strings.HasSuffix(mediaType, "+xml")
}

// decodeConvertedResponse reads {body, contentType?} or {bodyBase64,
// contentType?}, or {next, state?} for a chain; any of them may have tools.
// The content type defaults to application/json.
func decodeConvertedResponse(object map[string]any, text json.RawMessage) (ConvertedResponse, error) {
	const subject = "convertResponse result"
	tools, err := decodeToolCounts(object, subject)
	if err != nil {
		return ConvertedResponse{}, err
	}
	if next, exists := object["next"]; exists && next != nil {
		for _, name := range []string{"body", "bodyBase64", "contentType"} {
			if object[name] != nil {
				return ConvertedResponse{}, fmt.Errorf("%s with next has no %s", subject, name)
			}
		}
		converted, err := decodeNextRequest(object, text, subject)
		if err != nil {
			return ConvertedResponse{}, err
		}
		converted.Tools = tools
		return converted, nil
	}
	if _, exists := object["state"]; exists {
		return ConvertedResponse{}, fmt.Errorf("%s state belongs to a result with next", subject)
	}
	contentType, body, err := responseBody(object, text, subject)
	if err != nil {
		return ConvertedResponse{}, err
	}
	if contentType == "" {
		contentType = "application/json"
	}
	return ConvertedResponse{Body: body, ContentType: contentType, Tools: tools}, nil
}

// decodeNextRequest reads the next request and state of a chain result;
// text is the JSON text of next.body.
func decodeNextRequest(object map[string]any, text json.RawMessage, subject string) (ConvertedResponse, error) {
	nextObject, ok := object["next"].(map[string]any)
	if !ok {
		return ConvertedResponse{}, fmt.Errorf("%s next must be an object", subject)
	}
	next, err := decodeConvertedRequest(nextObject, text, subject+" next", requestNext)
	if err != nil {
		return ConvertedResponse{}, err
	}
	state, err := stateMember(object, subject)
	if err != nil {
		return ConvertedResponse{}, err
	}
	return ConvertedResponse{Next: &next, State: state}, nil
}

// responseBody reads the body or bodyBase64 member of a result and its
// contentType, empty when the result has none.
func responseBody(object map[string]any, text json.RawMessage, subject string) (string, []byte, error) {
	contentType, err := optionalString(object, "contentType", subject)
	if err != nil {
		return "", nil, err
	}
	if strings.ContainsAny(contentType, "\r\n") {
		return "", nil, fmt.Errorf("%s contentType is invalid", subject)
	}
	encoded, hasBase64 := object["bodyBase64"]
	if hasBase64 && encoded != nil {
		if object["body"] != nil {
			return "", nil, fmt.Errorf("%s must have exactly one of body and bodyBase64", subject)
		}
		body, err := base64Body(encoded, subject+" bodyBase64", maxConvertedBodyBytes())
		if err != nil {
			return "", nil, err
		}
		return contentType, body, nil
	}
	body, err := convertedBody(object, text, subject, maxConvertedBodyBytes())
	if err != nil {
		return "", nil, err
	}
	return contentType, body, nil
}

// base64Body decodes a base64 member of at most limit bytes.
func base64Body(value any, subject string, limit int) ([]byte, error) {
	text, isString := value.(string)
	if !isString {
		return nil, fmt.Errorf("%s must be a string", subject)
	}
	if base64.StdEncoding.DecodedLen(len(text)) > limit+2 {
		return nil, fmt.Errorf("%s exceeds %d bytes", subject, limit)
	}
	body, err := base64.StdEncoding.DecodeString(text)
	if err != nil {
		return nil, fmt.Errorf("%s is not base64", subject)
	}
	if len(body) > limit {
		return nil, fmt.Errorf("%s exceeds %d bytes", subject, limit)
	}
	return body, nil
}

// decodeToolCounts reads the tools member of a result: tool calls per tool
// name, nil when the result has none.
func decodeToolCounts(object map[string]any, subject string) (map[string]int, error) {
	value, exists := object["tools"]
	if !exists || value == nil {
		return nil, nil
	}
	items, ok := value.(map[string]any)
	if !ok || len(items) > maxToolNames {
		return nil, fmt.Errorf("%s tools must map at most %d tool names to counts", subject, maxToolNames)
	}
	tools := make(map[string]int, len(items))
	for name, item := range items {
		count, isInteger := integerValue(item)
		if strings.TrimSpace(name) == "" || len(name) > 128 || strings.IndexFunc(name, unicode.IsControl) >= 0 {
			return nil, fmt.Errorf("%s tools names must be short single-line strings", subject)
		}
		if !isInteger || count < 0 || count > maxToolCount {
			return nil, fmt.Errorf("%s tools[%q] must be an integer from 0 to %d", subject, name, maxToolCount)
		}
		tools[name] = int(count)
	}
	return tools, nil
}

// StreamEvent is one server-sent event, or one line of a line-delimited
// stream when Event is empty. Event of a decoded AWS event stream message is
// its :event-type or :exception-type. Binary is a binary WebSocket frame,
// which convertStreamEvent gets as {dataBase64}; it is nil for text.
type StreamEvent struct {
	Event  string
	Data   string
	Binary []byte
}

// StreamResult is a convertStreamEvent result besides its state: events
// for a streaming client, or Chunks of the binary body of a non-streaming one
// with their ContentType, or the whole Body of a non-streaming client
// (HasBody), which ends the stream. Send are messages for an upstream
// WebSocket and Close asks the host to close it. Tools are the tool calls
// the event counts.
type StreamResult struct {
	Events      []StreamEvent
	Chunks      [][]byte
	ContentType string
	Body        []byte
	HasBody     bool
	Send        []WebSocketMessage
	Close       bool
	Tools       map[string]int
}

// CallConvertStreamEvent runs convertStreamEvent(ctx, {event?, data}) on the
// stream of the route at hookCtx.Path, {dataBase64} for a binary frame, or
// with done the final call ({done: true}). hookCtx.State is ctx.state; the
// returned state replaces it only when the result carries one. A result with
// an error returns that error and keeps the state.
func (p *LoadedPlugin) CallConvertStreamEvent(ctx context.Context, hookCtx HookContext, event *StreamEvent, done bool) (StreamResult, json.RawMessage, *UpstreamError, error) {
	state := hookCtx.State
	input := map[string]any{"done": true}
	switch {
	case done:
	case event.Binary != nil:
		input = map[string]any{"dataBase64": base64.StdEncoding.EncodeToString(event.Binary)}
	default:
		input = map[string]any{"data": event.Data}
		if event.Event != "" {
			input["event"] = event.Event
		}
	}
	result, text, err := p.Engine.CallPathWithMembersJSON(ctx, 0, []string{"events", "body"}, "convertStreamEvent", nil, hookCtx.stateValue(), input)
	if err != nil {
		return StreamResult{}, state, nil, err
	}
	const subject = "convertStreamEvent result"
	object, err := resultObject(result, subject)
	if err == nil {
		err = allowMembers(object, subject, "events", "state", "error", "chunks", "contentType", "body", "bodyBase64", "send", "close", "tools")
	}
	var upstreamErr *UpstreamError
	if err == nil {
		upstreamErr, err = resultUpstreamError(object, "convertStreamEvent")
	}
	if err == nil && upstreamErr != nil {
		return StreamResult{}, state, upstreamErr, nil
	}
	var converted StreamResult
	if err == nil {
		converted, err = decodeStreamResult(object, text)
	}
	if err == nil {
		if value, exists := object["state"]; exists {
			if state, err = common.Marshal(value); err == nil && len(state) > maxConvertedEventBytes() {
				err = fmt.Errorf("convertStreamEvent result state exceeds %d bytes", maxConvertedEventBytes())
			}
		}
	}
	if err != nil {
		return StreamResult{}, hookCtx.State, nil, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return converted, state, nil, nil
}

// decodeStreamResult reads the output members of a convertStreamEvent
// result: events, or chunks, or body or bodyBase64 (with contentType for
// chunks and a body), and send, close and tools. text is the JSON text of
// events or body.
func decodeStreamResult(object map[string]any, text json.RawMessage) (StreamResult, error) {
	const subject = "convertStreamEvent result"
	outputs := 0
	for _, name := range []string{"events", "chunks", "body", "bodyBase64"} {
		if object[name] != nil {
			outputs++
		}
	}
	if outputs > 1 && !(outputs == 2 && object["body"] != nil && object["bodyBase64"] != nil) {
		return StreamResult{}, fmt.Errorf("%s must have only one of events, chunks and body", subject)
	}
	var converted StreamResult
	var err error
	if converted.Tools, err = decodeToolCounts(object, subject); err != nil {
		return StreamResult{}, err
	}
	switch {
	case object["events"] != nil:
		if object["contentType"] != nil {
			return StreamResult{}, fmt.Errorf("%s contentType belongs to chunks or a body", subject)
		}
		converted.Events, err = decodeStreamEvents(text)
	case object["chunks"] != nil:
		if converted.ContentType, err = optionalString(object, "contentType", subject); err == nil && strings.ContainsAny(converted.ContentType, "\r\n") {
			err = fmt.Errorf("%s contentType is invalid", subject)
		}
		if err == nil {
			converted.Chunks, err = decodeChunks(object["chunks"])
		}
	case object["body"] != nil || object["bodyBase64"] != nil:
		converted.ContentType, converted.Body, err = responseBody(object, text, subject)
		converted.HasBody = err == nil
	case object["contentType"] != nil:
		err = fmt.Errorf("%s contentType belongs to chunks or a body", subject)
	}
	if err != nil {
		return StreamResult{}, err
	}
	if converted.Send, err = decodeWebSocketMessages(object["send"], subject+" send"); err != nil {
		return StreamResult{}, err
	}
	if value, exists := object["close"]; exists && value != nil {
		closeSession, isBool := value.(bool)
		if !isBool {
			return StreamResult{}, fmt.Errorf("%s close must be a boolean", subject)
		}
		converted.Close = closeSession
	}
	return converted, nil
}

// decodeChunks reads [{bodyBase64}]: the binary output a result adds to the
// client body.
func decodeChunks(value any) ([][]byte, error) {
	const subject = "convertStreamEvent result chunks"
	items, ok := value.([]any)
	if !ok || len(items) > maxStreamEvents {
		return nil, fmt.Errorf("%s must be an array of at most %d {bodyBase64} objects", subject, maxStreamEvents)
	}
	chunks := make([][]byte, 0, len(items))
	total := 0
	for index, item := range items {
		object, isObject := item.(map[string]any)
		if !isObject || len(object) != 1 || object["bodyBase64"] == nil {
			return nil, fmt.Errorf("%s[%d] must be {bodyBase64}", subject, index)
		}
		chunk, err := base64Body(object["bodyBase64"], fmt.Sprintf("%s[%d].bodyBase64", subject, index), maxConvertedEventBytes()-total)
		if err != nil {
			return nil, err
		}
		total += len(chunk)
		chunks = append(chunks, chunk)
	}
	return chunks, nil
}

func maxConvertedBodyBytes() int {
	if constant.MaxRequestBodyMB > 0 {
		return constant.MaxRequestBodyMB << 20
	}
	return 128 << 20
}

func maxConvertedEventBytes() int {
	if constant.StreamScannerMaxBufferMB > 0 {
		return constant.StreamScannerMaxBufferMB << 20
	}
	return 128 << 20
}

// convertedBody reads the body member of a convert result: a string is the
// body text, any other value is sent as the JSON text JSON.stringify writes.
func convertedBody(object map[string]any, text json.RawMessage, subject string, limit int) ([]byte, error) {
	value, exists := object["body"]
	if !exists || value == nil {
		return nil, fmt.Errorf("%s body is required", subject)
	}
	var body []byte
	if textBody, isString := value.(string); isString {
		body = []byte(textBody)
	} else {
		body = text
	}
	if len(body) > limit {
		return nil, fmt.Errorf("%s body exceeds %d bytes", subject, limit)
	}
	return body, nil
}

// resultUpstreamError reads the error member of a convertResponse or
// convertStreamEvent result: nil when the result has none. A result with an
// error carries nothing else.
func resultUpstreamError(object map[string]any, hook string) (*UpstreamError, error) {
	value, exists := object["error"]
	if !exists || value == nil {
		return nil, nil
	}
	subject := hook + " result error"
	if len(object) > 1 {
		return nil, fmt.Errorf("%s must be the only member", subject)
	}
	errorObject, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an object", subject)
	}
	if err := allowMembers(errorObject, hook+" error", "status", "message", "type", "code"); err != nil {
		return nil, err
	}
	var result UpstreamError
	if status, exists := errorObject["status"]; exists && status != nil {
		number, isInteger := integerValue(status)
		if !isInteger || number < 400 || number > 599 {
			return nil, fmt.Errorf("%s status must be an integer from 400 to 599", subject)
		}
		result.Status = int(number)
	}
	message, err := optionalString(errorObject, "message", subject)
	if err != nil || strings.TrimSpace(message) == "" {
		return nil, fmt.Errorf("%s message must be a non-empty string", subject)
	}
	result.Message = truncateRunes(message, maxUpstreamErrorMessageRunes)
	for _, member := range []struct {
		name   string
		target *string
	}{{"type", &result.Type}, {"code", &result.Code}} {
		text, textErr := optionalString(errorObject, member.name, subject)
		if textErr != nil {
			return nil, textErr
		}
		*member.target = truncateRunes(text, maxUpstreamErrorCodeRunes)
	}
	return &result, nil
}

func truncateRunes(text string, limit int) string {
	if runes := []rune(text); len(runes) > limit {
		return string(runes[:limit])
	}
	return text
}

func decodeStreamEvents(text json.RawMessage) ([]StreamEvent, error) {
	var items []map[string]json.RawMessage
	if err := common.Unmarshal(text, &items); err != nil {
		return nil, fmt.Errorf("convertStreamEvent result events must be an array of objects")
	}
	if len(items) > maxStreamEvents {
		return nil, fmt.Errorf("convertStreamEvent result must not return more than %d events", maxStreamEvents)
	}
	events := make([]StreamEvent, 0, len(items))
	total := 0
	for index, item := range items {
		var event StreamEvent
		for name, raw := range item {
			switch name {
			case "event":
				if err := common.Unmarshal(raw, &event.Event); err != nil || strings.ContainsAny(event.Event, "\r\n") {
					return nil, fmt.Errorf("convertStreamEvent result events[%d].event must be a single-line string", index)
				}
			case "data":
				if len(raw) > 0 && raw[0] == '"' {
					if err := common.Unmarshal(raw, &event.Data); err != nil {
						return nil, fmt.Errorf("convertStreamEvent result events[%d].data is invalid", index)
					}
				} else if string(raw) != "null" {
					event.Data = string(raw)
				}
			default:
				return nil, fmt.Errorf("convertStreamEvent result events[%d] has unknown member %q", index, name)
			}
		}
		if _, exists := item["data"]; !exists {
			return nil, fmt.Errorf("convertStreamEvent result events[%d].data is required", index)
		}
		total += len(event.Data)
		if total > maxConvertedEventBytes() {
			return nil, fmt.Errorf("convertStreamEvent result events exceed %d bytes", maxConvertedEventBytes())
		}
		events = append(events, event)
	}
	return events, nil
}

func decodeLoginStep(result any) (LoginStep, error) {
	object, err := resultObject(result, "")
	if err != nil {
		return LoginStep{}, err
	}
	stepType, err := optionalString(object, "type", "")
	if err != nil || stepType == "" {
		return LoginStep{}, fmt.Errorf("type must be one of redirect, paste, device, pending, fields or done")
	}
	step := LoginStep{Type: stepType}
	if value, exists := object["session"]; exists && stepType != LoginStepDone {
		encoded, encodeErr := common.Marshal(value)
		if encodeErr != nil {
			return LoginStep{}, fmt.Errorf("session must be JSON: %v", encodeErr)
		}
		if len(encoded) > MaxLoginSessionBytes {
			return LoginStep{}, fmt.Errorf("session exceeds %d bytes", MaxLoginSessionBytes)
		}
		step.Session = encoded
	}
	switch stepType {
	case LoginStepRedirect, LoginStepPaste:
		allowed := []string{"type", "url", "issuer", "session"}
		if stepType == LoginStepPaste {
			allowed = append(allowed, "hint")
		}
		if err = allowMembers(object, "", allowed...); err != nil {
			return LoginStep{}, err
		}
		if step.URL, err = loginURLMember(object, "url", true); err != nil {
			return LoginStep{}, err
		}
		if step.Issuer, err = optionalString(object, "issuer", ""); err != nil {
			return LoginStep{}, err
		}
		if value, exists := object["hint"]; exists && value != nil {
			if step.Hint, err = decodeLocalizedText(value, "hint", maxLoginTextRunes); err != nil {
				return LoginStep{}, err
			}
		}
	case LoginStepDevice:
		if err = allowMembers(object, "", "type", "userCode", "verificationUri", "verificationUriComplete", "interval", "expiresIn", "session"); err != nil {
			return LoginStep{}, err
		}
		if step.UserCode, err = optionalString(object, "userCode", ""); err != nil || strings.TrimSpace(step.UserCode) == "" || len(step.UserCode) > 128 {
			return LoginStep{}, fmt.Errorf("userCode must be a non-empty string")
		}
		if step.VerificationURI, err = loginURLMember(object, "verificationUri", true); err != nil {
			return LoginStep{}, err
		}
		if step.VerificationURIComplete, err = loginURLMember(object, "verificationUriComplete", false); err != nil {
			return LoginStep{}, err
		}
		if step.Interval, err = loginSecondsMember(object, "interval"); err != nil {
			return LoginStep{}, err
		}
		if step.ExpiresIn, err = loginSecondsMember(object, "expiresIn"); err != nil {
			return LoginStep{}, err
		}
	case LoginStepPending:
		if err = allowMembers(object, "", "type", "interval", "session"); err != nil {
			return LoginStep{}, err
		}
		if step.Interval, err = loginSecondsMember(object, "interval"); err != nil {
			return LoginStep{}, err
		}
	case LoginStepFields:
		if err = allowMembers(object, "", "type", "fields", "session"); err != nil {
			return LoginStep{}, err
		}
		if step.Fields, err = decodeLoginFields(object["fields"]); err != nil {
			return LoginStep{}, err
		}
	case LoginStepDone:
		if err = allowMembers(object, "", "type", "credential", "headers", "query", "expiresAt", "accountId", "label"); err != nil {
			return LoginStep{}, err
		}
		result, decodeErr := decodeCredentialResult(object, "")
		if decodeErr != nil {
			return LoginStep{}, decodeErr
		}
		step.Result = &result
	default:
		return LoginStep{}, fmt.Errorf("type %q is not a login step", stepType)
	}
	return step, nil
}

func decodeLoginFields(value any) ([]LoginField, error) {
	items, ok := value.([]any)
	if !ok || len(items) == 0 || len(items) > maxLoginFields {
		return nil, fmt.Errorf("fields must be an array of 1 to %d fields", maxLoginFields)
	}
	fields := make([]LoginField, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for index, item := range items {
		subject := fmt.Sprintf("fields[%d]", index)
		object, ok := item.(map[string]any)
		if !ok {
			return nil, fmt.Errorf("%s must be an object", subject)
		}
		if err := allowMembers(object, subject, "name", "label", "type", "required", "placeholder", "description"); err != nil {
			return nil, err
		}
		var field LoginField
		var err error
		if field.Name, err = optionalString(object, "name", subject); err != nil || !pluginKeyPattern.MatchString(strings.ToLower(field.Name)) || len(field.Name) > 64 {
			return nil, fmt.Errorf("%s.name must be a short identifier", subject)
		}
		if _, duplicate := seen[field.Name]; duplicate {
			return nil, fmt.Errorf("%s.name %q is repeated", subject, field.Name)
		}
		seen[field.Name] = struct{}{}
		if field.Label, err = decodeLocalizedText(object["label"], subject+".label", maxLoginTextRunes); err != nil {
			return nil, err
		}
		if field.Type, err = optionalString(object, "type", subject); err != nil {
			return nil, err
		}
		switch field.Type {
		case "":
			field.Type = "text"
		case "text", "password", "textarea":
		default:
			return nil, fmt.Errorf("%s.type must be text, password or textarea", subject)
		}
		if required, exists := object["required"]; exists && required != nil {
			flag, isBool := required.(bool)
			if !isBool {
				return nil, fmt.Errorf("%s.required must be a boolean", subject)
			}
			field.Required = flag
		}
		for _, member := range []struct {
			name   string
			target *LocalizedText
		}{{"placeholder", &field.Placeholder}, {"description", &field.Description}} {
			if value, exists := object[member.name]; exists && value != nil {
				if *member.target, err = decodeLocalizedText(value, subject+"."+member.name, maxLoginTextRunes); err != nil {
					return nil, err
				}
			}
		}
		fields = append(fields, field)
	}
	return fields, nil
}

func decodeCredentialResult(object map[string]any, subject string) (CredentialResult, error) {
	if err := allowMembers(object, subject, "type", "credential", "headers", "query", "expiresAt", "accountId", "label"); err != nil {
		return CredentialResult{}, err
	}
	value, exists := object["credential"]
	if !exists || value == nil {
		return CredentialResult{}, fmt.Errorf("%s credential is required", strings.TrimSpace(subject))
	}
	var result CredentialResult
	var err error
	if result.Credential, err = common.Marshal(value); err != nil {
		return CredentialResult{}, fmt.Errorf("%s credential must be JSON: %v", strings.TrimSpace(subject), err)
	}
	if result.Headers, err = requestHeadersMember(object, "headers", subject); err != nil {
		return CredentialResult{}, err
	}
	if result.Query, err = queryMember(object, "query", subject); err != nil {
		return CredentialResult{}, err
	}
	if raw, exists := object["expiresAt"]; exists && raw != nil {
		seconds, ok := integerValue(raw)
		if !ok || seconds < 0 {
			return CredentialResult{}, fmt.Errorf("%s expiresAt must be unix seconds", strings.TrimSpace(subject))
		}
		result.ExpiresAt = seconds
	}
	for _, member := range []struct {
		name   string
		target *string
	}{{"accountId", &result.AccountID}, {"label", &result.Label}} {
		text, textErr := optionalString(object, member.name, subject)
		if textErr != nil || len(text) > 256 || strings.IndexFunc(text, unicode.IsControl) >= 0 {
			return CredentialResult{}, fmt.Errorf("%s %s must be a short single-line string", strings.TrimSpace(subject), member.name)
		}
		*member.target = strings.TrimSpace(text)
	}
	return result, nil
}

func resultObject(value any, subject string) (map[string]any, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s must be an object", strings.TrimSpace(subject+" result"))
	}
	return object, nil
}

func allowMembers(object map[string]any, subject string, names ...string) error {
	for name := range object {
		known := false
		for _, allowed := range names {
			if name == allowed {
				known = true
				break
			}
		}
		if !known {
			return fmt.Errorf("%s has unknown member %q", strings.TrimSpace(subject+" result"), name)
		}
	}
	return nil
}

func optionalString(object map[string]any, name, subject string) (string, error) {
	value, exists := object[name]
	if !exists || value == nil {
		return "", nil
	}
	text, ok := value.(string)
	if !ok {
		return "", fmt.Errorf("%s must be a string", strings.TrimSpace(subject+" "+name))
	}
	return text, nil
}

func integerValue(value any) (int64, bool) {
	switch number := value.(type) {
	case int64:
		return number, true
	case int:
		return int64(number), true
	case float64:
		if number == float64(int64(number)) {
			return int64(number), true
		}
	}
	return 0, false
}

func loginSecondsMember(object map[string]any, name string) (int, error) {
	value, exists := object[name]
	if !exists || value == nil {
		return 0, nil
	}
	seconds, ok := integerValue(value)
	if !ok || seconds <= 0 || seconds > 3600 {
		return 0, fmt.Errorf("%s must be whole seconds from 1 to 3600", name)
	}
	return int(seconds), nil
}

// loginURLMember reads an absolute http(s) URL the browser opens.
func loginURLMember(object map[string]any, name string, required bool) (string, error) {
	text, err := optionalString(object, name, "")
	if err != nil {
		return "", err
	}
	if text == "" {
		if required {
			return "", fmt.Errorf("%s is required", name)
		}
		return "", nil
	}
	parsed, parseErr := url.Parse(text)
	if parseErr != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") || parsed.Host == "" || parsed.User != nil ||
		len(text) > maxLoginURLBytes || strings.IndexFunc(text, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) >= 0 {
		return "", fmt.Errorf("%s must be an absolute http(s) URL", name)
	}
	return text, nil
}

func requestHeadersMember(object map[string]any, name, subject string) (map[string]string, error) {
	headers, err := stringMapMember(object, name, subject)
	if err != nil || headers == nil {
		return headers, err
	}
	if err = ValidateRequestHeaders(headers); err != nil {
		return nil, fmt.Errorf("%s %s: %v", strings.TrimSpace(subject), name, err)
	}
	return headers, nil
}

func queryMember(object map[string]any, name, subject string) (map[string]string, error) {
	query, err := stringMapMember(object, name, subject)
	if err != nil || query == nil {
		return query, err
	}
	if len(query) > 64 {
		return nil, fmt.Errorf("%s %s must not exceed 64 parameters", strings.TrimSpace(subject), name)
	}
	for key, value := range query {
		if strings.TrimSpace(key) == "" || len(key) > 256 || len(value) > 8192 ||
			strings.IndexFunc(key+value, unicode.IsControl) >= 0 {
			return nil, fmt.Errorf("%s %s parameter %q is invalid", strings.TrimSpace(subject), name, key)
		}
	}
	return query, nil
}

func stringMapMember(object map[string]any, name, subject string) (map[string]string, error) {
	value, exists := object[name]
	if !exists || value == nil {
		return nil, nil
	}
	items, ok := value.(map[string]any)
	if !ok {
		return nil, fmt.Errorf("%s %s must map names to strings", strings.TrimSpace(subject), name)
	}
	values := make(map[string]string, len(items))
	for key, item := range items {
		text, isString := item.(string)
		if !isString {
			return nil, fmt.Errorf("%s %s %q must be a string", strings.TrimSpace(subject), name, key)
		}
		values[key] = text
	}
	return values, nil
}

// Text returns the text for lang: its own locale, then the bare language,
// then the first regional locale of that language in sorted order, then en.
func (t LocalizedText) Text(lang string) string {
	language, _, _ := strings.Cut(lang, "-")
	bare, regional := "", ""
	for locale := range t {
		if strings.EqualFold(locale, lang) {
			return t[locale]
		}
		prefix, _, hasRegion := strings.Cut(locale, "-")
		switch {
		case language == "" || !strings.EqualFold(prefix, language):
		case !hasRegion:
			bare = locale
		case regional == "" || locale < regional:
			regional = locale
		}
	}
	if bare != "" {
		return t[bare]
	}
	if regional != "" {
		return t[regional]
	}
	return t["en"]
}

// ExchangedToken is an exchangeKey result: the token the relay hooks get as
// ctx.token, and when it expires in unix seconds, 0 for no expiry.
type ExchangedToken struct {
	Token     json.RawMessage
	ExpiresAt int64
}

// CallExchangeKey runs exchangeKey(ctx) for a static key line: hookCtx has
// the base URL, the plugin config and the key. It returns the token or the
// error the plugin made of the vendor's answer.
func (p *LoadedPlugin) CallExchangeKey(ctx context.Context, hookCtx CredentialContext) (ExchangedToken, *UpstreamError, error) {
	result, err := p.Engine.Call(ctx, "exchangeKey", map[string]any{"baseUrl": hookCtx.BaseURL, "config": configValue(hookCtx.Config), "apiKey": hookCtx.APIKey})
	if err != nil {
		return ExchangedToken{}, nil, err
	}
	const subject = "exchangeKey result"
	object, err := resultObject(result, subject)
	if err == nil {
		err = allowMembers(object, subject, "token", "expiresAt", "error")
	}
	var upstreamErr *UpstreamError
	if err == nil {
		upstreamErr, err = resultUpstreamError(object, "exchangeKey")
	}
	if err == nil && upstreamErr != nil {
		return ExchangedToken{}, upstreamErr, nil
	}
	var exchanged ExchangedToken
	if err == nil {
		if object["token"] == nil {
			err = fmt.Errorf("%s token is required", subject)
		} else if exchanged.Token, err = common.Marshal(object["token"]); err == nil && len(exchanged.Token) > MaxCredentialBytes {
			err = fmt.Errorf("%s token exceeds %d bytes", subject, MaxCredentialBytes)
		}
	}
	if err == nil {
		if raw, exists := object["expiresAt"]; exists && raw != nil {
			seconds, ok := integerValue(raw)
			if !ok || seconds < 0 {
				err = fmt.Errorf("%s expiresAt must be unix seconds", subject)
			}
			exchanged.ExpiresAt = seconds
		}
	}
	if err != nil {
		return ExchangedToken{}, nil, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return exchanged, nil, nil
}

// CallCheckKey runs checkKey(ctx, key) on a static key line an administrator
// saves. It returns nil for a good key, or the plugin's message for the
// administrator.
func (p *LoadedPlugin) CallCheckKey(ctx context.Context, baseURL string, config json.RawMessage, key string) (LocalizedText, error) {
	result, err := p.Engine.Call(ctx, "checkKey", map[string]any{"baseUrl": baseURL, "config": configValue(config)}, key)
	if err != nil || result == nil {
		return nil, err
	}
	object, err := resultObject(result, "checkKey result")
	if err == nil {
		err = allowMembers(object, "checkKey result", "error")
	}
	var message LocalizedText
	if err == nil {
		if object["error"] == nil {
			return nil, nil
		}
		message, err = decodeLocalizedText(object["error"], "checkKey result error", MaxCheckKeyMessageRunes)
	}
	if err != nil {
		return nil, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return message, nil
}

// BalanceResult is a channel balance: the amount in currency, null when the
// vendor reports none, unlimited, and the quota windows of the account.
type BalanceResult struct {
	Amount    *float64        `json:"amount"`
	Currency  string          `json:"currency"`
	Unlimited bool            `json:"unlimited"`
	Windows   []BalanceWindow `json:"windows"`
}

// BalanceWindow is one quota window: what is used of the limit in unit, and
// when it resets in unix seconds, 0 when the vendor does not say.
type BalanceWindow struct {
	Name    LocalizedText `json:"name"`
	Used    float64       `json:"used"`
	Limit   float64       `json:"limit"`
	Unit    string        `json:"unit,omitempty"`
	ResetAt int64         `json:"resetAt,omitempty"`
}

// balanceContext is the ctx of the balance hooks.
func balanceContext(hookCtx CredentialContext, state json.RawMessage) map[string]any {
	ctx := hookCtx.value()
	ctx["state"] = rawOrNull(state)
	return ctx
}

// CallBuildBalanceRequest runs buildBalanceRequest(ctx): the first request of
// a balance query, with the state parseBalance starts from.
func (p *LoadedPlugin) CallBuildBalanceRequest(ctx context.Context, hookCtx CredentialContext) (ConvertedRequest, error) {
	result, text, err := p.Engine.CallPathWithMemberJSON(ctx, 0, "body", "buildBalanceRequest", nil, balanceContext(hookCtx, nil))
	if err != nil {
		return ConvertedRequest{}, err
	}
	object, err := resultObject(result, "buildBalanceRequest result")
	var request ConvertedRequest
	if err == nil {
		request, err = decodeConvertedRequest(object, text, "buildBalanceRequest result", requestBalance)
	}
	if err != nil {
		return ConvertedRequest{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return request, nil
}

// BalanceStep is a parseBalance result: the balance, or the Next request
// with the State its parse reads.
type BalanceStep struct {
	Balance *BalanceResult
	Next    *ConvertedRequest
	State   json.RawMessage
}

// CallParseBalance runs parseBalance(ctx, {status, headers, body}). A
// returned {error} is an error with the plugin's message.
func (p *LoadedPlugin) CallParseBalance(ctx context.Context, hookCtx CredentialContext, state json.RawMessage, response UpstreamResponse) (BalanceStep, error) {
	result, text, err := p.Engine.CallPathWithMemberJSON(ctx, 0, "next.body", "parseBalance", nil, balanceContext(hookCtx, state), response.value())
	if err != nil {
		return BalanceStep{}, err
	}
	const subject = "parseBalance result"
	object, err := resultObject(result, subject)
	if err != nil {
		return BalanceStep{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	if value, exists := object["error"]; exists && value != nil {
		if len(object) > 1 {
			return BalanceStep{}, fmt.Errorf("plugin %s %s error must be the only member", p.Meta.Key, subject)
		}
		message, isString := value.(string)
		if errorObject, isObject := value.(map[string]any); isObject {
			message, isString = errorObject["message"].(string)
		}
		if !isString || strings.TrimSpace(message) == "" {
			return BalanceStep{}, fmt.Errorf("plugin %s %s error must be a message or {message}", p.Meta.Key, subject)
		}
		return BalanceStep{}, &UpstreamError{Message: truncateRunes(message, maxUpstreamErrorMessageRunes)}
	}
	if _, exists := object["next"]; exists {
		err = allowMembers(object, subject, "next", "state")
		var chained ConvertedResponse
		if err == nil {
			chained, err = decodeNextRequest(object, text, subject)
		}
		if err != nil {
			return BalanceStep{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
		}
		return BalanceStep{Next: chained.Next, State: chained.State}, nil
	}
	balance, err := decodeBalanceResult(object, subject)
	if err != nil {
		return BalanceStep{}, fmt.Errorf("plugin %s %w", p.Meta.Key, err)
	}
	return BalanceStep{Balance: &balance}, nil
}

// decodeBalanceResult reads {amount, currency, unlimited?, windows?}.
func decodeBalanceResult(object map[string]any, subject string) (BalanceResult, error) {
	if err := allowMembers(object, subject, "amount", "currency", "unlimited", "windows"); err != nil {
		return BalanceResult{}, err
	}
	result := BalanceResult{Windows: []BalanceWindow{}}
	if value, exists := object["amount"]; exists && value != nil {
		amount, isNumber := floatValue(value)
		if !isNumber || math.IsNaN(amount) || math.IsInf(amount, 0) {
			return BalanceResult{}, fmt.Errorf("%s amount must be a finite number or null", subject)
		}
		result.Amount = &amount
	}
	currency, err := optionalString(object, "currency", subject)
	if err != nil {
		return BalanceResult{}, err
	}
	result.Currency = strings.ToUpper(strings.TrimSpace(currency))
	if result.Amount != nil && !currencyPattern.MatchString(result.Currency) {
		return BalanceResult{}, fmt.Errorf("%s currency must be a three-letter code with an amount", subject)
	}
	if result.Currency != "" && !currencyPattern.MatchString(result.Currency) {
		return BalanceResult{}, fmt.Errorf("%s currency must be a three-letter code", subject)
	}
	if value, exists := object["unlimited"]; exists && value != nil {
		unlimited, isBool := value.(bool)
		if !isBool {
			return BalanceResult{}, fmt.Errorf("%s unlimited must be a boolean", subject)
		}
		result.Unlimited = unlimited
	}
	if value, exists := object["windows"]; exists && value != nil {
		items, isArray := value.([]any)
		if !isArray || len(items) > maxBalanceWindows {
			return BalanceResult{}, fmt.Errorf("%s windows must be an array of at most %d windows", subject, maxBalanceWindows)
		}
		for index, item := range items {
			window, err := decodeBalanceWindow(item, fmt.Sprintf("%s windows[%d]", subject, index))
			if err != nil {
				return BalanceResult{}, err
			}
			result.Windows = append(result.Windows, window)
		}
	}
	if result.Amount == nil && !result.Unlimited && len(result.Windows) == 0 {
		return BalanceResult{}, fmt.Errorf("%s must have an amount, unlimited or windows", subject)
	}
	return result, nil
}

var currencyPattern = regexp.MustCompile(`^[A-Z]{3}$`)

func decodeBalanceWindow(value any, subject string) (BalanceWindow, error) {
	object, ok := value.(map[string]any)
	if !ok {
		return BalanceWindow{}, fmt.Errorf("%s must be an object", subject)
	}
	if err := allowMembers(object, subject, "name", "used", "limit", "unit", "resetAt"); err != nil {
		return BalanceWindow{}, err
	}
	var window BalanceWindow
	var err error
	if window.Name, err = decodeLocalizedText(object["name"], subject+" name", maxLoginTextRunes); err != nil {
		return BalanceWindow{}, err
	}
	for _, member := range []struct {
		name   string
		target *float64
	}{{"used", &window.Used}, {"limit", &window.Limit}} {
		number, isNumber := floatValue(object[member.name])
		if !isNumber || math.IsNaN(number) || math.IsInf(number, 0) {
			return BalanceWindow{}, fmt.Errorf("%s %s must be a finite number", subject, member.name)
		}
		*member.target = number
	}
	if window.Unit, err = optionalString(object, "unit", subject); err != nil || len(window.Unit) > 32 || strings.IndexFunc(window.Unit, unicode.IsControl) >= 0 {
		return BalanceWindow{}, fmt.Errorf("%s unit must be a short string", subject)
	}
	if raw, exists := object["resetAt"]; exists && raw != nil {
		seconds, isInteger := integerValue(raw)
		if !isInteger || seconds < 0 {
			return BalanceWindow{}, fmt.Errorf("%s resetAt must be unix seconds", subject)
		}
		window.ResetAt = seconds
	}
	return window, nil
}

func floatValue(value any) (float64, bool) {
	switch number := value.(type) {
	case float64:
		return number, true
	case int64:
		return float64(number), true
	case int:
		return float64(number), true
	}
	return 0, false
}
