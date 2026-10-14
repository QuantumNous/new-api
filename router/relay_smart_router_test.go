package router

import (
	"bufio"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"io"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"syscall"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/dto"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/middleware"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/pkg/jsplugin"
	host "github.com/QuantumNous/new-api/pkg/smartrouterhost"
	relaychannel "github.com/QuantumNous/new-api/relay/channel"
	openaichannel "github.com/QuantumNous/new-api/relay/channel/openai"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	kitdto "github.com/QuantumNous/new-api/relaykit/dto"
	"github.com/QuantumNous/new-api/service"
	"github.com/QuantumNous/new-api/setting/model_setting"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	hosttypes "github.com/QuantumNous/new-api/types"
	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const smartRouterTestKey = "0123456789abcdef0123456789abcdef"
const smartRouterBindingA = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
const smartRouterBindingB = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"

type realSidecarFixture struct {
	url      string
	bindings []host.RegistryEntry
	client   *http.Client
}

type realSidecarDecision struct {
	RequestID        string   `json:"request_id"`
	Group            string   `json:"group"`
	Model            string   `json:"model"`
	Protocol         string   `json:"protocol"`
	SnapshotRevision string   `json:"snapshot_revision"`
	BindingIDs       []string `json:"binding_ids"`
}

type realSidecarOutcome struct {
	EventID       string              `json:"event_id"`
	PayloadSHA256 string              `json:"payload_sha256"`
	Payload       common.RawMessage   `json:"payload"`
	Outcome       host.AttemptOutcome `json:"outcome"`
}

type realSidecarState struct {
	NowMS     int64                 `json:"now_ms"`
	Decisions []realSidecarDecision `json:"decisions"`
	Outcomes  []realSidecarOutcome  `json:"outcomes"`
	Reports   []host.AttemptOutcome `json:"reports"`
	Cooldowns map[string]int64      `json:"cooldowns"`
	Health    map[string]string     `json:"health"`
}

func startRealSidecarFixture(t *testing.T) *realSidecarFixture {
	t.Helper()
	binary := os.Getenv("NEWAPI_SMART_ROUTER_TEST_FIXTURE")
	if binary == "" {
		t.Skip("build smart-router/tests/hostfixture and set NEWAPI_SMART_ROUTER_TEST_FIXTURE")
	}
	require.True(t, filepath.IsAbs(binary), "fixture binary must be an explicit absolute path")
	private := t.TempDir()
	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	t.Cleanup(cancel)
	command := exec.CommandContext(ctx, binary)
	command.Env = []string{"PATH=/usr/bin:/bin", "LANG=C", "GOMAXPROCS=2", "TMPDIR=" + private}
	command.Stderr = io.Discard
	command.WaitDelay = 2 * time.Second
	output, err := command.StdoutPipe()
	require.NoError(t, err)
	require.NoError(t, command.Start())
	done := make(chan error, 1)
	go func() { done <- command.Wait() }()
	t.Cleanup(func() {
		defer cancel()
		defer output.Close()
		_ = command.Process.Signal(syscall.SIGTERM)
		select {
		case err := <-done:
			assert.NoError(t, err, "fixture must shut down and reap normally")
		case <-time.After(3 * time.Second):
			_ = command.Process.Kill()
			select {
			case <-done:
				assert.Fail(t, "fixture needed forced termination")
			case <-time.After(3 * time.Second):
				assert.Fail(t, "fixture reap exceeded bounded wait")
			}
		}
		entries, err := os.ReadDir(private)
		assert.NoError(t, err)
		assert.Empty(t, entries, "fixture must remove its private database after closing listeners")
	})
	type readyMessage struct {
		URL      string               `json:"url"`
		Bindings []host.RegistryEntry `json:"bindings"`
	}
	ready := make(chan readyMessage, 1)
	startError := make(chan error, 1)
	go func() {
		scanner := bufio.NewScanner(output)
		scanner.Buffer(make([]byte, 4096), 64<<10)
		if !scanner.Scan() {
			startError <- errors.New("fixture did not emit bounded ready metadata")
			return
		}
		var message readyMessage
		if err := common.Unmarshal(scanner.Bytes(), &message); err != nil {
			startError <- errors.New("fixture ready metadata invalid")
			return
		}
		ready <- message
	}()
	var message readyMessage
	select {
	case message = <-ready:
	case <-startError:
		require.FailNow(t, "fixture startup failed")
	case <-time.After(5 * time.Second):
		require.FailNow(t, "fixture startup exceeded bounded wait")
	}
	require.Len(t, message.Bindings, 6)
	ids := map[string]bool{}
	for _, entry := range message.Bindings {
		require.False(t, ids[entry.BindingID], "bindings must be globally unique across protocols")
		ids[entry.BindingID] = true
		assert.Equal(t, "default", entry.Group)
		assert.Equal(t, relayFailoverModel, entry.Model)
		assert.Equal(t, entry.Protocol+"-v1", entry.ProtocolPlugin)
	}
	transport := &http.Transport{Proxy: nil, DisableKeepAlives: true, ResponseHeaderTimeout: 2 * time.Second}
	t.Cleanup(transport.CloseIdleConnections)
	fixture := &realSidecarFixture{url: message.URL, bindings: message.Bindings,
		client: &http.Client{Transport: transport, Timeout: 3 * time.Second}}
	signedClient, err := host.NewClient(host.Config{
		Enabled: true, URL: message.URL, SigningKey: []byte(smartRouterTestKey),
		Timeout: 3 * time.Second, AttemptLimit: 2, Bindings: message.Bindings,
	}, nil)
	require.NoError(t, err, "ready metadata must satisfy the literal-loopback host contract")
	snapshot, err := signedClient.Snapshot(ctx)
	require.NoError(t, err, "actual runtime snapshot must verify with the synthetic signing key")
	require.Len(t, snapshot.Routes, 3)
	seen := map[host.Protocol]bool{}
	for _, route := range snapshot.Routes {
		require.False(t, seen[route.Protocol])
		seen[route.Protocol] = true
		assert.Equal(t, "default", route.Group)
		assert.Equal(t, relayFailoverModel, route.Model)
		require.Len(t, route.Bindings, 2)
		for i, binding := range route.Bindings {
			assert.True(t, ids[binding.BindingID])
			assert.Equal(t, string(route.Protocol)+"-v1", binding.ProtocolPlugin)
			assert.EqualValues(t, 10+i*10, binding.CostMicrounits)
		}
	}
	fixture.state(t)
	return fixture
}

func (f *realSidecarFixture) exchange(t *testing.T, method, path string, value any) []byte {
	t.Helper()
	var body io.Reader
	if value != nil {
		body = strings.NewReader(smartRouterMarshal(t, value))
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, method, f.url+path, body)
	require.NoError(t, err)
	request.Header.Set("Content-Type", "application/json")
	response, err := f.client.Do(request)
	require.NoError(t, err)
	defer response.Body.Close()
	require.Equal(t, http.StatusOK, response.StatusCode)
	data, err := io.ReadAll(io.LimitReader(response.Body, (64<<10)+1))
	require.NoError(t, err)
	require.LessOrEqual(t, len(data), 64<<10)
	return data
}

func (f *realSidecarFixture) state(t *testing.T) realSidecarState {
	t.Helper()
	var state realSidecarState
	require.NoError(t, common.Unmarshal(f.exchange(t, http.MethodGet, "/fixture/state", nil), &state))
	for _, outcome := range state.Outcomes {
		digest := sha256.Sum256(outcome.Payload)
		assert.Equal(t, outcome.PayloadSHA256, fmt.Sprintf("%x", digest), "hash actual immutable stored bytes")
		var decoded host.AttemptOutcome
		require.NoError(t, common.Unmarshal(outcome.Payload, &decoded))
		assert.Equal(t, outcome.Outcome, decoded)
		assert.Equal(t, outcome.EventID, decoded.EventID)
	}
	return state
}

func configureRealSidecarHost(t *testing.T, fixture *realSidecarFixture, protocol host.Protocol) []host.RegistryEntry {
	t.Helper()
	entries := []host.RegistryEntry{}
	for _, entry := range fixture.bindings {
		if entry.Protocol == string(protocol) {
			entry.ChannelID = 7301 + len(entries)
			entries = append(entries, entry)
		}
	}
	require.Len(t, entries, 2)
	values := map[string]string{
		"NEWAPI_SMART_ROUTER_ENABLED": "true", "NEWAPI_SMART_ROUTER_URL": fixture.url,
		"NEWAPI_SMART_ROUTER_SIGNING_KEY":   smartRouterTestKey,
		"NEWAPI_SMART_ROUTER_BINDINGS":      smartRouterMarshal(t, entries),
		"NEWAPI_SMART_ROUTER_ATTEMPT_LIMIT": "2", "NEWAPI_SMART_ROUTER_TIMEOUT": "3s",
	}
	require.NoError(t, service.ConfigureSmartRouter(func(name string) string { return values[name] }))
	t.Cleanup(func() { require.NoError(t, service.ConfigureSmartRouter(func(string) string { return "" })) })
	return entries
}

func requireRealSidecarBilling(t *testing.T, user *model.User, count int, channel int) {
	t.Helper()
	require.Eventually(t, func() bool { return gopool.WorkerCount() == 1 }, 3*time.Second, time.Millisecond)
	var logs []model.Log
	require.NoError(t, model.LOG_DB.Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).Find(&logs).Error)
	require.Len(t, logs, count)
	total := 0
	for _, log := range logs {
		assert.Equal(t, channel, log.ChannelId)
		assert.Equal(t, 5, log.PromptTokens)
		assert.EqualValues(t, 3, log.CompletionTokens)
		assert.Positive(t, log.Quota)
		total += log.Quota
	}
	var stored model.User
	var token model.Token
	var storedChannel model.Channel
	require.NoError(t, model.DB.First(&stored, user.Id).Error)
	require.NoError(t, model.DB.Where("user_id = ?", user.Id).First(&token).Error)
	require.NoError(t, model.DB.First(&storedChannel, channel).Error)
	assert.Equal(t, total, user.Quota-stored.Quota, "no duplicate charge or refund after settlement")
	assert.Equal(t, total, 1_000_000-token.RemainQuota)
	assert.Equal(t, total, stored.UsedQuota)
	assert.Equal(t, total, token.UsedQuota)
	assert.EqualValues(t, total, storedChannel.UsedQuota)
	assert.Equal(t, count, stored.RequestCount)
}

func TestSmartRouterRealSidecarEndToEnd(t *testing.T) {
	require.NoError(t, i18n.Init())
	for _, protocol := range []host.Protocol{host.ProtocolChat, host.ProtocolResponses, host.ProtocolMessages} {
		for _, failover := range []bool{false, true} {
			name := string(protocol) + "/" + map[bool]string{false: "healthy", true: "429_then_success"}[failover]
			t.Run(name, func(t *testing.T) {
				fixture := startRealSidecarFixture(t)
				engine, user := setupSmartRouterHostTest(t)
				if protocol == host.ProtocolResponses {
					SetTaskPluginProtocolRouter(engine)
				}
				payload := `{"id":"chatcmpl-real-fixture","object":"chat.completion","model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`
				expectedPath := "/v1/chat/completions"
				if protocol == host.ProtocolResponses {
					payload = `{"id":"resp-real-fixture","object":"response","model":"gpt-3.5-turbo","status":"completed","output":[],"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}`
					expectedPath = "/v1/responses"
				} else if protocol == host.ProtocolMessages {
					payload = `{"id":"msg-real-fixture","type":"message","role":"assistant","model":"gpt-3.5-turbo","content":[{"type":"text","text":"ok"}],"stop_reason":"end_turn","usage":{"input_tokens":5,"output_tokens":3}}`
					expectedPath = "/v1/messages"
				}
				status, firstPayload := http.StatusOK, payload
				if failover {
					status, firstPayload = http.StatusTooManyRequests, `{"error":{"type":"rate_limit_error","message":"synthetic"}}`
				}
				first := newSmartRouterProtocolUpstream(t, protocol, status, firstPayload)
				second := newSmartRouterProtocolUpstream(t, protocol, http.StatusOK, payload)
				for i, provider := range []*failoverUpstream{first, second} {
					channel := addRelayFailoverChannel(t, 7301+i, int64(30-i*10), provider)
					if protocol == host.ProtocolMessages {
						require.NoError(t, model.DB.Model(&channel).Update("type", constant.ChannelTypeAnthropic).Error)
					}
				}
				initializeRelayFailoverChannels()
				entries := configureRealSidecarHost(t, fixture, protocol)
				response := performSmartRouterProtocolRequest(t, engine, protocol)
				require.Equal(t, http.StatusOK, response.Code)
				assert.Equal(t, 1, first.callCount())
				state := fixture.state(t)
				require.Len(t, state.Decisions, 1)
				decision := state.Decisions[0]
				assert.Equal(t, []string{entries[0].BindingID, entries[1].BindingID}, decision.BindingIDs)
				assert.Equal(t, "default", decision.Group)
				assert.Equal(t, relayFailoverModel, decision.Model)
				assert.Equal(t, string(protocol), decision.Protocol)
				assert.NotEmpty(t, decision.SnapshotRevision)
				count, channel := 1, 7301
				if failover {
					count, channel = 2, 7302
				}
				require.Len(t, state.Outcomes, count)
				require.Len(t, state.Reports, count, "one report per actual invocation")
				for i, outcome := range state.Outcomes {
					assert.Equal(t, decision.RequestID, outcome.Outcome.RequestID)
					assert.Equal(t, protocol, outcome.Outcome.Protocol)
					assert.Equal(t, entries[i].BindingID, outcome.Outcome.BindingID)
					assert.Equal(t, decision.RequestID+"-attempt-"+strconv.Itoa(i+1), outcome.EventID)
					assert.Equal(t, state.Reports[i], outcome.Outcome)
				}
				assert.Equal(t, host.OutcomeSuccess, state.Outcomes[count-1].Outcome.Outcome)
				paths, _ := first.requestSnapshot()
				assert.Equal(t, []string{expectedPath}, paths)
				if !failover {
					assert.Zero(t, second.callCount())
					assert.Zero(t, state.Cooldowns[entries[0].BindingID])
					requireRealSidecarBilling(t, user, 1, channel)
					return
				}
				assert.Equal(t, host.OutcomeRateLimited429, state.Outcomes[0].Outcome.Outcome)
				assert.Greater(t, state.Cooldowns[entries[0].BindingID], state.NowMS)
				assert.Equal(t, "degraded", state.Health[entries[0].BindingID])
				assert.Equal(t, 1, second.callCount())
				requireRealSidecarBilling(t, user, 1, channel)
				require.Equal(t, http.StatusOK, performSmartRouterProtocolRequest(t, engine, protocol).Code)
				next := fixture.state(t)
				require.Len(t, next.Decisions, 2)
				require.Len(t, next.Outcomes, 3)
				require.Len(t, next.Reports, 3)
				assert.Equal(t, state.Outcomes, next.Outcomes[:2], "later outcomes never mutate prior persisted events")
				assert.Equal(t, []string{entries[1].BindingID}, next.Decisions[1].BindingIDs)
				assert.NotEqual(t, decision.RequestID, next.Decisions[1].RequestID)
				assert.Equal(t, next.Decisions[1].RequestID, next.Outcomes[2].Outcome.RequestID)
				assert.Equal(t, host.OutcomeSuccess, next.Outcomes[2].Outcome.Outcome)
				assert.Equal(t, entries[1].BindingID, next.Outcomes[2].Outcome.BindingID)
				assert.Equal(t, state.Cooldowns[entries[0].BindingID], next.Cooldowns[entries[0].BindingID])
				assert.Equal(t, 1, first.callCount())
				assert.Equal(t, 2, second.callCount())
				paths, _ = second.requestSnapshot()
				assert.Equal(t, []string{expectedPath, expectedPath}, paths)
				requireRealSidecarBilling(t, user, 2, channel)
			})
		}
	}
	for _, mode := range []string{"terminal_401", "provider_write_unknown", "expired", "report_rejected", "report_unknown_before", "report_unknown_after"} {
		t.Run(mode, func(t *testing.T) {
			fixture := startRealSidecarFixture(t)
			engine, user := setupSmartRouterHostTest(t)
			first := newFailoverUpstream(t, "synthetic-primary", http.StatusOK)
			if mode == "terminal_401" {
				first.setStatus(http.StatusUnauthorized)
			} else if mode == "provider_write_unknown" {
				first.mu.Lock()
				first.disconnect = true
				first.mu.Unlock()
			}
			second := newFailoverUpstream(t, "synthetic-backup", http.StatusOK)
			addRelayFailoverChannel(t, 7301, 30, first)
			addRelayFailoverChannel(t, 7302, 20, second)
			initializeRelayFailoverChannels()
			entries := configureRealSidecarHost(t, fixture, host.ProtocolChat)
			control := map[string]any{"report_mode": "normal", "clock_offset_ms": 0}
			if mode == "expired" {
				control["clock_offset_ms"] = -120_000
			} else if strings.HasPrefix(mode, "report_") {
				control["report_mode"] = strings.TrimPrefix(mode, "report_")
			}
			fixture.exchange(t, http.MethodPost, "/fixture/control", control)
			response := performRelayFailoverRequest(t, engine)
			state := fixture.state(t)
			require.Len(t, state.Decisions, 1, "even expired replies originate from a real persisted runtime decision")
			assert.Zero(t, second.callCount())
			if mode == "expired" {
				assert.GreaterOrEqual(t, response.Code, 400)
				assert.Zero(t, first.callCount())
				assert.Empty(t, state.Outcomes)
				assert.Empty(t, state.Reports)
				requireRelayRefunded(t, user.Id)
				return
			}
			assert.Equal(t, 1, first.callCount())
			require.Len(t, state.Reports, 1, "rejected and unknown outcome reports are never replayed")
			report := state.Reports[0]
			assert.Equal(t, state.Decisions[0].RequestID, report.RequestID)
			assert.Equal(t, entries[0].BindingID, report.BindingID)
			if mode == "terminal_401" || mode == "provider_write_unknown" {
				require.Len(t, state.Outcomes, 1)
				expected := host.OutcomeAuth401
				if mode == "terminal_401" {
					assert.Equal(t, http.StatusUnauthorized, response.Code)
					assert.Equal(t, "unhealthy", state.Health[entries[0].BindingID])
					assert.Greater(t, state.Cooldowns[entries[0].BindingID], state.NowMS)
				} else {
					expected = host.OutcomeWriteUnknown
					assert.GreaterOrEqual(t, response.Code, 400)
					_, bodies := first.requestSnapshot()
					require.Len(t, bodies, 1)
					assert.Contains(t, string(bodies[0]), `"content":"ping"`, "provider fully reads POST before disconnecting")
				}
				assert.Equal(t, expected, report.Outcome)
				assert.Equal(t, report, state.Outcomes[0].Outcome)
				requireRelayRefunded(t, user.Id)
				return
			}
			require.Equal(t, http.StatusOK, response.Code)
			assert.Equal(t, host.OutcomeSuccess, report.Outcome)
			if mode == "report_unknown_after" {
				require.Len(t, state.Outcomes, 1, "lost acknowledgement after real persistence")
				assert.Equal(t, report, state.Outcomes[0].Outcome)
			} else {
				assert.Empty(t, state.Outcomes, "rejected write or unknown-before-write is not a persisted outcome")
			}
			requireRealSidecarBilling(t, user, 1, 7301)
			next := fixture.state(t)
			assert.Equal(t, state.Decisions, next.Decisions)
			assert.Equal(t, state.Outcomes, next.Outcomes)
			assert.Equal(t, state.Reports, next.Reports, "inspection cannot retry a report")
		})
	}
}

