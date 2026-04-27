package relay

import (
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/constant"
)

// TestGetAdaptorVolcAdapter verifies that ChannelTypeVolcAdapter maps through
// ChannelType2APIType to APITypeVolcEngine and that GetAdaptor returns a non-nil
// adaptor for it.
func TestGetAdaptorVolcAdapter(t *testing.T) {
	apiType, ok := common.ChannelType2APIType(constant.ChannelTypeVolcAdapter)
	if !ok {
		t.Fatalf("ChannelType2APIType(%d) returned ok=false; VolcAdapter is not registered",
			constant.ChannelTypeVolcAdapter)
	}
	if apiType != constant.APITypeVolcEngine {
		t.Errorf("expected APITypeVolcEngine (%d), got %d", constant.APITypeVolcEngine, apiType)
	}

	adaptor := GetAdaptor(apiType)
	if adaptor == nil {
		t.Fatalf("GetAdaptor(APITypeVolcEngine) returned nil")
	}
}

// TestGetTaskAdaptorVolcAdapter verifies that GetTaskAdaptor returns a non-nil
// adaptor for the VolcAdapter channel type (same taskdoubao adaptor as 45/54).
func TestGetTaskAdaptorVolcAdapter(t *testing.T) {
	platform := constant.TaskPlatform("58") // ChannelTypeVolcAdapter
	adaptor := GetTaskAdaptor(platform)
	if adaptor == nil {
		t.Fatalf("GetTaskAdaptor(%q) returned nil; VolcAdapter not registered in task adaptor routing", platform)
	}
}

// TestGetTaskAdaptorLegacyChannelsStillWork verifies that the legacy channels 45
// and 54 still resolve task adaptors (they remain in the routing table).
func TestGetTaskAdaptorLegacyChannelsStillWork(t *testing.T) {
	for _, ct := range []int{constant.ChannelTypeVolcEngine, constant.ChannelTypeDoubaoVideo} {
		platform := constant.TaskPlatform(intToStr(ct))
		adaptor := GetTaskAdaptor(platform)
		if adaptor == nil {
			t.Errorf("GetTaskAdaptor(%q) returned nil; channel %d must keep its task adaptor", platform, ct)
		}
	}
}

func intToStr(n int) string {
	buf := make([]byte, 0, 3)
	if n == 0 {
		return "0"
	}
	for n > 0 {
		buf = append([]byte{byte('0' + n%10)}, buf...)
		n /= 10
	}
	return string(buf)
}
