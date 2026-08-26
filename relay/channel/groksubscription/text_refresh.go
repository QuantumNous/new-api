package groksubscription

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/relay/channel"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/gin-gonic/gin"
)

const (
	textRefreshLeaseTTLSeconds = int64(30)
	textRefreshWaitInterval    = 100 * time.Millisecond
	textRefreshMaxWait         = 2 * time.Second
	textRefreshHTTPTimeout     = 10 * time.Second
)

const grokAuthFailureResponseBody = `{"error":{"message":"grok authentication failed","type":"upstream_auth_error","code":"upstream_auth_error"}}`

// GrokTextRequestHooks keeps the text retry path testable without changing the
// production HTTP client or token endpoint. Zero values use the normal relay
// client and the existing media-preflight refresh dependencies.
type GrokTextRequestHooks struct {
	HTTPClient      *http.Client
	RefreshHTTPDoer HTTPDoer
	Now             func(context.Context) int64
	Sleep           func(context.Context, time.Duration) error
}

var grokTextRequestHooks GrokTextRequestHooks

// SetGrokTextRequestHooksForTest overrides only the text retry seams and
// returns a restore function. It is intentionally exported for package tests
// in this repository; production callers should leave the hooks at zero value.
func SetGrokTextRequestHooksForTest(hooks GrokTextRequestHooks) func() {
	previous := grokTextRequestHooks
	grokTextRequestHooks = hooks
	return func() { grokTextRequestHooks = previous }
}

func normalizeGrokTextRequestHooks(hooks GrokTextRequestHooks) GrokTextRequestHooks {
	if hooks.RefreshHTTPDoer == nil {
		hooks.RefreshHTTPDoer = mediaPreflightHooks.HTTPDoer
	}
	if hooks.Now == nil {
		hooks.Now = mediaPreflightHooks.Now
	}
	if hooks.Sleep == nil {
		hooks.Sleep = mediaPreflightHooks.Sleep
	}
	return hooks
}

type grokReplayableBody struct {
	storage common.BodyStorage
}

func newGrokReplayableBody(reader io.Reader, size int64) (*grokReplayableBody, error) {
	if reader == nil {
		return &grokReplayableBody{}, nil
	}
	maxBytes := int64(constant.MaxRequestBodyMB) * 1024 * 1024
	if maxBytes <= 0 {
		maxBytes = 128 << 20
	}
	storage, err := common.CreateBodyStorageFromReader(reader, size, maxBytes)
	if err != nil {
		return nil, fmt.Errorf("grok subscription channel: cache request body for retry: %w", err)
	}
	return &grokReplayableBody{storage: storage}, nil
}

func (b *grokReplayableBody) Reader() (io.Reader, error) {
	if b == nil || b.storage == nil {
		return nil, nil
	}
	if _, err := b.storage.Seek(0, io.SeekStart); err != nil {
		return nil, fmt.Errorf("grok subscription channel: reset request body for retry: %w", err)
	}
	return common.ReaderOnly(b.storage), nil
}

func (b *grokReplayableBody) Close() error {
	if b == nil || b.storage == nil {
		return nil
	}
	return b.storage.Close()
}

func (a *Adaptor) doTextRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	if c == nil || c.Request == nil || info == nil || info.ChannelMeta == nil {
		return nil, errors.New("grok subscription channel: invalid relay context")
	}
	replayBody, err := newGrokReplayableBody(requestBody, info.UpstreamRequestBodySize)
	if err != nil {
		return nil, err
	}
	defer replayBody.Close()
	if replayBody.storage != nil {
		info.UpstreamRequestBodySize = replayBody.storage.Size()
	}

	hooks := normalizeGrokTextRequestHooks(grokTextRequestHooks)
	request := func() (*http.Response, error) {
		body, err := replayBody.Reader()
		if err != nil {
			return nil, err
		}
		return channel.DoApiRequestWithClient(a, c, info, body, hooks.HTTPClient)
	}

	resp, err := request()
	if err != nil || resp == nil || resp.StatusCode != http.StatusUnauthorized {
		return resp, err
	}

	// The first 401 body is not returned because the request is going through a
	// refresh attempt. Drain/close it before rebuilding the request.
	closeGrokRetryResponse(resp)
	state := &AttemptState{}
	if action := DecideAction(http.StatusUnauthorized, ForbiddenUnknown, state, true); action != ActionRefreshRetryOnce {
		return nil, errors.New("grok subscription channel: unauthorized request is not replayable")
	}
	state.RefreshUsed = true

	failedKey := info.ApiKey
	cred, err := refreshGrokTextCredential(c.Request.Context(), info.ChannelId, failedKey, hooks)
	if err != nil {
		return newGrokAuthFailureResponse(resp), nil
	}
	serialized, err := cred.Serialize()
	if err != nil {
		return nil, fmt.Errorf("grok subscription channel: serialize refreshed credential: %w", err)
	}
	info.ApiKey = serialized
	info.ChannelMeta.ApiKey = serialized

	resp, err = request()
	if err != nil || resp == nil {
		return resp, err
	}
	if resp.StatusCode == http.StatusUnauthorized {
		_ = markGrokAuthStatus(info.ChannelId, model.GrokAuthStatusNeedsReauth, false, "upstream unauthorized after credential refresh")
		closeGrokRetryResponse(resp)
		return newGrokAuthFailureResponse(resp), nil
	}
	return resp, nil
}

