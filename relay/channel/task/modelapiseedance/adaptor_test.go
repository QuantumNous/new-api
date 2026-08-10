package modelapiseedance

import (
	"testing"

	"github.com/QuantumNous/new-api/relay/channel"
)

var _ channel.TaskAdaptor = (*TaskAdaptor)(nil)

func TestModelAPISeedanceAdaptorIdentity(t *testing.T) {
	adaptor := &TaskAdaptor{}
	if got := adaptor.GetChannelName(); got != "modelapi-seedance" {
		t.Fatalf("GetChannelName() = %q, want modelapi-seedance", got)
	}
	models := adaptor.GetModelList()
	if len(models) != 1 || models[0] != "doubao-seedance-2-5-260628" {
		t.Fatalf("GetModelList() = %v, want [doubao-seedance-2-5-260628]", models)
	}
}
