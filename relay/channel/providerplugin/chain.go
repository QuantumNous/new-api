package providerplugin

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"strings"
	"time"

	common2 "github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// MaxFollowUps is how many requests a plugin may chain after the first one
// of a client request, a model list fetch or a balance query.
const MaxFollowUps = 32

// stepOutcome is what the response to one request of a chain led to: the
// client response, or the next request with the state it carries.
type stepOutcome struct {
	response *http.Response
	next     *jsplugin.ConvertedRequest
	state    json.RawMessage
	tools    map[string]int
}

func (o stepOutcome) close() {
	if o.response != nil && o.response.Body != nil {
		_ = o.response.Body.Close()
	}
}

// runChain sends the first request of a plugin route and every request the
// plugin chains after it, and returns the client response. A rejected
// credential or token is renewed once per client request, and the request it
// rejected is sent again.
func (a *Adaptor) runChain(c *gin.Context, info *relaycommon.RelayInfo, first jsplugin.ConvertedRequest, body []byte, contentType string, files map[string]*multipart.FileHeader) (any, error) {
	step, state := first, first.State
	renewed := false
	for followUps := 0; ; {
		resp, err := a.sendStep(c, info, step, body, contentType, followUps == 0)
		if err != nil {
			return nil, err
		}
		canRenew := a.canRenew()
		rejected := canRenew && a.rejected(c, info, resp)
		outcome, err := a.readStep(c, info, resp, step, state, followUps == 0)
		if err != nil {
			return nil, err
		}
		// The plugin's error with status 401 rejects the credential too.
		rejected = rejected || (canRenew && outcome.response != nil && outcome.response.StatusCode == http.StatusUnauthorized)
		if rejected && !renewed {
			renewed = true
			if a.renew(c, info) == nil {
				outcome.close()
				continue
			}
		}
		a.addTools(outcome.tools)
		if outcome.next == nil {
			return outcome.response, nil
		}
		if followUps++; followUps > MaxFollowUps {
			return nil, types.NewError(fmt.Errorf("plugin %s chained more than %d requests", a.plugin.Meta.Key, MaxFollowUps), types.ErrorCodeBadResponse)
		}
		step, state = *outcome.next, outcome.state
		if body, contentType, err = nextRequestBody(step, files); err != nil {
			return nil, types.NewError(fmt.Errorf("plugin %s next request: %w", a.plugin.Meta.Key, err), types.ErrorCodeBadResponse)
		}
		if err = sleep(c.Request.Context(), step.Delay); err != nil {
			return nil, err
		}
	}
}

// nextRequestBody is the body and content type of a chained request: its
// body with $file markers filled in, its form, its client file, or none.
func nextRequestBody(step jsplugin.ConvertedRequest, files map[string]*multipart.FileHeader) ([]byte, string, error) {
	if !step.HasBody() {
		return nil, "", nil
	}
	body, contentType, err := upstreamBody(step, files, false)
	if err != nil || step.Body == nil {
		return body, contentType, err
	}
	body, err = replaceFileMarkers(body, files)
	return body, contentType, err
}

// bodyHash is the hex SHA-256 of a request body, which signRequest gets.
func bodyHash(body []byte) string {
	sum := sha256.Sum256(body)
	return hex.EncodeToString(sum[:])
}