func setupSmartRouterHostTest(t *testing.T) (*gin.Engine, *model.User) {
	t.Helper()
	engine, user := setupRelayFailoverTest(t, true)
	common.AutomaticDisableChannelEnabled = false
	// Notification cleanup owns one permanent worker; only short fixture work drains.
	_, err := service.CheckNotificationLimit(user.Id, "smart-router-fixture")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.Eventually(t, func() bool { return gopool.WorkerCount() == 1 }, 3*time.Second, time.Millisecond,
			"finish async quota and metrics work before restoring fixture globals")
	})
	return engine, user
}

type smartRouterHostSidecar struct {
	mu         sync.Mutex
	server     *httptest.Server
	order      []string
	routes     []host.RouteRequest
	outcomes   []host.AttemptOutcome
	reportFail bool
}

func (s *smartRouterHostSidecar) routeSnapshot() []host.RouteRequest {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.routes)
}

func (s *smartRouterHostSidecar) outcomeSnapshot() []host.AttemptOutcome {
	s.mu.Lock()
	defer s.mu.Unlock()
	return slices.Clone(s.outcomes)
}

func newSmartRouterHostSidecar(t *testing.T, order ...string) *smartRouterHostSidecar {
	t.Helper()
	sidecar := &smartRouterHostSidecar{order: order}
	sidecar.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sidecar.mu.Lock()
		defer sidecar.mu.Unlock()
		switch r.URL.Path {
		case "/v1/route":
			var request host.RouteRequest
			if common.DecodeJson(r.Body, &request) != nil {
				http.Error(w, "fixture request invalid", http.StatusBadRequest)
				return
			}
			sidecar.routes = append(sidecar.routes, request)
			response := host.RouteResponse{
				Kind: "route_response", SchemaVersion: 1, RequestID: request.RequestID,
				SnapshotRevision: "host-fixture", ExpiresAt: time.Now().Add(time.Minute).UnixMilli(),
			}
			for i, id := range sidecar.order[:min(len(sidecar.order), request.AttemptLimit)] {
				response.Bindings = append(response.Bindings, host.Binding{BindingID: id, ProtocolPlugin: string(request.Protocol) + "-v1", Rank: i + 1})
			}
			payload, err := host.CanonicalPayload(response)
			if err != nil {
				http.Error(w, "fixture signing failed", http.StatusInternalServerError)
				return
			}
			mac := hmac.New(sha256.New, []byte(smartRouterTestKey))
			_, _ = mac.Write(payload)
			response.Signature = base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
			wire, err := common.Marshal(response)
			if err != nil {
				http.Error(w, "fixture encoding failed", http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_, _ = w.Write(wire)
		case "/v1/outcomes":
			var outcome host.AttemptOutcome
			if common.DecodeJson(r.Body, &outcome) != nil {
				http.Error(w, "fixture outcome invalid", http.StatusBadRequest)
				return
			}
			sidecar.outcomes = append(sidecar.outcomes, outcome)
			if sidecar.reportFail {
				conn, _, err := w.(http.Hijacker).Hijack()
				if err == nil {
					_ = conn.Close()
				}
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(sidecar.server.Close)
	return sidecar
}

func configureSmartRouterHost(t *testing.T, sidecar *smartRouterHostSidecar, protocol host.Protocol, channels ...int) {
	configureSmartRouterHostLimit(t, sidecar, protocol, 2, channels...)
}

func configureSmartRouterHostLimit(t *testing.T, sidecar *smartRouterHostSidecar, protocol host.Protocol, limit int, channels ...int) {
	t.Helper()
	entries := make([]host.RegistryEntry, len(channels))
	for i, id := range channels {
		binding := smartRouterBindingA
		if i == 1 {
			binding = smartRouterBindingB
		} else if i > 1 {
			binding = "bnd_" + strings.Repeat(string(rune('A'+i)), 24)
		}
		entries[i] = host.RegistryEntry{BindingID: binding, ChannelID: id, Group: "default", Model: relayFailoverModel, Protocol: string(protocol), ProtocolPlugin: string(protocol) + "-v1"}
	}
	values := map[string]string{
		"NEWAPI_SMART_ROUTER_ENABLED": "true", "NEWAPI_SMART_ROUTER_URL": sidecar.server.URL,
		"NEWAPI_SMART_ROUTER_SIGNING_KEY":   smartRouterTestKey,
		"NEWAPI_SMART_ROUTER_BINDINGS":      smartRouterMarshal(t, entries),
		"NEWAPI_SMART_ROUTER_ATTEMPT_LIMIT": strconv.Itoa(limit),
	}
	require.NoError(t, service.ConfigureSmartRouter(func(name string) string { return values[name] }))
	t.Cleanup(func() { require.NoError(t, service.ConfigureSmartRouter(func(string) string { return "" })) })
}

func TestSmartRouterHostSelection(t *testing.T) {
	engine, user := setupSmartRouterHostTest(t)
	first := newFailoverUpstream(t, "legacy-first", http.StatusOK)
	second := newFailoverUpstream(t, "signed-second", http.StatusOK)
	addRelayFailoverChannel(t, 7101, 30, first)
	addRelayFailoverChannel(t, 7102, 20, second)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingB)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7101, 7102)

	response := performRelayFailoverRequest(t, engine)

	require.Equal(t, http.StatusOK, response.Code)
	log, _ := latestConsumeLog(t, user.Id)
	assert.Equal(t, 7102, log.ChannelId, "the signed route must choose the second host channel before billing")
	assert.Zero(t, first.callCount())
	assert.Equal(t, 1, second.callCount())
	assert.Len(t, sidecar.routeSnapshot(), 1)
}

func newSmartRouterProtocolUpstream(t *testing.T, protocol host.Protocol, status int, payload string) *failoverUpstream {
	t.Helper()
	upstream := &failoverUpstream{name: string(protocol), statusCode: status}
	upstream.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		if !assert.NoError(t, err) {
			return
		}
		upstream.mu.Lock()
		upstream.calls++
		upstream.paths = append(upstream.paths, r.URL.Path)
		upstream.bodies = append(upstream.bodies, body)
		upstream.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		if strings.HasPrefix(payload, "data:") {
			w.Header().Set("Content-Type", "text/event-stream")
		}
		w.WriteHeader(status)
		_, _ = io.WriteString(w, payload)
	}))
	t.Cleanup(upstream.server.Close)
	return upstream
}

func performSmartRouterProtocolRequest(t *testing.T, engine *gin.Engine, protocol host.Protocol, stream ...bool) *httptest.ResponseRecorder {
	t.Helper()
	path, body := "/v1/chat/completions", `{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"ping"}]}`
	switch protocol {
	case host.ProtocolResponses:
		path, body = "/v1/responses", `{"model":"gpt-3.5-turbo","input":"ping"}`
	case host.ProtocolMessages:
		path, body = "/v1/messages", `{"model":"gpt-3.5-turbo","max_tokens":16,"messages":[{"role":"user","content":"ping"}]}`
	}
	if len(stream) > 0 && stream[0] {
		body = strings.TrimSuffix(body, "}") + `,"stream":true}`
	}
	request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	request.Header.Set("Authorization", "Bearer harelaytoken")
	request.Header.Set("x-api-key", "harelaytoken")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	engine.ServeHTTP(response, request)
	return response
}

func TestSmartRouterHostAttempts(t *testing.T) {
	for _, protocol := range []host.Protocol{host.ProtocolChat, host.ProtocolResponses, host.ProtocolMessages} {
		t.Run(string(protocol), func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			if protocol == host.ProtocolResponses {
				SetTaskPluginProtocolRouter(engine)
			}
			payload := `{"id":"chatcmpl-fixture","object":"chat.completion","model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`
			if protocol == host.ProtocolResponses {
				payload = `{"id":"resp-fixture","object":"response","model":"gpt-3.5-turbo","status":"completed","output":[],"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}`
			}
			upstream := newSmartRouterProtocolUpstream(t, protocol, 200, payload)
			addRelayFailoverChannel(t, 7111, 30, upstream)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
			configureSmartRouterHost(t, sidecar, protocol, 7111)

			response := performSmartRouterProtocolRequest(t, engine, protocol)

			require.Equal(t, http.StatusOK, response.Code)
			assert.Equal(t, 1, upstream.callCount())
			assert.Len(t, sidecar.routeSnapshot(), 1)
			require.Len(t, sidecar.outcomeSnapshot(), 1, "every actual invocation must produce one outcome")
			assert.Equal(t, host.OutcomeSuccess, sidecar.outcomeSnapshot()[0].Outcome)
			assert.Equal(t, protocol, sidecar.outcomeSnapshot()[0].Protocol)
			assert.Equal(t, sidecar.routeSnapshot()[0].RequestID, sidecar.outcomeSnapshot()[0].RequestID)
			assert.LessOrEqual(t, len(sidecar.outcomeSnapshot()[0].EventID), 128)
		})
	}
}

func TestSmartRouterUnknownWriteStops(t *testing.T) {
	engine, user := setupSmartRouterHostTest(t)
	trace := &failoverCallTrace{}
	first := newDisconnectingFailoverUpstream(t, "unknown", trace)
	second := newFailoverUpstream(t, "forbidden-backup", http.StatusOK)
	addRelayFailoverChannel(t, 7121, 30, first)
	addRelayFailoverChannel(t, 7122, 20, second)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7121, 7122)

	response := performRelayFailoverRequest(t, engine)

	assert.GreaterOrEqual(t, response.Code, 400)
	assert.Equal(t, 1, first.callCount(), "provider consumes the full request before disconnect")
	assert.Zero(t, second.callCount())
	_, bodies := first.requestSnapshot()
	require.Len(t, bodies, 1)
	assert.Contains(t, string(bodies[0]), `"content":"ping"`)
	require.Len(t, sidecar.outcomeSnapshot(), 1)
	assert.Equal(t, host.OutcomeWriteUnknown, sidecar.outcomeSnapshot()[0].Outcome)
	requireRelayRefunded(t, user.Id)
}

func TestSmartRouterHostRetryPolicy(t *testing.T) {
	for _, status := range []int{401, 429, 500} {
		t.Run(http.StatusText(status), func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			first := newFailoverUpstream(t, "first", status)
			second := newFailoverUpstream(t, "backup", 200)
			addRelayFailoverChannel(t, 7131, 30, first)
			addRelayFailoverChannel(t, 7132, 20, second)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7131, 7132)

			response := performRelayFailoverRequest(t, engine)

			count, outcome := 2, host.OutcomeUpstream5xx
			if status == 401 {
				count, outcome = 1, host.OutcomeAuth401
				assert.Equal(t, 401, response.Code)
				assert.Zero(t, second.callCount())
			} else {
				assert.Equal(t, 200, response.Code)
				assert.Equal(t, 1, second.callCount())
				if status == 429 {
					outcome = host.OutcomeRateLimited429
				}
			}
			assert.Equal(t, 1, first.callCount())
			assert.Len(t, sidecar.routeSnapshot(), 1)
			require.Len(t, sidecar.outcomeSnapshot(), count)
			assert.Equal(t, outcome, sidecar.outcomeSnapshot()[0].Outcome)
			if count == 2 {
				assert.Equal(t, host.OutcomeSuccess, sidecar.outcomeSnapshot()[1].Outcome)
				assert.NotEqual(t, sidecar.outcomeSnapshot()[0].EventID, sidecar.outcomeSnapshot()[1].EventID)
			}
		})
	}
}

func TestSmartRouterReportFailurePreservesBilling(t *testing.T) {
	for _, success := range []bool{true, false} {
		t.Run(map[bool]string{true: "settled", false: "failed"}[success], func(t *testing.T) {
			engine, user := setupSmartRouterHostTest(t)
			status := 500
			if success {
				status = 200
			}
			first := newFailoverUpstream(t, "first", status)
			second := newFailoverUpstream(t, "forbidden", 200)
			addRelayFailoverChannel(t, 7141, 30, first)
			addRelayFailoverChannel(t, 7142, 20, second)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
			sidecar.mu.Lock()
			sidecar.reportFail = true
			sidecar.mu.Unlock()
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7141, 7142)
			response := performRelayFailoverRequest(t, engine)
			assert.Equal(t, status, response.Code)
			assert.Equal(t, 1, first.callCount())
			assert.Zero(t, second.callCount())
			require.Len(t, sidecar.outcomeSnapshot(), 1)
			if success {
				log, _ := latestConsumeLog(t, user.Id)
				var stored model.User
				require.NoError(t, model.DB.First(&stored, user.Id).Error)
				assert.Equal(t, log.Quota, user.Quota-stored.Quota)
				assert.Positive(t, log.Quota)
			} else {
				requireRelayRefunded(t, user.Id)
			}
		})
	}
}

type smartRouterFailingWriter struct {
	*httptest.ResponseRecorder
	err error
}

func (w *smartRouterFailingWriter) Write(body []byte) (int, error) {
	w.ResponseRecorder.WriteHeader(http.StatusOK)
	return 0, w.err
}

func (w *smartRouterFailingWriter) WriteString(body string) (int, error) {
	return w.Write([]byte(body))
}

