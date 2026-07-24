package sora2u

import (
	"testing"

	"github.com/QuantumNous/new-api/model"
	relaycommon "github.com/QuantumNous/new-api/relay/common"
)

func TestBuildRequestURL(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://sora2u.com",
		},
	})
	u, err := a.BuildRequestURL(&relaycommon.RelayInfo{})
	if err != nil {
		t.Fatal(err)
	}
	if u != "https://sora2u.com/api/v1/videos" {
		t.Fatalf("url=%q", u)
	}
}

func TestBuildRequestURL_StripsAPI(t *testing.T) {
	a := &TaskAdaptor{}
	a.Init(&relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://sora2u.com/api",
		},
	})
	u, err := a.BuildRequestURL(&relaycommon.RelayInfo{})
	if err != nil {
		t.Fatal(err)
	}
	if u != "https://sora2u.com/api/v1/videos" {
		t.Fatalf("url=%q", u)
	}
}

func TestParseTaskResult_ViaAdaptor(t *testing.T) {
	a := &TaskAdaptor{}
	raw := []byte(`{"success":true,"task":{"id":"ck1","status":"processing","progress":40}}`)
	info, err := a.ParseTaskResult(raw)
	if err != nil {
		t.Fatal(err)
	}
	if info.Status != string(model.TaskStatusInProgress) {
		t.Fatalf("status=%q", info.Status)
	}
}
