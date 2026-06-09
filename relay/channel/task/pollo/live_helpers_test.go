package pollo

import (
	"bytes"
	"io"
	"net/http"
	"testing"

	"github.com/QuantumNous/new-api/common"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

// reqStub is the canonical minimal text-to-video request used by the live test.
var reqStub = relaycommon.TaskSubmitReq{
	Prompt:   "a corgi running on the beach at sunset, cinematic",
	Duration: 4,
	Metadata: map[string]interface{}{
		"resolution":  "480p",
		"aspectRatio": "16:9",
	},
}

func infoFor(modelName string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: modelName,
			ChannelBaseUrl:    defaultBaseURL,
		},
	}
}

func liveSubmit(t *testing.T, key, path string, body []byte) string {
	t.Helper()
	url := defaultBaseURL + "/generation/" + path
	req, err := http.NewRequest(http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		t.Fatalf("new request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("x-api-key", key)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("submit request: %v", err)
	}
	b := readAll(t, resp)
	t.Logf("submit response (HTTP %d): %s", resp.StatusCode, b)

	var r polloSubmitResponse
	if err := common.Unmarshal(b, &r); err != nil {
		t.Fatalf("unmarshal submit response: %v", err)
	}
	if r.failed() || r.taskID() == "" {
		t.Fatalf("submit failed: code=%q msg=%q", r.Code, r.Message)
	}
	return r.taskID()
}

func readAll(t *testing.T, resp *http.Response) []byte {
	t.Helper()
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	return b
}
