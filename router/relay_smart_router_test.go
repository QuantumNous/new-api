package router

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/QuantumNous/new-api/common"
	host "github.com/QuantumNous/new-api/pkg/smartrouterhost"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const smartRouterTestKey = "0123456789abcdef0123456789abcdef"
const smartRouterBindingA = "bnd_AAAAAAAAAAAAAAAAAAAAAAAA"
const smartRouterBindingB = "bnd_BBBBBBBBBBBBBBBBBBBBBBBB"

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
				arrived := make(chan struct{}, 1)
				release := make(chan struct{})
				srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					arrived <- struct{}{}
					select {
					case <-r.Context().Done():
					case <-release:
					}
				}))
				defer srv.Close()
				defer close(release)
				cfg := smartRouterConfig(srv.URL)
				cfg.Timeout = 100 * time.Millisecond
				client, err := host.NewClient(cfg, nil)
				require.NoError(t, err)
				invoke := func(ctx context.Context) error {
					switch operation {
					case "route":
						_, err := client.Route(ctx, smartRouterRequest())
						return err
					case "snapshot":
						_, err := client.Snapshot(ctx)
						return err
					default:
						return client.ReportOutcome(ctx, host.AttemptOutcome{Kind: "attempt_outcome", SchemaVersion: 1, EventID: "evt-1", RequestID: "req-1", BindingID: smartRouterBindingA, Protocol: host.ProtocolChat, Outcome: host.OutcomeSuccess})
					}
				}
				err = invoke(context.Background())
				require.ErrorIs(t, err, context.DeadlineExceeded)
				<-arrived
				ctx, cancel := context.WithCancel(context.Background())
				done := make(chan error, 1)
				go func() { done <- invoke(ctx) }()
				<-arrived
				cancel()
				require.ErrorIs(t, <-done, context.Canceled)
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