// sendStep sends one request of a plugin route as DoApiRequest does, with
// the request's own method, address and headers: the route or credential
// auth, the channel's header overrides and signRequest apply to each one.
// prepareRequest's header effects apply to the first request only.
func (a *Adaptor) sendStep(c *gin.Context, info *relaycommon.RelayInfo, step jsplugin.ConvertedRequest, body []byte, contentType string, first bool) (*http.Response, error) {
	a.useTarget(step.Path, step.URL)
	a.contentType = contentType
	if !first {
		a.headerEffects = nil
	}
	method := step.Method
	switch {
	case method != "":
	case first:
		method = c.Request.Method
	case step.HasBody():
		method = http.MethodPost
	default:
		method = http.MethodGet
	}
	a.bodySHA256 = bodyHash(body)
	// A credential line is no API key, so {api_key} in header overrides is
	// empty while the request is built.
	if a.credential != nil {
		line := info.ApiKey
		info.ApiKey = ""
		defer func() { info.ApiKey = line }()
	}
	requestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	// The request sender closes the body, so a request without one gets an
	// empty body.
	var reader io.Reader = http.NoBody
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequest(method, requestURL, reader)
	if err != nil {
		return nil, fmt.Errorf("new request failed: %w", err)
	}
	headers := req.Header
	if err = a.SetupRequestHeader(c, &headers, info); err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	if body == nil {
		req.Header.Del("Content-Type")
	}
	if err = a.applyStepHeaders(req.Header, step.Headers); err != nil {
		return nil, err
	}
	if err = channel.ApplyHeaderOverride(info, c, req); err != nil {
		return nil, err
	}
	if err = a.sign(c.Request.Context(), info, req.Method, req.URL, req.Header); err != nil {
		return nil, fmt.Errorf("sign request failed: %w", err)
	}
	resp, err := channel.DoRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

// useTarget sends the next request to path or target, or to the route's
// address when both are empty.
func (a *Adaptor) useTarget(path, target string) {
	if target != "" {
		a.Adaptor.UseUpstreamURL(target)
		return
	}
	a.Adaptor.UseUpstreamPath(path)
}

// applyStepHeaders sets the headers a hook gave a request. They cannot touch
// the route auth header, the credential's headers or the content type, which
// is the contentType member; utils headers rules reject transport headers.
func (a *Adaptor) applyStepHeaders(header http.Header, stepHeaders map[string]string) error {
	for name, value := range stepHeaders {
		if strings.EqualFold(strings.TrimSpace(name), "Content-Type") || a.protectedHeader(name) {
			return types.NewError(fmt.Errorf("plugin %s request header %q is set by the host", a.plugin.Meta.Key, name), types.ErrorCodeConvertRequestFailed, types.ErrOptionWithSkipRetry())
		}
		header.Set(name, value)
	}
	return nil
}

// readStep turns the response to one request of a chain into its outcome. A
// success response to a nativeResponse request goes to the route's handler as
// it came. Any other success response is read as a stream when the request
// asked for one, when the first request of a streaming client leaves it open,
// or when its content type is an event stream; its conversion is the client
// response. Any other response goes to convertResponse.
func (a *Adaptor) readStep(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response, step jsplugin.ConvertedRequest, state json.RawMessage, first bool) (stepOutcome, error) {
	success := resp.StatusCode >= 200 && resp.StatusCode < 300
	if success && step.NativeResponse {
		return stepOutcome{response: resp}, nil
	}
	if success && streamedResponse(resp, step, info, first) {
		converter := a.newStreamConverter(c, info, state, resp.Body, nil)
		converter.source = converter.streamSource(resp)
		response, err := converter.respond(c, resp.Header)
		return stepOutcome{response: response}, err
	}
	header := resp.Header.Clone()
	header.Del("Content-Length")
	header.Del("Content-Encoding")
	limit := maxBodyBytes()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		_ = resp.Body.Close()
		return stepOutcome{}, err
	}
	if int64(len(raw)) > limit {
		if !success {
			resp.Body = readCloser{Reader: io.MultiReader(bytes.NewReader(raw), resp.Body), Closer: resp.Body}
			return stepOutcome{response: resp}, nil
		}
		_ = resp.Body.Close()
		return stepOutcome{}, fmt.Errorf("upstream response exceeds %d bytes", limit)
	}
	_ = resp.Body.Close()
	hookCtx := a.hookContext(c, info)
	hookCtx.State = state
	converted, upstreamErr, err := a.plugin.CallConvertResponse(c.Request.Context(), hookCtx, resp.StatusCode, firstValues(resp.Header), raw)
	switch {
	case err == nil && upstreamErr != nil:
		return stepOutcome{response: upstreamErrorResponse(upstreamErr, resp.StatusCode)}, nil
	case err == nil && converted.Next != nil:
		// A chain goes on whatever the status: the plugin read the reply.
		return stepOutcome{next: converted.Next, state: converted.State, tools: converted.Tools}, nil
	case !success:
		// A failed hook, or a body made of an error response, leaves the
		// response to the host.
		resp.Body = io.NopCloser(bytes.NewReader(raw))
		return stepOutcome{response: resp}, nil
	case err != nil:
		return stepOutcome{}, err
	}
	header.Set("Content-Type", converted.ContentType)
	return stepOutcome{tools: converted.Tools, response: &http.Response{
		StatusCode:    http.StatusOK,
		Status:        http.StatusText(http.StatusOK),
		Header:        header,
		Body:          io.NopCloser(bytes.NewReader(converted.Body)),
		ContentLength: int64(len(converted.Body)),
	}}, nil
}

// streamedResponse reports whether a success response is read as a stream:
// the request's own stream choice, else the client's for the first request,
// else an event stream content type.
func streamedResponse(resp *http.Response, step jsplugin.ConvertedRequest, info *relaycommon.RelayInfo, first bool) bool {
	if step.Stream != nil {
		return *step.Stream
	}
	if first && info.IsStream {
		return true
	}
	contentType := strings.ToLower(resp.Header.Get("Content-Type"))
	return strings.HasPrefix(contentType, "text/event-stream") || strings.HasPrefix(contentType, eventStreamContentType)
}

