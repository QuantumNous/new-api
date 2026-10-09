package controller

import (
	"context"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/balancescript"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	"github.com/QuantumNous/new-api/service"
)

// Balance scripts are a lightweight, opt-in alternative to the built-in
// per-provider balance queries: a channel operator supplies a small JS
// module (buildBalanceRequest + parseBalanceResponse) instead of code
// shipping in this repo. The host performs exactly one bounded HTTP request;
// the script never touches the network directly.
const (
	balanceScriptHTTPTimeout         = 10 * time.Second
	balanceScriptMaxRequestBodyBytes = 16 << 10
	balanceScriptMaxResponseBytes    = 256 << 10
)

// balanceScriptRequest is the strict shape a script's buildBalanceRequest
// hook must return. Extra script-supplied fields are ignored by convert().
type balanceScriptRequest struct {
	Method  string            `json:"method"`
	URL     string            `json:"url"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

// balanceScriptResponse is what parseBalanceResponse receives; Body is
// always a UTF-8 string, never raw bytes, matching the JS-facing contract.
type balanceScriptResponse struct {
	StatusCode int               `json:"statusCode"`
	Headers    map[string]string `json:"headers"`
	Body       string            `json:"body"`
}

// balanceScriptCloneJSON deep-clones a Go value into plain JSON-compatible
// structures before it crosses into the JS runtime, so no live pointers into
// channel/model state are reachable from script code.
func balanceScriptCloneJSON(value any) (any, error) {
	data, err := common.Marshal(value)
	if err != nil {
		return nil, err
	}
	var normalized any
	if err := common.Unmarshal(data, &normalized); err != nil {
		return nil, err
	}
	return normalized, nil
}

func balanceScriptConvert(value any, target any) error {
	data, err := common.Marshal(value)
	if err != nil {
		return err
	}
	return common.Unmarshal(data, target)
}

// balanceScriptCallHook creates and cancels a fresh timeout context around a
// single engine.Call, so the HTTP round trip between the two hooks never
// consumes either hook's own parse/build budget.
func balanceScriptCallHook(engine *jsplugin.Engine, exportName string, args ...any) (any, error) {
	ctx, cancel := context.WithTimeout(context.Background(), balancescript.CallTimeout)
	defer cancel()
	return engine.Call(ctx, exportName, args...)
}

// fetchScriptedBalance runs a channel's configured balance_script: compile a
// fresh, single-use Engine (no cross-channel/cross-call cache, so pooled
// runtime state and injected credentials never survive past this call),
// build the request, execute exactly one bounded HTTP request with
// redirects disabled, and parse the response into a USD float. On any
// failure the channel's stored balance is left untouched by the caller.
func fetchScriptedBalance(channel *model.Channel, source string) (channelBalanceResult, error) {
	engine, err := balancescript.Compile(source)
	if err != nil {
		return channelBalanceResult{}, err
	}

	baseURL := strings.TrimSpace(channel.GetBaseURL())
	if baseURL == "" {
		return channelBalanceResult{}, fmt.Errorf("balance_script requires a channel base URL")
	}
	key := strings.TrimSpace(channel.Key)

	channelCtx, err := balanceScriptCloneJSON(map[string]any{
		"channel": map[string]any{
			"id":      channel.Id,
			"name":    channel.Name,
			"type":    channel.Type,
			"baseUrl": baseURL,
			"apiKey":  key,
		},
		"now": time.Now().UnixMilli(),
	})
	if err != nil {
		return channelBalanceResult{}, fmt.Errorf("balance_script context construction failed")
	}

	rawRequest, err := balanceScriptCallHook(engine, balancescript.HookBuildRequest, channelCtx)
	if err != nil {
		return channelBalanceResult{}, balanceScriptSanitizeError(balancescript.HookBuildRequest, err)
	}

	var request balanceScriptRequest
	if err := balanceScriptConvert(rawRequest, &request); err != nil {
		return channelBalanceResult{}, fmt.Errorf("balance_script buildBalanceRequest returned an invalid request descriptor")
	}

	response, err := doBalanceScriptRequest(channel, baseURL, request)
	if err != nil {
		return channelBalanceResult{}, err
	}

	responseCtx, err := balanceScriptCloneJSON(response)
	if err != nil {
		return channelBalanceResult{}, fmt.Errorf("balance_script response construction failed")
	}

	rawBalance, err := balanceScriptCallHook(engine, balancescript.HookParseResponse, channelCtx, responseCtx)
	if err != nil {
		return channelBalanceResult{}, balanceScriptSanitizeError(balancescript.HookParseResponse, err)
	}

	var balance float64
	switch number := rawBalance.(type) {
	case float64:
		balance = number
	case int64:
		balance = float64(number)
	default:
		return channelBalanceResult{}, fmt.Errorf("balance_script parseBalanceResponse must return a number")
	}
	if math.IsNaN(balance) || math.IsInf(balance, 0) {
		return channelBalanceResult{}, fmt.Errorf("balance_script parseBalanceResponse must return a finite number")
	}
	if balance < 0 {
		return channelBalanceResult{}, fmt.Errorf("balance_script parseBalanceResponse must return a non-negative number")
	}

	channel.UpdateBalance(balance)
	return channelBalanceResult{Balance: balance}, nil
}

// doBalanceScriptRequest executes the single host-controlled HTTP request a
// balance script is allowed to trigger: method restricted to GET/POST, URL
// validated against the channel's own base origin with no embedded
// credentials, redirects disabled, and both request/response bodies size
// bounded.
func doBalanceScriptRequest(channel *model.Channel, baseURL string, request balanceScriptRequest) (balanceScriptResponse, error) {
	method := strings.ToUpper(strings.TrimSpace(request.Method))
	if method != http.MethodGet && method != http.MethodPost {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request method must be GET or POST")
	}

	requestURL := strings.TrimSpace(request.URL)
	parsedURL, err := url.Parse(requestURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request URL must be absolute")
	}
	if parsedURL.Scheme != "http" && parsedURL.Scheme != "https" {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request URL must use http or https")
	}
	if parsedURL.User != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request URL must not contain embedded credentials")
	}
	if err := jsplugin.ValidateRequestURL(requestURL, baseURL, nil); err != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request URL rejected: %w", err)
	}
	// ValidateRequestURL matches same-origin by host only; without this check
	// a script could downgrade an https base URL to http on the same host,
	// sending the channel's API key in cleartext.
	if parsedBaseURL, err := url.Parse(baseURL); err == nil && parsedURL.Scheme != parsedBaseURL.Scheme {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request URL rejected: scheme %q does not match the channel base URL scheme", parsedURL.Scheme)
	}

	if len(request.Body) > balanceScriptMaxRequestBodyBytes {
		return balanceScriptResponse{}, fmt.Errorf("balance_script request body exceeds %d bytes", balanceScriptMaxRequestBodyBytes)
	}

	var bodyReader io.Reader
	if request.Body != "" {
		bodyReader = strings.NewReader(request.Body)
	}

	ctx, cancel := context.WithTimeout(context.Background(), balanceScriptHTTPTimeout)
	defer cancel()
	httpRequest, err := http.NewRequestWithContext(ctx, method, requestURL, bodyReader)
	if err != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script failed to build the HTTP request")
	}
	for name, value := range request.Headers {
		httpRequest.Header.Set(name, value)
	}

	settings := channel.GetSetting()
	client, err := service.GetHttpClientWithProxySettings(settings.Proxy, settings)
	if err != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script failed to acquire an HTTP client")
	}
	// Never follow redirects: a redirect target has not been validated
	// against the channel's base origin and must not receive the API key.
	scriptClient := *client
	scriptClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }

	httpResponse, err := scriptClient.Do(httpRequest)
	if err != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script HTTP request failed")
	}
	defer httpResponse.Body.Close()
	if httpResponse.StatusCode < http.StatusOK || httpResponse.StatusCode >= http.StatusMultipleChoices {
		return balanceScriptResponse{}, fmt.Errorf("balance_script HTTP request returned status code %d", httpResponse.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(httpResponse.Body, balanceScriptMaxResponseBytes+1))
	if err != nil {
		return balanceScriptResponse{}, fmt.Errorf("balance_script failed to read the HTTP response")
	}
	if len(body) > balanceScriptMaxResponseBytes {
		return balanceScriptResponse{}, fmt.Errorf("balance_script response exceeds %d bytes", balanceScriptMaxResponseBytes)
	}

	headers := make(map[string]string, len(httpResponse.Header))
	for name := range httpResponse.Header {
		headers[name] = httpResponse.Header.Get(name)
	}

	return balanceScriptResponse{
		StatusCode: httpResponse.StatusCode,
		Headers:    headers,
		Body:       string(body),
	}, nil
}

// balanceScriptSanitizeError strips script/exception content from errors
// surfaced to callers and logs: jsplugin.HookError messages already come
// from the JS runtime (untrusted, may echo back whatever the script was fed,
// including the API key/response body), so callers must never see them.
func balanceScriptSanitizeError(hook string, _ error) error {
	return fmt.Errorf("balance_script %s failed", hook)
}