func TestSmartRouterCommittedFailureStops(t *testing.T) {
	for _, writeError := range []error{nil, io.ErrClosedPipe} {
		t.Run(map[bool]string{true: "short_write", false: "write_error"}[writeError == nil], func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			first := newFailoverUpstream(t, "completed-but-undelivered", 200)
			second := newFailoverUpstream(t, "forbidden", 200)
			addRelayFailoverChannel(t, 7151, 30, first)
			addRelayFailoverChannel(t, 7152, 20, second)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7151, 7152)
			request := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"ping"}]}`))
			request.Header.Set("Authorization", "Bearer harelaytoken")
			request.Header.Set("Content-Type", "application/json")
			writer := &smartRouterFailingWriter{ResponseRecorder: httptest.NewRecorder(), err: writeError}

			engine.ServeHTTP(writer, request)

			assert.Equal(t, 1, first.callCount())
			assert.Zero(t, second.callCount())
			require.Len(t, sidecar.outcomeSnapshot(), 1)
			assert.Equal(t, host.OutcomeResponseCommitted, sidecar.outcomeSnapshot()[0].Outcome, "helper nil does not erase failed downstream writes")
		})
	}
}

func TestSmartRouterProtocolCompletion(t *testing.T) {
	originalTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = originalTimeout })
	for _, test := range []struct {
		name     string
		protocol host.Protocol
		stream   bool
		body     string
		outcome  host.Outcome
	}{
		{"chat_completed", host.ProtocolChat, true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"ok\"},\"finish_reason\":\"stop\"}]}\n\ndata: [DONE]\n\n", host.OutcomeSuccess},
		{"chat_truncated", host.ProtocolChat, true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"partial\"}}]}\n\n", host.OutcomeResponseCommitted},
		{"chat_failed", host.ProtocolChat, true, "data: {\"error\":{\"type\":\"upstream_error\",\"message\":\"fixture failed\"}}\n\n", host.OutcomeResponseCommitted},
		{"responses_completed", host.ProtocolResponses, true, "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp-fixture\",\"model\":\"gpt-3.5-turbo\",\"status\":\"completed\",\"output\":[]}}\n\n", host.OutcomeSuccess},
		{"responses_missing_event_type_done", host.ProtocolResponses, true, "data: {\"response\":{\"id\":\"resp-fixture\",\"model\":\"gpt-3.5-turbo\",\"status\":\"completed\",\"output\":[]}}\n\ndata: [DONE]\n\n", host.OutcomeResponseCommitted},
		{"responses_missing_event_type_eof", host.ProtocolResponses, true, "data: {\"response\":{\"id\":\"resp-fixture\",\"model\":\"gpt-3.5-turbo\",\"status\":\"completed\",\"output\":[]}}\n\n", host.OutcomeResponseCommitted},
		{"responses_completed_event_failed_status", host.ProtocolResponses, true, "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp-fixture\",\"status\":\"failed\",\"output\":[]}}\n\n", host.OutcomeResponseCommitted},
		{"responses_completed_event_missing_status", host.ProtocolResponses, true, "data: {\"type\":\"response.completed\",\"response\":{\"id\":\"resp-fixture\",\"output\":[]}}\n\n", host.OutcomeResponseCommitted},
		{"responses_incomplete_stream", host.ProtocolResponses, true, "data: {\"type\":\"response.incomplete\",\"response\":{\"id\":\"resp-fixture\",\"status\":\"incomplete\",\"output\":[]}}\n\n", host.OutcomeResponseCommitted},
		{"responses_incomplete_json", host.ProtocolResponses, false, `{"id":"resp-fixture","model":"gpt-3.5-turbo","status":"incomplete","output":[]}`, host.OutcomeResponseCommitted},
		{"responses_cancelled_json", host.ProtocolResponses, false, `{"id":"resp-fixture","model":"gpt-3.5-turbo","status":"cancelled","output":[]}`, host.OutcomeResponseCommitted},
	} {
		t.Run(test.name, func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			if test.protocol == host.ProtocolResponses {
				SetTaskPluginProtocolRouter(engine)
			}
			first := newSmartRouterProtocolUpstream(t, test.protocol, 200, test.body)
			addRelayFailoverChannel(t, 7161, 30, first)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
			configureSmartRouterHost(t, sidecar, test.protocol, 7161)

			response := performSmartRouterProtocolRequest(t, engine, test.protocol, test.stream)

			assert.Equal(t, 200, response.Code)
			assert.Equal(t, 1, first.callCount())
			require.Len(t, sidecar.outcomeSnapshot(), 1)
			assert.Equal(t, test.outcome, sidecar.outcomeSnapshot()[0].Outcome)
		})
	}
}

func TestSmartRouterConvertedResponsesOutcome(t *testing.T) {
	originalTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = originalTimeout })
	for _, protocol := range []host.Protocol{host.ProtocolChat, host.ProtocolMessages} {
		for _, mode := range []string{"json", "stream", "buffered"} {
			cases := []struct {
				name        string
				status      string
				event       string
				outcome     host.Outcome
				helperError bool
			}{
				{"completed", "completed", "response.completed", host.OutcomeSuccess, false},
				{"incomplete", "incomplete", "response.incomplete", host.OutcomeResponseCommitted, false},
				{"cancelled", "cancelled", "response.cancelled", host.OutcomeResponseCommitted, false},
				{"failed_status", "failed", "response.completed", host.OutcomeResponseCommitted, false},
				{"missing_status", "", "response.completed", host.OutcomeResponseCommitted, false},
			}
			if mode != "json" {
				cases = append(cases, []struct {
					name        string
					status      string
					event       string
					outcome     host.Outcome
					helperError bool
				}{
					{"done_completed", "completed", "response.done", host.OutcomeSuccess, false},
					{"missing_terminal", "", "", host.OutcomeResponseCommitted, false},
					{"truncated_eof", "", "", host.OutcomeResponseCommitted, false},
					{"missing_event_type_done", "completed", "", host.OutcomeResponseCommitted, false},
					{"missing_event_type_eof", "completed", "", host.OutcomeResponseCommitted, false},
					{"nonterminal_completed_status", "completed", "response.created", host.OutcomeResponseCommitted, false},
					{"incomplete_missing_status", "", "response.incomplete", host.OutcomeResponseCommitted, false},
					{"cancelled_completed_status", "completed", "response.cancelled", host.OutcomeResponseCommitted, false},
					{"failed_event", "failed", "response.failed", host.OutcomeResponseCommitted, true},
				}...)
			}
			for _, test := range cases {
				t.Run(string(protocol)+"/"+mode+"/"+test.name, func(t *testing.T) {
					var charges []int
					var usages [][2]int
					var bodies []string
					for _, enabled := range []bool{false, true} {
						t.Run(map[bool]string{false: "disabled", true: "enabled"}[enabled], func(t *testing.T) {
							engine, user := setupSmartRouterHostTest(t)
							settings := model_setting.GetGlobalSettings()
							previous := settings.ChatCompletionsToResponsesPolicy
							settings.ChatCompletionsToResponsesPolicy = model_setting.ChatCompletionsToResponsesPolicy{
								Enabled: true, AllChannels: true, ModelPatterns: []string{".*"},
							}
							t.Cleanup(func() { settings.ChatCompletionsToResponsesPolicy = previous })
							if test.helperError {
								previousRanges := operation_setting.AutomaticRetryStatusCodeRanges
								operation_setting.AutomaticRetryStatusCodeRanges = nil
								t.Cleanup(func() { operation_setting.AutomaticRetryStatusCodeRanges = previousRanges })
							}
							rawResponse := map[string]any{
								"id": "resp-fixture", "object": "response", "model": relayFailoverModel,
								"output": []any{map[string]any{
									"type": "message", "role": "assistant",
									"content": []any{map[string]any{"type": "output_text", "text": "fixture answer"}},
								}},
								"usage": map[string]int{"input_tokens": 5, "output_tokens": 3, "total_tokens": 8},
							}
							if test.status != "" {
								rawResponse["status"] = test.status
							}
							body := smartRouterMarshal(t, rawResponse)
							if mode != "json" {
								body = "data: {\"type\":\"response.created\",\"response\":{\"id\":\"resp-fixture\",\"model\":\"gpt-3.5-turbo\",\"status\":\"in_progress\"}}\n\n" +
									"data: {\"type\":\"response.output_text.delta\",\"delta\":\"fixture answer\"}\n\n"
								if test.event != "" {
									body += "data: " + smartRouterMarshal(t, map[string]any{"type": test.event, "response": rawResponse}) + "\n\n"
								} else if strings.HasPrefix(test.name, "missing_event_type_") {
									body += "data: " + smartRouterMarshal(t, map[string]any{"response": rawResponse}) + "\n\n"
								}
								if test.name != "truncated_eof" && test.name != "missing_event_type_eof" {
									body += "data: [DONE]\n\n"
								}
							}
							first := newSmartRouterProtocolUpstream(t, host.ProtocolResponses, http.StatusOK, body)
							second := newFailoverUpstream(t, "forbidden-backup", http.StatusOK)
							addRelayFailoverChannel(t, 7291, 30, first)
							addRelayFailoverChannel(t, 7292, 20, second)
							initializeRelayFailoverChannels()
							sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
							if enabled {
								configureSmartRouterHost(t, sidecar, protocol, 7291, 7292)
							}

							response := performSmartRouterProtocolRequest(t, engine, protocol, mode == "stream")

							assert.Equal(t, 1, first.callCount())
							assert.Zero(t, second.callCount())
							paths, requests := first.requestSnapshot()
							assert.Equal(t, []string{"/v1/responses"}, paths)
							require.Len(t, requests, 1)
							var sent map[string]any
							require.NoError(t, common.Unmarshal(requests[0], &sent))
							assert.Contains(t, sent, "input", "host upgrade must actually send Responses input")
							assert.NotContains(t, sent, "messages")
							if enabled {
								require.Len(t, sidecar.routeSnapshot(), 1)
								require.Len(t, sidecar.outcomeSnapshot(), 1)
								expected := test.outcome
								if test.helperError && mode == "buffered" {
									expected = host.OutcomeWriteUnknown
								}
								assert.Equal(t, expected, sidecar.outcomeSnapshot()[0].Outcome)
								assert.Equal(t, protocol, sidecar.outcomeSnapshot()[0].Protocol, "wire protocol remains the signed client tuple")
							} else {
								assert.Empty(t, sidecar.routeSnapshot())
								assert.Empty(t, sidecar.outcomeSnapshot())
							}
							if test.helperError && mode == "buffered" {
								assert.Equal(t, http.StatusInternalServerError, response.Code)
								assert.Contains(t, response.Body.String(), "responses stream error:")
								assert.Contains(t, response.Body.String(), `"type":"bad_response"`)
								requireRelayRefunded(t, user.Id)
								return
							}
							require.Equal(t, http.StatusOK, response.Code)
							assert.Contains(t, response.Body.String(), "fixture answer")
							if test.helperError {
								assert.Contains(t, response.Body.String(), "responses stream error:")
								assert.Contains(t, response.Body.String(), `"type":"bad_response"`)
								requireRelayRefunded(t, user.Id)
								return
							}
							log, _ := latestConsumeLog(t, user.Id)
							var stored model.User
							var token model.Token
							var logs int64
							require.NoError(t, model.DB.First(&stored, user.Id).Error)
							require.NoError(t, model.DB.Where("user_id = ?", user.Id).First(&token).Error)
							require.NoError(t, model.LOG_DB.Model(&model.Log{}).
								Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).Count(&logs).Error)
							assert.EqualValues(t, 1, logs)
							assert.Equal(t, log.Quota, user.Quota-stored.Quota)
							assert.Equal(t, log.Quota, 1_000_000-token.RemainQuota)
							charges = append(charges, log.Quota)
							usages = append(usages, [2]int{log.PromptTokens, log.CompletionTokens})
							bodies = append(bodies, smartRouterConversionPayload(t, response.Body.String(), mode == "stream"))
							if mode == "json" || test.name == "completed" || test.name == "done_completed" {
								assert.Equal(t, [2]int{5, 3}, usages[len(usages)-1])
							}
						})
					}
					if !test.helperError {
						require.Len(t, charges, 2)
						assert.Equal(t, charges[0], charges[1])
						assert.Equal(t, usages[0], usages[1])
						assert.Equal(t, bodies[0], bodies[1], "observer must not change converter output")
					}
				})
			}
		}
	}
}

// Strip only generated response identity/time fields from conversion parity checks.
func smartRouterConversionPayload(t *testing.T, body string, stream bool) string {
	t.Helper()
	var values []any
	if stream {
		for line := range strings.SplitSeq(body, "\n") {
			if data, ok := strings.CutPrefix(line, "data: "); ok && data != "[DONE]" {
				var value any
				require.NoError(t, common.UnmarshalJsonStr(data, &value))
				values = append(values, value)
			}
		}
	} else {
		var value any
		require.NoError(t, common.UnmarshalJsonStr(body, &value))
		values = append(values, value)
	}
	for _, value := range values {
		if object, ok := value.(map[string]any); ok {
			for _, key := range []string{"id", "created", "created_at"} {
				delete(object, key)
			}
			for _, key := range []string{"message", "response"} {
				if nested, ok := object[key].(map[string]any); ok {
					delete(nested, "id")
					delete(nested, "created_at")
				}
			}
		}
	}
	return smartRouterMarshal(t, values)
}

func TestSmartRouterResponsesViaChatObservation(t *testing.T) {
	originalTimeout := constant.StreamingTimeout
	constant.StreamingTimeout = 5
	t.Cleanup(func() { constant.StreamingTimeout = originalTimeout })
	for _, test := range []struct {
		name    string
		stream  bool
		body    string
		outcome host.Outcome
	}{
		{"completed_json", false, `{"id":"chatcmpl-fixture","model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"fixture answer"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`, host.OutcomeSuccess},
		{"length_json", false, `{"id":"chatcmpl-fixture","model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"fixture answer"},"finish_reason":"length"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`, host.OutcomeSuccess},
		{"missing_terminal_json", false, `{"id":"chatcmpl-fixture","model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"fixture answer"}}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`, host.OutcomeResponseCommitted},
		{"completed_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: [DONE]\n\n", host.OutcomeSuccess},
		{"length_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"},\"finish_reason\":\"length\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: [DONE]\n\n", host.OutcomeSuccess},
		{"missing_terminal_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"}}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: [DONE]\n\n", host.OutcomeResponseCommitted},
		{"failed_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"}}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: {\"error\":{\"type\":\"upstream_error\",\"message\":\"fixture failed\"}}\n\n", host.OutcomeResponseCommitted},
		{"failed_after_completed_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: {\"error\":{\"type\":\"upstream_error\",\"message\":\"fixture failed\"}}\n\n", host.OutcomeResponseCommitted},
		{"malformed_after_completed_stream", true, "data: {\"id\":\"chatcmpl-fixture\",\"model\":\"gpt-3.5-turbo\",\"choices\":[{\"index\":0,\"delta\":{\"content\":\"fixture answer\"},\"finish_reason\":\"stop\"}],\"usage\":{\"prompt_tokens\":5,\"completion_tokens\":3,\"total_tokens\":8}}\n\ndata: {invalid}\n\n", host.OutcomeResponseCommitted},
	} {
		t.Run(test.name, func(t *testing.T) {
			var bodies []string
			for _, enabled := range []bool{false, true} {
				t.Run(map[bool]string{false: "disabled", true: "enabled"}[enabled], func(t *testing.T) {
					_, _ = setupSmartRouterHostTest(t)
					provider := newSmartRouterProtocolUpstream(t, host.ProtocolChat, http.StatusOK, test.body)
					addRelayFailoverChannel(t, 7293, 30, provider)
					initializeRelayFailoverChannels()
					sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
					if enabled {
						configureSmartRouterHost(t, sidecar, host.ProtocolResponses, 7293)
					}
					// Reverse conversion is currently an excluded AdvancedCustom dispatch.
					// Exercise its observation boundary with real auth, selection and Do,
					// without expanding that channel's eligibility or claiming full E2E.
					engine := gin.New()
					engine.POST("/v1/responses", middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) {
						info := relaycommon.GenRelayInfoResponses(c, &kitdto.OpenAIResponsesRequest{Model: relayFailoverModel, Stream: common.GetPointer(test.stream)})
						info.InitChannelMeta(c)
						info.DisablePing = true
						require.NoError(t, service.BeginSmartRouterAttempt(c))
						request, err := http.NewRequest(http.MethodPost, provider.server.URL+"/v1/chat/completions",
							strings.NewReader(`{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"ping"}]}`))
						require.NoError(t, err)
						resp, err := relaychannel.DoRequest(c, request, info)
						require.NoError(t, err)
						handler := openaichannel.OaiChatToResponsesHandler
						if test.stream {
							handler = openaichannel.OaiChatToResponsesStreamHandler
						}
						usage, apiErr := handler(c, info, resp)
						require.Nil(t, apiErr)
						require.NotNil(t, usage)
						assert.Equal(t, 5, usage.PromptTokens)
						assert.Equal(t, 3, usage.CompletionTokens)
						assert.False(t, service.FinishSmartRouterAttempt(c, info, apiErr) && enabled, "one binding cannot retry")
					})

					response := performSmartRouterProtocolRequest(t, engine, host.ProtocolResponses, test.stream)

					require.Equal(t, http.StatusOK, response.Code)
					assert.Equal(t, 1, provider.callCount())
					paths, _ := provider.requestSnapshot()
					assert.Equal(t, []string{"/v1/chat/completions"}, paths)
					assert.Contains(t, response.Body.String(), "fixture answer")
					bodies = append(bodies, smartRouterConversionPayload(t, response.Body.String(), test.stream))
					if enabled {
						require.Len(t, sidecar.routeSnapshot(), 1)
						require.Len(t, sidecar.outcomeSnapshot(), 1)
						assert.Equal(t, test.outcome, sidecar.outcomeSnapshot()[0].Outcome)
						assert.Equal(t, host.ProtocolResponses, sidecar.outcomeSnapshot()[0].Protocol)
					} else {
						assert.Empty(t, sidecar.routeSnapshot())
						assert.Empty(t, sidecar.outcomeSnapshot())
					}
				})
			}
			require.Len(t, bodies, 2)
			assert.Equal(t, bodies[0], bodies[1])
		})
	}
}

