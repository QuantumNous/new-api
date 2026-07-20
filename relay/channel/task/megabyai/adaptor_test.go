package megabyai

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestParseTaskResult_Completed(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{"id":"videos-mini_abc","status":"completed","progress":100}`))
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusSuccess {
		t.Fatalf("status=%q, want %q", info.Status, model.TaskStatusSuccess)
	}
}

func TestParseTaskResult_Failed(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{"id":"videos-mini_abc","status":"failed","error":{"code":"x","message":"boom"}}`))
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusFailure {
		t.Fatalf("status=%q, want %q", info.Status, model.TaskStatusFailure)
	}
	if info.Reason != "boom" {
		t.Fatalf("reason=%q, want boom", info.Reason)
	}
}

func TestParseTaskResult_InProgress(t *testing.T) {
	a := &TaskAdaptor{}
	info, err := a.ParseTaskResult([]byte(`{"id":"videos-mini_abc","status":"in_progress","progress":42}`))
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != model.TaskStatusInProgress {
		t.Fatalf("status=%q, want %q", info.Status, model.TaskStatusInProgress)
	}
	if info.Progress != "42%" {
		t.Fatalf("progress=%q, want 42%%", info.Progress)
	}
}

func TestBuildRequestURL(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://newapi.megabyai.cc/",
		},
	})
	got, err := a.BuildRequestURL(&relaycommon.RelayInfo{})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(got, "/v1/videos") {
		t.Fatalf("url=%q, want suffix /v1/videos", got)
	}
	if strings.Contains(got, "//v1") {
		t.Fatalf("double slash in url: %q", got)
	}
}