// openWebSocket dials the upstream WebSocket session a convertRequest result
// asks for, sends its messages and converts the frames it receives. The
// handshake is a GET built like a request of the route: route or credential
// auth, header overrides and signRequest apply, through the channel proxy and
// TLS setting. A rejected handshake renews the credential or token once.
func (a *Adaptor) openWebSocket(c *gin.Context, info *relaycommon.RelayInfo, converted jsplugin.ConvertedRequest) (any, error) {
	request := converted.WebSocket
	session, err := a.dialWebSocket(c, info, request)
	var dialErr *types.NewAPIError
	if err != nil && errors.As(err, &dialErr) && dialErr.StatusCode == http.StatusUnauthorized && a.canRenew() && a.renew(c, info) == nil {
		session, err = a.dialWebSocket(c, info, request)
	}
	if err != nil {
		return nil, err
	}
	// The converter closes the session when the client leaves, the idle
	// timeout passes or the conversion ends.
	converter := a.newStreamConverter(c, info, converted.State, session, session)
	converter.source = &webSocketSource{session: session, touch: converter.touch, limit: streamLineLimit()}
	for _, message := range request.Messages {
		if err = writeWebSocketMessage(session, message); err != nil {
			_ = session.Close()
			return nil, types.NewError(fmt.Errorf("upstream WebSocket write failed: %w", err), types.ErrorCodeDoRequestFailed)
		}
	}
	return converter.respond(c, http.Header{})
}

// dialWebSocket opens the upstream session of request.
func (a *Adaptor) dialWebSocket(c *gin.Context, info *relaycommon.RelayInfo, request *jsplugin.WebSocketRequest) (*websocket.Conn, error) {
	a.useTarget(request.Path, request.URL)
	a.contentType = ""
	a.bodySHA256 = bodyHash(nil)
	if a.credential != nil {
		line := info.ApiKey
		info.ApiKey = ""
		defer func() { info.ApiKey = line }()
	}
	requestURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	target, err := url.Parse(requestURL)
	if err != nil {
		return nil, fmt.Errorf("get request url failed: %w", err)
	}
	header := http.Header{}
	if err = a.SetupRequestHeader(c, &header, info); err != nil {
		return nil, fmt.Errorf("setup request header failed: %w", err)
	}
	header.Del("Content-Type")
	if err = a.applyStepHeaders(header, request.Headers); err != nil {
		return nil, err
	}
	overrides, err := channel.ResolveHeaderOverride(info, c)
	if err != nil {
		return nil, err
	}
	for name, value := range overrides {
		header.Set(name, value)
	}
	if err = a.sign(c.Request.Context(), info, http.MethodGet, target, header); err != nil {
		return nil, fmt.Errorf("sign request failed: %w", err)
	}
	switch target.Scheme {
	case "https":
		target.Scheme = "wss"
	case "http":
		target.Scheme = "ws"
	}
	// The dialer writes these itself.
	for _, name := range []string{"Upgrade", "Connection", "Sec-Websocket-Key", "Sec-Websocket-Version", "Sec-Websocket-Extensions", "Sec-Websocket-Protocol"} {
		header.Del(name)
	}
	dialer := *websocket.DefaultDialer
	dialer.Subprotocols = request.Protocols
	dialer.HandshakeTimeout = 30 * time.Second
	if info.ChannelSetting.Proxy != "" {
		proxyURL, _, proxyErr := common2.ParseProxyURLRuntime(info.ChannelSetting.Proxy)
		if proxyErr != nil {
			return nil, proxyErr
		}
		dialer.Proxy = http.ProxyURL(proxyURL)
	}
	if info.ChannelSetting.TLSInsecureSkipVerify {
		dialer.TLSClientConfig = common2.InsecureTLSConfig
	}
	session, resp, err := dialer.DialContext(c.Request.Context(), target.String(), header)
	if err != nil {
		statusCode := http.StatusBadGateway
		if resp != nil {
			statusCode = resp.StatusCode
			if resp.Body != nil {
				_ = resp.Body.Close()
			}
		}
		return nil, types.NewErrorWithStatusCode(fmt.Errorf("plugin %s upstream WebSocket dial to %s failed: %w", a.plugin.Meta.Key, target.Host, err), types.ErrorCodeDoRequestFailed, statusCode)
	}
	return session, nil
}