func TestSmartRouterHiddenReplay(t *testing.T) {
	for _, enabled := range []bool{true, false} {
		t.Run(map[bool]string{true: "enabled", false: "disabled_control"}[enabled], func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			var arrivals atomic.Int32
			var reused atomic.Bool
			upstream := &failoverUpstream{name: "reused-connection"}
			var warmRemote string
			var remoteMu sync.Mutex
			upstream.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.Method == "GET" {
					remoteMu.Lock()
					warmRemote = r.RemoteAddr
					remoteMu.Unlock()
					_, _ = io.WriteString(w, "warm")
					return
				}
				body, err := io.ReadAll(r.Body)
				if !assert.NoError(t, err) {
					return
				}
				assert.Contains(t, string(body), `"content":"ping"`)
				assert.Equal(t, "synthetic-replay-key", r.Header.Get("Idempotency-Key"))
				if arrivals.Add(1) == 1 {
					remoteMu.Lock()
					reused.Store(r.RemoteAddr == warmRemote)
					remoteMu.Unlock()
					conn, _, err := w.(http.Hijacker).Hijack()
					if assert.NoError(t, err) {
						_ = conn.Close()
					}
					return
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = io.WriteString(w, `{"model":"gpt-3.5-turbo","choices":[{"index":0,"message":{"role":"assistant","content":"ok"},"finish_reason":"stop"}],"usage":{"prompt_tokens":5,"completion_tokens":3,"total_tokens":8}}`)
			}))
			t.Cleanup(upstream.server.Close)
			channel := addRelayFailoverChannel(t, 7171, 30, upstream)
			require.NoError(t, model.DB.Model(&channel).Update("header_override", `{"Idempotency-Key":"synthetic-replay-key"}`).Error)
			initializeRelayFailoverChannels()
			if enabled {
				sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
				configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7171)
			}
			client, err := service.GetHttpClientWithProxySettings("", channel.GetSetting())
			require.NoError(t, err)
			warm, err := client.Get(upstream.server.URL)
			require.NoError(t, err)
			_, err = io.Copy(io.Discard, warm.Body)
			require.NoError(t, err)
			require.NoError(t, warm.Body.Close())

			response := performRelayFailoverRequest(t, engine)

			assert.True(t, reused.Load(), "first POST must use the warmed connection")
			if enabled {
				assert.GreaterOrEqual(t, response.Code, 400)
				assert.EqualValues(t, 1, arrivals.Load(), "count actual arrivals, not observed Do calls")
			} else {
				assert.Equal(t, 200, response.Code)
				assert.EqualValues(t, 2, arrivals.Load(), "disabled control demonstrates the replay condition")
			}
		})
	}
}

func TestSmartRouterRetryDelay(t *testing.T) {
	now := time.Date(2026, 10, 14, 0, 0, 0, 0, time.UTC)
	for _, test := range []struct {
		name    string
		headers http.Header
		delay   int64
		invalid bool
	}{
		{"absent", http.Header{}, 0, false},
		{"seconds", http.Header{"Retry-After": {"2"}}, 2000, false},
		{"http_date", http.Header{"Retry-After": {now.Add(3 * time.Second).Format(http.TimeFormat)}}, 3000, false},
		{"milliseconds", http.Header{"Retry-After-Ms": {"23"}}, 23, false},
		{"consistent_both", http.Header{"Retry-After": {"2"}, "Retry-After-Ms": {"2000"}}, 2000, false},
		{"conflicting", http.Header{"Retry-After": {"2"}, "Retry-After-Ms": {"2"}}, 0, true},
		{"multiple", http.Header{"Retry-After": {"2", "3"}}, 0, true},
		{"negative", http.Header{"Retry-After": {"-1"}}, 0, true},
		{"fraction", http.Header{"Retry-After": {"1.5"}}, 0, true},
		{"malformed", http.Header{"Retry-After": {"tomorrow"}}, 0, true},
		{"empty", http.Header{"Retry-After": {""}}, 0, true},
		{"plus", http.Header{"Retry-After-Ms": {"+1"}}, 0, true},
		{"spaces", http.Header{"Retry-After-Ms": {" 1"}}, 0, true},
		{"overflow", http.Header{"Retry-After": {"999999999999999999999999"}}, 0, true},
		{"24h_seconds", http.Header{"Retry-After": {"86400"}}, host.MaximumRetryAfterMS, false},
		{"24h_ms", http.Header{"Retry-After-Ms": {"86400000"}}, host.MaximumRetryAfterMS, false},
		{"over24h_seconds", http.Header{"Retry-After": {"86401"}}, 0, true},
		{"over24h_ms", http.Header{"Retry-After-Ms": {"86400001"}}, 0, true},
		{"past_date", http.Header{"Retry-After": {now.Add(-time.Second).Format(http.TimeFormat)}}, 0, true},
		{"over24h_date", http.Header{"Retry-After": {now.Add(24*time.Hour + time.Second).Format(http.TimeFormat)}}, 0, true},
	} {
		t.Run(test.name, func(t *testing.T) {
			delay, err := host.ParseRetryAfter(test.headers, now)
			if test.invalid {
				require.Error(t, err)
				assert.Zero(t, delay)
			} else {
				require.NoError(t, err)
				assert.Equal(t, test.delay, delay)
			}
		})
	}
	t.Run("freeze_once_wait_cancel_and_expiry", func(t *testing.T) {
		for _, phase := range []string{"advance", "cancel", "expire"} {
			t.Run(phase, func(t *testing.T) {
				sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
				clock := now
				client, err := host.NewClient(smartRouterConfig(sidecar.server.URL), func() time.Time { return clock })
				require.NoError(t, err)
				request, route := smartRouterRequest(), smartRouterResponse()
				route.ExpiresAt = now.Add(10 * time.Second).UnixMilli()
				route.Bindings = append(route.Bindings, host.Binding{BindingID: smartRouterBindingB, ProtocolPlugin: "chat-v1", Rank: 2})
				entries := smartRouterRegistry()
				second := entries[0]
				second.BindingID = smartRouterBindingB
				state := host.NewState(client, request, route, append(entries, second))
				ctx, cancel := context.WithCancel(context.Background())
				defer cancel()
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil).WithContext(ctx)
				host.Install(c, state)
				require.NoError(t, state.Begin())
				require.NoError(t, state.Invoke())
				clock = clock.Add(12 * time.Millisecond)
				header := http.Header{"Retry-After": {"2"}}
				host.ObserveTransport(c, &http.Response{StatusCode: 429, Header: header}, nil)
				require.True(t, state.Finish(ctx, false, false))
				require.Len(t, sidecar.outcomeSnapshot(), 1)
				frozen := sidecar.outcomeSnapshot()[0]
				assert.EqualValues(t, 2000, frozen.RetryAfterMS)
				assert.EqualValues(t, 12, frozen.LatencyMS)
				header.Set("Retry-After", "999")
				waited := time.Duration(0)
				err = state.WaitRetry(ctx, func(ctx context.Context, delay time.Duration) error {
					waited = delay
					assert.LessOrEqual(t, delay, 10*time.Second)
					if phase == "cancel" {
						cancel()
						return ctx.Err()
					}
					clock = clock.Add(delay)
					if phase == "expire" {
						clock = now.Add(10 * time.Second)
					}
					return nil
				})
				assert.Equal(t, 2*time.Second, waited)
				switch phase {
				case "cancel":
					require.ErrorIs(t, err, context.Canceled)
				case "expire":
					require.ErrorIs(t, err, host.ErrExpired)
					require.ErrorIs(t, state.Begin(), host.ErrExpired)
				default:
					require.NoError(t, err)
					entry, err := state.Current()
					require.NoError(t, err)
					assert.Equal(t, smartRouterBindingB, entry.BindingID)
				}
				assert.False(t, state.Finish(ctx, false, false), "duplicate finish never reposts the event")
				assert.Equal(t, []host.AttemptOutcome{frozen}, sidecar.outcomeSnapshot())
			})
		}
	})
}

func TestSmartRouterRetryHeaderPolicy(t *testing.T) {
	for _, test := range []struct {
		name, value string
		retry       bool
	}{
		{"missing", "", true}, {"valid_ms", "1", true}, {"negative", "-1", false}, {"oversized", "86400001", false},
	} {
		t.Run(test.name, func(t *testing.T) {
			engine, _ := setupSmartRouterHostTest(t)
			first := &failoverUpstream{name: "rate-limited"}
			first.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				_, _ = io.Copy(io.Discard, r.Body)
				first.mu.Lock()
				first.calls++
				first.mu.Unlock()
				if test.value != "" {
					w.Header().Set("Retry-After-Ms", test.value)
				}
				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(429)
				_, _ = io.WriteString(w, `{"error":{"type":"rate_limit","message":"fixture"}}`)
			}))
			t.Cleanup(first.server.Close)
			second := newFailoverUpstream(t, "backup", 200)
			addRelayFailoverChannel(t, 7181, 30, first)
			addRelayFailoverChannel(t, 7182, 20, second)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7181, 7182)

			response := performRelayFailoverRequest(t, engine)

			assert.Equal(t, 1, first.callCount())
			if test.retry {
				assert.Equal(t, 200, response.Code)
				assert.Equal(t, 1, second.callCount())
			} else {
				assert.Equal(t, 429, response.Code)
				assert.Zero(t, second.callCount())
			}
			require.NotEmpty(t, sidecar.outcomeSnapshot())
			if test.value == "1" {
				assert.EqualValues(t, 1, sidecar.outcomeSnapshot()[0].RetryAfterMS)
			}
		})
	}
}

func TestSmartRouterScopeExclusions(t *testing.T) {
	for _, name := range []string{"pin", "origin_task", "strict", "auto", "app", "plugin", "task_filter", "worker", "websocket_get", "websocket_post", "compact", "other", "affinity"} {
		t.Run(name, func(t *testing.T) {
			_, _ = setupSmartRouterHostTest(t)
			first := newFailoverUpstream(t, "legacy", 200)
			second := newFailoverUpstream(t, "signed", 200)
			addRelayFailoverChannel(t, 7191, 30, first)
			addRelayFailoverChannel(t, 7192, 20, second)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingB)
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7191, 7192)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			common.SetContextKey(c, constant.ContextKeyUserGroup, "default")
			retry := &service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: relayFailoverModel, Retry: common.GetPointer(0)}
			constraints := service.GetChannelConstraints(c)
			switch name {
			case "pin", "origin_task":
				source := dto.PinSourceToken
				if name == "origin_task" {
					source = dto.PinSourceOriginTask
				}
				constraints.AddPin(dto.ChannelPin{ChannelId: 7191, Source: source})
			case "strict":
				service.RequestPolicy(c).SessionMode = "strict"
			case "auto":
				retry.TokenGroup = "auto"
			case "app":
				c.Set(hosttypes.AppRelaySubjectContextKey, &hosttypes.AppRelaySubject{})
			case "plugin":
				c.Set(jsplugin.ContextKeyPinnedPlugin, "synthetic-plugin")
			case "task_filter":
				constraints.AddFilter(dto.ChannelFilter{Kind: dto.FilterTaskPluginIdentity, TaskPluginKey: "synthetic-plugin"})
			case "worker":
				common.SetContextKey(c, constant.ContextKeyStreamRecoveryWorker, true)
			case "websocket_get":
				c.Request.Method = "GET"
				c.Request.URL.Path = "/v1/responses"
			case "websocket_post":
				c.Request.Header.Set("Connection", "Upgrade")
				c.Request.Header.Set("Upgrade", "websocket")
			case "compact":
				c.Request.URL.Path = "/v1/responses/compact"
			case "other":
				c.Request.URL.Path = "/v1/embeddings"
			case "affinity":
				setting := operation_setting.GetChannelAffinitySetting()
				original := *setting
				*setting = operation_setting.ChannelAffinitySetting{Enabled: true, SessionMode: "prefer", DefaultTTLSeconds: 60,
					Rules: []operation_setting.ChannelAffinityRule{{Name: "host-scope-fixture", ModelRegex: []string{".*"},
						KeySources: []operation_setting.ChannelAffinityKeySource{{Type: "request_header", Key: "X-Session"}}}}}
				t.Cleanup(func() { *setting = original })
				c.Request.Header.Set("X-Session", "task2-affinity")
				_, _ = service.GetPreferredChannelByAffinity(c, relayFailoverModel, "default")
				service.RecordChannelAffinity(c, 7191)
				t.Cleanup(func() { service.ClearCurrentChannelAffinityCache(c) })
			}
			writer := c.Writer
			channel, _, selectionErr := service.SelectChannelForRequest(c, relayFailoverModel, retry)
			if name != "task_filter" {
				require.Nil(t, selectionErr)
				require.NotNil(t, channel)
				assert.Equal(t, 7191, channel.Id, "first selection retains legacy behavior")
			}
			assert.True(t, host.Excluded(c), "exclusion must become permanent on initial selection")
			assert.Nil(t, host.StateFor(c))
			assert.Same(t, writer, c.Writer)
			// Remove the original ingress condition to prove retry cannot re-enter.
			constraints.Pins, constraints.Filters = nil, nil
			service.RequestPolicy(c).SessionMode = ""
			c.Set(hosttypes.AppRelaySubjectContextKey, nil)
			delete(c.Keys, hosttypes.AppRelaySubjectContextKey)
			delete(c.Keys, jsplugin.ContextKeyPinnedPlugin)
			common.SetContextKey(c, constant.ContextKeyStreamRecoveryWorker, false)
			c.Request.Method, c.Request.URL.Path = "POST", "/v1/chat/completions"
			c.Request.Header.Del("Connection")
			c.Request.Header.Del("Upgrade")
			retry.TokenGroup = "default"
			*retry.Retry = 1
			channel, _, err := service.CacheGetRandomSatisfiedChannel(retry)
			require.NoError(t, err)
			require.NotNil(t, channel)
			assert.Equal(t, 7192, channel.Id, "retry retains legacy priority order, without a new signed route")
			assert.Nil(t, host.StateFor(c))
			assert.Same(t, writer, c.Writer)
			assert.Empty(t, sidecar.routeSnapshot())
			assert.Empty(t, sidecar.outcomeSnapshot())
		})
	}
}

func TestSmartRouterRecoveryIngressScope(t *testing.T) {
	for _, protocol := range []host.Protocol{host.ProtocolResponses, host.ProtocolMessages} {
		for _, test := range []struct {
			name                             string
			enabled, draining, token, stream bool
			allowed, excluded                bool
		}{
			{name: "recovery_parent", enabled: true, token: true, stream: true, allowed: true, excluded: true},
			{name: "draining_parent", draining: true, token: true, stream: true, allowed: true, excluded: true},
			{name: "ordinary_nonstream", enabled: true, token: true, allowed: true},
			{name: "recovery_disabled", token: true, stream: true, allowed: true},
			{name: "model_not_allowed", enabled: true, token: true, stream: true},
			{name: "token_not_enabled", enabled: true, stream: true, allowed: true},
		} {
			t.Run(string(protocol)+"/"+test.name, func(t *testing.T) {
				_, user := setupSmartRouterHostTest(t)
				require.NoError(t, model.DB.Model(&model.Token{}).Where("user_id = ?", user.Id).
					Update("stream_recovery_enabled", test.token).Error)
				setting := operation_setting.GetStreamRecoverySetting()
				original := *setting
				*setting = operation_setting.StreamRecoverySetting{Enabled: test.enabled, AllowedModels: []string{"other-model"}}
				if test.allowed {
					setting.AllowedModels = []string{relayFailoverModel}
				}
				if test.draining {
					setting.IdentityMode = operation_setting.StreamRecoveryIdentityModeDraining
				}
				t.Cleanup(func() { *setting = original })
				first := newFailoverUpstream(t, "legacy", 200)
				second := newFailoverUpstream(t, "signed", 200)
				addRelayFailoverChannel(t, 7193, 30, first)
				addRelayFailoverChannel(t, 7194, 20, second)
				initializeRelayFailoverChannels()
				sidecar := newSmartRouterHostSidecar(t, smartRouterBindingB)
				configureSmartRouterHost(t, sidecar, protocol, 7193, 7194)
				path := "/v1/responses"
				if protocol == host.ProtocolMessages {
					path = "/v1/messages"
				}
				engine := gin.New()
				var parent *gin.Context
				engine.POST(path, middleware.TokenAuth(), middleware.Distribute(), func(c *gin.Context) {
					parent = c.Copy()
					c.Status(http.StatusNoContent)
				})

				response := performSmartRouterProtocolRequest(t, engine, protocol, test.stream)

				require.Equal(t, http.StatusNoContent, response.Code)
				require.NotNil(t, parent)
				assert.Equal(t, test.excluded, host.Excluded(parent))
				if test.excluded {
					assert.Equal(t, 7193, parent.GetInt("channel_id"))
					assert.Nil(t, host.StateFor(parent), "recovery clones must never inherit a signed route or observer state")
					assert.Empty(t, sidecar.routeSnapshot())
					common.SetContextKey(parent, constant.ContextKeyTokenStreamRecovery, false)
					retry := &service.RetryParam{Ctx: parent, TokenGroup: "default", ModelName: relayFailoverModel, Retry: common.GetPointer(1)}
					selected, _, err := service.CacheGetRandomSatisfiedChannel(retry)
					require.NoError(t, err)
					require.NotNil(t, selected)
					assert.Equal(t, 7194, selected.Id)
					assert.Empty(t, sidecar.routeSnapshot(), "recovery exclusion survives retry after parent cloning")
				} else {
					assert.Equal(t, 7194, parent.GetInt("channel_id"))
					assert.NotNil(t, host.StateFor(parent))
					assert.Len(t, sidecar.routeSnapshot(), 1)
				}
				assert.Empty(t, sidecar.outcomeSnapshot())
				assert.Zero(t, first.callCount())
				assert.Zero(t, second.callCount())
			})
		}
	}
}

