package constant

import "testing"

func TestPath2RelayModePlaygroundImagesGenerations(t *testing.T) {
	if got := Path2RelayMode("/pg/images/generations"); got != RelayModeImagesGenerations {
		t.Fatalf("Path2RelayMode(/pg/images/generations) = %d, want %d", got, RelayModeImagesGenerations)
	}
}
