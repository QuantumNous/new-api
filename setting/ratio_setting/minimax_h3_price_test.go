package ratio_setting

import "testing"

func TestMiniMaxH3DefaultPrice(t *testing.T) {
	if got := GetDefaultModelPriceMap()["MiniMax-H3"]; got != 0.08 {
		t.Fatalf("MiniMax-H3 default price = %v, want 0.08", got)
	}
}
