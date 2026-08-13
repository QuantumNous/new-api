package dto

import "testing"

func TestChannelOtherSettingsBlockRunPaymentChainDefaultsToBase(t *testing.T) {
	settings := ChannelOtherSettings{}
	if got := settings.GetBlockRunPaymentChain(); got != BlockRunPaymentChainBase {
		t.Fatalf("GetBlockRunPaymentChain() = %q, want %q", got, BlockRunPaymentChainBase)
	}

	settings.BlockRunPaymentChain = BlockRunPaymentChainSolana
	if got := settings.GetBlockRunPaymentChain(); got != BlockRunPaymentChainSolana {
		t.Fatalf("GetBlockRunPaymentChain() = %q, want %q", got, BlockRunPaymentChainSolana)
	}
}
