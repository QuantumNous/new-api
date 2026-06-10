package constant

import "testing"

func TestPath2RelayModePlaygroundImagesGenerations(t *testing.T) {
	if got := Path2RelayMode("/pg/images/generations"); got != RelayModeImagesGenerations {
		t.Fatalf("Path2RelayMode(/pg/images/generations) = %d, want %d", got, RelayModeImagesGenerations)
	}
}

func TestPath2RelayModePlaygroundImagesEdits(t *testing.T) {
	if got := Path2RelayMode("/pg/images/edits"); got != RelayModeImagesEdits {
		t.Fatalf("Path2RelayMode(/pg/images/edits) = %d, want %d", got, RelayModeImagesEdits)
	}
}