func TestSmartRouterRevalidation(t *testing.T) {
	for _, phase := range []string{"before_begin", "before_send"} {
		for _, name := range []string{"disabled", "model_removed", "group_removed", "filter", "plugin", "unsupported", "stale_adaptor", "stale_model", "stale_group", "stale_protocol"} {
			t.Run(phase+"/"+name, func(t *testing.T) {
				_, _ = setupSmartRouterHostTest(t)
				upstream := newFailoverUpstream(t, "forbidden", 200)
				channel := addRelayFailoverChannel(t, 7201, 30, upstream)
				initializeRelayFailoverChannels()
				sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
				configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7201)
				c, _ := gin.CreateTestContext(httptest.NewRecorder())
				c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
				common.SetContextKey(c, constant.ContextKeyUsingGroup, "default")
				common.SetContextKey(c, constant.ContextKeyOriginalModel, relayFailoverModel)
				retry := &service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: relayFailoverModel}
				selected, _, handled, err := service.SelectSmartRouterChannel(retry)
				require.True(t, handled)
				require.NoError(t, err)
				require.Nil(t, middleware.SetupContextForSelectedChannel(c, selected, relayFailoverModel))
				if phase == "before_send" {
					require.NoError(t, service.BeginSmartRouterAttempt(c))
				}
				switch name {
				case "disabled":
					require.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusAutoDisabled).Error)
				case "model_removed":
					require.NoError(t, model.DB.Model(&channel).Update("models", "different").Error)
					require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("model", "different").Error)
				case "group_removed":
					require.NoError(t, model.DB.Model(&channel).Update("group", "different").Error)
					require.NoError(t, model.DB.Model(&model.Ability{}).Where("channel_id = ?", channel.Id).Update("group", "different").Error)
				case "filter":
					service.GetChannelConstraints(c).AddFilter(dto.ChannelFilter{Kind: dto.FilterExcludeChannelIDs, ExcludedChannelIDs: []int{channel.Id}})
				case "plugin":
					setting := channel.GetSetting()
					setting.TaskPluginKey = "synthetic-plugin"
					require.NoError(t, model.DB.Model(&channel).Update("setting", smartRouterMarshal(t, setting)).Error)
				case "unsupported":
					require.NoError(t, model.DB.Model(&channel).Update("type", constant.ChannelTypeGemini).Error)
				case "stale_adaptor":
					require.NoError(t, model.DB.Model(&channel).Update("type", constant.ChannelTypeAnthropic).Error)
				case "stale_model":
					common.SetContextKey(c, constant.ContextKeyOriginalModel, "different")
				case "stale_group":
					common.SetContextKey(c, constant.ContextKeyUsingGroup, "different")
				case "stale_protocol":
					c.Request.URL.Path = "/v1/messages"
				}
				initializeRelayFailoverChannels()
				if phase == "before_begin" {
					err = service.BeginSmartRouterAttempt(c)
				} else {
					err = service.BeforeSmartRouterSend(c)
				}
				assert.ErrorIs(t, err, host.ErrBinding)
				if err == nil {
					response, callErr := upstream.server.Client().Post(upstream.server.URL, "application/json", strings.NewReader(`{}`))
					require.NoError(t, callErr)
					require.NoError(t, response.Body.Close())
				}
				assert.Zero(t, upstream.callCount(), "stale binding must prevent forbidden provider arrivals")
				assert.False(t, host.StateFor(c).Finish(c.Request.Context(), false, false))
				assert.Empty(t, sidecar.outcomeSnapshot(), "local revalidation failure is not a provider attempt")
			})
		}
	}
}

func TestSmartRouterWaitGuards(t *testing.T) {
	for _, name := range []string{"far_future", "already_cancelled", "expired_deadline"} {
		t.Run(name, func(t *testing.T) {
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
			now := time.UnixMilli(1000)
			client, err := host.NewClient(smartRouterConfig(sidecar.server.URL), func() time.Time { return now })
			require.NoError(t, err)
			request, route := smartRouterRequest(), smartRouterResponse()
			route.ExpiresAt = int64(1<<63 - 1)
			route.Bindings = append(route.Bindings, host.Binding{BindingID: smartRouterBindingB, ProtocolPlugin: "chat-v1", Rank: 2})
			entry := smartRouterRegistry()[0]
			second := entry
			second.BindingID = smartRouterBindingB
			state := host.NewState(client, request, route, []host.RegistryEntry{entry, second})
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			host.Install(c, state)
			require.NoError(t, state.Begin())
			require.NoError(t, state.Invoke())
			host.ObserveTransport(c, &http.Response{StatusCode: 500, Header: http.Header{"Retry-After-Ms": {"1"}}}, nil)
			require.True(t, state.Finish(context.Background(), false, false))
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()
			if name == "already_cancelled" {
				cancel()
			} else if name == "expired_deadline" {
				var deadlineCancel context.CancelFunc
				ctx, deadlineCancel = context.WithDeadline(ctx, time.Unix(0, 0))
				defer deadlineCancel()
			}
			waited := false
			err = state.WaitRetry(ctx, func(ctx context.Context, delay time.Duration) error {
				waited = true
				return ctx.Err()
			})
			if name == "far_future" {
				assert.NoError(t, err, "signed far-future expiry must not overflow the deadline duration")
				assert.True(t, waited)
			} else {
				require.Error(t, err)
				assert.False(t, waited)
				assert.ErrorIs(t, state.Begin(), host.ErrBudget, "cancelled wait permanently revokes retry authorization")
			}
		})
	}
}

func TestSmartRouterAttemptCaps(t *testing.T) {
	for _, test := range []struct {
		name                        string
		plan, config, retries, want int
	}{
		{"five_hard_cap", 5, 5, 8, 5},
		{"host_budget", 5, 5, 1, 2},
		{"config_budget", 5, 3, 8, 3},
		{"plan_budget", 1, 5, 8, 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			engine, user := setupSmartRouterHostTest(t)
			original := common.RetryTimes
			common.RetryTimes = test.retries
			t.Cleanup(func() { common.RetryTimes = original })
			var providers []*failoverUpstream
			var channels []int
			var order []string
			for i := range 6 {
				upstream := newFailoverUpstream(t, "cap-"+strconv.Itoa(i), 500)
				providers = append(providers, upstream)
				addRelayFailoverChannel(t, 7211+i, int64(60-i*10), upstream)
				if i < 5 {
					channels = append(channels, 7211+i)
					order = append(order, "bnd_"+strings.Repeat(string(rune('A'+i)), 24))
				}
			}
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, order[:test.plan]...)
			configureSmartRouterHostLimit(t, sidecar, host.ProtocolChat, test.config, channels...)

			response := performRelayFailoverRequest(t, engine)

			assert.Equal(t, 500, response.Code)
			for i, upstream := range providers {
				if i < test.want {
					assert.Equal(t, 1, upstream.callCount())
				} else {
					assert.Zero(t, upstream.callCount(), "no unplanned fallback, including sixth provider")
				}
			}
			require.Len(t, sidecar.routeSnapshot(), 1)
			require.Len(t, sidecar.outcomeSnapshot(), test.want)
			for i, outcome := range sidecar.outcomeSnapshot() {
				assert.Equal(t, order[i], outcome.BindingID)
				assert.Equal(t, sidecar.routeSnapshot()[0].RequestID+"-attempt-"+strconv.Itoa(i+1), outcome.EventID)
			}
			requireRelayRefunded(t, user.Id)
		})
	}
}

func TestSmartRouterBillingParity(t *testing.T) {
	for _, failover := range []bool{false, true} {
		t.Run(map[bool]string{true: "failover", false: "healthy"}[failover], func(t *testing.T) {
			var charges, tokenCharges []int
			for _, enabled := range []bool{false, true} {
				t.Run(map[bool]string{true: "enabled", false: "disabled"}[enabled], func(t *testing.T) {
					engine, user := setupSmartRouterHostTest(t)
					status := 200
					if failover {
						status = 500
					}
					first := newFailoverUpstream(t, "first", status)
					second := newFailoverUpstream(t, "second", 200)
					addRelayFailoverChannel(t, 7221, 30, first)
					addRelayFailoverChannel(t, 7222, 20, second)
					initializeRelayFailoverChannels()
					sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
					if enabled {
						configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7221, 7222)
					}

					response := performRelayFailoverRequest(t, engine)

					require.Equal(t, 200, response.Code)
					log, _ := latestConsumeLog(t, user.Id)
					var stored model.User
					var token model.Token
					var logs int64
					require.NoError(t, model.DB.First(&stored, user.Id).Error)
					require.NoError(t, model.DB.Where("user_id = ?", user.Id).First(&token).Error)
					require.NoError(t, model.LOG_DB.Model(&model.Log{}).Where("user_id = ? AND type = ?", user.Id, model.LogTypeConsume).Count(&logs).Error)
					assert.EqualValues(t, 1, logs, "one settlement across failover")
					assert.Equal(t, log.Quota, user.Quota-stored.Quota)
					assert.Equal(t, log.Quota, 1_000_000-token.RemainQuota)
					assert.Equal(t, 5, log.PromptTokens)
					assert.Equal(t, 3, log.CompletionTokens)
					charges = append(charges, log.Quota)
					tokenCharges = append(tokenCharges, 1_000_000-token.RemainQuota)
					if !enabled {
						assert.Empty(t, sidecar.routeSnapshot())
						assert.Empty(t, sidecar.outcomeSnapshot())
					}
				})
			}
			require.Len(t, charges, 2)
			assert.Equal(t, charges[0], charges[1])
			assert.Equal(t, tokenCharges[0], tokenCharges[1])
		})
	}
}

func TestSmartRouterLocalSetupHasNoOutcome(t *testing.T) {
	engine, user := setupSmartRouterHostTest(t)
	first := newFailoverUpstream(t, "never-invoked", 200)
	channel := addRelayFailoverChannel(t, 7231, 30, first)
	setting := channel.GetSetting()
	setting.Proxy = "://synthetic-invalid-proxy"
	require.NoError(t, model.DB.Model(&channel).Update("setting", smartRouterMarshal(t, setting)).Error)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7231)

	response := performRelayFailoverRequest(t, engine)

	assert.GreaterOrEqual(t, response.Code, 400)
	assert.Zero(t, first.callCount())
	assert.Len(t, sidecar.routeSnapshot(), 1)
	assert.Empty(t, sidecar.outcomeSnapshot(), "conversion/setup rejection must not masquerade as a provider outcome")
	requireRelayRefunded(t, user.Id)
}

func TestSmartRouterWriterInterfaces(t *testing.T) {
	for _, name := range []string{"header", "body", "sse_flush", "write_string", "string_short", "zero_ttft"} {
		t.Run(name, func(t *testing.T) {
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
			now := time.UnixMilli(1000)
			client, err := host.NewClient(smartRouterConfig(sidecar.server.URL), func() time.Time { return now })
			require.NoError(t, err)
			state := host.NewState(client, smartRouterRequest(), smartRouterResponse(), smartRouterRegistry())
			recorder := httptest.NewRecorder()
			c, _ := gin.CreateTestContext(recorder)
			if name == "string_short" {
				c, _ = gin.CreateTestContext(&smartRouterFailingWriter{ResponseRecorder: recorder, err: io.ErrClosedPipe})
			}
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			base := c.Writer
			host.Install(c, state)
			unwrapper, ok := c.Writer.(interface{ Unwrap() http.ResponseWriter })
			require.True(t, ok)
			assert.Same(t, base, unwrapper.Unwrap())
			assert.Nil(t, c.Writer.Pusher(), "Pusher retains the base writer's contract")
			require.NoError(t, state.Begin())
			require.NoError(t, state.Invoke())
			host.ObserveTransport(c, &http.Response{StatusCode: 500}, nil)
			switch name {
			case "header":
				c.Writer.WriteHeader(502)
				c.Writer.WriteHeaderNow()
				assert.True(t, c.Writer.Written())
				assert.Equal(t, 502, c.Writer.Status())
			case "body":
				_, err = c.Writer.Write([]byte("failed body"))
				require.NoError(t, err)
			case "sse_flush":
				require.NoError(t, http.NewResponseController(c.Writer).Flush())
				assert.True(t, recorder.Flushed)
			case "write_string", "zero_ttft":
				_, err = c.Writer.WriteString("data: ping\n\n")
				require.NoError(t, err)
				now = now.Add(10 * time.Millisecond)
				_, err = c.Writer.WriteString("data: failed\n\n")
				require.NoError(t, err)
			case "string_short":
				n, err := c.Writer.WriteString("failed")
				assert.Zero(t, n)
				assert.ErrorIs(t, err, io.ErrClosedPipe)
			}
			assert.False(t, state.Finish(context.Background(), false, false))
			require.Len(t, sidecar.outcomeSnapshot(), 1)
			assert.Equal(t, host.OutcomeResponseCommitted, sidecar.outcomeSnapshot()[0].Outcome)
			if name == "zero_ttft" {
				assert.Zero(t, sidecar.outcomeSnapshot()[0].TTFTMS, "first-byte zero is a valid frozen measurement, not an unset sentinel")
			}
		})
	}
}

func TestSmartRouterOriginalStatus(t *testing.T) {
	engine, _ := setupSmartRouterHostTest(t)
	first := newFailoverUpstream(t, "raw-client-error", 400)
	second := newFailoverUpstream(t, "forbidden", 200)
	channel := addRelayFailoverChannel(t, 7241, 30, first)
	require.NoError(t, model.DB.Model(&channel).Update("status_code_mapping", `{"400":"500"}`).Error)
	addRelayFailoverChannel(t, 7242, 20, second)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7241, 7242)

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, 500, response.Code, "existing downstream status mapping remains unchanged")
	assert.Zero(t, second.callCount())
	require.Len(t, sidecar.outcomeSnapshot(), 1)
	assert.Equal(t, host.OutcomeClient4xx, sidecar.outcomeSnapshot()[0].Outcome, "retry uses original status, not mapped 500")
}

func TestSmartRouterReusedSelectionTuple(t *testing.T) {
	for _, name := range []string{"group", "model", "protocol", "excluded"} {
		t.Run(name, func(t *testing.T) {
			_, _ = setupSmartRouterHostTest(t)
			first := newFailoverUpstream(t, "signed", 200)
			addRelayFailoverChannel(t, 7251, 30, first)
			initializeRelayFailoverChannels()
			sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
			configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7251)
			c, _ := gin.CreateTestContext(httptest.NewRecorder())
			c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
			retry := &service.RetryParam{Ctx: c, TokenGroup: "default", ModelName: relayFailoverModel}
			channel, _, err := service.CacheGetRandomSatisfiedChannel(retry)
			require.NoError(t, err)
			require.NotNil(t, channel)
			switch name {
			case "group":
				retry.TokenGroup = "different"
			case "model":
				retry.ModelName = "different"
			case "protocol":
				c.Request.URL.Path = "/v1/messages"
			case "excluded":
				host.Exclude(c)
			}
			channel, _, err = service.CacheGetRandomSatisfiedChannel(retry)
			assert.ErrorIs(t, err, host.ErrBinding)
			assert.Nil(t, channel, "installed plan may never fall back to legacy selection")
			assert.Len(t, sidecar.routeSnapshot(), 1)
			assert.Zero(t, first.callCount())
		})
	}
}

func TestSmartRouterExpiryAtSend(t *testing.T) {
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
	now := time.UnixMilli(1000)
	client, err := host.NewClient(smartRouterConfig(sidecar.server.URL), func() time.Time { return now })
	require.NoError(t, err)
	state := host.NewState(client, smartRouterRequest(), smartRouterResponse(), smartRouterRegistry())
	require.NoError(t, state.Begin())
	now = time.UnixMilli(2000)
	assert.ErrorIs(t, state.Invoke(), host.ErrExpired, "expiry between helper begin and actual send must stop invocation")
	assert.False(t, state.Finish(context.Background(), false, false))
	assert.Empty(t, sidecar.outcomeSnapshot())
}

func TestSmartRouterStartupPlacement(t *testing.T) {
	// The baseline lacks embedded web/dist/index.html, so inspect placement
	// without fabricating assets or claiming an executable startup test.
	file, err := parser.ParseFile(token.NewFileSet(), "../main.go", nil, 0)
	require.NoError(t, err)
	var initResources *ast.FuncDecl
	for _, declaration := range file.Decls {
		if function, ok := declaration.(*ast.FuncDecl); ok && function.Name.Name == "InitResources" {
			initResources = function
		}
	}
	require.NotNil(t, initResources)
	var envPosition, loggerPosition, configurePosition token.Pos
	ast.Inspect(initResources.Body, func(node ast.Node) bool {
		call, ok := node.(*ast.CallExpr)
		if !ok {
			return true
		}
		function, ok := call.Fun.(*ast.SelectorExpr)
		if !ok {
			return true
		}
		switch function.Sel.Name {
		case "InitEnv":
			envPosition = call.Pos()
		case "SetupLogger":
			loggerPosition = call.Pos()
		case "ConfigureSmartRouter":
			configurePosition = call.Pos()
			require.Len(t, call.Args, 1)
			getenv, ok := call.Args[0].(*ast.SelectorExpr)
			require.True(t, ok)
			assert.Equal(t, "Getenv", getenv.Sel.Name)
		}
		return true
	})
	require.NotZero(t, configurePosition, "startup must install optional runtime")
	assert.Greater(t, configurePosition, envPosition)
	assert.Greater(t, configurePosition, loggerPosition)
	require.ErrorIs(t, service.ConfigureSmartRouter(func(name string) string {
		if name == "NEWAPI_SMART_ROUTER_ENABLED" {
			return "true"
		}
		return ""
	}), host.ErrConfig)
	require.NoError(t, service.ConfigureSmartRouter(func(string) string { return "" }))
}

