package common

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestChannelType2APIType_APImart(t *testing.T) {
	apiType, ok := ChannelType2APIType(constant.ChannelTypeAPImart)
	if !ok {
		t.Fatalf("ChannelType2APIType(APImart) returned ok=false")
	}
	if apiType != constant.APITypeAPImart {
		t.Fatalf("expected APITypeAPImart, got %d", apiType)
	}
}
