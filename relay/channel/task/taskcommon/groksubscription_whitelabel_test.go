package taskcommon

import (
	"testing"

	"github.com/QuantumNous/new-api/constant"
)

func TestWhitelabelIncludesGrokSubscription(t *testing.T) {
	if !ShouldWhitelabelChannelType(constant.ChannelTypeGrokSubscription) {
		t.Fatal("Grok Subscription channel type must be whitelabeled")
	}
	if !ShouldWhitelabelPlatform(constant.TaskPlatform("113")) {
		t.Fatal("Grok Subscription task platform must be whitelabeled")
	}
}