func TestSmartRouterEmptyEligible(t *testing.T) {
	require.NoError(t, i18n.Init())
	engine, user := setupSmartRouterHostTest(t)
	first := newFailoverUpstream(t, "unregistered-for-request", 200)
	channel := addRelayFailoverChannel(t, 7261, 30, first)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
	// Registry exists, but none of its tuples matches this authorized request.
	entries := []host.RegistryEntry{{BindingID: smartRouterBindingA, ChannelID: channel.Id, Group: "default", Model: "different-model", Protocol: "chat", ProtocolPlugin: "chat-v1"}}
	values := map[string]string{"NEWAPI_SMART_ROUTER_ENABLED": "true", "NEWAPI_SMART_ROUTER_URL": sidecar.server.URL,
		"NEWAPI_SMART_ROUTER_SIGNING_KEY": smartRouterTestKey, "NEWAPI_SMART_ROUTER_BINDINGS": smartRouterMarshal(t, entries)}
	require.NoError(t, service.ConfigureSmartRouter(func(name string) string { return values[name] }))
	t.Cleanup(func() { require.NoError(t, service.ConfigureSmartRouter(func(string) string { return "" })) })

	response := performRelayFailoverRequest(t, engine)

	assert.Equal(t, 503, response.Code)
	assert.Zero(t, first.callCount())
	assert.Empty(t, sidecar.routeSnapshot())
	assert.Empty(t, sidecar.outcomeSnapshot())
	var stored model.User
	require.NoError(t, model.DB.First(&stored, user.Id).Error)
	assert.Equal(t, user.Quota, stored.Quota, "empty selection fails before billing")
}

func TestSmartRouterRetryRevalidatesBackup(t *testing.T) {
	engine, user := setupSmartRouterHostTest(t)
	second := newFailoverUpstream(t, "retired-before-retry", 200)
	channel := addRelayFailoverChannel(t, 7272, 20, second)
	first := &failoverUpstream{name: "first"}
	first.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.Copy(io.Discard, r.Body)
		first.mu.Lock()
		first.calls++
		first.mu.Unlock()
		if !assert.NoError(t, model.DB.Model(&channel).Update("status", common.ChannelStatusAutoDisabled).Error) {
			w.WriteHeader(500)
			return
		}
		initializeRelayFailoverChannels()
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(500)
		_, _ = io.WriteString(w, `{"error":{"type":"upstream_error","message":"synthetic failure"}}`)
	}))
	t.Cleanup(first.server.Close)
	addRelayFailoverChannel(t, 7271, 30, first)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7271, 7272)

	response := performRelayFailoverRequest(t, engine)

	assert.GreaterOrEqual(t, response.Code, 400)
	assert.Equal(t, 1, first.callCount())
	assert.Zero(t, second.callCount())
	assert.Len(t, sidecar.routeSnapshot(), 1)
	require.Len(t, sidecar.outcomeSnapshot(), 1)
	assert.Equal(t, host.OutcomeUpstream5xx, sidecar.outcomeSnapshot()[0].Outcome)
	requireRelayRefunded(t, user.Id)
}

func TestSmartRouterProviderCancellation(t *testing.T) {
	engine, user := setupSmartRouterHostTest(t)
	arrived := make(chan struct{}, 1)
	release := make(chan struct{})
	first := &failoverUpstream{name: "cancelled"}
	first.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := io.Copy(io.Discard, r.Body)
		if !assert.NoError(t, err) {
			return
		}
		first.mu.Lock()
		first.calls++
		first.mu.Unlock()
		arrived <- struct{}{}
		select {
		case <-r.Context().Done():
		case <-release:
		}
	}))
	t.Cleanup(first.server.Close)
	t.Cleanup(func() { close(release) })
	second := newFailoverUpstream(t, "forbidden", 200)
	addRelayFailoverChannel(t, 7281, 30, first)
	addRelayFailoverChannel(t, 7282, 20, second)
	initializeRelayFailoverChannels()
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA, smartRouterBindingB)
	configureSmartRouterHost(t, sidecar, host.ProtocolChat, 7281, 7282)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	request := httptest.NewRequest("POST", "/v1/chat/completions", strings.NewReader(`{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"ping"}]}`)).WithContext(ctx)
	request.Header.Set("Authorization", "Bearer harelaytoken")
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		engine.ServeHTTP(response, request)
	}()
	select {
	case <-arrived:
		cancel()
	case <-time.After(3 * time.Second):
		cancel()
		assert.Fail(t, "provider arrival exceeded bounded wait")
	}
	select {
	case <-done:
	case <-time.After(3 * time.Second):
		require.FailNow(t, "cancelled request did not finish within bounded wait")
	}
	assert.GreaterOrEqual(t, response.Code, 400)
	assert.Equal(t, 1, first.callCount())
	assert.Zero(t, second.callCount())
	assert.Len(t, sidecar.routeSnapshot(), 1)
	assert.Empty(t, sidecar.outcomeSnapshot(), "cancelled report context is not retried")
	requireRelayRefunded(t, user.Id)
}

type smartRouterHijackWriter struct {
	gin.ResponseWriter
	conn net.Conn
}

func (w *smartRouterHijackWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	w.ResponseWriter.WriteHeaderNow()
	return w.conn, nil, nil
}

func TestSmartRouterWriterHijack(t *testing.T) {
	sidecar := newSmartRouterHostSidecar(t, smartRouterBindingA)
	now := time.UnixMilli(1000)
	client, err := host.NewClient(smartRouterConfig(sidecar.server.URL), func() time.Time { return now })
	require.NoError(t, err)
	state := host.NewState(client, smartRouterRequest(), smartRouterResponse(), smartRouterRegistry())
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest("POST", "/v1/chat/completions", nil)
	conn, peer := net.Pipe()
	t.Cleanup(func() { _ = conn.Close(); _ = peer.Close() })
	c.Writer = &smartRouterHijackWriter{ResponseWriter: c.Writer, conn: conn}
	host.Install(c, state)
	require.NoError(t, state.Begin())
	require.NoError(t, state.Invoke())
	host.ObserveTransport(c, &http.Response{StatusCode: 500}, nil)
	got, _, err := http.NewResponseController(c.Writer).Hijack()
	require.NoError(t, err)
	assert.Same(t, conn, got)
	assert.False(t, state.Finish(context.Background(), false, false))
	require.Len(t, sidecar.outcomeSnapshot(), 1)
	assert.Equal(t, host.OutcomeResponseCommitted, sidecar.outcomeSnapshot()[0].Outcome)
}

func smartRouterRegistry() []host.RegistryEntry {
	return []host.RegistryEntry{{BindingID: smartRouterBindingA, ChannelID: 1, Group: "default", Model: "model-a", Protocol: "chat", ProtocolPlugin: "chat-v1"}}
}

func smartRouterConfig(url string) host.Config {
	return host.Config{Enabled: true, URL: url, SigningKey: []byte(smartRouterTestKey), Timeout: time.Second, AttemptLimit: 2, Bindings: smartRouterRegistry()}
}

func smartRouterMarshal(t *testing.T, value any) string {
	t.Helper()
	data, err := common.Marshal(value)
	require.NoError(t, err)
	return string(data)
}

func smartRouterRequest() host.RouteRequest {
	return host.RouteRequest{Kind: "route_request", SchemaVersion: 1, RequestID: "req-1", Group: "default", Model: "model-a", Protocol: host.ProtocolChat, AttemptLimit: 2, Bindings: []host.Binding{{BindingID: smartRouterBindingA, ProtocolPlugin: "chat-v1", Rank: 1}}}
}

func smartRouterResponse() host.RouteResponse {
	return host.RouteResponse{Kind: "route_response", SchemaVersion: 1, RequestID: "req-1", SnapshotRevision: "rev-1", ExpiresAt: 2000, Bindings: []host.Binding{{BindingID: smartRouterBindingA, ProtocolPlugin: "chat-v1", Rank: 1}}}
}

func smartRouterSignature(t *testing.T, value any) string {
	t.Helper()
	payload, err := host.CanonicalPayload(value)
	require.NoError(t, err)
	mac := hmac.New(sha256.New, []byte(smartRouterTestKey))
	_, err = mac.Write(payload)
	require.NoError(t, err)
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func TestSmartRouterConfig(t *testing.T) {
	t.Run("disabled does not read any other variable", func(t *testing.T) {
		for _, enabled := range []string{"", "false"} {
			reads := []string{}
			cfg, err := host.LoadConfig(func(name string) string {
				reads = append(reads, name)
				if name == "NEWAPI_SMART_ROUTER_ENABLED" {
					return enabled
				}
				t.Errorf("disabled read %s", name)
				return "{secret-invalid"
			})
			require.NoError(t, err)
			assert.False(t, cfg.Enabled)
			assert.Equal(t, []string{"NEWAPI_SMART_ROUTER_ENABLED"}, reads)
		}
	})
	t.Run("enabled missing values fails closed", func(t *testing.T) {
		_, err := host.LoadConfig(func(name string) string {
			if name == "NEWAPI_SMART_ROUTER_ENABLED" {
				return "true"
			}
			return ""
		})
		require.Error(t, err)
	})
	base := map[string]string{
		"NEWAPI_SMART_ROUTER_ENABLED": "true", "NEWAPI_SMART_ROUTER_URL": "http://127.0.0.1:1234",
		"NEWAPI_SMART_ROUTER_SIGNING_KEY": smartRouterTestKey,
		"NEWAPI_SMART_ROUTER_BINDINGS":    smartRouterMarshal(t, smartRouterRegistry()),
	}
	t.Run("valid defaults and all supported protocols", func(t *testing.T) {
		cfg, err := host.LoadConfig(func(name string) string { return base[name] })
		require.NoError(t, err)
		assert.True(t, cfg.Enabled)
		assert.Equal(t, 2*time.Second, cfg.Timeout)
		assert.Equal(t, 2, cfg.AttemptLimit)
		assert.Equal(t, []byte(smartRouterTestKey), cfg.SigningKey)
		assert.Equal(t, smartRouterRegistry(), cfg.Bindings)
		for _, protocol := range []string{"chat", "responses", "messages"} {
			for _, url := range []string{"http://127.0.0.1:1/", "http://[::1]:65535"} {
				entries := smartRouterRegistry()
				entries[0].Protocol = protocol
				entries[0].ProtocolPlugin = protocol + "-v1"
				values := map[string]string{}
				for k, v := range base {
					values[k] = v
				}
				values["NEWAPI_SMART_ROUTER_URL"] = url
				values["NEWAPI_SMART_ROUTER_BINDINGS"] = smartRouterMarshal(t, entries)
				values["NEWAPI_SMART_ROUTER_TIMEOUT"] = "10s"
				values["NEWAPI_SMART_ROUTER_ATTEMPT_LIMIT"] = "5"
				cfg, err := host.LoadConfig(func(name string) string { return values[name] })
				require.NoError(t, err)
				assert.Equal(t, 10*time.Second, cfg.Timeout)
				assert.Equal(t, 5, cfg.AttemptLimit)
			}
		}
	})
	for _, test := range []struct{ name, key, value string }{
		{"bool upper", "ENABLED", "TRUE"}, {"bool numeric", "ENABLED", "1"}, {"bool spaces", "ENABLED", " true"},
		{"url absent", "URL", ""}, {"hostname", "URL", "http://localhost:1234"},
		{"nonloopback", "URL", "http://127.0.0.2:1234"}, {"https", "URL", "https://127.0.0.1:1234"},
		{"no port", "URL", "http://127.0.0.1"}, {"zero port", "URL", "http://127.0.0.1:0"},
		{"bad port", "URL", "http://127.0.0.1:65536"}, {"userinfo", "URL", "http://private:secret@127.0.0.1:1234"},
		{"query", "URL", "http://127.0.0.1:1234?"}, {"fragment", "URL", "http://127.0.0.1:1234#"},
		{"path", "URL", "http://127.0.0.1:1234/v1"}, {"encoded path", "URL", "http://127.0.0.1:1234/%2f"},
		{"short key", "SIGNING_KEY", strings.Repeat("k", 31)},
		{"negative timeout", "TIMEOUT", "-1s"}, {"zero timeout", "TIMEOUT", "0s"}, {"large timeout", "TIMEOUT", "10.1s"},
		{"malformed timeout", "TIMEOUT", "bad"}, {"zero attempts", "ATTEMPT_LIMIT", "0"},
		{"many attempts", "ATTEMPT_LIMIT", "6"}, {"decimal attempts", "ATTEMPT_LIMIT", "2.0"},
		{"registry absent", "BINDINGS", ""}, {"registry empty", "BINDINGS", "[]"}, {"registry null", "BINDINGS", "null"},
		{"registry object", "BINDINGS", "{}"}, {"registry trailing", "BINDINGS", base["NEWAPI_SMART_ROUTER_BINDINGS"] + "[]"},
		{"registry oversized", "BINDINGS", strings.Repeat(" ", (1<<20)+1)},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := host.LoadConfig(func(name string) string {
				if name == "NEWAPI_SMART_ROUTER_"+test.key {
					return test.value
				}
				return base[name]
			})
			require.Error(t, err)
			assert.NotContains(t, err.Error(), smartRouterTestKey)
			assert.NotContains(t, err.Error(), "private")
			assert.NotContains(t, err.Error(), "http://")
		})
	}
	for _, test := range []struct {
		name string
		edit func(map[string]common.RawMessage)
	}{
		{"unknown", func(v map[string]common.RawMessage) { v["extra"] = common.RawMessage(`1`) }},
		{"case alias", func(v map[string]common.RawMessage) { v["Binding_ID"] = v["binding_id"]; delete(v, "binding_id") }},
		{"null", func(v map[string]common.RawMessage) { v["channel_id"] = common.RawMessage(`null`) }},
		{"wrong type", func(v map[string]common.RawMessage) { v["channel_id"] = common.RawMessage(`"1"`) }},
		{"fraction", func(v map[string]common.RawMessage) { v["channel_id"] = common.RawMessage(`1.5`) }},
		{"missing", func(v map[string]common.RawMessage) { delete(v, "protocol_plugin") }},
		{"bad id", func(v map[string]common.RawMessage) { v["binding_id"] = common.RawMessage(`"bnd_bad"`) }},
		{"zero channel", func(v map[string]common.RawMessage) { v["channel_id"] = common.RawMessage(`0`) }},
		{"empty group", func(v map[string]common.RawMessage) { v["group"] = common.RawMessage(`""`) }},
		{"long group", func(v map[string]common.RawMessage) {
			v["group"] = common.RawMessage(smartRouterMarshal(t, strings.Repeat("g", 129)))
		}},
		{"long model", func(v map[string]common.RawMessage) {
			v["model"] = common.RawMessage(smartRouterMarshal(t, strings.Repeat("m", 257)))
		}},
		{"task bridge", func(v map[string]common.RawMessage) { v["protocol"] = common.RawMessage(`"task_bridge"`) }},
		{"wrong plugin", func(v map[string]common.RawMessage) { v["protocol_plugin"] = common.RawMessage(`"messages-v1"`) }},
	} {
		t.Run("registry "+test.name, func(t *testing.T) {
			var v map[string]common.RawMessage
			require.NoError(t, common.Unmarshal([]byte(smartRouterMarshal(t, smartRouterRegistry()[0])), &v))
			test.edit(v)
			_, err := host.LoadConfig(func(name string) string {
				if name == "NEWAPI_SMART_ROUTER_BINDINGS" {
					return "[" + smartRouterMarshal(t, v) + "]"
				}
				return base[name]
			})
			require.Error(t, err)
		})
	}
	for _, registry := range []string{
		strings.Replace(base["NEWAPI_SMART_ROUTER_BINDINGS"], `"channel_id":1`, `"channel_id":1,"channel_id":2`, 1),
		strings.Replace(base["NEWAPI_SMART_ROUTER_BINDINGS"], `"channel_id":1`, `"channel_id":1,"channel\u005fid":2`, 1),
		smartRouterMarshal(t, append(smartRouterRegistry(), smartRouterRegistry()...)),
		smartRouterMarshal(t, []any{nil}),
	} {
		_, err := host.LoadConfig(func(name string) string {
			if name == "NEWAPI_SMART_ROUTER_BINDINGS" {
				return registry
			}
			return base[name]
		})
		require.Error(t, err)
	}
	t.Run("registry bounded and tuple cap", func(t *testing.T) {
		for _, count := range []int{5, 6, 256, 257} {
			entries := make([]host.RegistryEntry, count)
			for i := range count {
				entries[i] = smartRouterRegistry()[0]
				entries[i].BindingID = "bnd_" + base64.RawURLEncoding.EncodeToString(append(make([]byte, 16), byte(i>>8), byte(i)))
				if count > 6 {
					entries[i].Model = entries[i].BindingID
				}
			}
			_, err := host.LoadConfig(func(name string) string {
				if name == "NEWAPI_SMART_ROUTER_BINDINGS" {
					return smartRouterMarshal(t, entries)
				}
				return base[name]
			})
			if count == 5 || count == 256 {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
		}
	})
	t.Run("constructor revalidates enabled config", func(t *testing.T) {
		_, err := host.NewClient(host.Config{Enabled: true}, nil)
		require.Error(t, err)
	})
}