func refreshGrokTextCredential(ctx context.Context, channelID int, failedKey string, hooks GrokTextRequestHooks) (Credential, error) {
	if ctx == nil {
		return Credential{}, errors.New("grok text refresh: context is nil")
	}
	if channelID <= 0 {
		return Credential{}, errors.New("grok text refresh: invalid channel id")
	}
	hooks = normalizeGrokTextRequestHooks(hooks)
	for waited := time.Duration(0); ; waited += textRefreshWaitInterval {
		now := hooks.Now(ctx)
		if now <= 0 {
			return Credential{}, errors.New("grok text refresh: database time unavailable")
		}
		currentKey, err := loadGrokTextChannelKey(channelID)
		if err != nil {
			return Credential{}, err
		}
		if failedKey != "" && currentKey != failedKey {
			return ParseCredential(currentKey)
		}

		owner := "grok-text-refresh:" + common.GetUUID()
		acquired, err := model.AcquireGrokRefreshLease(channelID, owner, now, textRefreshLeaseTTLSeconds)
		if err != nil {
			return Credential{}, err
		}
		if acquired {
			refreshCtx, cancel := context.WithTimeout(ctx, textRefreshHTTPTimeout)
			refresher := NewRefresher(newMediaCredentialStore(), hooks.RefreshHTTPDoer, func() int64 { return now })
			cred, err := refresher.Refresh(refreshCtx, channelID)
			cancel()
			_ = model.ReleaseGrokRefreshLease(channelID, owner)
			if err != nil {
				if errors.Is(err, ErrRefreshConflict) {
					if waited >= textRefreshMaxWait {
						return Credential{}, ErrRefreshConflict
					}
					if err := hooks.Sleep(ctx, textRefreshWaitInterval); err != nil {
						return Credential{}, err
					}
					continue
				}
				if mediaRefreshShouldMarkNeedsReauth(err) {
					_ = markGrokAuthStatus(channelID, model.GrokAuthStatusNeedsReauth, false, err.Error())
				}
				return Credential{}, err
			}
			_ = markGrokAuthStatus(channelID, model.GrokAuthStatusActive, true, "")
			return cred, nil
		}

		if waited >= textRefreshMaxWait {
			return Credential{}, ErrRefreshConflict
		}
		if err := hooks.Sleep(ctx, textRefreshWaitInterval); err != nil {
			return Credential{}, err
		}
	}
}

func loadGrokTextChannelKey(channelID int) (string, error) {
	ch, err := model.GetChannelById(channelID, true)
	if err != nil {
		return "", err
	}
	if ch == nil || ch.Type != constant.ChannelTypeGrokSubscription {
		return "", fmt.Errorf("grok text refresh: channel %d is not Grok subscription", channelID)
	}
	return ch.Key, nil
}

func closeGrokRetryResponse(resp *http.Response) {
	if resp == nil || resp.Body == nil {
		return
	}
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<20))
	_ = resp.Body.Close()
}

func newGrokAuthFailureResponse(original *http.Response) *http.Response {
	body := []byte(grokAuthFailureResponseBody)
	response := &http.Response{
		StatusCode:    http.StatusUnauthorized,
		Status:        fmt.Sprintf("%d %s", http.StatusUnauthorized, http.StatusText(http.StatusUnauthorized)),
		Proto:         "HTTP/1.1",
		ProtoMajor:    1,
		ProtoMinor:    1,
		Header:        make(http.Header),
		Body:          io.NopCloser(strings.NewReader(string(body))),
		ContentLength: int64(len(body)),
	}
	response.Header.Set("Content-Type", "application/json")
	if original != nil {
		response.Request = original.Request
	}
	return response
}
