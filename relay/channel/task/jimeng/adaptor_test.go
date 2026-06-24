package jimeng

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/constant"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
	"github.com/QuantumNous/new-api/service"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestResolveJimengReqKeyV30Variants(t *testing.T) {
	tests := []struct {
		name     string
		reqKey   string
		imageLen int
		want     string
	}{
		{
			name:     "v30 pro",
			reqKey:   "jimeng_v30_pro",
			imageLen: 0,
			want:     "jimeng_ti2v_v30_pro",
		},
		{
			name:     "v30 text to video",
			reqKey:   "jimeng_v30",
			imageLen: 0,
			want:     "jimeng_t2v_v30",
		},
		{
			name:     "v30 image to video",
			reqKey:   "jimeng_v30",
			imageLen: 1,
			want:     "jimeng_i2v_first_v30",
		},
		{
			name:     "v30 first tail",
			reqKey:   "jimeng_v30",
			imageLen: 2,
			want:     "jimeng_i2v_first_tail_v30",
		},
		{
			name:     "legacy model",
			reqKey:   defaultJimengTaskReqKey,
			imageLen: 0,
			want:     defaultJimengTaskReqKey,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			require.Equal(t, tt.want, resolveJimengReqKey(tt.reqKey, tt.imageLen))
		})
	}
}

func TestConvertToRequestPayloadStoresActualReqKey(t *testing.T) {
	adaptor := &TaskAdaptor{}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "jimeng_v30",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}
	req := &relaycommon.TaskSubmitReq{
		Prompt: "make a video",
		Images: []string{"https://example.com/first.png", "https://example.com/last.png"},
	}

	payload, err := adaptor.convertToRequestPayload(req, info)

	require.NoError(t, err)
	require.Equal(t, "jimeng_i2v_first_tail_v30", payload.ReqKey)
}

func TestBuildRequestBodyRecordsActualReqKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt: "make a video",
		Images: []string{"https://example.com/first.png", "https://example.com/last.png"},
	})
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "jimeng_v30",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)

	require.NoError(t, err)
	bodyBytes, err := io.ReadAll(body)
	require.NoError(t, err)
	require.Contains(t, string(bodyBytes), `"req_key":"jimeng_i2v_first_tail_v30"`)
	require.Equal(t, "jimeng_i2v_first_tail_v30", info.TaskRelayInfo.UpstreamRequestKey)
}

func TestJimengFetchTaskUsesPersistedRequestKey(t *testing.T) {
	var gotPayload map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "/jimeng/", r.URL.Path)
		require.Equal(t, "CVSync2AsyncGetResult", r.URL.Query().Get("Action"))
		require.Equal(t, "Bearer sk-test", r.Header.Get("Authorization"))
		require.NoError(t, json.NewDecoder(r.Body).Decode(&gotPayload))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":10000}`))
	}))
	t.Cleanup(server.Close)

	service.InitHttpClient()
	adaptor := &TaskAdaptor{baseURL: server.URL}

	resp, err := adaptor.FetchTask(server.URL, "sk-test", map[string]any{
		"task_id":              "upstream-task",
		"upstream_model_name":  "jimeng_v30_pro",
		"upstream_request_key": "jimeng_ti2v_v30_pro",
	}, "")

	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.Body.Close()
	require.Equal(t, map[string]string{
		"task_id": "upstream-task",
		"req_key": "jimeng_ti2v_v30_pro",
	}, gotPayload)
}

func TestJimengFetchReqKeyFallsBackToModelContext(t *testing.T) {
	require.Equal(t, "metadata_req_key", jimengFetchReqKey(map[string]any{
		"req_key": " metadata_req_key ",
	}))
	require.Equal(t, "jimeng_ti2v_v30_pro", jimengFetchReqKey(map[string]any{
		"upstream_model_name": "jimeng_v30_pro",
	}))
	require.Equal(t, "jimeng_i2v_first_tail_v30", jimengFetchReqKey(map[string]any{
		"upstream_model_name": "jimeng_v30",
		"action":              constant.TaskActionFirstTailGenerate,
	}))
	require.Equal(t, defaultJimengTaskReqKey, jimengFetchReqKey(map[string]any{}))
}

func TestJimengFetchTaskRejectsMissingTaskID(t *testing.T) {
	_, err := (&TaskAdaptor{}).FetchTask("https://example.com", "sk-test", map[string]any{}, "")
	require.Error(t, err)
}

func TestSignedFetchTaskUsesResolvedReqKey(t *testing.T) {
	var gotPayload map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.NoError(t, json.NewDecoder(r.Body).Decode(&gotPayload))
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"code":10000}`))
	}))
	t.Cleanup(server.Close)

	service.InitHttpClient()
	resp, err := (&TaskAdaptor{}).FetchTask(server.URL, "ak|sk", map[string]any{
		"task_id":             "upstream-task",
		"upstream_model_name": "jimeng_v30_pro",
	}, "")

	require.NoError(t, err)
	require.NotNil(t, resp)
	_ = resp.Body.Close()
	require.Equal(t, "jimeng_ti2v_v30_pro", gotPayload["req_key"])
	require.Equal(t, "upstream-task", gotPayload["task_id"])
}

func TestBuildRequestBodyKeepsMetadataReqKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/video/generations", nil)
	c.Set("task_request", relaycommon.TaskSubmitReq{
		Prompt: "make a video",
		Metadata: map[string]interface{}{
			"req_key": "custom_req_key",
		},
	})
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "jimeng_v30",
		},
		TaskRelayInfo: &relaycommon.TaskRelayInfo{},
	}

	body, err := (&TaskAdaptor{}).BuildRequestBody(c, info)

	require.NoError(t, err)
	bodyBytes, err := io.ReadAll(body)
	require.NoError(t, err)
	require.True(t, bytes.Contains(bodyBytes, []byte(`"req_key":"custom_req_key"`)))
	require.Equal(t, "custom_req_key", info.TaskRelayInfo.UpstreamRequestKey)
}