func TestSmartRouterCanonicalPayload(t *testing.T) {
	response := smartRouterResponse()
	response.ExpiresAt = 123
	response.Signature = "ignored"
	const golden = `{"bindings":[{"binding_id":"bnd_AAAAAAAAAAAAAAAAAAAAAAAA","protocol_plugin":"chat-v1","rank":1}],"expires_at":123,"kind":"route_response","request_id":"req-1","schema_version":1,"snapshot_revision":"rev-1"}`
	payload, err := host.CanonicalPayload(response)
	require.NoError(t, err)
	assert.Equal(t, golden, string(payload))
	// Literal digest independently calculated with Ruby OpenSSL, not this helper.
	assert.Equal(t, "3Cx_FxpPyav8PPgIqLPcEJqNa999em4O4Ig17VmAid8", smartRouterSignature(t, response))
	response.ExpiresAt = 9007199254740993
	response.Bindings[0].CostMicrounits = 9007199254740995
	payload, err = host.CanonicalPayload(response)
	require.NoError(t, err)
	assert.Contains(t, string(payload), `"expires_at":9007199254740993`)
	assert.Contains(t, string(payload), `"cost_microunits":9007199254740995`)
	nested := map[string]common.RawMessage{
		"signature": common.RawMessage(`"top"`),
		"z":         common.RawMessage(`[{"z":2,"signature":"nested","a":1},"<>&\u2028\u2029\n\"\\"]`),
		"a":         common.RawMessage(`9007199254740993`),
	}
	payload, err = host.CanonicalPayload(nested)
	require.NoError(t, err)
	assert.Equal(t, `{"a":9007199254740993,"z":[{"a":1,"signature":"nested","z":2},"\u003c\u003e\u0026\u2028\u2029\n\"\\"]}`, string(payload))
	t.Run("numeric lexemes and unsupported payloads", func(t *testing.T) {
		payload, err := host.CanonicalPayload(map[string]common.RawMessage{"n": common.RawMessage(`1.2300e+40`), "zero": common.RawMessage(`-0`)})
		require.NoError(t, err)
		assert.Equal(t, `{"n":1.2300e+40,"zero":-0}`, string(payload))
		for _, value := range []any{
			nil, []int{1}, make(chan int), map[string]common.RawMessage{"bad": common.RawMessage(`{`)},
			map[string]common.RawMessage{"deep": common.RawMessage(strings.Repeat("[", 80) + `0` + strings.Repeat("]", 80))},
		} {
			_, err := host.CanonicalPayload(value)
			require.ErrorIs(t, err, host.ErrResponse)
		}
	})
	outcome := host.AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1, EventID: "req-1-attempt-1", RequestID: "req-1", BindingID: smartRouterBindingA, Protocol: host.ProtocolChat, Outcome: host.OutcomeSuccess}
	assert.Equal(t, `{"kind":"attempt_outcome","schema_version":1,"event_id":"req-1-attempt-1","request_id":"req-1","binding_id":"bnd_AAAAAAAAAAAAAAAAAAAAAAAA","protocol":"chat","outcome":"success"}`, smartRouterMarshal(t, outcome))
}

func TestSmartRouterSignedRoute(t *testing.T) {
	mutations := []struct {
		name string
		edit func(*host.RouteResponse)
	}{
		{"legal control", func(*host.RouteResponse) {}},
		{"request correlation", func(v *host.RouteResponse) { v.RequestID = "different" }},
		{"exact expiry", func(v *host.RouteResponse) { v.ExpiresAt = 1000 }},
		{"past expiry", func(v *host.RouteResponse) { v.ExpiresAt = 999 }},
		{"zero expiry", func(v *host.RouteResponse) { v.ExpiresAt = 0 }},
		{"negative expiry", func(v *host.RouteResponse) { v.ExpiresAt = -1 }},
		{"unrequested binding", func(v *host.RouteResponse) { v.Bindings[0].BindingID = smartRouterBindingB }},
		{"duplicate bindings", func(v *host.RouteResponse) { v.Bindings = append(v.Bindings, v.Bindings[0]); v.Bindings[1].Rank = 2 }},
		{"nonsequential rank", func(v *host.RouteResponse) { v.Bindings[0].Rank = 2 }},
		{"empty bindings", func(v *host.RouteResponse) { v.Bindings = []host.Binding{} }},
		{"over requested count", func(v *host.RouteResponse) {
			v.Bindings = append(v.Bindings, host.Binding{BindingID: smartRouterBindingB, ProtocolPlugin: "chat-v1", Rank: 2})
		}},
		{"wrong plugin", func(v *host.RouteResponse) { v.Bindings[0].ProtocolPlugin = "responses-v1" }},
		{"negative cost", func(v *host.RouteResponse) { v.Bindings[0].CostMicrounits = -1 }},
		{"wrong kind", func(v *host.RouteResponse) { v.Kind = "signed_snapshot" }},
		{"wrong schema", func(v *host.RouteResponse) { v.SchemaVersion = 2 }},
		{"empty revision", func(v *host.RouteResponse) { v.SnapshotRevision = "" }},
		{"long revision", func(v *host.RouteResponse) { v.SnapshotRevision = strings.Repeat("r", 129) }},
	}
	for _, test := range mutations {
		t.Run(test.name, func(t *testing.T) {
			response := smartRouterResponse()
			test.edit(&response)
			response.Signature = smartRouterSignature(t, response)
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, "/v1/route", r.URL.Path)
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
				var got host.RouteRequest
				require.NoError(t, common.DecodeJson(r.Body, &got))
				assert.Equal(t, smartRouterRequest().RequestID, got.RequestID)
				w.Header().Set("Content-Type", "application/json")
				_, err := io.WriteString(w, smartRouterMarshal(t, response))
				assert.NoError(t, err)
			}))
			defer srv.Close()
			now := int64(1000)
			if response.ExpiresAt < 1 {
				now = response.ExpiresAt - 1
			}
			client, err := host.NewClient(smartRouterConfig(srv.URL), func() time.Time { return time.UnixMilli(now) })
			require.NoError(t, err)
			request := smartRouterRequest()
			if test.name == "over requested count" {
				request.AttemptLimit = 1
				request.Bindings = append(request.Bindings, host.Binding{BindingID: smartRouterBindingB, ProtocolPlugin: "chat-v1", Rank: 2})
			}
			got, err := client.Route(context.Background(), request)
			if test.name == "legal control" {
				require.NoError(t, err)
				assert.Equal(t, response, got)
			} else if response.ExpiresAt < 1 {
				require.ErrorIs(t, err, host.ErrResponse)
				assert.Empty(t, got)
			} else {
				require.Error(t, err)
			}
		})
	}
	t.Run("strict signed wire and authentication before semantic checks", func(t *testing.T) {
		response := smartRouterResponse()
		response.Signature = smartRouterSignature(t, response)
		wire := smartRouterMarshal(t, response)
		for _, test := range []struct{ name, body, code string }{
			{"signature tamper", strings.Replace(wire, response.Signature, strings.Repeat("A", 43), 1), "signature_invalid"},
			{"correlation without resign", strings.Replace(wire, "req-1", "req-2", 1), "signature_invalid"},
			{"expiry without resign", strings.Replace(wire, "2000", "1000", 1), "signature_invalid"},
			{"zero expiry without resign", strings.Replace(wire, `"expires_at":2000`, `"expires_at":0`, 1), "signature_invalid"},
			{"negative expiry without resign", strings.Replace(wire, `"expires_at":2000`, `"expires_at":-1`, 1), "signature_invalid"},
			{"unknown", strings.Replace(wire, `"kind":`, `"unknown":1,"kind":`, 1), "invalid_response"},
			{"trailing", wire + `{}`, "invalid_response"},
			{"null", strings.Replace(wire, `"expires_at":2000`, `"expires_at":null`, 1), "invalid_response"},
			{"duplicate", strings.Replace(wire, `"expires_at":2000`, `"expires_at":2000,"expires_at":2000`, 1), "invalid_response"},
			{"escaped duplicate", strings.Replace(wire, `"expires_at":2000`, `"expires_at":2000,"expires\u005fat":2000`, 1), "invalid_response"},
			{"case alias", strings.Replace(wire, `"expires_at":2000`, `"Expires_At":2000`, 1), "invalid_response"},
			{"missing", strings.Replace(wire, `"schema_version":1,`, "", 1), "invalid_response"},
			{"wrong type", strings.Replace(wire, `"expires_at":2000`, `"expires_at":"2000"`, 1), "invalid_response"},
			{"nested duplicate", strings.Replace(wire, `"rank":1`, `"rank":1,"rank":1`, 1), "invalid_response"},
			{"nested null", strings.Replace(wire, `"rank":1`, `"rank":null`, 1), "invalid_response"},
			{"nested alias", strings.Replace(wire, `"rank":1`, `"Rank":1`, 1), "invalid_response"},
			{"cost null", strings.Replace(wire, `"rank":1`, `"rank":1,"cost_microunits":null`, 1), "invalid_response"},
			{"malformed syntax", `{"bindings":[`, "invalid_response"},
			{"deep unknown value", strings.Replace(wire, `"kind":`, `"extra":`+strings.Repeat("[", 80)+`0`+strings.Repeat("]", 80)+`,"kind":`, 1), "invalid_response"},
			{"padded signature", strings.Replace(wire, response.Signature, response.Signature+"=", 1), "signature_invalid"},
			{"short signature", strings.Replace(wire, response.Signature, "AA", 1), "signature_invalid"},
		} {
			t.Run(test.name, func(t *testing.T) {
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					w.Header().Set("Content-Type", "application/json")
					_, err := io.WriteString(w, test.body)
					assert.NoError(t, err)
				}))
				defer srv.Close()
				client, err := host.NewClient(smartRouterConfig(srv.URL), func() time.Time { return time.UnixMilli(1000) })
				require.NoError(t, err)
				_, err = client.Route(context.Background(), smartRouterRequest())
				require.Error(t, err)
				assert.Equal(t, "smart_router: "+test.code, err.Error())
			})
		}
	})
	t.Run("ineligible requests and disabled client make zero calls", func(t *testing.T) {
		var calls atomic.Int32
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1) }))
		defer srv.Close()
		for _, enabled := range []bool{true, false} {
			config := smartRouterConfig(srv.URL)
			config.Enabled = enabled
			client, err := host.NewClient(config, nil)
			require.NoError(t, err)
			for _, edit := range []func(*host.RouteRequest){
				func(v *host.RouteRequest) { v.Kind = "route_response" },
				func(v *host.RouteRequest) { v.SchemaVersion = 0 },
				func(v *host.RouteRequest) { v.RequestID = "" },
				func(v *host.RouteRequest) { v.RequestID = strings.Repeat("r", 129) },
				func(v *host.RouteRequest) { v.Group = "" },
				func(v *host.RouteRequest) { v.Group = strings.Repeat("g", 129) },
				func(v *host.RouteRequest) { v.Model = "" },
				func(v *host.RouteRequest) { v.Model = strings.Repeat("m", 257) },
				func(v *host.RouteRequest) { v.SnapshotRevision = strings.Repeat("r", 129) },
				func(v *host.RouteRequest) { v.Bindings = nil },
				func(v *host.RouteRequest) { v.Bindings = []host.Binding{} },
				func(v *host.RouteRequest) { v.Bindings[0].BindingID = "channel-1" },
				func(v *host.RouteRequest) { v.Bindings[0].ProtocolPlugin = "responses-v1" },
				func(v *host.RouteRequest) { v.Bindings[0].Rank = 0 },
				func(v *host.RouteRequest) { v.Bindings[0].CostMicrounits = -1 },
				func(v *host.RouteRequest) { v.Bindings = append(v.Bindings, v.Bindings[0]) },
				func(v *host.RouteRequest) { v.Bindings = make([]host.Binding, 6) },
				func(v *host.RouteRequest) { v.AttemptLimit = 0 },
				func(v *host.RouteRequest) { v.AttemptLimit = 6 },
				func(v *host.RouteRequest) { v.Protocol = host.ProtocolTaskBridge },
			} {
				request := smartRouterRequest()
				edit(&request)
				_, err := client.Route(context.Background(), request)
				if enabled {
					require.ErrorIs(t, err, host.ErrRequest)
				} else {
					require.ErrorIs(t, err, host.ErrDisabled)
				}
			}
			if !enabled {
				require.ErrorIs(t, client.ReportOutcome(context.Background(), host.AttemptOutcome{}), host.ErrDisabled)
				_, err = client.Snapshot(context.Background())
				require.ErrorIs(t, err, host.ErrDisabled)
			}
		}
		assert.Zero(t, calls.Load())
	})
	t.Run("key copy and legal maximum request boundaries", func(t *testing.T) {
		for _, protocol := range []host.Protocol{host.ProtocolChat, host.ProtocolResponses, host.ProtocolMessages} {
			request := smartRouterRequest()
			request.Protocol = protocol
			request.RequestID = strings.Repeat("r", 128)
			request.Group = strings.Repeat("g", 128)
			request.Model = strings.Repeat("m", 256)
			request.SnapshotRevision = strings.Repeat("v", 128)
			request.AttemptLimit = 5
			request.Bindings = make([]host.Binding, 5)
			for i := range request.Bindings {
				request.Bindings[i] = host.Binding{BindingID: "bnd_" + strings.Repeat(string(rune('A'+i)), 24), ProtocolPlugin: string(protocol) + "-v1", Rank: i + 1, CostMicrounits: 9007199254740995}
			}
			response := smartRouterResponse()
			response.RequestID = request.RequestID
			response.SnapshotRevision = request.SnapshotRevision
			response.Bindings = request.Bindings
			response.Signature = smartRouterSignature(t, response)
			var calls atomic.Int32
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				var got host.RouteRequest
				require.NoError(t, common.DecodeJson(r.Body, &got))
				assert.Equal(t, request, got)
				w.Header().Set("Content-Type", "application/json")
				_, err := io.WriteString(w, smartRouterMarshal(t, response))
				assert.NoError(t, err)
			}))
			cfg := smartRouterConfig(srv.URL)
			client, err := host.NewClient(cfg, func() time.Time { return time.UnixMilli(1000) })
			require.NoError(t, err)
			cfg.SigningKey[0] = 'X'
			got, err := client.Route(context.Background(), request)
			require.NoError(t, err)
			assert.Equal(t, response, got)
			assert.EqualValues(t, 1, calls.Load())
			srv.Close()
		}
	})
}

