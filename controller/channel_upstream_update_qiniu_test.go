package controller

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
	"github.com/QuantumNous/new-api/model"
)

func TestFetchChannelUpstreamModelIDs_Qiniu(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			t.Fatalf("unexpected method: %s", r.Method)
		}
		if r.URL.Path != "/v1/models" {
			t.Fatalf("unexpected path: %s", r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer test-key" {
			t.Fatalf("unexpected Authorization header: %q", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"id":"deepseek/deepseek-v3.1-terminus-thinking"},{"id":"gpt-4"}]}`))
	}))
	defer srv.Close()

	ch := &model.Channel{
		Id:     123,
		Type:   constant.ChannelTypeQiniu,
		Key:    "test-key",
		Status: common.ChannelStatusEnabled,
		BaseURL: common.GetPointer[string](srv.URL),
	}

	got, err := fetchChannelUpstreamModelIDs(ch)
	if err != nil {
		t.Fatalf("fetchChannelUpstreamModelIDs returned error: %v", err)
	}
	if len(got) != 2 || got[0] != "deepseek/deepseek-v3.1-terminus-thinking" || got[1] != "gpt-4" {
		t.Fatalf("unexpected models: %#v", got)
	}
}

