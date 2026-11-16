package providerplugin

import (
	"bytes"
	"cmp"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/pkg/jsplugin"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
)

// MaxBalanceResponseBytes bounds a reply parseBalance reads.
const MaxBalanceResponseBytes = 1 << 20

// ManagementClient sends the channel management requests of a plugin, the
// model list fetch and the balance query. Override applies the channel's
// header overrides with the value {api_key} stands for; Send sends a request
// through the channel proxy and TLS setting.
type ManagementClient struct {
	Override func(header http.Header, apiKey string) error
	Send     func(request *http.Request) (*http.Response, error)
}

// managementAdaptor is an adaptor for the management requests of the
// channel described by info, outside any relay request.
func managementAdaptor(ctx context.Context, plugin *jsplugin.LoadedPlugin, info *relaycommon.RelayInfo) (*Adaptor, error) {
	a := &Adaptor{plugin: plugin}
	a.Init(info)
	if a.credential != nil && a.credential.Plugin != plugin.Meta.Key {
		return nil, fmt.Errorf("channel credential belongs to plugin %s", a.credential.Plugin)
	}
	a.config = plugin.ChannelConfigFor(info.ChannelOtherSettings.PluginConfig)
	if a.credential == nil && plugin.HasProviderHook("exchangeKey") {
		token, err := service.PluginKeyToken(ctx, plugin, info.ChannelId, info.ApiKey, a.config, info.ChannelBaseUrl, info.ChannelSetting.Proxy)
		if err != nil {
			return nil, err
		}
		a.token = token
	}
	return a, nil
}

// renewManagement is renew outside a relay request.
func (a *Adaptor) renewManagement(ctx context.Context, info *relaycommon.RelayInfo) error {
	if a.credential == nil {
		service.InvalidatePluginKeyToken(a.plugin, info.ChannelId, info.ApiKey, a.config, info.ChannelBaseUrl, a.token)
		token, err := service.PluginKeyToken(ctx, a.plugin, info.ChannelId, info.ApiKey, a.config, info.ChannelBaseUrl, info.ChannelSetting.Proxy)
		if err != nil {
			return err
		}
		a.token = token
		return nil
	}
	line, err := service.RefreshPluginCredential(ctx, info.ChannelId, credentialIndex(info), info.ApiKey)
	if err != nil {
		return err
	}
	credential, ok := jsplugin.ParseCredential(line)
	if !ok {
		return errors.New("refreshed key is not a plugin credential")
	}
	a.credential, info.ApiKey = credential, line
	return nil
}

// FetchModelList fetches the model list of a channel through its plugin's
// /v1/models relay route, built as a relay request on that route is: a
// credential line's headers and query stand in for the route auth, the
// channel's header overrides and signRequest apply. A route with the plugin
// converter answers in the vendor's format; convertResponse turns the reply
// into an OpenAI model list or chains the next page. A 401, or the plugin's
// error with that status, refreshes the credential or exchanges the key
// again once and sends the request again.
func FetchModelList(ctx context.Context, plugin *jsplugin.LoadedPlugin, info *relaycommon.RelayInfo, client ManagementClient) ([]byte, error) {
	a, err := managementAdaptor(ctx, plugin, info)
	if err != nil {
		return nil, err
	}
	route, ok := plugin.Meta.ModelListRoute()
	if !ok {
		return nil, fmt.Errorf("plugin %s has no %s relay route", plugin.Meta.Key, dto.AdvancedCustomModelListPath)
	}
	converted := strings.TrimSpace(route.Converter) == jsplugin.ProviderConverter
	var step jsplugin.ConvertedRequest
	var state []byte
	renewed := false
	for followUps := 0; ; {
		a.useTarget(step.Path, step.URL)
		requestURL, header, err := a.Adaptor.BuildModelListRequest(info)
		if err != nil {
			return nil, err
		}
		resp, err := a.sendManagement(ctx, info, requestURL, header, step, client)
		if err != nil {
			return nil, err
		}
		raw, err := readLimited(resp, maxBodyBytes())
		if err != nil {
			return nil, err
		}
		canRenew := a.canRenew() && !renewed
		if resp.StatusCode == http.StatusUnauthorized && canRenew {
			renewed = true
			if err = a.renewManagement(ctx, info); err != nil {
				return nil, err
			}
			continue
		}
		if !converted {
			if resp.StatusCode != http.StatusOK {
				return nil, fmt.Errorf("status code: %d", resp.StatusCode)
			}
			return raw, nil
		}
		hookCtx := jsplugin.HookContext{BaseURL: info.ChannelBaseUrl, Path: dto.AdvancedCustomModelListPath, Config: a.config, Token: a.token, State: state}
		result, upstreamErr, err := plugin.CallConvertResponse(ctx, hookCtx, resp.StatusCode, firstValues(resp.Header), raw)
		switch {
		case err == nil && upstreamErr != nil && upstreamErr.Status == http.StatusUnauthorized && canRenew:
			renewed = true
			if err = a.renewManagement(ctx, info); err != nil {
				return nil, err
			}
			continue
		case err == nil && upstreamErr != nil:
			return nil, upstreamErr
		case err == nil && result.Next != nil:
			if followUps++; followUps > MaxFollowUps {
				return nil, fmt.Errorf("plugin %s chained more than %d model list requests", plugin.Meta.Key, MaxFollowUps)
			}
			step, state = *result.Next, result.State
			if err = sleep(ctx, step.Delay); err != nil {
				return nil, err
			}
			continue
		case resp.StatusCode < 200 || resp.StatusCode >= 300:
			return nil, fmt.Errorf("status code: %d", resp.StatusCode)
		case err != nil:
			return nil, err
		}
		return result.Body, nil
	}
}