func TestSmartRouterControlTransport(t *testing.T) {
	t.Run("complete POST disconnect is not replayed", func(t *testing.T) {
		request := smartRouterRequest()
		outcome := host.AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1", RequestID: "req-1", BindingID: smartRouterBindingA, Protocol: host.ProtocolChat, Outcome: host.OutcomeSuccess}
		for _, test := range []struct {
			path    string
			payload any
		}{
			{"/v1/route", request},
			{"/v1/outcomes", outcome},
		} {
			t.Run(test.path, func(t *testing.T) {
				wire := smartRouterMarshal(t, test.payload)
				var arrivals atomic.Int32
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, http.MethodPost, r.Method)
					assert.Equal(t, test.path, r.URL.Path)
					assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
					body, err := io.ReadAll(r.Body)
					if !assert.NoError(t, err) {
						return
					}
					assert.Equal(t, wire, string(body))
					arrivals.Add(1)
					conn, _, err := w.(http.Hijacker).Hijack()
					if !assert.NoError(t, err) {
						return
					}
					assert.NoError(t, conn.Close())
				}))
				defer srv.Close()
				client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
				require.NoError(t, err)
				if test.path == "/v1/route" {
					_, err = client.Route(context.Background(), request)
				} else {
					err = client.ReportOutcome(context.Background(), outcome)
				}
				require.ErrorIs(t, err, host.ErrTransport)
				srv.Close()
				assert.EqualValues(t, 1, arrivals.Load())
				assert.Equal(t, "smart_router: transport_failed", err.Error())
				assert.NotContains(t, err.Error(), srv.URL)
				assert.NotContains(t, err.Error(), wire)
			})
		}
	})
	t.Run("one shot status and strict error contract", func(t *testing.T) {
		for _, test := range []struct {
			name                    string
			status                  int
			contentType, body, code string
		}{
			{"500", 500, "application/json", `{"kind":"error","schema_version":1,"code":"snapshot_unavailable","retryable":true,"message":"SECRET-body-http://private"}`, "snapshot_unavailable"},
			{"invalid request", 400, "application/json", `{"kind":"error","schema_version":1,"code":"invalid_request","retryable":false}`, "invalid_request"},
			{"contract mismatch", 409, "application/json", `{"kind":"error","schema_version":1,"code":"contract_mismatch","retryable":true}`, "contract_mismatch"},
			{"outcome conflict", 409, "application/json", `{"kind":"error","schema_version":1,"code":"outcome_conflict","retryable":false}`, "outcome_conflict"},
			{"signature invalid", 401, "application/json", `{"kind":"error","schema_version":1,"code":"signature_invalid","retryable":false}`, "signature_invalid"},
			{"snapshot expired", 410, "application/json", `{"kind":"error","schema_version":1,"code":"snapshot_expired","retryable":true}`, "snapshot_expired"},
			{"binding unavailable", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true}`, "binding_unavailable"},
			{"snapshot unavailable", 503, "application/json", `{"kind":"error","schema_version":1,"code":"snapshot_unavailable","retryable":true}`, "snapshot_unavailable"},
			{"unknown error", 503, "application/json", `{"kind":"error","schema_version":1,"code":"unknown","retryable":true}`, "invalid_response"},
			{"unknown body", 500, "application/json", `SECRET-body-http://private`, "invalid_response"},
			{"bad error status", 200, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true}`, "invalid_response"},
			{"bad content type", 200, "text/plain", `{}`, "invalid_response"},
			{"missing content type", 200, "", `{}`, "invalid_response"},
			{"array body", 200, "application/json", `[]`, "invalid_response"},
			{"null body", 200, "application/json", `null`, "invalid_response"},
			{"duplicate error", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true,"retryable":true}`, "invalid_response"},
			{"error version", 503, "application/json", `{"kind":"error","schema_version":2,"code":"binding_unavailable","retryable":true}`, "invalid_response"},
			{"error kind", 503, "application/json", `{"kind":"route_response","schema_version":1,"code":"binding_unavailable","retryable":true}`, "invalid_response"},
			{"error null", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":null}`, "invalid_response"},
			{"error long id", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true,"request_id":"` + strings.Repeat("r", 129) + `"}`, "invalid_response"},
			{"error maximum message", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true,"message":"` + strings.Repeat("s", 512) + `"}`, "binding_unavailable"},
			{"error long message", 503, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true,"message":"` + strings.Repeat("s", 513) + `"}`, "invalid_response"},
			{"mismatched status", 401, "application/json", `{"kind":"error","schema_version":1,"code":"binding_unavailable","retryable":true}`, "invalid_response"},
			{"body too large", 200, "application/json", strings.Repeat(" ", (1<<20)+1), "response_too_large"},
		} {
			t.Run(test.name, func(t *testing.T) {
				var calls atomic.Int32
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					calls.Add(1)
					w.Header()["Content-Type"] = []string{test.contentType}
					w.WriteHeader(test.status)
					_, err := io.WriteString(w, test.body)
					assert.NoError(t, err)
				}))
				defer srv.Close()
				client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
				require.NoError(t, err)
				_, err = client.Route(context.Background(), smartRouterRequest())
				require.Error(t, err)
				assert.Equal(t, "smart_router: "+test.code, err.Error())
				assert.NotContains(t, err.Error(), "SECRET")
				assert.NotContains(t, err.Error(), "http://")
				var contract host.ContractError
				if errors.As(err, &contract) {
					assert.Empty(t, contract.Message)
				}
				assert.EqualValues(t, 1, calls.Load())
			})
		}
	})
	t.Run("outcome immutable wire and empty 204 only", func(t *testing.T) {
		outcome := host.AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1, EventID: "req-1-attempt-1", RequestID: "req-1", BindingID: smartRouterBindingA, Protocol: host.ProtocolChat, Outcome: host.OutcomeRateLimited429, LatencyMS: 12, RetryAfterMS: 3000}
		for _, status := range []int{204, 200, 500} {
			var calls atomic.Int32
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, "/v1/outcomes", r.URL.Path)
				assert.Equal(t, "application/json", r.Header.Get("Content-Type"))
				body, err := io.ReadAll(r.Body)
				require.NoError(t, err)
				assert.Equal(t, smartRouterMarshal(t, outcome), string(body))
				w.WriteHeader(status)
			}))
			client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
			require.NoError(t, err)
			err = client.ReportOutcome(context.Background(), outcome)
			if status == 204 {
				require.NoError(t, err)
			} else {
				require.Error(t, err)
			}
			assert.EqualValues(t, 1, calls.Load())
			srv.Close()
		}
		t.Run("declared nonempty 204", func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				// net/http strips Content-Length from 204; send the malformed wire directly.
				conn, buffer, err := w.(http.Hijacker).Hijack()
				require.NoError(t, err)
				defer conn.Close()
				_, err = buffer.WriteString("HTTP/1.1 204 No Content\r\nContent-Length: 1\r\nConnection: close\r\n\r\n")
				require.NoError(t, err)
				require.NoError(t, buffer.Flush())
			}))
			defer srv.Close()
			client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
			require.NoError(t, err)
			require.Error(t, client.ReportOutcome(context.Background(), outcome))
		})
		t.Run("chunked nonempty 204", func(t *testing.T) {
			var calls atomic.Int32
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				calls.Add(1)
				assert.Equal(t, http.MethodPost, r.Method)
				assert.Equal(t, "/v1/outcomes", r.URL.Path)
				body, err := io.ReadAll(r.Body)
				if !assert.NoError(t, err) {
					return
				}
				assert.Equal(t, smartRouterMarshal(t, outcome), string(body))
				conn, buffer, err := w.(http.Hijacker).Hijack()
				if !assert.NoError(t, err) {
					return
				}
				defer conn.Close()
				_, err = buffer.WriteString("HTTP/1.1 204 No Content\r\nTransfer-Encoding: chunked\r\nConnection: close\r\n\r\n1\r\nx\r\n0\r\n\r\n")
				if !assert.NoError(t, err) {
					return
				}
				assert.NoError(t, buffer.Flush())
			}))
			defer srv.Close()
			client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
			require.NoError(t, err)
			err = client.ReportOutcome(context.Background(), outcome)
			srv.Close()
			assert.EqualValues(t, 1, calls.Load())
			require.ErrorIs(t, err, host.ErrResponse)
		})
		t.Run("all outcomes and maximum timings are accepted once", func(t *testing.T) {
			for _, result := range []host.Outcome{
				host.OutcomeSuccess, host.OutcomeAuth401, host.OutcomeRateLimited429, host.OutcomeUpstream5xx,
				host.OutcomeClient4xx, host.OutcomeTransportPreWrite, host.OutcomeWriteUnknown, host.OutcomeResponseCommitted,
			} {
				value := outcome
				value.Outcome = result
				value.EventID = strings.Repeat("e", 128)
				value.RequestID = strings.Repeat("r", 128)
				value.Protocol = host.ProtocolMessages
				value.RetryAfterMS = host.MaximumRetryAfterMS
				value.TTFTMS = 10
				var calls atomic.Int32
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					calls.Add(1)
					var got host.AttemptOutcome
					require.NoError(t, common.DecodeJson(r.Body, &got))
					assert.Equal(t, value, got)
					w.WriteHeader(204)
				}))
				client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
				require.NoError(t, err)
				require.NoError(t, client.ReportOutcome(context.Background(), value))
				assert.EqualValues(t, 1, calls.Load())
				srv.Close()
			}
		})
		t.Run("invalid outcome zero calls", func(t *testing.T) {
			var calls atomic.Int32
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { calls.Add(1) }))
			defer srv.Close()
			client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
			require.NoError(t, err)
			for _, edit := range []func(*host.AttemptOutcome){
				func(v *host.AttemptOutcome) { v.Kind = "route_request" },
				func(v *host.AttemptOutcome) { v.SchemaVersion = 2 },
				func(v *host.AttemptOutcome) { v.EventID = "" },
				func(v *host.AttemptOutcome) { v.EventID = strings.Repeat("e", 129) },
				func(v *host.AttemptOutcome) { v.RequestID = "" },
				func(v *host.AttemptOutcome) { v.RequestID = strings.Repeat("r", 129) },
				func(v *host.AttemptOutcome) { v.BindingID = "bnd_bad" },
				func(v *host.AttemptOutcome) { v.Protocol = host.ProtocolTaskBridge },
				func(v *host.AttemptOutcome) { v.Outcome = "unknown" },
				func(v *host.AttemptOutcome) { v.LatencyMS = -1 },
				func(v *host.AttemptOutcome) { v.TTFTMS = -1 },
				func(v *host.AttemptOutcome) { v.RetryAfterMS = -1 },
				func(v *host.AttemptOutcome) { v.RetryAfterMS = host.MaximumRetryAfterMS + 1 },
			} {
				value := outcome
				edit(&value)
				require.Error(t, client.ReportOutcome(context.Background(), value))
			}
			assert.Zero(t, calls.Load())
		})
	})
	t.Run("signed snapshot and clock", func(t *testing.T) {
		for _, test := range []struct {
			name string
			edit func(*host.SignedSnapshot)
		}{
			{"legal", func(*host.SignedSnapshot) {}},
			{"expired", func(v *host.SignedSnapshot) { v.ExpiresAt = 1000 }},
			{"zero issue", func(v *host.SignedSnapshot) { v.IssuedAt = 0 }},
			{"negative issue", func(v *host.SignedSnapshot) { v.IssuedAt = -1 }},
			{"future issue", func(v *host.SignedSnapshot) { v.IssuedAt = 1001 }},
			{"reversed", func(v *host.SignedSnapshot) { v.IssuedAt = v.ExpiresAt }},
			{"hash", func(v *host.SignedSnapshot) { v.ConfigSHA256 = "HASH" }},
			{"manifest hash", func(v *host.SignedSnapshot) { v.PluginManifestSHA256 = strings.Repeat("B", 64) }},
			{"kind", func(v *host.SignedSnapshot) { v.Kind = "route_response" }},
			{"schema", func(v *host.SignedSnapshot) { v.SchemaVersion = 2 }},
			{"empty revision", func(v *host.SignedSnapshot) { v.Revision = "" }},
			{"long revision", func(v *host.SignedSnapshot) { v.Revision = strings.Repeat("r", 129) }},
			{"group", func(v *host.SignedSnapshot) { v.Routes[0].Group = "" }},
			{"model", func(v *host.SignedSnapshot) { v.Routes[0].Model = strings.Repeat("m", 257) }},
			{"protocol", func(v *host.SignedSnapshot) { v.Routes[0].Protocol = host.ProtocolTaskBridge }},
			{"empty bindings", func(v *host.SignedSnapshot) { v.Routes[0].Bindings = []host.Binding{} }},
			{"bad id", func(v *host.SignedSnapshot) { v.Routes[0].Bindings[0].BindingID = "channel-1" }},
			{"plugin", func(v *host.SignedSnapshot) { v.Routes[0].Bindings[0].ProtocolPlugin = "responses-v1" }},
			{"cost", func(v *host.SignedSnapshot) { v.Routes[0].Bindings[0].CostMicrounits = -1 }},
			{"duplicate tuple", func(v *host.SignedSnapshot) { v.Routes = append(v.Routes, v.Routes[0]) }},
			{"duplicate id", func(v *host.SignedSnapshot) {
				v.Routes[0].Bindings = append(v.Routes[0].Bindings, v.Routes[0].Bindings[0])
				v.Routes[0].Bindings[1].Rank = 2
			}},
			{"over cap", func(v *host.SignedSnapshot) { v.Routes[0].Bindings = make([]host.Binding, 6) }},
			{"binding rank", func(v *host.SignedSnapshot) { v.Routes[0].Bindings[0].Rank = 2 }},
			{"tampered signature", func(v *host.SignedSnapshot) {}},
		} {
			t.Run(test.name, func(t *testing.T) {
				value := host.SignedSnapshot{Kind: "signed_snapshot", SchemaVersion: 1, Revision: "rev-1", IssuedAt: 900, ExpiresAt: 2000, ConfigSHA256: strings.Repeat("a", 64), PluginManifestSHA256: strings.Repeat("b", 64), Routes: []host.SnapshotRoute{{Group: "default", Model: "model-a", Protocol: host.ProtocolChat, Bindings: smartRouterResponse().Bindings}}}
				test.edit(&value)
				value.Signature = smartRouterSignature(t, value)
				if test.name == "tampered signature" {
					value.Signature = strings.Repeat("A", 43)
				}
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					assert.Equal(t, http.MethodGet, r.Method)
					assert.Equal(t, "/v1/snapshot", r.URL.Path)
					body, err := io.ReadAll(r.Body)
					require.NoError(t, err)
					assert.Empty(t, body)
					w.Header().Set("Content-Type", "application/json; charset=utf-8")
					_, err = io.WriteString(w, smartRouterMarshal(t, value))
					assert.NoError(t, err)
				}))
				defer srv.Close()
				client, err := host.NewClient(smartRouterConfig(srv.URL), func() time.Time { return time.UnixMilli(1000) })
				require.NoError(t, err)
				got, err := client.Snapshot(context.Background())
				if test.name == "legal" {
					require.NoError(t, err)
					assert.Equal(t, value, got)
				} else {
					require.Error(t, err)
				}
			})
		}
	})
	t.Run("redirect and ambient proxy blocked", func(t *testing.T) {
		var redirected, proxied, calls atomic.Int32
		target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { redirected.Add(1) }))
		defer target.Close()
		proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { proxied.Add(1) }))
		defer proxy.Close()
		t.Setenv("HTTP_PROXY", proxy.URL)
		t.Setenv("HTTPS_PROXY", proxy.URL)
		t.Setenv("ALL_PROXY", proxy.URL)
		t.Setenv("NO_PROXY", "")
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			calls.Add(1)
			http.Redirect(w, r, target.URL, http.StatusTemporaryRedirect)
		}))
		defer srv.Close()
		client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
		require.NoError(t, err)
		_, err = client.Route(context.Background(), smartRouterRequest())
		require.Error(t, err)
		assert.Zero(t, redirected.Load())
		assert.Zero(t, proxied.Load())
		assert.EqualValues(t, 1, calls.Load())
	})
	t.Run("context deadlines and cancellation", func(t *testing.T) {
		for _, operation := range []string{"route", "outcome", "snapshot"} {
			t.Run(operation, func(t *testing.T) {
				for _, phase := range []struct {
					name          string
					timeout       time.Duration
					beforeArrival bool
					want          error
				}{
					{"deadline", 100 * time.Millisecond, false, context.DeadlineExceeded},
					{"deadline before arrival", 100 * time.Millisecond, true, context.DeadlineExceeded},
					{"cancellation", 2 * time.Second, false, context.Canceled},
					{"cancellation before arrival", 2 * time.Second, true, context.Canceled},
				} {
					t.Run(phase.name, func(t *testing.T) {
						arrived := make(chan struct{}, 1)
						release := make(chan struct{})
						var calls atomic.Int32
						srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
							calls.Add(1)
							arrived <- struct{}{}
							select {
							case <-r.Context().Done():
							case <-release:
							}
						}))
						defer srv.Close()
						defer close(release)
						cfg := smartRouterConfig(srv.URL)
						cfg.Timeout = phase.timeout
						client, err := host.NewClient(cfg, nil)
						require.NoError(t, err)
						parent := context.Background()
						if phase.beforeArrival && phase.want == context.DeadlineExceeded {
							var cancelDeadline context.CancelFunc
							parent, cancelDeadline = context.WithDeadline(parent, time.Unix(0, 0))
							defer cancelDeadline()
						}
						ctx, cancel := context.WithCancel(parent)
						defer cancel()
						if phase.beforeArrival && phase.want == context.Canceled {
							cancel()
						}
						done := make(chan error, 1)
						go func() {
							switch operation {
							case "route":
								_, err := client.Route(ctx, smartRouterRequest())
								done <- err
							case "snapshot":
								_, err := client.Snapshot(ctx)
								done <- err
							default:
								done <- client.ReportOutcome(ctx, host.AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1", RequestID: "req-1", BindingID: smartRouterBindingA, Protocol: host.ProtocolChat, Outcome: host.OutcomeSuccess})
							}
						}()
						if phase.want == context.Canceled && !phase.beforeArrival {
							select {
							case <-arrived:
								cancel()
							case err := <-done:
								require.FailNow(t, "caller completed before request arrival", "error: %v", err)
							case <-time.After(3 * time.Second):
								require.FailNow(t, "request arrival exceeded bounded wait")
							}
						}
						select {
						case err := <-done:
							require.ErrorIs(t, err, phase.want)
						case <-time.After(3 * time.Second):
							require.FailNow(t, "caller completion exceeded bounded wait")
						}
						if phase.beforeArrival {
							assert.Zero(t, calls.Load())
						}
					})
				}
			})
		}
	})
	t.Run("transport errors sanitize URL", func(t *testing.T) {
		srv := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
		url := srv.URL
		srv.Close()
		client, err := host.NewClient(smartRouterConfig(url), nil)
		require.NoError(t, err)
		_, err = client.Route(context.Background(), smartRouterRequest())
		require.Error(t, err)
		assert.Equal(t, "smart_router: transport_failed", err.Error())
		assert.False(t, errors.Is(err, context.Canceled))
		assert.NotContains(t, err.Error(), url)
	})
	t.Run("exact body limit remains valid JSON", func(t *testing.T) {
		response := smartRouterResponse()
		response.Signature = smartRouterSignature(t, response)
		wire := smartRouterMarshal(t, response)
		wire += strings.Repeat(" ", (1<<20)-len(wire))
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, err := io.WriteString(w, wire)
			assert.NoError(t, err)
		}))
		defer srv.Close()
		client, err := host.NewClient(smartRouterConfig(srv.URL), func() time.Time { return time.UnixMilli(1000) })
		require.NoError(t, err)
		got, err := client.Route(context.Background(), smartRouterRequest())
		require.NoError(t, err)
		assert.Equal(t, response, got)
	})
	t.Run("caller deadline also bounds response body reads", func(t *testing.T) {
		release := make(chan struct{})
		srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "application/json")
			_, err := io.WriteString(w, `{"kind":`)
			assert.NoError(t, err)
			w.(http.Flusher).Flush()
			select {
			case <-r.Context().Done():
			case <-release:
			}
		}))
		defer srv.Close()
		defer close(release)
		client, err := host.NewClient(smartRouterConfig(srv.URL), nil)
		require.NoError(t, err)
		ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
		defer cancel()
		_, err = client.Route(ctx, smartRouterRequest())
		require.ErrorIs(t, err, context.DeadlineExceeded)
		assert.NotContains(t, err.Error(), srv.URL)
	})
}
