package providerplugin

import (
	"bytes"
	"cmp"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"slices"
	"strings"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/pkg/requestpatch"
	"github.com/QuantumNous/new-api/relay/channel"
	"github.com/QuantumNous/new-api/relay/channel/advancedcustom"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	relayconstant "github.com/QuantumNous/new-api/relay/constant"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/relaykit/types"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
	"github.com/tidwall/gjson"
)

const ChannelName = "provider_plugin"

// Adaptor serves a task plugin channel whose plugin has relay routes. The
// Advanced Custom adaptor relays the routes; this adaptor adds the plugin
// credential of the channel key and the plugin's request hooks.
type Adaptor struct {
	advancedcustom.Adaptor

	plugin *jsplugin.LoadedPlugin
	// route is the manifest route of the request, with its own converter.
	route dto.AdvancedCustomRoute
	// credential is the key's plugin credential, nil for a static key.
	credential *jsplugin.Credential
	// headerEffects are the header.patch effects of prepareRequest.
	headerEffects []requestpatch.Effect
	contentType   string
	bodySHA256    string
	// config is the channel's plugin config as the hooks get it, and token
	// the exchangeKey token of a static key line, nil without one.
	config json.RawMessage
	token  json.RawMessage
	// tools are the tool calls the plugin counted in the responses of the
	// request, billed after the response is relayed.
	tools map[string]int
	// prepared is set once prepareKey ran for the request.
	prepared bool
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
	a.Adaptor.Init(info)
	a.credential, a.prepared = nil, false
	credential, ok := jsplugin.ParseCredential(info.ApiKey)
	if !ok {
		return
	}
	a.credential = credential
	// A credential replaces the route auth template.
	if config := info.ChannelOtherSettings.AdvancedCustom; config != nil {
		routes := make([]dto.AdvancedCustomRoute, len(config.Routes))
		for index, route := range config.Routes {
			route.Auth = &dto.AdvancedCustomRouteAuth{Type: dto.AdvancedCustomAuthTypeNone}
			routes[index] = route
		}
		withoutAuth := *config
		withoutAuth.Routes = routes
		info.ChannelOtherSettings.AdvancedCustom = &withoutAuth
	}
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	requestURL, err := a.Adaptor.GetRequestURL(info)
	if err != nil || a.credential == nil || len(a.credential.Query) == 0 {
		return requestURL, err
	}
	parsed, err := url.Parse(requestURL)
	if err != nil {
		return "", err
	}
	query := parsed.Query()
	for name, value := range a.credential.Query {
		query.Set(name, value)
	}
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, header *http.Header, info *relaycommon.RelayInfo) error {
	if err := a.Adaptor.SetupRequestHeader(c, header, info); err != nil {
		return err
	}
	if len(a.headerEffects) > 0 {
		_, patched, err := requestpatch.Apply(nil, *header, a.headerEffects, a.protectedHeader)
		if err != nil {
			return err
		}
		clear(*header)
		maps.Copy(*header, patched)
	}
	if a.contentType != "" {
		header.Set("Content-Type", a.contentType)
	}
	if a.credential != nil {
		for name, value := range a.credential.Headers {
			header.Set(name, value)
		}
	}
	return nil
}

// SignUpstreamRequest runs the plugin's signRequest on every request the
// channel sends, after the header overrides.
func (a *Adaptor) SignUpstreamRequest(c *gin.Context, info *relaycommon.RelayInfo, method string, target *url.URL, header http.Header) error {
	return a.sign(c.Request.Context(), info, method, target, header)
}

