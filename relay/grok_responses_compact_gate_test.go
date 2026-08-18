package relay

import (
	"testing"

	appconstant "github.com/QuantumNous/new-api/constant"
)

func TestGrokInResponsesCompactWhitelist(t *testing.T) {
	if !responsesCompactAPITypeAllowed(appconstant.APITypeGrokSubscription) {
		t.Fatalf("Grok must be in responses-compact api-type whitelist")
	}
}

// 顺带守护既有白名单成员不被误删。
func TestExistingApiTypesInResponsesCompactWhitelist(t *testing.T) {
	for _, at := range []int{appconstant.APITypeOpenAI, appconstant.APITypeCodex} {
		if !responsesCompactAPITypeAllowed(at) {
			t.Fatalf("api type %d must remain in compact whitelist", at)
		}
	}
}