// QueryBalance queries a channel's balance with the plugin's
// buildBalanceRequest and parseBalance, which may chain more requests. A
// request's path joins the channel base URL; its url must be on the base URL
// host or a host of meta.allowedHosts, as the credential goes with it. The
// credential's headers and query, the channel's header overrides and
// signRequest apply; a 401 refreshes the credential or exchanges the key
// again once and sends the request again.
func QueryBalance(ctx context.Context, plugin *jsplugin.LoadedPlugin, info *relaycommon.RelayInfo, client ManagementClient) (jsplugin.BalanceResult, error) {
	a, err := managementAdaptor(ctx, plugin, info)
	if err != nil {
		return jsplugin.BalanceResult{}, err
	}
	step, err := plugin.CallBuildBalanceRequest(ctx, a.credentialContext(info))
	if err != nil {
		return jsplugin.BalanceResult{}, err
	}
	state := step.State
	renewed := false
	for followUps := 0; ; {
		requestURL, err := balanceURL(info.ChannelBaseUrl, step)
		if err != nil {
			return jsplugin.BalanceResult{}, err
		}
		if err = jsplugin.ValidateRequestURL(requestURL, info.ChannelBaseUrl, plugin.Meta.AllowedHosts); err != nil {
			return jsplugin.BalanceResult{}, err
		}
		resp, err := a.sendManagement(ctx, info, requestURL, http.Header{}, step, client)
		if err != nil {
			return jsplugin.BalanceResult{}, err
		}
		raw, err := readLimited(resp, MaxBalanceResponseBytes)
		if err != nil {
			return jsplugin.BalanceResult{}, err
		}
		if resp.StatusCode == http.StatusUnauthorized && a.canRenew() && !renewed {
			renewed = true
			if err = a.renewManagement(ctx, info); err != nil {
				return jsplugin.BalanceResult{}, err
			}
			continue
		}
		parsed, err := plugin.CallParseBalance(ctx, a.credentialContext(info), state, jsplugin.UpstreamResponse{Status: resp.StatusCode, Headers: firstValues(resp.Header), Body: raw})
		if err != nil {
			return jsplugin.BalanceResult{}, err
		}
		if parsed.Balance != nil {
			return *parsed.Balance, nil
		}
		if followUps++; followUps > MaxFollowUps {
			return jsplugin.BalanceResult{}, fmt.Errorf("plugin %s chained more than %d balance requests", plugin.Meta.Key, MaxFollowUps)
		}
		step, state = *parsed.Next, parsed.State
		if err = sleep(ctx, step.Delay); err != nil {
			return jsplugin.BalanceResult{}, err
		}
	}
}

// balanceURL is the address of a balance request: its url, or its path on
// the channel base URL.
func balanceURL(baseURL string, step jsplugin.ConvertedRequest) (string, error) {
	if step.URL != "" {
		return step.URL, nil
	}
	if step.Path == "" {
		return "", errors.New("balance request needs a path or url")
	}
	base, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil || base.Host == "" {
		return "", errors.New("channel base URL is required for a balance request path")
	}
	path, err := url.Parse(step.Path)
	if err != nil {
		return "", err
	}
	base.Path = strings.TrimRight(base.Path, "/") + path.Path
	base.RawPath = ""
	base.RawQuery = path.RawQuery
	return base.String(), nil
}

// sendManagement sends one management request built on header: the step's
// method, headers and body, the credential's headers and query, the channel's
// header overrides and signRequest.
func (a *Adaptor) sendManagement(ctx context.Context, info *relaycommon.RelayInfo, requestURL string, header http.Header, step jsplugin.ConvertedRequest, client ManagementClient) (*http.Response, error) {
	body, contentType, err := nextRequestBody(step, nil)
	if err != nil {
		return nil, err
	}
	method := step.Method
	if method == "" {
		method = http.MethodGet
		if body != nil {
			method = http.MethodPost
		}
	}
	if body != nil {
		header.Set("Content-Type", cmp.Or(contentType, "application/json"))
	}
	if err = a.applyStepHeaders(header, step.Headers); err != nil {
		return nil, err
	}
	apiKey := info.ApiKey
	if a.credential != nil {
		apiKey = ""
		for name, value := range a.credential.Headers {
			header.Set(name, value)
		}
	}
	if err = client.Override(header, apiKey); err != nil {
		return nil, err
	}
	target, err := url.Parse(requestURL)
	if err != nil {
		return nil, err
	}
	if a.credential != nil && len(a.credential.Query) > 0 {
		query := target.Query()
		for name, value := range a.credential.Query {
			query.Set(name, value)
		}
		target.RawQuery = query.Encode()
	}
	a.bodySHA256 = bodyHash(body)
	if err = a.sign(ctx, info, method, target, header); err != nil {
		return nil, err
	}
	var reader io.Reader
	if body != nil {
		reader = bytes.NewReader(body)
	}
	request, err := http.NewRequestWithContext(ctx, method, target.String(), reader)
	if err != nil {
		return nil, err
	}
	for name, values := range header {
		for _, value := range values {
			request.Header.Add(name, value)
		}
		if strings.EqualFold(name, "Host") {
			request.Host = header.Get(name)
		}
	}
	return client.Send(request)
}

func readLimited(resp *http.Response, limit int64) ([]byte, error) {
	defer resp.Body.Close()
	raw, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(raw)) > limit {
		return nil, fmt.Errorf("upstream response exceeds %d bytes", limit)
	}
	return raw, nil
}

func sleep(ctx context.Context, delay time.Duration) error {
	if delay <= 0 {
		return nil
	}
	timer := time.NewTimer(delay)
	defer timer.Stop()
	select {
	case <-timer.C:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}