func (a *Adaptor) sign(ctx context.Context, info *relaycommon.RelayInfo, method string, target *url.URL, header http.Header) error {
	if !a.plugin.HasProviderHook("signRequest") {
		return nil
	}
	headers := make(map[string]string, len(header))
	for name := range header {
		headers[name] = header.Get(name)
	}
	bodySHA256 := a.bodySHA256
	if bodySHA256 == "" {
		empty := sha256.Sum256(nil)
		bodySHA256 = hex.EncodeToString(empty[:])
	}
	signed, err := a.plugin.CallSignRequest(ctx, a.credentialContext(info), method, target.String(), headers, bodySHA256)
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

// PrepareWebSocket binds the plugin and the key before a client WebSocket
// session dials the upstream, as DoRequest does for a request.
func (a *Adaptor) PrepareWebSocket(c *gin.Context, info *relaycommon.RelayInfo) error {
	return a.prepareKey(c, info)
}

// prepareKey binds the plugin and its route, refreshes a credential that
// expires soon and exchanges a static key for a token when the plugin
// exports exchangeKey.
func (a *Adaptor) prepareKey(c *gin.Context, info *relaycommon.RelayInfo) error {
	if a.prepared {
		return nil
	}
	a.prepared = true
	if err := a.bind(c, info); err != nil {
		return err
	}
	if err := a.useFreshCredential(c, info); err != nil {
		return err
	}
	return a.useToken(c, info)
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if err := a.prepareKey(c, info); err != nil {
		return nil, err
	}
	_, pluginRoute := jsplugin.SplitProviderConverter(a.route.Converter)
	formRequest := advancedcustom.UsesFormRequest(c, info)
	// A plugin route converts a form too; other routes send it as it came.
	bodyless := (formRequest && !pluginRoute) || info.RelayMode == relayconstant.RelayModeRealtime
	if bodyless || (!pluginRoute && !a.canRenew() && !a.plugin.HasProviderHook("prepareRequest") && !a.plugin.HasProviderHook("signRequest")) {
		if bodyless && a.plugin.HasProviderHook("signRequest") && requestBody != nil {
			body, err := io.ReadAll(requestBody)
			if err != nil {
				return nil, err
			}
			sum := sha256.Sum256(body)
			a.bodySHA256 = hex.EncodeToString(sum[:])
			requestBody = bytes.NewReader(body)
		}
		return a.send(c, info, requestBody)
	}

	ctx := c.Request.Context()
	input := jsplugin.ConvertInput{Path: c.Request.URL.Path, Model: info.UpstreamModelName, Stream: info.IsStream}
	// files are the client's uploaded files by reference, nil for a JSON
	// request.
	var files map[string]*multipart.FileHeader
	var err error
	if formRequest {
		var form *multipart.Form
		if form, err = common.ParseMultipartFormReusable(c); err != nil {
			return nil, types.NewError(err, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		defer form.RemoveAll()
		input.Form, files = requestForm(form, info.UpstreamModelName)
	} else if input.Body, err = io.ReadAll(requestBody); err != nil {
		return nil, err
	}
	first := jsplugin.ConvertedRequest{Body: input.Body}
	body := input.Body
	// formOrFile is set when the plugin sends a form or a client file:
	// prepareRequest and $file markers apply to a body only.
	formOrFile := false
	if pluginRoute {
		if first, err = a.plugin.CallConvertRequest(ctx, a.hookContext(c, info), input); err != nil {
			return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		if first.WebSocket != nil {
			return a.openWebSocket(c, info, first)
		}
		if first.HasBody() {
			if body, a.contentType, err = upstreamBody(first, files, formRequest); err != nil {
				return nil, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
			}
		} else {
			body, a.contentType = nil, ""
		}
		formOrFile = first.Form != nil || first.File != ""
	}
	a.useTarget(first.Path, first.URL)
	if a.plugin.HasProviderHook("prepareRequest") && !formOrFile && body != nil && gjson.ValidBytes(body) {
		var target jsplugin.PreparedRequest
		if body, target, err = a.prepare(c, info, body); err != nil {
			return nil, err
		}
		if target.Path != "" || target.URL != "" {
			first.Path, first.URL = target.Path, target.URL
		}
	}
	if pluginRoute && !formOrFile && body != nil {
		if body, err = replaceFileMarkers(body, files); err != nil {
			return nil, types.NewError(fmt.Errorf("plugin %s convertRequest result: %w", a.plugin.Meta.Key, err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
	}
	if pluginRoute {
		return a.runChain(c, info, first, body, a.contentType, files)
	}

	a.useTarget(first.Path, first.URL)
	if a.plugin.HasProviderHook("signRequest") {
		sum := sha256.Sum256(body)
		a.bodySHA256 = hex.EncodeToString(sum[:])
	}
	response, err := a.send(c, info, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	resp, _ := response.(*http.Response)
	if resp == nil || !a.canRenew() || !a.rejected(c, info, resp) || a.renew(c, info) != nil {
		return response, nil
	}
	_ = resp.Body.Close()
	return a.send(c, info, bytes.NewReader(body))
}

// DoResponse relays the response as the route's handler does, then bills the
// tool calls the plugin counted, which replace the handler's count of the
// same tools.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (any, *types.NewAPIError) {
	usage, err := a.Adaptor.DoResponse(c, resp, info)
	for name, count := range a.tools {
		info.SetBillableToolCount(name, min(count, relaycommon.MaxBillableToolCallCount))
	}
	return usage, err
}

// addTools adds the tool calls of one hook result.
func (a *Adaptor) addTools(tools map[string]int) {
	if len(tools) == 0 {
		return
	}
	if a.tools == nil {
		a.tools = make(map[string]int, len(tools))
	}
	for name, count := range tools {
		a.tools[name] = min(a.tools[name]+count, relaycommon.MaxBillableToolCallCount)
	}
}

// requestForm is a multipart client request as convertRequest sees it, with
// the upstream model in its model field, and its files by reference: the
// first file of a field is the field name, a later one field#index.
func requestForm(form *multipart.Form, model string) (*jsplugin.RequestForm, map[string]*multipart.FileHeader) {
	input := &jsplugin.RequestForm{Fields: maps.Clone(form.Value)}
	if input.Fields == nil {
		input.Fields = map[string][]string{}
	}
	if _, exists := input.Fields["model"]; exists {
		input.Fields["model"] = []string{model}
	}
	files := make(map[string]*multipart.FileHeader)
	for _, field := range slices.Sorted(maps.Keys(form.File)) {
		for index, header := range form.File[field] {
			ref := field
			if index > 0 {
				ref = fmt.Sprintf("%s#%d", field, index)
			}
			files[ref] = header
			input.Files = append(input.Files, jsplugin.RequestFile{Field: field, Filename: header.Filename, ContentType: header.Header.Get("Content-Type"), Size: header.Size})
		}
	}
	return input, files
}

// upstreamBody is the body a convertRequest result sends and its content
// type: the result's body, a multipart form of its fields and the client
// files it names, or one client file as it came. A body keeps its $file
// markers; replaceFileMarkers fills them in before the request is signed.
func upstreamBody(converted jsplugin.ConvertedRequest, files map[string]*multipart.FileHeader, formRequest bool) ([]byte, string, error) {
	limit := maxBodyBytes()
	switch {
	case converted.Form != nil:
		var buffer bytes.Buffer
		writer := multipart.NewWriter(&buffer)
		for _, name := range slices.Sorted(maps.Keys(converted.Form.Fields)) {
			for _, value := range converted.Form.Fields[name] {
				if err := writer.WriteField(name, value); err != nil {
					return nil, "", err
				}
			}
		}
		for _, file := range converted.Form.Files {
			header, ok := files[file.From]
			if !ok {
				return nil, "", fmt.Errorf("convertRequest result form file %q names no client file", file.From)
			}
			if int64(buffer.Len())+header.Size > limit {
				return nil, "", fmt.Errorf("converted request exceeds %d bytes", limit)
			}
			part, err := writer.CreatePart(textproto.MIMEHeader{
				"Content-Disposition": {multipart.FileContentDisposition(file.Field, cmp.Or(file.Filename, header.Filename))},
				"Content-Type":        {cmp.Or(file.ContentType, header.Header.Get("Content-Type"), "application/octet-stream")},
			})
			if err == nil {
				err = copyFile(part, header)
			}
			if err != nil {
				return nil, "", err
			}
		}
		if err := writer.Close(); err != nil {
			return nil, "", err
		}
		if int64(buffer.Len()) > limit {
			return nil, "", fmt.Errorf("converted request exceeds %d bytes", limit)
		}
		return buffer.Bytes(), writer.FormDataContentType(), nil
	case converted.File != "":
		header, ok := files[converted.File]
		if !ok {
			return nil, "", fmt.Errorf("convertRequest result file %q names no client file", converted.File)
		}
		if header.Size > limit {
			return nil, "", fmt.Errorf("converted request exceeds %d bytes", limit)
		}
		var buffer bytes.Buffer
		if err := copyFile(&buffer, header); err != nil {
			return nil, "", err
		}
		return buffer.Bytes(), cmp.Or(converted.ContentType, header.Header.Get("Content-Type"), "application/octet-stream"), nil
	}
	if converted.ContentType == "" && formRequest {
		// The client's multipart content type does not describe the body.
		return converted.Body, "application/json", nil
	}
	return converted.Body, converted.ContentType, nil
}

func copyFile(target io.Writer, header *multipart.FileHeader) error {
	file, err := header.Open()
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = io.Copy(target, file)
	return err
}

// fileMarker is a {"$file": ref, "encoding": ...} object of a JSON body, by
// its byte range.
type fileMarker struct {
	start, end    int
	ref, encoding string
}

// replaceFileMarkers replaces each $file marker of a JSON body with the
// content of the client file it names, as base64 or as a data URL, and keeps
// every other byte. files is nil for a JSON client request, which has no
// files to name.
func replaceFileMarkers(body []byte, files map[string]*multipart.FileHeader) ([]byte, error) {
	if !bytes.Contains(body, []byte(`"$file"`)) || !gjson.ValidBytes(body) {
		return body, nil
	}
	root := gjson.ParseBytes(body)
	markers, err := fileMarkers(root, nil)
	if err != nil || len(markers) == 0 {
		return body, err
	}
	if files == nil {
		return nil, errors.New("$file markers need a multipart client request")
	}
	// Offsets count from the first byte of the root value.
	offset := len(body) - len(root.Raw)
	prefixes := make([][]byte, len(markers))
	size := int64(len(body))
	for index, marker := range markers {
		header, ok := files[marker.ref]
		if !ok {
			return nil, fmt.Errorf("$file %q names no client file", marker.ref)
		}
		prefixes[index] = []byte(`"`)
		if marker.encoding == "dataUrl" {
			quoted, err := common.Marshal("data:" + cmp.Or(header.Header.Get("Content-Type"), "application/octet-stream") + ";base64,")
			if err != nil {
				return nil, err
			}
			prefixes[index] = quoted[:len(quoted)-1]
		}
		size += int64(len(prefixes[index])+base64.StdEncoding.EncodedLen(int(header.Size))+1) - int64(marker.end-marker.start)
	}
	if limit := maxBodyBytes(); size > limit {
		return nil, fmt.Errorf("converted request exceeds %d bytes", limit)
	}
	var replaced bytes.Buffer
	replaced.Grow(int(size))
	last := 0
	for index, marker := range markers {
		replaced.Write(body[last : offset+marker.start])
		replaced.Write(prefixes[index])
		encoder := base64.NewEncoder(base64.StdEncoding, &replaced)
		if err := copyFile(encoder, files[marker.ref]); err != nil {
			return nil, err
		}
		_ = encoder.Close()
		replaced.WriteByte('"')
		last = offset + marker.end
	}
	replaced.Write(body[last:])
	return replaced.Bytes(), nil
}

// fileMarkers appends the $file markers in value, a JSON object or array, by
// offsets from the start of the root value. An object with a $file member
// must be a whole marker.
func fileMarkers(value gjson.Result, markers []fileMarker) ([]fileMarker, error) {
	if value.IsObject() {
		members := 0
		var ref, encoding gjson.Result
		value.ForEach(func(key, member gjson.Result) bool {
			members++
			switch key.String() {
			case "$file":
				ref = member
			case "encoding":
				encoding = member
			}
			return true
		})
		if ref.Exists() {
			if members != 2 || ref.Type != gjson.String || ref.Str == "" || encoding.Type != gjson.String || (encoding.Str != "base64" && encoding.Str != "dataUrl") {
				return nil, errors.New(`a $file marker must be {"$file": "<client file>", "encoding": "base64" or "dataUrl"}`)
			}
			return append(markers, fileMarker{start: value.Index, end: value.Index + len(value.Raw), ref: ref.Str, encoding: encoding.Str}), nil
		}
	}
	var err error
	value.ForEach(func(_, member gjson.Result) bool {
		if member.IsObject() || member.IsArray() {
			markers, err = fileMarkers(member, markers)
		}
		return err == nil
	})
	return markers, err
}

func maxBodyBytes() int64 {
	if constant.MaxRequestBodyMB > 0 {
		return int64(constant.MaxRequestBodyMB) << 20
	}
	return 128 << 20
}

func (a *Adaptor) GetModelList() []string {
	return nil
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// bind resolves the plugin pinned for the request and its route.
func (a *Adaptor) bind(c *gin.Context, info *relaycommon.RelayInfo) error {
	value, _ := common.GetContextKey(c, constant.ContextKeyProviderPlugin)
	pinned, ok := value.(jsplugin.PinnedPlugin)
	if !ok || pinned.Plugin == nil || !pinned.Plugin.Meta.HasProviderPart() {
		return errors.New("task plugin channel has no plugin with relay routes")
	}
	a.plugin = pinned.Plugin
	path := info.RequestURLPath
	if c.Request != nil && c.Request.URL != nil {
		path = c.Request.URL.Path
	}
	route, ok := a.plugin.Meta.RelayRoute(strings.Split(path, "?")[0], info.OriginModelName)
	if !ok {
		return fmt.Errorf("plugin %s has no relay route for %s and model %s", a.plugin.Meta.Key, path, info.OriginModelName)
	}
	a.route = route
	if a.credential != nil && a.credential.Plugin != a.plugin.Meta.Key {
		return types.NewError(fmt.Errorf("channel credential belongs to plugin %s", a.credential.Plugin), types.ErrorCodeChannelInvalidKey)
	}
	a.config = a.plugin.ChannelConfigFor(info.ChannelOtherSettings.PluginConfig)
	return nil
}

// useFreshCredential refreshes a credential that expires within the request
// margin. A failed refresh keeps a credential that has not expired yet.
func (a *Adaptor) useFreshCredential(c *gin.Context, info *relaycommon.RelayInfo) error {
	if a.credential == nil {
		return nil
	}
	if a.credential.NeedsLogin {
		// Only a login restores the key, even after an administrator enabled
		// it again: disable it for the reason a login clears.
		service.DisablePluginCredentialForLogin(info.ChannelId, common.GetContextKeyString(c, constant.ContextKeyChannelName), info.ChannelIsMultiKey, common.GetContextKeyBool(c, constant.ContextKeyChannelAutoBan), info.ApiKey)
		return types.NewError(service.ErrPluginCredentialNeedsLogin, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	line, err := service.FreshPluginCredentialLine(c.Request.Context(), a.plugin, info.ChannelId, credentialIndex(info), info.ApiKey)
	if errors.Is(err, service.ErrPluginCredentialNeedsLogin) {
		// The refresh disabled the key for a new login already.
		return types.NewError(err, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if err != nil {
		return err
	}
	a.useCredentialLine(c, info, line)
	return nil
}

// useCredentialLine switches the request to a refreshed credential line, also
// for the error handling that finds the key by its line.
func (a *Adaptor) useCredentialLine(c *gin.Context, info *relaycommon.RelayInfo, line string) {
	credential, ok := jsplugin.ParseCredential(line)
	if !ok {
		return
	}
	a.credential = credential
	info.ApiKey = line
	common.SetContextKey(c, constant.ContextKeyChannelKey, line)
}

func credentialIndex(info *relaycommon.RelayInfo) int {
	if info.ChannelIsMultiKey {
		return info.ChannelMultiKeyIndex
	}
	return 0
}

func (a *Adaptor) credentialContext(info *relaycommon.RelayInfo) jsplugin.CredentialContext {
	if a.credential != nil {
		return jsplugin.CredentialContext{BaseURL: info.ChannelBaseUrl, Credential: a.credential.Data, Config: a.config}
	}
	return jsplugin.CredentialContext{BaseURL: info.ChannelBaseUrl, APIKey: info.ApiKey, Config: a.config, Token: a.token}
}

// hookContext is the ctx of the relay hooks of the request.
func (a *Adaptor) hookContext(c *gin.Context, info *relaycommon.RelayInfo) jsplugin.HookContext {
	hookCtx := jsplugin.HookContext{BaseURL: info.ChannelBaseUrl, Config: a.config, Token: a.token}
	if c != nil && c.Request != nil && c.Request.URL != nil {
		hookCtx.Path = c.Request.URL.Path
	}
	return hookCtx
}

// useToken exchanges a static key line for the token the hooks get, when the
// plugin exports exchangeKey. The plugin's error keeps its status, so the
// channel error rules apply to it; a failed exchange is a request failure.
func (a *Adaptor) useToken(c *gin.Context, info *relaycommon.RelayInfo) error {
	if a.credential != nil || !a.plugin.HasProviderHook("exchangeKey") {
		return nil
	}
	token, err := service.PluginKeyToken(c.Request.Context(), a.plugin, info.ChannelId, info.ApiKey, a.config, info.ChannelBaseUrl, info.ChannelSetting.Proxy)
	if err != nil {
		return keyExchangeError(err)
	}
	a.token = token
	return nil
}

// keyExchangeError is the relay error of a failed key exchange: the plugin's
// error with its status, 500 without one.
func keyExchangeError(err error) error {
	var upstreamErr *jsplugin.UpstreamError
	if errors.As(err, &upstreamErr) {
		return types.NewErrorWithStatusCode(upstreamErr, types.ErrorCodeBadResponseStatusCode, cmp.Or(upstreamErr.Status, http.StatusInternalServerError))
	}
	return types.NewError(err, types.ErrorCodeDoRequestFailed)
}

// canRenew reports whether a rejected request can be sent again with a
// renewed key: a credential the plugin refreshes, or a static key it
// exchanges.
func (a *Adaptor) canRenew() bool {
	if a.credential != nil {
		return a.plugin.HasProviderHook("refresh")
	}
	return a.plugin.HasProviderHook("exchangeKey")
}

// renew refreshes the request's credential, or drops its token and
// exchanges the key again, after the upstream rejected it.
func (a *Adaptor) renew(c *gin.Context, info *relaycommon.RelayInfo) error {
	if a.credential == nil {
		service.InvalidatePluginKeyToken(a.plugin, info.ChannelId, info.ApiKey, a.config, info.ChannelBaseUrl, a.token)
		if err := a.useToken(c, info); err != nil {
			logger.LogWarn(c, common.LogText("plugin key exchange after a rejection failed: plugin=%s channel_id=%d", a.plugin.Meta.Key, info.ChannelId))
			return err
		}
		return nil
	}
	line, err := service.RefreshPluginCredential(c.Request.Context(), info.ChannelId, credentialIndex(info), info.ApiKey)
	if err != nil {
		logger.LogWarn(c, common.LogText("plugin credential refresh after a rejection failed: plugin=%s channel_id=%d", a.plugin.Meta.Key, info.ChannelId))
		return err
	}
	a.useCredentialLine(c, info, line)
	return nil
}

// send relays the body over the matched route. A credential line is no API
// key, so {api_key} in header overrides is empty while the request is built.
func (a *Adaptor) send(c *gin.Context, info *relaycommon.RelayInfo, body io.Reader) (any, error) {
	if a.credential == nil {
		return a.Adaptor.DoRequestWith(a, c, info, body)
	}
	line := info.ApiKey
	info.ApiKey = ""
	defer func() { info.ApiKey = line }()
	return a.Adaptor.DoRequestWith(a, c, info, body)
}

// protectedHeader reports the headers a header.patch effect must not touch
// besides requestpatch.IsProtectedHeader: the route auth header and the
// credential's headers.
func (a *Adaptor) protectedHeader(name string) bool {
	if a.credential != nil {
		for header := range a.credential.Headers {
			if strings.EqualFold(header, name) {
				return true
			}
		}
		return false
	}
	auth := a.route.Auth
	return auth != nil && strings.TrimSpace(auth.Type) == dto.AdvancedCustomAuthTypeHeader && strings.EqualFold(strings.TrimSpace(auth.Name), name)
}

// prepare runs prepareRequest and applies its effects to the body and, when
// the request is sent, the headers: all of them or none. It returns the path
// or address the plugin sends the request to instead, if any.
func (a *Adaptor) prepare(c *gin.Context, info *relaycommon.RelayInfo, body []byte) ([]byte, jsplugin.PreparedRequest, error) {
	header := http.Header{}
	if err := a.Adaptor.SetupRequestHeader(c, &header, info); err != nil {
		return nil, jsplugin.PreparedRequest{}, err
	}
	if a.contentType != "" {
		header.Set("Content-Type", a.contentType)
	}
	business := make(map[string]string, len(header))
	for name := range header {
		if !requestpatch.IsProtectedHeader(name) && !a.protectedHeader(name) {
			business[name] = header.Get(name)
		}
	}
	upstreamPath := ""
	if requestURL, err := a.Adaptor.GetRequestURL(info); err == nil {
		if parsed, parseErr := url.Parse(requestURL); parseErr == nil {
			upstreamPath = parsed.Path
		}
	}
	prepared, err := a.plugin.CallPrepareRequest(c.Request.Context(), a.hookContext(c, info), jsplugin.PrepareInput{
		Path:         c.Request.URL.Path,
		UpstreamPath: upstreamPath,
		Model:        info.UpstreamModelName,
		Stream:       info.IsStream,
		Body:         body,
		Headers:      business,
	})
	if err != nil {
		return nil, jsplugin.PreparedRequest{}, types.NewError(err, types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if prepared.Effects == nil {
		return body, prepared, nil
	}
	effects, err := requestpatch.DecodeEffects(prepared.Effects)
	if err == nil {
		var patched []byte
		if patched, _, err = requestpatch.Apply(body, header, effects, a.protectedHeader); err == nil {
			err = relaycommon.SameBillingFields(body, patched)
			body = patched
		}
	}
	if err != nil {
		return nil, jsplugin.PreparedRequest{}, types.NewError(fmt.Errorf("plugin %s prepareRequest: %w", a.plugin.Meta.Key, err), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
	}
	for _, effect := range effects {
		if effect.Type == requestpatch.EffectHeaderPatch {
			a.headerEffects = append(a.headerEffects, effect)
		}
	}
	return body, prepared, nil
}

// rejected reports an upstream rejection of the credential: a 401, or a
// non-2xx response credentialRejected accepts. The body it reads stays
// readable for the error handling.
func (a *Adaptor) rejected(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) bool {
	if resp.StatusCode == http.StatusUnauthorized {
		return true
	}
	if (resp.StatusCode >= 200 && resp.StatusCode < 300) || !a.plugin.HasProviderHook("credentialRejected") {
		return false
	}
	prefix, err := io.ReadAll(io.LimitReader(resp.Body, jsplugin.MaxRejectedBodyBytes))
	resp.Body = readCloser{Reader: io.MultiReader(bytes.NewReader(prefix), resp.Body), Closer: resp.Body}
	if err != nil {
		return false
	}
	rejected, err := a.plugin.CallCredentialRejected(c.Request.Context(), a.hookContext(c, info), resp.StatusCode, firstValues(resp.Header), string(prefix))
	if err != nil {
		logger.LogWarn(c, common.LogText("plugin credentialRejected failed: plugin=%s channel_id=%d", a.plugin.Meta.Key, info.ChannelId))
		return false
	}
	return rejected
}

type readCloser struct {
	io.Reader
	io.Closer
}

func firstValues(header http.Header) map[string]string {
	values := make(map[string]string, len(header))
	for name := range header {
		values[name] = header.Get(name)
	}
	return values
}

// upstreamErrorResponse is the error a converter hook returned, as an
// upstream response in the OpenAI error format, so that the host's error
// handling answers the client in its protocol and the retry and channel rules
// see the status. Without its own status the error takes the upstream's, or
// 500 for a 2xx.
func upstreamErrorResponse(upstreamErr *jsplugin.UpstreamError, upstreamStatus int) *http.Response {
	statusCode := upstreamErr.Status
	if statusCode == 0 {
		statusCode = upstreamStatus
		if statusCode >= 200 && statusCode < 300 {
			statusCode = http.StatusInternalServerError
		}
	}
	relayError := map[string]any{"message": upstreamErr.Message}
	if upstreamErr.Type != "" {
		relayError["type"] = upstreamErr.Type
	}
	if upstreamErr.Code != "" {
		relayError["code"] = upstreamErr.Code
	}
	body, _ := common.Marshal(map[string]any{"error": relayError})
	return &http.Response{
		StatusCode:    statusCode,
		Status:        http.StatusText(statusCode),
		Header:        http.Header{"Content-Type": {"application/json"}},
		Body:          io.NopCloser(bytes.NewReader(body)),
		ContentLength: int64(len(body)),
	}
}

var _ channel.RequestSigner = (*Adaptor)(nil)
