package constant

import "testing"

func TestPath2RelayModeSupportsPlaygroundMediaAliases(t *testing.T) {
	tests := []struct {
		path string
		want int
	}{
		{path: "/pg/chat/completions", want: RelayModeChatCompletions},
		{path: "/pg/images/generations", want: RelayModeImagesGenerations},
	}

	for _, test := range tests {
		t.Run(test.path, func(t *testing.T) {
			if got := Path2RelayMode(test.path); got != test.want {
				t.Fatalf("Path2RelayMode(%q) = %d, want %d", test.path, got, test.want)
			}
		})
	}
}
